from rest_framework import serializers
from .agent_models import AgentConfig, AgentSession, AgentMessage, AgentVerificationRecord


class AgentConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentConfig
        fields = ['id', 'code', 'name', 'enabled', 'sort_order',
                  'short_desc', 'full_desc', 'icon', 'color', 'bg_color',
                  'system_prompt', 'welcome_msg', 'temperature', 'max_tokens',
                  'allow_summary', 'allow_analysis', 'allow_query', 'allow_export',
                  'timeout', 'retry_count', 'model', 'api_endpoint',
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class AgentConfigListSerializer(serializers.ModelSerializer):
    status = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = AgentConfig
        fields = ['id', 'code', 'name', 'enabled', 'color', 'icon',
                  'short_desc', 'status']
        read_only_fields = ['id']


class AgentConfigCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentConfig
        fields = ['code', 'name', 'enabled', 'sort_order',
                  'short_desc', 'full_desc', 'icon', 'color', 'bg_color',
                  'system_prompt', 'welcome_msg', 'temperature', 'max_tokens',
                  'allow_summary', 'allow_analysis', 'allow_query', 'allow_export',
                  'timeout', 'retry_count', 'model', 'api_endpoint', 'api_key_encrypted']


class AgentSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentSession
        fields = ['id', 'user', 'agent_code', 'session_id', 'title',
                  'status', 'message_count', 'created_at', 'updated_at', 'expired_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class AgentMessageSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source='get_role_display', read_only=True)

    class Meta:
        model = AgentMessage
        fields = ['id', 'session', 'role', 'role_display', 'content',
                  'token_count', 'model_used', 'latency_ms', 'created_at']
        read_only_fields = ['id', 'created_at']


class ChatRequestSerializer(serializers.Serializer):
    agent_code = serializers.CharField(max_length=20)
    message = serializers.CharField(max_length=5000)
    session_id = serializers.CharField(max_length=64, required=False, allow_blank=True)

    def validate_agent_code(self, value):
        valid_codes = [choice[0] for choice in AgentConfig.AGENT_CHOICES]
        if value not in valid_codes:
            raise serializers.ValidationError('Invalid agent code')
        return value


class AgentVerificationRecordSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    operator_username = serializers.CharField(source='operator.username', read_only=True, default='')
    created_time_formatted = serializers.DateTimeField(format='%Y-%m-%d %H:%M:%S', source='created_at', read_only=True)

    class Meta:
        model = AgentVerificationRecord
        fields = ['id', 'article_id', 'agent_code', 'agent_name', 'status',
                  'status_display', 'title', 'summary', 'detail', 'duration_ms',
                  'result_data', 'operator', 'operator_username', 'sort_order',
                  'created_at', 'created_time_formatted']
        read_only_fields = ['id', 'created_at']
