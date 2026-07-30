"""
L2 任务编排引擎 - DAG 工作流引擎 + Multi-Agent 编排

核心能力:
- DAG 有向无环图工作流定义与执行
- Multi-Agent 协作 (auditor / verifier / archiver / judge)
- 任务自动拆分为 Shard
- 与 TaskStateMachine 状态机集成
- 优先级队列 (critical > high > normal)
"""

import uuid
import hashlib
import logging
from collections import defaultdict, deque
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

from django.utils import timezone

from ..models import TaskDispatch, TaskShard
from .task_state_machine import TaskStateMachine, TaskState

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
# 枚举 & 常量
# ──────────────────────────────────────────────

class AgentRole(str, Enum):
    """Agent 角色枚举"""
    AUDITOR = "auditor"
    VERIFIER = "verifier"
    ARCHIVER = "archiver"
    JUDGE = "judge"
    EXECUTOR = "executor"
    GUARD = "guard"


class WorkflowStatus(str, Enum):
    """工作流状态"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


PRIORITY_ORDER = {"critical": 0, "high": 1, "normal": 2, "low": 3}


# ──────────────────────────────────────────────
# 预设工作流模板
# ──────────────────────────────────────────────

WORKFLOW_TEMPLATES = {
    'code_audit': [
        'input_guard', 'static_scan', 'dynamic_scan', 'audit_report',
    ],
    'content_verify': [
        'extractor', 'auditor', 'verifier', 'judge', 'archiver',
    ],
    'ai_execute': [
        'security_check', 'sandbox_exec', 'result_collect', 'audit_log',
    ],
}

TEMPLATE_NODE_DEFS = {
    # code_audit 模板节点定义
    'input_guard': {
        'agent_role': AgentRole.GUARD.value,
        'security_level': 'high',
        'estimated_resources': {'cpu_cores': 1, 'memory_mb': 512},
    },
    'static_scan': {
        'agent_role': AgentRole.AUDITOR.value,
        'security_level': 'normal',
        'estimated_resources': {'cpu_cores': 2, 'memory_mb': 1024},
    },
    'dynamic_scan': {
        'agent_role': AgentRole.AUDITOR.value,
        'security_level': 'critical',
        'estimated_resources': {'cpu_cores': 4, 'memory_mb': 2048},
    },
    'audit_report': {
        'agent_role': AgentRole.ARCHIVER.value,
        'security_level': 'normal',
        'estimated_resources': {'cpu_cores': 1, 'memory_mb': 512},
    },
    # content_verify 模板节点定义
    'extractor': {
        'agent_role': AgentRole.EXECUTOR.value,
        'security_level': 'normal',
        'estimated_resources': {'cpu_cores': 1, 'memory_mb': 512},
    },
    'auditor': {
        'agent_role': AgentRole.AUDITOR.value,
        'security_level': 'high',
        'estimated_resources': {'cpu_cores': 2, 'memory_mb': 1024},
    },
    'verifier': {
        'agent_role': AgentRole.VERIFIER.value,
        'security_level': 'high',
        'estimated_resources': {'cpu_cores': 2, 'memory_mb': 1024},
    },
    'judge': {
        'agent_role': AgentRole.JUDGE.value,
        'security_level': 'critical',
        'estimated_resources': {'cpu_cores': 1, 'memory_mb': 512},
    },
    'archiver': {
        'agent_role': AgentRole.ARCHIVER.value,
        'security_level': 'normal',
        'estimated_resources': {'cpu_cores': 1, 'memory_mb': 256},
    },
    # ai_execute 模板节点定义
    'security_check': {
        'agent_role': AgentRole.GUARD.value,
        'security_level': 'critical',
        'estimated_resources': {'cpu_cores': 1, 'memory_mb': 512},
    },
    'sandbox_exec': {
        'agent_role': AgentRole.EXECUTOR.value,
        'security_level': 'critical',
        'estimated_resources': {'cpu_cores': 4, 'memory_mb': 4096},
    },
    'result_collect': {
        'agent_role': AgentRole.VERIFIER.value,
        'security_level': 'high',
        'estimated_resources': {'cpu_cores': 1, 'memory_mb': 512},
    },
    'audit_log': {
        'agent_role': AgentRole.ARCHIVER.value,
        'security_level': 'normal',
        'estimated_resources': {'cpu_cores': 1, 'memory_mb': 256},
    },
}


# ──────────────────────────────────────────────
# DAG 节点
# ──────────────────────────────────────────────

@dataclass
class DAGNode:
    """DAG 节点 - 工作流中的单个任务单元"""
    node_id: str
    agent_role: str  # auditor/verifier/archiver/judge/executor/guard
    payload: dict = field(default_factory=dict)
    dependencies: list[str] = field(default_factory=list)  # 依赖的 node_id 列表
    security_level: str = "normal"
    estimated_resources: dict = field(default_factory=dict)
    priority: str = "normal"
    status: str = "pending"  # pending / running / completed / failed / skipped
    result: Optional[dict] = None
    error: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None


# ──────────────────────────────────────────────
# DAG 校验异常
# ──────────────────────────────────────────────

class DAGCycleError(Exception):
    """DAG 存在环"""
    pass


class WorkflowNotFoundError(Exception):
    """工作流不存在"""
    pass


class InvalidTransitionError(Exception):
    """非法状态转换"""
    pass


# ──────────────────────────────────────────────
# 核心编排器
# ──────────────────────────────────────────────

class WorkflowOrchestrator:
    """
    工作流编排器 - L2 层核心引擎

    负责:
    1. DAG 工作流的创建、校验（无环检测）、执行
    2. Multi-Agent 任务调度
    3. 将工作流节点拆分为 TaskShard 并对接 TaskDispatch
    4. 优先级队列管理
    """

    def __init__(self):
        self.workflows: dict[str, dict] = {}  # workflow_id -> workflow 元数据 + DAG
        self._ready_queue: list[tuple[int, str, str]] = []  # (priority_order, workflow_id, node_id)

    # ── 工作流生命周期 ─────────────────────

    def create_workflow(
        self,
        name: str,
        tasks: list[DAGNode],
        priority: str = "normal",
        metadata: Optional[dict] = None,
    ) -> str:
        """
        创建工作流，返回 workflow_id

        同时执行 DAG 无环校验 (拓扑排序 / DFS)
        """
        workflow_id = f"WF-{uuid.uuid4().hex[:12].upper()}"

        # 构建 adjacency list 用于环路检测
        node_map: dict[str, DAGNode] = {t.node_id: t for t in tasks}
        self._validate_dag(node_map)

        workflow = {
            "workflow_id": workflow_id,
            "name": name,
            "status": WorkflowStatus.PENDING.value,
            "priority": priority,
            "metadata": metadata or {},
            "nodes": node_map,
            "completed_nodes": set(),
            "failed_nodes": set(),
            "created_at": timezone.now().isoformat(),
            "task_dispatch_id": None,  # 关联的 TaskDispatch ID
        }

        self.workflows[workflow_id] = workflow
        logger.info(f"Workflow created: {workflow_id} name={name} nodes={len(tasks)}")

        return workflow_id

    def create_workflow_from_template(
        self,
        template_name: str,
        payload_overrides: Optional[dict[str, dict]] = None,
        priority: str = "normal",
        metadata: Optional[dict] = None,
    ) -> str:
        """
        从预设模板创建工作流

        Args:
            template_name: 模板名称 (code_audit / content_verify / ai_execute)
            payload_overrides: 各节点的 payload 覆盖 {node_id: {...}}
            priority: 优先级
            metadata: 附加元数据
        """
        if template_name not in WORKFLOW_TEMPLATES:
            raise ValueError(
                f"Unknown template: {template_name}. "
                f"Available: {list(WORKFLOW_TEMPLATES.keys())}"
            )

        step_names = WORKFLOW_TEMPLATES[template_name]
        overrides = payload_overrides or {}
        nodes: list[DAGNode] = []

        for idx, step in enumerate(step_names):
            node_def = TEMPLATE_NODE_DEFS.get(step, {})
            deps = [step_names[idx - 1]] if idx > 0 else []

            nodes.append(DAGNode(
                node_id=step,
                agent_role=node_def.get("agent_role", "executor"),
                payload=overrides.get(step, {}),
                dependencies=deps,
                security_level=node_def.get("security_level", "normal"),
                estimated_resources=node_def.get("estimated_resources", {}),
                priority=priority,
            ))

        return self.create_workflow(
            name=f"template:{template_name}",
            tasks=nodes,
            priority=priority,
            metadata={**(metadata or {}), "template": template_name},
        )

    # ── 执行控制 ──────────────────────────────

    def start_workflow(self, workflow_id: str) -> None:
        """启动工作流，将状态切换为 RUNNING 并初始化就绪队列"""
        wf = self._get_workflow(workflow_id)
        if wf["status"] != WorkflowStatus.PENDING.value:
            raise InvalidTransitionError(
                f"Cannot start workflow in state: {wf['status']}"
            )

        wf["status"] = WorkflowStatus.RUNNING.value
        self._rebuild_ready_queue(workflow_id)
        logger.info(f"Workflow started: {workflow_id}")

    def get_ready_tasks(self, workflow_id: str) -> list[DAGNode]:
        """
        获取当前可执行的任务（所有依赖已完成）

        返回按优先级排序的任务列表
        """
        wf = self._get_workflow(workflow_id)
        ready = []

        for node_id, node in wf["nodes"].items():
            if node.status != "pending":
                continue
            # 所有依赖都已完成才算就绪
            all_deps_done = all(
                dep_id in wf["completed_nodes"]
                for dep_id in node.dependencies
            )
            if all_deps_done:
                ready.append(node)

        # 按优先级排序: critical > high > normal > low
        ready.sort(key=lambda n: PRIORITY_ORDER.get(n.priority, 99))
        return ready

    def mark_task_completed(
        self,
        workflow_id: str,
        task_id: str,
        result: Optional[dict] = None,
    ) -> None:
        """
        标记任务完成，触发下游就绪检查

        同时更新关联的 TaskShard 状态
        """
        wf = self._get_workflow(workflow_id)
        node = wf["nodes"].get(task_id)
        if not node:
            raise ValueError(f"Node {task_id} not found in workflow {workflow_id}")

        if node.status in ("completed", "failed", "skipped"):
            raise InvalidTransitionError(f"Node {task_id} already terminal: {node.status}")

        node.status = "completed"
        node.result = result
        node.completed_at = timezone.now().isoformat()
        wf["completed_nodes"].add(task_id)

        # 触发下游就绪重新计算
        self._rebuild_ready_queue(workflow_id)

        # 检查工作流是否全部完成
        if self.is_workflow_complete(workflow_id):
            wf["status"] = WorkflowStatus.COMPLETED.value
            logger.info(f"Workflow completed: {workflow_id}")

        logger.info(f"Task completed: {workflow_id}/{task_id}")

    def mark_task_failed(
        self,
        workflow_id: str,
        task_id: str,
        error: str,
    ) -> None:
        """标记任务失败"""
        wf = self._get_workflow(workflow_id)
        node = wf["nodes"].get(task_id)
        if not node:
            raise ValueError(f"Node {task_id} not found")

        node.status = "failed"
        node.error = error
        node.completed_at = timezone.now().isoformat()
        wf["failed_nodes"].add(task_id)

        # 可选：失败后是否取消整个工作流取决于策略
        # 此处仅标记该节点失败，下游依赖节点将被阻塞
        logger.warning(f"Task failed: {workflow_id}/{task_id} error={error}")

    def cancel_workflow(self, workflow_id: str, reason: str = "") -> None:
        """取消工作流"""
        wf = self._get_workflow(workflow_id)
        if wf["status"] in (WorkflowStatus.COMPLETED.value, WorkflowStatus.CANCELLED.value):
            raise InvalidTransitionError(f"Workflow already terminal: {wf['status']}")

        wf["status"] = WorkflowStatus.CANCELLED.value
        wf["metadata"]["cancel_reason"] = reason

        # 将所有 pending/running 的节点标记为 skipped
        for node in wf["nodes"].values():
            if node.status in ("pending", "running"):
                node.status = "skipped"

        logger.info(f"Workflow cancelled: {workflow_id} reason={reason}")

    # ── 状态查询 ──────────────────────────────

    def is_workflow_complete(self, workflow_id: str) -> bool:
        """检查工作流是否全部完成"""
        wf = self._get_workflow(workflow_id)
        total = len(wf["nodes"])
        completed = len(wf["completed_nodes"])
        failed = len(wf["failed_nodes"])
        return (completed + failed) >= total

    def get_workflow_progress(self, workflow_id: str) -> dict:
        """
        获取工作流进度

        Returns:
            {
                "workflow_id": "...",
                "status": "running",
                "total_tasks": 5,
                "completed": 2,
                "failed": 0,
                "pending": 3,
                "percentage": 40.0,
                "ready_tasks": ["node_id", ...],
                "node_details": [...],
            }
        """
        wf = self._get_workflow(workflow_id)
        nodes = wf["nodes"]
        total = len(nodes)

        status_counts = defaultdict(int)
        for node in nodes.values():
            status_counts[node.status] += 1

        completed = status_counts.get("completed", 0)
        percentage = round((completed / total * 100), 1) if total > 0 else 0.0

        ready_tasks = self.get_ready_tasks(workflow_id)

        return {
            "workflow_id": workflow_id,
            "name": wf["name"],
            "status": wf["status"],
            "priority": wf["priority"],
            "total_tasks": total,
            "completed": completed,
            "failed": status_counts.get("failed", 0),
            "pending": status_counts.get("pending", 0),
            "running": status_counts.get("running", 0),
            "skipped": status_counts.get("skipped", 0),
            "percentage": percentage,
            "ready_task_ids": [n.node_id for n in ready_tasks],
            "task_dispatch_id": wf.get("task_dispatch_id"),
            "created_at": wf["created_at"],
        }

    def get_workflow_detail(self, workflow_id: str) -> dict:
        """获取工作流完整详情（含每个节点状态）"""
        wf = self._get_workflow(workflow_id)
        progress = self.get_workflow_progress(workflow_id)

        node_details = []
        for node_id, node in wf["nodes"].items():
            node_details.append({
                "node_id": node.node_id,
                "agent_role": node.agent_role,
                "status": node.status,
                "dependencies": node.dependencies,
                "security_level": node.security_level,
                "error": node.error,
                "started_at": node.started_at,
                "completed_at": node.completed_at,
            })

        return {
            **progress,
            "metadata": wf.get("metadata", {}),
            "nodes": node_details,
        }

    def list_workflows(self, status_filter: Optional[str] = None) -> list[dict]:
        """列出所有工作流"""
        results = []
        for wf_id, wf in self.workflows.items():
            if status_filter and wf["status"] != status_filter:
                continue
            results.append(self.get_workflow_progress(wf_id))
        return results

    # ── Shard 拆分集成 ────────────────────────

    def sharding_to_task_dispatch(
        self,
        workflow_id: str,
        task_type: str = "mixed",
        security_level: str = "normal",
        privacy_level: str = "public",
        created_by: str = "",
    ) -> TaskDispatch:
        """
        将工作流拆分为 TaskDispatch + TaskShard

        创建一条 TaskDispatch 记录，每个 DAGNode 对应一个 TaskShard
        返回创建的 TaskDispatch 实例
        """
        from ..models import TaskDispatch, TaskShard

        wf = self._get_workflow(workflow_id)
        nodes = wf["nodes"]

        task_id = f"TASK-{uuid.uuid4().hex[:12].upper()}"

        dispatch = TaskDispatch.objects.create(
            task_id=task_id,
            task_type=task_type,
            status="sharding",
            priority=wf["priority"],
            total_shards=len(nodes),
            security_level=security_level,
            privacy_level=privacy_level,
            created_by=created_by,
        )

        shard_objects = []
        for seq, (node_id, node) in enumerate(nodes.items(), start=1):
            shard_id = f"{task_id}-SHARD-{seq:04d}"
            payload_str = str(node.payload)
            payload_hash = hashlib.sha256(payload_str.encode()).hexdigest()

            shard_objects.append(TaskShard(
                shard_id=shard_id,
                task=dispatch,
                sequence=seq,
                total_in_task=len(nodes),
                payload_hash=payload_hash,
                payload_size=len(payload_str.encode()),
                dependencies=node.dependencies,
                required_capabilities=[node.agent_role],
                estimated_resources=node.estimated_resources,
                security_level=node.security_level,
            ))

        TaskShard.objects.bulk_create(shard_objects)

        dispatch.status = "dispatching"
        dispatch.save(update_fields=["status"])

        wf["task_dispatch_id"] = task_id

        logger.info(
            f"Workflow sharded: {workflow_id} -> TaskDispatch={task_id} "
            f"shards={len(shard_objects)}"
        )

        return dispatch

    # ── 内部方法 ──────────────────────────────

    def _get_workflow(self, workflow_id: str) -> dict:
        """获取工作流，不存在则抛异常"""
        if workflow_id not in self.workflows:
            raise WorkflowNotFoundError(f"Workflow not found: {workflow_id}")
        return self.workflows[workflow_id]

    def _validate_dag(self, node_map: dict[str, DAGNode]) -> None:
        """
        DAG 无环校验 - 使用 Kahn's algorithm (BFS 拓扑排序)

        如果存在环则抛出 DAGCycleError
        """
        # 计算入度
        in_degree: dict[str, int] = {nid: 0 for nid in node_map}
        adj: dict[str, list[str]] = {nid: [] for nid in node_map}

        for nid, node in node_map.items():
            for dep in node.dependencies:
                if dep not in node_map:
                    raise ValueError(f"Node {nid} depends on unknown node: {dep}")
                adj[dep].append(nid)
                in_degree[nid] += 1

        # Kahn's BFS
        queue = deque([nid for nid, deg in in_degree.items() if deg == 0])
        visited_count = 0

        while queue:
            curr = queue.popleft()
            visited_count += 1
            for neighbor in adj[curr]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

        if visited_count != len(node_map):
            cycle_nodes = [nid for nid, deg in in_degree.items() if deg > 0]
            raise DAGCycleError(
                f"DAG contains cycle involving nodes: {cycle_nodes}"
            )

    def _rebuild_ready_queue(self, workflow_id: str) -> None:
        """重建优先级就绪队列"""
        ready = self.get_ready_tasks(workflow_id)
        self._ready_queue = sorted(
            [(PRIORITY_ORDER.get(n.priority, 99), workflow_id, n.node_id) for n in ready],
            key=lambda x: x[0],
        )

    def cleanup_workflow(self, workflow_id: str) -> None:
        """清理已完成/失败的工作流，释放内存"""
        if workflow_id in self.workflows:
            del self.workflows[workflow_id]
            logger.info(f"Workflow cleaned up: {workflow_id}")


# ──────────────────────────────────────────────
# 全局单例编排器实例
# ──────────────────────────────────────────────

orchestrator_instance = WorkflowOrchestrator()
