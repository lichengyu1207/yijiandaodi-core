"""
API Key序列化器
"""

from rest_framework import serializers
from .apikey_models import APIKey


class APIKeySerializer(serializers.ModelSerializer):
    """API Key序列化器"""
    
    class Meta:
        model = APIKey
        fields = [
            'id', 'name', 'key_prefix', 'permissions',
            'is_active', 'created_at', 'last_used_at',
            'expires_at', 'rate_limit'
        ]
        read_only_fields = ['id', 'key_prefix', 'created_at', 'last_used_at']


class APIKeyGenerateSerializer(serializers.Serializer):
    """API Key生成序列化器"""
    
    name = serializers.CharField(max_length=100, required=False, default='Default API Key')
    permissions = serializers.ListField(
        child=serializers.ChoiceField(choices=['read', 'write', 'delete']),
        required=False,
        default=['read']
    )
    expires_in_days = serializers.IntegerField(
        required=False,
        default=365,
        min_value=1,
        max_value=3650
    )