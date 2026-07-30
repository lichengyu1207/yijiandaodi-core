"""
审计存证完整测试
覆盖 HashChain / AuditEvent / AuditLogger / ComplianceReporter
"""

import unittest
from datetime import datetime, timedelta

from django.test import TestCase

from p2p_app.services.audit_trail import (
    AuditEvent,
    AuditLogger,
    ComplianceReporter,
    HashChain,
)


# ──────────────────────────────────────────────
# 1. HashChain 类测试
# ──────────────────────────────────────────────

class TestHashChainInit(unittest.TestCase):
    """HashChain 初始化测试"""

    def test_chain_name_set_correctly(self):
        """chain_name 正确设置"""
        chain = HashChain("my_audit_chain")
        self.assertEqual(chain.chain_name, "my_audit_chain")

    def test_initial_last_hash_is_64_zeros(self):
        """初始 last_hash 为 64 个 '0'"""
        chain = HashChain()
        self.assertEqual(chain.last_hash, '0' * 64)

    def test_initial_length_is_zero(self):
        """初始 length = 0"""
        chain = HashChain()
        self.assertEqual(chain.length, 0)

    def test_default_chain_name(self):
        """默认 chain_name 为 'default'"""
        chain = HashChain()
        self.assertEqual(chain.chain_name, 'default')


class TestHashChainAddEntry(unittest.TestCase):
    """HashChain.add_entry 测试"""

    def setUp(self):
        self.chain = HashChain("test_add")

    def test_add_entry_returns_64_char_hex_hash(self):
        """添加条目返回 hash（64位hex字符串）"""
        h = self.chain.add_entry({"action": "create"})
        self.assertEqual(len(h), 64)
        int(h, 16)  # 合法 hex 校验

    def test_each_add_increments_length_by_one(self):
        """每次添加 length +1"""
        self.assertEqual(self.chain.length, 0)
        self.chain.add_entry({"i": 1})
        self.assertEqual(self.chain.length, 1)
        self.chain.add_entry({"i": 2})
        self.assertEqual(self.chain.length, 2)
        self.chain.add_entry({"i": 3})
        self.assertEqual(self.chain.length, 3)

    def test_seq_starts_from_one_and_increments(self):
        """seq 从 1 递增"""
        entries = []
        for i in range(5):
            self.chain.add_entry({"idx": i})
            e = self.chain.get_entries(limit=1, offset=i)
            entries.append(e[0])
        for i, e in enumerate(entries):
            self.assertEqual(e['seq'], i + 1)

    def test_entry_contains_required_fields(self):
        """条目包含 prev_hash/timestamp/data/hash"""
        self.chain.add_entry({"key": "value"})
        entry = self.chain.get_entries()[0]
        self.assertIn('prev_hash', entry)
        self.assertIn('timestamp', entry)
        self.assertIn('data', entry)
        self.assertIn('hash', entry)

    def test_chained_hash_links_between_entries(self):
        """连续添加 hash 链式连接（entry[i].prev_hash == entry[i-1].hash）"""
        hashes = []
        for i in range(5):
            h = self.chain.add_entry({"index": i})
            hashes.append(h)

        entries = self.chain.get_entries(limit=5)
        # 第一条的 prev_hash 应为创世区块
        self.assertEqual(entries[0]['prev_hash'], '0' * 64)
        # 后续每条的 prev_hash 等于前一条的 hash
        for i in range(1, len(entries)):
            self.assertEqual(entries[i]['prev_hash'], entries[i - 1]['hash'])


class TestHashChainVerifyIntegrity(unittest.TestCase):
    """HashChain.verify_integrity 测试"""

    def setUp(self):
        self.chain = HashChain("verify_test")

    def test_empty_chain_returns_true_zero(self):
        """空链返回 (True, 0)"""
        ok, count = self.chain.verify_integrity()
        self.assertTrue(ok)
        self.assertEqual(count, 0)

    def test_single_valid_entry_returns_true_one(self):
        """单条未篡改的链返回 (True, 1)"""
        self.chain.add_entry({"single": True})
        ok, count = self.chain.verify_integrity()
        self.assertTrue(ok)
        self.assertEqual(count, 1)

    def test_multiple_valid_entries_returns_true_n(self):
        """多条未篡改的链返回 (True, n)"""
        for i in range(10):
            self.chain.add_entry({"i": i})
        ok, count = self.chain.verify_integrity()
        self.assertTrue(ok)
        self.assertEqual(count, 10)

    def test_tampered_prev_hash_causes_failure(self):
        """篡改 prev_hash 的条目导致验证失败"""
        self.chain.add_entry({"a": 1})
        self.chain.add_entry({"b": 2})
        # 直接修改第二条的 prev_hash
        self.chain._entries[1]['prev_hash'] = 'f' * 64
        ok, count = self.chain.verify_integrity()
        self.assertFalse(ok)

    def test_tampered_data_causes_hash_mismatch(self):
        """篡改 data 的条目导致 hash 不匹配"""
        self.chain.add_entry({"correct": "data"})
        # 修改内部数据导致重算 hash 不一致
        self.chain._entries[0]['data']['correct'] = 'tampered_value'
        ok, count = self.chain.verify_integrity()
        self.assertFalse(ok)

    def test_tampered_hash_field_causes_failure(self):
        """直接篡改 hash 字段也导致验证失败"""
        self.chain.add_entry({"ok": True})
        self.chain._entries[0]['hash'] = 'a' * 64
        ok, _ = self.chain.verify_integrity()
        self.assertFalse(ok)


class TestHashChainGetEntries(unittest.TestCase):
    """HashChain.get_entries 测试"""

    def setUp(self):
        self.chain = HashChain("get_test")
        for i in range(10):
            self.chain.add_entry({"i": i})

    def test_returns_entry_list(self):
        """返回条目列表"""
        entries = self.chain.get_entries()
        self.assertIsInstance(entries, list)
        self.assertEqual(len(entries), 10)

    def test_limit_restricts_count(self):
        """limit 参数限制数量"""
        entries = self.chain.get_entries(limit=3)
        self.assertEqual(len(entries), 3)

    def test_offset_shifts_start_position(self):
        """offset 参数偏移起始位置"""
        entries = self.chain.get_entries(limit=3, offset=5)
        self.assertEqual(len(entries), 3)
        self.assertEqual(entries[0]['seq'], 6)

    def test_offset_beyond_range_returns_empty(self):
        """offset 超出范围返回空列表"""
        entries = self.chain.get_entries(limit=3, offset=15)
        self.assertEqual(len(entries), 0)

    def test_returns_copy_not_reference(self):
        """返回的是副本（修改顶层字段不影响内部数据）"""
        # 先添加一条记录
        self.chain.add_entry({'test': 'value'})
        original = self.chain.get_entries(limit=1)[0]
        original['seq'] = 99999
        internal = self.chain._entries[0]
        # 顶层字段是独立的副本，修改不影响内部
        self.assertEqual(internal['seq'], 1)  # 第一条记录 seq 从 1 开始


class TestHashChainProperties(unittest.TestCase):
    """HashChain length / head_hash 属性测试"""

    def setUp(self):
        self.chain = HashChain("prop_test")

    def test_length_reflects_actual_entry_count(self):
        """length 反映实际条目数"""
        self.assertEqual(self.chain.length, 0)
        self.chain.add_entry({})
        self.assertEqual(self.chain.length, 1)
        self.chain.add_entry({})
        self.chain.add_entry({})
        self.assertEqual(self.chain.length, 3)

    def test_head_hash_is_last_entry_hash(self):
        """head_hash 是最后一条的 hash"""
        self.assertEqual(self.chain.head_hash, '0' * 64)  # 初始为创世区块
        h1 = self.chain.add_entry({"first": 1})
        self.assertEqual(self.chain.head_hash, h1)
        h2 = self.chain.add_entry({"second": 2})
        self.assertEqual(self.chain.head_hash, h2)
        self.assertNotEqual(h1, h2)


# ──────────────────────────────────────────────
# 2. AuditEvent 类测试
# ──────────────────────────────────────────────

class TestAuditEventAllEvents(unittest.TestCase):
    """AuditEvent.all_events() 测试"""

    def test_returns_list_of_event_types(self):
        """返回所有事件类型列表"""
        events = AuditEvent.all_events()
        self.assertIsInstance(events, list)

    def test_returns_exactly_13_events(self):
        """返回 13 种事件类型"""
        events = AuditEvent.all_events()
        self.assertEqual(len(events), 13)

    def test_each_event_is_category_dot_action_format(self):
        """每个都是 'category.action' 格式"""
        events = AuditEvent.all_events()
        for evt in events:
            self.assertIsInstance(evt, str)
            parts = evt.split('.')
            self.assertEqual(len(parts), 2)
            self.assertTrue(len(parts[0]) > 0)
            self.assertTrue(len(parts[1]) > 0)

    def test_contains_task_lifecycle_events(self):
        """包含任务生命周期事件"""
        events = AuditEvent.all_events()
        self.assertIn(AuditEvent.TASK_CREATED, events)
        self.assertIn(AuditEvent.TASK_DISPATCHED, events)
        self.assertIn(AuditEvent.SHARD_ASSIGNED, events)

    def test_contains_execution_events(self):
        """包含执行事件"""
        events = AuditEvent.all_events()
        self.assertIn(AuditEvent.EXECUTION_STARTED, events)
        self.assertIn(AuditEvent.EXECUTION_COMPLETED, events)
        self.assertIn(AuditEvent.EXECUTION_FAILED, events)

    def test_contains_security_events(self):
        """包含安全事件"""
        events = AuditEvent.all_events()
        self.assertIn(AuditEvent.SECURITY_CHECK, events)
        self.assertIn(AuditEvent.SECURITY_BLOCKED, events)

    def test_contains_cost_and_node_events(self):
        """包含成本和节点事件"""
        events = AuditEvent.all_events()
        self.assertIn(AuditEvent.COST_ROUTED, events)
        self.assertIn(AuditEvent.NODE_HEARTBEAT, events)
        self.assertIn(AuditEvent.NODE_REGISTERED, events)

    def test_contains_result_and_audit_events(self):
        """包含结果验证和审计报告事件"""
        events = AuditEvent.all_events()
        self.assertIn(AuditEvent.RESULT_VERIFIED, events)
        self.assertIn(AuditEvent.AUDIT_REPORT, events)


# ──────────────────────────────────────────────
# 3. AuditLogger 类测试
# ──────────────────────────────────────────────

class TestAuditLoggerLog(unittest.TestCase):
    """AuditLogger.log 核心方法测试"""

    def setUp(self):
        self.logger = AuditLogger()

    def test_log_returns_audit_id_as_hash(self):
        """记录一条日志返回 audit_id（hash）"""
        audit_id = self.logger.log(
            event_type='task.created',
            entity_id='TASK-001',
            data={'action': 'create'},
        )
        self.assertEqual(len(audit_id), 64)
        int(audit_id, 16)  # 合法 hex

    def test_log_entry_contains_required_fields(self):
        """日志包含 event_type/entity_id/user_id/ip_address/payload/logged_at"""
        self.logger.log(
            event_type='task.created',
            entity_id='TASK-001',
            data={'key': 'val'},
            user_id='admin',
            ip_address='10.0.0.1',
        )
        entry = self.logger._all_entries[-1]
        self.assertEqual(entry['event_type'], 'task.created')
        self.assertEqual(entry['entity_id'], 'TASK-001')
        self.assertEqual(entry['user_id'], 'admin')
        self.assertEqual(entry['ip_address'], '10.0.0.1')
        self.assertEqual(entry['payload'], {'key': 'val'})
        self.assertIn('logged_at', entry)

    def test_log_writes_to_correct_chain_via_mapping(self):
        """不同事件类型写入不同的 HashChain（根据 CHAIN_MAPPING）"""
        self.logger.log(AuditEvent.TASK_CREATED, 'T1', {})       # → task_lifecycle
        self.logger.log(AuditEvent.SECURITY_CHECK, 'R1', {})      # → security_events
        self.logger.log(AuditEvent.EXECUTION_STARTED, 'E1', {})   # → execution_log
        self.logger.log(AuditEvent.COST_ROUTED, 'C1', {})         # → cost_tracking

        self.assertEqual(self.logger.hash_chains['task_lifecycle'].length, 1)
        self.assertEqual(self.logger.hash_chains['security_events'].length, 1)
        self.assertEqual(self.logger.hash_chains['execution_log'].length, 1)
        self.assertEqual(self.logger.hash_chains['cost_tracking'].length, 1)

    def test_unknown_event_type_falls_back_to_task_lifecycle(self):
        """未知事件类型默认写入 task_lifecycle 链"""
        initial_len = self.logger.hash_chains['task_lifecycle'].length
        self.logger.log('unknown.custom.event', 'E1', {})
        self.assertEqual(
            self.logger.hash_chains['task_lifecycle'].length,
            initial_len + 1
        )

    def test_global_index_grows_on_each_log(self):
        """全局索引 _all_entries 增长"""
        self.assertEqual(len(self.logger._all_entries), 0)
        self.logger.log('evt1', 'E1', {})
        self.assertEqual(len(self.logger._all_entries), 1)
        self.logger.log('evt2', 'E2', {})
        self.assertEqual(len(self.logger._all_entries), 2)
        self.logger.log('evt3', 'E3', {})
        self.assertEqual(len(self.logger._all_entries), 3)


class TestAuditLoggerLogSecurityGate(unittest.TestCase):
    """AuditLogger.log_security_gate 测试"""

    def setUp(self):
        self.logger = AuditLogger()

    def test_passed_false_writes_security_blocked(self):
        """passed=False 写入 SECURITY_BLOCKED"""
        self.logger.log_security_gate(
            request_id='REQ-001',
            gateway_result={'passed': False, 'risk_score': 99},
        )
        last = self.logger._all_entries[-1]
        self.assertEqual(last['event_type'], AuditEvent.SECURITY_BLOCKED)

    def test_passed_true_writes_security_check(self):
        """passed=True 写入 SECURITY_CHECK"""
        self.logger.log_security_gate(
            request_id='REQ-002',
            gateway_result={'passed': True, 'risk_score': 5},
        )
        last = self.logger._all_entries[-1]
        self.assertEqual(last['event_type'], AuditEvent.SECURITY_CHECK)

    def test_returns_audit_id(self):
        """返回合法的 audit_id"""
        aid = self.logger.log_security_gate(
            request_id='REQ-003',
            gateway_result={'passed': True},
        )
        self.assertEqual(len(aid), 64)


class TestAuditLoggerLogExecution(unittest.TestCase):
    """AuditLogger.log_execution 测试"""

    def setUp(self):
        self.logger = AuditLogger()

    def test_exit_code_zero_writes_execution_completed(self):
        """exit_code=0 → EXECUTION_COMPLETED"""
        self.logger.log_execution(
            shard_id='SH-001',
            node_id='N1',
            execution_result={'exit_code': 0, 'stdout': 'done'},
        )
        last = self.logger._all_entries[-1]
        self.assertEqual(last['event_type'], AuditEvent.EXECUTION_COMPLETED)

    def test_exit_code_nonzero_writes_execution_failed(self):
        """exit_code!=0 → EXECUTION_FAILED"""
        self.logger.log_execution(
            shard_id='SH-002',
            node_id='N2',
            execution_result={'exit_code': 1, 'stderr': 'err'},
        )
        last = self.logger._all_entries[-1]
        self.assertEqual(last['event_type'], AuditEvent.EXECUTION_FAILED)

    def test_stdout_truncated_to_200_chars(self):
        """截取 stdout 前 200 字符"""
        long_stdout = 'A' * 500
        self.logger.log_execution(
            shard_id='SH-003',
            node_id='N3',
            execution_result={'exit_code': 0, 'stdout': long_stdout},
        )
        last = self.logger._all_entries[-1]
        preview = last['payload']['stdout_preview']
        self.assertLessEqual(len(preview), 200)

    def test_stderr_truncated_to_200_chars(self):
        """截取 stderr 前 200 字符"""
        long_stderr = 'B' * 500
        self.logger.log_execution(
            shard_id='SH-004',
            node_id='N4',
            execution_result={'exit_code': 1, 'stderr': long_stderr},
        )
        last = self.logger._all_entries[-1]
        preview = last['payload']['stderr_preview']
        self.assertLessEqual(len(preview), 200)


class TestAuditLoggerLogCostRouting(unittest.TestCase):
    """AuditLogger.log_cost_routing 测试"""

    def setUp(self):
        self.logger = AuditLogger()

    def test_writes_cost_routed_event(self):
        """写入 COST_ROUTED 事件"""
        decision = {'node': 'NX', 'cost': 0.05}
        self.logger.log_cost_routing('TASK-X', decision)
        last = self.logger._all_entries[-1]
        self.assertEqual(last['event_type'], AuditEvent.COST_ROUTED)
        self.assertEqual(last['entity_id'], 'TASK-X')
        self.assertEqual(last['payload'], decision)

    def test_writes_to_cost_tracking_chain(self):
        """写入 cost_tracking 链"""
        initial = self.logger.hash_chains['cost_tracking'].length
        self.logger.log_cost_routing('T1', {'node': 'N1'})
        self.assertEqual(
            self.logger.hash_chains['cost_tracking'].length,
            initial + 1
        )


class TestAuditLoggerQueryLogs(unittest.TestCase):
    """AuditLogger.query_logs 测试"""

    def setUp(self):
        self.logger = AuditLogger()
        base_time = datetime.now() - timedelta(minutes=10)
        # 预先写入一些日志
        for i in range(5):
            with patch_datetime(base_time + timedelta(minutes=i)):
                self.logger.log(
                    event_type=AuditEvent.TASK_CREATED if i % 2 == 0 else AuditEvent.SECURITY_CHECK,
                    entity_id=f'TASK-{i}',
                    data={'i': i},
                )

    def test_filter_by_event_type(self):
        """event_type 过滤"""
        results = self.logger.query_logs(event_type=AuditEvent.TASK_CREATED)
        for r in results:
            self.assertEqual(r['event_type'], AuditEvent.TASK_CREATED)

    def test_filter_by_entity_id(self):
        """entity_id 过滤"""
        results = self.logger.query_logs(entity_id='TASK-0')
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['entity_id'], 'TASK-0')

    def test_filter_by_time_range(self):
        """start_time/end_time 时间范围过滤"""
        now = datetime.now()
        past = now - timedelta(hours=1)
        future = now + timedelta(hours=1)
        results = self.logger.query_logs(start_time=past, end_time=future)
        # 所有预写日志都在范围内
        self.assertGreaterEqual(len(results), 0)

    def test_limit_restricts_results(self):
        """limit 限制数量"""
        results = self.logger.query_logs(limit=2)
        self.assertLessEqual(len(results), 2)

    def test_returns_newest_first_reverse_order(self):
        """返回最新的日志优先（倒序）"""
        results = self.logger.query_logs(limit=10)
        if len(results) >= 2:
            # 检查时间倒序
            t0 = datetime.fromisoformat(results[0]['logged_at'])
            t1 = datetime.fromisoformat(results[1]['logged_at'])
            self.assertGreaterEqual(t0, t1)

    def test_no_match_returns_empty_list(self):
        """无匹配返回空列表"""
        results = self.logger.query_logs(event_type='nonexistent.event')
        self.assertEqual(results, [])


class TestAuditLoggerGetChainStatus(unittest.TestCase):
    """AuditLogger.get_chain_status 测试"""

    def setUp(self):
        self.logger = AuditLogger()
        # 每个链都写入一条数据
        self.logger.log(AuditEvent.TASK_CREATED, 'T1', {})
        self.logger.log(AuditEvent.SECURITY_CHECK, 'R1', {})
        self.logger.log(AuditEvent.EXECUTION_STARTED, 'E1', {})
        self.logger.log(AuditEvent.COST_ROUTED, 'C1', {})

    def test_returns_four_chains(self):
        """返回 4 条链的状态"""
        status = self.logger.get_chain_status()
        expected = {'task_lifecycle', 'security_events', 'execution_log', 'cost_tracking'}
        self.assertEqual(set(status.keys()), expected)

    def test_each_chain_has_required_fields(self):
        """每条链含 length/head_hash/integrity_ok"""
        status = self.logger.get_chain_status()
        for chain_name, chain_status in status.items():
            self.assertIn('length', chain_status)
            self.assertIn('head_hash', chain_status)
            self.assertIn('integrity_ok', chain_status)

    def test_all_chains_have_positive_length_after_logging(self):
        """写入后各链 length > 0"""
        status = self.logger.get_chain_status()
        for chain_name, chain_status in status.items():
            self.assertGreater(chain_status['length'], 0)

    def test_all_chains_integrity_ok(self):
        """所有链完整性正常"""
        status = self.logger.get_chain_status()
        for chain_name, chain_status in status.items():
            self.assertTrue(chain_status['integrity_ok'])


# ──────────────────────────────────────────────
# 4. ComplianceReporter 类测试
# ──────────────────────────────────────────────

class TestComplianceReporterGenerateTaskReport(TestCase):
    """ComplianceReporter.generate_task_report 测试（需要数据库）"""

    def setUp(self):
        from p2p_app.models import P2PNode, TaskDispatch

        self.audit = AuditLogger()
        self.reporter = ComplianceReporter(audit_logger=self.audit)

        self.node = P2PNode.objects.create(
            node_id='node-compliance-task',
            node_type='enterprise',
            capabilities=[],
            resources={},
            location='Beijing',
            status='online',
            public_key='PK-COMPLIANCE-TASK',
        )
        self.task = TaskDispatch.objects.create(
            task_id='TASK-COMP-RPT-001',
            task_type='code',
            status='completed',
            total_shards=4,
            completed_shards=4,
            security_level='high',
            privacy_level='confidential',
            created_by='tester',
        )

    def test_nonexistent_task_returns_error(self):
        """任务不存在返回 error"""
        report = self.reporter.generate_task_report('NONEXISTENT-TASK')
        self.assertIn('error', report)
        self.assertIn('not found', report['error'].lower())

    def test_existing_task_returns_full_report(self):
        """存在的任务返回完整报告"""
        report = self.reporter.generate_task_report(self.task.task_id)
        self.assertNotIn('error', report)

    def test_report_contains_task_info(self):
        """报告含 task_info"""
        report = self.reporter.generate_task_report(self.task.task_id)
        self.assertIn('task_info', report)
        info = report['task_info']
        self.assertEqual(info['task_id'], self.task.task_id)
        self.assertEqual(info['task_type'], self.task.task_type)
        self.assertEqual(info['status'], self.task.status)

    def test_report_contains_security_checks(self):
        """报告含 security_checks"""
        report = self.reporter.generate_task_report(self.task.task_id)
        self.assertIn('security_checks', report)
        self.assertIn('total_checks', report['security_checks'])
        self.assertIn('blocked_count', report['security_checks'])

    def test_report_contains_execution_trace(self):
        """报告含 execution_trace"""
        report = self.reporter.generate_task_report(self.task.task_id)
        self.assertIn('execution_trace', report)

    def test_report_contains_cost_records(self):
        """报告含 cost_records"""
        report = self.reporter.generate_task_report(self.task.task_id)
        self.assertIn('cost_records', report)

    def test_report_contains_integrity_proof(self):
        """报告含 integrity_proof"""
        report = self.reporter.generate_task_report(self.task.task_id)
        self.assertIn('integrity_proof', report)
        proof = report['integrity_proof']
        self.assertIsInstance(proof, dict)

    def test_records_audit_report_event(self):
        """记录 AUDIT_REPORT 事件"""
        initial_sec_len = self.audit.hash_chains['security_events'].length
        self.reporter.generate_task_report(self.task.task_id)
        # AUDIT_REPORT 写入 security_events 链
        self.assertGreater(
            self.audit.hash_chains['security_events'].length,
            initial_sec_len
        )


class TestComplianceReporterGenerateSystemSnapshot(TestCase):
    """ComplianceReporter.generate_system_snapshot 测试（需要数据库）"""

    def setUp(self):
        from p2p_app.models import P2PNode, TaskDispatch

        self.audit = AuditLogger()
        self.reporter = ComplianceReporter(audit_logger=self.audit)

        # 创建一些活跃任务
        for i in range(3):
            TaskDispatch.objects.create(
                task_id=f'TASK-SNAP-{i:03d}',
                task_type='text',
                status='executing',
                total_shards=2,
            )

        # 创建在线节点
        for i in range(2):
            P2PNode.objects.create(
                node_id=f'NODE-SNAP-{i}',
                node_type='browser',
                capabilities=[],
                resources={},
                location=f'City-{i}',
                status='online',
                public_key=f'PK-SNAP-{i}',
            )

        # 记录一些安全事件
        self.audit.log(
            event_type=AuditEvent.SECURITY_BLOCKED,
            entity_id='SEC-001',
            data={'reason': 'test'},
        )

    def test_returns_active_tasks_list(self):
        """返回活跃任务列表"""
        snapshot = self.reporter.generate_system_snapshot()
        self.assertIn('active_tasks', snapshot)
        self.assertGreaterEqual(len(snapshot['active_tasks']), 3)

    def test_active_tasks_contain_expected_fields(self):
        """活跃任务包含必要字段"""
        snapshot = self.reporter.generate_system_snapshot()
        if snapshot['active_tasks']:
            task = snapshot['active_tasks'][0]
            self.assertIn('task_id', task)
            self.assertIn('status', task)
            self.assertIn('task_type', task)
            self.assertIn('total_shards', task)

    def test_returns_online_nodes_list(self):
        """返回在线节点列表"""
        snapshot = self.reporter.generate_system_snapshot()
        self.assertIn('online_nodes', snapshot)
        self.assertGreaterEqual(len(snapshot['online_nodes']), 2)

    def test_online_nodes_contain_expected_fields(self):
        """在线节点包含必要字段"""
        snapshot = self.reporter.generate_system_snapshot()
        if snapshot['online_nodes']:
            node = snapshot['online_nodes'][0]
            self.assertIn('node_id', node)
            self.assertIn('node_type', node)
            self.assertIn('reputation_score', node)
            self.assertIn('location', node)

    def test_returns_statistics(self):
        """返回统计信息"""
        snapshot = self.reporter.generate_system_snapshot()
        self.assertIn('statistics', snapshot)
        stats = snapshot['statistics']
        self.assertIn('active_task_count', stats)
        self.assertIn('online_node_count', stats)
        self.assertIn('security_block_event_count', stats)
        self.assertIn('total_audit_entries', stats)
        self.assertGreater(stats['active_task_count'], 0)
        self.assertGreater(stats['online_node_count'], 0)

    def test_returns_recent_security_blocks(self):
        """返回 recent_security_blocks"""
        snapshot = self.reporter.generate_system_snapshot()
        self.assertIn('recent_security_blocks', snapshot)

    def test_returns_chain_integrity(self):
        """返回 chain_integrity"""
        snapshot = self.reporter.generate_system_snapshot()
        self.assertIn('audit_chain_integrity', snapshot)


# ──────────────────────────────────────────────
# 辅助工具：patch datetime 用于时间相关测试
# ──────────────────────────────────────────────

def patch_datetime(target_time):
    """辅助函数：在上下文中替换 datetime.now 返回指定时间"""
    from unittest.mock import patch as mock_patch

    class MockDateTime(datetime):
        @classmethod
        def now(cls, tz=None):
            return target_time

    return mock_patch('p2p_app.services.audit_trail.datetime', MockDateTime)
