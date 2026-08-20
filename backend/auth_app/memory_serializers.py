"""
海马体记忆系统序列化器

提供三层记忆模型的序列化、反序列化功能
"""

from rest_framework import serializers
from .memory_models import ShortTermMemory, LongTermMemory, StrategicMemory


class ShortTermMemorySerializer(serializers.ModelSerializer):
    """短期记忆序列化器"""

    is_expired = serializers.BooleanField(read_only=True)

    class Meta:
        model = ShortTermMemory
        fields = [
            'id',
            'agent_id',
            'operation_type',
            'operation_content',
            'risk_score',
            'risk_level',
            'risk_tags',
            'decision',
            'timestamp',
            'expires_at',
            'is_expired'
        ]
        read_only_fields = ['id', 'timestamp', 'expires_at']


class LongTermMemorySerializer(serializers.ModelSerializer):
    """长期记忆序列化器"""

    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = LongTermMemory
        fields = [
            'id',
            'agent_id',
            'operation_type',
            'operation_content',
            'risk_level',
            'risk_score',
            'risk_tags',
            'record_hash',
            'prev_hash',
            'chain_index',
            'decision',
            'user',
            'username',
            'timestamp'
        ]
        read_only_fields = ['id', 'record_hash', 'prev_hash', 'chain_index', 'timestamp']


class LongTermMemoryCreateSerializer(serializers.ModelSerializer):
    """长期记忆创建序列化器"""

    class Meta:
        model = LongTermMemory
        fields = [
            'agent_id',
            'operation_type',
            'operation_content',
            'risk_level',
            'risk_score',
            'risk_tags',
            'decision'
        ]


class StrategicMemorySerializer(serializers.ModelSerializer):
    """策略记忆序列化器"""

    is_effective = serializers.BooleanField(read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)

    class Meta:
        model = StrategicMemory
        fields = [
            'id',
            'strategy_id',
            'strategy_type',
            'rule_name',
            'rule_condition',
            'rule_action',
            'confidence',
            'sample_count',
            'success_rate',
            'version',
            'parent_strategy',
            'is_active',
            'effective_from',
            'effective_until',
            'created_by',
            'created_by_name',
            'created_at',
            'updated_at',
            'is_effective'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class StrategicMemoryCreateSerializer(serializers.ModelSerializer):
    """策略记忆创建序列化器"""

    class Meta:
        model = StrategicMemory
        fields = [
            'strategy_id',
            'strategy_type',
            'rule_name',
            'rule_condition',
            'rule_action',
            'confidence',
            'parent_strategy',
            'is_active',
            'effective_from',
            'effective_until'
        ]


class StrategicMemoryIterateSerializer(serializers.Serializer):
    """策略迭代序列化器"""

    new_condition = serializers.JSONField(
        help_text='新的规则条件（JSON格式）'
    )


class MemoryStatisticsSerializer(serializers.Serializer):
    """记忆统计序列化器"""

    short_term_count = serializers.IntegerField()
    long_term_count = serializers.IntegerField()
    strategy_count = serializers.IntegerField()
    active_strategies = serializers.IntegerField()
    high_risk_count = serializers.IntegerField()
    blocked_count = serializers.IntegerField()
    last_24h_count = serializers.IntegerField()