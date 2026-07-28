"""
L4 成本路由引擎 - EIHM-P2P-CS (Execution Intelligence Hybrid Management P2P Cost Scheduling)

提供算力成本估算和基于综合评分的节点-分片路由分配能力。
"""

import logging
from typing import Optional

from ..models import P2PNode, TaskShard, TaskDispatch

logger = logging.getLogger(__name__)


class ComputeCostEstimator:
    """算力成本估算器

    基于节点类型基准单价、资源消耗、安全/隐私级别加成，
    估算单个分片或整个任务的执行成本。
    """

    # 不同节点类型的基准单价（元/小时）
    UNIT_COSTS = {
        'browser': 0.01,
        'desktop_windows': 0.05,
        'desktop_mac': 0.06,
        'mobile': 0.02,
        'enterprise': 0.50,
        'self_hosted': 0.03,
    }

    # 安全级别加成系数
    SECURITY_MULTIPLIER = {'normal': 1.0, 'high': 1.5, 'critical': 2.5}

    # 隐私级别加成系数
    PRIVACY_MULTIPLIER = {'public': 1.0, 'internal': 1.3, 'confidential': 1.8}

    def estimate_shard_cost(self, shard: TaskShard, node: P2PNode) -> float:
        """估算单个分片在指定节点的执行成本

        成本公式：节点类型单价 × 预估资源消耗(归一化) × 安全级别加成 × 隐私级别加成
        """
        unit_cost = self.UNIT_COSTS.get(node.node_type, 0.05)

        estimated_resources = shard.estimated_resources or {}
        cpu_weight = min(estimated_resources.get('cpu_cores', 1) / 8.0, 3.0)
        memory_weight = min(estimated_resources.get('memory_gb', 1) / 16.0, 3.0)
        resource_factor = 0.6 * cpu_weight + 0.4 * memory_weight

        security_level = getattr(shard, 'security_level', 'normal')
        security_mult = self.SECURITY_MULTIPLIER.get(security_level, 1.0)

        data_sensitivity = getattr(shard, 'data_sensitivity', 'public')
        privacy_mult = self.PRIVACY_MULTIPLIER.get(data_sensitivity, 1.0)

        # 按分片大小微调（假设平均分片执行时间与 payload_size 成正比）
        size_factor = max(shard.payload_size / (1024 * 1024), 0.1)

        total_cost = unit_cost * resource_factor * security_mult * privacy_mult * size_factor

        logger.debug(
            f"Shard cost estimation: shard={shard.shard_id}, node={node.node_id}, "
            f"unit={unit_cost}, resource={resource_factor:.2f}, "
            f"security={security_mult}, privacy={privacy_mult}, "
            f"size={size_factor:.4f}, total={total_cost:.6f}"
        )
        return round(total_cost, 6)

    def estimate_total_cost(self, task: TaskDispatch, assignments: dict) -> float:
        """估算任务总成本

        Args:
            task: 任务实例
            assignments: 分配方案 {shard_id: [node_ids]}

        Returns:
            总成本（元）
        """
        total = 0.0
        for shard in task.shards.all():
            assigned_node_ids = assignments.get(shard.shard_id, [])
            if not assigned_node_ids:
                continue

            for node_id in assigned_node_ids:
                try:
                    node = P2PNode.objects.get(node_id=node_id)
                    total += self.estimate_shard_cost(shard, node)
                except P2PNode.DoesNotExist:
                    logger.warning(f"Cost estimation skipped: node {node_id} not found for shard {shard.shard_id}")

        logger.info(
            f"Total task cost: task={task.task_id}, shards={task.total_shards}, "
            f"total_cost={total:.6f}"
        )
        return round(total, 6)


class EIHMCostRouter:
    """EIHM-P2P-CS 成本路由器

    E  = Execution   (执行)
    I  = Intelligence (智能)
    H  = Hybrid      (混合)
    M  = Management  (管理)
    P2P = Peer-to-Peer
    CS  = Cost Scheduling (成本调度)

    核心流程：
    1. 过滤 → 按能力/状态/信誉筛选可用节点
    2. 评分 → 综合评分 = 0.4×成本优势 + 0.3×信誉 + 0.2×响应速度 + 0.1×地理位置
    3. 分配 → 贪心+回溯为每个 Shard 分配最优节点集合
    """

    # 综合评分权重
    SCORE_WEIGHTS = {
        'cost_advantage': 0.40,
        'reputation': 0.30,
        'response_speed': 0.20,
        'geo_location': 0.10,
    }

    # 最低信誉阈值
    MIN_REPUTATION = 30.0

    # 每个分片默认分配节点数
    DEFAULT_NODES_PER_SHARD = 3

    def route(self, task: TaskDispatch, available_nodes: list[P2PNode]) -> dict:
        """核心路由算法

        Args:
            task: 待调度的任务
            available_nodes: 可用节点列表

        Returns:
            路由结果字典：
            {
                'shard_assignments': {shard_id: [node_ids]},
                'estimated_cost': float,
                'score_matrix': {shard_id: [(node_id, score), ...]},
            }
        """
        from django.utils import timezone as tz

        shards = list(task.shards.all())
        if not shards:
            logger.warning(f"Route called for task {task.task_id} with no shards")
            return {
                'shard_assignments': {},
                'estimated_cost': 0.0,
                'score_matrix': {},
            }

        requirements = {
            'security_level': task.security_level,
            'privacy_level': task.privacy_level,
            'preferred_region': task.preferred_region,
            'capabilities': set(),
        }
        for s in shards:
            for cap in (s.required_capabilities or []):
                requirements['capabilities'].add(cap)

        filtered_nodes = self._filter_nodes(available_nodes, requirements)
        if not filtered_nodes:
            logger.warning(
                f"No nodes passed filtering for task {task.task_id}. "
                f"Available: {len(available_nodes)}, after filter: 0"
            )
            return {
                'shard_assignments': {},
                'estimated_cost': 0.0,
                'score_matrix': {},
                'warning': 'no_available_nodes',
            }

        score_matrix = {}
        for shard in shards:
            scored = []
            for node in filtered_nodes:
                score = self._score_node(node, shard)
                scored.append((node.node_id, score))
            scored.sort(key=lambda x: x[1], reverse=True)
            score_matrix[shard.shard_id] = scored

        assignments = self._optimize_assignment(shards, filtered_nodes, score_matrix)

        estimator = ComputeCostEstimator()
        estimated_cost = estimator.estimate_total_cost(task, assignments)

        result = {
            'shard_assignments': assignments,
            'estimated_cost': estimated_cost,
            'score_matrix': {sid: [(nid, round(s, 4)) for nid, s in pairs]
                             for sid, pairs in score_matrix.items()},
            'routed_at': tz.now().isoformat(),
            'nodes_considered': len(available_nodes),
            'nodes_filtered': len(filtered_nodes),
        }

        logger.info(
            f"EIHM routing complete: task={task.task_id}, "
            f"shards={len(shards)}, assigned_shards={len(assignments)}, "
            f"estimated_cost={estimated_cost:.6f}"
        )
        return result

    def _filter_nodes(self, nodes: list[P2PNode], requirements: dict) -> list[P2PNode]:
        """过滤可用节点

        过滤条件：
        - 状态排除 offline/banned/maintenance
        - 能力匹配 required_capabilities（任一即可，非全部必须）
        - 信誉 >= 阈值
        """
        excluded_status = {'offline', 'banned', 'maintenance'}
        required_caps = requirements.get('capabilities', set())

        filtered = []
        for node in nodes:
            if node.status in excluded_status:
                continue

            if node.reputation_score < self.MIN_REPUTATION:
                continue

            if required_caps:
                node_caps = set(node.capabilities or [])
                if not node_caps.intersection(required_caps):
                    continue

            filtered.append(node)

        logger.debug(
            f"Node filter: input={len(nodes)}, output={len(filtered)}, "
            f"required_caps={required_caps}"
        )
        return filtered

    def _score_node(self, node: P2PNode, shard: TaskShard) -> float:
        """单个节点-分片匹配评分

        综合评分 = 0.4×成本优势 + 0.3×信誉 + 0.2×响应速度 + 0.1×地理位置
        所有维度均归一化到 [0, 1]，分数越高越优。
        """
        w = self.SCORE_WEIGHTS

        # ---- 成本优势（分数越高=越便宜） ----
        estimator = ComputeCostEstimator()
        raw_cost = estimator.estimate_shard_cost(shard, node)
        max_reasonable_cost = 10.0
        cost_score = max(0.0, 1.0 - raw_cost / max_reasonable_cost)

        # ---- 信誉（归一化到 0-1） ----
        reputation_score = min(node.reputation_score / 100.0, 1.0)

        # ---- 响应速度（基于心跳间隔，间隔越短越好） ----
        from django.utils import timezone as dj_tz
        now = dj_tz.now()
        if node.last_heartbeat:
            delta_sec = (now - node.last_heartbeat).total_seconds()
            response_score = max(0.0, 1.0 - delta_sec / 300.0)
        else:
            response_score = 0.0

        # ---- 地理位置（优先匹配任务偏好区域） ----
        geo_score = 0.5
        task = shard.task
        preferred = getattr(task, 'preferred_region', '') or ''
        if preferred and node.location:
            pref_lower = preferred.lower()
            loc_lower = node.location.lower()
            if pref_lower in loc_lower or loc_lower in pref_lower:
                geo_score = 1.0
            else:
                geo_score = 0.2

        total = (
            w['cost_advantage'] * cost_score
            + w['reputation'] * reputation_score
            + w['response_speed'] * response_score
            + w['geo_location'] * geo_score
        )

        return round(total, 6)

    def _optimize_assignment(
        self,
        shards: list[TaskShard],
        nodes: list[P2PNode],
        score_matrix: dict,
    ) -> dict:
        """贪心+回溯的分配优化

        策略：
        1. 为每个分片按评分取 top-N 节点
        2. 尽量避免单节点过载（同一节点被过多分片选中时降权）
        3. 依赖顺序靠前的分片优先分配
        """
        sorted_shards = sorted(shards, key=lambda s: s.sequence)
        assignments = {}
        node_usage_count = {n.node_id: 0 for n in nodes}

        for shard in sorted_shards:
            candidates = score_matrix.get(shard.shard_id, [])
            if not candidates:
                assignments[shard.shard_id] = []
                continue

            # 对候选节点重新打分：原分 × 过载惩罚因子
            re_scored = []
            for node_id, base_score in candidates:
                usage = node_usage_count.get(node_id, 0)
                penalty = 1.0 / (1.0 + usage * 0.3)
                adjusted = base_score * penalty
                re_scored.append((node_id, adjusted))

            re_scored.sort(key=lambda x: x[1], reverse=True)
            selected_count = min(self.DEFAULT_NODES_PER_SHARD, len(re_scored))
            selected = [nid for nid, _ in re_scored[:selected_count]]

            for nid in selected:
                node_usage_count[nid] = node_usage_count.get(nid, 0) + 1

            assignments[shard.shard_id] = selected

        logger.debug(
            f"Assignment optimized: {len(shards)} shards, "
            f"node_usage={dict(sorted(node_usage_count.items(), key=lambda x: x[1], reverse=True)[:5])}"
        )
        return assignments
