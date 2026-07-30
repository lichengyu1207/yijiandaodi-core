from rest_framework import serializers
from .security_models import AgentSecurityRule, AgentRiskLog


class AgentSecurityRuleSerializer(serializers.ModelSerializer):
    rule_type_display = serializers.CharField(source='get_rule_type_display', read_only=True)
    severity_display = serializers.CharField(source='get_severity_display', read_only=True)
    action_display = serializers.CharField(source='get_action_display', read_only=True)

    class Meta:
        model = AgentSecurityRule
        fields = [
            'id', 'name', 'rule_type', 'rule_type_display', 'description',
            'pattern', 'pattern_type', 'severity', 'severity_display',
            'action', 'action_display', 'is_enabled', 'priority',
            'target_roles', 'exclude_users', 'metadata',
            'created_at', 'updated_at', 'created_by',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_pattern(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError('匹配模式不能为空')
        return value.strip()


class AgentSecurityRuleUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = AgentSecurityRule
        fields = [
            'name', 'description', 'pattern', 'pattern_type',
            'severity', 'action', 'is_enabled', 'priority',
            'target_roles', 'exclude_users', 'metadata',
        ]


class AgentRiskLogSerializer(serializers.ModelSerializer):
    rule_name = serializers.CharField(source='rule.name', default='', read_only=True)
    rule_type = serializers.CharField(source='rule.rule_type', default='', read_only=True)
    risk_level_display = serializers.CharField(source='get_risk_level_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = AgentRiskLog
        fields = [
            'id', 'session_id', 'user_id', 'agent_role',
            'rule', 'rule_name', 'rule_type',
            'risk_level', 'risk_level_display', 'status', 'status_display',
            'input_content', 'detected_pattern', 'action_taken',
            'ip_address', 'response_message', 'processing_time_ms',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class SecurityCheckRequestSerializer(serializers.Serializer):
    content = serializers.CharField(max_length=10000, required=True)
    session_id = serializers.CharField(max_length=100, required=False, default='')
    agent_role = serializers.CharField(max_length=50, required=False, default='')
    user_id = serializers.IntegerField(required=False, default=0)


class SecurityCheckResponseSerializer(serializers.Serializer):
    is_safe = serializers.BooleanField()
    risk_level = serializers.CharField(default='low')
    action_taken = serializers.CharField(default='')
    matched_rules = serializers.ListField(child=serializers.DictField(), default=list)
    warning_message = serializers.CharField(default='')
    masked_content = serializers.CharField(required=False, default='')
