import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)


class IdleDetectionService:
    """闲时检测服务 - 评估节点资源使用状态，判断是否触发任务迁移"""

    IDLE_THRESHOLDS: Dict[str, float] = {
        "cpu_usage": 0.30,
        "memory_usage": 0.40,
        "disk_io_usage": 0.20,
        "network_bandwidth_usage": 0.30,
    }

    EMERGENCY_THRESHOLDS: float = 0.80

    @classmethod
    def evaluate_idle_state(cls, metrics_dict: Dict[str, float]) -> str:
        """
        评估节点空闲状态

        Args:
            metrics_dict: 资源指标字典，包含 cpu_usage/memory_usage/disk_io_usage/network_bandwidth_usage (0-1)

        Returns:
            状态字符串: "IDLE" / "PARTIAL_BUSY" / "BUSY"
        """
        cpu = metrics_dict.get('cpu_usage', 0)
        memory = metrics_dict.get('memory_usage', 0)
        disk_io = metrics_dict.get('disk_io_usage', 0)
        network = metrics_dict.get('network_bandwidth_usage', 0)

        if any(v >= cls.EMERGENCY_THRESHOLDS for v in [cpu, memory, disk_io, network]):
            return 'BUSY'

        if (cpu < cls.IDLE_THRESHOLDS['cpu_usage'] and
                memory < cls.IDLE_THRESHOLDS['memory_usage'] and
                disk_io < cls.IDLE_THRESHOLDS['disk_io_usage'] and
                network < cls.IDLE_THRESHOLDS['network_bandwidth_usage']):
            return 'IDLE'

        return 'PARTIAL_BUSY'

    @classmethod
    def should_trigger_migration(cls, current_state: str, previous_state: str) -> bool:
        """
        判断是否应触发任务迁移

        当节点从非 BUSY 状态刚进入 BUSY 状态时，返回 True。

        Args:
            current_state: 当前状态 ("IDLE" / "PARTIAL_BUSY" / "BUSY")
            previous_state: 前一状态

        Returns:
            是否需要触发迁移
        """
        return current_state == 'BUSY' and previous_state != 'BUSY'

    @classmethod
    def get_resource_contention_level(cls, metrics_dict: Dict[str, float]) -> Dict[str, str]:
        """
        获取各资源的使用等级描述

        Args:
            metrics_dict: 资源指标字典 (0-1)

        Returns:
            各资源等级描述字典
        """
        levels: Dict[str, str] = {}

        cpu = metrics_dict.get('cpu_usage', 0)
        memory = metrics_dict.get('memory_usage', 0)
        disk_io = metrics_dict.get('disk_io_usage', 0)
        network = metrics_dict.get('network_bandwidth_usage', 0)

        levels['cpu'] = cls._describe_level(cpu, cls.IDLE_THRESHOLDS['cpu_usage'])
        levels['memory'] = cls._describe_level(memory, cls.IDLE_THRESHOLDS['memory_usage'])
        levels['disk_io'] = cls._describe_level(disk_io, cls.IDLE_THRESHOLDS['disk_io_usage'])
        levels['network'] = cls._describe_level(network, cls.IDLE_THRESHOLDS['network_bandwidth_usage'])

        return levels

    @classmethod
    def _describe_level(cls, value: float, idle_threshold: float) -> str:
        """根据阈值描述资源使用等级"""
        if value >= cls.EMERGENCY_THRESHOLDS:
            return '极高'
        elif value >= idle_threshold:
            return '偏高'
        else:
            return '正常'
