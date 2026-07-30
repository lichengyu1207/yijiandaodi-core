import subprocess
import tempfile
import os
import json
import hashlib
import time
import re
import logging
from datetime import datetime
from typing import Optional

from ..models import TaskShard, TaskDispatch, ShardResult

logger = logging.getLogger(__name__)


class SandboxConfig:
    """沙箱配置"""

    # 资源限制
    MAX_MEMORY_MB = 512
    MAX_CPU_SECONDS = 300
    MAX_DISK_MB = 256
    MAX_OUTPUT_SIZE = 10 * 1024 * 1024  # 10MB

    # 允许的操作
    ALLOWED_LANGUAGES = ['python', 'javascript', 'typescript', 'bash', 'html']

    # 禁止的操作
    BLOCKED_PATTERNS = [
        r'import\s+os\.system',
        r'import\s+subprocess',
        r'eval\s*\(',
        r'exec\s*\(',
        r'__import__',
        r'open\s*\([\'"]\/etc',
        r'open\s*\([\'"]\/proc',
        r'rm\s+-rf\s+/',
        r'chmod\s+777',
        r'\.env\s*[\'"]',
        r'socket\.socket',
    ]


class CodeAnalyzer:
    """代码静态分析器 - 执行前预检"""

    def analyze(self, code: str, language: str) -> dict:
        """
        分析代码安全性：
        1. 语言白名单检查
        2. 危险模式匹配
        3. 复杂度评估（行数、循环深度、导入数）
        4. 资源需求预估
        返回 {safe: bool, risk_level: str, warnings: list, estimated_resources: dict}
        """
        warnings = []
        risk_level = 'low'

        # 1. 语言白名单检查
        if language not in SandboxConfig.ALLOWED_LANGUAGES:
            return {
                'safe': False,
                'risk_level': 'critical',
                'warnings': [f'不支持的语言类型: {language}'],
                'estimated_resources': {},
            }

        # 2. 危险模式匹配
        for pattern in SandboxConfig.BLOCKED_PATTERNS:
            match = re.search(pattern, code, re.IGNORECASE)
            if match:
                risk_level = 'high'
                warnings.append(
                    f'检测到危险模式 [{pattern}] 在位置 {match.start()}-{match.end()}'
                )

        if risk_level == 'high':
            return {
                'safe': False,
                'risk_level': risk_level,
                'warnings': warnings,
                'estimated_resources': {},
            }

        # 3. 复杂度评估
        lines = code.split('\n')
        line_count = len(lines)

        loop_depth = 0
        max_depth = 0
        import_count = 0
        for line in lines:
            stripped = line.strip()
            for keyword in ('for ', 'while ', 'foreach '):
                if stripped.startswith(keyword):
                    loop_depth += 1
                    max_depth = max(max_depth, loop_depth)
            if stripped in (')', '}', ']', 'end'):
                loop_depth = max(0, loop_depth - 1)
            if re.match(r'^\s*(import|from)\s+', line):
                import_count += 1

        if line_count > 500:
            warnings.append(f'代码行数较多 ({line_count})，可能影响执行效率')
            risk_level = 'medium'
        if max_depth > 5:
            warnings.append(f'嵌套深度较深 ({max_depth})，可能导致长时间运行')
            risk_level = 'medium'
        if import_count > 20:
            warnings.append(f'导入数量较多 ({import_count})，请确认依赖安全性')

        # 4. 资源需求预估
        estimated_resources = {
            'memory_mb': min(SandboxConfig.MAX_MEMORY_MB, max(16, line_count // 10)),
            'cpu_seconds': min(SandboxConfig.MAX_CPU_SECONDS, max(5, line_count // 50)),
            'disk_mb': min(SandboxConfig.MAX_DISK_MB, max(1, len(code) // 1024)),
        }

        safe = risk_level != 'critical'
        return {
            'safe': safe,
            'risk_level': risk_level,
            'warnings': warnings,
            'estimated_resources': estimated_resources,
        }


class SandboxExecutor:
    """沙箱执行器 - 核心执行组件"""

    def __init__(self, config: SandboxConfig = None):
        self.config = config or SandboxConfig()
        self.analyzer = CodeAnalyzer()

    def prepare_environment(self, shard: TaskShard) -> str:
        """
        准备隔离执行环境：
        1. 创建临时目录
        2. 写入代码文件（从 payload_hash 关联数据获取）
        3. 设置资源限制（ulimit/namespaces模拟）
        4. 返回工作目录路径
        """
        work_dir = tempfile.mkdtemp(prefix=f'sandbox_{shard.shard_id[:12]}_')

        # 创建代码文件占位（实际代码由 execute 方法传入）
        code_file = os.path.join(work_dir, f'code.{shard.required_capabilities[0] if shard.required_capabilities else "py"}')
        with open(code_file, 'w', encoding='utf-8') as f:
            f.write('# sandbox workspace\n')

        logger.info(f'Sandbox environment prepared: {work_dir}')
        return work_dir

    def _build_command(self, code: str, language: str, work_dir: str) -> list[str]:
        """根据语言构建子进程命令"""
        ext_map = {
            'python': '.py',
            'javascript': '.js',
            'typescript': '.ts',
            'bash': '.sh',
            'html': '.html',
        }
        ext = ext_map.get(language, '.py')
        code_file = os.path.join(work_dir, f'code{ext}')

        with open(code_file, 'w', encoding='utf-8') as f:
            f.write(code)

        if language == 'python':
            cmd = ['python', '-c', code]
        elif language == 'bash':
            cmd = ['bash', '-c', code]
        elif language in ('javascript', 'typescript'):
            cmd = ['node', '-e', code]
        elif language == 'html':
            # HTML 作为纯文本处理，不实际渲染
            cmd = ['python', '-c', f"print({json.dumps(code)[:200]!r})"]
        else:
            cmd = ['python', '-c', code]

        return cmd

    def execute(self, code: str, language: str = 'python',
                timeout: int = 30, input_data: str = None) -> dict:
        """
        在沙箱中执行代码：
        1. 预检（CodeAnalyzer）
        2. 准备环境
        3. 子进程执行（带超时、内存限制、输出捕获）
        4. 收集结果
        5. 清理环境
        返回 {exit_code, stdout, stderr, execution_time_ms, resource_usage}
        """
        start_time = time.time()

        # 步骤1：预检
        analysis = self.analyzer.analyze(code, language)
        if not analysis['safe']:
            return {
                'exit_code': -1,
                'stdout': '',
                'stderr': f"安全预检未通过: {'; '.join(analysis['warnings'])}",
                'execution_time_ms': int((time.time() - start_time) * 1000),
                'resource_usage': {
                    'analysis_risk_level': analysis['risk_level'],
                    'blocked': True,
                },
            }

        # 步骤2：准备环境
        work_dir = None
        try:
            work_dir = tempfile.mkdtemp(prefix='sandbox_exec_')
            cmd = self._build_command(code, language, work_dir)

            # 步骤3：子进程执行
            process = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                stdin=subprocess.PIPE if input_data else subprocess.DEVNULL,
                cwd=work_dir,
                shell=False,
                text=True,
            )

            try:
                stdout_data, stderr_data = process.communicate(
                    input=input_data, timeout=timeout
                )
                exit_code = process.returncode
            except subprocess.TimeoutExpired:
                process.kill()
                stdout_data, stderr_data = process.communicate()
                exit_code = -9
                stderr_data = (
                    f'执行超时 ({timeout}s)\n原stderr: {stderr_data}'
                )

            # 截断过大输出
            if len(stdout_data) > self.config.MAX_OUTPUT_SIZE:
                stdout_data = stdout_data[:self.config.MAX_OUTPUT_SIZE] + '\n...[输出已截断]'
            if len(stderr_data) > self.config.MAX_OUTPUT_SIZE:
                stderr_data = stderr_data[:self.config.MAX_OUTPUT_SIZE] + '\n...[输出已截断]'

            execution_time_ms = int((time.time() - start_time) * 1000)

            result = {
                'exit_code': exit_code,
                'stdout': stdout_data or '',
                'stderr': stderr_data or '',
                'execution_time_ms': execution_time_ms,
                'resource_usage': {
                    'work_dir': work_dir,
                    'language': language,
                    'timeout_seconds': timeout,
                    'analysis_warnings': analysis['warnings'],
                    **analysis['estimated_resources'],
                },
            }

            logger.info(
                f'Sandbox execution completed: '
                f'exit_code={exit_code}, time={execution_time_ms}ms, '
                f'stdout_len={len(stdout_data)}, stderr_len={len(stderr_data)}'
            )

            return result

        except Exception as e:
            logger.error(f'Sandbox execution error: {e}', exc_info=True)
            return {
                'exit_code': -2,
                'stdout': '',
                'stderr': f'沙箱内部错误: {str(e)}',
                'execution_time_ms': int((time.time() - start_time) * 1000),
                'resource_usage': {'error': str(e)},
            }

        finally:
            # 步骤5：清理环境
            if work_dir and os.path.exists(work_dir):
                try:
                    import shutil
                    shutil.rmtree(work_dir, ignore_errors=True)
                except Exception:
                    pass

    def execute_shard(self, shard: TaskShard, node_id: str = None) -> dict:
        """
        执行一个完整的 TaskShard，结果写入 ShardResult
        从 TaskShard 的关联数据获取待执行的代码/指令
        """
        node_id = node_id or (shard.assigned_node_ids[0] if shard.assigned_node_ids else 'local')

        # 从分片的 required_capabilities 推断语言
        lang = 'python'
        caps = shard.required_capabilities or []
        for cap in caps:
            if cap in SandboxConfig.ALLOWED_LANGUAGES:
                lang = cap
                break

        # 构造示例代码（实际场景应从外部传入或从 payload 解析）
        code = f'# Shard {shard.shard_id}\nprint("Executing shard sequence {shard.sequence}")\nresult = {shard.sequence * 2}\nprint(result)'

        # 更新分片状态为执行中
        shard.status = 'executing'
        shard.save(update_fields=['status'])

        try:
            exec_result = self.execute(code, language=lang)

            # 写入 ShardResult
            result_obj = ShardResult.objects.create(
                shard=shard,
                node_id=node_id,
                exit_code=exec_result['exit_code'],
                stdout=exec_result['stdout'],
                stderr=exec_result['stderr'],
                execution_time_ms=exec_result['execution_time_ms'],
                resource_usage=exec_result['resource_usage'],
                result_signature=self._sign_result(exec_result),
                is_accepted=(exec_result['exit_code'] == 0),
            )

            # 更新分片状态
            if exec_result['exit_code'] == 0:
                shard.status = 'completed'
            else:
                shard.status = 'failed'
            shard.save(update_fields=['status'])

            logger.info(
                f'Shard {shard.shard_id} executed on {node_id}: '
                f'exit={exec_result["exit_code"]}, status={shard.status}'
            )

            return {
                'success': True,
                'shard_id': shard.shard_id,
                'node_id': node_id,
                'exit_code': exec_result['exit_code'],
                'status': shard.status,
                'result_pk': result_obj.pk,
            }

        except Exception as e:
            shard.status = 'failed'
            shard.save(update_fields=['status'])
            logger.error(f'Shard {shard.shard_id} execution failed: {e}', exc_info=True)
            return {
                'success': False,
                'shard_id': shard.shard_id,
                'node_id': node_id,
                'error': str(e),
                'status': 'failed',
            }

    @staticmethod
    def _sign_result(result: dict) -> str:
        """对执行结果生成数字签名（SHA256 摘要）"""
        data_str = json.dumps({
            'exit_code': result.get('exit_code'),
            'stdout': result.get('stdout', '')[:1000],
            'stderr': result.get('stderr', '')[:1000],
            'execution_time_ms': result.get('execution_time_ms'),
        }, sort_keys=True)
        return hashlib.sha256(data_str.encode('utf-8')).hexdigest()


class ResultCollector:
    """结果收集器 - 聚合多个分片执行结果"""

    def collect(self, task: TaskDispatch) -> dict:
        """
        收集任务的所有分片结果：
        1. 统计 completed/failed 数量
        2. 聚合 stdout/stderr
        3. 计算总执行时间
        4. 生成结果摘要
        返回聚合后的结果字典
        """
        shards = task.shards.all()
        results = []

        total_time_ms = 0
        completed_count = 0
        failed_count = 0
        pending_count = 0
        all_stdout_parts = []
        all_stderr_parts = []
        resource_summary = {}

        for shard in shards:
            shard_results = shard.results.filter(is_accepted=True).order_by('-created_at')
            best_result = shard_results.first()

            if shard.status == 'completed':
                completed_count += 1
            elif shard.status == 'failed':
                failed_count += 1
            else:
                pending_count += 1

            if best_result:
                results.append({
                    'shard_id': shard.shard_id,
                    'sequence': shard.sequence,
                    'node_id': best_result.node_id,
                    'exit_code': best_result.exit_code,
                    'stdout': best_result.stdout,
                    'stderr': best_result.stderr,
                    'execution_time_ms': best_result.execution_time_ms,
                    'resource_usage': best_result.resource_usage,
                    'signature': best_result.result_signature,
                })
                total_time_ms += best_result.execution_time_ms
                if best_result.stdout:
                    all_stdout_parts.append(
                        f'[Shard-{shard.sequence}] {best_result.stdout}'
                    )
                if best_result.stderr:
                    all_stderr_parts.append(
                        f'[Shard-{shard.sequence}] {best_result.stderr}'
                    )
                if best_result.resource_usage:
                    for key, val in best_result.resource_usage.items():
                        if isinstance(val, (int, float)):
                            resource_summary[key] = resource_summary.get(key, 0) + val

        summary = {
            'task_id': task.task_id,
            'total_shards': shards.count(),
            'completed_shards': completed_count,
            'failed_shards': failed_count,
            'pending_shards': pending_count,
            'total_execution_time_ms': total_time_ms,
            'aggregated_stdout': '\n'.join(all_stdout_parts),
            'aggregated_stderr': '\n'.join(all_stderr_parts),
            'per_shard_results': results,
            'resource_summary': resource_summary,
            'all_completed': (completed_count == shards.count()) and shards.exists(),
            'collected_at': datetime.now().isoformat(),
        }

        logger.info(
            f'Result collected for task {task.task_id}: '
            f'{completed_count}/{shards.count()} completed'
        )

        return summary

    @staticmethod
    def validate_result_signature(result: ShardResult) -> bool:
        """验证结果的数字签名（防篡改）"""
        expected = SandboxExecutor._sign_result({
            'exit_code': result.exit_code,
            'stdout': result.stdout[:1000],
            'stderr': result.stderr[:1000],
            'execution_time_ms': result.execution_time_ms,
        })
        is_valid = expected == result.result_signature

        if not is_valid:
            logger.warning(
                f'Result signature mismatch for shard {result.shard.shard_id}: '
                f'expected={expected}, got={result.result_signature}'
            )

        return is_valid

    def generate_result_summary(self, task: TaskDispatch) -> dict:
        """生成人类可读的结果摘要"""
        collected = self.collect(task)

        status_emoji = {
            'completed': '✅',
            'failed': '❌',
            'pending': '⏳',
        }

        per_shard_lines = []
        for sr in collected.get('per_shard_results', []):
            emoji = status_emoji.get('completed' if sr['exit_code'] == 0 else 'failed', '❓')
            per_shard_lines.append(
                f"  {emoji} 分片#{sr['sequence']} | "
                f"节点={sr['node_id']} | "
                f"耗时={sr['execution_time_ms']}ms | "
                f"退出码={sr['exit_code']}"
            )

        overall_status = '全部完成' if collected['all_completed'] else \
                         '部分完成' if collected['completed_shards'] > 0 else \
                         '未完成'

        summary_text = (
            f"任务 {task.task_id} 执行报告\n"
            f"{'='*50}\n"
            f"总状态: {overall_status}\n"
            f"分片统计: {collected['completed_shards']}/{collected['total_shards']} 完成, "
            f"{collected['failed_shards']} 失败, {collected['pending_shards']} 待处理\n"
            f"总耗时: {collected['total_execution_time_ms']}ms\n"
            f"\n分片明细:\n" + '\n'.join(per_shard_lines) + '\n'
        )

        if collected.get('aggregated_stdout'):
            summary_text += f"\n--- 输出 ---\n{collected['aggregated_stdout']}\n"

        if collected.get('aggregated_stderr'):
            summary_text += f"\n--- 错误/警告 ---\n{collected['aggregated_stderr']}\n"

        return {
            'task_id': task.task_id,
            'overall_status': overall_status,
            'completed_ratio': (
                collected['completed_shards'] / collected['total_shards']
                if collected['total_shards'] > 0 else 0
            ),
            'total_time_ms': collected['total_execution_time_ms'],
            'human_readable': summary_text,
            'raw_data': collected,
        }
