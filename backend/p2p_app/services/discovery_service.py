import logging
from typing import Dict, Any, List, Optional

from django.db.models import Q, Avg, Sum, Count

from ..models import P2PNode
from .heartbeat_service import P2PServiceError
from ..serializers import NodeListSerializer

logger = logging.getLogger(__name__)

KNOWN_CAPABILITIES = [
    "ai_detection",
    "code_execution",
    "text_processing",
    "ocr",
    "image_analysis",
    "file_scanning",
    "nlp_inference",
    "plagiarism_check",
]


class NodeDiscoveryService:
    """节点发现服务 - 提供节点搜索、网络拓扑、能力校验等功能"""

    @classmethod
    def discover_nodes(cls, criteria: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        根据条件发现并返回匹配的节点列表

        Args:
            criteria: 过滤条件字典，可包含：
                - node_type (str): 节点类型筛选
                - required_capabilities (list[str]): 必须包含的能力列表
                - min_resources (dict): 最低资源要求 {"cpu_cores": N, "memory_gb": N}
                - location (str): 地域匹配
                - min_reputation (float): 最低信誉分
                - status (str): 节点状态，默认 "online"
                - max_results (int): 返回最大数量，默认20

        Returns:
            序列化后的节点字典列表

        Raises:
            P2PServiceError: 查询参数异常时抛出
        """
        try:
            status_filter = criteria.get('status', 'online')
            queryset = P2PNode.objects.filter(status=status_filter).exclude(status='banned')

            node_type = criteria.get('node_type')
            if node_type:
                queryset = queryset.filter(node_type=node_type)

            location = criteria.get('location')
            if location:
                queryset = queryset.filter(location__icontains=location)

            min_reputation = criteria.get('min_reputation')
            if min_reputation is not None:
                queryset = queryset.filter(reputation_score__gte=float(min_reputation))

            required_capabilities = criteria.get('required_capabilities')
            if required_capabilities:
                queryset = cls._filter_by_capabilities(queryset, required_capabilities)

            min_resources = criteria.get('min_resources')
            if min_resources:
                queryset = cls._filter_by_resources(queryset, min_resources)

            max_results = criteria.get('max_results', 20)
            nodes = queryset.order_by('-last_heartbeat')[:max_results]

            serializer = NodeListSerializer(nodes, many=True)
            result = serializer.data

            logger.info(
                f"Node discovery completed: criteria={criteria}, result_count={len(result)}"
            )
            return result

        except Exception as e:
            logger.error(f"Node discovery error: {e}", exc_info=True)
            raise P2PServiceError(f"Node discovery failed: {e}")

    @classmethod
    def _filter_by_capabilities(cls, queryset, required_capabilities: List[str]):
        """
        按能力列表过滤节点（SQLite 兼容方式）

        由于 SQLite 对 JSONField 的 contains 支持有限，
        采用 Python 层逐条检查的方式实现
        """
        node_ids = []
        for node in queryset:
            if all(cap in node.capabilities for cap in required_capabilities):
                node_ids.append(node.node_id)

        return queryset.filter(node_id__in=node_ids)

    @classmethod
    def _filter_by_resources(cls, queryset, min_resources: Dict[str, int]):
        """
        按最低资源要求过滤节点（SQLite 兼容方式）

        Args:
            min_resources: 最低资源要求 {"cpu_cores": N, "memory_gb": N}
        """
        node_ids = []
        for node in queryset:
            resources = node.resources or {}
            match = True

            min_cpu = min_resources.get('cpu_cores')
            if min_cpu is not None:
                node_cpu = resources.get('cpu_cores', 0)
                if node_cpu < min_cpu:
                    match = False

            min_memory = min_resources.get('memory_gb')
            if min_memory is not None and match:
                node_memory = resources.get('memory_gb', 0)
                if node_memory < min_memory:
                    match = False

            if match:
                node_ids.append(node.node_id)

        return queryset.filter(node_id__in=node_ids)

    @classmethod
    def get_network_topology(cls) -> Dict[str, Any]:
        """
        获取网络拓扑概览信息

        Returns:
            包含网络统计信息的字典
        """
        total_nodes = P2PNode.objects.count()

        online_count = P2PNode.objects.filter(status='online').count()
        offline_count = P2PNode.objects.filter(status='offline').count()
        busy_count = P2PNode.objects.filter(status='busy').count()

        by_type = dict(
            P2PNode.objects.values_list('node_type')
            .annotate(count=Count('node_id'))
            .values_list('node_type', 'count')
        )

        by_location = dict(
            P2PNode.objects.values_list('location')
            .annotate(count=Count('node_id'))
            .values_list('location', 'count')
        )

        avg_reputation_result = P2PNode.objects.aggregate(
            avg_rep=Avg('reputation_score')
        )
        avg_reputation = avg_reputation_result['avg_rep'] or 0.0

        total_compute_result = P2PNode.objects.aggregate(
            total=Sum('total_compute_hours')
        )
        total_compute_hours = total_compute_result['total'] or 0.0

        topology_data = {
            "total_nodes": total_nodes,
            "online_count": online_count,
            "offline_count": offline_count,
            "busy_count": busy_count,
            "by_type": by_type,
            "by_location": by_location,
            "avg_reputation": round(avg_reputation, 2),
            "total_compute_hours": round(total_compute_hours, 2),
        }

        logger.info(f"Network topology retrieved: {topology_data}")
        return topology_data

    @classmethod
    def validate_node_capability(cls, node_id: str, capability_report: Dict[str, Any]) -> bool:
        """
        校验节点上报的能力是否合理

        Args:
            node_id: 节点ID
            capability_report: 能力上报报告 {"capability_name": version_or_value}

        Returns:
            True 如果所有能力都在已知列表中，否则 False
        """
        reported_capabilities = list(capability_report.keys())
        unknown_caps = [
            cap for cap in reported_capabilities
            if cap not in KNOWN_CAPABILITIES
        ]

        if unknown_caps:
            logger.warning(
                f"Node {node_id} reported unknown capabilities: {unknown_caps}. "
                f"Known capabilities: {KNOWN_CAPABILITIES}"
            )
            return False

        logger.info(
            f"Node {node_id} capability validation passed: {reported_capabilities}"
        )
        return True

    @classmethod
    def find_best_nodes_for_shard(cls, shard_requirements: Dict[str, Any], count: int = 3) -> list:
        """为指定分片找到最合适的 N 个节点

        流程：
        1. 按 shard_requirements 构建过滤条件
        2. 调用 discover_nodes 获取候选节点
        3. 按空闲状态排序（IDLE > PARTIAL_BUSY > BUSY）
        4. 按信誉分降序排列作为二级排序
        5. 返回前 count 个节点

        Args:
            shard_requirements: 分片需求字典，可包含：
                - required_capabilities (list[str]): 必需能力
                - min_resources (dict): 最低资源要求
                - location (str): 偏好地域
                - min_reputation (float): 最低信誉分
                - security_level (str): 安全级别
            count: 返回节点数量上限，默认3

        Returns:
            最匹配的节点字典列表（已按优先级排序）
        """
        criteria = {
            'status': 'online',
            'required_capabilities': shard_requirements.get('required_capabilities', []),
            'min_resources': shard_requirements.get('min_resources', {}),
            'location': shard_requirements.get('location', ''),
            'min_reputation': shard_requirements.get('min_reputation', 30.0),
            'max_results': max(count * 3, 10),
        }

        candidates = cls.discover_nodes(criteria)

        # 按空闲状态排序：IDLE(最优) > PARTIAL_BUSY > BUSY(最差)
        idle_priority = {'IDLE': 0, 'PARTIAL_BUSY': 1, 'BUSY': 2}

        def _sort_key(node_dict):
            idle_state = node_dict.get('idle_state', 'BUSY')
            rep = node_dict.get('reputation_score', 0.0)
            return (
                idle_priority.get(idle_state, 2),
                -rep,
            )

        candidates.sort(key=_sort_key)
        result = candidates[:count]

        logger.info(
            f"find_best_nodes_for_shard: requirements={shard_requirements}, "
            f"candidates={len(candidates)}, returned={len(result)}"
        )
        return result
