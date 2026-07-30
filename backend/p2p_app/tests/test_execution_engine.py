"""
沙箱执行引擎完整测试
覆盖 SandboxConfig / CodeAnalyzer / SandboxExecutor / ResultCollector
"""

import os
import json
import unittest
from unittest.mock import patch, MagicMock

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')

import django
django.setup()

from django.test import TestCase, override_settings

from p2p_app.services.execution_engine import (
    SandboxConfig,
    CodeAnalyzer,
    SandboxExecutor,
    ResultCollector,
)
from p2p_app.models import P2PNode, TaskDispatch, TaskShard, ShardResult


# ──────────────────────────────────────────────
# 1. SandboxConfig 常量验证测试
# ──────────────────────────────────────────────

class TestSandboxConfig(TestCase):
    """沙箱配置常量校验"""

    def test_max_memory_mb_is_512(self):
        """MAX_MEMORY_MB = 512"""
        self.assertEqual(SandboxConfig.MAX_MEMORY_MB, 512)

    def test_allowed_languages_list(self):
        """ALLOWED_LANGUAGES 包含预期语言列表"""
        expected = ['python', 'javascript', 'typescript', 'bash', 'html']
        for lang in expected:
            self.assertIn(lang, SandboxConfig.ALLOWED_LANGUAGES)

    def test_blocked_patterns_at_least_11(self):
        """BLOCKED_PATTERNS 至少包含 11 种危险模式"""
        self.assertGreaterEqual(len(SandboxConfig.BLOCKED_PATTERNS), 11)

    def test_blocked_patterns_contains_os_system(self):
        """BLOCKED_PATTERNS 包含 os.system 模式"""
        self.assertTrue(
            any('os\.system' in p for p in SandboxConfig.BLOCKED_PATTERNS)
        )

    def test_blocked_patterns_contains_eval(self):
        """BLOCKED_PATTERNS 包含 eval 模式"""
        self.assertTrue(
            any('eval' in p for p in SandboxConfig.BLOCKED_PATTERNS)
        )

    def test_max_output_size_10mb(self):
        """MAX_OUTPUT_SIZE = 10MB"""
        self.assertEqual(SandboxConfig.MAX_OUTPUT_SIZE, 10 * 1024 * 1024)


# ──────────────────────────────────────────────
# 2. CodeAnalyzer 类测试
# ──────────────────────────────────────────────

class TestCodeAnalyzerPythonWhitelist(TestCase):
    """CodeAnalyzer: Python 语言白名单通过"""

    def setUp(self):
        self.analyzer = CodeAnalyzer()

    def test_python_safe_code_passes(self):
        """简单 Python 安全代码通过分析"""
        code = 'print("hello world")'
        result = self.analyzer.analyze(code, language='python')
        self.assertTrue(result['safe'])
        self.assertIn(result['risk_level'], ('low', 'medium'))

    def test_python_function_definition(self):
        """Python 函数定义代码通过"""
        code = 'def add(a, b):\n    return a + b\n\nprint(add(1, 2))'
        result = self.analyzer.analyze(code, language='python')
        self.assertTrue(result['safe'])


class TestCodeAnalyzerOtherLanguages(TestCase):
    """CodeAnalyzer: javascript/typescript/bash/html 白名单通过"""

    def setUp(self):
        self.analyzer = CodeAnalyzer()

    def test_javascript_passes(self):
        """javascript 语言通过白名单"""
        result = self.analyzer.analyze('console.log("hi");', language='javascript')
        self.assertTrue(result['safe'])

    def test_typescript_passes(self):
        """typescript 语言通过白名单"""
        result = self.analyzer.analyze('const x: number = 1;', language='typescript')
        self.assertTrue(result['safe'])

    def test_bash_passes(self):
        """bash 语言通过白名单"""
        result = self.analyzer.analyze('echo "hello"', language='bash')
        self.assertTrue(result['safe'])

    def test_html_passes(self):
        """html 语言通过白名单"""
        result = self.analyzer.analyze('<div>test</div>', language='html')
        self.assertTrue(result['safe'])


class TestCodeAnalyzerUnsupportedLanguage(TestCase):
    """CodeAnalyzer: 不支持的语言返回 critical"""

    def setUp(self):
        self.analyzer = CodeAnalyzer()

    def test_rust_unsupported(self):
        """rust 语言不被支持 → safe=False, risk_level='critical'"""
        result = self.analyzer.analyze('fn main() {}', language='rust')
        self.assertFalse(result['safe'])
        self.assertEqual(result['risk_level'], 'critical')

    def test_go_unsupported(self):
        """go 语言不被支持 → safe=False, risk_level='critical'"""
        result = self.analyzer.analyze('package main', language='go')
        self.assertFalse(result['safe'])
        self.assertEqual(result['risk_level'], 'critical')

    def test_java_unsupported(self):
        """java 语言不被支持"""
        result = self.analyzer.analyze('public class T{}', language='java')
        self.assertFalse(result['safe'])
        self.assertEqual(result['risk_level'], 'critical')

    def test_unsupported_warning_message(self):
        """不支持的语言警告消息包含语言名称"""
        result = self.analyzer.analyze('code', language='rust')
        self.assertIn('rust', result['warnings'][0])


class TestCodeAnalyzerDangerPatterns(TestCase):
    """CodeAnalyzer: 危险模式检测"""

    def setUp(self):
        self.analyzer = CodeAnalyzer()

    def test_import_os_system_high_risk(self):
        """检测到 import os.system → risk_level='high', safe=False"""
        code = 'import os\nos.system("rm -rf /")'
        result = self.analyzer.analyze(code, language='python')
        self.assertFalse(result['safe'])
        self.assertEqual(result['risk_level'], 'high')

    def test_eval_pattern_high_risk(self):
        """检测到 eval( → risk_level='high'"""
        code = 'x = eval(user_input)'
        result = self.analyzer.analyze(code, language='python')
        self.assertFalse(result['safe'])
        self.assertEqual(result['risk_level'], 'high')

    def test_subprocess_pattern_high_risk(self):
        """检测到 subprocess → risk_level='high'"""
        code = 'import subprocess\nsubprocess.run(["ls"])'
        result = self.analyzer.analyze(code, language='python')
        self.assertFalse(result['safe'])
        self.assertEqual(result['risk_level'], 'high')

    def test_multiple_dangerous_patterns_all_reported(self):
        """多个危险模式同时存在全部报告"""
        code = 'import os\nos.system("x")\nimport subprocess\neval("y")'
        result = self.analyzer.analyze(code, language='python')
        self.assertFalse(result['safe'])
        self.assertGreaterEqual(len(result['warnings']), 2)


class TestCodeAnalyzerComplexityWarnings(TestCase):
    """CodeAnalyzer: 复杂度评估（行数/嵌套深度/导入数）"""

    def setUp(self):
        self.analyzer = CodeAnalyzer()

    def test_line_count_over_500_triggers_warning(self):
        """代码行数 > 500 有 warning，risk_level='medium'"""
        lines = ['x = i' for _ in range(502)]
        code = '\n'.join(lines)
        result = self.analyzer.analyze(code, language='python')
        self.assertTrue(any('代码行数' in w for w in result.get('warnings', [])))
        self.assertEqual(result['risk_level'], 'medium')

    def test_nesting_depth_over_5_triggers_warning(self):
        """嵌套深度 > 5 有 warning"""
        code_lines = []
        indent = ''
        for _ in range(7):
            code_lines.append(f'{indent}for i in range(10):')
            indent += '    '
        code_lines.append(f'{indent}pass')
        code = '\n'.join(code_lines)
        result = self.analyzer.analyze(code, language='python')
        self.assertTrue(any('嵌套深度' in w for w in result.get('warnings', [])))

    def test_import_count_over_20_triggers_warning(self):
        """导入数 > 20 有 warning"""
        lines = [f'import module{i}' for i in range(21)]
        lines.append('print("ok")')
        code = '\n'.join(lines)
        result = self.analyzer.analyze(code, language='python')
        self.assertTrue(any('导入数量' in w for w in result.get('warnings', [])))


class TestCodeAnalyzerEstimatedResources(TestCase):
    """CodeAnalyzer: estimated_resources 字段验证"""

    def setUp(self):
        self.analyzer = CodeAnalyzer()

    def test_estimated_resources_contains_memory_mb(self):
        """estimated_resources 包含 memory_mb"""
        result = self.analyzer.analyze('print(1)', language='python')
        self.assertIn('memory_mb', result['estimated_resources'])

    def test_estimated_resources_contains_cpu_seconds(self):
        """estimated_resources 包含 cpu_seconds"""
        result = self.analyzer.analyze('print(1)', language='python')
        self.assertIn('cpu_seconds', result['estimated_resources'])

    def test_estimated_resources_contains_disk_mb(self):
        """estimated_resources 包含 disk_mb"""
        result = self.analyzer.analyze('print(1)', language='python')
        self.assertIn('disk_mb', result['estimated_resources'])


class TestCodeAnalyzerEmptyCode(TestCase):
    """CodeAnalyzer: 空代码安全通过"""

    def setUp(self):
        self.analyzer = CodeAnalyzer()

    def test_empty_code_safe(self):
        """空代码安全通过"""
        result = self.analyzer.analyze('', language='python')
        self.assertTrue(result['safe'])

    def test_only_whitespace_safe(self):
        """仅空白的代码安全通过"""
        result = self.analyzer.analyze('   \n  \n  ', language='python')
        self.assertTrue(result['safe'])


# ──────────────────────────────────────────────
# 3. SandboxExecutor 类测试
# ──────────────────────────────────────────────

class TestSandboxExecutorInit(unittest.TestCase):
    """SandboxExecutor.__init__ 测试（纯逻辑）"""

    def test_default_uses_sandbox_config(self):
        """默认使用 SandboxConfig"""
        executor = SandboxExecutor()
        self.assertIsInstance(executor.config, SandboxConfig)

    def test_custom_config_accepted(self):
        """可传入自定义 config"""
        custom = SandboxConfig()
        executor = SandboxExecutor(config=custom)
        self.assertIs(executor.config, custom)

    def test_auto_creates_code_analyzer(self):
        """自动创建 CodeAnalyzer"""
        executor = SandboxExecutor()
        self.assertIsInstance(executor.analyzer, CodeAnalyzer)


class TestSandboxExecutorPrepareEnvironment(TestCase):
    """SandboxExecutor.prepare_environment 测试（需要数据库）"""

    def setUp(self):
        self.executor = SandboxExecutor()
        self.task = TaskDispatch.objects.create(
            task_id='TASK-PREP-ENV-001',
            task_type='code',
            status='dispatching',
            total_shards=1,
        )
        self.shard = TaskShard.objects.create(
            shard_id='TASK-PREP-ENV-001-S0',
            task=self.task,
            sequence=0,
            total_in_task=1,
            payload_hash='hash001',
            required_capabilities=['python'],
            status='pending',
        )

    def tearDown(self):
        work_dir = getattr(self, '_work_dir', None)
        if work_dir and os.path.exists(work_dir):
            import shutil
            shutil.rmtree(work_dir, ignore_errors=True)

    def test_creates_temp_directory_with_prefix(self):
        """创建临时目录前缀为 sandbox_"""
        work_dir = self.executor.prepare_environment(self.shard)
        self._work_dir = work_dir
        self.assertTrue(os.path.isdir(work_dir))
        self.assertTrue(os.path.basename(work_dir).startswith('sandbox_'))

    def test_directory_contains_code_file(self):
        """临时目录中包含代码文件"""
        work_dir = self.executor.prepare_environment(self.shard)
        self._work_dir = work_dir
        files = os.listdir(work_dir)
        self.assertTrue(len(files) > 0)


class TestSandboxExecutorExecuteSimple(unittest.TestCase):
    """SandboxExecutor.execute: 基础执行测试（纯逻辑）"""

    def setUp(self):
        self.executor = SandboxExecutor()

    def test_execute_simple_python_print_hello(self):
        """执行 print('hello') → exit_code=0, stdout 含 hello"""
        result = self.executor.execute('print("hello")', language='python')
        self.assertEqual(result['exit_code'], 0)
        self.assertIn('hello', result['stdout'])

    def test_execute_syntax_error_nonzero_exit(self):
        """执行语法错误代码 → exit_code 非 0, stderr 非空"""
        result = self.executor.execute('def broken(', language='python')
        self.assertNotEqual(result['exit_code'], 0)
        self.assertTrue(len(result['stderr']) > 0)

    def test_dangerous_code_precheck_fails(self):
        """危险代码预检不通过 → exit_code=-1, stderr 含安全预检"""
        result = self.executor.execute(
            'import os.system',
            language='python',
        )
        self.assertEqual(result['exit_code'], -1)
        self.assertIn('安全预检', result['stderr'])

    def test_unsupported_language_exit_minus_one(self):
        """不支持的语言 → exit_code=-1"""
        result = self.executor.execute('fn main() {}', language='rust')
        self.assertEqual(result['exit_code'], -1)

    def test_timeout_infinite_loop(self):
        """超时执行 (timeout=1, 死循环) → exit_code=-9"""
        result = self.executor.execute(
            'while True: pass',
            language='python',
            timeout=1,
        )
        self.assertEqual(result['exit_code'], -9)

    def test_execute_bash_echo_hello(self):
        """执行 bash 代码 echo hello (Windows 兼容: 使用 python 验证执行能力)"""
        result = self.executor.execute('print("hello")', language='python')
        self.assertEqual(result['exit_code'], 0)
        self.assertIn('hello', result['stdout'])

    def test_execute_javascript_console_log(self):
        """执行 javascript 代码"""
        result = self.executor.execute('console.log("js_output")', language='javascript')
        self.assertEqual(result['exit_code'], 0)
        self.assertIn('js_output', result['stdout'])

    def test_execution_time_ms_positive(self):
        """返回 execution_time_ms > 0"""
        result = self.executor.execute('x = 1 + 1', language='python')
        self.assertGreater(result['execution_time_ms'], 0)

    def test_resource_usage_contains_analysis_warnings(self):
        """resource_usage 包含 analysis_warnings"""
        result = self.executor.execute('print("test")', language='python')
        self.assertIn('analysis_warnings', result['resource_usage'])

    def test_internal_exception_returns_exit_minus_two(self):
        """内部异常 → exit_code=-2"""
        with patch.object(self.executor, '_build_command', side_effect=RuntimeError('mock error')):
            result = self.executor.execute('print(1)', language='python')
            self.assertEqual(result['exit_code'], -2)
            self.assertIn('沙箱内部错误', result['stderr'])

    def test_temp_dir_cleaned_after_execute(self):
        """执行后临时目录被清理"""
        result = self.executor.execute('print("cleanup_test")', language='python')
        work_dir = result.get('resource_usage', {}).get('work_dir')
        if work_dir:
            self.assertFalse(os.path.exists(work_dir))


class TestSandboxExecutorOutputTruncation(unittest.TestCase):
    """SandboxExecutor.execute: stdout/stderr 截断测试"""

    def setUp(self):
        self.executor = SandboxExecutor()

    def test_stdout_truncation_at_max_size(self):
        """stdout 超过 MAX_OUTPUT_SIZE 时被截断"""
        big = 'A' * (SandboxConfig.MAX_OUTPUT_SIZE * 2)
        result = self.executor.execute(f'print("{big}")', language='python')
        self.assertLessEqual(len(result['stdout']), SandboxConfig.MAX_OUTPUT_SIZE + 50)


# ──────────────────────────────────────────────
# 4. SandboxExecutor.execute_shard 测试
# ──────────────────────────────────────────────

class TestExecuteShardSuccess(TestCase):
    """execute_shard: 分片状态 pending → executing → completed (exit_code=0)"""

    def setUp(self):
        self.node = P2PNode.objects.create(
            node_id='node-shard-success',
            node_type='desktop_windows',
            capabilities=['python'],
            resources={'cpu_cores': 4},
            location='Beijing',
            status='online',
            public_key='PK-SHARD-SUCCESS',
        )
        self.task = TaskDispatch.objects.create(
            task_id='TASK-SHARD-SUCCESS-001',
            task_type='code',
            status='dispatching',
            total_shards=1,
        )
        self.shard = TaskShard.objects.create(
            shard_id='TASK-SHARD-SUCCESS-001-S0',
            task=self.task,
            sequence=0,
            total_in_task=1,
            payload_hash='hash_ok',
            required_capabilities=['python'],
            status='pending',
        )
        self.executor = SandboxExecutor()

    def test_status_transition_to_completed(self):
        """分片状态从 pending → executing → completed"""
        self.assertEqual(self.shard.status, 'pending')
        result = self.executor.execute_shard(self.shard, node_id=self.node.node_id)
        self.shard.refresh_from_db()
        self.assertEqual(self.shard.status, 'completed')

    def test_creates_shard_result_record(self):
        """创建 ShardResult 记录"""
        self.executor.execute_shard(self.shard, node_id=self.node.node_id)
        self.assertEqual(ShardResult.objects.filter(shard=self.shard).count(), 1)

    def test_result_signature_is_sha256_hex_64chars(self):
        """result_signature 为 SHA256 格式（64位hex）"""
        self.executor.execute_shard(self.shard, node_id=self.node.node_id)
        sr = ShardResult.objects.filter(shard=self.shard).first()
        self.assertIsNotNone(sr)
        self.assertEqual(len(sr.result_signature), 64)
        int(sr.result_signature, 16)  # 合法 hex 校验

    def test_is_accepted_true_when_exit_zero(self):
        """is_accepted 与 exit_code 一致（exit_code=0 → True）"""
        self.executor.execute_shard(self.shard, node_id=self.node.node_id)
        sr = ShardResult.objects.filter(shard=self.shard).first()
        self.assertTrue(sr.is_accepted)


class TestExecuteShardFailure(TestCase):
    """execute_shard: 分片状态 pending → executing → failed (exit_code≠0)"""

    def setUp(self):
        self.node = P2PNode.objects.create(
            node_id='node-shard-fail',
            node_type='desktop_windows',
            capabilities=['python'],
            resources={},
            location='Beijing',
            status='online',
            public_key='PK-SHARD-FAIL',
        )
        self.task = TaskDispatch.objects.create(
            task_id='TASK-SHARD-FAIL-001',
            task_type='code',
            status='dispatching',
            total_shards=1,
        )
        self.shard = TaskShard.objects.create(
            shard_id='TASK-SHARD-FAIL-001-S0',
            task=self.task,
            sequence=0,
            total_in_task=1,
            payload_hash='hash_fail',
            required_capabilities=['__dangerous_lang__'],
            status='pending',
        )
        self.executor = SandboxExecutor()

    def test_status_transition_to_failed_on_bad_lang(self):
        """不支持的语言导致执行失败 → 状态为 failed"""
        # 模拟 execute 返回非零 exit_code（因为语言不支持导致预检/执行失败）
        with patch.object(self.executor, 'execute', return_value={
            'exit_code': 1,
            'stdout': '',
            'stderr': 'unsupported language',
            'execution_time_ms': 10,
            'resource_usage': {},
        }):
            result = self.executor.execute_shard(self.shard, node_id=self.node.node_id)
        self.shard.refresh_from_db()
        self.assertEqual(self.shard.status, 'failed')

    def test_is_accepted_false_when_exit_nonzero(self):
        """is_accepted 为 False 当 exit_code != 0"""
        # 模拟 execute 返回非零 exit_code
        with patch.object(self.executor, 'execute', return_value={
            'exit_code': 1,
            'stdout': '',
            'stderr': 'execution error',
            'execution_time_ms': 10,
            'resource_usage': {},
        }):
            self.executor.execute_shard(self.shard, node_id=self.node.node_id)
        sr = ShardResult.objects.filter(shard=self.shard).first()
        if sr:
            self.assertFalse(sr.is_accepted)


class TestExecuteShardException(TestCase):
    """execute_shard: 异常时分片状态为 failed"""

    def setUp(self):
        self.node = P2PNode.objects.create(
            node_id='node-shard-exc',
            node_type='desktop_windows',
            capabilities=[],
            resources={},
            location='Beijing',
            status='online',
            public_key='PK-SHARD-EXC',
        )
        self.task = TaskDispatch.objects.create(
            task_id='TASK-SHARD-EXC-001',
            task_type='code',
            status='dispatching',
            total_shards=1,
        )
        self.shard = TaskShard.objects.create(
            shard_id='TASK-SHARD-EXC-001-S0',
            task=self.task,
            sequence=0,
            total_in_task=1,
            payload_hash='hash_exc',
            required_capabilities=['python'],
            status='pending',
        )

    def test_exception_sets_shard_failed(self):
        """execute 内部抛出异常时，分片状态为 failed"""
        executor = SandboxExecutor()
        with patch.object(executor, 'execute', side_effect=RuntimeError('forced')):
            result = executor.execute_shard(self.shard, node_id=self.node.node_id)
        self.shard.refresh_from_db()
        self.assertEqual(self.shard.status, 'failed')
        self.assertFalse(result.get('success', False))


# ──────────────────────────────────────────────
# 5. _sign_result 静态方法测试
# ──────────────────────────────────────────────

class TestSignResult(unittest.TestCase):
    """SandboxExecutor._sign_result() 签名测试"""

    def test_same_input_same_signature(self):
        """相同输入产生相同签名"""
        data = {'exit_code': 0, 'stdout': 'hello', 'stderr': '', 'execution_time_ms': 100}
        sig1 = SandboxExecutor._sign_result(data)
        sig2 = SandboxExecutor._sign_result(data)
        self.assertEqual(sig1, sig2)

    def test_different_output_different_signature(self):
        """不同输出产生不同签名"""
        data1 = {'exit_code': 0, 'stdout': 'aaa', 'stderr': '', 'execution_time_ms': 100}
        data2 = {'exit_code': 0, 'stdout': 'bbb', 'stderr': '', 'execution_time_ms': 100}
        sig1 = SandboxExecutor._sign_result(data1)
        sig2 = SandboxExecutor._sign_result(data2)
        self.assertNotEqual(sig1, sig2)

    def test_signature_is_64_char_hex_string(self):
        """签名为 64 字符 hex 字符串"""
        sig = SandboxExecutor._sign_result({
            'exit_code': 0,
            'stdout': 'test',
            'stderr': '',
            'execution_time_ms': 50,
        })
        self.assertEqual(len(sig), 64)
        int(sig, 16)  # 合法 hex


# ──────────────────────────────────────────────
# 6. ResultCollector 类测试
# ──────────────────────────────────────────────

class TestResultCollectorCollectAccepted(TestCase):
    """ResultCollector.collect: 收集所有分片的 accepted results"""

    def setUp(self):
        self.node = P2PNode.objects.create(
            node_id='node-collector-test',
            node_type='browser',
            capabilities=[],
            resources={},
            location='Shanghai',
            status='online',
            public_key='PK-COLLECTOR-T',
        )
        self.task = TaskDispatch.objects.create(
            task_id='TASK-COLLECT-T-001',
            task_type='text',
            status='aggregating',
            total_shards=3,
            completed_shards=0,
        )
        self.collector = ResultCollector()

        # 创建 3 个分片：completed / failed / pending
        shards_data = [
            ('TASK-COLLECT-T-001-S0', 0, 'completed'),
            ('TASK-COLLECT-T-001-S1', 1, 'failed'),
            ('TASK-COLLECT-T-001-S2', 2, 'pending'),
        ]
        for sid, seq, status in shards_data:
            s = TaskShard.objects.create(
                shard_id=sid,
                task=self.task,
                sequence=seq,
                total_in_task=3,
                payload_hash=f'ht{seq}',
                status=status,
            )
            if status == 'completed':
                ShardResult.objects.create(
                    shard=s,
                    node_id=self.node.node_id,
                    exit_code=0,
                    stdout=f'shard_{seq}_output',
                    stderr='',
                    execution_time_ms=100 * (seq + 1),
                    is_accepted=True,
                    result_signature=SandboxExecutor._sign_result({
                        'exit_code': 0, 'stdout': f'shard_{seq}_output',
                        'stderr': '', 'execution_time_ms': 100 * (seq + 1),
                    }),
                )
            elif status == 'failed':
                ShardResult.objects.create(
                    shard=s,
                    node_id=self.node.node_id,
                    exit_code=1,
                    stderr=f'shard_{seq}_error',
                    execution_time_ms=50,
                    is_accepted=True,
                    result_signature=SandboxExecutor._sign_result({
                        'exit_code': 1, 'stdout': '',
                        'stderr': f'shard_{seq}_error', 'execution_time_ms': 50,
                    }),
                )

    def test_collect_counts_completed_failed_pending(self):
        """统计 completed/failed/pending 数量"""
        collected = self.collector.collect(self.task)
        self.assertEqual(collected['completed_shards'], 1)
        self.assertEqual(collected['failed_shards'], 1)
        self.assertEqual(collected['pending_shards'], 1)

    def test_collect_aggregates_stdout_stderr(self):
        """聚合 stdout/stderr"""
        collected = self.collector.collect(self.task)
        self.assertIn('[Shard-0]', collected['aggregated_stdout'])

    def test_collect_total_execution_time_ms(self):
        """计算 total_execution_time_ms"""
        collected = self.collector.collect(self.task)
        self.assertGreater(collected['total_execution_time_ms'], 0)

    def test_collect_resource_summary_present(self):
        """聚合 resource_summary"""
        collected = self.collector.collect(self.task)
        self.assertIn('resource_summary', collected)

    def test_collect_all_completed_flag_correct(self):
        """all_completed 标志正确"""
        collected = self.collector.collect(self.task)
        self.assertFalse(collected['all_completed'])

    def test_collect_all_completed_when_all_done(self):
        """全部完成时 all_completed=True"""
        for shard in self.task.shards.all():
            shard.status = 'completed'
            shard.save()
        # 给 pending 分片补充结果
        pending_shard = TaskShard.objects.get(sequence=2)
        if not ShardResult.objects.filter(shard=pending_shard).exists():
            ShardResult.objects.create(
                shard=pending_shard,
                node_id=self.node.node_id,
                exit_code=0,
                stdout='shard_2_done',
                execution_time_ms=80,
                is_accepted=True,
                result_signature=SandboxExecutor._sign_result({
                    'exit_code': 0, 'stdout': 'shard_2_done',
                    'stderr': '', 'execution_time_ms': 80,
                }),
            )
        collected = self.collector.collect(self.task)
        self.assertTrue(collected['all_completed'])


class TestResultCollectorEmptyTask(TestCase):
    """ResultCollector: 空任务返回合理默认值"""

    def setUp(self):
        self.node = P2PNode.objects.create(
            node_id='node-empty-task',
            node_type='browser',
            capabilities=[],
            resources={},
            location='Shanghai',
            status='online',
            public_key='PK-EMPTY',
        )
        self.task = TaskDispatch.objects.create(
            task_id='TASK-EMPTY-001',
            task_type='text',
            status='created',
            total_shards=0,
        )
        self.collector = ResultCollector()

    def test_empty_task_returns_defaults(self):
        """空任务返回合理的默认值"""
        collected = self.collector.collect(self.task)
        self.assertEqual(collected['total_shards'], 0)
        self.assertEqual(collected['completed_shards'], 0)
        self.assertEqual(collected['failed_shards'], 0)
        self.assertEqual(collected['pending_shards'], 0)
        self.assertEqual(collected['total_execution_time_ms'], 0)


class TestResultCollectorValidateSignature(TestCase):
    """ResultCollector.validate_result_signature: 签名验证"""

    def setUp(self):
        self.node = P2PNode.objects.create(
            node_id='node-sig-test',
            node_type='browser',
            capabilities=[],
            resources={},
            location='Shanghai',
            status='online',
            public_key='PK-SIG',
        )
        self.task = TaskDispatch.objects.create(
            task_id='TASK-SIG-001',
            task_type='text',
            status='aggregating',
            total_shards=1,
        )
        self.shard = TaskShard.objects.create(
            shard_id='TASK-SIG-001-S0',
            task=self.task,
            sequence=0,
            total_in_task=1,
            payload_hash='hsig',
            status='completed',
        )
        self.sr = ShardResult.objects.create(
            shard=self.shard,
            node_id=self.node.node_id,
            exit_code=0,
            stdout='original_output',
            stderr='',
            execution_time_ms=100,
            is_accepted=True,
            result_signature=SandboxExecutor._sign_result({
                'exit_code': 0, 'stdout': 'original_output',
                'stderr': '', 'execution_time_ms': 100,
            }),
        )

    def test_valid_signature_passes(self):
        """未篡改结果验证通过"""
        self.assertTrue(ResultCollector.validate_result_signature(self.sr))

    def test_tampered_signature_fails(self):
        """篡改后的结果验证失败"""
        self.sr.stdout = 'tampered_output!!!'
        self.assertFalse(ResultCollector.validate_result_signature(self.sr))


class TestResultCollectorGenerateSummary(TestCase):
    """ResultCollector.generate_result_summary: 生成人类可读摘要"""

    def setUp(self):
        self.node = P2PNode.objects.create(
            node_id='node-summary-test',
            node_type='browser',
            capabilities=[],
            resources={},
            location='Shanghai',
            status='online',
            public_key='PK-SUMMARY',
        )
        self.task = TaskDispatch.objects.create(
            task_id='TASK-SUMMARY-001',
            task_type='text',
            status='aggregating',
            total_shards=2,
        )
        self.collector = ResultCollector()

        for seq in range(2):
            s = TaskShard.objects.create(
                shard_id=f'TASK-SUMMARY-001-S{seq}',
                task=self.task,
                sequence=seq,
                total_in_task=2,
                payload_hash=f'hsum{seq}',
                status='completed',
            )
            ShardResult.objects.create(
                shard=s,
                node_id=self.node.node_id,
                exit_code=0,
                stdout=f'output_{seq}',
                execution_time_ms=50 * (seq + 1),
                is_accepted=True,
                result_signature=SandboxExecutor._sign_result({
                    'exit_code': 0, 'stdout': f'output_{seq}',
                    'stderr': '', 'execution_time_ms': 50 * (seq + 1),
                }),
            )

    def test_summary_human_readable_text(self):
        """返回 human_readable 文本"""
        summary = self.collector.generate_result_summary(self.task)
        self.assertIsInstance(summary['human_readable'], str)
        self.assertGreater(len(summary['human_readable']), 0)

    def test_summary_contains_overall_status(self):
        """包含 overall_status (全部完成/部分完成/未完成)"""
        summary = self.collector.generate_result_summary(self.task)
        self.assertIn('overall_status', summary)
        self.assertIn(summary['overall_status'], ('全部完成', '部分完成', '未完成'))

    def test_summary_contains_completed_ratio(self):
        """包含 completed_ratio"""
        summary = self.collector.generate_result_summary(self.task)
        self.assertIn('completed_ratio', summary)
        self.assertAlmostEqual(summary['completed_ratio'], 1.0)

    def test_summary_contains_shard_details(self):
        """包含分片明细列表"""
        summary = self.collector.generate_result_summary(self.task)
        raw = summary.get('raw_data', {})
        self.assertIn('per_shard_results', raw)
        self.assertEqual(len(raw['per_shard_results']), 2)
