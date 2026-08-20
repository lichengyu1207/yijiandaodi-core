"""
Celery任务监控API接口

提供任务状态查询、错误日志查看、重试记录追踪等HTTP接口
"""

import logging
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.views.decorators.http import require_http_methods

from .task_monitor import TaskMonitor
from .tasks import build_trajectory_async, archive_old_trajectories_async
from .trajectory_logger import get_trajectory_logger

logger = get_trajectory_logger()


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_task_status_api(request, task_id: str):
    """
    查询任务状态API

    GET /api/tasks/{task_id}/status/

    返回示例：
    {
        "task_id": "xxx-xxx-xxx",
        "status": "SUCCESS",
        "ready": true,
        "successful": true,
        "result": {
            "trajectory_id": "traj_xxx",
            "chain_risk_score": 75.0
        }
    }
    """
    try:
        task_info = TaskMonitor.get_task_status(task_id)

        logger.info(
            "API: 查询任务状态",
            **{
                'user_id': request.user.id,
                'task_id': task_id,
                'status': task_info.get('status'),
            }
        )

        return Response(task_info, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(
            "API: 查询任务状态失败",
            **{
                'user_id': request.user.id,
                'task_id': task_id,
                'error': str(e),
            }
        )
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_task_error_api(request, task_id: str):
    """
    获取任务错误详情API

    GET /api/tasks/{task_id}/error/

    返回示例：
    {
        "task_id": "xxx-xxx-xxx",
        "status": "FAILURE",
        "error_type": "ValueError",
        "error_message": "Invalid activity_id",
        "traceback": "Traceback (most recent call last):\n  ...",
        "date_done": "2026-08-08T14:30:00.123Z"
    }
    """
    try:
        error_info = TaskMonitor.get_task_error(task_id)

        logger.info(
            "API: 获取任务错误",
            **{
                'user_id': request.user.id,
                'task_id': task_id,
                'error_type': error_info.get('error_type'),
            }
        )

        return Response(error_info, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(
            "API: 获取任务错误失败",
            **{
                'user_id': request.user.id,
                'task_id': task_id,
                'error': str(e),
            }
        )
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_retry_history_api(request, task_id: str):
    """
    获取任务重试历史API

    GET /api/tasks/{task_id}/retry-history/

    返回示例：
    {
        "task_id": "xxx-xxx-xxx",
        "current_retry_count": 2,
        "max_retries": 3,
        "retry_history": [
            {
                "timestamp": "2026-08-08T14:30:00Z",
                "status": "FAILURE",
                "result": "Error: ..."
            },
            {
                "timestamp": "2026-08-08T14:25:00Z",
                "status": "FAILURE",
                "result": "Error: ..."
            }
        ]
    }
    """
    try:
        retry_info = TaskMonitor.get_retry_history(task_id)

        logger.info(
            "API: 获取重试历史",
            **{
                'user_id': request.user.id,
                'task_id': task_id,
                'retry_count': retry_info.get('current_retry_count'),
            }
        )

        return Response(retry_info, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(
            "API: 获取重试历史失败",
            **{
                'user_id': request.user.id,
                'task_id': task_id,
                'error': str(e),
            }
        )
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_recent_failed_tasks_api(request):
    """
    获取最近失败的任务列表API

    GET /api/tasks/failed/?queue=trajectory&hours=24

    参数：
    - queue: 队列名称（可选）
    - hours: 最近多少小时（默认24）

    返回示例：
    {
        "failed_tasks": [
            {
                "task_id": "xxx-xxx-xxx",
                "status": "FAILURE",
                "error": "ValueError: Invalid activity_id",
                "date_done": "2026-08-08T14:30:00Z"
            }
        ],
        "count": 1
    }
    """
    try:
        queue_name = request.query_params.get('queue')
        hours = int(request.query_params.get('hours', 24))

        failed_tasks = TaskMonitor.get_recent_failed_tasks(queue_name, hours)

        logger.info(
            "API: 获取失败任务列表",
            **{
                'user_id': request.user.id,
                'queue': queue_name,
                'hours': hours,
                'count': len(failed_tasks),
            }
        )

        return Response(
            {
                'failed_tasks': failed_tasks,
                'count': len(failed_tasks),
                'queue': queue_name,
                'hours': hours,
            },
            status=status.HTTP_200_OK
        )

    except Exception as e:
        logger.error(
            "API: 获取失败任务列表失败",
            **{
                'user_id': request.user.id,
                'error': str(e),
            }
        )
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_task_performance_api(request):
    """
    获取任务性能统计API

    GET /api/tasks/performance/?hours=24

    参数：
    - hours: 统计最近多少小时（默认24）

    返回示例：
    {
        "total_tasks": 1000,
        "successful_tasks": 950,
        "failed_tasks": 50,
        "success_rate": 95.0,
        "avg_duration_ms": 45.2,
        "max_duration_ms": 125.3,
        "min_duration_ms": 12.5
    }
    """
    try:
        hours = int(request.query_params.get('hours', 24))

        stats = TaskMonitor.get_task_performance_stats(hours=hours)

        # 计算成功率
        if stats.get('total_tasks', 0) > 0:
            stats['success_rate'] = stats['successful_tasks'] / stats['total_tasks'] * 100
        else:
            stats['success_rate'] = 0

        logger.info(
            "API: 获取性能统计",
            **{
                'user_id': request.user.id,
                'hours': hours,
                'total_tasks': stats.get('total_tasks'),
            }
        )

        return Response(stats, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(
            "API: 获取性能统计失败",
            **{
                'user_id': request.user.id,
                'error': str(e),
            }
        )
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def retry_task_api(request, task_id: str):
    """
    手动重试任务API

    POST /api/tasks/{task_id}/retry/

    请求体：
    {
        "activity_id": "act_xxx"  # 可选，仅轨迹构建任务需要
    }

    返回示例：
    {
        "message": "Task retry submitted",
        "new_task_id": "yyy-yyy-yyy"
    }
    """
    try:
        # 获取原任务信息
        task_info = TaskMonitor.get_task_status(task_id)

        if not task_info.get('failed'):
            return Response(
                {'error': 'Only failed tasks can be retried'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 根据任务类型重新提交
        if 'build_trajectory' in task_id or 'trajectory' in str(task_info.get('args', [])):
            # 重新提交轨迹构建任务
            activity_id = request.data.get('activity_id') or task_info.get('args', [None])[0]

            if not activity_id:
                return Response(
                    {'error': 'activity_id is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            new_result = build_trajectory_async.delay(activity_id)

            logger.info(
                "API: 手动重试轨迹构建任务",
                **{
                    'user_id': request.user.id,
                    'old_task_id': task_id,
                    'new_task_id': new_result.id,
                    'activity_id': activity_id,
                }
            )

            return Response(
                {
                    'message': 'Task retry submitted',
                    'new_task_id': new_result.id,
                    'activity_id': activity_id,
                },
                status=status.HTTP_200_OK
            )

        else:
            return Response(
                {'error': 'Unknown task type'},
                status=status.HTTP_400_BAD_REQUEST
            )

    except Exception as e:
        logger.error(
            "API: 手动重试任务失败",
            **{
                'user_id': request.user.id,
                'task_id': task_id,
                'error': str(e),
            }
        )
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )