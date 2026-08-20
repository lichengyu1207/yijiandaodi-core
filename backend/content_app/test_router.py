"""P3 M4：InferenceRouter 本地优先 + 过载回退路由测试

覆盖：本地优先 / 预检过载回退集群 / 执行中过载回退 / 集群不可用回退公开 API /
      fallback 关闭时上抛 / 全链路失败上抛
"""

from django.test import SimpleTestCase, TestCase

from content_app.inference.base import Completion, InferenceProvider
from content_app.inference.exceptions import (
    ClusterUnavailableError,
    InferenceOverloadError,
)
from content_app.inference.overload_detector import (
    CIRCUIT_OPEN,
    CONCURRENCY_SATURATED,
    QUOTA_EXHAUSTED,
    OverloadDetector,
)
from content_app.inference.router import InferenceRouter

MSG = [{'role': 'user', 'content': 'hi'}]


class FakeProvider(InferenceProvider):
    """可编程 provider：指定返回内容或抛出异常，记录调用次数"""

    def __init__(self, name, content='ok', error=None):
        self.name = name
        self._content = content
        self._error = error
        self.calls = 0

    def call(self, messages, model=None, **kw):
        self.calls += 1
        if self._error:
            raise self._error
        return Completion(content=self._content, provider=self.name)


class StubOverload(OverloadDetector):
    """可编程过载判定：check 返回指定原因（不触发预算闸门）"""

    def __init__(self, reason=None):
        self.reason = reason

    def check(self):
        return self.reason


def _router(local, cluster, fallback, reason=None, fallback_enabled=True):
    return InferenceRouter(
        local=local,
        cluster=cluster,
        fallback=fallback,
        overload=StubOverload(reason),
        fallback_enabled=fallback_enabled,
    )


class InferenceRouterTest(SimpleTestCase):

    # ------------------------------------------------------------------
    # 本地优先
    # ------------------------------------------------------------------

    def test_local_healthy_uses_local_only(self):
        local = FakeProvider('local', content='本地回复')
        cluster = FakeProvider('cluster')
        fallback = FakeProvider('fallback')
        router = _router(local, cluster, fallback, reason=None)

        comp = router.call(MSG, caller='u1')

        self.assertEqual(comp.content, '本地回复')
        self.assertEqual(comp.provider, 'local')
        self.assertEqual(local.calls, 1)
        self.assertEqual(cluster.calls, 0)
        self.assertEqual(fallback.calls, 0)

    # ------------------------------------------------------------------
    # 预检过载 → 集群
    # ------------------------------------------------------------------

    def test_precheck_overload_routes_to_cluster(self):
        local = FakeProvider('local')
        cluster = FakeProvider('cluster', content='集群回复')
        fallback = FakeProvider('fallback')
        router = _router(local, cluster, fallback, reason='quota_exhausted')

        comp = router.call(MSG)

        self.assertEqual(comp.provider, 'cluster')
        self.assertEqual(local.calls, 0)  # 本地被跳过
        self.assertEqual(cluster.calls, 1)

    # ------------------------------------------------------------------
    # 执行中过载（InferenceOverloadError）→ 集群
    # ------------------------------------------------------------------

    def test_local_throws_overload_routes_to_cluster(self):
        local = FakeProvider('local', error=InferenceOverloadError('circuit_open'))
        cluster = FakeProvider('cluster', content='集群回复')
        fallback = FakeProvider('fallback')
        router = _router(local, cluster, fallback, reason=None)

        comp = router.call(MSG)

        self.assertEqual(comp.provider, 'cluster')
        self.assertEqual(local.calls, 1)
        self.assertEqual(cluster.calls, 1)
        self.assertEqual(fallback.calls, 0)

    # ------------------------------------------------------------------
    # 预算闸门拦截（PermissionError）→ 视为过载 → 集群
    # ------------------------------------------------------------------

    def test_budget_gate_block_considered_overload(self):
        local = FakeProvider('local', error=PermissionError('quota'))
        cluster = FakeProvider('cluster', content='集群回复')
        fallback = FakeProvider('fallback')
        router = _router(local, cluster, fallback, reason=None)

        comp = router.call(MSG)

        self.assertEqual(comp.provider, 'cluster')
        self.assertEqual(cluster.calls, 1)

    # ------------------------------------------------------------------
    # 集群不可用 → 公开 API 兜底
    # ------------------------------------------------------------------

    def test_cluster_unavailable_falls_back_to_public_api(self):
        local = FakeProvider('local', error=InferenceOverloadError('quota'))
        cluster = FakeProvider('cluster', error=ClusterUnavailableError('no_online_nodes'))
        fallback = FakeProvider('fallback', content='兜底回复')
        router = _router(local, cluster, fallback, reason=None)

        comp = router.call(MSG)

        self.assertEqual(comp.provider, 'fallback')
        self.assertEqual(comp.content, '兜底回复')
        self.assertEqual(fallback.calls, 1)

    # ------------------------------------------------------------------
    # fallback 关闭 + 集群不可用 → 上抛
    # ------------------------------------------------------------------

    def test_fallback_disabled_raises_when_cluster_unavailable(self):
        local = FakeProvider('local', error=InferenceOverloadError('quota'))
        cluster = FakeProvider('cluster', error=ClusterUnavailableError('timeout'))
        fallback = FakeProvider('fallback')
        router = _router(
            local, cluster, fallback, reason=None, fallback_enabled=False
        )

        with self.assertRaises(ClusterUnavailableError) as ctx:
            router.call(MSG)
        self.assertEqual(
            ctx.exception.reason, 'cluster_unavailable_and_fallback_disabled'
        )
        self.assertEqual(fallback.calls, 0)

    # ------------------------------------------------------------------
    # 全链路失败 → 上抛 fallback 异常
    # ------------------------------------------------------------------

    def test_full_chain_failure_raises(self):
        local = FakeProvider('local', error=InferenceOverloadError('quota'))
        cluster = FakeProvider('cluster', error=ClusterUnavailableError('no_online_nodes'))
        fallback = FakeProvider('fallback', error=RuntimeError('api down'))
        router = _router(local, cluster, fallback, reason=None)

        with self.assertRaises(RuntimeError):
            router.call(MSG)

    # ------------------------------------------------------------------
    # 边界：非过载异常不回退、直接冒泡
    # ------------------------------------------------------------------

    def test_local_generic_error_propagates_no_fallback(self):
        """本地抛非过载/非预算异常（ValueError）→ 不触发回退，异常冒泡"""
        local = FakeProvider('local', error=ValueError('bad input'))
        cluster = FakeProvider('cluster')
        fallback = FakeProvider('fallback')
        router = _router(local, cluster, fallback, reason=None)

        with self.assertRaises(ValueError):
            router.call(MSG)
        self.assertEqual(cluster.calls, 0)
        self.assertEqual(fallback.calls, 0)

    def test_cluster_generic_error_propagates_no_fallback(self):
        """集群抛非 ClusterUnavailableError（TimeoutError）→ 不触发公开 API 兜底，异常冒泡"""
        local = FakeProvider('local', error=InferenceOverloadError('quota'))
        cluster = FakeProvider('cluster', error=TimeoutError('slow'))
        fallback = FakeProvider('fallback')
        router = _router(local, cluster, fallback, reason=None)

        with self.assertRaises(TimeoutError):
            router.call(MSG)
        self.assertEqual(fallback.calls, 0)

    # ------------------------------------------------------------------
    # 边界：过载恢复 / 兜底开关 / 空输入
    # ------------------------------------------------------------------

    def test_overload_recovery_returns_to_local(self):
        """过载信号消失后重新走本地优先（不因之前回退而永久切走）"""
        local = FakeProvider('local', content='本地')
        cluster = FakeProvider('cluster', content='集群')
        fallback = FakeProvider('fallback')
        overload = StubOverload('quota_exhausted')
        router = InferenceRouter(
            local=local, cluster=cluster, fallback=fallback, overload=overload,
        )

        router.call(MSG)  # 过载 → 集群
        self.assertEqual(cluster.calls, 1)

        overload.reason = None  # 过载恢复
        comp = router.call(MSG)
        self.assertEqual(comp.provider, 'local')
        self.assertEqual(local.calls, 1)

    def test_fallback_disabled_still_uses_local_when_healthy(self):
        """fallback_enabled=False 只影响兜底段，不影响本地优先路径"""
        local = FakeProvider('local', content='本地')
        cluster = FakeProvider('cluster')
        fallback = FakeProvider('fallback')
        router = _router(local, cluster, fallback, reason=None, fallback_enabled=False)

        comp = router.call(MSG)
        self.assertEqual(comp.provider, 'local')
        self.assertEqual(cluster.calls, 0)

    def test_empty_messages_routed_to_local(self):
        """空消息列表仍按本地优先路由（不因输入为空崩溃）"""
        local = FakeProvider('local', content='ok')
        cluster = FakeProvider('cluster')
        fallback = FakeProvider('fallback')
        router = _router(local, cluster, fallback, reason=None)

        comp = router.call([])
        self.assertEqual(comp.provider, 'local')
        self.assertEqual(local.calls, 1)
        self.assertEqual(cluster.calls, 0)


class FakeGate:
    """可编程预算闸门：返回指定配额状态或抛异常"""

    def __init__(self, status=None, error=None):
        self._status = status or {}
        self._error = error

    def get_quota_status(self):
        if self._error:
            raise self._error
        return self._status


class OverloadDetectorBoundaryTest(SimpleTestCase):
    """OverloadDetector 判定边界：阈值/并发/熔断/异常降级/槽释放"""

    def setUp(self):
        # 纯判定用例不触发真实 WebSocket 推送（避免测试环境 Redis 连接噪音）
        from unittest.mock import patch
        self._push_patcher = patch('auth_app.alert_service.AlertService.push_event_alert')
        self._push_patcher.start()

    def tearDown(self):
        self._push_patcher.stop()

    def _detector(self, status=None, error=None, **kw):
        return OverloadDetector(budget_gate=FakeGate(status, error), **kw)

    def test_quota_ratio_exact_threshold_is_overloaded(self):
        """配额比恰好 == 阈值（>= 判定）→ 过载"""
        det = self._detector({'used_ratio': 0.9}, max_local_ratio=0.9)
        self.assertEqual(det.check(), QUOTA_EXHAUSTED)

    def test_quota_ratio_just_below_threshold_is_healthy(self):
        """配额比略低于阈值 → 正常"""
        det = self._detector({'used_ratio': 0.8999}, max_local_ratio=0.9)
        self.assertIsNone(det.check())

    def test_invalid_quota_ratio_treated_as_zero(self):
        """配额比字段非法（非数值）→ 按 0 处理，不误判过载"""
        det = self._detector({'used_ratio': 'abc'}, max_local_ratio=0.9)
        self.assertIsNone(det.check())

    def test_concurrency_saturation_at_exact_limit(self):
        """并发数 == 上限 → 并发饱和"""
        det = self._detector(max_concurrency=2)
        det._in_flight = 2
        self.assertEqual(det.check(), CONCURRENCY_SATURATED)

    def test_concurrency_below_limit_is_healthy(self):
        """并发数 = 上限 - 1 → 正常（上限是开区间临界）"""
        det = self._detector(max_concurrency=2)
        det._in_flight = 1
        self.assertIsNone(det.check())

    def test_max_concurrency_zero_saturates_immediately(self):
        """max_concurrency=0（配置误设）→ 立即并发饱和"""
        det = self._detector(max_concurrency=0)
        self.assertEqual(det.check(), CONCURRENCY_SATURATED)

    def test_circuit_open_short_circuits_quota_and_concurrency(self):
        """熔断优先于配额/并发判定（短路顺序）"""
        det = self._detector({'circuit_open': True, 'used_ratio': 0.1})
        self.assertEqual(det.check(), CIRCUIT_OPEN)

    def test_gate_exception_treated_as_healthy(self):
        """闸门读取异常 → 按无过载处理（不阻塞本地推理）"""
        det = self._detector(error=RuntimeError('gate down'))
        self.assertIsNone(det.check())

    def test_non_dict_quota_status_ignored(self):
        """闸门返回非 dict → 忽略，按无过载处理"""
        det = OverloadDetector(budget_gate=FakeGate('not-a-dict'))
        self.assertIsNone(det.check())

    def test_slot_releases_after_exception(self):
        """槽内抛异常后并发计数正确释放，可重新进入"""
        det = self._detector(max_concurrency=1)
        with self.assertRaises(RuntimeError):
            with det.slot():
                self.assertEqual(det.in_flight, 1)
                raise RuntimeError('boom')
        self.assertEqual(det.in_flight, 0)
        self.assertIsNone(det.check())


class P2PClusterGatewayBoundaryTest(TestCase):
    """P2PClusterGateway 调度边界：无节点/调度异常/结果拉取/中止"""

    def setUp(self):
        from content_app.inference.cluster_gateway import P2PClusterGateway
        self.gateway = P2PClusterGateway()

    def _node(self, node_id, status='online', caps=None):
        from p2p_app.models import P2PNode
        return P2PNode.objects.create(
            node_id=node_id,
            node_type='enterprise',
            capabilities=caps or ['inference'],
            resources={'cpu_cores': 4},
            location='cn',
            status=status,
            public_key='pubkey',
        )

    def test_submit_no_online_inference_node_returns_none(self):
        """无在线推理节点（离线 / 能力不符）→ 返回 None 回退本地"""
        self._node('n-offline', status='offline')
        self._node('n-nocap', status='online', caps=['storage'])

        self.assertIsNone(
            self.gateway.submit([{'role': 'user', 'content': 'hi'}], model='m1')
        )

    def test_submit_dispatch_error_marks_task_failed(self):
        """调度器异常 → 任务标记 failed 且返回 None（不留下悬挂任务）"""
        from content_app.inference.cluster_gateway import P2PClusterGateway
        from p2p_app.models import TaskDispatch
        self._node('n-online', status='online')

        class ExplodingDispatcher:
            def dispatch(self, shards, nodes):
                raise RuntimeError('route failed')

        gateway = P2PClusterGateway(dispatcher=ExplodingDispatcher())
        self.assertIsNone(
            gateway.submit([{'role': 'user', 'content': 'hi'}], caller='u1')
        )

        task = TaskDispatch.objects.get(task_id__startswith='infer-')
        self.assertEqual(task.status, 'failed')

    def test_fetch_result_missing_task_returns_none(self):
        """拉取不存在任务的结果 → 返回 None（不抛错）"""
        self.assertIsNone(self.gateway.fetch_result('infer-no-such-task'))

    def test_abort_completed_task_keeps_status(self):
        """中止已结束任务 → 状态保持不变（仅中止 created/executing）"""
        from p2p_app.models import TaskDispatch
        task = TaskDispatch.objects.create(
            task_id='infer-done', task_type='text', status='completed',
        )
        self.gateway.abort('infer-done')
        task.refresh_from_db()
        self.assertEqual(task.status, 'completed')

    def test_abort_unknown_task_no_error(self):
        """中止不存在的任务 → 静默无操作，不抛错"""
        self.gateway.abort('infer-unknown')
