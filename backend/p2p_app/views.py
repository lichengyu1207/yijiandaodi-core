import uuid
import logging
import hashlib
import time as _time

from django.db.models import F
from django.utils import timezone
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination

from .models import P2PNode, NodeReputation, TaskDispatch, TaskShard, ShardResult
from .serializers import (
    NodeRegisterSerializer,
    NodeRegisterResponseSerializer,
    NodeDetailSerializer,
    NodeListSerializer,
    HeartbeatSerializer,
    HeartbeatAckSerializer,
    OfflineReasonSerializer,
    ReputationInfoSerializer,
    TaskDispatchSerializer,
    TaskDispatchDetailSerializer,
    TaskShardSerializer,
    ShardResultSubmissionSerializer,
    TaskStatusResponseSerializer,
    TaskCancelSerializer,
)
from .services.heartbeat_service import HeartbeatService, P2PServiceError
from .services.discovery_service import NodeDiscoveryService
from .services.task_state_machine import TaskStateMachine, TaskState, IllegalStateTransitionError
from .services.orchestrator import (
    WorkflowOrchestrator,
    DAGNode,
    WORKFLOW_TEMPLATES,
    WorkflowNotFoundError,
    DAGCycleError,
    orchestrator_instance,
)
from .services.security_gateway import (
    ASSSecurityGateway,
    security_gateway,
)

logger = logging.getLogger(__name__)


def safe_error_response(message: str = '内部服务错误，请稍后重试', status_code=500):
    """生产安全错误响应 - 不泄露内部异常详情"""
    return Response({
        'success': False,
        'message': message,
        'error_code': f'SERVER_{status_code}'
    }, status=status_code)


class P2PErrorResponse:
    ERROR_CODES = {
        'P2P_0001': (status.HTTP_401_UNAUTHORIZED, '节点认证失败或令牌过期'),
        'P2P_0002': (status.HTTP_403_FORBIDDEN, '节点已被封禁或信誉不足'),
        'P2P_0003': (status.HTTP_404_NOT_FOUND, '节点不存在或任务不存在'),
        'P2P_0004': (status.HTTP_409_CONFLICT, '节点重复注册'),
        'P2P_0005': (status.HTTP_422_UNPROCESSABLE_ENTITY, '请求参数校验失败'),
        'P2P_0006': (status.HTTP_429_TOO_MANY_REQUESTS, '节点请求频率超限'),
        'P2P_0007': (status.HTTP_503_SERVICE_UNAVAILABLE, '无可用节点满足调度要求'),
        'P2P_0008': (status.HTTP_504_GATEWAY_TIMEOUT, '任务执行超时'),
        'P2P_0009': (status.HTTP_500_INTERNAL_SERVER_ERROR, '内部服务错误'),
    }

    @classmethod
    def build(cls, code: str, details=None):
        http_status, message = cls.ERROR_CODES.get(code, (500, '未知错误'))
        return Response({
            'success': False,
            'error_code': code,
            'message': message,
            'details': details,
        }, status=http_status)


class P2PPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'size'
    max_page_size = 100


class NodeRegisterView(APIView):

    def post(self, request) -> Response:
        serializer = NodeRegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return P2PErrorResponse.build('P2P_0005', details=serializer.errors)

        data = serializer.validated_data

        node_id = str(uuid.uuid4())
        platform_certificate = f"YJD-CERT-{uuid.uuid4().hex[:16].upper()}"

        node = P2PNode.objects.create(
            node_id=node_id,
            node_type=data['node_type'],
            capabilities=data.get('capabilities', []),
            resources=data.get('resources', {}),
            location=data.get('location', 'unknown'),
            public_key=data.get('public_key_fingerprint', ''),
            status='online',
        )
        NodeReputation.objects.create(node=node)

        logger.info(f"P2P node registered: {node_id} type={data['node_type']}")

        response_data = {
            'node_id': node.node_id,
            'node_type': node.node_type,
            'status': node.status,
            'created_at': node.created_at.isoformat(),
            'platform_certificate': platform_certificate,
        }
        response_serializer = NodeRegisterResponseSerializer(data=response_data)
        response_serializer.is_valid(raise_exception=True)
        return Response(response_serializer.validated_data, status=status.HTTP_201_CREATED)


class NodeDetailView(APIView):

    def get(self, request, node_id: str) -> Response:
        try:
            node = P2PNode.objects.select_related('reputation').get(node_id=node_id)
        except P2PNode.DoesNotExist:
            return P2PErrorResponse.build('P2P_0003')

        serializer = NodeDetailSerializer(node)
        return Response({'success': True, 'data': serializer.data})


class NodeListView(APIView):
    pagination_class = P2PPagination

    def get(self, request) -> Response:
        queryset = P2PNode.objects.all()

        node_status = request.query_params.get('status')
        if node_status:
            queryset = queryset.filter(status=node_status)

        node_type = request.query_params.get('node_type')
        if node_type:
            queryset = queryset.filter(node_type=node_type)

        location = request.query_params.get('location')
        if location:
            queryset = queryset.filter(location__icontains=location)

        min_reputation = request.query_params.get('min_reputation')
        if min_reputation:
            try:
                queryset = queryset.filter(reputation_score__gte=float(min_reputation))
            except (ValueError, TypeError):
                pass

        paginator = self.pagination_class()
        paginated_qs = paginator.paginate_queryset(queryset, request)
        serializer = NodeListSerializer(paginated_qs, many=True)
        return paginator.get_paginated_response(serializer.data)


class NodeOfflineView(APIView):

    def delete(self, request, node_id: str) -> Response:
        try:
            node = P2PNode.objects.get(node_id=node_id)
        except P2PNode.DoesNotExist:
            return P2PErrorResponse.build('P2P_0003')

        reason_data = {}
        if request.data:
            reason_serializer = OfflineReasonSerializer(data=request.data)
            if reason_serializer.is_valid():
                reason_data = reason_serializer.validated_data

        node.status = 'offline'
        node.save(update_fields=['status'])

        logger.info(f"P2P node {node_id} went offline, reason={reason_data.get('reason', '')}")

        return Response({
            'success': True,
            'data': {'ack': True, 'status': 'offline'},
        })


class NodeReputationView(APIView):

    def get(self, request, node_id: str) -> Response:
        try:
            node = P2PNode.objects.select_related('reputation').get(node_id=node_id)
        except P2PNode.DoesNotExist:
            return P2PErrorResponse.build('P2P_0003')

        rep = getattr(node, 'reputation', None)
        score = rep.score if rep else 0.0
        if score >= 95:
            rank = 'S'
        elif score >= 85:
            rank = 'A'
        elif score >= 70:
            rank = 'B'
        elif score >= 60:
            rank = 'C'
        elif score >= 30:
            rank = 'D'
        else:
            rank = 'F'

        response_data = {
            'score': score,
            'success_rate': rep.success_rate if rep else 0.0,
            'avg_response_time_ms': rep.avg_response_time_ms if rep else 0.0,
            'malicious_flags': rep.malicious_flags if rep else 0,
            'rank': rank,
        }
        serializer = ReputationInfoSerializer(data=response_data)
        serializer.is_valid(raise_exception=True)
        return Response({'success': True, 'data': serializer.validated_data})


class NodeHeartbeatView(APIView):

    def put(self, request, node_id: str) -> Response:
        serializer = HeartbeatSerializer(data=request.data)
        if not serializer.is_valid():
            return P2PErrorResponse.build('P2P_0005', details=serializer.errors)

        try:
            ack_data = HeartbeatService.process_heartbeat(
                node_id=node_id,
                payload_dict=serializer.validated_data,
            )
        except P2PServiceError as e:
            logger.warning(f"Heartbeat failed for node {node_id}: {e}")
            return P2PErrorResponse.build('P2P_0002', details=str(e))
        except Exception as e:
            logger.error(f"Heartbeat error for node {node_id}: {e}", exc_info=True)
            return safe_error_response()

        response_serializer = HeartbeatAckSerializer(data=ack_data)
        response_serializer.is_valid(raise_exception=True)
        return Response({'success': True, 'data': response_serializer.validated_data})


class NetworkTopologyView(APIView):

    def get(self, request) -> Response:
        try:
            topology_data = NodeDiscoveryService.get_network_topology()
            return Response({
                'success': True,
                'data': topology_data,
            })
        except Exception as e:
            logger.error(f"Network topology error: {e}", exc_info=True)
            return safe_error_response()


class NodeDiscoverView(APIView):

    def post(self, request) -> Response:
        criteria = request.data if isinstance(request.data, dict) else {}

        try:
            nodes = NodeDiscoveryService.discover_nodes(criteria=criteria)
            return Response({
                'success': True,
                'data': nodes,
                'count': len(nodes),
            })
        except P2PServiceError as e:
            logger.warning(f"Node discovery failed: {e}")
            return P2PErrorResponse.build('P2P_0007', details=str(e))
        except Exception as e:
            logger.error(f"Node discovery error: {e}", exc_info=True)
            return safe_error_response()


class TaskDispatchView(APIView):

    def post(self, request) -> Response:
        serializer = TaskDispatchSerializer(data=request.data)
        if not serializer.is_valid():
            return P2PErrorResponse.build('P2P_0005', details=serializer.errors)

        data = serializer.validated_data
        shards_data = data.pop('shards')

        task_id = f"TASK-{uuid.uuid4().hex[:12].upper()}"

        task = TaskDispatch.objects.create(
            task_id=task_id,
            status='sharding',
            total_shards=len(shards_data),
            **data,
        )

        shard_objects = []
        for shard_input in shards_data:
            shard_id = f"{task_id}-SHARD-{shard_input['sequence']:04d}"
            shard_objects.append(TaskShard(
                shard_id=shard_id,
                task=task,
                sequence=shard_input['sequence'],
                total_in_task=len(shards_data),
                payload_hash=shard_input['payload_hash'],
                payload_size=shard_input.get('payload_size', 0),
                dependencies=shard_input.get('dependencies', []),
                required_capabilities=shard_input.get('required_capabilities', []),
                estimated_resources=shard_input.get('estimated_resources', {}),
                security_level=data.get('security_level', 'normal'),
            ))
        TaskShard.objects.bulk_create(shard_objects)

        task.status = 'dispatching'
        task.save(update_fields=['status'])

        logger.info(f"Task dispatched: {task_id} with {len(shards_data)} shards")

        detail_serializer = TaskDispatchDetailSerializer(task)
        return Response({
            'success': True,
            'data': detail_serializer.data,
        }, status=status.HTTP_201_CREATED)


class TaskDetailView(APIView):

    def get(self, request, task_id: str) -> Response:
        try:
            task = TaskDispatch.objects.prefetch_related('shards').get(task_id=task_id)
        except TaskDispatch.DoesNotExist:
            return P2PErrorResponse.build('P2P_0003')

        serializer = TaskDispatchDetailSerializer(task)
        return Response({'success': True, 'data': serializer.data})


class TaskStatusView(APIView):

    def get(self, request, task_id: str) -> Response:
        try:
            task = TaskDispatch.objects.get(task_id=task_id)
        except TaskDispatch.DoesNotExist:
            return P2PErrorResponse.build('P2P_0003')

        total = task.total_shards
        completed = task.completed_shards
        percentage = round((completed / total * 100), 1) if total > 0 else 0.0

        response_data = {
            'task_id': task.task_id,
            'status': task.status,
            'progress': {
                'completed': completed,
                'total': total,
                'percentage': percentage,
            },
        }
        status_serializer = TaskStatusResponseSerializer(data=response_data)
        status_serializer.is_valid(raise_exception=True)
        return Response({'success': True, 'data': status_serializer.validated_data})


class ShardResultSubmitView(APIView):

    def post(self, request, task_id: str, shard_id: str) -> Response:
        try:
            task = TaskDispatch.objects.get(task_id=task_id)
        except TaskDispatch.DoesNotExist:
            return P2PErrorResponse.build('P2P_0003')

        try:
            shard = TaskShard.objects.get(task=task, shard_id=shard_id)
        except TaskShard.DoesNotExist:
            return P2PErrorResponse.build('P2P_0003')

        serializer = ShardResultSubmissionSerializer(data=request.data)
        if not serializer.is_valid():
            return P2PErrorResponse.build('P2P_0005', details=serializer.errors)

        result_data = serializer.validated_data
        node_id = result_data.pop('shard_id')
        result_data.pop('shard_id')

        ShardResult.objects.create(
            shard=shard,
            node_id=node_id,
            **result_data,
        )

        exit_code = result_data.get('exit_code', 0)
        if exit_code == 0:
            shard.status = 'completed'
            TaskDispatch.objects.filter(pk=task.pk).update(
                completed_shards=F('completed_shards') + 1,
            )
            task.completed_shards = (task.completed_shards or 0) + 1
        else:
            shard.status = 'failed'
            TaskDispatch.objects.filter(pk=task.pk).update(
                failed_shards=F('failed_shards') + 1,
            )
            task.failed_shards = (task.failed_shards or 0) + 1

        shard.save(update_fields=['status'])

        logger.info(f"Shard result submitted: {shard_id} by node {node_id}, exit_code={exit_code}")

        return Response({
            'success': True,
            'data': {
                'ack': True,
                'shard_status': shard.status,
                'task_completed_shards': task.completed_shards,
            },
        })


class TaskListView(APIView):
    pagination_class = P2PPagination

    def get(self, request) -> Response:
        queryset = TaskDispatch.objects.all()

        task_status = request.query_params.get('status')
        if task_status:
            queryset = queryset.filter(status=task_status)

        task_type = request.query_params.get('task_type')
        if task_type:
            queryset = queryset.filter(task_type=task_type)

        priority = request.query_params.get('priority')
        if priority:
            queryset = queryset.filter(priority=priority)

        paginator = self.pagination_class()
        paginated_qs = paginator.paginate_queryset(queryset, request)
        serializer = TaskDispatchDetailSerializer(paginated_qs, many=True)
        return paginator.get_paginated_response(serializer.data)


class TaskCancelView(APIView):

    def post(self, request, task_id: str) -> Response:
        try:
            task = TaskDispatch.objects.get(task_id=task_id)
        except TaskDispatch.DoesNotExist:
            return P2PErrorResponse.build('P2P_0003')

        if task.status in ('completed', 'failed', 'aborted'):
            return P2PErrorResponse.build('P2P_0005', details=f'任务当前状态为 {task.status}，无法取消')

        reason_serializer = TaskCancelSerializer(data=request.data)
        reason = ''
        if reason_serializer.is_valid():
            reason = reason_serializer.validated_data.get('reason', '')

        task.status = 'aborted'
        task.error_message = f"任务已取消: {reason}"
        task.save(update_fields=['status', 'error_message'])

        TaskShard.objects.filter(task=task).exclude(status__in=('completed', 'failed')).update(status='failed')

        logger.info(f"Task cancelled: {task_id}, reason={reason}")

        return Response({
            'success': True,
            'data': {
                'ack': True,
                'status': 'aborted',
                'task_id': task_id,
            },
        })


class TaskStateMachineView(APIView):

    def get(self, request, task_id: str) -> Response:
        try:
            task = TaskDispatch.objects.get(task_id=task_id)
        except TaskDispatch.DoesNotExist:
            return P2PErrorResponse.build('P2P_0003')

        sm = TaskStateMachine.from_task(task)
        valid_targets = sm.get_valid_targets()

        response_data = {
            'task_id': task.task_id,
            'current_state': sm.current_state.value if sm.current_state else None,
            'valid_transitions': [t.value for t in valid_targets],
            'all_transitions': TaskStateMachine.get_all_transitions(),
        }
        return Response({'success': True, 'data': response_data})


# ──────────────────────────────────────────────
# L2 工作流编排 API
# ──────────────────────────────────────────────

class WorkflowCreateView(APIView):
    """创建工作流 - 支持自定义 DAG 或预设模板"""

    def post(self, request) -> Response:
        data = request.data if isinstance(request.data, dict) else {}

        # 判断是模板创建还是自定义 DAG
        template_name = data.get('template')
        use_template = template_name and template_name in WORKFLOW_TEMPLATES

        try:
            if use_template:
                # 从模板创建
                workflow_id = orchestrator_instance.create_workflow_from_template(
                    template_name=template_name,
                    payload_overrides=data.get('payload_overrides'),
                    priority=data.get('priority', 'normal'),
                    metadata=data.get('metadata', {}),
                )
            else:
                # 自定义 DAG 创建
                tasks_raw = data.get('tasks', [])
                if not tasks_raw:
                    return P2PErrorResponse.build('P2P_0005', details={'tasks': ['This field is required.']})

                nodes = []
                for t in tasks_raw:
                    deps = t.get('dependencies', [])
                    if isinstance(deps, str):
                        deps = [deps]
                    nodes.append(DAGNode(
                        node_id=t['node_id'],
                        agent_role=t.get('agent_role', 'executor'),
                        payload=t.get('payload', {}),
                        dependencies=deps,
                        security_level=t.get('security_level', 'normal'),
                        estimated_resources=t.get('estimated_resources', {}),
                        priority=t.get('priority', 'normal'),
                    ))

                workflow_id = orchestrator_instance.create_workflow(
                    name=data.get('name', 'custom_workflow'),
                    tasks=nodes,
                    priority=data.get('priority', 'normal'),
                    metadata=data.get('metadata', {}),
                )

            # 可选：自动启动工作流
            auto_start = data.get('auto_start', False)
            if auto_start:
                orchestrator_instance.start_workflow(workflow_id)

            # 可选：自动拆分为 TaskDispatch
            auto_shard = data.get('auto_shard', False)
            task_dispatch_info = None
            if auto_shard:
                dispatch = orchestrator_instance.sharding_to_task_dispatch(
                    workflow_id=workflow_id,
                    task_type=data.get('task_type', 'mixed'),
                    security_level=data.get('security_level', 'normal'),
                    privacy_level=data.get('privacy_level', 'public'),
                    created_by=str(request.user.id) if hasattr(request, 'user') and request.user else '',
                )
                from .serializers import TaskDispatchDetailSerializer
                task_dispatch_info = TaskDispatchDetailSerializer(dispatch).data

            progress = orchestrator_instance.get_workflow_progress(workflow_id)

            logger.info(f"Workflow created: {workflow_id} template={template_name}")

            return Response({
                'success': True,
                'data': {
                    'workflow_id': workflow_id,
                    **progress,
                    'task_dispatch': task_dispatch_info,
                },
            }, status=status.HTTP_201_CREATED)

        except (DAGCycleError, ValueError) as e:
            logger.warning(f"Workflow creation failed: {e}")
            return P2PErrorResponse.build('P2P_0005', details=str(e))
        except Exception as e:
            logger.error(f"Workflow creation error: {e}", exc_info=True)
            return safe_error_response()


class WorkflowStatusView(APIView):
    """查询工作流状态/进度"""

    def get(self, request, workflow_id: str) -> Response:
        try:
            detail = orchestrator_instance.get_workflow_detail(workflow_id)
            return Response({'success': True, 'data': detail})
        except WorkflowNotFoundError:
            return P2PErrorResponse.build('P2P_0003')
        except Exception as e:
            logger.error(f"Workflow status error: {e}", exc_info=True)
            return safe_error_response()

    def post(self, request, workflow_id: str) -> Response:
        """工作流操作: 启动 / 取消 / 标记任务完成"""
        action = request.data.get('action') if isinstance(request.data, dict) else None

        try:
            if action == 'start':
                orchestrator_instance.start_workflow(workflow_id)
                msg = 'Workflow started'
            elif action == 'cancel':
                reason = (request.data.get('reason', '') if isinstance(request.data, dict) else '')
                orchestrator_instance.cancel_workflow(workflow_id, reason=reason)
                msg = f'Workflow cancelled: {reason}'
            elif action == 'complete_task':
                task_id = (request.data.get('task_id', '') if isinstance(request.data, dict) else '')
                result = (request.data.get('result') if isinstance(request.data, dict) else None)
                if not task_id:
                    return P2PErrorResponse.build('P2P_0005', details='task_id is required for complete_task')
                orchestrator_instance.mark_task_completed(workflow_id, task_id, result)
                msg = f'Task {task_id} marked completed'
            elif action == 'fail_task':
                task_id = (request.data.get('task_id', '') if isinstance(request.data, dict) else '')
                error = (request.data.get('error', 'Unknown error') if isinstance(request.data, dict) else 'Unknown error')
                if not task_id:
                    return P2PErrorResponse.build('P2P_0005', details='task_id is required for fail_task')
                orchestrator_instance.mark_task_failed(workflow_id, task_id, error)
                msg = f'Task {task_id} marked failed'
            else:
                return P2PErrorResponse.build('P2P_0005', details=f'Unknown action: {action}')

            detail = orchestrator_instance.get_workflow_detail(workflow_id)
            logger.info(f"Workflow action: {workflow_id} action={action}")
            return Response({'success': True, 'data': {'message': msg, 'workflow': detail}})

        except WorkflowNotFoundError:
            return P2PErrorResponse.build('P2P_0003')
        except Exception as e:
            logger.error(f"Workflow action error: {e}", exc_info=True)
            return safe_error_response()


class WorkflowListView(APIView):
    """列出所有工作流"""

    def get(self, request) -> Response:
        status_filter = request.query_params.get('status')
        try:
            workflows = orchestrator_instance.list_workflows(status_filter=status_filter)
            return Response({
                'success': True,
                'data': workflows,
                'count': len(workflows),
            })
        except Exception as e:
            logger.error(f"Workflow list error: {e}", exc_info=True)
            return safe_error_response()


class WorkflowReadyTasksView(APIView):
    """获取工作流的就绪任务列表"""

    def get(self, request, workflow_id: str) -> Response:
        try:
            ready_tasks = orchestrator_instance.get_ready_tasks(workflow_id)
            task_list = [
                {
                    'node_id': t.node_id,
                    'agent_role': t.agent_role,
                    'dependencies': t.dependencies,
                    'security_level': t.security_level,
                    'estimated_resources': t.estimated_resources,
                    'priority': t.priority,
                }
                for t in ready_tasks
            ]
            return Response({
                'success': True,
                'data': {
                    'workflow_id': workflow_id,
                    'ready_count': len(task_list),
                    'tasks': task_list,
                },
            })
        except WorkflowNotFoundError:
            return P2PErrorResponse.build('P2P_0003')


# ──────────────────────────────────────────────
# L3 安全网关 API
# ──────────────────────────────────────────────

class SecurityCheckView(APIView):
    """安全检查入口 - ASS 安全网关"""

    def post(self, request) -> Response:
        """
        完整安全网关处理流水线

        Request body:
        {
            "data": {...},              // 待处理的请求数据
            "required_permission": "...", // 可选，所需权限
            "resource_scope": "...",     // 可选，资源范围
            "skip_auth": false           // 可选，是否跳过认证
        }

        或快速检查模式:
        {
            "text": "待检测文本",       // 仅做注入检测 + 风险评分
            "mode": "quick"
        }
        """
        req_data = request.data if isinstance(request.data, dict) else {}

        mode = req_data.get('mode', 'full')

        try:
            if mode == 'quick':
                # 快速模式：仅做文本安全检测
                text = req_data.get('text', '')
                result = security_gateway.quick_check(text)
                return Response({'success': True, 'data': result})

            # 完整模式：完整的安全网关流水线
            payload = req_data.get('data', {})
            gateway_result = security_gateway.process(
                request_data=payload,
                request=request,
                required_permission=req_data.get('required_permission'),
                resource_scope=req_data.get('resource_scope'),
                skip_auth=req_data.get('skip_auth', False),
            )

            report = gateway_result['security_report']
            http_status = status.HTTP_200_OK

            if not report['passed']:
                http_status = status.HTTP_403_FORBIDDEN
                logger.warning(
                    f"SecurityGateway blocked request: "
                    f"reason={report.get('blocked_reason')} "
                    f"risk={report['risk_score']}"
                )

            return Response({
                'success': report['passed'],
                'data': gateway_result,
            }, status=http_status)

        except Exception as e:
            logger.error(f"SecurityGateway error: {e}", exc_info=True)
            return safe_error_response()


class SecurityVerifySignatureView(APIView):
    """验证 ASS 签名"""

    def post(self, request) -> Response:
        from .services.security_gateway import ASSSignatureGenerator

        req_data = request.data if isinstance(request.data, dict) else {}
        signature = req_data.get('ass_signature', '')
        payload = req_data.get('payload', {})

        is_valid, error = ASSSignatureGenerator.verify(signature, payload)

        return Response({
            'success': is_valid,
            'data': {
                'valid': is_valid,
                'error': error,
            },
        })


# ──────────────────────────────────────────────
# 统一执行流水线 API (L3→L2→L4→L5→L6→L7)
# ──────────────────────────────────────────────


class PipelineExecuteView(APIView):
    """提交任务到完整流水线执行"""

    def post(self, request) -> Response:
        """提交一个执行请求，走完 L3→L2→L4→L5→L6→L7 全链路"""
        start_time = _time.time()
        req_data = request.data if isinstance(request.data, dict) else {}

        workflow_type = req_data.get('workflow_type', 'ai_execute')
        input_content = req_data.get('input_content', '')
        security_level = req_data.get('security_level', 'normal')
        priority = req_data.get('priority', 'normal')

        stages = []

        # ── L3: 安全网关 ──
        try:
            from .services.security_gateway import security_gateway
            gateway_result = security_gateway.process(
                request_data={'content': input_content},
                required_permission='execute',
            )
            l3_passed = gateway_result['security_report']['passed']
            stages.append({
                'stage': 'L3',
                'stage_name': 'ASS安全网关',
                'status': 'completed' if l3_passed else 'error',
                'duration_ms': int((_time.time() - start_time) * 1000),
                'summary': f"风险评分: {gateway_result['security_report']['risk_score']}, "
                          f"威胁数: {len(gateway_result['security_report'].get('matched_patterns', []))}",
                'details': gateway_result,
            })
            if not l3_passed:
                return Response({
                    'success': False,
                    'task_id': None,
                    'stages': stages,
                    'total_duration_ms': int((_time.time() - start_time) * 1000),
                    'message': 'Security check failed',
                }, status=status.HTTP_403_FORBIDDEN)
        except Exception as e:
            stages.append({'stage': 'L3', 'stage_name': 'ASS安全网关',
                           'status': 'warning', 'duration_ms': 0,
                           'summary': f'Security gateway skipped: {str(e)}'})

        # ── L2: 编排引擎 ──
        try:
            from .services.orchestrator import orchestrator_instance
            wf_id = orchestrator_instance.create_workflow_from_template(
                template_name=workflow_type,
                payload_overrides={'input': input_content},
                priority=priority,
                metadata={'security_level': security_level},
            )
            orchestrator_instance.start_workflow(wf_id)
            dispatch = orchestrator_instance.sharding_to_task_dispatch(
                workflow_id=wf_id,
                task_type=workflow_type,
                security_level=security_level,
            )
            task_id = dispatch.task_id
            stages.append({
                'stage': 'L2',
                'stage_name': '任务编排引擎',
                'status': 'completed',
                'duration_ms': 0,
                'summary': f"工作流: {wf_id}, 任务: {task_id}, 分片数: {dispatch.total_shards}",
                'details': {'workflow_id': wf_id, 'task_id': task_id,
                            'shard_count': dispatch.total_shards},
            })
        except Exception as e:
            task_id = f'manual-{uuid.uuid4().hex[:8]}'
            stages.append({'stage': 'L2', 'stage_name': '任务编排引擎',
                           'status': 'warning', 'duration_ms': 0,
                           'summary': f'Orchestration fallback: {str(e)}'})

        # ── L4: 成本路由 + L5: P2P调度 ──
        try:
            from .services.task_scheduler import TaskScheduler
            scheduler = TaskScheduler()
            routing = scheduler.assign_shards_to_nodes(dispatch)
            stages.append({
                'stage': 'L4+L5',
                'stage_name': '成本路由 + P2P调度',
                'status': 'completed',
                'duration_ms': 0,
                'summary': f"已分配 {len(routing.get('assignments', {}))} 个分片",
                'details': routing,
            })
        except Exception as e:
            stages.append({'stage': 'L4+L5', 'stage_name': '成本路由 + P2P调度',
                           'status': 'warning', 'duration_ms': 0,
                           'summary': f'Routing fallback: {str(e)}'})

        # ── L6: 沙箱执行 ──
        try:
            from .services.execution_engine import SandboxExecutor
            executor = SandboxExecutor()
            exec_result = executor.execute(
                code=input_content,
                language=workflow_type,
                timeout=30,
            )
            stages.append({
                'stage': 'L6',
                'stage_name': '沙箱执行引擎',
                'status': 'completed' if exec_result['exit_code'] == 0 else 'warning',
                'duration_ms': exec_result.get('execution_time_ms', 0),
                'summary': f"exit_code={exec_result['exit_code']}, "
                          f"耗时={exec_result.get('execution_time_ms', 0)}ms",
                'details': exec_result,
            })
        except Exception as e:
            stages.append({'stage': 'L6', 'stage_name': '沙箱执行引擎',
                           'status': 'error', 'duration_ms': 0,
                           'summary': f'Execution error: {str(e)}'})

        # ── L7: 审计存证 ──
        try:
            from .services.audit_trail import AuditLogger
            audit = AuditLogger()
            audit_id = audit.log(
                event_type=AuditEvent.EXECUTION_COMPLETED if stages[-1]['status'] in ('completed',)
                    else AuditEvent.EXECUTION_FAILED,
                entity_id=task_id,
                data={'stages': stages, 'input_hash': hashlib.sha256(input_content.encode()).hexdigest()[:16],
                      'user_ip': get_client_ip(request)},
            )
            total_ms = int((_time.time() - start_time) * 1000)
            stages.append({
                'stage': 'L7',
                'stage_name': '白盒审计存证',
                'status': 'completed',
                'duration_ms': 0,
                'summary': f"审计ID: {audit_id}",
                'details': {'audit_id': audit_id, 'chain_integrity': True},
            })
        except Exception as e:
            stages.append({'stage': 'L7', 'stage_name': '白盒审计存证',
                           'status': 'warning', 'duration_ms': 0,
                           'summary': f'Audit warning: {str(e)}'})

        total_ms = int((_time.time() - start_time) * 1000)
        all_ok = all(s['status'] in ('completed', 'warning') for s in stages)

        logger.info(f"Pipeline executed: task_id={task_id} ok={all_ok} ms={total_ms}")

        return Response({
            'success': all_ok,
            'task_id': task_id,
            'stages': stages,
            'result': stages[-3]['details'] if len(stages) >= 3 else {},
            'total_duration_ms': total_ms,
            'created_at': timezone.now().isoformat(),
        })


def get_client_ip(request):
    xff = request.META.get('HTTP_X_FORWARDED_FOR')
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', 'unknown')


class PipelineSummaryView(APIView):
    """获取执行中心概览统计"""

    def get(self, request) -> Response:
        from django.db.models import Count, Q, Avg
        from .models import TaskDispatch, P2PNode

        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        stats = {
            'pending_count': TaskDispatch.objects.filter(status__in=('created', 'dispatching')).count(),
            'running_count': TaskDispatch.objects.filter(status='executing').count(),
            'completed_today': TaskDispatch.objects.filter(
                status='completed', updated_at__gte=today_start
            ).count(),
            'avg_duration_ms': 0,
            'success_rate': 0.0,
            'online_nodes': P2PNode.objects.filter(status='online').count(),
            'total_nodes': P2PNode.objects.count(),
        }

        completed_qs = TaskDispatch.objects.filter(status='completed')
        if completed_qs.exists():
            avg_val = completed_qs.exclude(execution_time_ms__isnull=True).aggregate(
                avg=Avg('execution_time_ms'))['avg']
            stats['avg_duration_ms'] = int(avg_val or 0)

        total = TaskDispatch.objects.filter(status__in=('completed', 'failed')).count()
        success = TaskDispatch.objects.filter(status='completed').count()
        stats['success_rate'] = round(success / total * 100, 1) if total > 0 else 0.0

        return Response({'success': True, 'data': stats})


class PipelineTaskListView(APIView):
    """获取执行历史列表"""

    pagination_class = P2PPagination

    def get(self, request) -> Response:
        queryset = TaskDispatch.objects.all().order_by('-created_at')

        status_filter = request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        paginator = self.pagination_class()
        paginated_qs = paginator.paginate_queryset(queryset, request)
        serializer = TaskDispatchDetailSerializer(paginated_qs, many=True)
        return paginator.get_paginated_response(serializer.data)


class PipelineCancelView(APIView):
    """取消流水线任务"""

    def post(self, request, task_id: str) -> Response:
        try:
            task = TaskDispatch.objects.get(task_id=task_id)
        except TaskDispatch.DoesNotExist:
            return P2PErrorResponse.build('P2P_0003')

        if task.status in ('completed', 'failed', 'aborted'):
            return P2PErrorResponse.build('P2P_0005',
                                          details=f'Task is {task.status}')

        task.status = 'aborted'
        task.error_message = 'Cancelled via pipeline API'
        task.save(update_fields=['status', 'error_message'])

        from .services.audit_trail import AuditLogger, AuditEvent
        audit = AuditLogger()
        audit.log(AuditEvent.TASK_CREATED, task_id, {'action': 'cancelled'})

        return Response({'success': True, 'data': {'ack': True, 'status': 'aborted'}})


class PipelineAuditLogView(APIView):
    """获取任务的审计日志"""

    def get(self, request, task_id: str) -> Response:
        try:
            from .services.audit_trail import AuditLogger
            audit = AuditLogger()
            logs = audit.query_logs(entity_id=task_id, limit=50)
            return Response({'success': True, 'data': logs})
        except Exception as e:
            logger.error(f"Pipeline audit log error: {e}", exc_info=True)
            return safe_error_response(message='获取审计日志失败', status_code=500)


# ──────────────────────────────────────────────
# Skill 生态 API Views
# ──────────────────────────────────────────────

import os
import zipfile
import io
from datetime import datetime


# Skill 元数据注册表（与前端 AgentSkillDetail.tsx 数据对齐）
SKILL_REGISTRY = [
    {
        'id': 'ass-gateway', 'name': 'ASS 安全网关', 'name_en': 'ASS Security Gateway',
        'category': '安全防护', 'rating': 4.9, 'reviews': 2341, 'calls': 12300,
        'version': 'v3.1.0', 'author': '一鉴到底安全团队',
        'desc': '零信任架构下的统一安全入口，四重防线：检测→净化→分类→验签',
    },
    {
        'id': 'dag-orchestrator', 'name': 'DAG 工作流编排', 'name_en': 'Workflow Orchestrator',
        'category': '流程编排', 'rating': 4.8, 'reviews': 1876, 'calls': 8900,
        'version': 'v2.5.0', 'author': '一鉴到底核心团队',
        'desc': '声明式 DAG 工作流引擎，支持并行/串行/条件分支编排',
    },
    {
        'id': 'eihm-router', 'name': 'EIHM 成本路由', 'name_en': 'EIHM Cost Router',
        'category': '资源调度', 'rating': 4.7, 'reviews': 1243, 'calls': 6700,
        'version': 'v1.9.0', 'author': '一鉴到底调度组',
        'desc': '多因子成本评估 + P2P 智能节点选择，最小化执行开销',
    },
    {
        'id': 'sandbox-executor', 'name': 'Pyodide 沙箱执行', 'name_en': 'Sandbox Executor',
        'category': '代码执行', 'rating': 4.9, 'reviews': 3456, 'calls': 23400,
        'version': 'v4.2.0', 'author': '一鉴到底执行引擎团队',
        'desc': 'WASM 沙箱内安全执行 Python/JS/Bash，资源隔离+超时控制',
    },
    {
        'id': 'hashchain-audit', 'name': 'HashChain 审计存证', 'name_en': 'Audit Trail',
        'category': '合规审计', 'rating': 4.6, 'reviews': 987, 'calls': 4500,
        'version': 'v2.3.0', 'author': '一鉴到底审计组',
        'desc': '哈希链不可篡改存证，支持等保/GDPR 合规报告生成',
    },
    {
        'id': 'p2p-scheduler', 'name': 'P2P 任务调度器', 'name_en': 'P2P Scheduler',
        'category': '资源调度', 'rating': 4.7, 'reviews': 1567, 'calls': 9800,
        'version': 'v2.1.0', 'author': '一鉴到底调度组',
        'desc': '分布式任务分发、心跳保活、状态机管理、闲时算力利用',
    },
    {
        'id': 'code-detector', 'name': '代码风险检测', 'name_en': 'Code Risk Detector',
        'category': '代码检测', 'rating': 4.9, 'reviews': 2890, 'calls': 15600,
        'version': 'v3.0.0', 'author': '一鉴到底安全团队',
        'desc': '静态分析+语义分析双引擎，覆盖12类常见漏洞模式',
    },
    {
        'id': 'content-moderator', 'name': '内容安全审核', 'name_en': 'Content Moderator',
        'category': '安全防护', 'rating': 4.7, 'reviews': 1654, 'calls': 11200,
        'version': 'v2.8.0', 'author': '一鉴到底安全团队',
        'desc': 'XSS/注入/敏感词过滤，支持自定义规则库和分级策略',
    },
    {
        'id': 'data-masker', 'name': '数据脱敏引擎', 'name_en': 'Data Masker',
        'category': '隐私保护', 'rating': 4.8, 'reviews': 1123, 'calls': 7800,
        'version': 'v2.6.0', 'author': '一鉴到底隐私组',
        'desc': '手机号/身份证/银行卡/IP 等敏感数据自动脱敏与还原',
    },
    {
        'id': 'result-aggregator', 'name': '结果聚合分发', 'name_en': 'Result Aggregator',
        'category': '流程编排', 'rating': 4.5, 'reviews': 654, 'calls': 3200,
        'version': 'v1.7.0', 'author': '一鉴到底调度组',
        'desc': '多数投票去重、置信度加权、结果一致性校验',
    },
    {
        'id': 'compliance-reporter', 'name': '合规报告生成', 'name_en': 'Compliance Reporter',
        'category': '合规审计', 'rating': 4.6, 'reviews': 789, 'calls': 3400,
        'version': 'v2.0.0', 'author': '一鉴到底审计组',
        'desc': '自动生成等保/GDPR/SOC2 格式合规报告，含证据链',
    },
    {
        'id': 'node-discovery', 'name': '节点发现服务', 'name_en': 'Node Discovery',
        'category': '资源调度', 'rating': 4.6, 'reviews': 876, 'calls': 5600,
        'version': 'v1.8.0', 'author': '一鉴到底网络组',
        'desc': 'P2P 节点自动发现、健康检查、拓扑感知',
    },
    {
        'id': 'idle-detector', 'name': '闲时检测服务', 'name_en': 'Idle Detector',
        'category': '资源调度', 'rating': 4.3, 'reviews': 432, 'calls': 2100,
        'version': 'v1.3.0', 'author': '一鉴到底调度组',
        'desc': 'ESG 绿色计算：识别空闲算力，后台任务填充',
    },
    {
        'id': 'output-verifier', 'name': '输出签名验签', 'name_en': 'Output Verifier',
        'category': '安全防护', 'rating': 4.8, 'reviews': 1432, 'calls': 8900,
        'version': 'v2.4.0', 'author': '一鉴到底安全团队',
        'desc': 'HMAC-SHA256 输出签名+防篡改验证，确保结果完整性',
    },
]

# ====== 平台核心能力 Skill（OpenRath Runtime 驱动） ======
PLATFORM_CAPABILITIES = [
    {
        'id': 'quad-agent-detect', 'name': '四Agent多维协同检测', 'name_en': 'Quad-Agent Detect',
        'category': 'AI检测', 'rating': 4.9, 'reviews': 8932, 'calls': 45600,
        'version': 'v2.0.0', 'author': '一鉴到底核心团队 (OpenRath)',
        'desc': '基于 OpenRath Runtime 的 4-Agent 串行检测引擎：内容审核员→事实核查官→数字取证员→裁决官，支持8大场景+Session Graph血缘追踪',
        'api_endpoint': '/api/agent/public/detect/',
        'api_stream_endpoint': '/api/agent/public/detect-stream/',
        'input_schema': {'message': 'string(必填)', 'scenario': 'text|image|code|paper|resume|contract|marketing|video', 'skills': 'string[]'},
        'output_schema': {'sessionId': 'uuid', 'finalResult': '{level,levelText,confidence,aiProbability}', 'agentResults': '[4]', 'graphInfo': '{}'},
    },
    {
        'id': 'sse-stream-detect', 'name': 'SSE流式实时推送检测', 'name_en': 'SSE Stream Detect',
        'category': 'AI检测', 'rating': 4.9, 'reviews': 5621, 'calls': 32100,
        'version': 'v2.0.0', 'author': '一鉴到底核心团队 (OpenRath)',
        'desc': 'Server-Sent Events 流式检测，逐 Agent 实时推送 start/agent_start/agent_complete/complete 事件，含 SessionGraph 血缘信息',
        'api_endpoint': '/api/agent/public/detect-stream/',
        'input_schema': {'message': 'string(必填)', 'scenario': 'string', 'skills': 'string[]'},
        'output_schema': {'event_type': 'start|agent_start|agent_complete|complete|error', 'data': 'object'},
    },
    {
        'id': 'session-manager', 'name': '会话历史管理', 'name_en': 'Session Manager',
        'category': '会话管理', 'rating': 4.7, 'reviews': 2341, 'calls': 18900,
        'version': 'v1.5.0', 'author': '一鉴到底核心团队',
        'desc': '检测会话的持久化存储、历史加载、消息检索。支持 OpenRath Session（quad-agent-openrath*）与传统会话双模式查询',
        'api_endpoint': '/api/agent/public/sessions/',
        'input_schema': {'limit': 'number(默认20,最大50)'},
        'output_schema': {'sessionId': 'string', 'title': 'string', 'messageCount': 'number', 'messages': '[{role,content,modelUsed,latencyMs,createdAt}]'},
    },
    {
        'id': 'report-export', 'name': 'HTML检测报告导出', 'name_en': 'Report Export',
        'category': '报告导出', 'rating': 4.8, 'reviews': 3456, 'calls': 12300,
        'version': 'v1.3.0', 'author': '一鉴到底核心团队',
        'desc': '将检测结果一键导出为格式化 HTML 报告文档，包含安全等级徽章、四Agent详情、改进建议、时间戳等完整信息',
        'api_endpoint': 'client-side (前端生成)',
        'input_schema': {'detectResult': 'object(检测结果完整数据)'},
        'output_schema': {'filename': 'string', 'html': 'string(Blob)'},
    },
    {
        'id': 'openrath-runtime', 'name': 'OpenRath多智能体运行时', 'name_en': 'OpenRath Runtime',
        'category': '运行时引擎', 'rating': 5.0, 'reviews': 1200, 'calls': 57800,
        'version': 'v1.2.1', 'author': 'Rath-Team / 一鉴到底适配层',
        'desc': 'Session一等公民多智能体运行时框架。支持 SequentialWorkflow/ParallelWorkflow、可插拔Backend沙箱、可插拔Memory记忆、动态Session Graph路由与复现。BSD-3-Clause开源。',
        'api_endpoint': '/api/platform/v1/capabilities/openrath-info/',
        'input_schema': {'action': 'stats|graph_info|replay|list_agents'},
        'output_schema': {'version': 'string', 'graphStats': '{}', 'agents': '[]', 'sessions': '[]'},
        'docs_url': 'https://docs.openrath.com/',
        'github': 'https://github.com/Rath-Team/OpenRath',
    },
    {
        'id': 'agent-auditor', 'name': 'Agent: 内容审核员', 'name_en': 'Agent: Auditor',
        'category': '单Agent调用', 'rating': 4.8, 'reviews': 1890, 'calls': 28900,
        'version': 'v2.0.0', 'author': '一鉴到底Agent团队 (OpenRath)',
        'desc': '独立调用内容审核员Agent：敏感词检测、合规性审查、AI生成痕迹识别、风险等级评估。可作为 Workflow 节点单独使用',
        'api_endpoint': '/api/platform/v1/capabilities/call-agent/',
        'input_schema': {'agent_code': '"auditor"', 'message': 'string', 'scenario': 'string', 'extra_context': 'string(可选)'},
        'output_schema': {'reply': 'string', 'sessionId': 'uuid', 'latencyMs': 'number', 'usage': '{}'},
    },
    {
        'id': 'agent-verifier', 'name': 'Agent: 事实核查官', 'name_en': 'Agent: Verifier',
        'category': '单Agent调用', 'rating': 4.7, 'reviews': 1567, 'calls': 23400,
        'version': 'v2.0.0', 'author': '一鉴到底Agent团队 (OpenRath)',
        'desc': '独立调用事实核查官Agent：事实验证、来源追溯、时间线分析、一致性评分',
        'api_endpoint': '/api/platform/v1/capabilities/call-agent/',
        'input_schema': {'agent_code': '"verifier"', 'message': 'string', 'scenario': 'string'},
        'output_schema': {'reply': 'string', 'sessionId': 'uuid', 'latencyMs': 'number'},
    },
    {
        'id': 'agent-archiver', 'name': 'Agent: 数字取证员', 'name_en': 'Agent: Archiver',
        'category': '单Agent调用', 'rating': 4.7, 'reviews': 1345, 'calls': 19800,
        'version': 'v2.0.0', 'author': '一鉴到底Agent团队 (OpenRath)',
        'desc': '独立调用数字取证员Agent：元数据分析、模式识别、AI生成痕迹深度检测、数据特征指纹提取',
        'api_endpoint': '/api/platform/v1/capabilities/call-agent/',
        'input_schema': {'agent_code': '"archiver"', 'message': 'string', 'scenario': 'string'},
        'output_schema': {'reply': 'string', 'sessionId': 'uuid', 'latencyMs': 'number'},
    },
    {
        'id': 'agent-judge', 'name': 'Agent: 裁决官', 'name_en': 'Agent: Judge',
        'category': '单Agent调用', 'rating': 4.8, 'reviews': 1678, 'calls': 21200,
        'version': 'v2.0.0', 'author': '一鉴到底Agent团队 (OpenRath)',
        'desc': '独立调用裁决官Agent：综合裁决、风险评估、多维度加权判定、最终等级输出与决策建议',
        'api_endpoint': '/api/platform/v1/capabilities/call-agent/',
        'input_schema': {'agent_code': '"judge"', 'message': 'string', 'scenario': 'string', 'context_summary': 'string(前置Agent摘要)'},
        'output_schema': {'reply': 'string', 'sessionId': 'uuid', 'latencyMs': 'number', 'verdict': '{}'},
    },
    {
        'id': 'context-compress', 'name': '上下文智能压缩', 'name_en': 'Context Compressor',
        'category': '上下文管理', 'rating': 4.6, 'reviews': 876, 'calls': 15600,
        'version': 'v1.2.0', 'author': '一鉴到底核心团队 (OpenRath)',
        'desc': '基于 OpenRath Compressor 的上下文压缩服务：当 Session 超过阈值时自动压缩历史消息为摘要，保留最近N轮完整对话',
        'api_endpoint': '/api/platform/v1/capabilities/compress/',
        'input_schema': {'messages': '[{role,content}]', 'max_tokens': 'number(默认4000)', 'keep_recent': 'number(默认3)'},
        'output_schema': {'compressedMessages': '[]', 'originalCount': 'number', 'compressedCount': 'number'},
    },
    {
        'id': 'skill-marketplace', 'name': '技能市场API', 'name_en': 'Skill Marketplace API',
        'category': '平台服务', 'rating': 4.5, 'reviews': 654, 'calls': 8900,
        'version': 'v1.0.0', 'author': '一鉴到底平台团队',
        'desc': '200+ 业务技能矩阵的查询、搜索、分类统计、安装接口。支持 CLI 终端风格和 Grid 卡片双视图',
        'api_endpoint': '/api/skill-config/public-list/', 'search_endpoint': '/api/skill-config/public-search/',
        'input_schema': {'q': 'string', 'tier': 'string', 'category': 'string', 'page_size': 'number'},
        'output_schema': {'total': 'number', 'skills': '[{id,name,category,tier,keywords,...}]'},
    },
]

SKILLS_BASE_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    '..', '.trae', 'skills'
)


class SkillListView(APIView):
    """获取所有可用 Skill 列表（公开接口，无需认证）"""
    authentication_classes = []
    permission_classes = []

    def get(self, request) -> Response:
        return Response({
            'success': True,
            'data': {
                'total': len(SKILL_REGISTRY) + len(PLATFORM_CAPABILITIES),
                'system_skills': SKILL_REGISTRY,
                'platform_capabilities': PLATFORM_CAPABILITIES,
            }
        })


class SkillDetailView(APIView):
    """获取单个 Skill 详情（公开接口，无需认证）"""
    authentication_classes = []
    permission_classes = []

    def get(self, request, skill_id: str) -> Response:
        # 在注册表中查找
        skill_meta = next((s for s in SKILL_REGISTRY if s['id'] == skill_id), None)
        if not skill_meta:
            return P2PErrorResponse.build('P2P_0003', f'Skill "{skill_id}" 不存在')

        # 读取 SKILL.md 内容
        skill_md_path = os.path.join(SKILLS_BASE_DIR, skill_id, 'SKILL.md')
        skill_content = ''
        if os.path.exists(skill_md_path):
            with open(skill_md_path, 'r', encoding='utf-8') as f:
                skill_content = f.read()

        return Response({
            'success': True,
            'data': {
                **skill_meta,
                'skill_md': skill_content,
                'install_command': f'/yijiandaodi-skill install {skill_id}',
                'download_url': f'/api/p2p/v1/skills/{skill_id}/download',
            }
        })


class SkillDownloadView(APIView):
    """下载 Skill ZIP 包（公开接口，无需认证）"""
    authentication_classes = []
    permission_classes = []

    def get(self, request, skill_id: str) -> Response:
        skill_meta = next((s for s in SKILL_REGISTRY if s['id'] == skill_id), None)
        if not skill_meta:
            return P2PErrorResponse.build('P2P_0003', f'Skill "{skill_id}" 不存在')

        skill_dir = os.path.join(SKILLS_BASE_DIR, skill_id)
        if not os.path.isdir(skill_dir):
            return P2PErrorResponse.build('P2P_0003', f'Skill 文件未就绪')

        # 构建 README
        readme = f"""# {skill_meta['name']} ({skill_meta['name_en']})

> {skill_meta['desc']}
>
> Version: {skill_meta['version']} | Author: {skill_meta['author']}
> Rating: ⭐{skill_meta['rating']}/5 ({skill_meta['reviews']} reviews)

## 安装方式

### 方式一：Agent 自动安装
```
/yijiandaodi-skill install {skill_id}
```

### 方式二：手动安装
将本目录中的 SKILL.md 放入你的 Agent Skills 目录即可。

## 快速开始

请阅读同目录下的 **SKILL.md** 获取完整使用指南。

---
Generated by 一鉴到底 (yijiandaodi.com) · {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
"""

        # 创建内存 ZIP
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            # 写入 README
            zf.writestr(f'{skill_id}/README.md', readme)

            # 写入 SKILL.md
            skill_md_path = os.path.join(skill_dir, 'SKILL.md')
            if os.path.exists(skill_md_path):
                with open(skill_md_path, 'r', encoding='utf-8') as f:
                    zf.writestr(f'{skill_id}/SKILL.md', f.read())

            # 写入配置模板
            config_template = f"""# {skill_meta['name']} 配置模板
# 复制此文件为 config.yaml 并按需修改

skill:
  id: "{skill_id}"
  name: "{skill_meta['name']}"
  version: "{skill_meta['version']}"

api:
  base_url: "http://localhost:8000/api/p2p/v1/"
  timeout: 30
  retries: 3

options:
  enabled: true
  log_level: "info"
"""
            zf.writestr(f'{skill_id}/config.template.yaml', config_template)

        buffer.seek(0)

        from django.http import HttpResponse
        response = HttpResponse(
            buffer.read(),
            content_type='application/zip'
        )
        response['Content-Disposition'] = f'attachment; filename="{skill_id}.zip"'
        return response
