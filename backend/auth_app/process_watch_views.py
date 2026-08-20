"""
进程行为监控视图

提供：
- 上报工具进程会话（启动/退出/时长）
- 工具使用统计（本周/本月时长、使用频率）
- 行为存证时间线（进程会话 + 文件操作合并）
"""

import logging
from datetime import timedelta

from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from .process_watch_models import ProcessUsageRecord
from .process_watch_serializers import (
    ProcessUsageRecordSerializer,
    ProcessReportSerializer,
)
from .file_watch_models import FileOperationLog

logger = logging.getLogger('auth_app.process_watch_views')


class ProcessReportView(APIView):
    """
    上报工具进程会话

    POST /api/v1/process/report/
    请求体可为单个会话对象，或 {"sessions": [...]} 批量。
    通过 (user, pid, session_start) 唯一键幂等去重。
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        data = request.data
        sessions = data.get('sessions') if isinstance(data, dict) and 'sessions' in data else [data]

        if not isinstance(sessions, list):
            sessions = [sessions]

        saved = 0
        updated = 0
        errors = []

        for item in sessions:
            serializer = ProcessReportSerializer(data=item)
            if not serializer.is_valid():
                errors.append({'input': item, 'errors': serializer.errors})
                continue

            vd = serializer.validated_data
            defaults = {
                'session_end': vd.get('session_end'),
                'duration_seconds': vd.get('duration_seconds', 0),
                'has_related_files': vd.get('has_related_files'),
            }

            # 幂等 upsert
            record, created = ProcessUsageRecord.objects.update_or_create(
                user=request.user,
                pid=vd['pid'],
                session_start=vd['session_start'],
                defaults={
                    **defaults,
                    'tool_name': vd['tool_name'],
                    'process_name': vd['process_name'],
                }
            )

            # 关联文件三态处理（仅当明确声明时才修改，避免覆盖“未确定”）
            has = vd.get('has_related_files')
            if has is True:
                related = vd.get('related_files') or []
                merged = list(dict.fromkeys(list(record.related_files or []) + related))
                record.related_files = merged
                record.save(update_fields=['related_files'])
            elif has is False:
                record.related_files = []
                record.save(update_fields=['related_files'])
            # has is None -> 未确定，保持现状（不触碰 related_files）

            if created:
                saved += 1
            else:
                updated += 1

        return Response({
            'saved': saved,
            'updated': updated,
            'errors': errors,
        }, status=status.HTTP_200_OK)


class ProcessStatsView(APIView):
    """
    工具使用统计

    GET /api/v1/process/stats/?period=week|month
    返回各工具的总时长与使用次数（频率）。
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        period = request.query_params.get('period', 'week')
        now = timezone.now()

        if period == 'month':
            start = now - timedelta(days=30)
        else:  # week 默认
            start = now - timedelta(days=7)

        # 当前用户的会话，结束时间在周期内（或跨越周期边界，取其重叠时长近似）
        qs = ProcessUsageRecord.objects.filter(
            user=request.user,
            session_start__gte=start,
        )

        tools = []
        for tool_name in qs.values_list('tool_name', flat=True).distinct():
            tool_qs = qs.filter(tool_name=tool_name)
            total_duration = sum(r.duration_seconds for r in tool_qs)
            usage_count = tool_qs.count()
            tools.append({
                'tool_name': tool_name,
                'total_duration_seconds': total_duration,
                'usage_count': usage_count,
            })

        tools.sort(key=lambda t: t['total_duration_seconds'], reverse=True)

        return Response({
            'period': period,
            'total_duration_seconds': sum(t['total_duration_seconds'] for t in tools),
            'tools': tools,
        })


class ProcessTimelineView(APIView):
    """
    行为存证时间线

    GET /api/v1/process/timeline/?days=7
    将进程会话与文件操作按时间合并，还原完整操作链路。
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        days = int(request.query_params.get('days', 7))
        start = timezone.now() - timedelta(days=days)

        events = []

        # 进程会话
        for record in ProcessUsageRecord.objects.filter(
            user=request.user,
            session_start__gte=start,
        ):
            events.append({
                'type': 'process',
                'time': record.session_start,
                'tool_name': record.tool_name,
                'process_name': record.process_name,
                'duration_seconds': record.duration_seconds,
                'related_files': record.related_files or [],
                'has_related_files': record.has_related_files,
            })

        # 文件操作
        for log in FileOperationLog.objects.filter(
            config__user=request.user,
            operation_time__gte=start,
        ):
            events.append({
                'type': 'file',
                'time': log.operation_time,
                'file_path': log.file_path,
                'file_name': log.file_name,
                'operation_type': log.operation_type,
                'risk_level': log.risk_level,
            })

        events.sort(key=lambda e: e['time'], reverse=True)

        return Response({
            'days': days,
            'total_events': len(events),
            'events': events,
        })
