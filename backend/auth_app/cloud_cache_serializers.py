# ============================================================
# 云端缓存序列化器 - 一鉴到底
# ============================================================

from rest_framework import serializers
from .cloud_cache_models import (
    CloudCachedMessage, CloudCachedSession,
    CloudCachedFile, UserDraft, SyncLog
)


class CloudCachedMessageSerializer(serializers.ModelSerializer):
    """云端缓存消息序列化器"""
    
    class Meta:
        model = CloudCachedMessage
        fields = [
            'id', 'session_id', 'session_type',
            'message_type', 'sender_type', 'content',
            'file_url', 'client_message_id', 'is_read',
            'is_offline', 'synced_at', 'created_at'
        ]
        read_only_fields = ['id', 'synced_at', 'created_at']


class CloudCachedSessionSerializer(serializers.ModelSerializer):
    """云端缓存会话序列化器"""
    
    class Meta:
        model = CloudCachedSession
        fields = [
            'id', 'session_id', 'session_type',
            'title', 'status', 'last_message',
            'last_message_time', 'unread_count',
            'agent_code', 'human_agent_id',
            'is_offline', 'synced_at',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'synced_at', 'created_at', 'updated_at']


class CloudCachedFileSerializer(serializers.ModelSerializer):
    """云端缓存文件序列化器"""
    
    is_expired = serializers.SerializerMethodField()
    
    class Meta:
        model = CloudCachedFile
        fields = [
            'id', 'file_id', 'original_name',
            'file_type', 'mime_type', 'file_size',
            'cloud_url', 'upload_status',
            'session_id', 'expires_at',
            'is_expired', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_is_expired(self, obj):
        return obj.is_expired()


class UserDraftSerializer(serializers.ModelSerializer):
    """用户草稿序列化器"""
    
    class Meta:
        model = UserDraft
        fields = [
            'id', 'draft_type', 'draft_key',
            'content', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class SyncLogSerializer(serializers.ModelSerializer):
    """同步日志序列化器"""
    
    duration_seconds = serializers.SerializerMethodField()
    
    class Meta:
        model = SyncLog
        fields = [
            'id', 'sync_type', 'status',
            'messages_synced', 'sessions_synced',
            'files_synced', 'bytes_synced',
            'error_message', 'device_info',
            'started_at', 'completed_at',
            'duration_seconds'
        ]
        read_only_fields = ['id', 'started_at', 'completed_at']
    
    def get_duration_seconds(self, obj):
        if obj.started_at and obj.completed_at:
            delta = obj.completed_at - obj.started_at
            return delta.total_seconds()
        return None


class FullSyncUploadSerializer(serializers.Serializer):
    """全量同步上传请求序列化器"""
    
    messages = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        default=list
    )
    sessions = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        default=list
    )
    sync_type = serializers.ChoiceField(
        choices=['upload', 'download'],
        default='upload'
    )
    since = serializers.FloatField(
        required=False,
        help_text='同步时间戳，用于增量同步'
    )


class FullSyncDownloadSerializer(serializers.Serializer):
    """全量同步下载响应序列化器"""
    
    messages = CloudCachedMessageSerializer(many=True)
    sessions = CloudCachedSessionSerializer(many=True)
    success = serializers.BooleanField()
    sync_log_id = serializers.IntegerField()