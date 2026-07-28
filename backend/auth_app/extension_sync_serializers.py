"""
浏览器插件数据同步序列化器
"""

from rest_framework import serializers
from .extension_sync_models import (
    ExtensionSession,
    ExtensionOperation,
    ExtensionFingerprint,
    ExtensionSyncLog
)


class ExtensionOperationSerializer(serializers.ModelSerializer):
    """操作记录序列化器"""

    class Meta:
        model = ExtensionOperation
        fields = [
            'id', 'operation_id', 'operation_type',
            'timestamp', 'timestamp_display', 'timestamp_source',
            'platform_name', 'platform_type',
            'content_preview', 'content_hash',
            'page_url', 'page_title',
            'metadata', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class ExtensionFingerprintSerializer(serializers.ModelSerializer):
    """指纹记录序列化器"""

    class Meta:
        model = ExtensionFingerprint
        fields = [
            'id', 'hash', 'prev_hash',
            'operation_id', 'timestamp',
            'timestamp_display', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class ExtensionSessionSerializer(serializers.ModelSerializer):
    """录制会话序列化器"""

    operations = ExtensionOperationSerializer(many=True, read_only=True)
    fingerprints = ExtensionFingerprintSerializer(many=True, read_only=True)

    class Meta:
        model = ExtensionSession
        fields = [
            'id', 'session_id', 'title',
            'start_time', 'end_time', 'status',
            'operations_count', 'fingerprints_count', 'platforms_count',
            'platforms', 'device_id', 'extension_version',
            'operations', 'fingerprints',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ExtensionSessionListSerializer(serializers.ModelSerializer):
    """录制会话列表序列化器（简化版）"""

    class Meta:
        model = ExtensionSession
        fields = [
            'id', 'session_id', 'title',
            'start_time', 'end_time', 'status',
            'operations_count', 'fingerprints_count', 'platforms_count',
            'platforms', 'created_at'
        ]


class SyncStartSerializer(serializers.Serializer):
    """开始录制同步序列化器"""

    session_id = serializers.CharField(max_length=100)
    title = serializers.CharField(max_length=255, required=False, default='')
    start_time = serializers.DateTimeField()
    device_id = serializers.CharField(max_length=100, required=False, default='')
    extension_version = serializers.CharField(max_length=20, required=False, default='')


class SyncOperationSerializer(serializers.Serializer):
    """操作同步序列化器"""

    session_id = serializers.CharField(max_length=100)
    operations = serializers.ListField(
        child=serializers.DictField(),
        allow_empty=False
    )


class SyncEndSerializer(serializers.Serializer):
    """停止录制同步序列化器"""

    session_id = serializers.CharField(max_length=100)
    end_time = serializers.DateTimeField()
    operations = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        default=list
    )
    fingerprints = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        default=list
    )


class SyncFullSerializer(serializers.Serializer):
    """完整同步序列化器"""

    session_id = serializers.CharField(max_length=100)
    title = serializers.CharField(max_length=255, required=False, default='')
    start_time = serializers.DateTimeField()
    end_time = serializers.DateTimeField(required=False, allow_null=True)
    status = serializers.CharField(max_length=20, default='active')

    operations = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        default=list
    )
    fingerprints = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        default=list
    )

    device_id = serializers.CharField(max_length=100, required=False, default='')
    extension_version = serializers.CharField(max_length=20, required=False, default='')


class ExtensionSyncLogSerializer(serializers.ModelSerializer):
    """同步日志序列化器"""

    class Meta:
        model = ExtensionSyncLog
        fields = [
            'id', 'session_id', 'sync_type',
            'operations_synced', 'fingerprints_synced',
            'device_id', 'ip_address',
            'status', 'error_message',
            'created_at'
        ]