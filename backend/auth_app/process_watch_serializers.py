"""
进程行为监控序列化器
"""

from rest_framework import serializers

from .process_watch_models import ProcessUsageRecord


class ProcessUsageRecordSerializer(serializers.ModelSerializer):
    """进程使用记录序列化器"""

    class Meta:
        model = ProcessUsageRecord
        fields = [
            'id', 'tool_name', 'process_name', 'pid',
            'session_start', 'session_end', 'duration_seconds',
            'related_files', 'has_related_files', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class ProcessReportSerializer(serializers.Serializer):
    """
    进程会话上报序列化器

    Electron 端在工具进程退出时上报，支持单条或批量。
    """
    tool_name = serializers.CharField(max_length=100)
    process_name = serializers.CharField(max_length=255)
    pid = serializers.IntegerField()
    session_start = serializers.DateTimeField()
    session_end = serializers.DateTimeField(allow_null=True, required=False)
    duration_seconds = serializers.IntegerField(required=False, default=0)
    related_files = serializers.ListField(
        child=serializers.CharField(max_length=1000),
        required=False,
        default=list
    )
    has_related_files = serializers.BooleanField(
        required=False,
        allow_null=True,
        default=None,
        help_text='null=未确定；false=确定无；true=有'
    )
