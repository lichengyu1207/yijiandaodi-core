import logging
import math
from collections import defaultdict, deque
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from django.db import transaction
from django.utils import timezone as django_timezone

from ..models import TaskDispatch, TaskShard, ShardResult, P2PNode
from .heartbeat_service import P2PServiceError

logger = logging.getLogger(__name__)


class ConsensusStatus(Enum):
    UNANIMOUS = "unanimous"
    MAJORITY = "majority"
    CONFLICT = "conflict"


@dataclass
class ShardResultSummary:
    shard_id: str
    consensus_status: ConsensusStatus
    accepted_result: Optional[dict]
    flagged_node_ids: list[str] = field(default_factory=list)
    all_results: list[dict] = field(default_factory=list)


@dataclass
class TaskAggregationResult:
    task_id: str
    status: str
    total_shards: int
    completed_shards: int
    failed_shards: int
    result_summary: dict = field(default_factory=dict)
    conflict_shards: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return asdict(self)


class ResultAggregator:
    @classmethod
    def aggregate(cls, task_id: str) -> TaskAggregationResult:
        try:
            task_dispatch = TaskDispatch.objects.get(task_id=task_id)
        except TaskDispatch.DoesNotExist:
            logger.error(f"Aggregation failed: task {task_id} not found")
            raise P2PServiceError(f"Task {task_id} does not exist")

        logger.info(f"Starting aggregation for task {task_id}")

        shards = TaskShard.objects.filter(task=task_dispatch).select_related('task')
        shard_summaries: list[ShardResultSummary] = []
        conflict_shard_ids: list[str] = []
        completed_count = 0
        failed_count = 0

        with transaction.atomic():
            for shard in shards:
                if shard.results.exists():
                    summary = cls.aggregate_shard(shard)
                    shard_summaries.append(summary)

                    if summary.consensus_status == ConsensusStatus.CONFLICT:
                        conflict_shard_ids.append(summary.shard_id)

                    completed_count += 1
                elif shard.status == 'failed':
                    failed_count += 1

            total_shards = shards.count()
            pending_count = total_shards - completed_count - failed_count

            if pending_count > 0 and completed_count > 0:
                overall_status = "partial"
            elif completed_count == total_shards:
                overall_status = "completed"
            elif failed_count >= total_shards or completed_count == 0:
                overall_status = "failed"
            else:
                overall_status = "partial"

            sorted_summaries = cls._topological_sort(shard_summaries)
            merged_result = cls._merge_ordered_results(sorted_summaries)

            task_dispatch.result_summary = merged_result
            task_dispatch.status = 'aggregating'
            task_dispatch.completed_shards = completed_count
            task_dispatch.failed_shards = failed_count

            if overall_status in ('completed', 'failed'):
                task_dispatch.status = overall_status
                task_dispatch.completed_at = django_timezone.now()

            task_dispatch.save(
                update_fields=[
                    'result_summary', 'status',
                    'completed_shards', 'failed_shards', 'completed_at'
                ]
            )

        aggregation_result = TaskAggregationResult(
            task_id=task_id,
            status=overall_status,
            total_shards=total_shards,
            completed_shards=completed_count,
            failed_shards=failed_count,
            result_summary=merged_result,
            conflict_shards=conflict_shard_ids,
        )

        logger.info(
            f"Task {task_id} aggregation completed: "
            f"status={overall_status}, "
            f"completed={completed_count}/{total_shards}, "
            f"conflicts={len(conflict_shard_ids)}"
        )

        return aggregation_result

    @classmethod
    def aggregate_shard(cls, shard: TaskShard) -> ShardResultSummary:
        results = list(shard.results.all().order_by('created_at'))

        if not results:
            logger.warning(f"No results found for shard {shard.shard_id}")
            raise P2PServiceError(f"No results available for shard {shard.shard_id}")

        logger.debug(
            f"Aggregating shard {shard.shard_id}: {len(results)} result(s)"
        )

        if len(results) == 1:
            accepted_result = results[0]
            accepted_result.is_accepted = True
            accepted_result.save(update_fields=['is_accepted'])

            shard.status = 'completed'
            shard.save(update_fields=['status'])

            return ShardResultSummary(
                shard_id=shard.shard_id,
                consensus_status=ConsensusStatus.UNANIMOUS,
                accepted_result={
                    'stdout': accepted_result.stdout,
                    'exit_code': accepted_result.exit_code,
                    'node_id': accepted_result.node_id,
                },
                flagged_node_ids=[],
                all_results=[{
                    'stdout': r.stdout,
                    'exit_code': r.exit_code,
                    'node_id': r.node_id,
                } for r in results],
            )

        accepted_result, flagged_node_ids = cls.resolve_conflict(results)

        if accepted_result:
            accepted_result.is_accepted = True
            accepted_result.save(update_fields=['is_accepted'])

        shard.status = 'completed'
        shard.save(update_fields=['status'])

        stdout_groups = defaultdict(list)
        for r in results:
            stdout_groups[r.stdout].append(r)

        max_group_size = max(len(group) for group in stdout_groups.values())
        total_results = len(results)

        if max_group_size == total_results:
            consensus = ConsensusStatus.UNANIMOUS
        elif max_group_size >= math.ceil(total_results / 2):
            consensus = ConsensusStatus.MAJORITY
        else:
            consensus = ConsensusStatus.CONFLICT

        logger.info(
            f"Shard {shard.shard_id} consensus: {consensus.value}, "
            f"flagged_nodes={flagged_node_ids}"
        )

        return ShardResultSummary(
            shard_id=shard.shard_id,
            consensus_status=consensus,
            accepted_result={
                'stdout': accepted_result.stdout if accepted_result else None,
                'exit_code': accepted_result.exit_code if accepted_result else None,
                'node_id': accepted_result.node_id if accepted_result else None,
            } if accepted_result else None,
            flagged_node_ids=flagged_node_ids,
            all_results=[{
                'stdout': r.stdout,
                'exit_code': r.exit_code,
                'node_id': r.node_id,
            } for r in results],
        )

    @classmethod
    def resolve_conflict(cls, results: list[ShardResult]) -> tuple[Optional[ShardResult], list[str]]:
        if not results:
            return None, []

        stdout_groups: dict[str, list[ShardResult]] = defaultdict(list)
        for result in results:
            stdout_groups[result.stdout].append(result)

        sorted_groups = sorted(
            stdout_groups.items(),
            key=lambda item: len(item[1]),
            reverse=True
        )

        majority_stdout, majority_group = sorted_groups[0]
        total = len(results)
        majority_threshold = math.ceil(total / 2)

        if len(majority_group) >= majority_threshold:
            best_result = cls._select_best_from_group(majority_group)
            flagged = [
                r.node_id for r in results
                if r.stdout != majority_stdout
            ]
            logger.debug(
                f"Majority decision: {len(majority_group)}/{total} agreed, "
                f"accepted node={best_result.node_id}"
            )
            return best_result, flagged

        if len(sorted_groups) > 1 and len(sorted_groups[0][1]) == len(sorted_groups[1][1]):
            logger.debug("Tie detected, falling back to response time")
            best_result = min(results, key=lambda r: r.execution_time_ms)
            flagged = [r.node_id for r in results if r != best_result]

            if len(set(r.execution_time_ms for r in results)) == 1:
                logger.debug("Still tied on response time, using reputation score")
                reputation_map = cls._get_reputation_scores([r.node_id for r in results])
                best_result = max(
                    results,
                    key=lambda r: reputation_map.get(r.node_id, 0.0)
                )
                flagged = [r.node_id for r in results if r != best_result]

            return best_result, flagged

        best_result = cls._select_best_from_group(majority_group)
        flagged = [
            r.node_id for r in results
            if r.stdout != majority_stdout
        ]

        return best_result, flagged

    @classmethod
    def _select_best_from_group(cls, group: list[ShardResult]) -> ShardResult:
        if len(group) == 1:
            return group[0]

        reputation_map = cls._get_reputation_scores([r.node_id for r in group])

        def sort_key(result: ShardResult) -> tuple:
            rep = reputation_map.get(result.node_id, 100.0)
            return (rep, -result.execution_time_ms)

        return max(group, key=sort_key)

    @staticmethod
    def _get_reputation_scores(node_ids: list[str]) -> dict[str, float]:
        scores: dict[str, float] = {}
        nodes = P2PNode.objects.filter(node_id__in=node_ids).only('node_id', 'reputation_score')

        for node in nodes:
            scores[node.node_id] = node.reputation_score

        for node_id in node_ids:
            if node_id not in scores:
                scores[node_id] = 100.0

        return scores

    @classmethod
    def _merge_ordered_results(cls, shard_summaries: list[ShardResultSummary]) -> dict:
        if not shard_summaries:
            return {'merged_output': '', 'shard_details': []}

        sorted_summaries = sorted(
            shard_summaries,
            key=lambda s: int(s.shard_id.split('-')[-1]) if '-' in s.shard_id else 0
        )

        task_type = cls._infer_task_type(sorted_summaries)

        if task_type == 'text':
            merged_output = '\n'.join(
                s.accepted_result['stdout']
                for s in sorted_summaries
                if s.accepted_result and s.accepted_result.get('stdout')
            )
        elif task_type == 'code':
            modules = []
            for s in sorted_summaries:
                if s.accepted_result and s.accepted_result.get('stdout'):
                    modules.append({
                        'module_seq': sorted_summaries.index(s),
                        'code': s.accepted_result['stdout'],
                        'source_shard': s.shard_id,
                    })
            merged_output = {'modules': modules}
        elif task_type == 'file':
            file_parts = []
            offset = 0
            for s in sorted_summaries:
                content = (
                    s.accepted_result['stdout']
                    if s.accepted_result and s.accepted_result.get('stdout')
                    else ''
                )
                file_parts.append({
                    'shard_id': s.shard_id,
                    'offset': offset,
                    'length': len(content),
                })
                offset += len(content)
            merged_output = {
                'total_length': offset,
                'parts': file_parts,
            }
        else:
            merged_output = {
                s.shard_id: s.accepted_result
                for s in sorted_summaries
                if s.accepted_result
            }

        shard_details = []
        for s in sorted_summaries:
            detail = {
                'shard_id': s.shard_id,
                'consensus': s.consensus_status.value,
                'flagged_nodes': s.flagged_node_ids,
                'has_accepted_result': s.accepted_result is not None,
            }
            shard_details.append(detail)

        return {
            'merged_output': merged_output,
            'inferred_task_type': task_type,
            'shard_count': len(sorted_summaries),
            'shard_details': shard_details,
            'aggregated_at': datetime.now(timezone.utc).isoformat(),
        }

    @staticmethod
    def _infer_task_type(shard_summaries: list[ShardResultSummary]) -> str:
        sample_outputs = []
        for s in shard_summaries[:3]:
            if s.accepted_result and s.accepted_result.get('stdout'):
                sample_outputs.append(s.accepted_result['stdout'])

        if not sample_outputs:
            return 'mixed'

        code_indicators = ['def ', 'class ', 'import ', 'function ', 'const ', 'let ', 'var ']
        text_indicators = ['\n\n', '。', '，', 'the ', 'The ', 'is ', 'are ']

        code_score = sum(1 for out in sample_outputs for ind in code_indicators if ind in out)
        text_score = sum(1 for out in sample_outputs for ind in text_indicators if ind in out)

        if code_score > text_score:
            return 'code'
        elif text_score > code_score:
            return 'text'
        else:
            return 'file'

    @classmethod
    def _topological_sort(cls, shard_summaries: list[ShardResultSummary]) -> list[ShardResultSummary]:
        if not shard_summaries:
            return []

        summary_map = {s.shard_id: s for s in shard_summaries}

        shard_ids_with_deps = set()
        for s in shard_summaries:
            try:
                shard = TaskShard.objects.select_related('task').get(shard_id=s.shard_id)
                if shard.dependencies:
                    shard_ids_with_deps.add(s.shard_id)
            except TaskShard.DoesNotExist:
                logger.warning(f"Shard {s.shard_id} not found during topological sort")

        if not shard_ids_with_deps:
            return sorted(
                shard_summaries,
                key=lambda s: int(s.shard_id.split('-')[-1]) if '-' in s.shard_id else 0
            )

        graph: dict[str, list[str]] = defaultdict(list)
        in_degree: dict[str, int] = defaultdict(int)

        for s in shard_summaries:
            if s.shard_id not in in_degree:
                in_degree[s.shard_id] = 0

        for shard_id in shard_ids_with_deps:
            try:
                shard = TaskShard.objects.get(shard_id=shard_id)
                for dep_id in shard.dependencies:
                    if dep_id in summary_map:
                        graph[dep_id].append(shard_id)
                        in_degree[shard_id] += 1
            except TaskShard.DoesNotExist:
                continue

        queue = deque([
            sid for sid, degree in in_degree.items()
            if degree == 0 and sid in summary_map
        ])

        sorted_result: list[ShardResultSummary] = []
        visited: set[str] = set()

        while queue:
            current_id = queue.popleft()
            if current_id in visited:
                continue

            visited.add(current_id)
            if current_id in summary_map:
                sorted_result.append(summary_map[current_id])

            for neighbor_id in graph[current_id]:
                in_degree[neighbor_id] -= 1
                if in_degree[neighbor_id] == 0:
                    queue.append(neighbor_id)

        remaining = [
            summary_map[sid] for sid in summary_map
            if sid not in visited
        ]

        sorted_remaining = sorted(
            remaining,
            key=lambda s: int(s.shard_id.split('-')[-1]) if '-' in s.shard_id else 0
        )

        sorted_result.extend(sorted_remaining)

        if len(sorted_result) != len(shard_summaries):
            logger.warning(
                f"Topological sort mismatch: expected {len(shard_summaries)}, "
                f"got {len(sorted_result)}. Possible cycle detected."
            )

        return sorted_result
