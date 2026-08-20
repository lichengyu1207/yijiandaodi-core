"""推理引擎统一接口（M2：InferenceProvider）+ 本地优先/过载回退路由（P3：M4）

用法：
    provider = get_inference_provider()                 # 按 settings INFERENCE_PROVIDER 选择
    provider = get_inference_provider('grok')           # 显式指定
    text = provider.simple_complete('你好', caller='user-1')
    comp = provider.call([{'role': 'user', 'content': '你好'}], caller='user-1')

    router = get_router()                               # P3：本地优先 + 过载回退
    comp = router.call([{'role': 'user', 'content': '你好'}], caller='user-1')
"""

from typing import Optional

from django.conf import settings

from .base import Completion, InferenceProvider
from .deepseek_provider import DeepSeekProvider
from .grok_provider import GrokProvider

__all__ = [
    'Completion',
    'InferenceProvider',
    'DeepSeekProvider',
    'GrokProvider',
    'get_inference_provider',
    'get_router',
]

_PROVIDER_CACHE = {}


def get_inference_provider(provider: Optional[str] = None) -> InferenceProvider:
    """获取推理引擎实例（默认按 settings.INFERENCE_PROVIDER 选择，deepseek/grok）。"""
    name = (provider or getattr(settings, 'INFERENCE_PROVIDER', 'deepseek') or 'deepseek').lower()
    if name in _PROVIDER_CACHE:
        return _PROVIDER_CACHE[name]
    if name == 'grok':
        instance: InferenceProvider = GrokProvider()
    else:
        instance = DeepSeekProvider()
    _PROVIDER_CACHE[name] = instance
    return instance


_ROUTER_CACHE = None


def get_router() -> InferenceProvider:
    """构建本地优先 + 过载回退路由（P3 M4）。

    配置：settings.INFERENCE_ROUTER
      - local_overload_ratio   本地配额比过载阈值（默认 0.9）
      - max_local_concurrency  本地最大并发（默认 8）
      - cluster_timeout_sec    集群提交超时（默认 30）
      - fallback_enabled       集群不可用时是否回退公开 API（默认 True）
    """
    global _ROUTER_CACHE
    if _ROUTER_CACHE is not None:
        return _ROUTER_CACHE

    from .cluster_provider import ClusterProvider
    from .overload_detector import OverloadDetector
    from .router import InferenceRouter

    cfg = getattr(settings, 'INFERENCE_ROUTER', {}) or {}
    local = get_inference_provider()

    _ROUTER_CACHE = InferenceRouter(
        local=local,
        cluster=ClusterProvider(timeout_sec=cfg.get('cluster_timeout_sec', 30)),
        fallback=local,
        overload=OverloadDetector(
            max_local_ratio=cfg.get('local_overload_ratio', 0.9),
            max_concurrency=cfg.get('max_local_concurrency', 8),
        ),
        fallback_enabled=cfg.get('fallback_enabled', True),
    )
    return _ROUTER_CACHE
