import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional

from django.utils import timezone as django_timezone

from ..models import P2PNode

logger = logging.getLogger(__name__)


class PrivacyLevel(Enum):
    PUBLIC = "public"
    INTERNAL = "internal"
    CONFIDENTIAL = "confidential"


@dataclass
class RoutingFactors:
    execution_cost: float = 0.0
    network_latency_ms: float = 0.0
    energy_factor: float = 0.0
    privacy_level: int = 1
    data_residency: str = ""
    node_reliability: float = 1.0


@dataclass
class RoutingDecision:
    task_id: str
    selected_nodes: List[dict]
    routing_path: str
    total_estimated_cost: float
    estimated_latency_ms: int
    fallback_path: str
    factors_used: RoutingFactors


class CostRoutingEngine:
    WEIGHTS = {
        "execution_cost": 0.40,
        "network_latency": 0.25,
        "node_reliability": 0.20,
        "privacy_security": 0.10,
        "data_residency": 0.05,
    }

    CONSTRAINTS = {
        "min_reputation": 60.0,
        "max_latency_ms": 5000,
        "confidential_local_only": True,
    }

    def __init__(self) -> None:
        self._total_routes: int = 0
        self._total_score_sum: float = 0.0
        self._route_history: List[dict] = []
        logger.info("CostRoutingEngine initialized with weights=%s", self.WEIGHTS)

    def _normalize_factor(self, value: float, min_val: float, max_val: float) -> float:
        if max_val <= min_val:
            return 0.0
        normalized = (value - min_val) / (max_val - min_val)
        return max(0.0, min(1.0, normalized))

    def _calculate_cost_score(self, node: P2PNode, task_resources: dict) -> float:
        resources = node.resources or {}
        memory_usage = resources.get("memory_usage", 50.0)
        available_memory = max(1.0, resources.get("available_memory", 100.0))

        cost_ratio = memory_usage / available_memory
        cost_score = self._normalize_factor(cost_ratio, 0.0, 2.0)

        logger.debug(
            f"Cost score for node {node.node_id}: "
            f"memory_usage={memory_usage}, available_memory={available_memory}, "
            f"score={cost_score:.4f}"
        )
        return cost_score

    def _calculate_latency_score(self, node: P2PNode) -> float:
        now = django_timezone.now()
        if node.last_heartbeat:
            delta_seconds = (now - node.last_heartbeat).total_seconds()
            latency_score = self._normalize_factor(delta_seconds, 0.0, 300.0)
        else:
            latency_score = 1.0

        logger.debug(
            f"Latency score for node {node.node_id}: "
            f"last_heartbeat={node.last_heartbeat}, score={latency_score:.4f}"
        )
        return latency_score

    def _calculate_reliability_score(self, node: P2PNode) -> float:
        reputation = node.reputation_score
        reliability_score = self._normalize_factor(reputation, 0.0, 100.0)
        inverted_reliability = 1.0 - reliability_score

        logger.debug(
            f"Reliability score for node {node.node_id}: "
            f"reputation={reputation}, score={inverted_reliability:.4f}"
        )
        return inverted_reliability

    def _calculate_security_score(self, node: P2PNode, privacy_level: PrivacyLevel) -> float:
        if privacy_level == PrivacyLevel.CONFIDENTIAL:
            local_types = {"self_hosted", "desktop_windows", "desktop_mac"}
            if node.node_type not in local_types:
                logger.warning(
                    f"Security risk: confidential task assigned to non-local node {node.node_id} "
                    f"(type={node.node_type})"
                )
                return 1.0

        if node.status != "online":
            logger.warning(
                f"Security risk: node {node.node_id} status is {node.status}"
            )
            return 1.0

        security_risk = self._normalize_factor(100.0 - node.reputation_score, 0.0, 100.0)

        logger.debug(
            f"Security score for node {node.node_id}: "
            f"privacy_level={privacy_level.value}, status={node.status}, "
            f"reputation={node.reputation_score}, score={security_risk:.4f}"
        )
        return security_risk

    def _calculate_geo_score(self, node: P2PNode, required_region: str) -> float:
        if not required_region:
            return 0.0

        node_location = (node.location or "").lower()
        required_lower = required_region.lower()

        if required_lower in node_location or node_location in required_lower:
            geo_score = 0.0
        else:
            geo_score = 1.0

        logger.debug(
            f"Geo score for node {node.node_id}: "
            f"location={node.location}, required_region={required_region}, "
            f"score={geo_score:.4f}"
        )
        return geo_score

    def route(self, task_context: dict, candidates: List[P2PNode]) -> RoutingDecision:
        task_id = task_context.get("task_id", "unknown")
        privacy_level_str = task_context.get("privacy_level", "public")
        privacy_level = PrivacyLevel(privacy_level_str)
        data_residency = task_context.get("data_residency", "")
        preferred_region = task_context.get("preferred_region", "")
        task_resources = task_context.get("estimated_resources", {})

        logger.info(
            f"Starting routing for task {task_id}: "
            f"privacy_level={privacy_level.value}, "
            f"data_residency={data_residency}, "
            f"candidates_count={len(candidates)}"
        )

        filtered_candidates = self._apply_constraints(candidates, privacy_level)
        logger.info(
            f"After constraint filtering: {len(filtered_candidates)}/{len(candidates)} candidates remain"
        )

        scored_nodes = []
        for node in filtered_candidates:
            cost_score = self._calculate_cost_score(node, task_resources)
            latency_score = self._calculate_latency_score(node)
            reliability_score = self._calculate_reliability_score(node)
            security_score = self._calculate_security_score(node, privacy_level)
            geo_score = self._calculate_geo_score(node, preferred_region or data_residency)

            total_score = (
                cost_score * self.WEIGHTS["execution_cost"]
                + latency_score * self.WEIGHTS["network_latency"]
                + reliability_score * self.WEIGHTS["node_reliability"]
                + security_score * self.WEIGHTS["privacy_security"]
                + geo_score * self.WEIGHTS["data_residency"]
            )

            reason_parts = []
            if cost_score < 0.3:
                reason_parts.append("low_cost")
            if latency_score < 0.3:
                reason_parts.append("low_latency")
            if reliability_score < 0.3:
                reason_parts.append("high_reliability")
            if security_score < 0.3:
                reason_parts.append("secure")
            if geo_score == 0.0 and (preferred_region or data_residency):
                reason_parts.append("geo_compliant")

            scored_nodes.append({
                "node_id": node.node_id,
                "score": round(total_score, 4),
                "reason": ", ".join(reason_parts) or "general_candidate",
                "details": {
                    "cost": round(cost_score, 4),
                    "latency": round(latency_score, 4),
                    "reliability": round(reliability_score, 4),
                    "security": round(security_score, 4),
                    "geo": round(geo_score, 4),
                }
            })

            logger.debug(
                f"Node {node.node_id} scoring: total={total_score:.4f}, "
                f"cost={cost_score:.4f}, latency={latency_score:.4f}, "
                f"reliability={reliability_score:.4f}, security={security_score:.4f}, "
                f"geo={geo_score:.4f}"
            )

        scored_nodes.sort(key=lambda x: x["score"])
        top_n = min(3, len(scored_nodes))
        selected_nodes = scored_nodes[:top_n]

        routing_path = self._determine_routing_path(selected_nodes, task_context)
        fallback_path = self._determine_fallback_path(routing_path, task_context)

        avg_score = sum(n["score"] for n in selected_nodes) / len(selected_nodes) if selected_nodes else 0.0
        estimated_cost = avg_score * (task_context.get("size_bytes", 1024) / 1024) * 0.001
        estimated_latency = int(avg_score * 1000)

        factors = RoutingFactors(
            execution_cost=sum(n["details"]["cost"] for n in selected_nodes) / len(selected_nodes) if selected_nodes else 0.0,
            network_latency_ms=sum(n["details"]["latency"] for n in selected_nodes) / len(selected_nodes) if selected_nodes else 0.0,
            energy_factor=0.0,
            privacy_level=privacy_level.value,
            data_residency=data_residency,
            node_reliability=sum(n["details"]["reliability"] for n in selected_nodes) / len(selected_nodes) if selected_nodes else 1.0,
        )

        self._total_routes += 1
        self._total_score_sum += avg_score
        self._route_history.append({
            "task_id": task_id,
            "timestamp": django_timezone.now().isoformat(),
            "selected_count": len(selected_nodes),
            "avg_score": avg_score,
            "routing_path": routing_path,
        })

        decision = RoutingDecision(
            task_id=task_id,
            selected_nodes=selected_nodes,
            routing_path=routing_path,
            total_estimated_cost=round(estimated_cost, 6),
            estimated_latency_ms=estimated_latency,
            fallback_path=fallback_path,
            factors_used=factors,
        )

        logger.info(
            f"Routing decision for task {task_id}: "
            f"path={routing_path}, selected={len(selected_nodes)} nodes, "
            f"avg_score={avg_score:.4f}, estimated_cost={estimated_cost:.6f}, "
            f"fallback={fallback_path}"
        )

        return decision

    def _apply_constraints(
        self,
        candidates: List[P2PNode],
        privacy_level: PrivacyLevel
    ) -> List[P2PNode]:
        filtered = []
        excluded_reasons = {}

        for node in candidates:
            if node.reputation_score < self.CONSTRAINTS["min_reputation"]:
                excluded_reasons.setdefault("low_reputation", []).append(node.node_id)
                continue

            if node.status in ("banned", "offline", "maintenance"):
                excluded_reasons.setdefault(f"status_{node.status}", []).append(node.node_id)
                continue

            if (
                privacy_level == PrivacyLevel.CONFIDENTIAL
                and self.CONSTRAINTS["confidential_local_only"]
            ):
                local_types = {"self_hosted", "desktop_windows", "desktop_mac"}
                if node.node_type not in local_types:
                    excluded_reasons.setdefault("non_local_confidential", []).append(node.node_id)
                    continue

            filtered.append(node)

        for reason, nodes in excluded_reasons.items():
            logger.debug(
                f"Excluded {len(nodes)} nodes due to {reason}: {nodes[:5]}"
            )

        return filtered

    def _determine_routing_path(self, selected_nodes: List[dict], task_context: dict) -> str:
        if not selected_nodes:
            return "no_available_path"

        has_desktop = any(
            "desktop" in n["node_id"].lower() or "self_hosted" in n["node_id"].lower()
            for n in selected_nodes
        )
        has_cloud = any(
            "enterprise" in n["node_id"].lower() or "cloud" in n["node_id"].lower()
            for n in selected_nodes
        )

        privacy_level = task_context.get("privacy_level", "public")

        if privacy_level == "confidential":
            return "local_only"
        elif has_desktop and has_cloud:
            return "hybrid_p2p_cloud"
        elif has_desktop:
            return "desktop_p2p"
        elif has_cloud:
            return "cloud_api"
        else:
            return "generic_p2p"

    def _determine_fallback_path(self, current_path: str, task_context: dict) -> str:
        fallback_map = {
            "local_only": "desktop_p2p",
            "hybrid_p2p_cloud": "desktop_p2p",
            "desktop_p2p": "cloud_api",
            "cloud_api": "generic_p2p",
            "generic_p2p": "queue_retry",
            "no_available_path": "queue_retry",
        }
        return fallback_map.get(current_path, "queue_retry")

    def get_routing_stats(self) -> dict:
        avg_score = (
            self._total_score_sum / self._total_routes
            if self._total_routes > 0
            else 0.0
        )

        recent_history = self._route_history[-10:] if self._route_history else []

        return {
            "total_routes": self._total_routes,
            "average_score": round(avg_score, 4),
            "weights": dict(self.WEIGHTS),
            "constraints": dict(self.CONSTRAINTS),
            "recent_history": recent_history,
        }
