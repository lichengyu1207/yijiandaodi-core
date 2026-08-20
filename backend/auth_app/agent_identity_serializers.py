"""
Agent身份认证序列化器

提供AgentIdentity模型的序列化、反序列化功能
"""

from rest_framework import serializers
from .agent_identity_models import (
    AgentIdentity,
    AgentPermission,
    AgentAuthenticationLog,
    AgentAuthSession
)


class AgentIdentitySerializer(serializers.ModelSerializer):
    """Agent身份序列化器"""

    # 计算字段
    trust_level_display = serializers.CharField(
        source='get_trust_level_description',
        read_only=True
    )

    # 关联数据
    permission_count = serializers.SerializerMethodField()
    session_count = serializers.SerializerMethodField()

    class Meta:
        model = AgentIdentity
        fields = [
            'id',
            'agent_id',
            'agent_name',
            'agent_type',
            'trust_level',
            'trust_level_display',
            'trust_level_description',
            'api_key_prefix',
            'api_key_created_at',
            'api_key_expires_at',
            'permissions',
            'owner',
            'created_at',
            'updated_at',
            'last_active_at',
            'is_active',
            'permission_count',
            'session_count'
        ]
        read_only_fields = [
            'id',
            'agent_id',
            'api_key_hash',
            'api_key_prefix',
            'api_key_created_at',
            'created_at',
            'updated_at'
        ]
        extra_kwargs = {
            'api_key_hash': {'write_only': True}
        }

    def get_permission_count(self, obj):
        """获取权限数量"""
        return obj.permission_grants.count()

    def get_session_count(self, obj):
        """获取活跃会话数量"""
        return obj.sessions.filter(is_active=True).count()


class AgentIdentityCreateSerializer(serializers.Serializer):
    """创建Agent的序列化器"""

    agent_name = serializers.CharField(max_length=100)
    agent_type = serializers.ChoiceField(
        choices=['cursor', 'claude', 'copilot', 'custom']
    )
    trust_level = serializers.ChoiceField(
        choices=['low', 'medium', 'high', 'critical'],
        default='low'
    )
    permissions = serializers.DictField(
        required=False,
        default=dict,
        help_text='资源粒度权限控制，格式: {resource_type: [actions]}'
    )

    def create(self, validated_data):
        """创建Agent（不在此处实现，在ViewSet中调用模型方法）"""
        pass


class AgentIdentityUpdateSerializer(serializers.ModelSerializer):
    """更新Agent的序列化器"""

    class Meta:
        model = AgentIdentity
        fields = [
            'agent_name',
            'trust_level',
            'permissions',
            'is_active',
            'api_key_expires_at'
        ]


class AgentPermissionSerializer(serializers.ModelSerializer):
    """Agent权限序列化器"""

    class Meta:
        model = AgentPermission
        fields = [
            'id',
            'agent',
            'resource_type',
            'resource_pattern',
            'action',
            'conditions',
            'granted_by',
            'granted_at',
            'expires_at'
        ]
        read_only_fields = ['id', 'granted_by', 'granted_at']


class AgentAuthenticationLogSerializer(serializers.ModelSerializer):
    """Agent认证日志序列化器"""

    class Meta:
        model = AgentAuthenticationLog
        fields = [
            'id',
            'agent',
            'success',
            'failure_reason',
            'ip_address',
            'user_agent',
            'timestamp'
        ]
        read_only_fields = '__all__'


class AgentAuthSessionSerializer(serializers.ModelSerializer):
    """Agent认证会话序列化器"""

    is_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model = AgentAuthSession
        fields = [
            'id',
            'agent',
            'session_id',
            'jwt_token',
            'token_created_at',
            'token_expires_at',
            'is_active',
            'last_activity_at',
            'ip_address',
            'user_agent',
            'is_expired'
        ]
        read_only_fields = [
            'id',
            'session_id',
            'jwt_token',
            'token_created_at',
            'last_activity_at'
        ]
        extra_kwargs = {
            'jwt_token': {'write_only': True}
        }


class APIKeyVerifySerializer(serializers.Serializer):
    """API Key验证序列化器"""

    api_key = serializers.CharField(
        max_length=100,
        help_text='Agent的API Key'
    )


class APIKeyRegenerateSerializer(serializers.Serializer):
    """API Key重新生成序列化器"""

    expires_days = serializers.IntegerField(
        required=False,
        min_value=1,
        max_value=365,
        default=None,
        help_text='API Key有效期（天），None表示永不过期'
    )