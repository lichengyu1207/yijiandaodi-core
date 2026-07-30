"""
双因子认证序列化器
"""

from rest_framework import serializers
from .two_factor_models import TwoFactorAuth


class TwoFactorSetupSerializer(serializers.Serializer):
    """双因子认证设置序列化器"""

    def validate(self, attrs):
        user = self.context['request'].user
        
        # 检查是否已启用
        if hasattr(user, 'two_factor') and user.two_factor.is_enabled:
            raise serializers.ValidationError('双因子认证已启用，无需重复设置')
        
        return attrs


class TwoFactorVerifySerializer(serializers.Serializer):
    """双因子认证验证序列化器"""

    code = serializers.CharField(max_length=10, min_length=6)

    def validate_code(self, value):
        # 验证码格式检查
        if not value.isdigit():
            raise serializers.ValidationError('验证码必须为数字')
        return value


class TwoFactorEnableSerializer(serializers.Serializer):
    """启用双因子认证序列化器"""

    code = serializers.CharField(max_length=10, min_length=6)
    enable_backup_codes = serializers.BooleanField(default=True)


class TwoFactorDisableSerializer(serializers.Serializer):
    """禁用双因子认证序列化器"""

    password = serializers.CharField()
    code = serializers.CharField(max_length=10, min_length=6, required=False)


class TwoFactorStatusSerializer(serializers.ModelSerializer):
    """双因子认证状态序列化器"""

    class Meta:
        model = TwoFactorAuth
        fields = ['is_enabled', 'created_at', 'last_used_at']