"""本地推理过载检测（P3 M4）

本地优先路由的「过载」判定：熔断 / 配额比 / 并发饱和。
与预算闸门（DeepSeekBudgetGate）解耦：通过 get_quota_status() 只读消费状态，
不触发任何记账副作用；并发计数为进程内信号量语义（with overload.slot(): ...）。
"""

import logging
from contextlib import contextmanager
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# 过载原因标识（能力透明，供日志/指标使用）
CIRCUIT_OPEN = 'circuit_open'
QUOTA_EXHAUSTED = 'quota_exhausted'
CONCURRENCY_SATURATED = 'concurrency_saturated'


class OverloadDetector:
    """本地推理过载判定器。

    判定顺序（短路）：
      1. circuit_open        —— 预算闸门熔断（连续失败达阈值）
      2. quota_exhausted     —— 本地配额使用比 >= max_local_ratio（默认 0.9）
      3. concurrency_saturated —— 本地并发调用数 >= max_concurrency（默认 8）

    check() 返回过载原因字符串；无过载返回 None。
    """

    def __init__(
        self,
        budget_gate: Optional[Any] = None,
        max_local_ratio: float = 0.9,
        max_concurrency: int = 8,
    ) -> None:
        from content_app.deepseek_service import get_budget_gate

        self._gate = budget_gate or get_budget_gate()
        self.max_local_ratio = max_local_ratio
        self.max_concurrency = max_concurrency
        self._in_flight = 0

    # ------------------------------------------------------------------
    # 并发槽（信号量语义）
    # ------------------------------------------------------------------

    @contextmanager
    def slot(self):
        """占用一个本地并发槽：进入 +1，退出 -1（with detector.slot(): ...）"""
        self._in_flight += 1
        logger.debug(
            '[过载检测] 并发槽占用 +1 → %d（上限 %d）',
            self._in_flight, self.max_concurrency,
        )
        try:
            yield
        finally:
            self._in_flight -= 1
            logger.debug(
                '[过载检测] 并发槽释放 -1 → %d（上限 %d）',
                self._in_flight, self.max_concurrency,
            )

    @property
    def in_flight(self) -> int:
        return self._in_flight

    # ------------------------------------------------------------------
    # 过载判定
    # ------------------------------------------------------------------

    def check(self) -> Optional[str]:
        """返回过载原因；本地健康返回 None。"""
        quota = self._read_quota_status()

        if quota.get('circuit_open'):
            logger.warning('[过载检测] 判定=过载 原因=circuit_open 本地熔断（连续失败达阈值）')
            return CIRCUIT_OPEN

        used_ratio = 0.0
        try:
            # 兼容预算闸门（camelCase usedRatio）与测试替身（snake_case used_ratio）
            raw = quota.get('used_ratio')
            if raw is None:
                raw = quota.get('usedRatio')
            used_ratio = float(raw or 0.0)
        except (TypeError, ValueError):
            used_ratio = 0.0
        if used_ratio >= self.max_local_ratio:
            logger.warning(
                '[过载检测] 判定=过载 原因=quota_exhausted 配额比=%.4f 阈值=%.4f',
                used_ratio, self.max_local_ratio,
            )
            self._maybe_push_quota_exhausted_alert(used_ratio)
            return QUOTA_EXHAUSTED

        if self._in_flight >= self.max_concurrency:
            logger.warning(
                '[过载检测] 判定=过载 原因=concurrency_saturated 并发=%d 上限=%d',
                self._in_flight, self.max_concurrency,
            )
            return CONCURRENCY_SATURATED

        logger.debug(
            '[过载检测] 判定=正常 配额比=%.4f 并发=%d/%d 熔断=%s',
            used_ratio, self._in_flight, self.max_concurrency,
            quota.get('circuit_open'),
        )
        self._reset_quota_exhausted_alert()
        return None

    @property
    def is_overloaded(self) -> bool:
        return self.check() is not None

    def _read_quota_status(self) -> Dict[str, Any]:
        try:
            status = self._gate.get_quota_status()
        except Exception as exc:  # 闸门异常时按「不可判定」处理：保守视为过载前哨但放行
            logger.warning('[过载检测] 读取闸门状态失败，按无过载处理: %s', exc)
            return {}
        if isinstance(status, dict):
            return status
        return {}

    # ------------------------------------------------------------------
    # 配额耗尽告警（边缘触发：仅状态变化时推送一次，避免每次请求刷屏）
    # ------------------------------------------------------------------

    def _maybe_push_quota_exhausted_alert(self, used_ratio: float) -> None:
        """quota_exhausted 场景告警：受 /api/settings/quota-alert 的 rules 控制。"""
        try:
            from django.core.cache import cache
            from content_app.deepseek_service import (
                OVERLOAD_ALERT_LAST_KEY,
                get_quota_alert_rules,
            )
            if not get_quota_alert_rules().get('quota_exhausted'):
                return
            if cache.get(OVERLOAD_ALERT_LAST_KEY) == 'quota_exhausted':
                return  # 已推送过，避免重复
            from auth_app.alert_service import AlertService
            AlertService.push_event_alert(
                event='quota_exhausted',
                level='critical',
                title='本地推理配额耗尽',
                message=(
                    f'共享额度使用率 {used_ratio * 100:.1f}% '
                    f'已达本地过载阈值 {self.max_local_ratio * 100:.0f}%'
                ),
            )
            cache.set(OVERLOAD_ALERT_LAST_KEY, 'quota_exhausted', timeout=86400)
        except Exception as exc:  # noqa: BLE001 - 告警推送失败不影响判定
            logger.debug('[过载检测] 配额耗尽告警推送异常: %r', exc)

    def _reset_quota_exhausted_alert(self) -> None:
        """配额恢复正常时清除耗尽标记，允许下次再次触发。"""
        try:
            from django.core.cache import cache
            from content_app.deepseek_service import OVERLOAD_ALERT_LAST_KEY
            cache.delete(OVERLOAD_ALERT_LAST_KEY)
        except Exception:  # noqa: BLE001 - 清理失败无副作用
            pass
