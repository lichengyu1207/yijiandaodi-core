#!/usr/bin/env python
"""
一鉴到底 - LLM 智能分析引擎
支持内置默认模型与用户自定义模型
"""

import os
import json
import requests
from typing import Dict, Optional
from dataclasses import dataclass


@dataclass
class LLMConfig:
    """LLM 配置"""
    provider: str  # deepseek, openai, anthropic, local
    api_key: Optional[str] = None
    api_base: Optional[str] = None
    model: str = "deepseek-chat"
    temperature: float = 0.3
    max_tokens: int = 1000
    
    # 内置默认配置（产品自带）
    BUILTIN_CONFIG = {
        'provider': 'deepseek',
        'api_base': 'https://api.deepseek.com',
        'model': 'deepseek-chat',
    }


class LLMAnalyzer:
    """LLM 智能分析器"""
    
    def __init__(self, config: LLMConfig = None):
        self.config = config or LLMConfig(
            provider=LLMConfig.BUILTIN_CONFIG['provider'],
            api_base=LLMConfig.BUILTIN_CONFIG['api_base'],
            model=LLMConfig.BUILTIN_CONFIG['model'],
        )
    
    def analyze_operation(self, operation_type: str, content: str, context: str = None) -> Dict:
        """分析操作风险"""
        
        prompt = f"""你是一个 AI 安全分析专家。请分析以下操作的风险：

操作类型: {operation_type}
操作内容: {content[:500]}
上下文: {context or '无'}

请判断：
1. 风险等级（low/medium/high/critical）
2. 风险分数（0-100）
3. 风险标签（如：硬编码密钥、敏感文件、危险命令等）
4. 拦截建议（allow/block/ask_user）
5. 详细分析（为什么有风险）

请用 JSON 格式回复：
{{
    "risk_level": "critical",
    "risk_score": 90,
    "risk_tags": ["硬编码密钥", "数据泄露风险"],
    "decision": "block",
    "analysis": "检测到硬编码的 API Key，可能导致密钥泄露..."
}}"""

        return self._call_llm(prompt)
    
    def analyze_code(self, code: str, file_path: str = None) -> Dict:
        """分析代码风险"""
        
        prompt = f"""你是一个代码安全分析专家。请分析以下代码的安全风险：

文件: {file_path or '未知'}
代码:
```
{code[:1000]}
```

请检查：
1. 是否包含硬编码密钥/密码/Token？
2. 是否使用了危险函数（eval, exec, os.system）？
3. 是否有 SQL 注入/XSS 风险？
4. 是否有敏感数据泄露风险？

请用 JSON 格式回复：
{{
    "risk_level": "critical",
    "risk_score": 90,
    "risk_tags": ["硬编码密钥"],
    "decision": "block",
    "analysis": "检测到硬编码的 API Key..."
}}"""

        return self._call_llm(prompt)
    
    def explain_risk(self, risk_tags: list, risk_level: str) -> str:
        """解释风险（用于用户提示）"""
        
        prompt = f"""请用通俗易懂的语言解释以下安全风险：

风险等级: {risk_level}
风险标签: {', '.join(risk_tags)}

请解释：
1. 这个风险是什么？
2. 为什么危险？
3. 应该怎么做？

用 2-3 句话简单说明。"""

        result = self._call_llm(prompt)
        return result.get('text', '')
    
    def _call_llm(self, prompt: str) -> Dict:
        """调用 LLM API"""
        
        if self.config.provider == 'deepseek':
            return self._call_deepseek(prompt)
        elif self.config.provider == 'openai':
            return self._call_openai(prompt)
        elif self.config.provider == 'anthropic':
            return self._call_anthropic(prompt)
        elif self.config.provider == 'local':
            return self._call_local(prompt)
        else:
            return {'error': '未知的 LLM 提供商'}
    
    def _call_deepseek(self, prompt: str) -> Dict:
        """调用 DeepSeek API"""
        
        api_key = self.config.api_key or os.environ.get('DEEPSEEK_API_KEY')
        if not api_key:
            return self._fallback_analysis(prompt)
        
        try:
            response = requests.post(
                f"{self.config.api_base}/v1/chat/completions",
                headers={
                    'Authorization': f'Bearer {api_key}',
                    'Content-Type': 'application/json'
                },
                json={
                    'model': self.config.model,
                    'messages': [
                        {'role': 'system', 'content': '你是一个专业的代码安全分析专家。'},
                        {'role': 'user', 'content': prompt}
                    ],
                    'temperature': self.config.temperature,
                    'max_tokens': self.config.max_tokens
                },
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                text = data['choices'][0]['message']['content']
                
                try:
                    if '```json' in text:
                        json_str = text.split('```json')[1].split('```')[0].strip()
                    elif '```' in text:
                        json_str = text.split('```')[1].split('```')[0].strip()
                    else:
                        json_str = text
                    
                    return json.loads(json_str)
                except:
                    return {'text': text, 'raw': True}
            else:
                return {'error': f'API 调用失败: {response.status_code}'}
                
        except Exception as e:
            return {'error': str(e)}
    
    def _call_openai(self, prompt: str) -> Dict:
        """调用 OpenAI API"""
        # 类似 DeepSeek 实现
        pass
    
    def _call_anthropic(self, prompt: str) -> Dict:
        """调用 Anthropic API"""
        # 类似 DeepSeek 实现
        pass
    
    def _call_local(self, prompt: str) -> Dict:
        """调用本地模型（如 Ollama）"""
        
        try:
            response = requests.post(
                "http://localhost:11434/api/generate",
                json={
                    'model': self.config.model,
                    'prompt': prompt,
                    'stream': False
                },
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                text = data.get('response', '')
                
                try:
                    return json.loads(text)
                except:
                    return {'text': text, 'raw': True}
            else:
                return {'error': '本地模型调用失败'}
                
        except Exception as e:
            return {'error': f'本地模型未启动: {e}'}
    
    def _fallback_analysis(self, prompt: str) -> Dict:
        """降级分析（当 API 不可用时）"""
        
        # 使用本地规则引擎
        from realtime_interceptor import RuleEngine
        
        rule_engine = RuleEngine()
        
        if 'api_key' in prompt.lower() or 'api-key' in prompt.lower():
            return {
                'risk_level': 'critical',
                'risk_score': 90,
                'risk_tags': ['硬编码密钥'],
                'decision': 'block',
                'analysis': '检测到可能的硬编码密钥，请使用环境变量替代。'
            }
        
        if 'eval' in prompt or 'exec' in prompt:
            return {
                'risk_level': 'high',
                'risk_score': 70,
                'risk_tags': ['危险函数'],
                'decision': 'ask_user',
                'analysis': '检测到危险函数 eval/exec，可能导致代码注入。'
            }
        
        return {
            'risk_level': 'low',
            'risk_score': 10,
            'risk_tags': [],
            'decision': 'allow',
            'analysis': '未检测到明显风险。'
        }


def test_llm_analyzer():
    """测试 LLM 分析器"""
    
    print("\n" + "="*60)
    print("   LLM 智能分析测试")
    print("="*60)
    
    # 方式 1: 使用内置模型（开箱即用）
    print("\n[方式 1] 使用内置模型（无需配置）")
    analyzer = LLMAnalyzer()
    
    # 分析代码
    code = '''
import openai

OPENAI_API_KEY = "sk-proj-xxxxxxxxxxxx"

def call_gpt(prompt):
    client = openai.OpenAI(api_key=OPENAI_API_KEY)
    return client.chat.completions.create(...)
'''
    
    result = analyzer.analyze_code(code, 'api_client.py')
    print(f"   结果: {result}")
    
    # 方式 2: 使用用户自己的 API Key
    print("\n[方式 2] 使用用户自定义模型")
    custom_config = LLMConfig(
        provider='deepseek',
        api_key='用户的API Key',
        model='deepseek-chat'
    )
    analyzer2 = LLMAnalyzer(custom_config)
    
    # 方式 3: 使用本地模型
    print("\n[方式 3] 使用本地模型（如 Ollama）")
    local_config = LLMConfig(
        provider='local',
        model='deepseek-coder:6.7b'
    )
    analyzer3 = LLMAnalyzer(local_config)


if __name__ == '__main__':
    test_llm_analyzer()