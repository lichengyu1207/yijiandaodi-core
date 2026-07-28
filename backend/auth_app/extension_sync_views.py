"""
浏览器插件数据同步 API 视图

接口：
- POST /api/extension/sync/start/ - 开始录制同步
- POST /api/extension/sync/operation/ - 操作同步
- POST /api/extension/sync/end/ - 停止录制同步
- POST /api/extension/sync/full/ - 完整同步
- GET /api/extension/sessions/ - 获取会话列表
- GET /api/extension/sessions/<id>/ - 获取会话详情
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db import transaction
from datetime import datetime
from collections import Counter
import json

from .extension_sync_models import (
    ExtensionSession,
    ExtensionOperation,
    ExtensionFingerprint,
    ExtensionSyncLog
)
from .extension_sync_serializers import (
    ExtensionSessionSerializer,
    ExtensionSessionListSerializer,
    ExtensionOperationSerializer,
    ExtensionFingerprintSerializer,
    SyncStartSerializer,
    SyncOperationSerializer,
    SyncEndSerializer,
    SyncFullSerializer,
    ExtensionSyncLogSerializer
)


class ExtensionSyncViewSet(viewsets.ViewSet):
    """浏览器插件数据同步视图集"""

    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['post'])
    def start(self, request):
        """开始录制同步"""

        serializer = SyncStartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        session_id = serializer.validated_data['session_id']
        title = serializer.validated_data.get('title', '')
        start_time = serializer.validated_data['start_time']
        device_id = serializer.validated_data.get('device_id', '')
        extension_version = serializer.validated_data.get('extension_version', '')

        # 检查会话是否已存在
        if ExtensionSession.objects.filter(session_id=session_id).exists():
            return Response({
                'error': '会话已存在',
                'session_id': session_id
            }, status=status.HTTP_400_BAD_REQUEST)

        # 创建会话
        session = ExtensionSession.objects.create(
            user=request.user,
            session_id=session_id,
            title=title or f'录制会话 - {start_time.strftime("%Y-%m-%d %H:%M")}',
            start_time=start_time,
            status='active',
            device_id=device_id,
            extension_version=extension_version
        )

        # 记录同步日志
        ExtensionSyncLog.objects.create(
            user=request.user,
            session_id=session_id,
            sync_type='start',
            device_id=device_id,
            ip_address=request.META.get('REMOTE_ADDR'),
            status='success'
        )

        return Response({
            'success': True,
            'session': ExtensionSessionSerializer(session).data
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def operation(self, request):
        """操作同步（批量）"""

        serializer = SyncOperationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        session_id = serializer.validated_data['session_id']
        operations_data = serializer.validated_data['operations']

        try:
            session = ExtensionSession.objects.get(
                session_id=session_id,
                user=request.user
            )
        except ExtensionSession.DoesNotExist:
            return Response({
                'error': '会话不存在'
            }, status=status.HTTP_404_NOT_FOUND)

        # 批量创建操作记录
        operations_created = 0
        platforms_set = set(session.platforms)

        for op_data in operations_data:
            try:
                # 解析时间
                timestamp = op_data.get('timestamp')
                if isinstance(timestamp, str):
                    timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))

                # 创建操作记录
                ExtensionOperation.objects.create(
                    session=session,
                    operation_id=op_data.get('id', ''),
                    operation_type=op_data.get('type', 'unknown'),
                    timestamp=timestamp or timezone.now(),
                    timestamp_display=op_data.get('timestampDisplay', ''),
                    timestamp_source=op_data.get('timestampSource', 'ntp.ntsc.ac.cn'),
                    platform_name=op_data.get('platform', {}).get('name', '未知平台'),
                    platform_type=op_data.get('platform', {}).get('type', 'unknown'),
                    content_preview=op_data.get('data', {}).get('textPreview', '')[:500],
                    content_hash=op_data.get('data', {}).get('hash', ''),
                    page_url=op_data.get('pageInfo', {}).get('url', ''),
                    page_title=op_data.get('pageInfo', {}).get('title', ''),
                    metadata=op_data
                )
                operations_created += 1

                # 收集平台
                platform_name = op_data.get('platform', {}).get('name', '')
                if platform_name:
                    platforms_set.add(platform_name)

            except Exception as e:
                continue

        # 更新会话统计
        session.operations_count = ExtensionOperation.objects.filter(session=session).count()
        session.platforms = list(platforms_set)
        session.platforms_count = len(platforms_set)
        session.save(update_fields=['operations_count', 'platforms', 'platforms_count', 'updated_at'])

        # 记录同步日志
        ExtensionSyncLog.objects.create(
            user=request.user,
            session_id=session_id,
            sync_type='operation',
            operations_synced=operations_created,
            device_id=session.device_id,
            ip_address=request.META.get('REMOTE_ADDR'),
            status='success'
        )

        return Response({
            'success': True,
            'operations_created': operations_created,
            'total_operations': session.operations_count
        })

    @action(detail=False, methods=['post'])
    def end(self, request):
        """停止录制同步"""

        serializer = SyncEndSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        session_id = serializer.validated_data['session_id']
        end_time = serializer.validated_data['end_time']
        operations_data = serializer.validated_data.get('operations', [])
        fingerprints_data = serializer.validated_data.get('fingerprints', [])

        try:
            session = ExtensionSession.objects.get(
                session_id=session_id,
                user=request.user
            )
        except ExtensionSession.DoesNotExist:
            return Response({
                'error': '会话不存在'
            }, status=status.HTTP_404_NOT_FOUND)

        # 同步剩余操作
        if operations_data:
            for op_data in operations_data:
                try:
                    timestamp = op_data.get('timestamp')
                    if isinstance(timestamp, str):
                        timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))

                    ExtensionOperation.objects.create(
                        session=session,
                        operation_id=op_data.get('id', ''),
                        operation_type=op_data.get('type', 'unknown'),
                        timestamp=timestamp or timezone.now(),
                        platform_name=op_data.get('platform', {}).get('name', '未知平台'),
                        platform_type=op_data.get('platform', {}).get('type', 'unknown'),
                        metadata=op_data
                    )
                except:
                    pass

        # 同步指纹
        fingerprints_created = 0
        for fp_data in fingerprints_data:
            try:
                ExtensionFingerprint.objects.create(
                    session=session,
                    hash=fp_data.get('hash', ''),
                    prev_hash=fp_data.get('prevHash', '0'),
                    operation_id=fp_data.get('operationId', ''),
                    timestamp=datetime.fromisoformat(fp_data.get('timestamp', '').replace('Z', '+00:00')) if isinstance(fp_data.get('timestamp'), str) else timezone.now(),
                    timestamp_display=fp_data.get('timestampDisplay', '')
                )
                fingerprints_created += 1
            except:
                pass

        # 更新会话状态
        session.end_time = end_time
        session.status = 'completed'
        session.operations_count = ExtensionOperation.objects.filter(session=session).count()
        session.fingerprints_count = ExtensionFingerprint.objects.filter(session=session).count()
        session.save()

        # 记录同步日志
        ExtensionSyncLog.objects.create(
            user=request.user,
            session_id=session_id,
            sync_type='end',
            operations_synced=len(operations_data),
            fingerprints_synced=fingerprints_created,
            device_id=session.device_id,
            ip_address=request.META.get('REMOTE_ADDR'),
            status='success'
        )

        return Response({
            'success': True,
            'session': ExtensionSessionSerializer(session).data
        })

    @action(detail=False, methods=['post'])
    def full(self, request):
        """完整同步（一次性上传所有数据）"""

        serializer = SyncFullSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        session_id = data['session_id']

        # 创建或更新会话
        session, created = ExtensionSession.objects.update_or_create(
            session_id=session_id,
            defaults={
                'user': request.user,
                'title': data.get('title', ''),
                'start_time': data['start_time'],
                'end_time': data.get('end_time'),
                'status': data.get('status', 'active'),
                'device_id': data.get('device_id', ''),
                'extension_version': data.get('extension_version', ''),
            }
        )

        # 批量创建操作和指纹
        operations_created = 0
        fingerprints_created = 0
        platforms_set = set()

        with transaction.atomic():
            # 清除旧数据
            ExtensionOperation.objects.filter(session=session).delete()
            ExtensionFingerprint.objects.filter(session=session).delete()

            # 创建操作
            for op_data in data.get('operations', []):
                try:
                    timestamp = op_data.get('timestamp')
                    if isinstance(timestamp, str):
                        timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))

                    ExtensionOperation.objects.create(
                        session=session,
                        operation_id=op_data.get('id', ''),
                        operation_type=op_data.get('type', 'unknown'),
                        timestamp=timestamp or timezone.now(),
                        timestamp_display=op_data.get('timestampDisplay', ''),
                        timestamp_source=op_data.get('timestampSource', 'ntp.ntsc.ac.cn'),
                        platform_name=op_data.get('platform', {}).get('name', '未知平台'),
                        platform_type=op_data.get('platform', {}).get('type', 'unknown'),
                        content_preview=op_data.get('data', {}).get('textPreview', '')[:500],
                        content_hash=op_data.get('data', {}).get('hash', ''),
                        page_url=op_data.get('pageInfo', {}).get('url', ''),
                        page_title=op_data.get('pageInfo', {}).get('title', ''),
                        metadata=op_data
                    )
                    operations_created += 1

                    platform_name = op_data.get('platform', {}).get('name', '')
                    if platform_name:
                        platforms_set.add(platform_name)

                except:
                    pass

            # 创建指纹
            for fp_data in data.get('fingerprints', []):
                try:
                    ExtensionFingerprint.objects.create(
                        session=session,
                        hash=fp_data.get('hash', ''),
                        prev_hash=fp_data.get('prevHash', '0'),
                        operation_id=fp_data.get('operationId', ''),
                        timestamp=datetime.fromisoformat(fp_data.get('timestamp', '').replace('Z', '+00:00')) if isinstance(fp_data.get('timestamp'), str) else timezone.now(),
                        timestamp_display=fp_data.get('timestampDisplay', '')
                    )
                    fingerprints_created += 1
                except:
                    pass

        # 更新统计
        session.operations_count = operations_created
        session.fingerprints_count = fingerprints_created
        session.platforms = list(platforms_set)
        session.platforms_count = len(platforms_set)
        session.save()

        # 记录日志
        ExtensionSyncLog.objects.create(
            user=request.user,
            session_id=session_id,
            sync_type='full',
            operations_synced=operations_created,
            fingerprints_synced=fingerprints_created,
            device_id=session.device_id,
            ip_address=request.META.get('REMOTE_ADDR'),
            status='success'
        )

        return Response({
            'success': True,
            'created': created,
            'session': ExtensionSessionSerializer(session).data,
            'stats': {
                'operations_created': operations_created,
                'fingerprints_created': fingerprints_created,
                'platforms_count': session.platforms_count
            }
        })


class ExtensionSessionViewSet(viewsets.ReadOnlyModelViewSet):
    """录制会话视图集（只读）"""

    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ExtensionSession.objects.filter(user=self.request.user)

    def get_serializer_class(self):
        if self.action == 'list':
            return ExtensionSessionListSerializer
        return ExtensionSessionSerializer

    @action(detail=True, methods=['get'])
    def operations(self, request, pk=None):
        """获取会话的所有操作"""

        session = self.get_object()
        operations = ExtensionOperation.objects.filter(session=session)
        serializer = ExtensionOperationSerializer(operations, many=True)

        return Response({
            'total': operations.count(),
            'operations': serializer.data
        })

    @action(detail=True, methods=['get'])
    def fingerprints(self, request, pk=None):
        """获取会话的所有指纹"""

        session = self.get_object()
        fingerprints = ExtensionFingerprint.objects.filter(session=session)
        serializer = ExtensionFingerprintSerializer(fingerprints, many=True)

        return Response({
            'total': fingerprints.count(),
            'fingerprints': serializer.data
        })

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """获取用户录制统计"""

        user_sessions = ExtensionSession.objects.filter(user=request.user)

        total_sessions = user_sessions.count()
        total_operations = sum(s.operations_count for s in user_sessions)
        total_fingerprints = sum(s.fingerprints_count for s in user_sessions)

        # 平台分布
        all_platforms = []
        for s in user_sessions:
            all_platforms.extend(s.platforms)

        platform_distribution = dict(Counter(all_platforms))

        # 最近7天统计
        from datetime import timedelta
        week_ago = timezone.now() - timedelta(days=7)
        recent_sessions = user_sessions.filter(start_time__gte=week_ago).count()

        return Response({
            'total_sessions': total_sessions,
            'total_operations': total_operations,
            'total_fingerprints': total_fingerprints,
            'platform_distribution': platform_distribution,
            'recent_sessions_7d': recent_sessions
        })