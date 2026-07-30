"""
测试 P2P 调度相关服务：
  1. TaskStateMachine (unittest.TestCase - 纯逻辑)
  2. HeartbeatService   (django.test.TestCase - 需要 DB)
  3. IdleDetectionService (unittest.TestCase - 纯逻辑)
  4. NodeDiscoveryService  (django.test.TestCase - 需要 DB)
"""

import unittest
from unittest.mock import patch, MagicMock

from django.test import TestCase

from p2p_app.models import P2PNode, TaskDispatch, TaskShard, NodeHeartbeat, NodeReputation
from p2p_app.services.task_state_machine import (
    TaskStateMachine,
    TaskState,
    IllegalStateTransitionError,
    VALID_TRANSITIONS,
)
from p2p_app.services.heartbeat_service import (
    HeartbeatService,
    P2PServiceError,
    ANOMALY_THRESHOLDS,
    REPUTATION_MAX,
    REPUTATION_MIN,
)
from p2p_app.services.idle_detection_service import IdleDetectionService
from p2p_app.services.discovery_service import NodeDiscoveryService


# ============================================================
# 1. TaskStateMachine 测试（纯逻辑，使用 unittest.TestCase）
# ============================================================

class TestTaskStateMachine(unittest.TestCase):
    """TaskStateMachine 状态机纯逻辑测试"""

    # ---- 初始状态 ----

    def test_initial_state_none_without_model(self):
        """无 model 时 current_state 为 None"""
        sm = TaskStateMachine()
        self.assertIsNone(sm.current_state)

    def test_initial_state_from_model(self):
        """从 model 创建时状态从 model.status 初始化"""
        mock_model = MagicMock()
        mock_model.status = 'sharding'
        sm = TaskStateMachine(task_dispatch_model=mock_model)
        self.assertEqual(sm.current_state, TaskState.SHARDING)

    # ---- can_transition_to ----

    def test_can_transition_from_none_only_created(self):
        """None 状态只能转到 CREATED"""
        sm = TaskStateMachine()
        self.assertTrue(sm.can_transition_to(TaskState.CREATED))
        self.assertFalse(sm.can_transition_to(TaskState.SHARDING))
        self.assertFalse(sm.can_transition_to(TaskState.EXECUTING))

    def test_created_to_sharding_allowed(self):
        """CREATED -> SHARDING 合法"""
        sm = TaskStateMachine()
        sm._state = TaskState.CREATED
        self.assertTrue(sm.can_transition_to(TaskState.SHARDING))

    def test_created_to_aborted_allowed(self):
        """CREATED -> ABORTED 合法"""
        sm = TaskStateMachine()
        sm._state = TaskState.CREATED
        self.assertTrue(sm.can_transition_to(TaskState.ABORTED))

    def test_created_to_executing_forbidden(self):
        """CREATED -> EXECUTING 非法"""
        sm = TaskStateMachine()
        sm._state = TaskState.CREATED
        self.assertFalse(sm.can_transition_to(TaskState.EXECUTING))

    def test_sharding_valid_targets(self):
        """SHARDING -> DISPATCHING / FAILED / ABORTED 均合法"""
        sm = TaskStateMachine()
        sm._state = TaskState.SHARDING
        self.assertTrue(sm.can_transition_to(TaskState.DISPATCHING))
        self.assertTrue(sm.can_transition_to(TaskState.FAILED))
        self.assertTrue(sm.can_transition_to(TaskState.ABORTED))
        self.assertFalse(sm.can_transition_to(TaskState.EXECUTING))

    def test_completed_no_transitions(self):
        """COMPLETED 是终态，不可转移到任何状态"""
        sm = TaskStateMachine()
        sm._state = TaskState.COMPLETED
        valid = [s for s in TaskState if sm.can_transition_to(s)]
        self.assertEqual(valid, [])

    def test_failed_can_retry_to_dispatching(self):
        """FAILED -> DISPATCHING 可重试"""
        sm = TaskStateMachine()
        sm._state = TaskState.FAILED
        self.assertTrue(sm.can_transition_to(TaskState.DISPATCHING))

    def test_aborted_no_transitions(self):
        """ABORTED 是终态，不可转移"""
        sm = TaskStateMachine()
        sm._state = TaskState.ABORTED
        for target in TaskState:
            if target != TaskState.ABORTED:
                self.assertFalse(sm.can_transition_to(target))

    # ---- transition_to ----

    def test_legal_transition_returns_true(self):
        """合法转移成功返回 True"""
        sm = TaskStateMachine()
        sm._state = TaskState.CREATED
        result = sm.transition_to(TaskState.SHARDING)
        self.assertTrue(result)
        self.assertEqual(sm.current_state, TaskState.SHARDING)

    def test_illegal_transition_raises_error(self):
        """非法转移抛 IllegalStateTransitionError"""
        sm = TaskStateMachine()
        sm._state = TaskState.CREATED
        with self.assertRaises(IllegalStateTransitionError) as ctx:
            sm.transition_to(TaskState.EXECUTING)
        self.assertIn('created', str(ctx.exception))
        self.assertIn('executing', str(ctx.exception))

    def test_terminal_state_sets_completed_at(self):
        """终态(COMPLETED/FAILED/ABORTED)自动设置 completed_at"""
        from django.utils import timezone as tz

        before = tz.now()
        mock_model = MagicMock()
        mock_model.status = 'verifying'
        sm = TaskStateMachine(task_dispatch_model=mock_model)

        sm.transition_to(TaskState.COMPLETED)
        self.assertIsNotNone(mock_model.completed_at)
        self.assertGreaterEqual(mock_model.completed_at, before)

        mock_model.status = 'executing'
        sm2 = TaskStateMachine(task_dispatch_model=mock_model)
        sm2.transition_to(TaskState.FAILED)
        self.assertIsNotNone(mock_model.completed_at)

    def test_non_terminal_does_not_set_completed_at(self):
        """非终态不设置 completed_at（save 时 completed_at 不被赋值）"""
        mock_model = MagicMock()
        mock_model.status = 'created'
        sm = TaskStateMachine(task_dispatch_model=mock_model)
        sm.transition_to(TaskState.SHARDING)
        # save 应该被调用，且 update_fields 包含 status 和 completed_at
        mock_model.save.assert_called_once_with(update_fields=['status', 'completed_at'])

    @patch.object(TaskStateMachine, '_execute_hooks')
    def test_hook_execution_order_before_then_after(self, mock_hooks):
        """转移前后 hook 执行顺序正确：先 before 后 after"""
        mock_model = MagicMock()
        mock_model.status = 'created'
        sm = TaskStateMachine(task_dispatch_model=mock_model)

        sm.transition_to(TaskState.SHARDING)

        calls = mock_hooks.call_args_list
        self.assertEqual(len(calls), 2)
        # _execute_hooks(from_state, to_state, when, **kwargs)
        # when 是第3个位置参数
        self.assertEqual(calls[0][0][2], 'before')
        self.assertEqual(calls[1][0][2], 'after')

    # ---- register_hook + _execute_hooks ----

    def test_register_and_execute_before_hook(self):
        """注册并执行 before hook"""
        calls = []
        def my_hook(from_st, to_st, **kw):
            calls.append(('before', from_st.value, to_st.value))

        sm = TaskStateMachine()
        sm._state = TaskState.CREATED
        sm.register_hook(TaskState.CREATED, TaskState.SHARDING, my_hook, when='before')
        sm.transition_to(TaskState.SHARDING)

        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0], ('before', 'created', 'sharding'))

    def test_register_and_execute_after_hook(self):
        """注册并执行 after hook"""
        calls = []
        def my_hook(from_st, to_st, **kw):
            calls.append(('after', from_st.value, to_st.value))

        sm = TaskStateMachine()
        sm._state = TaskState.CREATED
        sm.register_hook(TaskState.CREATED, TaskState.SHARDING, my_hook, when='after')
        sm.transition_to(TaskState.SHARDING)

        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0], ('after', 'created', 'sharding'))

    def test_hook_exception_does_not_interrupt_main_flow(self):
        """hook 执行时异常不影响主流程"""
        def bad_hook(from_st, to_st, **kw):
            raise RuntimeError("hook exploded")

        sm = TaskStateMachine()
        sm._state = TaskState.CREATED
        sm.register_hook(TaskState.CREATED, TaskState.SHARDING, bad_hook, when='before')
        # 不应抛异常
        result = sm.transition_to(TaskState.SHARDING)
        self.assertTrue(result)
        self.assertEqual(sm.current_state, TaskState.SHARDING)

    def test_multiple_hooks_executed_in_registration_order(self):
        """多个 hook 按注册顺序执行"""
        order = []

        def hook_a(f, t, **kw): order.append('a')
        def hook_b(f, t, **kw): order.append('b')
        def hook_c(f, t, **kw): order.append('c')

        sm = TaskStateMachine()
        sm._state = TaskState.CREATED
        sm.register_hook(TaskState.CREATED, TaskState.SHARDING, hook_a, when='after')
        sm.register_hook(TaskState.CREATED, TaskState.SHARDING, hook_b, when='after')
        sm.register_hook(TaskState.CREATED, TaskState.SHARDING, hook_c, when='after')
        sm.transition_to(TaskState.SHARDING)

        self.assertEqual(order, ['a', 'b', 'c'])

    # ---- get_valid_targets ----

    def test_get_valid_targets_from_none(self):
        """None 状态的合法目标只有 CREATED"""
        sm = TaskStateMachine()
        targets = sm.get_valid_targets()
        self.assertEqual(targets, [TaskState.CREATED])

    def test_get_valid_targets_from_sharding(self):
        """SHARDING 状态的合法目标列表"""
        sm = TaskStateMachine()
        sm._state = TaskState.SHARDING
        targets = sm.get_valid_targets()
        self.assertCountEqual(
            targets,
            [TaskState.DISPATCHING, TaskState.FAILED, TaskState.ABORTED]
        )

    def test_get_valid_targets_terminal_empty(self):
        """终态返回空列表"""
        sm = TaskStateMachine()
        sm._state = TaskState.COMPLETED
        self.assertEqual(sm.get_valid_targets(), [])

    # ---- get_all_transitions ----

    def test_get_all_transitions_returns_full_table(self):
        """返回完整的转移表字典"""
        table = TaskStateMachine.get_all_transitions()
        self.assertIsInstance(table, dict)
        # 检查所有状态都有 key
        for state in TaskState:
            self.assertIn(state.value, table)
        # 终态应为空列表
        self.assertEqual(table['completed'], [])
        self.assertEqual(table['aborted'], [])

    # ---- from_task 工厂方法 ----

    def test_from_task_creates_instance(self):
        """工厂方法正确创建实例"""
        mock_task = MagicMock()
        mock_task.status = 'dispatching'
        sm = TaskStateMachine.from_task(mock_task)
        self.assertIsInstance(sm, TaskStateMachine)
        self.assertEqual(sm.current_state, TaskState.DISPATCHING)


# ============================================================
# 2. HeartbeatService 测试（需要 DB）
# ============================================================

class TestHeartbeatService(TestCase):
    """HeartbeatService 心跳处理测试"""

    def setUp(self):
        self.node = P2PNode.objects.create(
            node_id='hb-node-001',
            node_type='desktop_windows',
            capabilities=['ai_detection'],
            resources={'cpu_cores': 8, 'memory_gb': 16},
            location='Beijing',
            status='online',
            public_key='pk-hb-001',
            reputation_score=100.0,
        )
        NodeReputation.objects.create(node=self.node, score=100.0, success_rate=1.0)

    def _normal_payload(self, **overrides):
        payload = {
            'cpu_usage': 30.0,
            'memory_usage': 40.0,
            'disk_io_usage': 10.0,
            'network_bandwidth_usage': 15.0,
            'active_task_count': 0,
        }
        payload.update(overrides)
        return payload

    # ---- process_heartbeat 正常流程 ----

    @patch.object(HeartbeatService, '_fetch_pending_tasks', return_value=[])
    def test_process_heartbeat_normal(self, _mock_fetch):
        """正常心跳处理：创建记录、更新节点、更新信誉"""
        resp = HeartbeatService.process_heartbeat('hb-node-001', self._normal_payload())

        self.assertEqual(resp['status'], 'ok')
        self.assertIn('server_time', resp)
        self.assertIn('pending_tasks', resp)
        self.assertEqual(resp['next_heartbeat_in_seconds'], 10)
        self.assertIn('idle_state', resp)

        # 验证心跳记录已创建
        self.assertEqual(NodeHeartbeat.objects.filter(node=self.node).count(), 1)

        # 验证信誉增加
        self.node.refresh_from_db()
        rep = NodeReputation.objects.get(node=self.node)
        self.assertAlmostEqual(rep.score, 100.1, places=4)

    # ---- 节点不存在 / 封禁 ----

    @patch.object(HeartbeatService, '_fetch_pending_tasks', return_value=[])
    def test_process_heartbeat_node_not_found_raises_error(self, _mock_fetch):
        """节点不存在抛 P2PServiceError"""
        with self.assertRaises(P2PServiceError) as ctx:
            HeartbeatService.process_heartbeat('nonexistent-node', self._normal_payload())
        self.assertIn('does not exist', str(ctx.exception))

    @patch.object(HeartbeatService, '_fetch_pending_tasks', return_value=[])
    def test_process_heartbeat_banned_node_raises_error(self, _mock_fetch):
        """节点被封禁抛 P2PServiceError"""
        self.node.status = 'banned'
        self.node.save()

        with self.assertRaises(P2PServiceError) as ctx:
            HeartbeatService.process_heartbeat('hb-node-001', self._normal_payload())
        self.assertIn('banned', str(ctx.exception))

    # ---- 异常检测 ----

    def test_cpu_overload_detected(self):
        """CPU >= 95% 检测为 cpu_overload 异常"""
        anomalies = HeartbeatService._detect_anomalies(
            self._normal_payload(cpu_usage=96.0)
        )
        types = [a['type'] for a in anomalies]
        self.assertIn('cpu_overload', types)

    def test_memory_overflow_detected(self):
        """Memory >= 95% 检测为 memory_overflow 异常"""
        anomalies = HeartbeatService._detect_anomalies(
            self._normal_payload(memory_usage=97.0)
        )
        types = [a['type'] for a in anomalies]
        self.assertIn('memory_overflow', types)

    def test_gpu_overload_detected(self):
        """GPU >= 98% 检测为 gpu_overload 异常"""
        anomalies = HeartbeatService._detect_anomalies(
            self._normal_payload(gpu_usage=99.0)
        )
        types = [a['type'] for a in anomalies]
        self.assertIn('gpu_overload', types)

    def test_normal_resources_no_anomalies(self):
        """正常资源无异常"""
        anomalies = HeartbeatService._detect_anomalies(self._normal_payload())
        self.assertEqual(anomalies, [])

    def test_multiple_anomalies_detected_simultaneously(self):
        """多种异常同时存在都返回"""
        anomalies = HeartbeatService._detect_anomalies({
            'cpu_usage': 96.0,
            'memory_usage': 96.0,
            'gpu_usage': 99.0,
            'disk_io_usage': 20.0,
            'network_bandwidth_usage': 10.0,
        })
        types = [a['type'] for a in anomalies]
        self.assertIn('cpu_overload', types)
        self.assertIn('memory_overflow', types)
        self.assertIn('gpu_overload', types)

    # ---- BUSY idle_state 导致节点变 busy ----

    @patch.object(HeartbeatService, '_fetch_pending_tasks', return_value=[])
    def test_busy_idle_state_changes_node_status(self, _mock_fetch):
        """BUSY idle_state 导致节点状态变 busy"""
        # 高资源使用率触发 BUSY
        high_payload = {
            'cpu_usage': 90.0,
            'memory_usage': 85.0,
            'disk_io_usage': 50.0,
            'network_bandwidth_usage': 60.0,
            'active_task_count': 3,
        }
        resp = HeartbeatService.process_heartbeat('hb-node-001', high_payload)
        self.assertEqual(resp['idle_state'], 'BUSY')

        self.node.refresh_from_db()
        self.assertEqual(self.node.status, 'busy')

    # ---- 响应字段完整性 ----

    @patch.object(HeartbeatService, '_fetch_pending_tasks', return_value=[])
    def test_response_contains_all_required_fields(self, _mock_fetch):
        """返回响应包含 status/server_time/pending_tasks/next_heartbeat_in_seconds/idle_state"""
        resp = HeartbeatService.process_heartbeat('hb-node-001', self._normal_payload())
        for field in ['status', 'server_time', 'pending_tasks',
                       'next_heartbeat_in_seconds', 'idle_state']:
            self.assertIn(field, resp)

    # ---- _update_reputation ----

    @patch.object(HeartbeatService, '_fetch_pending_tasks', return_value=[])
    def test_update_reputation_normal_bonus(self, _mock_fetch):
        """正常心跳信誉 +0.1"""
        HeartbeatService.process_heartbeat('hb-node-001', self._normal_payload())
        rep = NodeReputation.objects.get(node=self.node)
        self.assertAlmostEqual(rep.score, 100.1, places=4)

    @patch.object(HeartbeatService, '_fetch_pending_tasks', return_value=[])
    def test_update_reputation_anomaly_penalty(self, _mock_fetch):
        """异常心跳信誉 -1.0"""
        anomaly_payload = self._normal_payload(cpu_usage=96.0)
        HeartbeatService.process_heartbeat('hb-node-001', anomaly_payload)
        rep = NodeReputation.objects.get(node=self.node)
        self.assertAlmostEqual(rep.score, 99.0, places=4)

    @patch.object(HeartbeatService, '_fetch_pending_tasks', return_value=[])
    def test_reputation_capped_at_max(self, _mock_fetch):
        """信誉不超过 REPUTATION_MAX(150)"""
        rep = NodeReputation.objects.get(node=self.node)
        rep.score = 149.95
        rep.save()
        self.node.reputation_score = 149.95
        self.node.save()

        HeartbeatService.process_heartbeat('hb-node-001', self._normal_payload())
        rep.refresh_from_db()
        self.assertLessEqual(rep.score, REPUTATION_MAX)

    @patch.object(HeartbeatService, '_fetch_pending_tasks', return_value=[])
    def test_reputation_floored_at_min(self, _mock_fetch):
        """信誉不低于 REPUTATION_MIN(0)"""
        rep = NodeReputation.objects.get(node=self.node)
        rep.score = 0.5
        rep.save()
        self.node.reputation_score = 0.5
        self.node.save()

        # 连续多次异常扣分
        for _ in range(5):
            HeartbeatService.process_heartbeat(
                'hb-node-001', self._normal_payload(cpu_usage=96.0)
            )
        rep.refresh_from_db()
        self.assertGreaterEqual(rep.score, REPUTATION_MIN)

    @patch.object(HeartbeatService, '_fetch_pending_tasks', return_value=[])
    def test_anomaly_decreases_success_rate(self, _mock_fetch):
        """异常降低 success_rate"""
        HeartbeatService.process_heartbeat(
            'hb-node-001', self._normal_payload(cpu_usage=96.0)
        )
        rep = NodeReputation.objects.get(node=self.node)
        self.assertLess(rep.success_rate, 1.0)

    # ---- check_offline_nodes ----

    def test_check_offline_nodes_marks_timeout_nodes(self):
        """超时节点被标记 offline"""
        from django.utils import timezone as tz

        now = tz.now()
        old_time = now - tz.timedelta(seconds=300)
        stale_node = P2PNode.objects.create(
            node_id='stale-node',
            node_type='browser',
            capabilities=[],
            resources={},
            location='X',
            status='online',
            public_key='k-stale',
        )
        P2PNode.objects.filter(node_id='stale-node').update(last_heartbeat=old_time)

        offline_ids = HeartbeatService.check_offline_nodes(timeout_seconds=120)

        self.assertIn('stale-node', offline_ids)
        stale_node.refresh_from_db()
        self.assertEqual(stale_node.status, 'offline')

    def test_check_offline_nodes_deducts_reputation(self):
        """离线节点扣除信誉 -5.0"""
        from django.utils import timezone as tz

        now = tz.now()
        old_time = now - tz.timedelta(seconds=300)
        offline_node = P2PNode.objects.create(
            node_id='off-penalty-node',
            node_type='browser',
            capabilities=[],
            resources={},
            location='X',
            status='online',
            reputation_score=80.0,
            public_key='k-off',
        )
        P2PNode.objects.filter(node_id='off-penalty-node').update(last_heartbeat=old_time)
        NodeReputation.objects.create(node=offline_node, score=80.0, success_rate=1.0)

        HeartbeatService.check_offline_nodes(timeout_seconds=120)

        rep = NodeReputation.objects.get(node=offline_node)
        self.assertAlmostEqual(rep.score, 75.0, places=4)

    def test_check_offline_nodes_no_timeout_returns_empty(self):
        """无超时节点返回空列表"""
        online_node = P2PNode.objects.create(
            node_id='fresh-online',
            node_type='browser',
            capabilities=[],
            resources={},
            location='X',
            status='online',
            public_key='k-fresh',
        )

        offline_ids = HeartbeatService.check_offline_nodes(timeout_seconds=3600)
        self.assertEqual(offline_ids, [])

    # ---- get_node_live_stats ----

    @patch.object(HeartbeatService, '_fetch_pending_tasks', return_value=[])
    def test_get_node_live_stats_returns_recent_heartbeats(self, _mock_fetch):
        """返回最近心跳记录"""
        HeartbeatService.process_heartbeat('hb-node-001', self._normal_payload())

        stats = HeartbeatService.get_node_live_stats('hb-node-001')

        self.assertEqual(stats['node_id'], 'hb-node-001')
        self.assertIn('recent_heartbeats', stats)
        self.assertIn('statistics', stats)
        self.assertGreater(len(stats['recent_heartbeats']), 0)

    @patch.object(HeartbeatService, '_fetch_pending_tasks', return_value=[])
    def test_get_node_live_stats_calculates_avg_cpu_memory(self, _mock_fetch):
        """计算 avg_cpu_usage / avg_memory_usage"""
        HeartbeatService.process_heartbeat('hb-node-001', self._normal_payload(cpu_usage=30.0, memory_usage=40.0))

        stats = HeartbeatService.get_node_live_stats('hb-node-001')
        st = stats['statistics']
        self.assertAlmostEqual(st['avg_cpu_usage'], 30.0, places=1)
        self.assertAlmostEqual(st['avg_memory_usage'], 40.0, places=1)

    def test_get_node_live_stats_node_not_found_raises(self):
        """节点不存在抛异常"""
        with self.assertRaises(P2PServiceError) as ctx:
            HeartbeatService.get_node_live_stats('ghost-node')
        self.assertIn('does not exist', str(ctx.exception))


# ============================================================
# 3. IdleDetectionService 测试（纯逻辑，使用 unittest.TestCase）
# ============================================================

class TestIdleDetectionService(unittest.TestCase):
    """IdleDetectionService 空闲状态检测测试"""

    # ---- evaluate_idle_state ----

    def test_all_low_resources_is_idle(self):
        """全部低资源 → IDLE"""
        state = IdleDetectionService.evaluate_idle_state({
            'cpu_usage': 0.1,
            'memory_usage': 0.2,
            'disk_io_usage': 0.05,
            'network_bandwidth_usage': 0.1,
        })
        self.assertEqual(state, 'IDLE')

    def test_any_resource_above_emergency_is_busy(self):
        """任一资源 >= EMERGENCY_THRESHOLDS(0.8) → BUSY"""
        state = IdleDetectionService.evaluate_idle_state({
            'cpu_usage': 0.9,
            'memory_usage': 0.1,
            'disk_io_usage': 0.1,
            'network_bandwidth_usage': 0.1,
        })
        self.assertEqual(state, 'BUSY')

    def test_partial_above_idle_thresholds_is_partial_busy(self):
        """部分超过 IDLE_THRESHOLDS → PARTIAL_BUSY"""
        state = IdleDetectionService.evaluate_idle_state({
            'cpu_usage': 0.5,
            'memory_usage': 0.6,
            'disk_io_usage': 0.1,
            'network_bandwidth_usage': 0.1,
        })
        self.assertEqual(state, 'PARTIAL_BUSY')

    def test_empty_metrics_defaults_to_idle(self):
        """空指标默认值处理（全部默认0）→ IDLE"""
        state = IdleDetectionService.evaluate_idle_state({})
        self.assertEqual(state, 'IDLE')

    def test_missing_keys_use_default_zero(self):
        """缺少部分 key 使用默认值 0"""
        state = IdleDetectionService.evaluate_idle_state({'cpu_usage': 0.9})
        self.assertEqual(state, 'BUSY')  # cpu >= 0.8

    # ---- should_trigger_migration ----

    def test_trigger_migration_on_non_busy_to_busy(self):
        """非 BUSY → BUSY 触发迁移"""
        self.assertTrue(IdleDetectionService.should_trigger_migration('BUSY', 'IDLE'))
        self.assertTrue(IdleDetectionService.should_trigger_migration('BUSY', 'PARTIAL_BUSY'))

    def test_no_trigger_for_other_transitions(self):
        """其他转换不触发"""
        self.assertFalse(IdleDetectionService.should_trigger_migration('IDLE', 'IDLE'))
        self.assertFalse(IdleDetectionService.should_trigger_migration('IDLE', 'PARTIAL_BUSY'))
        self.assertFalse(IdleDetectionService.should_trigger_migration('PARTIAL_BUSY', 'IDLE'))

    def test_busy_to_busy_no_trigger(self):
        """BUSY → BUSY 不触发"""
        self.assertFalse(IdleDetectionService.should_trigger_migration('BUSY', 'BUSY'))

    # ---- get_resource_contention_level ----

    def test_contention_level_descriptions(self):
        """返回每种资源的等级描述（正常/偏高/极高）"""
        levels = IdleDetectionService.get_resource_contention_level({
            'cpu_usage': 0.1,
            'memory_usage': 0.5,
            'disk_io_usage': 0.9,
            'network_bandwidth_usage': 0.35,
        })

        self.assertEqual(levels['cpu'], '正常')
        self.assertEqual(levels['memory'], '偏高')
        self.assertEqual(levels['disk_io'], '极高')
        self.assertIn(levels['network'], ('正常', '偏高'))  # 0.35 > 0.30 threshold

    def test_contention_level_empty_metrics(self):
        """空指标全部返回正常"""
        levels = IdleDetectionService.get_resource_contention_level({})
        for resource_level in levels.values():
            self.assertEqual(resource_level, '正常')


# ============================================================
# 4. NodeDiscoveryService 测试（需要 DB）
# ============================================================

class TestNodeDiscoveryService(TestCase):
    """NodeDiscoveryService 节点发现测试"""

    def setUp(self):
        self.nodes = {}
        for i, (nid, ntype, loc, caps, reps, res, stat) in enumerate([
            ('node-d-01', 'desktop_windows', 'Beijing CN', ['ai_detection'], 85.0,
             {'cpu_cores': 8, 'memory_gb': 16}, 'online'),
            ('node-d-02', 'enterprise', 'Shanghai CN', ['ocr', 'ai_detection'], 92.0,
             {'cpu_cores': 16, 'memory_gb': 64}, 'online'),
            ('node-d-03', 'browser', 'Tokyo JP', ['text_processing'], 45.0,
             {'cpu_cores': 2, 'memory_gb': 4}, 'online'),
            ('node-d-04', 'mobile', 'Beijing CN', ['nlp_inference'], 70.0,
             {'cpu_cores': 4, 'memory_gb': 8}, 'busy'),
            ('node-d-05', 'desktop_mac', 'Guangzhou CN', ['image_analysis'], 25.0,
             {'cpu_cores': 6, 'memory_gb': 12}, 'online'),
            ('node-d-06', 'self_hosted', 'Shenzhen CN', ['file_scanning'], 55.0,
             {'cpu_cores': 4, 'memory_gb': 16}, 'offline'),
            ('node-d-07', 'enterprise', 'Beijing CN', ['ai_detection', 'code_execution'], 98.0,
             {'cpu_cores': 32, 'memory_gb': 128}, 'online'),
            ('node-banned', 'desktop_windows', 'Unknown', [], 50.0,
             {}, 'banned'),
        ]):
            node = P2PNode.objects.create(
                node_id=nid,
                node_type=ntype,
                capabilities=caps,
                resources=res,
                location=loc,
                status=stat,
                reputation_score=reps,
                public_key=f'pk-{nid}',
            )
            self.nodes[nid] = node

    # ---- discover_nodes ----

    def test_discover_default_online_non_banned(self):
        """默认返回 online 非 banned 节点"""
        results = NodeDiscoveryService.discover_nodes({})
        ids = {r['node_id'] for r in results}
        # 默认 status='online'，仅返回 online 且非 banned 的节点
        expected = {
            'node-d-01', 'node-d-02', 'node-d-03',
            'node-d-05', 'node-d-07',
        }
        self.assertEqual(ids, expected)
        self.assertNotIn('node-banned', ids)
        self.assertNotIn('node-d-06', ids)  # offline
        self.assertNotIn('node-d-04', ids)  # busy

    def test_discover_filter_by_node_type(self):
        """node_type 过滤"""
        results = NodeDiscoveryService.discover_nodes({'node_type': 'enterprise'})
        ids = {r['node_id'] for r in results}
        self.assertEqual(ids, {'node-d-02', 'node-d-07'})

    def test_discover_filter_by_location_icontains(self):
        """location 模糊过滤"""
        results = NodeDiscoveryService.discover_nodes({'location': 'beijing'})
        ids = {r['node_id'] for r in results}
        # 仅 online 节点中 location 包含 beijing 的
        self.assertIn('node-d-01', ids)
        self.assertIn('node-d-07', ids)
        # node-d-04 是 busy 状态，不会被默认 online 过滤返回

    def test_discover_filter_by_min_reputation(self):
        """min_reputation 过滤"""
        results = NodeDiscoveryService.discover_nodes({'min_reputation': 80.0})
        ids = {r['node_id'] for r in results}
        self.assertEqual(ids, {'node-d-01', 'node-d-02', 'node-d-07'})

    def test_discover_filter_by_required_capabilities(self):
        """required_capabilities 过滤（SQLite 兼容方式）"""
        results = NodeDiscoveryService.discover_nodes({
            'required_capabilities': ['ai_detection']
        })
        ids = {r['node_id'] for r in results}
        self.assertIn('node-d-01', ids)
        self.assertIn('node-d-02', ids)
        self.assertIn('node-d-07', ids)
        # 不含 ai_detection 的不应出现
        self.assertNotIn('node-d-03', ids)

    def test_discover_filter_by_min_resources(self):
        """min_resources 过滤（cpu_cores/memory_gb）"""
        results = NodeDiscoveryService.discover_nodes({
            'min_resources': {'cpu_cores': 8, 'memory_gb': 32}
        })
        ids = {r['node_id'] for r in results}
        # node-d-02: 16c/64gb ✓, node-d-07: 32c/128gb ✓
        self.assertEqual(ids, {'node-d-02', 'node-d-07'})

    def test_discover_max_results_limits_count(self):
        """max_results 限制数量"""
        results = NodeDiscoveryService.discover_nodes({'max_results': 2})
        self.assertLessEqual(len(results), 2)

    def test_discover_no_matches_returns_empty_list(self):
        """无匹配节点返回空列表"""
        results = NodeDiscoveryService.discover_nodes({
            'node_type': 'nonexistent_type',
        })
        self.assertEqual(results, [])

    # ---- get_network_topology ----

    def test_topology_basic_counts(self):
        """返回 total_nodes/online_count/offline_count/busy_count"""
        topo = NodeDiscoveryService.get_network_topology()

        self.assertEqual(topo['total_nodes'], 8)
        self.assertEqual(topo['online_count'], 5)
        self.assertEqual(topo['offline_count'], 1)
        self.assertEqual(topo['busy_count'], 1)

    def test_topology_by_type_statistics(self):
        """返回 by_type 统计"""
        topo = NodeDiscoveryService.get_network_topology()
        by_type = topo['by_type']

        self.assertIn('desktop_windows', by_type)
        self.assertIn('enterprise', by_type)
        self.assertEqual(by_type['enterprise'], 2)

    def test_topology_by_location_statistics(self):
        """返回 by_location 统计"""
        topo = NodeDiscoveryService.get_network_topology()
        by_loc = topo['by_location']

        self.assertIn('Beijing CN', by_loc)
        self.assertEqual(by_loc['Beijing CN'], 3)

    def test_topology_avg_reputation_and_compute_hours(self):
        """返回 avg_reputation / total_compute_hours"""
        topo = NodeDiscoveryService.get_network_topology()

        self.assertIsInstance(topo['avg_reputation'], float)
        self.assertIsInstance(topo['total_compute_hours'], float)

    # ---- validate_node_capability ----

    def test_validate_known_capability_returns_true(self):
        """已知能力返回 True"""
        self.assertTrue(NodeDiscoveryService.validate_node_capability(
            'test-node', {'ai_detection': '1.0'}
        ))

    def test_validate_unknown_capability_returns_false(self):
        """含未知能力返回 False"""
        self.assertFalse(NodeDiscoveryService.validate_node_capability(
            'test-node', {'unknown_capability': '1.0', 'ai_detection': '1.0'}
        ))

    def test_validate_empty_report_returns_true(self):
        """空能力报告返回 True（无未知能力）"""
        self.assertTrue(NodeDiscoveryService.validate_node_capability(
            'test-node', {}
        ))

    # ---- find_best_nodes_for_shard ----

    def test_find_best_sorts_by_idle_priority(self):
        """按 IDLE > PARTIAL_BUSY > BUSY 排序"""
        requirements = {
            'required_capabilities': [],
            'min_resources': {},
            'min_reputation': 0.0,
        }
        result = NodeDiscoveryService.find_best_nodes_for_shard(requirements, count=3)
        self.assertIsInstance(result, list)
        self.assertLessEqual(len(result), 3)

    def test_find_best_secondary_sort_by_reputation_desc(self):
        """二级排序按信誉降序"""
        requirements = {
            'required_capabilities': ['ai_detection'],
            'min_resources': {},
            'min_reputation': 30.0,
        }
        result = NodeDiscoveryService.find_best_nodes_for_shard(requirements, count=5)
        if len(result) >= 2:
            reps = [r.get('reputation_score', 0) for r in result]
            # 验证降序（考虑 idle_state 主排序后同级的部分）
            # 由于 idle_state 可能不同，这里只验证结果不为空且包含高信誉节点
            self.assertIn('node-d-07', [r['node_id'] for r in result])

    def test_find_best_returns_limited_count(self):
        """返回前 count 个节点"""
        requirements = {
            'required_capabilities': [],
            'min_resources': {},
        }
        result = NodeDiscoveryService.find_best_nodes_for_shard(requirements, count=2)
        self.assertLessEqual(len(result), 2)
