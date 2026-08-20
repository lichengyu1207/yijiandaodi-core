"""
Celery任务监控和错误排查工具

提供任务状态查询、错误日志查看、重试记录追踪等功能
"""

import logging
import json
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
from celery.result import AsyncResult
from django.utils import timezone

from .trajectory_logger import get_trajectory_logger

logger = get_trajectory_logger()


class TaskMonitor:
    """
    任务监控工具类

    功能：
    1. 查询任务状态
    2. 获取错误详情
    3. 追踪重试记录
    4. 统计任务性能
    """

    @staticmethod
    def get_task_status(task_id: str) -> Dict[str, Any]:
        """
        查询任务状态

        Args:
            task_id: Celery任务ID

        Returns:
            任务状态详情
        """
        try:
            result = AsyncResult(task_id)

            status_info = {
                'task_id': task_id,
                'status': result.status,
                'ready': result.ready(),
                'successful': result.successful() if result.ready() else None,
                'failed': result.failed() if result.ready() else None,
                'result': None,
                'traceback': None,
                'date_done': None,
            }

            # 任务完成
            if result.ready():
                status_info['date_done'] = result.date_done.isoformat() if result.date_done else None

                if result.successful():
                    status_info['result'] = result.result

                elif result.failed():
                    status_info['result'] = str(result.result)
                    status_info['traceback'] = result.traceback

            # 任务信息
            if hasattr(result, 'args'):
                status_info['args'] = result.args
            if hasattr(result, 'kwargs'):
                status_info['kwargs'] = result.kwargs
            if hasattr(result, 'worker'):
                status_info['worker'] = result.worker

            logger.info(
                "查询任务状态",
                **{
                    'task_id': task_id,
                    'status': status_info['status'],
                    'ready': status_info['ready'],
                }
            )

            return status_info

        except Exception as e:
            logger.error(
                "查询任务状态失败",
                **{
                    'task_id': task_id,
                    'error': str(e),
                    'error_type': type(e).__name__,
                }
            )
            return {
                'task_id': task_id,
                'error': str(e),
            }

    @staticmethod
    def get_task_error(task_id: str) -> Dict[str, Any]:
        """
        获取任务错误详情

        Args:
            task_id: Celery任务ID

        Returns:
            错误详情字典
        """
        try:
            result = AsyncResult(task_id)

            if not result.ready():
                return {
                    'task_id': task_id,
                    'error': 'Task is not ready',
                    'status': result.status,
                }

            if not result.failed():
                return {
                    'task_id': task_id,
                    'error': 'Task did not fail',
                    'status': 'SUCCESS',
                }

            # 提取错误信息
            error_info = {
                'task_id': task_id,
                'status': 'FAILURE',
                'error_type': type(result.result).__name__,
                'error_message': str(result.result),
                'traceback': result.traceback,
                'date_done': result.date_done.isoformat() if result.date_done else None,
            }

            # 解析traceback获取更多上下文
            if result.traceback:
                error_info['traceback_lines'] = result.traceback.split('\n')

            logger.error(
                "任务执行失败",
                **{
                    'task_id': task_id,
                    'error_type': error_info['error_type'],
                    'error_message': error_info['error_message'],
                }
            )

            return error_info

        except Exception as e:
            logger.error(
                "获取任务错误失败",
                **{
                    'task_id': task_id,
                    'error': str(e),
                    'error_type': type(e).__name__,
                }
            )
            return {
                'task_id': task_id,
                'error': str(e),
            }

    @staticmethod
    def get_retry_history(task_id: str) -> Dict[str, Any]:
        """
        获取任务重试历史

        Args:
            task_id: Celery任务ID

        Returns:
            重试历史详情
        """
        try:
            result = AsyncResult(task_id)

            retry_info = {
                'task_id': task_id,
                'current_retry_count': 0,
                'max_retries': None,
                'retry_history': [],
            }

            # 从任务上下文获取重试信息
            if hasattr(result, 'args') and result.args:
                # 假设使用了bind=True，可以从参数中获取重试次数
                retry_info['current_retry_count'] = getattr(result, 'request', {}).get('retries', 0)

            # 从Redis获取重试历史（需要配置CELERY_TASK_TRACK_STARTED=True）
            import redis
            from django.conf import settings

            redis_client = redis.Redis(
                host=settings.CELERY_BROKER_URL.split('@')[-1].split(':')[0],
                port=int(settings.CELERY_BROKER_URL.split('@')[-1].split(':')[1].split('/')[0]),
                db=1
            )

            # 查询任务相关的所有key
            pattern = f'celery-task-meta-{task_id}*'
            keys = redis_client.keys(pattern)

            if keys:
                retry_info['retry_history'] = []
                for key in keys:
                    task_data = redis_client.get(key)
                    if task_data:
                        try:
                            data = json.loads(task_data)
                            retry_info['retry_history'].append({
                                'timestamp': data.get('date_done'),
                                'status': data.get('status'),
                                'result': data.get('result'),
                            })
                        except:
                            pass

                # 按时间排序
                retry_info['retry_history'].sort(key=lambda x: x.get('timestamp', ''), reverse=True)

            logger.info(
                "查询重试历史",
                **{
                    'task_id': task_id,
                    'retry_count': retry_info['current_retry_count'],
                    'history_length': len(retry_info['retry_history']),
                }
            )

            return retry_info

        except Exception as e:
            logger.error(
                "获取重试历史失败",
                **{
                    'task_id': task_id,
                    'error': str(e),
                    'error_type': type(e).__name__,
                }
            )
            return {
                'task_id': task_id,
                'error': str(e),
            }

    @staticmethod
    def get_recent_failed_tasks(queue_name: str = None, hours: int = 24) -> List[Dict[str, Any]]:
        """
        获取最近失败的任务列表

        Args:
            queue_name: 队列名称（可选）
            hours: 最近多少小时

        Returns:
            失败任务列表
        """
        try:
            import redis
            from django.conf import settings

            redis_client = redis.Redis(
                host=settings.CELERY_BROKER_URL.split('@')[-1].split(':')[0],
                port=int(settings.CELERY_BROKER_URL.split('@')[-1].split(':')[1].split('/')[0]),
                db=1
            )

            cutoff_time = timezone.now() - timedelta(hours=hours)

            # 扫描所有任务元数据
            pattern = 'celery-task-meta-*'
            keys = redis_client.keys(pattern)

            failed_tasks = []

            for key in keys:
                task_data = redis_client.get(key)
                if task_data:
                    try:
                        data = json.loads(task_data)

                        # 只提取失败的任务
                        if data.get('status') == 'FAILURE':
                            task_id = key.decode('utf-8').replace('celery-task-meta-', '')

                            # 检查时间范围
                            date_done = data.get('date_done')
                            if date_done:
                                task_time = datetime.fromisoformat(date_done.replace('Z', '+00:00'))
                                if task_time < cutoff_time:
                                    continue

                            failed_tasks.append({
                                'task_id': task_id,
                                'status': 'FAILURE',
                                'error': str(data.get('result')),
                                'date_done': date_done,
                                'traceback': data.get('traceback'),
                            })

                    except Exception as e:
                        logger.debug(f"解析任务数据失败: {e}")

            logger.info(
                "查询失败任务列表",
                **{
                    'queue': queue_name,
                    'hours': hours,
                    'failed_count': len(failed_tasks),
                }
            )

            return failed_tasks

        except Exception as e:
            logger.error(
                "获取失败任务列表失败",
                **{
                    'error': str(e),
                    'error_type': type(e).__name__,
                }
            )
            return []

    @staticmethod
    def get_task_performance_stats(task_name: str = None, hours: int = 24) -> Dict[str, Any]:
        """
        获取任务性能统计

        Args:
            task_name: 任务名称（可选）
            hours: 统计最近多少小时

        Returns:
            性能统计数据
        """
        try:
            import redis
            from django.conf import settings

            redis_client = redis.Redis(
                host=settings.CELERY_BROKER_URL.split('@')[-1].split(':')[0],
                port=int(settings.CELERY_BROKER_URL.split('@')[-1].split(':')[1].split('/')[0]),
                db=1
            )

            cutoff_time = timezone.now() - timedelta(hours=hours)

            pattern = 'celery-task-meta-*'
            keys = redis_client.keys(pattern)

            stats = {
                'total_tasks': 0,
                'successful_tasks': 0,
                'failed_tasks': 0,
                'pending_tasks': 0,
                'avg_duration_ms': 0,
                'max_duration_ms': 0,
                'min_duration_ms': 0,
            }

            durations = []

            for key in keys:
                task_data = redis_client.get(key)
                if task_data:
                    try:
                        data = json.loads(task_data)

                        stats['total_tasks'] += 1

                        if data.get('status') == 'SUCCESS':
                            stats['successful_tasks'] += 1

                            # 计算耗时
                            if 'date_done' in data and 'date_started' in data:
                                try:
                                    done_time = datetime.fromisoformat(data['date_done'].replace('Z', '+00:00'))
                                    started_time = datetime.fromisoformat(data['date_started'].replace('Z', '+00:00'))
                                    duration = (done_time - started_time).total_seconds() * 1000
                                    durations.append(duration)
                                except:
                                    pass

                        elif data.get('status') == 'FAILURE':
                            stats['failed_tasks'] += 1

                    except Exception as e:
                        logger.debug(f"解析任务数据失败: {e}")

            # 计算统计数据
            if durations:
                stats['avg_duration_ms'] = sum(durations) / len(durations)
                stats['max_duration_ms'] = max(durations)
                stats['min_duration_ms'] = min(durations)

            logger.info(
                "获取任务性能统计",
                **{
                    'task_name': task_name,
                    'hours': hours,
                    'total_tasks': stats['total_tasks'],
                    'success_rate': stats['successful_tasks'] / max(stats['total_tasks'], 1) * 100,
                }
            )

            return stats

        except Exception as e:
            logger.error(
                "获取性能统计失败",
                **{
                    'error': str(e),
                    'error_type': type(e).__name__,
                }
            )
            return {}