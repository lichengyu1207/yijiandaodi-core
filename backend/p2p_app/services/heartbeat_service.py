import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

from django.db import transaction
from django.utils import timezone as django_timezone

from ..models import P2PNode, NodeHeartbeat, NodeReputation
from .idle_detection_service import IdleDetectionService

logger = logging.getLogger(__name__)


class P2PServiceError(Exception):
    """P2P服务自定义异常基类"""
    pass


# ---- 异常检测阈值 ----
ANOMALY_THRESHOLDS = {
    'cpu_usage': 95.0,
    'memory_usage': 95.0,
    'gpu_usage': 98.0,
}

# ---- 信誉调整参数 ----
REPUTATION_BONUS_PER_HEARTBEAT = 0.1      # 每次正常心跳加分
REPUTATION_PENALTY_OFFLINE = -5.0          # 被标记离线扣分
REPUTATION_ANOMALY_PENALTY = -1.0          # 异常心跳扣分
REPUTATION_MAX = 150.0
REPUTATION_MIN = 0.0


class HeartbeatService:
    """心跳服务 - 处理节点心跳上报、离线检测、异常检测、信誉更新等"""

    HEARTBEAT_INTERVAL: int = 10
    TIMEOUT_THRESHOLD: int = 30

    @classmethod
    def process_heartbeat(cls, node_id: str, payload_dict: Dict[str, Any]) -> Dict[str, Any]:
        """
        处理节点心跳请求

        流程：
        1. 校验节点存在性及封禁状态
        2. 创建 NodeHeartbeat 记录（含空闲状态评估）
        3. 检测资源异常（CPU/GPU过载、内存溢出）
        4. 更新节点状态与信誉评分
        5. 返回 ack + 待领取任务列表

        Args:
            node_id: 节点ID
            payload_dict: 心跳负载数据，包含 cpu/memory/gpu/disk_io/network_bandwidth/idle_state/active_task_count

        Returns:
            HeartbeatAck 响应字典

        Raises:
            P2PServiceError: 节点不存在或已被封禁时抛出
        """
        try:
            node = P2PNode.objects.select_related('reputation').get(node_id=node_id)
        except P2PNode.DoesNotExist:
            logger.warning(f"Heartbeat rejected: node {node_id} not found")
            raise P2PServiceError(f"Node {node_id} does not exist")

        if node.status == 'banned':
            logger.warning(f"Heartbeat rejected: node {node_id} is banned")
            raise P2PServiceError(f"Node {node_id} is banned")

        with transaction.atomic():
            idle_state = IdleDetectionService.evaluate_idle_state({
                'cpu_usage': payload_dict.get('cpu_usage', 0) / 100.0,
                'memory_usage': payload_dict.get('memory_usage', 0) / 100.0,
                'disk_io_usage': payload_dict.get('disk_io_usage', 0) / 100.0,
                'network_bandwidth_usage': payload_dict.get('network_bandwidth_usage', 0) / 100.0,
            })

            heartbeat_record = NodeHeartbeat.objects.create(
                node=node,
                cpu_usage=payload_dict.get('cpu_usage', 0.0),
                memory_usage=payload_dict.get('memory_usage', 0.0),
                gpu_usage=payload_dict.get('gpu_usage'),
                disk_io_usage=payload_dict.get('disk_io_usage', 0.0),
                network_bandwidth_usage=payload_dict.get('network_bandwidth_usage', 0.0),
                idle_state=idle_state,
                active_task_count=payload_dict.get('active_task_count', 0),
            )

            # ---- 节点状态更新 ----
            if idle_state == 'BUSY':
                new_status = 'busy'
            elif node.status not in ('busy', 'maintenance', 'banned'):
                new_status = 'online'
            else:
                new_status = node.status

            node.status = new_status
            node.save(update_fields=['status'])

            # ---- 异常检测 ----
            anomalies = cls._detect_anomalies(payload_dict)

            # ---- 信誉更新 ----
            cls._update_reputation(node, has_anomaly=bool(anomalies))

        now = django_timezone.now()
        pending_tasks = cls._fetch_pending_tasks(node)

        response = {
            'status': 'ok',
            'server_time': now.isoformat(),
            'pending_tasks': pending_tasks,
            'next_heartbeat_in_seconds': cls.HEARTBEAT_INTERVAL,
            'idle_state': idle_state,
        }
        if anomalies:
            response['anomalies'] = anomalies

        logger.info(
            f"Heartbeat processed: node={node_id}, state={idle_state}, "
            f"record_id={heartbeat_record.id}, anomalies={len(anomalies)}"
        )
        return response

    @classmethod
    def _detect_anomalies(cls, payload_dict: Dict[str, Any]) -> List[Dict[str, Any]]:
        """检测资源异常（CPU/GPU过载、内存溢出等）"""
        anomalies = []

        cpu = payload_dict.get('cpu_usage', 0.0)
        if cpu >= ANOMALY_THRESHOLDS['cpu_usage']:
            anomalies.append({
                'type': 'cpu_overload',
                'value': cpu,
                'threshold': ANOMALY_THRESHOLDS['cpu_usage'],
                'message': f'CPU使用率过高: {cpu:.1f}% >= {ANOMALY_THRESHOLDS["cpu_usage"]}%'
            })

        memory = payload_dict.get('memory_usage', 0.0)
        if memory >= ANOMALY_THRESHOLDS['memory_usage']:
            anomalies.append({
                'type': 'memory_overflow',
                'value': memory,
                'threshold': ANOMALY_THRESHOLDS['memory_usage'],
                'message': f'内存使用率过高: {memory:.1f}% >= {ANOMALY_THRESHOLDS["memory_usage"]}%'
            })

        gpu = payload_dict.get('gpu_usage')
        if gpu is not None and gpu >= ANOMALY_THRESHOLDS['gpu_usage']:
            anomalies.append({
                'type': 'gpu_overload',
                'value': gpu,
                'threshold': ANOMALY_THRESHOLDS['gpu_usage'],
                'message': f'GPU使用率过高: {gpu:.1f}% >= {ANOMALY_THRESHOLDS["gpu_usage"]}%'
            })

        if anomalies:
            logger.warning(f"Anomalies detected in heartbeat: {anomalies}")
        return anomalies

    @classmethod
    def _update_reputation(cls, node: P2PNode, has_anomaly: bool = False) -> None:
        """根据心跳情况更新节点信誉评分"""
        rep, created = NodeReputation.objects.get_or_create(node=node)

        if has_anomaly:
            delta = REPUTATION_ANOMALY_PENALTY
        else:
            delta = REPUTATION_BONUS_PER_HEARTBEAT

        new_score = max(REPUTATION_MIN, min(REPUTATION_MAX, rep.score + delta))
        rep.score = new_score

        # 更新成功率估算：异常越多，隐含降低成功率
        if has_anomaly:
            rep.success_rate = max(0.0, rep.success_rate - 0.01)

        rep.save(update_fields=['score', 'success_rate', 'last_updated'])

        # 同步 P2PNode.reputation_score
        node.reputation_score = new_score
        node.save(update_fields=['reputation_score'])

        logger.debug(
            f"Reputation updated: node={node.node_id}, delta={delta:+.2f}, "
            f"new_score={new_score:.2f}"
        )

    @classmethod
    def _fetch_pending_tasks(cls, node: P2PNode) -> list:
        """获取该节点待领取的任务分片列表"""
        from ..models import TaskShard
        pending_shards = TaskShard.objects.filter(
            status='pending',
        ).exclude(
            assigned_node_ids__contains=[node.node_id],
        )[:10]

        tasks = []
        for shard in pending_shards:
            required_caps = shard.required_capabilities or []
            node_caps = set(node.capabilities or [])
            if required_caps and not node_caps.intersection(required_caps):
                continue
            tasks.append({
                'shard_id': shard.shard_id,
                'task_id': shard.task_id,
                'sequence': shard.sequence,
                'required_capabilities': required_caps,
            })
        return tasks

    @classmethod
    def check_offline_nodes(cls, timeout_seconds: int = 120) -> List[str]:
        """
        检测并标记离线节点

        查询所有 status='online' 的节点，将 last_heartbeat 超过 timeout_seconds 秒的标记为 offline，
        并扣除相应信誉分。

        Args:
            timeout_seconds: 超时阈值（秒），默认120秒

        Returns:
            被标记为离线的节点 ID 列表
        """
        from django.utils import timezone as tz

        cutoff_time = tz.now() - tz.timedelta(seconds=timeout_seconds)

        online_nodes = P2PNode.objects.filter(status='online')
        offline_nodes = online_nodes.filter(last_heartbeat__lt=cutoff_time)

        offline_node_ids = list(offline_nodes.values_list('node_id', flat=True))

        if offline_node_ids:
            updated_count = offline_nodes.update(status='offline')

            # 对离线节点扣除信誉分
            for nid in offline_node_ids:
                try:
                    node = P2PNode.objects.get(node_id=nid)
                    cls._apply_offline_penalty(node)
                except P2PNode.DoesNotExist:
                    pass

            logger.info(
                f"Marked {updated_count} nodes as offline (timeout>{timeout_seconds}s): {offline_node_ids}"
            )

        return offline_node_ids

    @classmethod
    def _apply_offline_penalty(cls, node: P2PNode) -> None:
        """对离线节点施加信誉惩罚"""
        rep, _ = NodeReputation.objects.get_or_create(node=node)
        new_score = max(REPUTATION_MIN, rep.score + REPUTATION_PENALTY_OFFLINE)
        rep.score = new_score
        rep.success_rate = max(0.0, rep.success_rate - 0.05)
        rep.save(update_fields=['score', 'success_rate', 'last_updated'])

        node.reputation_score = new_score
        node.save(update_fields=['reputation_score'])

        logger.debug(f"Offline penalty applied: node={node.node_id}, new_score={new_score:.2f}")

    @classmethod
    def get_node_live_stats(cls, node_id: str, limit: int = 20) -> Dict[str, Any]:
        """
        节点实时统计信息

        Args:
            node_id: 节点ID
            limit: 返回最近的心跳记录数量，默认20条

        Returns:
            包含最近心跳记录和统计摘要的字典

        Raises:
            P2PServiceError: 节点不存在时抛出
        """
        try:
            node = P2PNode.objects.get(node_id=node_id)
        except P2PNode.DoesNotExist:
            logger.warning(f"Live stats request failed: node {node_id} not found")
            raise P2PServiceError(f"Node {node_id} does not exist")

        recent_heartbeats = NodeHeartbeat.objects.filter(
            node=node
        ).order_by('-timestamp')[:limit]

        heartbeat_data = [
            {
                'timestamp': hb.timestamp.isoformat(),
                'cpu_usage': hb.cpu_usage,
                'memory_usage': hb.memory_usage,
                'gpu_usage': hb.gpu_usage,
                'disk_io_usage': hb.disk_io_usage,
                'network_bandwidth_usage': hb.network_bandwidth_usage,
                'idle_state': hb.idle_state,
                'active_task_count': hb.active_task_count,
            }
            for hb in recent_heartbeats
        ]

        if recent_heartbeats:
            avg_cpu = sum(hb.cpu_usage for hb in recent_heartbeats) / len(recent_heartbeats)
            avg_memory = sum(hb.memory_usage for hb in recent_heartbeats) / len(recent_heartbeats)
        else:
            avg_cpu = 0.0
            avg_memory = 0.0

        return {
            'node_id': node_id,
            'current_status': node.status,
            'last_heartbeat': node.last_heartbeat.isoformat() if node.last_heartbeat else None,
            'recent_heartbeats': heartbeat_data,
            'statistics': {
                'avg_cpu_usage': round(avg_cpu, 2),
                'avg_memory_usage': round(avg_memory, 2),
                'sample_count': len(recent_heartbeats),
            },
        }
