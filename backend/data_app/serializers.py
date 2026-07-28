from rest_framework import serializers
from .models import DataExportRecord, SystemConfig


class DataExportRecordSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = DataExportRecord
        fields = ['id', 'export_type', 'file_name', 'record_count', 'created_by_name', 'created_at']
        read_only_fields = ['id', 'created_by_name', 'created_at']


class SystemConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemConfig
        fields = ['key', 'value', 'value_type', 'description', 'updated_at']
