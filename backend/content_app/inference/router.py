"""推理路由（P3 M4）：本地优先 + 过载回退

路由链（能力透明，日志只含内部标识 local/cluster/fallback，无品牌名）：
  ① 本地推理（local）—— 未过载时使用
  ② 集群推理（cluster）—— 本地过载/失败时回退
  ③ 公开 API 兜底（fallback）—— 集群不可用时回退；可配置关闭

过载信号：
  - 预检：OverloadDetector.check()（熔断 / 配额比 / 并发饱和）
  - 执行中：本地 provider 抛 InferenceOverloadError，或预算闸门 PermissionError
"""

import logging
import time
from typing import Any, List, Optional

from .base import Completion, InferenceProvider
from .exceptions import ClusterUnavailableError, InferenceOverloadError
from .overload_detector import OverloadDetector

logger = logging.getLogger(__name__)


class InferenceRouter(InferenceProvider):
    """本地优先 + 过载回退的推理路由。"""

    name = 'router'

    def __init__(
        self,
        local: InferenceProvider,
        cluster: InferenceProvider,
        fallback: InferenceProvider,
        overload: Optional[OverloadDetector] = None,
        fallback_enabled: bool = True,
    ) -> None:
        self._local = local
        self._cluster = cluster
        self._fallback = fallback
        self._overload = overload or OverloadDetector()
        self.fallback_enabled = fallback_enabled

    @property
    def overload(self) -> OverloadDetector:
        return self._overload

    def call(
        self,
        messages: List[dict],
        model: Optional[str] = None,
        **kw: Any,
    ) -> Completion:
        start = time.monotonic()
        msg_count = len(messages) if messages else 0

        # ① 本地优先
        reason = self._overload.check()
        if reason is not None:
            logger.warning(
                '[推理路由] 预检过载 reason=%s → 跳过本地', reason,
            )
        if reason is None:
            try:
                comp = self._local.call(messages, model=model, **kw)
                logger.info(
                    '[推理路由] 决策=local 模型=%s 消息=%d 耗时=%.1fms',
                    model, msg_count, (time.monotonic() - start) * 1000,
                )
                return comp
            except InferenceOverloadError as exc:
                reason = exc.reason or 'local_overload'
                self._log_fallback('local', 'cluster', reason)
            except PermissionError as exc:
                # 预算闸门拦截（配额不足/熔断）视为本地过载
                reason = 'budget_gate_blocked'
                self._log_fallback('local', 'cluster', reason)

        # ② 集群回退
        try:
            comp = self._cluster.call(messages, model=model, **kw)
            logger.info(
                '[推理路由] 决策=cluster 模型=%s 消息=%d 耗时=%.1fms',
                model, msg_count, (time.monotonic() - start) * 1000,
            )
            return comp
        except ClusterUnavailableError as exc:
            self._log_fallback('cluster', 'fallback', exc.reason)

        # ③ 公开 API 兜底
        if not self.fallback_enabled:
            logger.warning('[推理路由] 集群不可用且兜底已关闭 → 上抛异常')
            raise ClusterUnavailableError('cluster_unavailable_and_fallback_disabled')
        comp = self._fallback.call(messages, model=model, **kw)
        logger.info(
            '[推理路由] 决策=fallback 模型=%s 消息=%d 耗时=%.1fms',
            model, msg_count, (time.monotonic() - start) * 1000,
        )
        return comp

    def _log_fallback(self, source: str, target: str, reason: str) -> None:
        logger.warning(
            '[推理路由] 回退 %s → %s（原因: %s）', source, target, reason
        )
