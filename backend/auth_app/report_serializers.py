"""
报告序列化器
"""

from rest_framework import serializers
from .report_models import UserReport, AccountAsset


class UserReportSerializer(serializers.ModelSerializer):
    """用户报告序列化器"""
    
    download_url = serializers.SerializerMethodField()
    
    class Meta:
        model = UserReport
        fields = [
            'id', 'report_type', 'title', 'status', 'summary',
            'total_checks', 'total_risks', 'safety_score',
            'start_date', 'end_date',
            'file_size', 'created_at', 'updated_at',
            'download_url'
        ]
    
    def get_download_url(self, obj):
        if obj.status == 'completed' and obj.file_path:
            return f'/api/report/download/{obj.id}/'
        return None


class GenerateReportSerializer(serializers.Serializer):
    """生成报告请求序列化器"""
    
    report_type = serializers.ChoiceField(
        choices=['timeline', 'material_risk', 'account_asset', 'full'],
        help_text='报告类型'
    )
    start_date = serializers.DateTimeField(required=False, help_text='统计开始时间')
    end_date = serializers.DateTimeField(required=False, help_text='统计结束时间')


class AccountAssetSerializer(serializers.ModelSerializer):
    """账号资产序列化器"""
    
    username = serializers.CharField(source='user.username', read_only=True)
    
    class Meta:
        model = AccountAsset
        fields = [
            'id', 'username',
            'safety_points', 'trust_score',
            'total_checks', 'text_checks', 'image_checks', 'marketing_checks',
            'total_risks', 'high_risks', 'medium_risks', 'low_risks',
            'total_evidences', 'evidence_chain_length',
            'created_at', 'updated_at'
        ]