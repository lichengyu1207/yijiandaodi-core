from rest_framework import serializers
from .data_classification_models import (
    DataSensitivityLevel, DataCategory, DataFieldTag,
    DataClassificationRecord, DataExportApproval, DataProtectionOfficer,
)


class DataSensitivityLevelSerializer(serializers.ModelSerializer):
    class Meta:
        model = DataSensitivityLevel
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']


class DataCategorySerializer(serializers.ModelSerializer):
    default_level_name = serializers.CharField(source='default_level.name', read_only=True)
    default_level_code = serializers.CharField(source='default_level.code', read_only=True)

    class Meta:
        model = DataCategory
        fields = '__all__'
        read_only_fields = ['created_at']


class DataFieldTagSerializer(serializers.ModelSerializer):
    level_name = serializers.CharField(source='sensitivity_level.name', read_only=True)
    level_code = serializers.CharField(source='sensitivity_level.code', read_only=True)
    category_name = serializers.CharField(source='data_category.name', read_only=True)

    class Meta:
        model = DataFieldTag
        fields = '__all__'
        read_only_fields = ['created_at']


class DataClassificationRecordSerializer(serializers.ModelSerializer):
    level_name = serializers.CharField(source='sensitivity_level.name', read_only=True)
    level_color = serializers.CharField(source='sensitivity_level.color', read_only=True)
    category_name = serializers.CharField(source='data_category.name', read_only=True)
    operator_name = serializers.CharField(source='operator.username', read_only=True, default='')

    class Meta:
        model = DataClassificationRecord
        fields = '__all__'
        read_only_fields = ['created_at', 'auto_classification_score']


class DataExportApprovalSerializer(serializers.ModelSerializer):
    requester_name = serializers.CharField(source='requester.username', read_only=True)
    approver_name = serializers.CharField(source='approver.username', read_only=True, default='')
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = DataExportApproval
        fields = '__all__'
        read_only_fields = [
            'status', 'approver', 'approval_comment', 'approved_at',
            'file_path', 'download_count', 'last_download_at', 'created_at'
        ]


class DataProtectionOfficerSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = DataProtectionOfficer
        fields = '__all__'
        read_only_fields = ['created_at']
