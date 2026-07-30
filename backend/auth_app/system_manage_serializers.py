from rest_framework import serializers
from .system_manage_models import (
    FrontendUserManager,
    UserBrowseRecord,
    SystemSecurityConfig,
)


class FrontendUserSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    date_joined = serializers.DateTimeField(source='user.date_joined', read_only=True)
    is_active = serializers.BooleanField(source='user.is_active', read_only=True)

    class Meta:
        model = FrontendUserManager
        fields = [
            'id', 'user', 'username', 'email', 'nickname', 'phone', 'avatar',
            'login_count', 'last_login_ip', 'is_banned', 'ban_reason',
            'banned_at', 'date_joined', 'is_active', 'remark',
        ]
        read_only_fields = ['id', 'user', 'username', 'date_joined', 'login_count']


class FrontendUserUpdateSerializer(serializers.ModelSerializer):
    nickname = serializers.CharField(max_length=100, required=False, allow_blank=True)
    phone = serializers.CharField(max_length=20, required=False, allow_blank=True)
    remark = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = FrontendUserManager
        fields = ['nickname', 'phone', 'remark']


class UserBrowseRecordSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = UserBrowseRecord
        fields = ['id', 'page_url', 'page_title', 'ip_address', 'stay_duration', 'created_at']
        read_only_fields = fields


class SystemSecurityConfigSerializer(serializers.ModelSerializer):
    key_display = serializers.CharField(source='get_config_key_display', read_only=True)

    class Meta:
        model = SystemSecurityConfig
        fields = ['id', 'config_key', 'key_display', 'config_value', 'config_type', 'description', 'updated_at']
        read_only_fields = ['id', 'updated_at']


class SystemSecurityConfigUpdateSerializer(serializers.Serializer):
    config_value = serializers.CharField()
