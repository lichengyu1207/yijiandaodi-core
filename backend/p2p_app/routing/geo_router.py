import logging
from typing import Optional, List, Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)

REGION_GROUPS = {
    "CN-East": ["cn-east-1", "cn-east-2", "shanghai", "hangzhou"],
    "CN-North": ["cn-north-1", "beijing", "tianjin"],
    "CN-South": ["cn-south-1", "guangzhou", "shenzhen"],
    "CN-West": ["cn-northwest-1", "chengdu", "xian"],
    "US-East": ["us-east-1", "virginia"],
    "US-West": ["us-west-1", "us-west-2", "oregon", "california"],
    "EU-Central": ["eu-central-1", "frankfurt"],
    "EU-West": ["eu-west-1", "london", "ireland"],
    "APAC": ["ap-southeast-1", "singapore", "tokyo", "seoul"],
}


class GeoRouter:
    def __init__(self):
        self.region_groups = REGION_GROUPS

    def route_by_region(
        self,
        task_context: dict,
        nodes: list,
        preferred_region: str = None,
    ) -> list:
        target_region = self._determine_target_region(
            task_context, nodes, preferred_region
        )
        
        logger.info(f"目标地域: {target_region}")

        filtered_nodes = self._filter_nodes_by_region(target_region, nodes)
        
        sorted_nodes = self._sort_by_latency(filtered_nodes)

        if len(sorted_nodes) < len(nodes):
            logger.info(
                f"地域过滤完成: {len(sorted_nodes)}/{len(nodes)} 节点匹配地域 {target_region}"
            )
        else:
            logger.warning(
                f"未找到匹配地域 {target_region} 的节点，返回所有在线节点"
            )

        return sorted_nodes

    def _determine_target_region(
        self,
        task_context: dict,
        nodes: list,
        preferred_region: str = None,
    ) -> str:
        data_residency = task_context.get("data_residency")
        if data_residency:
            return data_residency

        if preferred_region:
            return preferred_region

        if nodes and len(nodes) > 0:
            first_node_location = nodes[0].get("location", "")
            region = self.get_region_for_location(first_node_location)
            if region:
                return region

        return "default"

    def _filter_nodes_by_region(
        self, target_region: str, nodes: list
    ) -> list:
        same_region_nodes = []
        same_country_nodes = []
        online_nodes = []

        for node in nodes:
            location = node.get("location", "")
            is_online = node.get("is_online", True)

            if not is_online:
                continue

            online_nodes.append(node)

            node_region = self.get_region_for_location(location)

            if node_region == target_region:
                same_region_nodes.append(node)
            elif self._is_same_country(node_region, target_region):
                same_country_nodes.append(node)

        if len(same_region_nodes) > 0:
            return same_region_nodes
        elif len(same_country_nodes) > 0:
            logger.info(
                f"同地域节点不足，放宽到同国家节点 ({len(same_country_nodes)} 个)"
            )
            return same_country_nodes
        elif len(online_nodes) > 0:
            logger.warning("同国家节点不足，返回所有在线节点")
            return online_nodes
        else:
            return []

    def _is_same_country(self, region1: str, region2: str) -> bool:
        if not region1 or not region2:
            return False
        
        country1 = region1.split("-")[0] if "-" in region1 else region1[:2]
        country2 = region2.split("-")[0] if "-" in region2 else region2[:2]
        
        return country1 == country2

    def _sort_by_latency(self, nodes: list) -> list:
        def get_latency_score(node: dict) -> float:
            last_heartbeat = node.get("last_heartbeat")
            if last_heartbeat:
                try:
                    if isinstance(last_heartbeat, (int, float)):
                        heartbeat_time = datetime.fromtimestamp(last_heartbeat)
                    elif isinstance(last_heartbeat, str):
                        heartbeat_time = datetime.fromisoformat(last_heartbeat)
                    else:
                        heartbeat_time = datetime.now()
                    
                    latency_seconds = (
                        datetime.now() - heartbeat_time
                    ).total_seconds()
                    return latency_score
                except (ValueError, TypeError):
                    return float("inf")
            else:
                return float("inf")

        return sorted(nodes, key=get_latency_score)

    def get_region_for_location(self, location: str) -> Optional[str]:
        if not location:
            return None

        location_lower = location.lower()

        for region_name, locations in self.region_groups.items():
            for loc in locations:
                if loc.lower() in location_lower or location_lower in loc.lower():
                    return region_name

        return None

    def get_multi_region_candidates(
        self,
        nodes: list,
        regions: List[str],
        redundancy: int = 2,
    ) -> list:
        selected_nodes = []

        for region in regions:
            region_nodes = self._filter_nodes_by_region(region, nodes)
            
            top_n_nodes = self._sort_by_latency(region_nodes)[:redundancy]
            
            for node in top_n_nodes:
                node_with_metadata = {
                    **node,
                    "_selected_region": region,
                    "_selection_priority": len(selected_nodes),
                }
                selected_nodes.append(node_with_metadata)

        logger.info(
            f"多地域冗余选择完成: 从 {len(regions)} 个地域选择了 "
            f"{len(selected_nodes)} 个节点（每个地域最多 {redundancy} 个）"
        )

        return selected_nodes
