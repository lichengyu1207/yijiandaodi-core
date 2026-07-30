"""
p2p_app.serializers 完整测试

覆盖所有 Serializer 类:
- NodeRegisterSerializer (6)
- NodeRegisterResponseSerializer (4)
- NodeDetailSerializer (3)
- NodeListSerializer (2)
- HeartbeatSerializer (7)
- HeartbeatAckSerializer (3)
- OfflineReasonSerializer (2)
- ReputationInfoSerializer (2)
- TaskShardInputSerializer (5)
- TaskDispatchSerializer (6)
- ShardResultSubmissionSerializer (4)
- TaskStatusResponseSerializer (2)
- TaskCancelSerializer (2)
- TaskDispatchDetailSerializer (集成测试, 2)

总计: 50+ 测试用例
"""

from django.test import TestCase
from django.utils import timezone
from datetime import datetime

from p2p_app.serializers import (
    NodeRegisterSerializer,
    NodeRegisterResponseSerializer,
    NodeDetailSerializer,
    NodeListSerializer,
    HeartbeatSerializer,
    HeartbeatAckSerializer,
    OfflineReasonSerializer,
    ReputationInfoSerializer,
    TaskShardInputSerializer,
    TaskDispatchSerializer,
    TaskShardSerializer,
    TaskDispatchDetailSerializer,
    ShardResultSubmissionSerializer,
    TaskStatusResponseSerializer,
    TaskCancelSerializer,
)
from p2p_app.models import P2PNode, TaskDispatch, TaskShard


# ═══════════════════════════════════════════
# 1. TestNodeRegisterSerializer (6 个用例)
# ═══════════════════════════════════════════
class TestNodeRegisterSerializer(TestCase):

    def test_valid_data_serializes_successfully(self):
        """有效数据序列化成功 (node_type='browser', capabilities=['code'], location='Beijing')"""
        data = {
            'node_type': 'browser',
            'capabilities': ['code'],
            'resources': {'cpu_cores': '4', 'memory_gb': '16'},
            'location': 'Beijing',
        }
        serializer = NodeRegisterSerializer(data=data)
        self.assertTrue(serializer.is_valid())
        result = serializer.validated_data
        self.assertEqual(result['node_type'], 'browser')
        self.assertEqual(result['capabilities'], ['code'])
        self.assertEqual(result['location'], 'Beijing')

    def test_default_values(self):
        """默认值: capabilities=[], resources={}, location='unknown', public_key_fingerprint=''"""
        data = {'node_type': 'desktop_windows'}
        serializer = NodeRegisterSerializer(data=data)
        self.assertTrue(serializer.is_valid())
        result = serializer.validated_data
        self.assertEqual(result['capabilities'], [])
        self.assertEqual(result['resources'], {})
        self.assertEqual(result['location'], 'unknown')
        self.assertEqual(result['public_key_fingerprint'], '')

    def test_node_type_required(self):
        """node_type 必填，缺少时报错"""
        data = {
            'capabilities': ['code'],
            'location': 'Shanghai',
        }
        serializer = NodeRegisterSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('node_type', serializer.errors)

    def test_node_type_invalid_choice(self):
        """node_type 不在 choices 中报错"""
        data = {'node_type': 'invalid_type'}
        serializer = NodeRegisterSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('node_type', serializer.errors)

    def test_validate_resources_non_dict_raises_error(self):
        """validate_resources: 非 dict 值报 ValidationError"""
        data = {
            'node_type': 'mobile',
            'resources': 'not_a_dict',
        }
        serializer = NodeRegisterSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('resources', serializer.errors)
        self.assertIn('dict', str(serializer.errors['resources']).lower())

    def test_valid_resources_dict(self):
        """有效 resources={'cpu_cores': '4', 'memory_gb': '16'}"""
        data = {
            'node_type': 'enterprise',
            'resources': {'cpu_cores': '4', 'memory_gb': '16'},
        }
        serializer = NodeRegisterSerializer(data=data)
        self.assertTrue(serializer.is_valid())


# ═══════════════════════════════════════════
# 2. TestNodeRegisterResponseSerializer (4 个用例)
# ═══════════════════════════════════════════
class TestNodeRegisterResponseSerializer(TestCase):

    def test_contains_expected_fields(self):
        """包含 node_id/node_type/status/created_at/platform_certificate 字段"""
        data = {
            'node_id': 'node-001',
            'node_type': 'browser',
            'status': 'online',
            'created_at': '2026-06-05T12:00:00Z',
            'platform_certificate': 'cert-abc123',
        }
        serializer = NodeRegisterResponseSerializer(data=data)
        self.assertTrue(serializer.is_valid())
        result = serializer.validated_data
        expected_fields = ['node_id', 'node_type', 'status', 'created_at', 'platform_certificate']
        for field in expected_fields:
            self.assertIn(field, result)

    def test_missing_required_fields_error(self):
        """缺少必填字段报错"""
        # 只提供部分必填字段
        data = {'node_id': 'node-001'}
        serializer = NodeRegisterResponseSerializer(data=data)
        self.assertFalse(serializer.is_valid())

    def test_created_at_accepts_datetime_string(self):
        """created_at 接受 datetime 字符串"""
        data = {
            'node_id': 'node-002',
            'node_type': 'desktop_mac',
            'status': 'offline',
            'created_at': '2026-01-15T08:30:00+08:00',
            'platform_certificate': 'cert-def456',
        }
        serializer = NodeRegisterResponseSerializer(data=data)
        self.assertTrue(serializer.is_valid())

    def test_full_serialization(self):
        """完整数据序列化和输出验证"""
        data = {
            'node_id': 'node-full',
            'node_type': 'self_hosted',
            'status': 'busy',
            'created_at': '2026-03-01T00:00:00Z',
            'platform_certificate': 'cert-full',
        }
        serializer = NodeRegisterResponseSerializer(data=data)
        self.assertTrue(serializer.is_valid())
        output = serializer.data
        self.assertEqual(output['node_id'], 'node-full')
        self.assertEqual(output['status'], 'busy')


# ═══════════════════════════════════════════
# 3. TestNodeDetailSerializer (3 个用例)
# ═══════════════════════════════════════════
class TestNodeDetailSerializer(TestCase):

    def test_model_serializer_associates_with_p2pnode(self):
        """ModelSerializer 与 P2PNode 模型关联"""
        self.assertEqual(NodeDetailSerializer.Meta.model, P2PNode)

    def test_fields_list_contains_expected_fields(self):
        """fields 列表包含预期字段"""
        expected_fields = [
            'node_id', 'node_type', 'capabilities', 'resources',
            'location', 'status', 'last_heartbeat', 'reputation_score',
            'total_tasks_completed', 'total_compute_hours',
            'created_at', 'updated_at',
        ]
        self.assertCountEqual(NodeDetailSerializer.Meta.fields, expected_fields)

    def test_serialize_p2pnode_instance(self):
        """序列化 P2PNode 实例"""
        node = P2PNode(
            node_id='test-node-001',
            node_type='browser',
            capabilities=['code', 'text'],
            resources={'cpu_cores': 8},
            location='Beijing',
            status='online',
            public_key='-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----',
        )
        serializer = NodeDetailSerializer(node)
        data = serializer.data
        self.assertEqual(data['node_id'], 'test-node-001')
        self.assertEqual(data['node_type'], 'browser')
        self.assertEqual(data['status'], 'online')
        self.assertEqual(data['location'], 'Beijing')


# ═══════════════════════════════════════════
# 4. TestNodeListSerializer (2 个用例)
# ═══════════════════════════════════════════
class TestNodeListSerializer(TestCase):

    def test_fields_is_subset_of_node_detail(self):
        """fields 是 NodeDetailSerializer 的子集"""
        detail_fields = set(NodeDetailSerializer.Meta.fields)
        list_fields = set(NodeListSerializer.Meta.fields)
        self.assertTrue(list_fields.issubset(detail_fields))

    def test_only_contains_expected_list_fields(self):
        """只包含 node_id/node_type/status/location/reputation_score/last_heartbeat"""
        expected = ['node_id', 'node_type', 'status', 'location', 'reputation_score', 'last_heartbeat']
        self.assertCountEqual(NodeListSerializer.Meta.fields, expected)


# ═══════════════════════════════════════════
# 5. TestHeartbeatSerializer (7 个用例)
# ═══════════════════════════════════════════
class TestHeartbeatSerializer(TestCase):

    def test_valid_metrics_data(self):
        """有效 metrics 含 cpu_usage/memory_usage/disk_io_usage/network_bandwidth_usage"""
        data = {
            'metrics': {
                'cpu_usage': 45.5,
                'memory_usage': 60.0,
                'disk_io_usage': 20.3,
                'network_bandwidth_usage': 10.0,
            },
        }
        serializer = HeartbeatSerializer(data=data)
        self.assertTrue(serializer.is_valid())

    def test_idle_state_default_optional(self):
        """idle_state 默认可选"""
        data = {
            'metrics': {
                'cpu_usage': 30.0,
                'memory_usage': 40.0,
                'disk_io_usage': 10.0,
                'network_bandwidth_usage': 5.0,
            },
        }
        serializer = HeartbeatSerializer(data=data)
        self.assertTrue(serializer.is_valid())
        # idle_state 不在 validated_data 中（未提供时）
        self.assertNotIn('idle_state', serializer.validated_data)

    def test_active_tasks_default_empty_list(self):
        """active_tasks 默认 []"""
        data = {
            'metrics': {
                'cpu_usage': 30.0,
                'memory_usage': 40.0,
                'disk_io_usage': 10.0,
                'network_bandwidth_usage': 5.0,
            },
        }
        serializer = HeartbeatSerializer(data=data)
        self.assertTrue(serializer.is_valid())
        self.assertEqual(serializer.validated_data.get('active_tasks'), [])

    def test_metrics_missing_required_keys(self):
        """metrics 缺少必填键 -> ValidationError"""
        data = {
            'metrics': {
                'cpu_usage': 30.0,
                # 缺少 memory_usage, disk_io_usage, network_bandwidth_usage
            },
        }
        serializer = HeartbeatSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('metrics', serializer.errors)

    def test_metrics_value_out_of_range(self):
        """metrics 值超出 [0,100] 范围 -> ValidationError (FloatField min/max)"""
        data = {
            'metrics': {
                'cpu_usage': 150.0,  # 超出范围
                'memory_usage': 60.0,
                'disk_io_usage': 20.0,
                'network_bandwidth_usage': 10.0,
            },
        }
        serializer = HeartbeatSerializer(data=data)
        self.assertFalse(serializer.is_valid())

    def test_idle_state_invalid_choice(self):
        """idle_state 不在 choices 中报错"""
        data = {
            'metrics': {
                'cpu_usage': 30.0,
                'memory_usage': 40.0,
                'disk_io_usage': 10.0,
                'network_bandwidth_usage': 5.0,
            },
            'idle_state': 'INVALID_STATE',
        }
        serializer = HeartbeatSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('idle_state', serializer.errors)

    def test_signature_optional_field(self):
        """signature 可选字段"""
        data = {
            'metrics': {
                'cpu_usage': 30.0,
                'memory_usage': 40.0,
                'disk_io_usage': 10.0,
                'network_bandwidth_usage': 5.0,
            },
            'signature': 'sig-abc',
        }
        serializer = HeartbeatSerializer(data=data)
        self.assertTrue(serializer.is_valid())


# ═══════════════════════════════════════════
# 6. TestHeartbeatAckSerializer (3 个用例)
# ═══════════════════════════════════════════
class TestHeartbeatAckSerializer(TestCase):

    def test_contains_expected_fields(self):
        """status/server_time/pending_tasks/next_heartbeat_in_seconds 字段"""
        data = {
            'status': 'ok',
            'server_time': '2026-06-05T12:00:00Z',
            'pending_tasks': ['task-1', 'task-2'],
            'next_heartbeat_in_seconds': 30,
        }
        serializer = HeartbeatAckSerializer(data=data)
        self.assertTrue(serializer.is_valid())
        result = serializer.validated_data
        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['next_heartbeat_in_seconds'], 30)

    def test_pending_tasks_is_list_field(self):
        """pending_tasks 是 ListField"""
        data = {
            'status': 'ok',
            'server_time': '2026-06-05T12:00:00Z',
            'pending_tasks': [],
            'next_heartbeat_in_seconds': 60,
        }
        serializer = HeartbeatAckSerializer(data=data)
        self.assertTrue(serializer.is_valid())
        self.assertIsInstance(serializer.validated_data['pending_tasks'], list)

    def test_missing_required_fields_error(self):
        """缺少必填字段报错"""
        data = {'status': 'ok'}
        serializer = HeartbeatAckSerializer(data=data)
        self.assertFalse(serializer.is_valid())


# ═══════════════════════════════════════════
# 7. TestOfflineReasonSerializer (2 个用例)
# ═══════════════════════════════════════════
class TestOfflineReasonSerializer(TestCase):

    def test_reason_optional_default(self):
        """reason 可选，默认 "用户主动下线" """
        serializer = OfflineReasonSerializer(data={})
        self.assertTrue(serializer.is_valid())
        self.assertEqual(serializer.validated_data['reason'], '用户主动下线')

    def test_reason_max_length_256(self):
        """reason 最大长度 256"""
        long_reason = 'x' * 256
        serializer = OfflineReasonSerializer(data={'reason': long_reason})
        self.assertTrue(serializer.is_valid())

        too_long = 'x' * 257
        serializer2 = OfflineReasonSerializer(data={'reason': too_long})
        self.assertFalse(serializer2.is_valid())


# ═══════════════════════════════════════════
# 8. TestReputationInfoSerializer (2 个用例)
# ═══════════════════════════════════════════
class TestReputationInfoSerializer(TestCase):

    def test_contains_all_reputation_fields(self):
        """score/success_rate/avg_response_time_ms/malicious_flags/rank 字段"""
        data = {
            'score': 95.5,
            'success_rate': 0.98,
            'avg_response_time_ms': 120.5,
            'malicious_flags': 0,
            'rank': 'A',
        }
        serializer = ReputationInfoSerializer(data=data)
        self.assertTrue(serializer.is_valid())
        result = serializer.validated_data
        self.assertAlmostEqual(result['score'], 95.5)
        self.assertEqual(result['rank'], 'A')

    def test_rank_is_string(self):
        """rank 是字符串 (等级)"""
        data = {
            'score': 80.0,
            'success_rate': 0.9,
            'avg_response_time_ms': 200.0,
            'malicious_flags': 1,
            'rank': 'S',
        }
        serializer = ReputationInfoSerializer(data=data)
        self.assertTrue(serializer.is_valid())
        self.assertIsInstance(serializer.validated_data['rank'], str)


# ═══════════════════════════════════════════
# 9. TestTaskShardInputSerializer (5 个用例)
# ═══════════════════════════════════════════
class TestTaskShardInputSerializer(TestCase):

    def test_sequence_min_value_zero(self):
        """sequence >= 0"""
        data = {'sequence': 0, 'payload_hash': 'abc123'}
        serializer = TaskShardInputSerializer(data=data)
        self.assertTrue(serializer.is_valid())

        data_neg = {'sequence': -1, 'payload_hash': 'abc123'}
        serializer_neg = TaskShardInputSerializer(data=data_neg)
        self.assertFalse(serializer_neg.is_valid())

    def test_payload_hash_required_max_length_64(self):
        """payload_hash 必填，最大长度 64"""
        # 缺少 payload_hash
        serializer_no = TaskShardInputSerializer(data={'sequence': 0})
        self.assertFalse(serializer_no.is_valid())
        self.assertIn('payload_hash', serializer_no.errors)

        # 合法长度
        hash64 = 'a' * 64
        serializer_ok = TaskShardInputSerializer(data={'sequence': 0, 'payload_hash': hash64})
        self.assertTrue(serializer_ok.is_valid())

        # 超长
        hash65 = 'a' * 65
        serializer_long = TaskShardInputSerializer(data={'sequence': 0, 'payload_hash': hash65})
        self.assertFalse(serializer_long.is_valid())

    def test_dependencies_default_empty_list(self):
        """dependencies 默认 []"""
        data = {'sequence': 0, 'payload_hash': 'hash001'}
        serializer = TaskShardInputSerializer(data=data)
        self.assertTrue(serializer.is_valid())
        self.assertEqual(serializer.validated_data.get('dependencies'), [])

    def test_required_capabilities_default_empty_list(self):
        """required_capabilities 默认 []"""
        data = {'sequence': 0, 'payload_hash': 'hash002'}
        serializer = TaskShardInputSerializer(data=data)
        self.assertTrue(serializer.is_valid())
        self.assertEqual(serializer.validated_data.get('required_capabilities'), [])

    def test_estimated_resources_default_empty_dict(self):
        """estimated_resources 默认 {}"""
        data = {'sequence': 0, 'payload_hash': 'hash003'}
        serializer = TaskShardInputSerializer(data=data)
        self.assertTrue(serializer.is_valid())
        self.assertEqual(serializer.validated_data.get('estimated_resources'), {})


# ═══════════════════════════════════════════
# 10. TestTaskDispatchSerializer (6 个用例)
# ═══════════════════════════════════════════
class TestTaskDispatchSerializer(TestCase):

    def test_task_type_required_and_choices(self):
        """task_type 必填且在 choices 中"""
        valid_data = {
            'task_type': 'code',
            'shards': [{'sequence': 0, 'payload_hash': 'h1'}],
        }
        serializer = TaskDispatchSerializer(data=valid_data)
        self.assertTrue(serializer.is_valid())

        invalid_type = {
            'task_type': 'invalid_type',
            'shards': [{'sequence': 0, 'payload_hash': 'h1'}],
        }
        serializer_bad = TaskDispatchSerializer(data=invalid_type)
        self.assertFalse(serializer_bad.is_valid())
        self.assertIn('task_type', serializer_bad.errors)

    def test_priority_security_privacy_have_defaults(self):
        """priority/security_level/privacy_level 有默认值"""
        data = {
            'task_type': 'text',
            'shards': [{'sequence': 0, 'payload_hash': 'h1'}],
        }
        serializer = TaskDispatchSerializer(data=data)
        self.assertTrue(serializer.is_valid())
        self.assertEqual(serializer.validated_data['priority'], 'normal')
        self.assertEqual(serializer.validated_data['security_level'], 'normal')
        self.assertEqual(serializer.validated_data['privacy_level'], 'public')

    def test_shards_min_length_one(self):
        """shards 至少 1 个元素 (min_length=1)"""
        data = {
            'task_type': 'image',
            'shards': [{'sequence': 0, 'payload_hash': 'h1'}],
        }
        serializer = TaskDispatchSerializer(data=data)
        self.assertTrue(serializer.is_valid())

    def test_shards_empty_list_validation_error(self):
        """shards 为空列表 -> ValidationError"""
        data = {
            'task_type': 'file',
            'shards': [],
        }
        serializer = TaskDispatchSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('shards', serializer.errors)

    def test_validate_shards_duplicate_sequence(self):
        """validate_shards: 重复 sequence -> ValidationError"""
        data = {
            'task_type': 'mixed',
            'shards': [
                {'sequence': 0, 'payload_hash': 'h1'},
                {'sequence': 0, 'payload_hash': 'h2'},  # 重复 sequence
            ],
        }
        serializer = TaskDispatchSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('shards', serializer.errors)
        self.assertIn('不能重复', str(serializer.errors['shards']))

    def test_max_wait_seconds_range(self):
        """max_wait_seconds 范围 [1, 86400]"""
        data = {
            'task_type': 'text',
            'max_wait_seconds': 500,
            'shards': [{'sequence': 0, 'payload_hash': 'h1'}],
        }
        serializer = TaskDispatchSerializer(data=data)
        self.assertTrue(serializer.is_valid())

        # 边界值测试 - 最小值
        data_min = {
            'task_type': 'text',
            'max_wait_seconds': 1,
            'shards': [{'sequence': 0, 'payload_hash': 'h1'}],
        }
        serializer_min = TaskDispatchSerializer(data=data_min)
        self.assertTrue(serializer_min.is_valid())

        # 超出最小值
        data_below = {
            'task_type': 'text',
            'max_wait_seconds': 0,
            'shards': [{'sequence': 0, 'payload_hash': 'h1'}],
        }
        serializer_below = TaskDispatchSerializer(data=data_below)
        self.assertFalse(serializer_below.is_valid())

        # 超出最大值
        data_over = {
            'task_type': 'text',
            'max_wait_seconds': 86401,
            'shards': [{'sequence': 0, 'payload_hash': 'h1'}],
        }
        serializer_over = TaskDispatchSerializer(data=data_over)
        self.assertFalse(serializer_over.is_valid())


# ═══════════════════════════════════════════
# 11. TestShardResultSubmissionSerializer (4 个用例)
# ═══════════════════════════════════════════
class TestShardResultSubmissionSerializer(TestCase):

    def test_shard_id_required(self):
        """shard_id 必填"""
        data = {}
        serializer = ShardResultSubmissionSerializer(data=data)
        self.assertFalse(serializer.is_valid())
        self.assertIn('shard_id', serializer.errors)

    def test_exit_code_default_zero(self):
        """exit_code 默认 0"""
        data = {'shard_id': 'shard-001'}
        serializer = ShardResultSubmissionSerializer(data=data)
        self.assertTrue(serializer.is_valid())
        self.assertEqual(serializer.validated_data['exit_code'], 0)

    def test_stdout_stderr_default_empty_string(self):
        """stdout/stderr 默认空字符串"""
        data = {'shard_id': 'shard-002'}
        serializer = ShardResultSubmissionSerializer(data=data)
        self.assertTrue(serializer.is_valid())
        self.assertEqual(serializer.validated_data['stdout'], '')
        self.assertEqual(serializer.validated_data['stderr'], '')

    def test_resource_usage_optional_allow_null(self):
        """resource_usage 可选，允许 null"""
        # 无 resource_usage
        data1 = {'shard_id': 'shard-003'}
        s1 = ShardResultSubmissionSerializer(data=data1)
        self.assertTrue(s1.is_valid())

        # resource_usage 为 null
        data2 = {'shard_id': 'shard-004', 'resource_usage': None}
        s2 = ShardResultSubmissionSerializer(data=data2)
        self.assertTrue(s2.is_valid())

        # resource_usage 为 dict
        data3 = {'shard_id': 'shard-005', 'resource_usage': {'cpu_ms': 100}}
        s3 = ShardResultSubmissionSerializer(data=data3)
        self.assertTrue(s3.is_valid())


# ═══════════════════════════════════════════
# 12. TestTaskStatusResponseSerializer (2 个用例)
# ═══════════════════════════════════════════
class TestTaskStatusResponseSerializer(TestCase):

    def test_task_id_status_progress_fields(self):
        """task_id/status/progress 字段"""
        data = {
            'task_id': 'task-001',
            'status': 'running',
            'progress': {'completed': 5, 'total': 10, 'percentage': 50.0},
        }
        serializer = TaskStatusResponseSerializer(data=data)
        self.assertTrue(serializer.is_valid())
        result = serializer.validated_data
        self.assertEqual(result['task_id'], 'task-001')
        self.assertEqual(result['status'], 'running')

    def test_progress_is_dict_field(self):
        """progress 是 DictField"""
        data = {
            'task_id': 'task-002',
            'status': 'completed',
            'progress': {},
        }
        serializer = TaskStatusResponseSerializer(data=data)
        self.assertTrue(serializer.is_valid())
        self.assertIsInstance(serializer.validated_data['progress'], dict)


# ═══════════════════════════════════════════
# 13. TestTaskCancelSerializer (2 个用例)
# ═══════════════════════════════════════════
class TestTaskCancelSerializer(TestCase):

    def test_reason_optional_default(self):
        """reason 可选，默认 "用户主动取消" """
        serializer = TaskCancelSerializer(data={})
        self.assertTrue(serializer.is_valid())
        self.assertEqual(serializer.validated_data['reason'], '用户主动取消')

    def test_reason_max_length_256(self):
        """reason 最大长度 256"""
        long_reason = 'r' * 256
        serializer = TaskCancelSerializer(data={'reason': long_reason})
        self.assertTrue(serializer.is_valid())

        too_long = 'r' * 257
        serializer2 = TaskCancelSerializer(data={'reason': too_long})
        self.assertFalse(serializer2.is_valid())


# ═══════════════════════════════════════════
# 14. TestTaskDispatchDetailSerializer (集成测试, 2 个用例)
# ═══════════════════════════════════════════
class TestTaskDispatchDetailSerializer(TestCase):

    def setUp(self):
        self.node = P2PNode.objects.create(
            node_id='integ-node-001',
            node_type='browser',
            public_key='-----BEGIN PUBLIC KEY-----\ninteg-test\n-----END PUBLIC KEY-----',
            location='TestCity',
            status='online',
        )
        self.task = TaskDispatch.objects.create(
            task_id='integ-task-001',
            task_type='code',
            status='executing',
            priority='high',
            total_shards=2,
            completed_shards=1,
            security_level='high',
            privacy_level='confidential',
            created_by='tester',
        )
        self.shard1 = TaskShard.objects.create(
            shard_id='integ-shard-001',
            task=self.task,
            sequence=0,
            total_in_task=2,
            payload_hash='hash-shard-001',
            status='completed',
        )
        self.shard2 = TaskShard.objects.create(
            shard_id='integ-shard-002',
            task=self.task,
            sequence=1,
            total_in_task=2,
            payload_hash='hash-shard-002',
            status='executing',
        )

    def test_serialize_real_instances(self):
        """使用真实 P2PNode + TaskDispatch + TaskShard 实例序列化"""
        serializer = TaskDispatchDetailSerializer(self.task)
        data = serializer.data
        self.assertEqual(data['task_id'], 'integ-task-001')
        self.assertEqual(data['task_type'], 'code')
        self.assertEqual(data['status'], 'executing')
        self.assertEqual(data['priority'], 'high')
        self.assertEqual(data['total_shards'], 2)
        self.assertEqual(data['completed_shards'], 1)

    def test_shards_nested_taskshard_serializer(self):
        """shards 字段嵌套 TaskShardSerializer"""
        serializer = TaskDispatchDetailSerializer(self.task)
        data = serializer.data
        self.assertIn('shards', data)
        shards = data['shards']
        self.assertEqual(len(shards), 2)
        # 验证嵌套序列化的字段
        shard_ids = {s['shard_id'] for s in shards}
        self.assertEqual(shard_ids, {'integ-shard-001', 'integ-shard-002'})
        # 验证 shard 包含预期字段
        first_shard = shards[0]
        self.assertIn('sequence', first_shard)
        self.assertIn('payload_hash', first_shard)
        self.assertIn('status', first_shard)
        self.assertIn('task', first_shard)
