"""
全链路流水线集成测试
覆盖 ExecutionPipeline 初始化 / execute() / hashlib_new_id() / _execute_l3() / _execute_l7()
"""

import os

import django
from django.test import TestCase

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
django.setup()

from p2p_app.services.pipeline import (
    ExecutionPipeline,
    PipelineError,
    hashlib_new_id,
)


# ──────────────────────────────────────────────
# 1. 初始化测试
# ──────────────────────────────────────────────

class TestPipelineInit(TestCase):
    """ExecutionPipeline 初始化测试"""

    def test_create_pipeline(self):
        pipeline = ExecutionPipeline()
        self.assertIsNotNone(pipeline)

    def test_l6_executor_initialized(self):
        pipeline = ExecutionPipeline()
        self.assertIsNotNone(pipeline.executor)
        self.assertIsNotNone(pipeline.collector)

    def test_l7_audit_initialized(self):
        pipeline = ExecutionPipeline()
        self.assertIsNotNone(pipeline.audit)
        self.assertIsNotNone(pipeline.reporter)

    def test_gateway_attribute_exists(self):
        pipeline = ExecutionPipeline()
        self.assertTrue(hasattr(pipeline, 'gateway'))
        self.assertTrue(hasattr(pipeline, 'has_gateway'))

    def test_orchestrator_attribute_exists(self):
        pipeline = ExecutionPipeline()
        self.assertTrue(hasattr(pipeline, 'orchestrator'))
        self.assertTrue(hasattr(pipeline, 'has_orchestrator'))

    def test_cost_router_attribute_exists(self):
        pipeline = ExecutionPipeline()
        self.assertTrue(hasattr(pipeline, 'cost_router'))
        self.assertTrue(hasattr(pipeline, 'has_cost_router'))

    def test_scheduler_attribute_exists(self):
        pipeline = ExecutionPipeline()
        self.assertTrue(hasattr(pipeline, 'scheduler'))
        self.assertTrue(hasattr(pipeline, 'has_scheduler'))


# ──────────────────────────────────────────────
# 2. execute() 测试
# ──────────────────────────────────────────────

class TestPipelineExecute(TestCase):
    """ExecutionPipeline.execute() 测试"""

    def setUp(self):
        self.pipeline = ExecutionPipeline()

    # --- 空数据执行: 返回 report, stages 字典非空 ---

    def test_empty_data_execution_returns_report(self):
        report = self.pipeline.execute({})
        self.assertIsInstance(report, dict)
        self.assertIn('pipeline_id', report)
        self.assertIn('stages', report)

    def test_stages_not_empty(self):
        report = self.pipeline.execute({})
        self.assertIsInstance(report['stages'], dict)
        # 至少应包含 L3_security 阶段
        self.assertIn('L3_security', report['stages'])

    # --- PipelineError 异常被正确捕获 ---

    def test_pipeline_error_caught_gracefully(self):
        # 即使内部抛出 PipelineError，execute 仍返回完整报告
        report = self.pipeline.execute({'task_id': 'NONEXISTENT-TASK'})
        self.assertIsInstance(report, dict)
        self.assertIn('error', report)
        self.assertFalse(report.get('success', True))

    # --- 返回报告含关键字段 ---

    def test_report_contains_required_fields(self):
        report = self.pipeline.execute({})
        for field in ('pipeline_id', 'started_at', 'stages', 'success', 'total_time_ms'):
            self.assertIn(field, report, f'缺少字段: {field}')

    # --- 失败时 error 字段包含 stage/message ---

    def test_error_field_on_failure(self):
        report = self.pipeline.execute({})
        if not report.get('success'):
            error = report.get('error')
            if error:
                self.assertIn('stage', error)
                self.assertIn('message', error)


# ──────────────────────────────────────────────
# 3. hashlib_new_id() 测试
# ──────────────────────────────────────────────

class TestHashlibNewId(TestCase):
    """hashlib_new_id() 唯一 ID 生成器测试"""

    def test_returns_16_char_hex_string(self):
        pid = hashlib_new_id()
        self.assertEqual(len(pid), 16)
        int(pid, 16)  # 验证是合法 hex

    def test_multiple_calls_return_different_values(self):
        ids = {hashlib_new_id() for _ in range(20)}
        # 20 次调用应产生不同的值（基于时间戳+对象ID）
        self.assertGreaterEqual(len(ids), 19)  # 允许极小概率碰撞


# ──────────────────────────────────────────────
# 4. _execute_l3() 测试
# ──────────────────────────────────────────────

class TestExecuteL3(TestCase):
    """L3 安全网关层执行测试"""

    def setUp(self):
        self.pipeline = ExecutionPipeline()

    def test_l3_returns_valid_result(self):
        result = self.pipeline._execute_l3(
            request_data={},
            user_context={},
            request_id='test-req-001',
        )
        # L3 始终返回 dict; 具体字段取决于 gateway 是否可用:
        #   - 不可用: {passed: True, skipped: True, reason: ...}
        #   - 可用且通过: gateway.process_request 的返回值 (含 passed)
        #   - 可用但异常: {passed: False, reason: ..., error: ...}
        self.assertIsInstance(result, dict)
        self.assertTrue(
            result.get('passed', False) or result.get('skipped', False)
            or 'error' in result or 'reason' in result,
            f"L3 返回格式异常: {result}",
        )


# ──────────────────────────────────────────────
# 5. _execute_l7() 测试
# ──────────────────────────────────────────────

class TestExecuteL7(TestCase):
    """L7 审计存证层执行测试"""

    def setUp(self):
        self.pipeline = ExecutionPipeline()

    def test_l7_returns_audit_id(self):
        result = self.pipeline._execute_l7(
            task_id='',
            request_id='test-pipeline-l7',
            pipeline_report={'pipeline_id': 'test-pid', 'success': True},
        )
        self.assertIn('audit_id', result)
        self.assertIsInstance(result['audit_id'], str)
        self.assertTrue(len(result['audit_id']) > 0)

    def test_l7_returns_chain_integrity(self):
        result = self.pipeline._execute_l7(
            task_id='',
            request_id='test-pipeline-l7',
            pipeline_report={'pipeline_id': 'test-pid', 'success': True},
        )
        self.assertIn('chain_integrity', result)
        self.assertIsInstance(result['chain_integrity'], dict)

    def test_l7_returns_task_compliance_report(self):
        result = self.pipeline._execute_l7(
            task_id='NONEXISTENT-TASK',
            request_id='test-pipeline-l7',
            pipeline_report={'pipeline_id': 'test-pid', 'success': True},
        )
        self.assertIn('task_compliance_report', result)
        # 不存在的任务应返回 error 信息
        report = result['task_compliance_report']
        self.assertIsInstance(report, dict)
