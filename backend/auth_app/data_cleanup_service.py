"""
数据清理和归档服务

提供磁盘空间监控和自动清理功能
"""

import logging
import time
import os
import shutil
from typing import Dict, Optional
from django.utils import timezone
from datetime import timedelta

from .trajectory_models import BehaviorTrajectory, TrajectoryArchive
from .agent_activity_models import AgentActivityLog
from .trajectory_logger import get_trajectory_logger, StructuredLogger

logger = get_trajectory_logger()


class DataCleanupService:
    """
    数据清理服务

    功能：
    1. 磁盘空间监控
    2. 自动清理过期数据
    3. 性能优化的批量删除
    """

    # 磁盘空间阈值
    DISK_WARNING_THRESHOLD = 0.15  # 磁盘使用率超过85%时警告
    DISK_CRITICAL_THRESHOLD = 0.10  # 磁盘剩余空间小于10%时紧急清理

    @classmethod
    def check_disk_space(cls, db_path: str) -> Dict[str, float]:
        """
        检查磁盘空间

        Args:
            db_path: 数据库文件路径

        Returns:
            磁盘空间信息字典
        """
        check_start = time.time()

        try:
            # 获取磁盘使用情况
            disk_usage = shutil.disk_usage(db_path)
            total_gb = disk_usage.total / (1024 ** 3)
            used_gb = disk_usage.used / (1024 ** 3)
            free_gb = disk_usage.free / (1024 ** 3)
            used_percent = disk_usage.used / disk_usage.total

            # 检查数据库文件大小
            db_size_mb = 0
            if os.path.exists(db_path):
                db_size_mb = os.path.getsize(db_path) / (1024 ** 2)

            check_duration = (time.time() - check_start) * 1000

            disk_info = {
                'total_gb': round(total_gb, 2),
                'used_gb': round(used_gb, 2),
                'free_gb': round(free_gb, 2),
                'used_percent': round(used_percent * 100, 1),
                'free_percent': round((1 - used_percent) * 100, 1),
                'db_size_mb': round(db_size_mb, 2),
                'check_duration_ms': round(check_duration, 2),
            }

            # 记录磁盘空间日志
            logger.info(
                "磁盘空间检查完成",
                **disk_info
            )

            # 磁盘空间警告
            if used_percent > 0.85:
                logger.warning(
                    "⚠️ 磁盘空间不足",
                    **{
                        'used_percent': round(used_percent * 100, 1),
                        'free_gb': round(free_gb, 2),
                        'threshold_percent': 85,
                    }
                )

            return disk_info

        except Exception as e:
            logger.error(
                "检查磁盘空间失败",
                **{
                    'db_path': db_path,
                    'error': str(e),
                    'error_type': type(e).__name__,
                }
            )
            return {}

    @classmethod
    def cleanup_old_activities(cls, days: int = 30, batch_size: int = 1000) -> int:
        """
        清理旧的Agent活动日志

        Args:
            days: 保留多少天的数据
            batch_size: 批量删除大小

        Returns:
            删除的记录数
        """
        cleanup_start = time.time()
        cutoff_date = timezone.now() - timedelta(days=days)

        logger.info(
            "开始清理旧活动日志",
            **{
                'cutoff_days': days,
                'cutoff_date': cutoff_date.isoformat(),
                'batch_size': batch_size,
            }
        )

        # 检查磁盘空间
        db_path = os.getcwd()  # 获取数据库路径
        disk_before = cls.check_disk_space(db_path)

        try:
            # 批量删除
            deleted_count = 0
            batch_num = 0

            while True:
                batch_start = time.time()

                # 查询待删除的记录ID
                ids_to_delete = list(
                    AgentActivityLog.objects.filter(
                        timestamp__lt=cutoff_date
                    ).values_list('activity_id', flat=True)[:batch_size]
                )

                if not ids_to_delete:
                    break

                # 批量删除
                delete_start = time.time()
                deleted = AgentActivityLog.objects.filter(
                    activity_id__in=ids_to_delete
                ).delete()[0]
                delete_duration = (time.time() - delete_start) * 1000

                deleted_count += deleted
                batch_num += 1

                batch_duration = (time.time() - batch_start) * 1000

                logger.info(
                    "批次删除完成",
                    **{
                        'batch_num': batch_num,
                        'batch_size': len(ids_to_delete),
                        'deleted_count': deleted_count,
                        'delete_duration_ms': round(delete_duration, 2),
                        'batch_duration_ms': round(batch_duration, 2),
                    }
                )

            total_duration = (time.time() - cleanup_start) * 1000

            # 检查清理后的磁盘空间
            disk_after = cls.check_disk_space(db_path)

            # 计算空间释放
            space_freed_gb = 0
            if disk_before and disk_after:
                space_freed_gb = disk_after.get('free_gb', 0) - disk_before.get('free_gb', 0)

            logger.log_performance(
                "清理旧活动日志完成",
                duration_ms=total_duration,
                threshold_ms=10000.0,
                **{
                    'deleted_count': deleted_count,
                    'batch_count': batch_num,
                    'total_duration_ms': round(total_duration, 2),
                    'avg_per_batch_ms': round(total_duration / max(batch_num, 1), 2),
                    'space_freed_gb': round(space_freed_gb, 3),
                    'disk_before': disk_before,
                    'disk_after': disk_after,
                }
            )

            return deleted_count

        except Exception as e:
            total_duration = (time.time() - cleanup_start) * 1000

            logger.error(
                "清理旧活动日志失败",
                **{
                    'error': str(e),
                    'error_type': type(e).__name__,
                    'duration_ms': round(total_duration, 2),
                    'deleted_count': deleted_count if 'deleted_count' in locals() else 0,
                }
            )

            return 0

    @classmethod
    def _bulk_delete(cls, model, date_field, cutoff, batch_size: int = 1000) -> int:
        """
        按日期字段分批删除旧数据（严格小于 cutoff），避免一次性删除锁表/占满内存。

        Args:
            model: Django 模型类
            date_field: 时间字段名（支持 datetime/date/YYYYMMDDHH 字符串）
            cutoff: 截止时间（早于该值的记录被删除）
            batch_size: 每批删除数量

        Returns:
            删除的记录总数
        """
        deleted_count = 0
        while True:
            ids = list(
                model.objects.filter(**{f'{date_field}__lt': cutoff})
                .values_list('pk', flat=True)[:batch_size]
            )
            if not ids:
                break
            deleted_count += model.objects.filter(pk__in=ids).delete()[0]
        return deleted_count

    @classmethod
    def run_all_cleanup(cls, batch_size: int = 1000) -> Dict[str, int]:
        """
        统一数据保留清理（按《数据安全法》《网络安全法》合规保留期分批删除）。

        保留期来自 settings.DATA_RETENTION_DAYS（均可通过环境变量覆盖）：
        - security_logs（默认 180 天）：登录/行为/API调用/Agent 活动日志（网安法≥6个月）
        - billing_logs（默认 365 天）：AI 计费记录（覆盖对账周期）
        - stats_snapshots（默认 730 天）：统计聚合快照（支撑 2 年趋势对比）

        Returns:
            各表（db_table → 删除数）的映射
        """
        from django.conf import settings
        from .models import LoginLog
        from .apikey_models import APIKeyUsageLog
        from .user_behavior_models import UserBehaviorLog
        from .billing_models import APICallLog
        from .stats_models import (
            DailyPlatformStats, SkillDailyStats, AreaClickStats,
            RevenueDailyStats, HourlyRegionStats,
        )
        from .payment_models import SkillHotnessSnapshot

        retention = settings.DATA_RETENTION_DAYS
        now = timezone.now()

        def _cutoff(days: int):
            return now - timedelta(days=days)

        results: Dict[str, int] = {}

        # 安全/操作日志类（含个人信息，网安法要求留存≥6个月）
        security_tables = [
            (LoginLog, 'login_time'),
            (APIKeyUsageLog, 'timestamp'),
            (UserBehaviorLog, 'created_at'),
            (AgentActivityLog, 'timestamp'),
        ]
        for model, field in security_tables:
            results[model._meta.db_table] = cls._bulk_delete(
                model, field, _cutoff(retention['security_logs']), batch_size)

        # 计费/消费记录（对账周期）
        for model, field in [(APICallLog, 'created_at')]:
            results[model._meta.db_table] = cls._bulk_delete(
                model, field, _cutoff(retention['billing_logs']), batch_size)

        # 统计聚合快照（聚合数据，长期趋势对比）
        stats_tables = [
            (DailyPlatformStats, 'date'),
            (SkillDailyStats, 'date'),
            (AreaClickStats, 'date'),
            (RevenueDailyStats, 'date'),
            (HourlyRegionStats, 'hour'),
        ]
        for model, field in stats_tables:
            results[model._meta.db_table] = cls._bulk_delete(
                model, field, _cutoff(retention['stats_snapshots']), batch_size)

        # SkillHotnessSnapshot 使用 YYYYMMDDHH 字符串时间键，字典序=时间序
        hour_cutoff = _cutoff(retention['stats_snapshots']).strftime('%Y%m%d00')
        results[SkillHotnessSnapshot._meta.db_table] = cls._bulk_delete(
            SkillHotnessSnapshot, 'hour_key', hour_cutoff, batch_size)

        logger.info("统一数据保留清理完成", **{'deleted_by_table': results})
        return results

    @classmethod
    def get_table_sizes(cls) -> Dict[str, int]:
        """
        获取各表的数据量

        Returns:
            表名到记录数的映射
        """
        check_start = time.time()

        try:
            sizes = {
                'behavior_trajectories': BehaviorTrajectory.objects.count(),
                'trajectory_archives': TrajectoryArchive.objects.count(),
                'agent_activities': AgentActivityLog.objects.count(),
            }

            check_duration = (time.time() - check_start) * 1000

            logger.info(
                "表数据量统计完成",
                **{
                    'behavior_trajectories': sizes['behavior_trajectories'],
                    'trajectory_archives': sizes['trajectory_archives'],
                    'agent_activities': sizes['agent_activities'],
                    'check_duration_ms': round(check_duration, 2),
                }
            )

            return sizes

        except Exception as e:
            logger.error(
                "获取表数据量失败",
                **{
                    'error': str(e),
                    'error_type': type(e).__name__,
                }
            )
            return {}