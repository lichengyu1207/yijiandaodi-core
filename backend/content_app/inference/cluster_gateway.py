"""P2P 推理网关（P3 M4）：把聊天推理包装为 P2P 文本任务

复用 p2p_app 既有能力：
  - P2PNode 节点在线/繁忙状态 + capabilities 过滤
  - TaskDispatch / TaskShard 任务与分片模型
  - TaskDispatcher.dispatch 成本路由选节点

gateway 与 provider 解耦：ClusterProvider 只依赖本网关的
submit / fetch_result / abort 三个方法（测试注入 FakeGateway 即可）。

P2P 依赖延迟 import：p2p_app 未启用或未注册节点时优雅回退（submit 返回 None）。
"""

import hashlib
import json
import logging
import uuid
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class ClusterGateway:
    """推理网关抽象：submit / fetch_result / abort"""

    def submit(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        caller: Optional[str] = None,
    ) -> Optional[str]:
        """提交推理任务到集群；返回 task_id，无可调度节点返回 None。"""
        raise NotImplementedError

    def fetch_result(self, task_id: str) -> Optional[str]:
        """拉取已接受的结果文本；未完成返回 None。"""
        raise NotImplementedError

    def abort(self, task_id: str) -> None:
        """中止任务（超时清理）。"""
        raise NotImplementedError


class P2PClusterGateway(ClusterGateway):
    """基于 p2p_app 的集群推理网关。"""

    def __init__(self, dispatcher: Optional[Any] = None) -> None:
        self._dispatcher = dispatcher

    # ------------------------------------------------------------------
    # ClusterGateway
    # ------------------------------------------------------------------

    def submit(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        caller: Optional[str] = None,
    ) -> Optional[str]:
        from p2p_app.models import P2PNode, TaskDispatch, TaskShard
        from p2p_app.services.dispatcher import SchedulableShard, TaskDispatcher

        # 注意：JSONField 的 __contains 查找在 SQLite 后端不受支持，这里改为
        # DB 内按状态过滤 + Python 内做能力匹配，保证跨数据库后端一致。
        nodes = [
            n
            for n in P2PNode.objects.filter(status__in=['online', 'busy'])
            if 'inference' in (n.capabilities or [])
        ]
        logger.debug(
            '[集群网关] 节点筛选完成: 候选节点=%d %s',
            len(nodes),
            [n.node_id for n in nodes],
        )
        if not nodes:
            logger.warning('[集群网关] 无在线推理节点，回退本地')
            return None

        task_id = f'infer-{uuid.uuid4().hex[:12]}'
        task = TaskDispatch.objects.create(
            task_id=task_id,
            task_type='text',
            status='created',
            created_by=caller or '',
        )
        logger.debug('[集群网关] 任务已创建: %s (调用方=%s 模型=%s)', task_id, caller, model)

        payload_blob = json.dumps(
            {'messages': messages, 'model': model}, ensure_ascii=False
        )
        shard = TaskShard.objects.create(
            shard_id=f'{task_id}-0',
            task=task,
            sequence=0,
            total_in_task=1,
            payload_hash=hashlib.sha256(payload_blob.encode('utf-8')).hexdigest(),
            payload_size=len(payload_blob),
            required_capabilities=['inference'],
            estimated_resources={'cpu_cores': 1, 'memory_usage': 0},
            security_level='normal',
        )
        logger.debug('[集群网关] 分片已创建: %s (payload=%dB)', shard.shard_id, len(payload_blob))

        dispatcher = self._dispatcher or TaskDispatcher()
        try:
            plan = dispatcher.dispatch(
                [
                    SchedulableShard(
                        priority_score=1.0,
                        shard_id=shard.shard_id,
                        task_id=task_id,
                        sequence=0,
                        required_capabilities=['inference'],
                        estimated_resources={'cpu_cores': 1, 'memory_usage': 0},
                        security_level='normal',
                    )
                ],
                nodes,
            )
        except Exception as exc:
            logger.warning('[集群网关] 调度异常，任务 %s 标记失败: %s', task_id, exc)
            TaskDispatch.objects.filter(task_id=task_id).update(status='failed')
            return None

        logger.info(
            '[集群网关] 任务已提交: %s 分片数=%d 预估耗时=%dms 节点分配=%s',
            task_id,
            len(plan.assignments),
            plan.estimated_total_time_ms,
            plan.assignments,
        )
        return task_id

    def fetch_result(self, task_id: str) -> Optional[str]:
        from p2p_app.models import ShardResult, TaskShard

        shards = list(TaskShard.objects.filter(task_id=task_id))
        if not shards:
            logger.warning('[集群网关] 拉取结果: 任务 %s 不存在或无分片', task_id)
            return None

        texts: List[str] = []
        for shard in shards:
            accepted = (
                shard.results.filter(is_accepted=True)
                .order_by('-created_at')
                .first()
            )
            if accepted and accepted.stdout:
                texts.append(accepted.stdout)
                logger.debug(
                    '[集群网关] 分片结果已接受: %s (长度=%d)', shard.shard_id, len(accepted.stdout)
                )
            else:
                logger.debug(
                    '[集群网关] 分片尚无接受结果: %s (状态=%s)',
                    shard.shard_id,
                    getattr(shard, 'status', 'unknown'),
                )
        result = '\n'.join(texts) if texts else None
        if result is None:
            logger.debug('[集群网关] 拉取结果: 任务 %s 未完成，返回 None', task_id)
        else:
            logger.debug('[集群网关] 拉取结果: 任务 %s 已就绪 (片段=%d 长度=%d)', task_id, len(texts), len(result))
        return result

    def abort(self, task_id: str) -> None:
        from p2p_app.models import TaskDispatch

        updated = TaskDispatch.objects.filter(
            task_id=task_id, status__in=['created', 'executing']
        ).update(status='aborted')
        if updated:
            logger.info('[集群网关] 任务已中止: %s (受影响行=%d)', task_id, updated)
        else:
            logger.debug('[集群网关] 中止任务 %s: 无匹配(已结束或不存在)', task_id)
