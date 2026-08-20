"""
Celery异步任务

将轨迹构建和归档任务异步化，避免阻塞主线程
"""

import logging
import time
import traceback
import sys
from celery import shared_task
from django.utils import timezone
from datetime import timedelta

from .trajectory_builder import TrajectoryBuilder
from .agent_activity_models import AgentActivityLog
from .trajectory_models import BehaviorTrajectory
from .trajectory_logger import get_trajectory_logger

logger = get_trajectory_logger()


class TaskAlertService:
    """
    任务告警服务

    在Celery任务失败时推送WebSocket告警到桌面端
    """

    @staticmethod
    def push_task_failure_alert(task_id: str, task_name: str, error: str, activity_id: str = None, traceback_str: str = None):
        """
        推送任务失败告警

        Args:
            task_id: Celery任务ID
            task_name: 任务名称
            error: 错误信息
            activity_id: 活动ID（可选）
            traceback_str: 堆栈追踪字符串（可选）
        """
        try:
            from channels.layers import get_channel_layer
            from asgiref.sync import async_to_sync
            from django.utils import timezone as tz

            channel_layer = get_channel_layer()

            if not channel_layer:
                logger.warning("Channel Layer未配置，无法推送任务失败告警")
                return

            # 获取client_id（从activity_id推断）
            client_id = "unknown"

            if activity_id:
                try:
                    activity = AgentActivityLog.objects.get(activity_id=activity_id)
                    client_id = activity.client_id
                except AgentActivityLog.DoesNotExist:
                    pass

            # 构建任务失败告警数据
            alert_data = {
                'alert_id': f'task_failure_{task_id}',
                'alert_type': 'task_failure',
                'timestamp': tz.now().isoformat(),
                'task_id': task_id,
                'task_name': task_name,
                'error': str(error),
                'error_type': type(error).__name__ if hasattr(error, '__class__') else 'Exception',
                'traceback': traceback_str,
                'activity_id': activity_id,
                'client_id': client_id,
                'risk_level': 'high',
                'overall_score': 85.0,
                'recommendations': [
                    '检查任务执行日志',
                    '确认数据完整性',
                    '如需要可手动重试任务'
                ]
            }

            # 推送到指定client_id的频道组
            async_to_sync(channel_layer.group_send)(
                f'agent_alerts_{client_id}',
                {
                    'type': 'task_alert',  # 使用task_alert类型
                    'data': alert_data
                }
            )

            logger.info(
                "推送任务失败告警",
                **{
                    'task_id': task_id,
                    'task_name': task_name,
                    'client_id': client_id,
                    'error_type': alert_data['error_type'],
                }
            )

        except Exception as e:
            logger.error(
                "推送任务失败告警失败",
                **{
                    'task_id': task_id,
                    'error': str(e),
                    'error_type': type(e).__name__,
                }
            )


@shared_task(bind=True, max_retries=3)
def build_trajectory_async(self, activity_id: str) -> dict:
    """
    异步构建轨迹任务

    Args:
        activity_id: AgentActivityLog的ID

    Returns:
        构建结果字典
    """
    task_start = time.time()

    try:
        logger.info(
            "异步轨迹构建任务开始",
            **{
                'task_id': self.request.id,
                'activity_id': activity_id,
                'retry_count': self.request.retries,
            }
        )

        # 根据ID重新查询活动日志（避免序列化问题）
        try:
            activity_log = AgentActivityLog.objects.get(activity_id=activity_id)
        except AgentActivityLog.DoesNotExist as e:
            # 获取详细的堆栈追踪
            exc_type, exc_value, exc_traceback = sys.exc_info()
            traceback_str = ''.join(traceback.format_exception(exc_type, exc_value, exc_traceback))

            logger.error(
                "活动日志不存在",
                **{
                    'activity_id': activity_id,
                    'task_id': self.request.id,
                    'error': str(e),
                    'error_type': 'DoesNotExist',
                    'traceback': traceback_str,
                }
            )

            # 单独记录详细堆栈
            logger.error(f"详细堆栈追踪:\n{traceback_str}")

            return {
                'success': False,
                'error': 'ActivityLog not found',
                'error_type': 'DoesNotExist',
                'activity_id': activity_id,
                'traceback': traceback_str,
            }

        # 构建轨迹
        trajectory = TrajectoryBuilder.build_or_update_trajectory(activity_log)

        task_duration = (time.time() - task_start) * 1000

        if trajectory:
            logger.info(
                "异步轨迹构建完成",
                **{
                    'task_id': self.request.id,
                    'activity_id': activity_id,
                    'trajectory_id': trajectory.trajectory_id,
                    'chain_risk_score': trajectory.chain_risk_score,
                    'duration_ms': round(task_duration, 2),
                }
            )

            return {
                'success': True,
                'trajectory_id': trajectory.trajectory_id,
                'chain_risk_score': trajectory.chain_risk_score,
                'activity_id': activity_id,
            }
        else:
            logger.error(
                "轨迹构建失败",
                **{
                    'task_id': self.request.id,
                    'activity_id': activity_id,
                    'duration_ms': round(task_duration, 2),
                }
            )

            return {
                'success': False,
                'error': 'Trajectory build failed',
                'activity_id': activity_id,
            }

    except Exception as e:
        task_duration = (time.time() - task_start) * 1000

        # 获取详细的堆栈追踪
        exc_type, exc_value, exc_traceback = sys.exc_info()
        traceback_str = ''.join(traceback.format_exception(exc_type, exc_value, exc_traceback))

        logger.error(
            "异步轨迹构建异常",
            **{
                'task_id': self.request.id,
                'activity_id': activity_id,
                'error': str(e),
                'error_type': type(e).__name__,
                'duration_ms': round(task_duration, 2),
                'traceback': traceback_str,
                'retry_count': self.request.retries,
            }
        )

        # 记录详细的错误堆栈（单独一行，方便查看）
        logger.error(
            f"详细堆栈追踪:\n{traceback_str}"
        )

        # 重试（指数退避）
        try:
            self.retry(exc=e, countdown=2 ** self.request.retries)
        except self.MaxRetriesExceededError:
            logger.critical(
                "异步轨迹构建重试次数耗尽",
                **{
                    'task_id': self.request.id,
                    'activity_id': activity_id,
                    'error': str(e),
                    'error_type': type(e).__name__,
                    'max_retries': self.max_retries,
                    'total_duration_ms': round(task_duration, 2),
                    'traceback_summary': traceback_str.split('\n')[-5:] if traceback_str else [],
                }
            )

            # 推送任务失败告警到WebSocket（包含详细堆栈）
            TaskAlertService.push_task_failure_alert(
                task_id=self.request.id,
                task_name='build_trajectory_async',
                error=str(e),
                activity_id=activity_id,
                traceback_str=traceback_str
            )

            return {
                'success': False,
                'error': str(e),
                'error_type': type(e).__name__,
                'activity_id': activity_id,
                'traceback': traceback_str,
            }


@shared_task(bind=True)
def archive_old_trajectories_async(self, days: int = 7) -> dict:
    """
    异步归档旧轨迹任务

    Args:
        days: 超过多少天的轨迹需要归档

    Returns:
        归档结果字典
    """
    task_start = time.time()

    logger.info(
        "异步归档任务开始",
        **{
            'task_id': self.request.id,
            'cutoff_days': days,
        }
    )

    try:
        # 执行归档
        archived_count = TrajectoryBuilder.archive_old_trajectories(days=days)

        task_duration = (time.time() - task_start) * 1000

        logger.info(
            "异步归档任务完成",
            **{
                'task_id': self.request.id,
                'archived_count': archived_count,
                'cutoff_days': days,
                'duration_ms': round(task_duration, 2),
            }
        )

        return {
            'success': True,
            'archived_count': archived_count,
            'cutoff_days': days,
            'duration_ms': round(task_duration, 2),
        }

    except Exception as e:
        task_duration = (time.time() - task_start) * 1000

        # 获取详细的堆栈追踪
        exc_type, exc_value, exc_traceback = sys.exc_info()
        traceback_str = ''.join(traceback.format_exception(exc_type, exc_value, exc_traceback))

        logger.error(
            "异步归档任务失败",
            **{
                'task_id': self.request.id,
                'error': str(e),
                'error_type': type(e).__name__,
                'cutoff_days': days,
                'duration_ms': round(task_duration, 2),
                'traceback': traceback_str,
            }
        )

        # 记录详细的错误堆栈（单独一行，方便查看）
        logger.error(
            f"详细堆栈追踪:\n{traceback_str}"
        )

        return {
            'success': False,
            'error': str(e),
            'error_type': type(e).__name__,
            'cutoff_days': days,
            'traceback': traceback_str,
        }


@shared_task
def cleanup_old_activities_task(days: int = 30, batch_size: int = 1000) -> dict:
    """
    异步清理旧活动日志任务

    Args:
        days: 保留多少天的数据
        batch_size: 批量删除大小

    Returns:
        清理结果字典
    """
    from .data_cleanup_service import DataCleanupService

    task_start = time.time()

    logger.info(
        "异步清理任务开始",
        **{
            'cutoff_days': days,
            'batch_size': batch_size,
        }
    )

    try:
        # 执行清理
        deleted_count = DataCleanupService.cleanup_old_activities(days=days, batch_size=batch_size)

        task_duration = (time.time() - task_start) * 1000

        logger.info(
            "异步清理任务完成",
            **{
                'deleted_count': deleted_count,
                'cutoff_days': days,
                'duration_ms': round(task_duration, 2),
            }
        )

        return {
            'success': True,
            'deleted_count': deleted_count,
            'cutoff_days': days,
        }

    except Exception as e:
        task_duration = (time.time() - task_start) * 1000

        # 获取详细的堆栈追踪
        exc_type, exc_value, exc_traceback = sys.exc_info()
        traceback_str = ''.join(traceback.format_exception(exc_type, exc_value, exc_traceback))

        logger.error(
            "异步清理任务失败",
            **{
                'error': str(e),
                'error_type': type(e).__name__,
                'cutoff_days': days,
                'duration_ms': round(task_duration, 2),
                'traceback': traceback_str,
            }
        )

        # 记录详细的错误堆栈（单独一行，方便查看）
        logger.error(
            f"详细堆栈追踪:\n{traceback_str}"
        )

        return {
            'success': False,
            'error': str(e),
            'error_type': type(e).__name__,
            'traceback': traceback_str,
        }


@shared_task
def check_disk_space_task() -> dict:
    """
    异步检查磁盘空间任务

    Returns:
        磁盘空间信息
    """
    from .data_cleanup_service import DataCleanupService

    task_start = time.time()

    logger.info("异步磁盘检查任务开始")

    try:
        db_path = '/data'  # Django数据库路径
        disk_info = DataCleanupService.check_disk_space(db_path)

        task_duration = (time.time() - task_start) * 1000

        logger.info(
            "异步磁盘检查任务完成",
            **{
                'free_gb': disk_info.get('free_gb'),
                'used_percent': disk_info.get('used_percent'),
                'duration_ms': round(task_duration, 2),
            }
        )

        return {
            'success': True,
            **disk_info,
        }

    except Exception as e:
        task_duration = (time.time() - task_start) * 1000

        # 获取详细的堆栈追踪
        exc_type, exc_value, exc_traceback = sys.exc_info()
        traceback_str = ''.join(traceback.format_exception(exc_type, exc_value, exc_traceback))

        logger.error(
            "异步磁盘检查任务失败",
            **{
                'error': str(e),
                'error_type': type(e).__name__,
                'duration_ms': round(task_duration, 2),
                'traceback': traceback_str,
            }
        )

        # 记录详细的错误堆栈（单独一行，方便查看）
        logger.error(f"详细堆栈追踪:\n{traceback_str}")

        return {
            'success': False,
            'error': str(e),
            'error_type': type(e).__name__,
            'traceback': traceback_str,
        }


@shared_task
def get_table_sizes_task() -> dict:
    """
    异步获取表数据量任务

    Returns:
        表数据量统计
    """
    from .data_cleanup_service import DataCleanupService

    task_start = time.time()

    logger.info("异步表大小统计任务开始")

    try:
        table_sizes = DataCleanupService.get_table_sizes()

        task_duration = (time.time() - task_start) * 1000

        logger.info(
            "异步表大小统计任务完成",
            **{
                'total_tables': len(table_sizes) if table_sizes else 0,
                'duration_ms': round(task_duration, 2),
            }
        )

        return {
            'success': True,
            'table_sizes': table_sizes,
        }

    except Exception as e:
        task_duration = (time.time() - task_start) * 1000

        # 获取详细的堆栈追踪
        exc_type, exc_value, exc_traceback = sys.exc_info()
        traceback_str = ''.join(traceback.format_exception(exc_type, exc_value, exc_traceback))

        logger.error(
            "异步表大小统计任务失败",
            **{
                'error': str(e),
                'error_type': type(e).__name__,
                'duration_ms': round(task_duration, 2),
                'traceback': traceback_str,
            }
        )

        # 记录详细的错误堆栈（单独一行，方便查看）
        logger.error(f"详细堆栈追踪:\n{traceback_str}")

        return {
            'success': False,
            'error': str(e),
            'error_type': type(e).__name__,
            'traceback': traceback_str,
        }


@shared_task
def cleanup_expired_tokens() -> dict:
    """清理已过期的 JWT 黑名单记录（OutstandingToken），防止 token 表无限增长。"""
    from rest_framework_simplejwt.token_blacklist.models import OutstandingToken

    cutoff = timezone.now()
    deleted_count = 0
    try:
        # 分批删除过期 token，避免一次性加载全部 id 占满内存
        batch_size = 5000
        while True:
            ids = list(
                OutstandingToken.objects.filter(expires_at__lt=cutoff)
                .values_list('pk', flat=True)[:batch_size]
            )
            if not ids:
                break
            deleted_count += OutstandingToken.objects.filter(pk__in=ids).delete()[0]

        logger.info("清理过期Token完成", **{'deleted_count': deleted_count})
        return {'success': True, 'deleted_count': deleted_count}
    except Exception as e:
        logger.error(
            "清理过期Token失败",
            **{'error': str(e), 'error_type': type(e).__name__},
        )
        return {'success': False, 'error': str(e), 'deleted_count': deleted_count}


@shared_task
def cleanup_expired_sessions() -> dict:
    """清理已过期的 Django Session，防止 session 表无限增长。"""
    from django.contrib.sessions.models import Session

    cutoff = timezone.now()
    deleted_count = 0
    try:
        batch_size = 5000
        while True:
            ids = list(
                Session.objects.filter(expire_date__lt=cutoff)
                .values_list('pk', flat=True)[:batch_size]
            )
            if not ids:
                break
            deleted_count += Session.objects.filter(pk__in=ids).delete()[0]

        logger.info("清理过期会话完成", **{'deleted_count': deleted_count})
        return {'success': True, 'deleted_count': deleted_count}
    except Exception as e:
        logger.error(
            "清理过期会话失败",
            **{'error': str(e), 'error_type': type(e).__name__},
        )
        return {'success': False, 'error': str(e), 'deleted_count': deleted_count}


@shared_task
def cleanup_old_logs() -> dict:
    """统一数据保留清理（每天凌晨 2 点）。

    按《数据安全法》《网络安全法》合规保留期分批删除过期日志与统计快照，
    保留期见 settings.DATA_RETENTION_DAYS。
    """
    from .data_cleanup_service import DataCleanupService

    try:
        deleted_by_table = DataCleanupService.run_all_cleanup()
        logger.info("统一数据保留清理完成", **{'deleted_by_table': deleted_by_table})
        return {'success': True, 'deleted_by_table': deleted_by_table}
    except Exception as e:
        logger.error(
            "统一数据保留清理失败",
            **{'error': str(e), 'error_type': type(e).__name__},
        )
        return {'success': False, 'error': str(e)}