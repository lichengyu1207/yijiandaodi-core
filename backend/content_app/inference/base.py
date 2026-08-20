"""推理引擎统一接口（M2：InferenceProvider）— 基础抽象

对外无品牌名：DeepSeek/Grok 通过统一的 `call(messages, model=None, **kw)` 透明切换。
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class Completion:
    """统一的推理完成结果"""

    content: str
    provider: str = 'unknown'
    model: str = ''
    messages: List[Dict[str, str]] = field(default_factory=list)
    usage: Dict[str, Any] = field(default_factory=dict)
    latency_ms: int = 0
    raw: Any = None

    @property
    def total_tokens(self) -> int:
        u = self.usage or {}
        total = int(u.get('total_tokens') or 0)
        if total:
            return total
        return int(u.get('prompt_tokens') or 0) + int(u.get('completion_tokens') or 0)


class InferenceProvider:
    """推理引擎统一接口：call(messages, model=None, **kw) -> Completion"""

    name: str = 'unknown'

    def call(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        **kw: Any,
    ) -> Completion:
        raise NotImplementedError

    def simple_complete(
        self,
        user_message: str,
        system_prompt: str = '',
        history: Optional[List[Dict[str, str]]] = None,
        model: Optional[str] = None,
        **kw: Any,
    ) -> str:
        """便捷接口：直接返回生成的文本内容"""
        messages: List[Dict[str, str]] = []
        if system_prompt:
            messages.append({'role': 'system', 'content': system_prompt})
        if history:
            messages.extend(history)
        messages.append({'role': 'user', 'content': user_message})
        return self.call(messages, model=model, **kw).content
