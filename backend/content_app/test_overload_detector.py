"""P3 M4：OverloadDetector 过载判定测试

覆盖：熔断 / 配额比 / 并发饱和 / 正常放行 / 闸门异常兜底 / 并发槽
以及 P3 事件告警规则联动（quota_exhausted 边缘触发）
"""

from unittest.mock import patch

from django.core.cache import cache
from django.test import SimpleTestCase

from content_app.deepseek_service import (
    OVERLOAD_ALERT_LAST_KEY,
    QUOTA_ALERT_CACHE_KEY,
)
from content_app.inference.overload_detector import (
    CIRCUIT_OPEN,
    CONCURRENCY_SATURATED,
    QUOTA_EXHAUSTED,
    OverloadDetector,
)


class FakeBudgetGate:
    """可控的预算闸门替身（只读 get_quota_status）"""

    def __init__(self, circuit_open=False, used_ratio=0.0):
        self.circuit_open = circuit_open
        self.used_ratio = used_ratio

    def get_quota_status(self):
        return {
            'circuit_open': self.circuit_open,
            'used_ratio': self.used_ratio,
            'used': 0,
            'limit': 0,
        }


class FaultyBudgetGate:
    def get_quota_status(self):
        raise RuntimeError('gate down')


class OverloadDetectorTest(SimpleTestCase):

    def setUp(self):
        # 纯判定用例不触发真实 WebSocket 推送（避免测试环境 Redis 连接噪音）
        self._push_patcher = patch('auth_app.alert_service.AlertService.push_event_alert')
        self._push_patcher.start()

    def tearDown(self):
        self._push_patcher.stop()

    def _detector(self, gate, **kw):
        return OverloadDetector(budget_gate=gate, **kw)

    # ------------------------------------------------------------------
    # 正常放行
    # ------------------------------------------------------------------

    def test_healthy_local_returns_none(self):
        det = self._detector(FakeBudgetGate(used_ratio=0.3))
        self.assertIsNone(det.check())
        self.assertFalse(det.is_overloaded)

    # ------------------------------------------------------------------
    # 熔断
    # ------------------------------------------------------------------

    def test_circuit_open_triggers_overload(self):
        det = self._detector(FakeBudgetGate(circuit_open=True, used_ratio=0.0))
        self.assertEqual(det.check(), CIRCUIT_OPEN)
        self.assertTrue(det.is_overloaded)

    # ------------------------------------------------------------------
    # 配额比
    # ------------------------------------------------------------------

    def test_quota_ratio_at_threshold_triggers_overload(self):
        det = self._detector(FakeBudgetGate(used_ratio=0.9), max_local_ratio=0.9)
        self.assertEqual(det.check(), QUOTA_EXHAUSTED)

    def test_quota_ratio_below_threshold_is_healthy(self):
        det = self._detector(FakeBudgetGate(used_ratio=0.89), max_local_ratio=0.9)
        self.assertIsNone(det.check())

    def test_quota_ratio_custom_threshold(self):
        det = self._detector(FakeBudgetGate(used_ratio=0.7), max_local_ratio=0.6)
        self.assertEqual(det.check(), QUOTA_EXHAUSTED)

    # ------------------------------------------------------------------
    # 并发饱和
    # ------------------------------------------------------------------

    def test_concurrency_saturated_triggers_overload(self):
        det = self._detector(FakeBudgetGate(used_ratio=0.0), max_concurrency=2)
        with det.slot():
            with det.slot():
                self.assertEqual(det.check(), CONCURRENCY_SATURATED)

    def test_slot_releases_concurrency(self):
        det = self._detector(FakeBudgetGate(used_ratio=0.0), max_concurrency=1)
        with det.slot():
            self.assertEqual(det.check(), CONCURRENCY_SATURATED)
        # 退出后恢复健康
        self.assertIsNone(det.check())

    # ------------------------------------------------------------------
    # 判定顺序：熔断优先于配额
    # ------------------------------------------------------------------

    def test_circuit_open_has_priority_over_quota(self):
        det = self._detector(
            FakeBudgetGate(circuit_open=True, used_ratio=0.99),
            max_local_ratio=0.9,
        )
        self.assertEqual(det.check(), CIRCUIT_OPEN)

    # ------------------------------------------------------------------
    # 闸门异常兜底：不可判定时按无过载处理（不阻塞本地）
    # ------------------------------------------------------------------

    def test_gate_failure_degrades_to_healthy(self):
        det = self._detector(FaultyBudgetGate())
        self.assertIsNone(det.check())


class OverloadDetectorAlertTest(SimpleTestCase):
    """P3 事件告警规则联动：quota_exhausted 边缘触发"""

    def setUp(self):
        cache.delete(OVERLOAD_ALERT_LAST_KEY)
        cache.delete(QUOTA_ALERT_CACHE_KEY)

    def tearDown(self):
        cache.delete(OVERLOAD_ALERT_LAST_KEY)
        cache.delete(QUOTA_ALERT_CACHE_KEY)

    def test_quota_exhausted_pushes_alert_once(self):
        """进入耗尽即推送一次；持续过载不重复推送"""
        det = OverloadDetector(budget_gate=FakeBudgetGate(used_ratio=0.9), max_local_ratio=0.9)
        with patch('auth_app.alert_service.AlertService.push_event_alert') as push:
            self.assertEqual(det.check(), QUOTA_EXHAUSTED)
            self.assertEqual(det.check(), QUOTA_EXHAUSTED)
            self.assertEqual(det.check(), QUOTA_EXHAUSTED)
            push.assert_called_once()
            self.assertEqual(push.call_args.kwargs['event'], 'quota_exhausted')
            self.assertEqual(push.call_args.kwargs['level'], 'critical')

    def test_quota_exhausted_alert_resets_after_recovery(self):
        """恢复后再耗尽 → 允许再次触发"""
        gate = FakeBudgetGate(used_ratio=0.9)
        det = OverloadDetector(budget_gate=gate, max_local_ratio=0.9)
        with patch('auth_app.alert_service.AlertService.push_event_alert') as push:
            self.assertEqual(det.check(), QUOTA_EXHAUSTED)
            push.assert_called_once()

            gate.used_ratio = 0.1  # 恢复
            self.assertIsNone(det.check())

            gate.used_ratio = 0.95  # 再次耗尽
            self.assertEqual(det.check(), QUOTA_EXHAUSTED)
            self.assertEqual(push.call_count, 2)

    def test_quota_exhausted_alert_disabled_by_rule(self):
        """规则关闭时不推送，但过载判定不受影响"""
        cache.set(
            QUOTA_ALERT_CACHE_KEY,
            {'enabled': True, 'rules': {'quota_exhausted': False}},
            timeout=60,
        )
        det = OverloadDetector(budget_gate=FakeBudgetGate(used_ratio=0.9), max_local_ratio=0.9)
        with patch('auth_app.alert_service.AlertService.push_event_alert') as push:
            self.assertEqual(det.check(), QUOTA_EXHAUSTED)
            push.assert_not_called()

    def test_used_ratio_camel_case_compat(self):
        """兼容真实闸门 camelCase usedRatio 字段"""
        gate = FakeBudgetGate(used_ratio=0.9)
        det = OverloadDetector(budget_gate=gate, max_local_ratio=0.9)
        gate.get_quota_status = lambda: {'usedRatio': 0.95, 'circuitOpen': False}
        with patch('auth_app.alert_service.AlertService.push_event_alert'):
            self.assertEqual(det.check(), QUOTA_EXHAUSTED)
