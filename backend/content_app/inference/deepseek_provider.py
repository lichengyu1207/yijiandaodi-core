"""DeepSeek 推理引擎（InferenceProvider 实现）

包装现有 DeepSeekClient，复用 DeepSeekBudgetGate 消费记账与计费落库。
"""

import time
from typing import Any, Dict, List, Optional

from content_app.deepseek_service import (
    DeepSeekClient,
    get_deepseek_client,
    get_budget_gate,
)
from .base import Completion, InferenceProvider


class DeepSeekProvider(InferenceProvider):
    name = 'deepseek'

    def __init__(self, client: Optional[DeepSeekClient] = None):
        self._client = client or get_deepseek_client()

    @property
    def client(self) -> DeepSeekClient:
        return self._client

    @property
    def model(self) -> str:
        return self._client.model

    def call(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        **kw: Any,
    ) -> Completion:
        caller = kw.pop('caller', None)

        # 模型覆盖：指定 model 且与当前客户端不同时，新建按 model 构造的客户端
        client = self._client
        if model and model != client.model:
            client = DeepSeekClient(model=model)

        gate = get_budget_gate()
        reason = gate.check_allowed(caller)
        if reason:
            raise PermissionError(f'[预算闸门] provider={self.name} 被拦截: {reason}')

        start = time.time()
        result = client.chat_completion(messages, caller=caller, **kw)
        latency_ms = int((time.time() - start) * 1000)

        content = ''
        try:
            content = result['choices'][0]['message']['content']
        except (KeyError, IndexError, TypeError):
            content = ''

        return Completion(
            content=content,
            provider=self.name,
            model=result.get('model') or client.model,
            messages=messages,
            usage=result.get('usage') or {},
            latency_ms=latency_ms,
            raw=result,
        )
