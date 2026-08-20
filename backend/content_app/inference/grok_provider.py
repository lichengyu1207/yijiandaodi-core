"""Grok 推理引擎（InferenceProvider 实现）

调用 Grok 的 OpenAI 兼容 /chat/completions 接口。
配置：GROK_API_KEY / GROK_BASE_URL / GROK_MODEL（环境变量）。
复用 DeepSeekBudgetGate 消费记账（provider 维度日志），未配置 Key 时抛错由调用方降级。
"""

import os
import time
from typing import Any, Dict, List, Optional

import requests

from content_app.deepseek_service import get_budget_gate
from .base import Completion, InferenceProvider


class GrokProvider(InferenceProvider):
    name = 'grok'

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
    ):
        self.api_key = api_key or os.environ.get('GROK_API_KEY', '') or None
        self.base_url = (
            base_url or os.environ.get('GROK_BASE_URL', 'https://api.x.ai/v1')
        ).rstrip('/')
        self.model = model or os.environ.get('GROK_MODEL', 'grok-2-latest')

    def call(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        **kw: Any,
    ) -> Completion:
        if not self.api_key:
            raise RuntimeError('Grok 推理引擎未配置 GROK_API_KEY，无法调用（可切换回默认引擎）')

        caller = kw.pop('caller', None)
        gate = get_budget_gate()
        reason = gate.check_allowed(caller)
        if reason:
            raise PermissionError(f'[预算闸门] provider={self.name} 被拦截: {reason}')

        url = f'{self.base_url}/chat/completions'
        data = {
            'model': model or self.model,
            'messages': messages,
            'stream': False,
            **{k: v for k, v in kw.items() if k in ('temperature', 'top_p', 'max_tokens')},
        }
        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json',
        }

        start = time.time()
        try:
            resp = requests.post(url, headers=headers, json=data, timeout=60)
            resp.raise_for_status()
            result = resp.json()
            gate.record_success()
            gate.record_start(caller)
        except requests.exceptions.HTTPError as e:
            if e.response is not None and e.response.status_code in (401, 403, 429, 500, 502, 503, 504):
                gate.record_failure()
            raise RuntimeError(f'Grok API HTTP {e.response.status_code if e.response else "?"}: {e.response.text if e.response else ""}') from e
        except Exception:
            gate.record_failure()
            raise

        latency_ms = int((time.time() - start) * 1000)
        content = ''
        try:
            content = result['choices'][0]['message']['content']
        except (KeyError, IndexError, TypeError):
            content = ''

        return Completion(
            content=content,
            provider=self.name,
            model=result.get('model') or (model or self.model),
            messages=messages,
            usage=result.get('usage') or {},
            latency_ms=latency_ms,
            raw=result,
        )
