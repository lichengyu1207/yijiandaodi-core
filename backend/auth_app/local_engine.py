"""
本地智能分析引擎
集成 Ollama 本地推理 + DeepSeek 云端推理
实现"数据不出域"的核心能力
"""
import json
import asyncio
import logging
import httpx
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from enum import Enum
import re

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class AnalysisMode(Enum):
    """分析模式"""
    LOCAL = "local"       # 本地推理（Ollama）
    CLOUD = "cloud"       # 云端推理（DeepSeek）
    HYBRID = "hybrid"     # 混合推理（先本地，复杂任务云端）


@dataclass
class AnalysisResult:
    """分析结果"""
    success: bool
    mode: AnalysisMode
    risk_level: str      # low, medium, high
    confidence: float    # 0.0 - 1.0
    analysis: str
    recommendation: str
    raw_response: Dict[str, Any]


class RuleEngine:
    """规则引擎 - 处理轻量级任务"""

    # 金额异常规则
    AMOUNT_THRESHOLDS = {
        'warning': 10000,    # 超过1万警告
        'high': 100000       # 超过10万高风险
    }

    # 敏感文件规则
    SENSITIVE_FILES = [
        '/etc/passwd', '/etc/shadow', '.ssh/id_rsa',
        '.env', 'credentials', 'password', 'secret',
        'token', 'api_key', 'private_key'
    ]

    # 可疑命令模式
    SUSPICIOUS_PATTERNS = [
        r'base64\s+-[ed]',
        r'curl\s+.*\|\s*bash',
        r'wget\s+.*\|\s*sh',
        r'eval\s*\(',
        r'exec\s*\(',
        r'shell\s*\(',
        r'rm\s+-rf\s+/',
    ]

    def check_amount(self, content: str) -> Optional[Dict]:
        """检查金额异常"""
        # 提取金额数字
        amounts = re.findall(r'[\d,]+\.?\d*', content.replace(',', ''))
        
        for amount_str in amounts:
            try:
                amount = float(amount_str)
                if amount >= self.AMOUNT_THRESHOLDS['high']:
                    return {
                        'risk_level': 'high',
                        'analysis': f'检测到大额操作：¥{amount:,.2f}',
                        'recommendation': '建议二次确认或人工审核'
                    }
                elif amount >= self.AMOUNT_THRESHOLDS['warning']:
                    return {
                        'risk_level': 'medium',
                        'analysis': f'检测到中等金额操作：¥{amount:,.2f}',
                        'recommendation': '建议确认操作意图'
                    }
            except ValueError:
                continue
        
        return None

    def check_sensitive_file(self, content: str) -> Optional[Dict]:
        """检查敏感文件访问"""
        for file_pattern in self.SENSITIVE_FILES:
            if file_pattern.lower() in content.lower():
                return {
                    'risk_level': 'high',
                    'analysis': f'检测到敏感文件访问：{file_pattern}',
                    'recommendation': '建议阻止或记录审计'
                }
        
        return None

    def check_suspicious_command(self, content: str) -> Optional[Dict]:
        """检查可疑命令"""
        for pattern in self.SUSPICIOUS_PATTERNS:
            if re.search(pattern, content, re.IGNORECASE):
                return {
                    'risk_level': 'high',
                    'analysis': f'检测到可疑命令模式',
                    'recommendation': '建议拦截并审计'
                }
        
        return None

    def analyze(self, content: str) -> Optional[Dict]:
        """规则引擎分析"""
        # 按优先级检查
        checks = [
            self.check_sensitive_file(content),
            self.check_suspicious_command(content),
            self.check_amount(content),
        ]
        
        for result in checks:
            if result:
                return result
        
        return None


class LocalAnalysisEngine:
    """本地智能分析引擎"""

    def __init__(
        self,
        ollama_url: str = "http://localhost:11434",
        deepseek_url: str = "https://api.deepseek.com",
        deepseek_key: Optional[str] = None,
        prefer_local: bool = True
    ):
        self.ollama_url = ollama_url
        self.deepseek_url = deepseek_url
        self.deepseek_key = deepseek_key
        self.prefer_local = prefer_local
        self.rule_engine = RuleEngine()
        self.client = httpx.AsyncClient(timeout=60.0)

    async def check_ollama_available(self) -> bool:
        """检查 Ollama 是否可用"""
        try:
            response = await self.client.get(f"{self.ollama_url}/api/tags")
            return response.status_code == 200
        except:
            return False

    async def analyze_with_ollama(
        self,
        content: str,
        model: str = "deepseek-coder:6.7b"
    ) -> AnalysisResult:
        """使用 Ollama 本地推理"""
        prompt = f"""你是一鉴到底的安全分析专家。请分析以下操作的风险：

操作内容:
{content}

请从以下维度分析：
1. 是否涉及敏感数据？
2. 是否有权限越界？
3. 是否存在数据泄露可能？

请用简洁的中文回复，格式：
- 风险等级：低/中/高
- 分析结论：一句话说明
- 建议：具体操作建议
"""

        try:
            response = await self.client.post(
                f"{self.ollama_url}/api/generate",
                json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.3,
                        "num_predict": 300
                    }
                }
            )

            if response.status_code == 200:
                data = response.json()
                text = data.get('response', '')
                
                # 解析结果
                risk_level = 'low'
                if '风险等级：高' in text or '高风险' in text:
                    risk_level = 'high'
                elif '风险等级：中' in text or '中风险' in text:
                    risk_level = 'medium'
                
                return AnalysisResult(
                    success=True,
                    mode=AnalysisMode.LOCAL,
                    risk_level=risk_level,
                    confidence=0.85,
                    analysis=text,
                    recommendation='本地分析完成',
                    raw_response=data
                )
            
        except Exception as e:
            logger.error(f"Ollama 分析失败: {e}")

        return AnalysisResult(
            success=False,
            mode=AnalysisMode.LOCAL,
            risk_level='unknown',
            confidence=0.0,
            analysis='本地分析失败',
            recommendation='请检查 Ollama 服务',
            raw_response={}
        )

    async def analyze_with_deepseek(self, content: str) -> AnalysisResult:
        """使用 DeepSeek 云端推理"""
        if not self.deepseek_key:
            return AnalysisResult(
                success=False,
                mode=AnalysisMode.CLOUD,
                risk_level='unknown',
                confidence=0.0,
                analysis='DeepSeek API 密钥未配置',
                recommendation='请在设置中配置 API 密钥',
                raw_response={}
            )

        prompt = f"""你是一鉴到底的安全分析专家。请分析以下操作的风险：

操作内容:
{content}

请用简洁的中文回复，格式：
- 风险等级：低/中/高
- 分析结论：一句话说明
- 建议：具体操作建议
"""

        try:
            response = await self.client.post(
                f"{self.deepseek_url}/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.deepseek_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "deepseek-chat",
                    "messages": [
                        {"role": "system", "content": "你是一鉴到底AI安全分析助手，专注于AI Agent行为安全分析。"},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.3,
                    "max_tokens": 500
                }
            )

            if response.status_code == 200:
                data = response.json()
                text = data['choices'][0]['message']['content']
                
                risk_level = 'low'
                if '风险等级：高' in text or '高风险' in text:
                    risk_level = 'high'
                elif '风险等级：中' in text or '中风险' in text:
                    risk_level = 'medium'
                
                return AnalysisResult(
                    success=True,
                    mode=AnalysisMode.CLOUD,
                    risk_level=risk_level,
                    confidence=0.95,
                    analysis=text,
                    recommendation='云端分析完成',
                    raw_response=data
                )

        except Exception as e:
            logger.error(f"DeepSeek 分析失败: {e}")

        return AnalysisResult(
            success=False,
            mode=AnalysisMode.CLOUD,
            risk_level='unknown',
            confidence=0.0,
            analysis='云端分析失败',
            recommendation='请检查网络连接',
            raw_response={}
        )

    async def analyze(self, content: str) -> AnalysisResult:
        """
        智能分析 - 混合推理策略
        1. 先用规则引擎（轻量任务）
        2. 本地推理（Ollama）
        3. 云端推理（DeepSeek，作为备用）
        """
        # 1. 规则引擎
        rule_result = self.rule_engine.analyze(content)
        if rule_result:
            return AnalysisResult(
                success=True,
                mode=AnalysisMode.LOCAL,
                risk_level=rule_result['risk_level'],
                confidence=0.99,
                analysis=rule_result['analysis'],
                recommendation=rule_result['recommendation'],
                raw_response={'source': 'rule_engine'}
            )

        # 2. 本地推理
        if self.prefer_local:
            ollama_available = await self.check_ollama_available()
            if ollama_available:
                result = await self.analyze_with_ollama(content)
                if result.success:
                    return result

        # 3. 云端推理（备用）
        return await self.analyze_with_deepseek(content)


# ===== 使用示例 =====

async def demo_local_engine():
    """演示本地分析引擎"""

    engine = LocalAnalysisEngine(
        ollama_url="http://localhost:11434",
        deepseek_url="https://api.deepseek.com",
        deepseek_key=None,  # 从环境变量读取
        prefer_local=True
    )

    # 测试1: 规则引擎
    print("\n[测试1] 规则引擎 - 金额检查")
    result = await engine.analyze("转账金额：¥150,000.00")
    print(f"风险: {result.risk_level}, 分析: {result.analysis}")

    # 测试2: 规则引擎 - 敏感文件
    print("\n[测试2] 规则引擎 - 敏感文件")
    result = await engine.analyze("cat /etc/passwd")
    print(f"风险: {result.risk_level}, 分析: {result.analysis}")

    # 测试3: 本地推理
    print("\n[测试3] 本地推理 - Ollama")
    result = await engine.analyze("执行代码：import os; os.system('ls -la')")
    print(f"模式: {result.mode.value}, 风险: {result.risk_level}")


if __name__ == "__main__":
    asyncio.run(demo_local_engine())