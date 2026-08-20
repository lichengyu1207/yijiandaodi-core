"""
结构化JSON日志工具

用于ELK Stack解析的性能日志
"""

import logging
import json
import time
from typing import Dict, Any, Optional


class StructuredLogger:
    """
    结构化日志记录器

    输出JSON格式日志，便于ELK解析：
    {
        "timestamp": "2026-08-08T14:30:00.123Z",
        "level": "INFO",
        "logger": "TrajectoryBuilder",
        "message": "轨迹构建完成",
        "trajectory_id": "traj_xxx",
        "session_id": "session_xxx",
        "duration_ms": 45.23,
        "step1_query_ms": 12.5,
        "step2_create_ms": 5.3,
        ...
    }
    """

    def __init__(self, name: str):
        self.logger = logging.getLogger(name)
        self.component = name.split('.')[-1]  # 提取类名

    def _log(self, level: str, message: str, **kwargs) -> None:
        """
        内部日志方法

        Args:
            level: 日志级别
            message: 日志消息
            **kwargs: 结构化字段
        """
        log_data = {
            'timestamp': time.time(),
            'level': level,
            'logger': self.component,
            'message': message,
        }

        # 添加结构化字段
        log_data.update(kwargs)

        # 转换为JSON字符串
        log_json = json.dumps(log_data, ensure_ascii=False)

        # 根据级别调用对应的日志方法
        if level == 'DEBUG':
            self.logger.debug(log_json)
        elif level == 'INFO':
            self.logger.info(log_json)
        elif level == 'WARNING':
            self.logger.warning(log_json)
        elif level == 'ERROR':
            self.logger.error(log_json)
        elif level == 'CRITICAL':
            self.logger.critical(log_json)

    def debug(self, message: str, **kwargs) -> None:
        """DEBUG级别日志"""
        self._log('DEBUG', message, **kwargs)

    def info(self, message: str, **kwargs) -> None:
        """INFO级别日志"""
        self._log('INFO', message, **kwargs)

    def warning(self, message: str, **kwargs) -> None:
        """WARNING级别日志"""
        self._log('WARNING', message, **kwargs)

    def error(self, message: str, **kwargs) -> None:
        """ERROR级别日志"""
        self._log('ERROR', message, **kwargs)

    def critical(self, message: str, **kwargs) -> None:
        """CRITICAL级别日志"""
        self._log('CRITICAL', message, **kwargs)

    def log_performance(self, message: str, duration_ms: float, threshold_ms: float = None, **kwargs) -> None:
        """
        性能日志（带阈值判断）

        Args:
            message: 日志消息
            duration_ms: 耗时（毫秒）
            threshold_ms: 性能阈值（毫秒），超过则警告
            **kwargs: 其他字段
        """
        log_data = {
            'duration_ms': round(duration_ms, 2),
            **kwargs
        }

        if threshold_ms and duration_ms > threshold_ms:
            log_data['performance_warning'] = True
            log_data['threshold_ms'] = threshold_ms
            self.warning(f"⚠️ {message}", **log_data)
        else:
            self.info(f"✅ {message}", **log_data)


# 预定义的日志字段常量（用于ELK字段标准化）
class LogFields:
    """日志字段常量"""

    # 轨迹相关
    TRAJECTORY_ID = 'trajectory_id'
    SESSION_ID = 'session_id'
    CLIENT_ID = 'client_id'
    ACTIVITY_ID = 'activity_id'

    # 性能相关
    DURATION_MS = 'duration_ms'
    STEP1_QUERY_MS = 'step1_query_ms'
    STEP2_CREATE_MS = 'step2_create_ms'
    STEP3_ADD_MS = 'step3_add_ms'
    STEP4_CALCULATE_MS = 'step4_calculate_ms'
    STEP5_SAVE_MS = 'step5_save_ms'

    # 风险相关
    CHAIN_RISK_SCORE = 'chain_risk_score'
    TOTAL_ACTIVITIES = 'total_activities'
    ANOMALY_FLAGS = 'anomaly_flags'

    # 归档相关
    ARCHIVED_COUNT = 'archived_count'
    FAILED_COUNT = 'failed_count'
    AVG_DURATION_MS = 'avg_duration_ms'


# 导出便捷函数
def get_trajectory_logger() -> StructuredLogger:
    """获取TrajectoryBuilder的结构化日志记录器"""
    return StructuredLogger('auth_app.trajectory_builder')