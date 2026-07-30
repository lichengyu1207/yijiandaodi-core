import logging
import time
from datetime import datetime
from typing import Optional

from ..models import TaskDispatch, TaskShard, P2PNode
from .execution_engine import SandboxExecutor, ResultCollector
from .audit_trail import AuditLogger, ComplianceReporter, AuditEvent

logger = logging.getLogger(__name__)


class PipelineError(Exception):
    """流水线执行异常"""

    def __init__(self, stage: str, message: str, detail: dict = None):
        self.stage = stage
        self.message = message
        self.detail = detail or {}
        super().__init__(f"[{stage}] {message}")


class ExecutionPipeline:
    """
    一鉴到底七层执行流水线
    将 L2~L7 串联为完整执行链路：

    User Request
       ↓
    L3 SecurityGateway (认证+过滤+注入检测+签名)
       ↓
    L2 Orchestrator (DAG拆分+Agent编排)
       ↓
    L4 CostRouter (节点发现+成本估算+最优分配)
       ↓
    L5 TaskScheduler (分派到P2P节点)
       ↓
    L6 ExecutionEngine (沙箱执行+结果收集)
       ↓
    L7 AuditTrail (全程日志+存证+报告)
       ↓
    Response to User
    """

    def __init__(self):
        # 延迟导入，避免循环依赖；各层服务按需初始化
        self._init_l3_gateway()
        self._init_l2_orchestrator()
        self._init_l4_cost_router()
        self._init_l5_scheduler()

        # L6 执行引擎（本模块实现）
        self.executor = SandboxExecutor()
        self.collector = ResultCollector()

        # L7 审计层（本模块实现）
        self.audit = AuditLogger()
        self.reporter = ComplianceReporter(audit_logger=self.audit)

        logger.info('ExecutionPipeline initialized with all 7 layers')

    def _init_l3_gateway(self):
        """初始化 L3 安全网关"""
        try:
            from .security_gateway import ASSSecurityGateway
            self.gateway = ASSSecurityGateway()
            self.has_gateway = True
        except ImportError:
            logger.warning(
                'L3 SecurityGateway (ASSSecurityGateway) not found, '
                'security checks will be skipped'
            )
            self.gateway = None
            self.has_gateway = False

    def _init_l2_orchestrator(self):
        """初始化 L2 编排器"""
        try:
            from .orchestrator import WorkflowOrchestrator
            self.orchestrator = WorkflowOrchestrator()
            self.has_orchestrator = True
        except ImportError:
            logger.warning(
                'L2 Orchestrator (WorkflowOrchestrator) not found'
            )
            self.orchestrator = None
            self.has_orchestrator = False

    def _init_l4_cost_router(self):
        """初始化 L4 成本路由器"""
        try:
            from .cost_router import EIHMCostRouter
            self.cost_router = EIHMCostRouter()
            self.has_cost_router = True
        except ImportError:
            logger.warning(
                'L4 CostRouter (EIHMCostRouter) not found'
            )
            self.cost_router = None
            self.has_cost_router = False

    def _init_l5_scheduler(self):
        """初始化 L5 任务调度器"""
        try:
            from .dispatcher import TaskDispatcher
            self.scheduler = TaskDispatcher()
            self.has_scheduler = True
        except ImportError:
            logger.warning(
                'L5 TaskScheduler (TaskDispatcher) not found'
            )
            self.scheduler = None
            self.has_scheduler = False

    def execute(self, request_data: dict, user_context: dict = None) -> dict:
        """
        执行完整流水线
        返回包含每层执行结果的完整报告
        """
        pipeline_start = time.time()
        user_context = user_context or {}
        report = {
            'pipeline_id': hashlib_new_id(),
            'started_at': datetime.now().isoformat(),
            'stages': {},
            'success': False,
            'error': None,
        }

        task_id = request_data.get('task_id')
        request_id = request_data.get('request_id', report['pipeline_id'])

        try:
            # ========== L3: 安全网关 ==========
            logger.info(f'Pipeline [{report["pipeline_id"]}] -> L3 SecurityGateway')
            l3_result = self._execute_l3(request_data, user_context, request_id)
            report['stages']['L3_security'] = l3_result

            if not l3_result.get('passed', True):
                raise PipelineError(
                    stage='L3_security',
                    message='安全网关拒绝请求',
                    detail=l3_result,
                )

            # ========== L2: 编排器 ==========
            logger.info(f'Pipeline [{report["pipeline_id"]}] -> L2 Orchestrator')
            l2_result = self._execute_l2(request_data, user_context, task_id)
            report['stages']['L2_orchestration'] = l2_result

            # ========== L4: 成本路由 ==========
            logger.info(f'Pipeline [{report["pipeline_id"]}] -> L4 CostRouter')
            l4_result = self._execute_l4(task_id, l2_result)
            report['stages']['L4_cost_routing'] = l4_result

            # ========== L5: 任务调度 ==========
            logger.info(f'Pipeline [{report["pipeline_id"]}] -> L5 TaskScheduler')
            l5_result = self._execute_l5(task_id, l4_result)
            report['stages']['L5_scheduling'] = l5_result

            # ========== L6: 执行引擎 ==========
            logger.info(f'Pipeline [{report["pipeline_id"]}] -> L6 ExecutionEngine')
            l6_result = self._execute_l6(task_id, l5_result, request_id)
            report['stages']['L6_execution'] = l6_result

            # ========== L7: 审计存证 ==========
            logger.info(f'Pipeline [{report["pipeline_id"]}] -> L7 AuditTrail')
            l7_result = self._execute_l7(task_id, request_id, report)
            report['stages']['L7_audit'] = l7_result

            report['success'] = True
            report['completed_at'] = datetime.now().isoformat()
            report['total_time_ms'] = int((time.time() - pipeline_start) * 1000)

            logger.info(
                f'Pipeline [{report["pipeline_id"]}] completed successfully '
                f'in {report["total_time_ms"]}ms'
            )

            return report

        except PipelineError as e:
            report['success'] = False
            report['error'] = {
                'stage': e.stage,
                'message': e.message,
                'detail': e.detail,
            }
            report['completed_at'] = datetime.now().isoformat()
            report['total_time_ms'] = int((time.time() - pipeline_start) * 1000)

            self.audit.log(
                event_type=AuditEvent.EXECUTION_FAILED,
                entity_id=request_id,
                data={
                    'pipeline_id': report['pipeline_id'],
                    'stage': e.stage,
                    'error': e.message,
                    'detail': e.detail,
                },
            )

            logger.error(
                f'Pipeline [{report["pipeline_id"]}] failed at {e.stage}: {e.message}'
            )

            return report

        except Exception as e:
            report['success'] = False
            report['error'] = {
                'stage': 'unknown',
                'message': str(e),
            }
            report['completed_at'] = datetime.now().isoformat()
            report['total_time_ms'] = int((time.time() - pipeline_start) * 1000)

            self.audit.log(
                event_type=AuditEvent.EXECUTION_FAILED,
                entity_id=request_id,
                data={
                    'pipeline_id': report['pipeline_id'],
                    'error': str(e),
                },
            )

            logger.error(
                f'Pipeline [{report["pipeline_id"]}] unexpected error: {e}',
                exc_info=True,
            )

            return report

    def _execute_l3(self, request_data: dict, user_context: dict,
                    request_id: str) -> dict:
        """L3 安全网关：认证、过滤、注入检测、签名验证"""
        if not self.has_gateway or self.gateway is None:
            return {
                'passed': True,
                'skipped': True,
                'reason': 'SecurityGateway 未配置，跳过安全检查',
            }

        try:
            result = self.gateway.process_request(request_data, user_context)
            self.audit.log_security_gate(request_id, result)
            return result
        except Exception as e:
            logger.error(f'L3 SecurityGateway error: {e}', exc_info=True)
            return {
                'passed': False,
                'reason': f'安全网关异常: {str(e)}',
                'error': str(e),
            }

    def _execute_l2(self, request_data: dict, user_context: dict,
                    task_id: str) -> dict:
        """L2 编排器：DAG拆分、Agent编排"""
        if not self.has_orchestrator or self.orchestrator is None:
            return {
                'skipped': True,
                'reason': 'Orchestrator 未配置',
                'shards_created': 0,
            }

        try:
            workflow = self.orchestrator.create_workflow(
                name=f'task_{task_id}',
                description=request_data.get('description', ''),
            )

            shards_info = self.orchestrator.plan_workflow(workflow.id)

            self.audit.log(
                event_type=AuditEvent.TASK_DISPATCHED,
                entity_id=task_id,
                data={
                    'workflow_id': workflow.id,
                    'shards_count': len(shards_info) if isinstance(shards_info, list) else 0,
                },
                user_id=user_context.get('user_id'),
            )

            return {
                'workflow_id': workflow.id,
                'shards_created': len(shards_info) if isinstance(shards_info, list) else 0,
                'shards': shards_info if isinstance(shards_info, list) else [],
            }
        except Exception as e:
            logger.error(f'L2 Orchestrator error: {e}', exc_info=True)
            raise PipelineError(stage='L2_orchestration', message=str(e))

    def _execute_l4(self, task_id: str, l2_result: dict) -> dict:
        """L4 成本路由：节点发现、成本估算、最优分配"""
        if not self.has_cost_router or self.cost_router is None:
            return {
                'skipped': True,
                'reason': 'CostRouter 未配置',
                'routing_plan': {},
            }

        try:
            routing_decision = self.cost_router.route_task(task_id)

            self.audit.log_cost_routing(task_id, routing_decision)

            return {
                'routing_decision': routing_decision,
                'estimated_cost': routing_decision.get('total_estimated_cost', 0),
                'selected_nodes': routing_decision.get('selected_nodes', []),
            }
        except Exception as e:
            logger.error(f'L4 CostRouter error: {e}', exc_info=True)
            raise PipelineError(stage='L4_cost_routing', message=str(e))

    def _execute_l5(self, task_id: str, l4_result: dict) -> dict:
        """L5 任务调度：分派到P2P节点"""
        if not self.has_scheduler or self.scheduler is None:
            return {
                'skipped': True,
                'reason': 'TaskScheduler 未配置',
                'dispatched_shards': 0,
            }

        try:
            task = TaskDispatch.objects.get(task_id=task_id)
            shards_qs = task.shards.filter(status__in=['pending', 'dispatched'])
            available_nodes = list(
                P2PNode.objects.filter(status__in=['online', 'busy']).exclude(status='banned')
            )

            if not available_nodes:
                raise PipelineError(
                    stage='L5_scheduling',
                    message='无可用节点',
                    detail={'task_id': task_id},
                )

            from .dispatcher import SchedulableShard
            schedulable_shards = [
                SchedulableShard(
                    priority_score=shard.sequence,
                    shard_id=shard.shard_id,
                    task_id=task_id,
                    sequence=shard.sequence,
                    required_capabilities=shard.required_capabilities or [],
                    estimated_resources=shard.estimated_resources or {},
                    security_level=shard.security_level,
                )
                for shard in shards_qs
            ]

            dispatch_plan = self.scheduler.dispatch(schedulable_shards, available_nodes)

            for assignment in dispatch_plan.assignments:
                self.audit.log(
                    event_type=AuditEvent.SHARD_ASSIGNED,
                    entity_id=assignment['shard_id'],
                    data={'node_ids': assignment['node_ids']},
                )

            return {
                'dispatch_plan': {
                    'total_shards': dispatch_plan.total_shards,
                    'estimated_total_time_ms': dispatch_plan.estimated_total_time_ms,
                },
                'assignments': dispatch_plan.assignments,
                'dispatched_shards': len(dispatch_plan.assignments),
            }
        except TaskDispatch.DoesNotExist:
            raise PipelineError(
                stage='L5_scheduling',
                message=f'Task {task_id} 不存在',
            )
        except Exception as e:
            logger.error(f'L5 TaskScheduler error: {e}', exc_info=True)
            raise PipelineError(stage='L5_scheduling', message=str(e))

    def _execute_l6(self, task_id: str, l5_result: dict,
                    request_id: str) -> dict:
        """L6 执行引擎：沙箱执行 + 结果收集"""
        try:
            task = TaskDispatch.objects.get(task_id=task_id)
            shards_to_execute = task.shards.filter(status='dispatched')

            execution_results = []
            for shard in shards_to_execute:
                self.audit.log(
                    event_type=AuditEvent.EXECUTION_STARTED,
                    entity_id=shard.shard_id,
                    data={'node_ids': shard.assigned_node_ids},
                )

                exec_result = self.executor.execute_shard(shard)

                self.audit.log_execution(
                    shard_id=shard.shard_id,
                    node_id=exec_result.get('node_id', 'unknown'),
                    execution_result=exec_result,
                )

                execution_results.append(exec_result)

            # 聚合结果
            collected = self.collector.collect(task)
            summary = self.collector.generate_result_summary(task)

            # 更新任务状态
            if summary.get('all_completed'):
                task.status = 'completed'
            elif collected.get('completed_shards', 0) > 0:
                task.status = 'aggregating'
            else:
                task.status = 'failed'

            task.result_summary = summary.get('raw_data')
            task.save(update_fields=['status', 'result_summary'])

            return {
                'executed_shards': len(execution_results),
                'successful_shards': sum(1 for r in execution_results if r.get('success')),
                'collection': collected,
                'summary': summary.get('human_readable'),
            }
        except TaskDispatch.DoesNotExist:
            raise PipelineError(
                stage='L6_execution',
                message=f'Task {task_id} 不存在',
            )
        except Exception as e:
            logger.error(f'L6 ExecutionEngine error: {e}', exc_info=True)
            raise PipelineError(stage='L6_execution', message=str(e))

    def _execute_l7(self, task_id: str, request_id: str,
                    pipeline_report: dict) -> dict:
        """L7 审计存证：全程日志记录 + 存证 + 报告生成"""
        chain_status = self.audit.get_chain_status()

        task_report = None
        if task_id:
            try:
                task_report = self.reporter.generate_task_report(task_id)
            except Exception as e:
                logger.warning(f'Failed to generate task report: {e}')
                task_report = {'error': str(e)}

        audit_id = self.audit.log(
            event_type=AuditEvent.AUDIT_REPORT,
            entity_id=request_id,
            data={
                'pipeline_id': pipeline_report.get('pipeline_id'),
                'success': pipeline_report.get('success'),
                'total_time_ms': pipeline_report.get('total_time_ms'),
                'stages_executed': list(pipeline_report.get('stages', {}).keys()),
            },
        )

        return {
            'audit_id': audit_id,
            'chain_integrity': chain_status,
            'task_compliance_report': task_report,
            'total_audit_entries': sum(
                c['length'] for c in chain_status.values()
            ),
        }


def hashlib_new_id() -> str:
    """生成流水线唯一ID"""
    import hashlib
    raw = f'{time.time_ns()}_{id(object())}'
    return hashlib.sha256(raw.encode()).hexdigest()[:16]
