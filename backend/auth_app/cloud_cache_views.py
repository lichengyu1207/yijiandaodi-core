# ============================================================
# 云端缓存API视图 - 一鉴到底
#
# 功能：
#   1. 消息云端同步（上传/下载）
#   2. 会话云端同步
#   3. 文件云端同步
#   4. 用户数据云端同步
#   5. 草稿箱云端同步
#   6. 批量同步接口
# ============================================================

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import Q
from django.core.cache import cache
import logging

logger = logging.getLogger(__name__)


class CloudCacheViewSet(viewsets.ViewSet):
    """
    云端缓存API
    """
    permission_classes = [IsAuthenticated]
    
    # ============================================================
    # 消息同步
    # ============================================================
    
    @action(detail=False, methods=['post'], url_path='messages/upload')
    def upload_messages(self, request):
        """
        上传消息到云端
        
        请求体：
        {
            "messages": [
                {
                    "session_id": "xxx",
                    "session_type": "im",
                    "message_type": "text",
                    "sender_type": "user",
                    "content": "消息内容",
                    "file_url": "",
                    "client_message_id": "client_xxx",
                    "is_offline": false
                }
            ]
        }
        """
        from .cloud_cache_models import CloudCachedMessage, UserCloudData
        
        messages_data = request.data.get('messages', [])
        if not messages_data:
            return Response({'error': '消息列表不能为空'}, status=status.HTTP_400_BAD_REQUEST)
        
        user = request.user
        created_count = 0
        updated_count = 0
        
        for msg_data in messages_data:
            client_msg_id = msg_data.get('client_message_id')
            session_id = msg_data.get('session_id')
            
            # 检查是否已存在
            existing = CloudCachedMessage.objects.filter(
                user=user,
                session_id=session_id,
                client_message_id=client_msg_id
            ).first() if client_msg_id else None
            
            if existing:
                # 更新
                existing.content = msg_data.get('content', existing.content)
                existing.file_url = msg_data.get('file_url', existing.file_url)
                existing.is_read = msg_data.get('is_read', existing.is_read)
                existing.synced_at = timezone.now()
                existing.save()
                updated_count += 1
            else:
                # 创建
                CloudCachedMessage.objects.create(
                    user=user,
                    session_id=session_id,
                    session_type=msg_data.get('session_type', 'im'),
                    message_type=msg_data.get('message_type', 'text'),
                    sender_type=msg_data.get('sender_type', 'user'),
                    content=msg_data.get('content', ''),
                    file_url=msg_data.get('file_url', ''),
                    client_message_id=client_msg_id or '',
                    is_offline=msg_data.get('is_offline', False),
                    synced_at=timezone.now()
                )
                created_count += 1
        
        # 更新用户云端数据统计
        self._update_user_cloud_stats(user)
        
        return Response({
            'success': True,
            'created': created_count,
            'updated': updated_count,
            'total': created_count + updated_count
        })
    
    @action(detail=False, methods=['get'], url_path='messages/download')
    def download_messages(self, request):
        """
        从云端下载消息
        
        查询参数：
        - session_id: 会话ID（可选）
        - session_type: 会话类型（可选）
        - since: 同步时间戳（可选，获取该时间之后的消息）
        - limit: 返回数量限制（默认100）
        """
        from .cloud_cache_models import CloudCachedMessage
        from .cloud_cache_serializers import CloudCachedMessageSerializer
        
        user = request.user
        session_id = request.query_params.get('session_id')
        session_type = request.query_params.get('session_type')
        since = request.query_params.get('since')
        limit = int(request.query_params.get('limit', 100))
        
        queryset = CloudCachedMessage.objects.filter(user=user)
        
        if session_id:
            queryset = queryset.filter(session_id=session_id)
        if session_type:
            queryset = queryset.filter(session_type=session_type)
        if since:
            try:
                since_time = timezone.datetime.fromtimestamp(float(since), tz=timezone.get_current_timezone())
                queryset = queryset.filter(created_at__gt=since_time)
            except (ValueError, TypeError):
                pass
        
        queryset = queryset.order_by('created_at')[:limit]
        
        serializer = CloudCachedMessageSerializer(queryset, many=True)
        
        return Response({
            'success': True,
            'messages': serializer.data,
            'count': queryset.count()
        })
    
    # ============================================================
    # 会话同步
    # ============================================================
    
    @action(detail=False, methods=['post'], url_path='sessions/upload')
    def upload_sessions(self, request):
        """
        上传会话到云端
        """
        from .cloud_cache_models import CloudCachedSession
        
        sessions_data = request.data.get('sessions', [])
        if not sessions_data:
            return Response({'error': '会话列表不能为空'}, status=status.HTTP_400_BAD_REQUEST)
        
        user = request.user
        created_count = 0
        updated_count = 0
        
        for sess_data in sessions_data:
            session_id = sess_data.get('session_id')
            
            try:
                session = CloudCachedSession.objects.get(session_id=session_id, user=user)
                # 更新
                session.title = sess_data.get('title', session.title)
                session.status = sess_data.get('status', session.status)
                session.last_message = sess_data.get('last_message', session.last_message)
                session.last_message_time = sess_data.get('last_message_time') or session.last_message_time
                session.unread_count = sess_data.get('unread_count', session.unread_count)
                session.synced_at = timezone.now()
                session.save()
                updated_count += 1
            except CloudCachedSession.DoesNotExist:
                # 创建
                CloudCachedSession.objects.create(
                    user=user,
                    session_id=session_id,
                    session_type=sess_data.get('session_type', 'im'),
                    title=sess_data.get('title', ''),
                    status=sess_data.get('status', 'active'),
                    last_message=sess_data.get('last_message', ''),
                    last_message_time=sess_data.get('last_message_time'),
                    unread_count=sess_data.get('unread_count', 0),
                    agent_code=sess_data.get('agent_code', ''),
                    human_agent_id=sess_data.get('human_agent_id'),
                    synced_at=timezone.now(),
                    is_offline=sess_data.get('is_offline', False)
                )
                created_count += 1
        
        self._update_user_cloud_stats(user)
        
        return Response({
            'success': True,
            'created': created_count,
            'updated': updated_count,
            'total': created_count + updated_count
        })
    
    @action(detail=False, methods=['get'], url_path='sessions/download')
    def download_sessions(self, request):
        """
        从云端下载会话
        """
        from .cloud_cache_models import CloudCachedSession
        from .cloud_cache_serializers import CloudCachedSessionSerializer
        
        user = request.user
        session_type = request.query_params.get('session_type')
        since = request.query_params.get('since')
        
        queryset = CloudCachedSession.objects.filter(user=user)
        
        if session_type:
            queryset = queryset.filter(session_type=session_type)
        if since:
            try:
                since_time = timezone.datetime.fromtimestamp(float(since), tz=timezone.get_current_timezone())
                queryset = queryset.filter(updated_at__gt=since_time)
            except (ValueError, TypeError):
                pass
        
        queryset = queryset.order_by('-updated_at')
        
        serializer = CloudCachedSessionSerializer(queryset, many=True)
        
        return Response({
            'success': True,
            'sessions': serializer.data,
            'count': queryset.count()
        })
    
    # ============================================================
    # 文件同步
    # ============================================================
    
    @action(detail=False, methods=['post'], url_path='files/upload')
    def upload_file(self, request):
        """
        上传文件到云端
        """
        from .cloud_cache_models import CloudCachedFile
        from django.core.files.storage import default_storage
        import os
        
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({'error': '文件不能为空'}, status=status.HTTP_400_BAD_REQUEST)
        
        user = request.user
        file_id = request.data.get('file_id', f'file_{timezone.now().timestamp()}')
        session_id = request.data.get('session_id', '')
        
        # 确定文件类型
        content_type = file_obj.content_type or 'application/octet-stream'
        if content_type.startswith('image/'):
            file_type = 'image'
        elif content_type.startswith('video/'):
            file_type = 'video'
        elif content_type.startswith('audio/'):
            file_type = 'audio'
        elif 'pdf' in content_type or 'document' in content_type:
            file_type = 'document'
        else:
            file_type = 'other'
        
        # 保存文件
        file_path = f'cache/{user.id}/{file_id}_{file_obj.name}'
        saved_path = default_storage.save(file_path, file_obj)
        cloud_url = default_storage.url(saved_path)
        
        # 创建缓存记录
        cached_file = CloudCachedFile.objects.create(
            user=user,
            file_id=file_id,
            original_name=file_obj.name,
            file_type=file_type,
            mime_type=content_type,
            file_size=file_obj.size,
            cloud_url=cloud_url,
            storage_path=saved_path,
            upload_status='uploaded',
            session_id=session_id,
            expires_at=timezone.now() + timezone.timedelta(days=7)  # 7天过期
        )
        
        self._update_user_cloud_stats(user)
        
        return Response({
            'success': True,
            'file_id': file_id,
            'cloud_url': cloud_url,
            'file_type': file_type
        })
    
    @action(detail=False, methods=['get'], url_path='files/list')
    def list_files(self, request):
        """
        获取用户缓存的文件列表
        """
        from .cloud_cache_models import CloudCachedFile
        from .cloud_cache_serializers import CloudCachedFileSerializer
        
        user = request.user
        queryset = CloudCachedFile.objects.filter(user=user).order_by('-created_at')
        
        serializer = CloudCachedFileSerializer(queryset, many=True)
        
        return Response({
            'success': True,
            'files': serializer.data,
            'count': queryset.count()
        })
    
    # ============================================================
    # 用户数据同步
    # ============================================================
    
    @action(detail=False, methods=['post'], url_path='user-data/sync')
    def sync_user_data(self, request):
        """
        同步用户数据（偏好配置等）
        """
        from .cloud_cache_models import UserCloudData
        
        user = request.user
        preferences = request.data.get('preferences', {})
        local_cache_hash = request.data.get('local_cache_hash', '')
        
        # 获取或创建用户云端数据
        cloud_data, created = UserCloudData.objects.get_or_create(
            user=user,
            defaults={'preferences': preferences}
        )
        
        if not created:
            # 合并偏好
            existing_prefs = cloud_data.preferences or {}
            merged_prefs = {**existing_prefs, **preferences}
            cloud_data.preferences = merged_prefs
            cloud_data.local_cache_hash = local_cache_hash
            cloud_data.last_sync_at = timezone.now()
            cloud_data.sync_version += 1
            cloud_data.save()
        
        return Response({
            'success': True,
            'preferences': cloud_data.preferences,
            'sync_version': cloud_data.sync_version,
            'last_sync_at': cloud_data.last_sync_at.isoformat() if cloud_data.last_sync_at else None
        })
    
    @action(detail=False, methods=['get'], url_path='user-data/download')
    def download_user_data(self, request):
        """
        下载用户云端数据
        """
        from .cloud_cache_models import UserCloudData
        
        user = request.user
        
        try:
            cloud_data = UserCloudData.objects.get(user=user)
            return Response({
                'success': True,
                'preferences': cloud_data.preferences,
                'sync_version': cloud_data.sync_version,
                'last_sync_at': cloud_data.last_sync_at.isoformat() if cloud_data.last_sync_at else None,
                'stats': {
                    'message_count': cloud_data.message_count,
                    'session_count': cloud_data.session_count,
                    'file_count': cloud_data.file_count,
                    'total_cache_size': cloud_data.total_cache_size
                }
            })
        except UserCloudData.DoesNotExist:
            return Response({
                'success': True,
                'preferences': {},
                'sync_version': 0,
                'last_sync_at': None,
                'stats': {
                    'message_count': 0,
                    'session_count': 0,
                    'file_count': 0,
                    'total_cache_size': 0
                }
            })
    
    # ============================================================
    # 草稿箱同步
    # ============================================================
    
    @action(detail=False, methods=['post'], url_path='drafts/save')
    def save_draft(self, request):
        """
        保存草稿
        """
        from .cloud_cache_models import UserDraft
        
        user = request.user
        draft_type = request.data.get('draft_type')
        draft_key = request.data.get('draft_key')
        content = request.data.get('content')
        
        if not all([draft_type, draft_key, content]):
            return Response({'error': '参数不完整'}, status=status.HTTP_400_BAD_REQUEST)
        
        draft, created = UserDraft.objects.update_or_create(
            user=user,
            draft_type=draft_type,
            draft_key=draft_key,
            defaults={'content': content}
        )
        
        return Response({
            'success': True,
            'draft_type': draft_type,
            'draft_key': draft_key,
            'created': created
        })
    
    @action(detail=False, methods=['get'], url_path='drafts/list')
    def list_drafts(self, request):
        """
        获取草稿列表
        """
        from .cloud_cache_models import UserDraft
        
        user = request.user
        draft_type = request.query_params.get('draft_type')
        
        queryset = UserDraft.objects.filter(user=user)
        if draft_type:
            queryset = queryset.filter(draft_type=draft_type)
        
        drafts = list(queryset.values('draft_type', 'draft_key', 'content', 'updated_at'))
        
        return Response({
            'success': True,
            'drafts': drafts,
            'count': len(drafts)
        })
    
    # ============================================================
    # 全量同步
    # ============================================================
    
    @action(detail=False, methods=['post'], url_path='sync/full')
    def full_sync(self, request):
        """
        全量同步（消息 + 会话 + 用户数据）
        """
        from .cloud_cache_models import SyncLog, CloudCachedMessage, CloudCachedSession
        
        user = request.user
        sync_type = request.data.get('sync_type', 'upload')  # upload or download
        
        # 创建同步日志
        sync_log = SyncLog.objects.create(
            user=user,
            sync_type=sync_type,
            status='pending',
            device_info=request.META.get('HTTP_USER_AGENT', '')[:200]
        )
        
        try:
            if sync_type == 'upload':
                # 上传同步
                messages_data = request.data.get('messages', [])
                sessions_data = request.data.get('sessions', [])
                
                msg_result = self._sync_messages_upload(user, messages_data)
                sess_result = self._sync_sessions_upload(user, sessions_data)
                
                sync_log.messages_synced = msg_result['total']
                sync_log.sessions_synced = sess_result['total']
                sync_log.status = 'success'
                
            else:
                # 下载同步
                since = request.data.get('since')
                messages = self._sync_messages_download(user, since)
                sessions = self._sync_sessions_download(user, since)
                
                sync_log.messages_synced = len(messages)
                sync_log.sessions_synced = len(sessions)
                sync_log.status = 'success'
                
                # 返回数据
                return Response({
                    'success': True,
                    'messages': messages,
                    'sessions': sessions,
                    'sync_log_id': sync_log.id
                })
            
            sync_log.completed_at = timezone.now()
            sync_log.save()
            
            self._update_user_cloud_stats(user)
            
            return Response({
                'success': True,
                'sync_log_id': sync_log.id,
                'messages_synced': sync_log.messages_synced,
                'sessions_synced': sync_log.sessions_synced
            })
            
        except Exception as e:
            sync_log.status = 'failed'
            sync_log.error_message = str(e)
            sync_log.completed_at = timezone.now()
            sync_log.save()
            
            return Response({
                'success': False,
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    # ============================================================
    # 辅助方法
    # ============================================================
    
    def _update_user_cloud_stats(self, user):
        """更新用户云端数据统计"""
        from .cloud_cache_models import UserCloudData, CloudCachedMessage, CloudCachedSession, CloudCachedFile
        from django.db.models import Sum
        
        cloud_data, _ = UserCloudData.objects.get_or_create(user=user)
        
        cloud_data.message_count = CloudCachedMessage.objects.filter(user=user).count()
        cloud_data.session_count = CloudCachedSession.objects.filter(user=user).count()
        cloud_data.file_count = CloudCachedFile.objects.filter(user=user).count()
        
        # 计算总大小
        total_size = CloudCachedFile.objects.filter(user=user).aggregate(
            total=Sum('file_size')
        )['total'] or 0
        cloud_data.total_cache_size = total_size
        
        cloud_data.last_sync_at = timezone.now()
        cloud_data.save()
    
    def _sync_messages_upload(self, user, messages_data):
        """消息上传同步"""
        from .cloud_cache_models import CloudCachedMessage
        
        created = 0
        updated = 0
        
        for msg_data in messages_data:
            client_msg_id = msg_data.get('client_message_id')
            session_id = msg_data.get('session_id')
            
            existing = CloudCachedMessage.objects.filter(
                user=user,
                session_id=session_id,
                client_message_id=client_msg_id
            ).first() if client_msg_id else None
            
            if existing:
                for key, value in msg_data.items():
                    if hasattr(existing, key) and key not in ['id', 'user']:
                        setattr(existing, key, value)
                existing.synced_at = timezone.now()
                existing.save()
                updated += 1
            else:
                CloudCachedMessage.objects.create(
                    user=user,
                    **{k: v for k, v in msg_data.items() if k not in ['id']},
                    synced_at=timezone.now()
                )
                created += 1
        
        return {'created': created, 'updated': updated, 'total': created + updated}
    
    def _sync_sessions_upload(self, user, sessions_data):
        """会话上传同步"""
        from .cloud_cache_models import CloudCachedSession
        
        created = 0
        updated = 0
        
        for sess_data in sessions_data:
            session_id = sess_data.get('session_id')
            
            try:
                session = CloudCachedSession.objects.get(session_id=session_id, user=user)
                for key, value in sess_data.items():
                    if hasattr(session, key) and key not in ['id', 'user']:
                        setattr(session, key, value)
                session.synced_at = timezone.now()
                session.save()
                updated += 1
            except CloudCachedSession.DoesNotExist:
                CloudCachedSession.objects.create(
                    user=user,
                    **{k: v for k, v in sess_data.items() if k not in ['id']},
                    synced_at=timezone.now()
                )
                created += 1
        
        return {'created': created, 'updated': updated, 'total': created + updated}
    
    def _sync_messages_download(self, user, since=None):
        """消息下载同步"""
        from .cloud_cache_models import CloudCachedMessage
        from .cloud_cache_serializers import CloudCachedMessageSerializer
        
        queryset = CloudCachedMessage.objects.filter(user=user)
        if since:
            try:
                since_time = timezone.datetime.fromtimestamp(float(since), tz=timezone.get_current_timezone())
                queryset = queryset.filter(created_at__gt=since_time)
            except (ValueError, TypeError):
                pass
        
        serializer = CloudCachedMessageSerializer(queryset, many=True)
        return serializer.data
    
    def _sync_sessions_download(self, user, since=None):
        """会话下载同步"""
        from .cloud_cache_models import CloudCachedSession
        from .cloud_cache_serializers import CloudCachedSessionSerializer
        
        queryset = CloudCachedSession.objects.filter(user=user)
        if since:
            try:
                since_time = timezone.datetime.fromtimestamp(float(since), tz=timezone.get_current_timezone())
                queryset = queryset.filter(updated_at__gt=since_time)
            except (ValueError, TypeError):
                pass
        
        serializer = CloudCachedSessionSerializer(queryset, many=True)
        return serializer.data