"""
文件监控系统序列化器

提供文件监控相关的数据序列化和反序列化功能
"""

from rest_framework import serializers
from .file_watch_models import (
    FileWatchConfig,
    FileOperationLog,
    FileHashRecord,
    FileRiskAssessment
)


class FileWatchConfigSerializer(serializers.ModelSerializer):
    """文件监控配置序列化器"""
    
    class Meta:
        model = FileWatchConfig
        fields = [
            'id',
            'watch_path',
            'watch_name',
            'watch_create',
            'watch_modify',
            'watch_rename',
            'watch_delete',
            'file_extensions',
            'exclude_patterns',
            'auto_verify',
            'risk_threshold',
            'is_active',
            'total_files',
            'last_check_time',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['user', 'total_files', 'last_check_time', 'created_at', 'updated_at']
    
    def validate_watch_path(self, value):
        """验证监控路径"""
        import os
        if not os.path.isabs(value):
            raise serializers.ValidationError('监控路径必须是绝对路径')
        return value
    
    def create(self, validated_data):
        """创建监控配置时自动关联当前用户"""
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class FileWatchConfigListSerializer(serializers.ModelSerializer):
    """文件监控配置列表序列化器（精简版）"""
    
    class Meta:
        model = FileWatchConfig
        fields = [
            'id',
            'watch_name',
            'watch_path',
            'is_active',
            'auto_verify',
            'risk_threshold',
            'total_files',
            'created_at'
        ]


class FileOperationLogSerializer(serializers.ModelSerializer):
    """文件操作日志序列化器"""
    
    config_name = serializers.CharField(source='config.watch_name', read_only=True)
    operation_type_display = serializers.CharField(source='get_operation_type_display', read_only=True)
    risk_level_display = serializers.CharField(source='get_risk_level_display', read_only=True)
    
    class Meta:
        model = FileOperationLog
        fields = [
            'id',
            'config',
            'config_name',
            'file_path',
            'file_name',
            'file_extension',
            'file_size',
            'operation_type',
            'operation_type_display',
            'old_path',
            'file_hash',
            'previous_hash',
            'hash_changed',
            'risk_level',
            'risk_level_display',
            'risk_score',
            'risk_tags',
            'verification_triggered',
            'verification_result',
            'user_confirmed',
            'confirmed_at',
            'confirmation_note',
            'operation_time',
            'created_at'
        ]
        read_only_fields = '__all__'


class FileOperationLogListSerializer(serializers.ModelSerializer):
    """文件操作日志列表序列化器（精简版）"""
    
    operation_type_display = serializers.CharField(source='get_operation_type_display', read_only=True)
    risk_level_display = serializers.CharField(source='get_risk_level_display', read_only=True)
    
    class Meta:
        model = FileOperationLog
        fields = [
            'id',
            'file_name',
            'operation_type',
            'operation_type_display',
            'risk_level',
            'risk_level_display',
            'risk_score',
            'verification_triggered',
            'user_confirmed',
            'operation_time'
        ]


class FileHashRecordSerializer(serializers.ModelSerializer):
    """文件哈希记录序列化器"""
    
    class Meta:
        model = FileHashRecord
        fields = [
            'id',
            'file_path',
            'file_hash',
            'file_size',
            'version',
            'is_current',
            'created_at'
        ]
        read_only_fields = '__all__'


class FileRiskAssessmentSerializer(serializers.ModelSerializer):
    """文件风险评估序列化器"""
    
    file_name = serializers.CharField(source='operation_log.file_name', read_only=True)
    overall_risk_level_display = serializers.CharField(source='get_overall_risk_level_display', read_only=True)
    
    class Meta:
        model = FileRiskAssessment
        fields = [
            'id',
            'operation_log',
            'file_name',
            'identity_check',
            'risk_check',
            'verification_check',
            'decision_check',
            'overall_score',
            'overall_risk_level',
            'overall_risk_level_display',
            'recommendations',
            'created_at'
        ]
        read_only_fields = '__all__'


class FileVerificationTriggerSerializer(serializers.Serializer):
    """手动触发文件校验的请求序列化器"""
    
    file_path = serializers.CharField(
        max_length=1000,
        help_text='文件完整路径'
    )
    
    file_hash = serializers.CharField(
        max_length=64,
        required=False,
        help_text='文件SHA-256哈希值（可选，如不提供将自动计算）'
    )
    
    config_id = serializers.IntegerField(
        required=False,
        help_text='监控配置ID（可选）'
    )


class FileOperationConfirmSerializer(serializers.Serializer):
    """用户确认高风险操作的请求序列化器"""
    
    confirmed = serializers.BooleanField(
        help_text='用户确认结果：True=允许，False=拒绝'
    )
    
    note = serializers.CharField(
        max_length=500,
        required=False,
        allow_blank=True,
        help_text='确认备注说明'
    )