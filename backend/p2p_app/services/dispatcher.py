import heapq
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from django.db import transaction
from django.utils import timezone as django_timezone

from ..models import P2PNode, TaskDispatch, TaskShard, NodeReputation
from .heartbeat_service import P2PServiceError

logger = logging.getLogger(__name__)


class DispatchStatus(Enum):
    PENDING = "pending"
    DISPATCHED = "dispatched"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"
    TIMEOUT = "timeout"


@dataclass(order=True)
class SchedulableShard:
    priority_score: float
    shard_id: str = field(compare=False)
    task_id: str = field(compare=False)
    sequence: int = field(compare=False)
    required_capabilities: list = field(compare=False, default_factory=list)
    estimated_resources: dict = field(compare=False, default_factory=dict)
    security_level: str = field(compare=False, default="normal")
    candidate_nodes: list = field(compare=False, default_factory=list)
    redundancy_factor: int = field(compare=False, default=3)


@dataclass
class DispatchPlan:
    task_id: str
    assignments: list[dict]
    total_shards: int
    estimated_total_time_ms: int


class TaskDispatcher:
    REDUNDANCY_FACTOR = 3
    WEIGHTS = {
        "cost": 0.40,
        "latency": 0.25,
        "reliability": 0.20,
        "security": 0.10,
        "geo": 0.05,
    }

    def __init__(self) -> None:
        self._queue: list[SchedulableShard] = []

    def calculate_match_score(self, shard: SchedulableShard, node: P2PNode) -> float:
        resources = node.resources or {}
        memory_usage = resources.get("memory_usage", 50.0)
        cost_normalized = min(1.0, max(0.0, memory_usage / 100.0))

        now = django_timezone.now()
        if node.last_heartbeat:
            delta_seconds = (now - node.last_heartbeat).total_seconds()
            latency_normalized = min(1.0, delta_seconds / 60.0)
        else:
            latency_normalized = 1.0

        reliability = node.reputation_score / 100.0
        reliability_normalized = 1.0 - reliability

        if node.status != "online":
            security_risk = 1.0
        elif shard.security_level == "critical" and node.reputation_score < 90:
            security_risk = 1.0
        else:
            security_risk = 0.0

        geo_violation = 0.0

        score = (
            cost_normalized * self.WEIGHTS["cost"]
            + latency_normalized * self.WEIGHTS["latency"]
            + reliability_normalized * self.WEIGHTS["reliability"]
            + security_risk * self.WEIGHTS["security"]
            + geo_violation * self.WEIGHTS["geo"]
        )
        return score

    def select_candidate_nodes(
        self,
        shard: SchedulableShard,
        all_nodes: list[P2PNode],
        n: int = 3,
    ) -> list[P2PNode]:
        candidates = []
        for node in all_nodes:
            if node.status not in ("online", "busy"):
                continue
            if node.status == "banned":
                continue
            node_caps = node.capabilities or []
            if not all(cap in node_caps for cap in shard.required_capabilities):
                continue
            node_resources = node.resources or {}
            required = shard.estimated_resources or {}
            match_resources = True
            for res_key, req_val in required.items():
                available_val = node_resources.get(res_key, 0)
                if available_val < req_val:
                    match_resources = False
                    break
            if not match_resources:
                continue
            candidates.append(node)

        scored = [
            (self.calculate_match_score(shard, node), node)
            for node in candidates
        ]
        scored.sort(key=lambda x: x[0])
        top_n = [node for _, node in scored[:n]]
        return top_n

    @transaction.atomic
    def dispatch(
        self,
        shards: list[SchedulableShard],
        available_nodes: list[P2PNode],
    ) -> DispatchPlan:
        if not shards:
            raise P2PServiceError("No shards to dispatch")

        if not available_nodes:
            raise P2PServiceError("No available nodes for dispatch")

        task_id = shards[0].task_id
        try:
            task_dispatch = TaskDispatch.objects.get(task_id=task_id)
        except TaskDispatch.DoesNotExist:
            raise P2PServiceError(f"Task {task_id} not found")

        assignments = []

        for shard in shards:
            selected_nodes = self.select_candidate_nodes(
                shard,
                available_nodes,
                n=shard.redundancy_factor or self.REDUNDANCY_FACTOR,
            )

            if not selected_nodes:
                logger.warning(
                    f"No candidate nodes found for shard {shard.shard_id}"
                )
                continue

            shard.candidate_nodes = [n.node_id for n in selected_nodes]

            estimated_time = sum(
                (shard.estimated_resources or {}).get("cpu_cores", 1)
                for _ in selected_nodes
            ) * 100

            heapq.heappush(self._queue, shard)

            assignment = {
                "shard_id": shard.shard_id,
                "node_ids": [n.node_id for n in selected_nodes],
                "priority": shard.priority_score,
                "estimated_time_ms": estimated_time,
            }
            assignments.append(assignment)

            logger.info(
                f"Shard {shard.shard_id} queued with "
                f"{len(selected_nodes)} candidates, "
                f"priority={shard.priority_score:.4f}"
            )

        sorted_shards = []
        while self._queue:
            sorted_shards.append(heapq.heappop(self._queue))

        total_estimated_time = 0
        for shard in sorted_shards:
            node_ids = getattr(shard, "candidate_nodes", [])
            try:
                task_shard = TaskShard.objects.get(shard_id=shard.shard_id)
                task_shard.status = "dispatched"
                task_shard.assigned_node_ids = node_ids
                task_shard.save(update_fields=["status", "assigned_node_ids"])
            except TaskShard.DoesNotExist:
                logger.error(f"TaskShard {shard.shard_id} not found in DB")
                continue

            matching_assignment = next(
                (a for a in assignments if a["shard_id"] == shard.shard_id), None
            )
            if matching_assignment:
                total_estimated_time += matching_assignment.get(
                    "estimated_time_ms", 0
                )

        task_dispatch.status = "executing"
        task_dispatch.total_shards = len(sorted_shards)
        task_dispatch.save(update_fields=["status", "total_shards"])

        logger.info(
            f"Dispatch completed for task {task_id}: "
            f"{len(assignments)} shards dispatched, "
            f"estimated_total_time={total_estimated_time}ms"
        )

        return DispatchPlan(
            task_id=task_id,
            assignments=assignments,
            total_shards=len(assignments),
            estimated_total_time_ms=total_estimated_time,
        )

    @transaction.atomic
    def handle_node_failure(
        self,
        node_id: str,
        running_shards: list[str],
    ) -> list[dict]:
        reassignments = []

        try:
            failed_node = P2PNode.objects.get(node_id=node_id)
        except P2PNode.DoesNotExist:
            logger.error(f"Failed node {node_id} not found")
            return reassignments

        failed_node.reputation_score = max(
            0.0, failed_node.reputation_score - 10
        )
        failed_node.save(update_fields=["reputation_score"])

        try:
            reputation_record, _ = NodeReputation.objects.get_or_create(
                node=failed_node
            )
            reputation_record.malicious_flags += 1
            reputation_record.score = failed_node.reputation_score
            reputation_record.save()
        except Exception as e:
            logger.warning(f"Failed to update reputation record: {e}")

        if reputation_record.malicious_flags > 3:
            failed_node.status = "banned"
            failed_node.save(update_fields=["status"])
            logger.warning(
                f"Node {node_id} banned after {reputation_record.malicious_flags} malicious flags"
            )

        affected_shards = TaskShard.objects.filter(
            shard_id__in=running_shards,
            status__in=["dispatched", "executing"],
        )

        for shard in affected_shards:
            current_assigned = shard.assigned_node_ids or []
            if node_id not in current_assigned:
                continue

            shard.status = "failed"
            new_assigned = [nid for nid in current_assigned if nid != node_id]
            shard.assigned_node_ids = new_assigned
            shard.save(update_fields=["status", "assigned_node_ids"])

            logger.warning(
                f"Shard {shard.shard_id} marked as failed due to node {node_id} failure"
            )

            all_online_nodes = list(
                P2PNode.objects.filter(status__in=["online", "busy"])
                .exclude(node_id=node_id)
                .exclude(status="banned")
            )

            schedulable_shard = SchedulableShard(
                priority_score=shard.sequence,
                shard_id=shard.shard_id,
                task_id=shard.task.task_id,
                sequence=shard.sequence,
                required_capabilities=shard.required_capabilities or [],
                estimated_resources=shard.estimated_resources or {},
                security_level=shard.security_level,
            )

            replacement_nodes = self.select_candidate_nodes(
                schedulable_shard,
                all_online_nodes,
                n=self.REDUNDANCY_FACTOR - len(new_assigned),
            )

            if replacement_nodes:
                final_assigned = new_assigned + [n.node_id for n in replacement_nodes]
                shard.status = "dispatched"
                shard.assigned_node_ids = final_assigned
                shard.save(update_fields=["status", "assigned_node_ids"])

                reassignment_entry = {
                    "shard_id": shard.shard_id,
                    "original_node_id": node_id,
                    "replacement_node_ids": [n.node_id for n in replacement_nodes],
                    "final_assigned_nodes": final_assigned,
                }
                reassignments.append(reassignment_entry)

                logger.info(
                    f"Shard {shard.shard_id} reassigned to nodes: {replacement_nodes}"
                )
            else:
                logger.error(
                    f"No replacement nodes available for shard {shard.shard_id}"
                )

        logger.info(
            f"Node failure handled: node={node_id}, "
            f"affected_shards={len(running_shards)}, "
            f"reassignments={len(reassignments)}"
        )

        return reassignments

    def get_queue_status(self) -> dict:
        return {
            "queue_length": len(self._queue),
            "queued_shards": [
                {
                    "shard_id": s.shard_id,
                    "task_id": s.task_id,
                    "sequence": s.sequence,
                    "priority_score": s.priority_score,
                    "security_level": s.security_level,
                }
                for s in sorted(self._queue, key=lambda x: x.priority_score)
            ],
        }
