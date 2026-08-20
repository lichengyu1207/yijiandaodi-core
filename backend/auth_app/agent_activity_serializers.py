"""
Agent活动日志序列化器

用于验证桌面端批量上报的数据格式
确保与前端agentBehaviorParser.ts输出的数据结构完全匹配
"""

from rest_framework import serializers
from .agent_activity_models import AgentActivityLog
import uuid


class AgentActivityLogSerializer(serializers.ModelSerializer):
    """Agent活动日志序列化器（批量上报内部使用）"""

    # 批量上报时，session_id和client_id可从顶层继承
    session_id = serializers.CharField(max_length=50, required=False)
    client_id = serializers.CharField(max_length=64, required=False)
    
    # Agent身份关联（可选，用于身份-行为绑定）
    agent_id = serializers.CharField(max_length=50, required=False, allow_null=True)

    class Meta:
        model = AgentActivityLog
        fields = [
            'activity_id',
            'agent_id',  # 新增：Agent身份关联
            'agent_type',
            'action',
            'target',
            'risk_level',
            'risk_score',
            'confidence',
            'source',
            'timestamp',
            'session_id',
            'metadata',
            'client_id',
        ]
        read_only_fields = ['activity_id']

    def validate_agent_id(self, value):
        """验证Agent ID是否存在"""
        if value:
            from .agent_identity_models import AgentIdentity
            try:
                AgentIdentity.objects.get(agent_id=value)
            except AgentIdentity.DoesNotExist:
                raise serializers.ValidationError(f"Agent ID {value} 不存在")
        return value

    def validate_risk_level(self, value):
        """验证风险等级"""
        valid_levels = ['low', 'medium', 'high', 'critical']
        if value not in valid_levels:
            raise serializers.ValidationError(f"风险等级必须是: {valid_levels}")
        return value

    def validate_agent_type(self, value):
        """验证Agent类型"""
        valid_types = ['cursor', 'claude', 'copilot', 'unknown']
        if value not in valid_types:
            raise serializers.ValidationError(f"Agent类型必须是: {valid_types}")
        return value

    def validate_action(self, value):
        """验证操作类型"""
        valid_actions = [
            'file_operation',
            'clipboard_operation',
            'process_started',
            'agent_detected',
            'ai_api_call'
        ]
        if value not in valid_actions:
            raise serializers.ValidationError(f"操作类型必须是: {valid_actions}")
        return value

    def validate_risk_score(self, value):
        """验证风险分数"""
        if not (0 <= value <= 100):
            raise serializers.ValidationError("风险分数必须在0-100之间")
        return value

    def validate_confidence(self, value):
        """验证置信度"""
        if not (0.5 <= value <= 1.0):
            raise serializers.ValidationError("置信度必须在0.5-1.0之间")
        return value


class AgentActivityBatchSerializer(serializers.Serializer):
    """批量上报序列化器"""

    activities = AgentActivityLogSerializer(many=True)
    client_id = serializers.CharField(max_length=64)
    session_id = serializers.CharField(max_length=50, required=False)
    
    # Agent身份关联（可选，如果提供则所有activity都关联到该Agent）
    agent_id = serializers.CharField(max_length=50, required=False, allow_null=True)

    def validate_agent_id(self, value):
        """验证Agent ID是否存在"""
        if value:
            from .agent_identity_models import AgentIdentity
            try:
                AgentIdentity.objects.get(agent_id=value)
            except AgentIdentity.DoesNotExist:
                raise serializers.ValidationError(f"Agent ID {value} 不存在")
        return value

    def validate_activities(self, value):
        """验证批量数据"""
        if not value:
            raise serializers.ValidationError("activities不能为空")

        if len(value) > 100:
            raise serializers.ValidationError("单次上报不能超过100条")

        return value

    def create(self, validated_data):
        """创建批量记录"""
        activities_data = validated_data['activities']

        # 生成活动ID
        for activity_data in activities_data:
            activity_data['activity_id'] = f"act_{uuid.uuid4().hex[:16]}"

        return activities_data


class AgentActivityAggregationSerializer(serializers.ModelSerializer):
    """聚合统计序列化器"""

    class Meta:
        model = AgentActivityLog
        fields = [
            'time_bucket',
            'bucket_type',
            'agent_type',
            'client_id',
            'total_activities',
            'avg_risk_score',
            'max_risk_score',
            'high_risk_count',
            'critical_count',
        ]