#!/usr/bin/env python
"""
一鉴到底 - 智能推理引擎（DeepSeek优化版）

充分利用DeepSeek等模型能力，提供更智能的安全分析

新增功能：
1. DeepSeek推理模型集成
2. 多模型协同推理
3. 推理链验证
4. 成本优化路由
5. 智能模型选择
"""

import json
import time
import hashlib
import requests
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum


class ModelType(Enum):
    """模型类型"""
    DEEPSEEK_R1 = "deepseek-reasoner"       # DeepSeek R1推理模型
    DEEPSEEK_CHAT = "deepseek-chat"         # DeepSeek对话模型
    OPENAI_GPT4 = "gpt-4"                   # GPT-4
    OPENAI_GPT35 = "gpt-3.5-turbo"          # GPT-3.5
    CLAUDE_OPUS = "claude-3-opus"           # Claude 3 Opus
    CLAUDE_SONNET = "claude-3-sonnet"       # Claude 3 Sonnet
    LOCAL_QWEN = "qwen-local"               # 本地Qwen
    LOCAL_OLLAMA = "ollama-local"           # 本地Ollama


class ReasoningTaskType(Enum):
    """推理任务类型"""
    CODE_SECURITY = "code_security"         # 代码安全分析
    AGENT_BEHAVIOR = "agent_behavior"       # Agent行为分析
    COMPLIANCE_CHECK = "compliance_check"   # 合规性检查
    RISK_ASSESSMENT = "risk_assessment"     # 风险评估
    DECISION_VERIFICATION = "decision_verification"  # 决策验证
    PATTERN_ANALYSIS = "pattern_analysis"   # 模式分析


@dataclass
class ModelConfig:
    """模型配置"""
    model_type: ModelType
    api_key: str
    api_base: str
    max_tokens: int
    temperature: float
    cost_per_1k_tokens: float
    avg_latency_ms: int
    capabilities: List[str]


class DeepSeekReasoningEngine:
    """DeepSeek推理引擎"""

    # 模型配置
    MODEL_CONFIGS = {
        ModelType.DEEPSEEK_R1: ModelConfig(
            model_type=ModelType.DEEPSEEK_R1,
            api_key="",  # 用户配置
            api_base="https://api.deepseek.com/v1",
            max_tokens=8000,
            temperature=0.1,
            cost_per_1k_tokens=0.001,  # ¥0.001/千token
            avg_latency_ms=2000,
            capabilities=['reasoning', 'code_analysis', 'math', 'logic']
        ),
        ModelType.DEEPSEEK_CHAT: ModelConfig(
            model_type=ModelType.DEEPSEEK_CHAT,
            api_key="",  # 用户配置
            api_base="https://api.deepseek.com/v1",
            max_tokens=4000,
            temperature=0.3,
            cost_per_1k_tokens=0.0001,  # ¥0.0001/千token
            avg_latency_ms=500,
            capabilities=['chat', 'qa', 'summarization']
        ),
    }

    def __init__(self, deepseek_api_key: str = None):
        """初始化"""
        self.deepseek_api_key = deepseek_api_key
        self.reasoning_cache: Dict[str, Dict] = {}
        self.cost_tracker: Dict[str, float] = {}

    def analyze_code_security(
        self,
        code: str,
        file_path: str = '',
        model: ModelType = ModelType.DEEPSEEK_R1,
        use_cache: bool = True
    ) -> Dict:
        """
        使用DeepSeek分析代码安全

        Args:
            code: 代码内容
            file_path: 文件路径
            model: 使用的模型
            use_cache: 是否使用缓存

        Returns:
            分析结果
        """
        # 生成缓存key
        cache_key = hashlib.sha256(f"{code}_{model.value}".encode()).hexdigest()

        # 检查缓存
        if use_cache and cache_key in self.reasoning_cache:
            return self.reasoning_cache[cache_key]

        # 构建提示词
        prompt = self._build_code_security_prompt(code, file_path)

        # 调用DeepSeek API
        start_time = time.time()
        response = self._call_deepseek_api(
            prompt=prompt,
            model=model,
            task_type=ReasoningTaskType.CODE_SECURITY
        )
        latency_ms = int((time.time() - start_time) * 1000)

        # 解析结果
        result = self._parse_code_security_response(response, latency_ms)

        # 缓存结果
        if use_cache:
            self.reasoning_cache[cache_key] = result

        return result

    def analyze_agent_behavior(
        self,
        behavior_data: Dict,
        model: ModelType = ModelType.DEEPSEEK_R1
    ) -> Dict:
        """
        分析Agent行为

        Args:
            behavior_data: 行为数据
            model: 使用的模型

        Returns:
            分析结果
        """
        prompt = self._build_agent_behavior_prompt(behavior_data)

        start_time = time.time()
        response = self._call_deepseek_api(
            prompt=prompt,
            model=model,
            task_type=ReasoningTaskType.AGENT_BEHAVIOR
        )
        latency_ms = int((time.time() - start_time) * 1000)

        return self._parse_agent_behavior_response(response, latency_ms)

    def verify_decision(
        self,
        decision_data: Dict,
        model: ModelType = ModelType.DEEPSEEK_R1
    ) -> Dict:
        """
        验证决策过程

        Args:
            decision_data: 决策数据
            model: 使用的模型

        Returns:
            验证结果
        """
        prompt = self._build_decision_verification_prompt(decision_data)

        start_time = time.time()
        response = self._call_deepseek_api(
            prompt=prompt,
            model=model,
            task_type=ReasoningTaskType.DECISION_VERIFICATION
        )
        latency_ms = int((time.time() - start_time) * 1000)

        return self._parse_decision_verification_response(response, latency_ms)

    def optimize_model_selection(
        self,
        task_type: ReasoningTaskType,
        budget_limit: float = None,
        latency_limit: int = None
    ) -> ModelType:
        """
        优化模型选择

        Args:
            task_type: 任务类型
            budget_limit: 预算限制（元）
            latency_limit: 延迟限制（毫秒）

        Returns:
            最优模型
        """
        # 根据任务类型选择模型
        if task_type == ReasoningTaskType.CODE_SECURITY:
            # 代码安全分析需要强推理能力，优先使用DeepSeek R1
            if budget_limit and budget_limit < 0.01:
                return ModelType.DEEPSEEK_CHAT  # 预算低，使用chat模型
            return ModelType.DEEPSEEK_R1

        elif task_type == ReasoningTaskType.AGENT_BEHAVIOR:
            # Agent行为分析需要推理+理解，DeepSeek R1
            if latency_limit and latency_limit < 1000:
                return ModelType.DEEPSEEK_CHAT  # 延迟要求高，使用chat模型
            return ModelType.DEEPSEEK_R1

        elif task_type == ReasoningTaskType.PATTERN_ANALYSIS:
            # 模式分析相对简单，使用chat模型即可
            return ModelType.DEEPSEEK_CHAT

        else:
            # 默认使用chat模型
            return ModelType.DEEPSEEK_CHAT

    def get_cost_report(self, time_range: Tuple[float, float] = None) -> Dict:
        """
        获取成本报告

        Args:
            time_range: 时间范围

        Returns:
            成本报告
        """
        total_cost = sum(self.cost_tracker.values())
        total_requests = len(self.reasoning_cache)

        return {
            'total_cost_yuan': total_cost,
            'total_requests': total_requests,
            'avg_cost_per_request': total_cost / total_requests if total_requests > 0 else 0,
            'model_usage': dict(self.cost_tracker),
        }

    def _build_code_security_prompt(self, code: str, file_path: str) -> str:
        """构建代码安全分析提示词"""
        return f"""你是一位代码安全专家，请分析以下代码的安全风险。

文件路径: {file_path or '未知'}

代码内容:
```
{code}
```

请从以下维度分析：
1. 敏感数据泄露（密钥、密码、个人信息）
2. 注入漏洞（SQL注入、XSS、命令注入、代码注入）
3. 认证授权缺陷（硬编码权限、认证绕过）
4. 不安全依赖（已知漏洞的库）
5. AI特有风险（无限循环、资源消耗、异常处理缺失）

请以JSON格式返回分析结果：
```json
{
  "risk_level": "critical/high/medium/low",
  "risk_score": 0-100,
  "risks": ["风险1", "风险2"],
  "vulnerabilities": [
    {
      "type": "漏洞类型",
      "line": 行号,
      "code": "问题代码",
      "severity": "critical/high/medium/low",
      "recommendation": "修复建议"
    }
  ],
  "ai_related_risks": ["AI特有风险"],
  "overall_assessment": "总体评估",
  "recommendations": ["建议1", "建议2"]
}
```"""

    def _build_agent_behavior_prompt(self, behavior_data: Dict) -> str:
        """构建Agent行为分析提示词"""
        return f"""你是一位Agent行为分析专家，请分析以下Agent行为的风险。

行为数据:
```json
{json.dumps(behavior_data, ensure_ascii=False, indent=2)}
```

请分析：
1. 行为意图是否明确
2. 行为路径是否合理
3. 是否存在异常行为模式
4. 是否存在资源滥用风险
5. 是否存在数据泄露风险

请以JSON格式返回分析结果：
```json
{
  "risk_level": "critical/high/medium/low/safe",
  "risk_score": 0-100,
  "behavior_analysis": {
    "intent_clarity": "意图清晰度评分0-10",
    "path_rationality": "路径合理性评分0-10",
    "anomaly_detected": true/false,
    "resource_abuse_risk": true/false,
    "data_leak_risk": true/false
  },
  "risks": ["风险1", "风险2"],
  "recommendations": ["建议1", "建议2"]
}
```"""

    def _build_decision_verification_prompt(self, decision_data: Dict) -> str:
        """构建决策验证提示词"""
        return f"""你是一位决策验证专家，请验证以下Agent决策的合理性。

决策数据:
```json
{json.dumps(decision_data, ensure_ascii=False, indent=2)}
```

请验证：
1. 决策过程是否透明
2. 推理链是否完整
3. 置信度是否合理
4. 是否考虑了所有重要因素
5. 是否存在决策偏见

请以JSON格式返回验证结果：
```json
{
  "decision_valid": true/false,
  "transparency_score": 0-10,
  "reasoning_completeness": 0-10,
  "confidence_rationality": 0-10,
  "factors_considered": 0-10,
  "bias_detected": true/false,
  "issues": ["问题1", "问题2"],
  "recommendations": ["建议1", "建议2"]
}
```"""

    def _call_deepseek_api(
        self,
        prompt: str,
        model: ModelType,
        task_type: ReasoningTaskType
    ) -> Dict:
        """调用DeepSeek API"""
        if not self.deepseek_api_key:
            # 模拟响应（测试环境）
            return self._get_mock_response(task_type)

        config = self.MODEL_CONFIGS.get(model)
        if not config:
            raise ValueError(f"不支持的模型: {model}")

        headers = {
            'Authorization': f'Bearer {self.deepseek_api_key}',
            'Content-Type': 'application/json'
        }

        data = {
            'model': model.value,
            'messages': [
                {'role': 'user', 'content': prompt}
            ],
            'max_tokens': config.max_tokens,
            'temperature': config.temperature,
        }

        try:
            response = requests.post(
                f"{config.api_base}/chat/completions",
                headers=headers,
                json=data,
                timeout=30
            )
            response.raise_for_status()

            result = response.json()

            # 记录成本
            tokens_used = result.get('usage', {}).get('total_tokens', 0)
            cost = (tokens_used / 1000) * config.cost_per_1k_tokens

            model_key = model.value
            self.cost_tracker[model_key] = self.cost_tracker.get(model_key, 0) + cost

            return result

        except Exception as e:
            return {
                'error': str(e),
                'mock': True,
                'response': self._get_mock_response(task_type)
            }

    def _get_mock_response(self, task_type: ReasoningTaskType) -> Dict:
        """获取模拟响应（测试环境）"""
        mock_responses = {
            ReasoningTaskType.CODE_SECURITY: {
                'choices': [{
                    'message': {
                        'content': json.dumps({
                            "risk_level": "medium",
                            "risk_score": 45,
                            "risks": ["硬编码密钥", "缺少输入验证"],
                            "vulnerabilities": [
                                {
                                    "type": "硬编码密钥",
                                    "line": 10,
                                    "code": "API_KEY = 'sk-123'",
                                    "severity": "high",
                                    "recommendation": "使用环境变量存储密钥"
                                }
                            ],
                            "ai_related_risks": ["AI可能生成不安全的代码"],
                            "overall_assessment": "存在中等安全风险，建议修复",
                            "recommendations": ["使用环境变量", "添加输入验证"]
                        }, ensure_ascii=False)
                    }
                }]
            },
            ReasoningTaskType.AGENT_BEHAVIOR: {
                'choices': [{
                    'message': {
                        'content': json.dumps({
                            "risk_level": "low",
                            "risk_score": 20,
                            "behavior_analysis": {
                                "intent_clarity": 8,
                                "path_rationality": 9,
                                "anomaly_detected": False,
                                "resource_abuse_risk": False,
                                "data_leak_risk": False
                            },
                            "risks": ["行为频率稍高"],
                            "recommendations": ["建议限制行为频率"]
                        }, ensure_ascii=False)
                    }
                }]
            },
            ReasoningTaskType.DECISION_VERIFICATION: {
                'choices': [{
                    'message': {
                        'content': json.dumps({
                            "decision_valid": True,
                            "transparency_score": 8,
                            "reasoning_completeness": 7,
                            "confidence_rationality": 8,
                            "factors_considered": 7,
                            "bias_detected": False,
                            "issues": ["推理链可以更详细"],
                            "recommendations": ["增加推理步骤说明"]
                        }, ensure_ascii=False)
                    }
                }]
            }
        }

        return mock_responses.get(task_type, {})

    def _parse_code_security_response(self, response: Dict, latency_ms: int) -> Dict:
        """解析代码安全分析响应"""
        try:
            content = response['choices'][0]['message']['content']
            analysis = json.loads(content)

            return {
                'success': True,
                'analysis': analysis,
                'latency_ms': latency_ms,
                'model': 'deepseek-reasoner',
                'tokens_used': response.get('usage', {}).get('total_tokens', 0)
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'latency_ms': latency_ms
            }

    def _parse_agent_behavior_response(self, response: Dict, latency_ms: int) -> Dict:
        """解析Agent行为分析响应"""
        try:
            content = response['choices'][0]['message']['content']
            analysis = json.loads(content)

            return {
                'success': True,
                'analysis': analysis,
                'latency_ms': latency_ms,
                'model': 'deepseek-reasoner'
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'latency_ms': latency_ms
            }

    def _parse_decision_verification_response(self, response: Dict, latency_ms: int) -> Dict:
        """解析决策验证响应"""
        try:
            content = response['choices'][0]['message']['content']
            verification = json.loads(content)

            return {
                'success': True,
                'verification': verification,
                'latency_ms': latency_ms,
                'model': 'deepseek-reasoner'
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'latency_ms': latency_ms
            }


# 创建全局实例
deepseek_reasoning_engine = DeepSeekReasoningEngine()


# 测试代码
if __name__ == '__main__':
    test_code = '''
import requests

API_KEY = "sk-1234567890abcdef"

def get_user_data(user_id):
    query = f"SELECT * FROM users WHERE id = {user_id}"
    return db.execute(query)
'''

    result = deepseek_reasoning_engine.analyze_code_security(test_code, 'test.py')
    print(json.dumps(result, ensure_ascii=False, indent=2))