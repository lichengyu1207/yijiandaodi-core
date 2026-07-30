"""
L5 P2P 算力网络调度器 - 连接 L4 成本路由引擎与 L5 P2P 网络服务

提供任务提交、分片分配、完成检测、队列状态等核心调度能力。
"""

import logging
import uuid
from typing import Dict, Any, Optional

from django.utils import timezone as dj_tz

from ..models import P2PNode, TaskDispatch, TaskShard
from .cost_router import EIHMCostRouter, ComputeCostEstimator
from .discovery_service import NodeDiscoveryService
from .heartbeat_service import HeartbeatService, P2PServiceError
from .task_state_machine import TaskStateMachine, TaskState, IllegalStateTransitionError

logger = logging.getLogger(__name__)


class TaskScheduler:
    """任务调度器 - 连接 L4 成本路由和 L5 P2P 网络

    编排流程：
    submit_task → 状态机创建 → 分片拆分 → 节点发现 → 成本路由 → 分片分配 → 执行
    """

    def __init__(self):
        self.cost_router = EIHMCostRouter()
        self.discovery = NodeDiscoveryService()
        self.state_machine_class = TaskStateMachine

    def submit_task(self, task_data: dict) -> dict:
        """提交任务全流程

        流程：
        1. 创建 TaskDispatch 记录（状态: sharding）
        2. 拆分为 TaskShards（从 task_data['shards'] 构建）
        3. 发现可用节点
        4. 成本路由分配分片到节点
        5. 更新 Shard.assigned_node_ids，变更 Shard.status 为 dispatched
        6. 状态转移 dispatching → executing
        7. 返回调度结果

        Args:
            task_data: 任务数据字典，需包含：
                - task_type (str): 任务类型
                - security_level (str): 安全级别
                - privacy_level (str): 隐私级别
                - priority (str): 优先级
                - preferred_region (str): 偏好区域
                - shards (list[dict]): 分片列表，每项含 sequence/payload_hash/required_capabilities 等

        Returns:
            调度结果字典：
            {
                'task_id': str,
                'status': str,
                'shard_count': int,
                'assignments': {shard_id: [node_ids]},
                'estimated_cost': float,
            }

        Raises:
            P2PServiceError: 节点不足或路由失败时抛出
            IllegalStateTransitionError: 状态机非法转移时抛出
        """
        shards_data = task_data.pop('shards', [])
        if not shards_data:
            raise P2PServiceError("submit_task requires at least one shard")

        # ---- 1. 创建 TaskDispatch ----
        task_id = f"TASK-{uuid.uuid4().hex[:12].upper()}"

        task = TaskDispatch.objects.create(
            task_id=task_id,
            status='sharding',
            total_shards=len(shards_data),
            **task_data,
        )

        # ---- 2. 拆分 TaskShards ----
        shard_objects = []
        for shard_input in shards_data:
            sid = f"{task_id}-SHARD-{shard_input['sequence']:04d}"
            shard_objects.append(TaskShard(
                shard_id=sid,
                task=task,
                sequence=shard_input['sequence'],
                total_in_task=len(shards_data),
                payload_hash=shard_input.get('payload_hash', ''),
                payload_size=shard_input.get('payload_size', 0),
                dependencies=shard_input.get('dependencies', []),
                required_capabilities=shard_input.get('required_capabilities', []),
                estimated_resources=shard_input.get('estimated_resources', {}),
                security_level=task_data.get('security_level', 'normal'),
                data_sensitivity=task_data.get('privacy_level', 'public'),
            ))
        TaskShard.objects.bulk_create(shard_objects)

        # 初始化状态机
        sm = self.state_machine_class.from_task(task)
        sm.transition_to(TaskState.SHARDING, reason='shards created')

        # ---- 3. 发现可用节点 ----
        all_capabilities = set()
        for s in shards_data:
            for cap in s.get('required_capabilities', []):
                all_capabilities.add(cap)

        discovery_criteria = {
            'status': 'online',
            'required_capabilities': list(all_capabilities),
            'min_reputation': 30.0,
            'location': task_data.get('preferred_region', ''),
            'max_results': 50,
        }
        available_nodes_raw = self.discovery.discover_nodes(discovery_criteria)
        available_node_ids = [n['node_id'] for n in available_nodes_raw]

        available_nodes = list(P2PNode.objects.filter(
            node_id__in=available_node_ids
        ).select_related('reputation'))

        if not available_nodes:
            sm.transition_to(TaskState.FAILED, reason='no_available_nodes')
            raise P2PServiceError(
                f"No available nodes found for task {task_id}. "
                f"Criteria: {discovery_criteria}"
            )

        # ---- 4. 成本路由分配 ----
        routing_result = self.cost_router.route(task, available_nodes)
        assignments = routing_result.get('shard_assignments', {})

        if not assignments or all(len(v) == 0 for v in assignments.values()):
            sm.transition_to(TaskState.FAILED, reason='routing_no_assignments')
            raise P2PServiceError(f"Cost router produced no assignments for task {task_id}")

        # ---- 5. 更新 Shard 分配信息 ----
        for shard in task.shards.all():
            node_ids = assignments.get(shard.shard_id, [])
            shard.assigned_node_ids = node_ids
            shard.status = 'dispatched' if node_ids else 'pending'
            shard.save(update_fields=['assigned_node_ids', 'status'])

        # ---- 6. 状态转移 dispatching → executing ----
        sm.transition_to(TaskState.DISPATCHING, reason='shards dispatched')

        has_executing = task.shards.filter(status='dispatched').exists()
        if has_executing:
            sm.transition_to(TaskState.EXECUTING, reason='shards assigned to nodes')

        logger.info(
            f"Task submitted: {task_id}, shards={len(shards_data)}, "
            f"nodes_used={len(available_nodes)}, "
            f"estimated_cost={routing_result.get('estimated_cost', 0):.6f}"
        )

        return {
            'task_id': task_id,
            'status': task.status,
            'shard_count': len(shards_data),
            'assignments': assignments,
            'estimated_cost': routing_result.get('estimated_cost', 0.0),
            'nodes_considered': routing_result.get('nodes_considered', len(available_nodes)),
            'nodes_filtered': routing_result.get('nodes_filtered', len(available_nodes)),
        }

    def assign_shards_to_nodes(self, task: TaskDispatch) -> dict:
        """为任务的所有分片分配节点

        对已存在的 task 重新执行：发现节点 + 成本路由 + 写入分配结果。

        Args:
            task: 已有的 TaskDispatch 实例

        Returns:
            分配结果字典 {shard_id: [node_ids], estimated_cost: float}
        """
        discovery_criteria = {
            'status': 'online',
            'min_reputation': 30.0,
            'max_results': 50,
        }

        caps_from_shards = set()
        for shard in task.shards.all():
            for cap in (shard.required_capabilities or []):
                caps_from_shards.add(cap)
        if caps_from_shards:
            discovery_criteria['required_capabilities'] = list(caps_from_shards)

        nodes_raw = self.discovery.discover_nodes(discovery_criteria)
        available_nodes = list(P2PNode.objects.filter(
            node_id__in=[n['node_id'] for n in nodes_raw]
        ))

        if not available_nodes:
            logger.warning(f"assign_shards_to_nodes: no nodes for task {task.task_id}")
            return {'shard_assignments': {}, 'estimated_cost': 0.0, 'warning': 'no_available_nodes'}

        result = self.cost_router.route(task, available_nodes)
        assignments = result.get('shard_assignments', {})

        for shard in task.shards.all():
            node_ids = assignments.get(shard.shard_id, [])
            shard.assigned_node_ids = node_ids
            if node_ids:
                shard.status = 'dispatched'
            shard.save(update_fields=['assigned_node_ids', 'status'])

        logger.info(
            f"Shards reassigned: task={task.task_id}, "
            f"assigned={sum(1 for v in assignments.values() if v)}"
        )
        return {
            'shard_assignments': assignments,
            'estimated_cost': result.get('estimated_cost', 0.0),
        }

    def check_task_completion(self, task: TaskDispatch) -> dict:
        """检查任务是否完成，更新最终状态

        规则：
        - 所有分片 completed → COMPLETED
        - 任一分片 failed 且无 pending/dispatching/executing → FAILED
        - 否则保持当前状态继续等待

        Args:
            task: 待检查的 TaskDispatch 实例

        Returns:
            检查结果字典 {
                'task_id': str,
                'current_status': str,
                'is_complete': bool,
                'completed_shards': int,
                'failed_shards': int,
                'total_shards': int,
                'message': str,
            }
        """
        shards = task.shards.all()
        total = shards.count()
        completed = shards.filter(status='completed').count()
        failed = shards.filter(status='failed').count()
        pending_or_active = shards.filter(
            status__in=('pending', 'dispatched', 'executing')
        ).count()

        is_complete = False
        message = ''
        final_status = None

        if completed == total:
            is_complete = True
            final_status = TaskState.COMPLETED
            message = 'All shards completed successfully'

        elif failed > 0 and pending_or_active == 0 and completed + failed == total:
            is_complete = True
            final_status = TaskState.FAILED
            message = f'Task failed: {failed}/{total} shards failed'

        elif failed > 0:
            message = f'{failed} shards failed, {pending_or_active} still active'

        else:
            message = f'{completed}/{total} completed, still executing...'

        if final_status:
            try:
                sm = self.state_machine_class.from_task(task)
                sm.transition_to(final_status, reason=message)
            except IllegalStateTransitionError as e:
                logger.warning(f"Cannot transition to {final_status}: {e}")

        logger.info(
            f"Task completion check: {task.task_id}, "
            f"completed={completed}/{total}, failed={failed}, "
            f"is_complete={is_complete}"
        )

        return {
            'task_id': task.task_id,
            'current_status': task.status,
            'is_complete': is_complete,
            'completed_shards': completed,
            'failed_shards': failed,
            'total_shards': total,
            'message': message,
        }

    def get_queue_status(self) -> dict:
        """获取调度队列状态概览

        Returns:
            队列统计字典 {
                'queue_by_status': {status: count},
                'total_tasks': int,
                'active_tasks': int,
                'total_shards': int,
                'pending_shards': int,
                'avg_wait_seconds': float,
                'topology': dict,
            }
        """
        from django.db.models import Count, Avg

        status_counts = dict(
            TaskDispatch.objects.values_list('status')
            .annotate(count=Count('task_id'))
            .values_list('status', 'count')
        )

        total_tasks = sum(status_counts.values())
        active_statuses = ('sharding', 'dispatching', 'executing', 'aggregating', 'verifying')
        active_tasks = sum(status_counts.get(s, 0) for s in active_statuses)

        total_shards = TaskShard.objects.count()
        pending_shards = TaskShard.objects.filter(
            status__in=('pending', 'dispatched')
        ).count()

        # 平均等待时间（created 至今的 pending 任务）
        from django.db.models.functions import Now
        avg_wait_qs = TaskDispatch.objects.filter(
            status__in=('created', 'sharding', 'dispatching')
        ).annotate(
            wait_secs=Avg(Now() - dj_tz.now())  # 简化：实际可用 F('created_at') 差值
        )
        avg_wait_seconds = 0.0  # 简化实现

        topology = self.discovery.get_network_topology()

        result = {
            'queue_by_status': status_counts,
            'total_tasks': total_tasks,
            'active_tasks': active_tasks,
            'total_shards': total_shards,
            'pending_shards': pending_shards,
            'avg_wait_seconds': avg_wait_seconds,
            'topology': topology,
        }

        logger.debug(f"Queue status: {result}")
        return result
