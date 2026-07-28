import logging
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

ROUTING_MATRIX = {
    "small_text_local_first": {
        "name": "小文本优先本地",
        "conditions": {
            "max_size_bytes": 1024,
            "types": ["text"],
        },
        "primary": ["browser_tf", "local_desktop"],
        "fallback": ["cloud_api"],
        "description": "<1KB 文本优先浏览器TF推理或桌面节点",
    },
    "medium_text_p2p_preferred": {
        "name": "中文本优先P2P",
        "conditions": {
            "min_size_bytes": 1024,
            "max_size_bytes": 102400,
        },
        "primary": ["desktop_p2p"],
        "fallback": ["hybrid_local_cloud"],
        "description": "1KB-100KB 文本优先P2P桌面节点",
    },
    "large_text_enterprise": {
        "name": "大文本企业节点",
        "conditions": {
            "min_size_bytes": 102400,
        },
        "primary": ["enterprise_private"],
        "fallback": ["distributed_p2p"],
        "description": ">100KB 大文本优先企业私有节点",
    },
    "high_privacy_local_only": {
        "name": "高隐私纯本地",
        "conditions": {
            "privacy_level": "confidential",
        },
        "primary": ["local_execution"],
        "fallback": ["encrypted_p2p"],
        "description": "机密级数据强制本地执行",
    },
    "high_speed_gpu_first": {
        "name": "高速度GPU优先",
        "conditions": {
            "user_preference": "speed",
        },
        "primary": ["gpu_cloud"],
        "fallback": ["multi_node_parallel"],
        "description": "用户偏好速度时优先GPU云节点",
    },
    "code_execution_sandbox": {
        "name": "代码沙箱执行",
        "conditions": {
            "types": ["code"],
        },
        "primary": ["desktop_sandbox"],
        "fallback": ["self_hosted_container"],
        "description": "代码执行优先桌面客户端沙箱",
    },
    "ai_inference_browser_first": {
        "name": "AI推理浏览器优先",
        "conditions": {
            "types": ["inference", "detection"],
        },
        "primary": ["browser_tf", "desktop_gpu"],
        "fallback": ["cloud_inference_api"],
        "description": "AI推理/检测优先浏览器或桌面GPU",
    },
    "batch_distributed_parallel": {
        "name": "批量分布式并行",
        "conditions": {
            "min_shard_count": 10,
        },
        "primary": ["distributed_p2p"],
        "fallback": ["enterprise_cluster"],
        "description": ">10 分片批量任务分布式并行",
    },
}


@dataclass
class RoutingDecision:
    scenario_id: Optional[str] = None
    scenario_name: Optional[str] = None
    primary_nodes: List[Dict[str, Any]] = field(default_factory=list)
    fallback_nodes: List[Dict[str, Any]] = field(default_factory=list)
    selected_path: str = ""
    confidence: float = 0.0
    metadata: Dict[str, Any] = field(default_factory=dict)


class RoutingMatrixEngine:
    def __init__(self):
        self.matrix = ROUTING_MATRIX

    def match_scenario(self, task_context: dict) -> Optional[dict]:
        for scenario_id, scenario_config in self.matrix.items():
            conditions = scenario_config.get("conditions", {})
            if self._check_conditions(conditions, task_context):
                logger.info(
                    f"路由场景匹配成功: {scenario_config['name']} (ID: {scenario_id})"
                )
                return {**scenario_config, "id": scenario_id}
        logger.warning("未找到匹配的路由场景")
        return None

    def _check_conditions(self, conditions: dict, task_context: dict) -> bool:
        for condition_key, expected_value in conditions.items():
            if not self._evaluate_condition(condition_key, expected_value, task_context):
                return False
        return True

    def _evaluate_condition(self, key: str, value: Any, context: dict) -> bool:
        if key == "types":
            task_type = context.get("task_type", "")
            return task_type in value
        elif key == "max_size_bytes":
            size_bytes = context.get("size_bytes", 0)
            return size_bytes <= value
        elif key == "min_size_bytes":
            size_bytes = context.get("size_bytes", 0)
            return size_bytes >= value
        elif key == "privacy_level":
            privacy_level = context.get("privacy_level", "")
            return privacy_level == value
        elif key == "user_preference":
            preference = context.get("preference", "")
            return preference == value
        elif key == "min_shard_count":
            shard_count = context.get("shard_count", 0)
            return shard_count >= value
        else:
            logger.debug(f"未知条件类型: {key}")
            return False

    def apply_routing_matrix(
        self, task_context: dict, available_nodes: list
    ) -> RoutingDecision:
        decision = RoutingDecision()
        matched_scenario = self.match_scenario(task_context)

        if not matched_scenario:
            logger.info("无匹配场景，返回所有可用节点")
            decision.primary_nodes = list(available_nodes)
            decision.selected_path = "default"
            return decision

        decision.scenario_id = matched_scenario["id"]
        decision.scenario_name = matched_scenario["name"]
        primary_paths = matched_scenario.get("primary", [])
        fallback_paths = matched_scenario.get("fallback", [])

        primary_nodes = self._filter_nodes_by_paths(primary_paths, available_nodes)
        fallback_nodes = self._filter_nodes_by_paths(fallback_paths, available_nodes)

        decision.primary_nodes = primary_nodes
        decision.fallback_nodes = fallback_nodes
        decision.selected_path = (
            primary_paths[0] if primary_nodes else fallback_paths[0]
        )
        decision.confidence = 0.9 if primary_nodes else 0.5
        decision.metadata = {
            "matched_conditions": matched_scenario.get("conditions", {}),
            "description": matched_scenario.get("description", ""),
        }

        logger.info(
            f"路由决策完成 - 场景: {decision.scenario_name}, "
            f"主路径节点数: {len(primary_nodes)}, "
            f"备用路径节点数: {len(fallback_nodes)}"
        )

        return decision

    def _filter_nodes_by_paths(
        self, paths: List[str], nodes: List[Dict]
    ) -> List[Dict]:
        filtered_nodes = []
        for path in paths:
            matching_nodes = self._get_nodes_for_path(path, nodes)
            filtered_nodes.extend(matching_nodes)
        return filtered_nodes

    def _get_nodes_for_path(self, path: str, nodes: List[Dict]) -> List[Dict]:
        path_mapping = {
            "browser_tf": lambda n: n.get("node_type") == "browser",
            "local_desktop": lambda n: n.get("node_type")
            in ("desktop_windows", "desktop_mac"),
            "desktop_p2p": lambda n: n.get("node_type")
            in ("desktop_windows", "desktop_mac"),
            "desktop_sandbox": lambda n: n.get("node_type")
            in ("desktop_windows", "desktop_mac"),
            "desktop_gpu": lambda n: n.get("node_type")
            in ("desktop_windows", "desktop_mac"),
            "cloud_api": lambda n: n.get("node_type") == "self_hosted",
            "gpu_cloud": lambda n: n.get("node_type") == "self_hosted",
            "cloud_inference_api": lambda n: n.get("node_type") == "self_hosted",
            "enterprise_private": lambda n: n.get("node_type") == "enterprise",
            "enterprise_cluster": lambda n: n.get("node_type") == "enterprise",
            "local_execution": lambda n: n.get("is_self", False),
            "distributed_p2p": lambda n: True,
            "hybrid_local_cloud": lambda n: True,
            "encrypted_p2p": lambda n: n.get("supports_encryption", False),
            "multi_node_parallel": lambda n: True,
            "self_hosted_container": lambda n: n.get("node_type") == "self_hosted",
        }

        filter_func = path_mapping.get(path)
        if filter_func:
            result = [n for n in nodes if filter_func(n)]
            logger.debug(
                f"路径 '{path}' 匹配到 {len(result)} 个节点"
            )
            return result
        else:
            logger.warning(f"未知路由路径: {path}")
            return []
