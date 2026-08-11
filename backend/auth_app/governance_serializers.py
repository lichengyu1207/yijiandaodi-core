"""
合规治理层序列化器

提供Agent合规性评分、治理健康度监控、策略版本管理的序列化器
"""

from rest_framework import serializers
from .governance_models import AgentComplianceScore, GovernanceHealth, StrategyVersion
from .agent_identity_models import AgentIdentity


class AgentComplianceScoreSerializer(serializers.ModelSerializer):
    """Agent合规性评分序列化器"""
    
    agent_id = serializers.CharField(source='agent.agent_id', read_only=True)
    agent_name = serializers.CharField(source='agent.agent_name', read_only=True)
    trust_level = serializers.CharField(source='agent.trust_level', read_only=True)
    risk_level_display = serializers.CharField(source='get_risk_level_display', read_only=True)
    
    class Meta:
        model = AgentComplianceScore
        fields = [
            'id',
            'agent_id',
            'agent_name',
            'trust_level',
            'overall_score',
            'risk_level',
            'risk_level_display',
            'authentication_score',
            'permission_score',
            'behavior_score',
            'audit_score',
            'violations_count',
            'violations_30d',
            'blocked_operations_count',
            'last_operation_at',
            'operations_24h',
            'operations_7d',
            'operations_30d',
            'score_updated_at',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'score_updated_at']


class AgentComplianceScoreDetailSerializer(AgentComplianceScoreSerializer):
    """Agent合规性评分详情序列化器（包含更多信息）"""
    
    risk_factors = serializers.SerializerMethodField()
    compliance_status = serializers.SerializerMethodField()
    
    class Meta(AgentComplianceScoreSerializer.Meta):
        fields = AgentComplianceScoreSerializer.Meta.fields + ['risk_factors', 'compliance_status']
    
    def get_risk_factors(self, obj):
        """获取风险因素"""
        factors = []
        
        if obj.authentication_score < 80:
            factors.append({
                'type': 'authentication',
                'score': obj.authentication_score,
                'severity': 'high' if obj.authentication_score < 60 else 'medium',
                'message': f'认证合规评分偏低：{obj.authentication_score:.1f}'
            })
        
        if obj.permission_score < 80:
            factors.append({
                'type': 'permission',
                'score': obj.permission_score,
                'severity': 'high' if obj.permission_score < 60 else 'medium',
                'message': f'权限合规评分偏低：{obj.permission_score:.1f}'
            })
        
        if obj.behavior_score < 80:
            factors.append({
                'type': 'behavior',
                'score': obj.behavior_score,
                'severity': 'high' if obj.behavior_score < 60 else 'medium',
                'message': f'行为合规评分偏低：{obj.behavior_score:.1f}'
            })
        
        if obj.audit_score < 80:
            factors.append({
                'type': 'audit',
                'score': obj.audit_score,
                'severity': 'high' if obj.audit_score < 60 else 'medium',
                'message': f'审计合规评分偏低：{obj.audit_score:.1f}'
            })
        
        if obj.violations_count > 0:
            factors.append({
                'type': 'violations',
                'count': obj.violations_count,
                'severity': 'high' if obj.violations_count > 5 else 'medium',
                'message': f'存在违规记录：{obj.violations_count}次'
            })
        
        return factors
    
    def get_compliance_status(self, obj):
        """获取合规状态"""
        if obj.overall_score >= 90:
            return {
                'status': 'excellent',
                'message': '合规性优秀',
                'color': 'green'
            }
        elif obj.overall_score >= 75:
            return {
                'status': 'good',
                'message': '合规性良好',
                'color': 'blue'
            }
        elif obj.overall_score >= 60:
            return {
                'status': 'fair',
                'message': '合规性一般',
                'color': 'orange'
            }
        elif obj.overall_score >= 40:
            return {
                'status': 'poor',
                'message': '合规性较差',
                'color': 'red'
            }
        else:
            return {
                'status': 'critical',
                'message': '合规性严重不足',
                'color': 'darkred'
            }


class GovernanceHealthSerializer(serializers.ModelSerializer):
    """治理健康度序列化器"""
    
    health_status = serializers.SerializerMethodField()
    
    class Meta:
        model = GovernanceHealth
        fields = [
            'id',
            'health_score',
            'health_status',
            'total_agents_count',
            'active_agents_count',
            'compliant_agents_count',
            'high_risk_agents_count',
            'operations_24h',
            'operations_7d',
            'operations_30d',
            'violations_24h',
            'violations_7d',
            'violations_30d',
            'blocked_operations_24h',
            'blocked_operations_7d',
            'blocked_operations_30d',
            'compliance_rate',
            'blocking_rate',
            'snapshot_time',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'snapshot_time']
    
    def get_health_status(self, obj):
        """获取健康状态"""
        if obj.health_score >= 90:
            return {
                'status': 'excellent',
                'message': '系统健康度优秀',
                'color': 'green'
            }
        elif obj.health_score >= 75:
            return {
                'status': 'good',
                'message': '系统健康度良好',
                'color': 'blue'
            }
        elif obj.health_score >= 60:
            return {
                'status': 'fair',
                'message': '系统健康度一般',
                'color': 'orange'
            }
        else:
            return {
                'status': 'poor',
                'message': '系统健康度较差',
                'color': 'red'
            }


class StrategyVersionSerializer(serializers.ModelSerializer):
    """策略版本序列化器"""

    strategy_id = serializers.CharField(source='strategy.strategy_id', read_only=True)
    strategy_name = serializers.CharField(source='strategy.rule_name', read_only=True)
    strategy_type = serializers.CharField(source='strategy.strategy_type', read_only=True)
    deployed_by_username = serializers.CharField(source='deployed_by.username', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    is_effective = serializers.SerializerMethodField()
    
    class Meta:
        model = StrategyVersion
        fields = [
            'id',
            'strategy',
            'strategy_id',
            'strategy_name',
            'strategy_type',
            'version',
            'version_code',
            'config',
            'changes',
            'status',
            'status_display',
            'is_active',
            'is_effective',
            'rollout_percentage',
            'rollout_agents',
            'deployed_at',
            'deployed_by',
            'deployed_by_username',
            'performance_metrics',
            'changelog',
            'created_at',
            'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'deployed_at', 'deployed_by']
    
    def get_is_effective(self, obj):
        """判断策略是否生效"""
        return obj.is_active and obj.status == 'production'


class GovernanceDashboardSerializer(serializers.Serializer):
    """治理仪表板序列化器（汇总数据）"""
    
    # 健康度数据
    health_score = serializers.FloatField()
    health_status = serializers.DictField()
    
    # Agent统计
    total_agents = serializers.IntegerField()
    active_agents = serializers.IntegerField()
    compliant_agents = serializers.IntegerField()
    high_risk_agents = serializers.IntegerField()
    
    # 评分分布
    score_distribution = serializers.DictField()
    
    # 风险分布
    risk_distribution = serializers.DictField()
    
    # 趋势数据
    compliance_trend = serializers.ListField()
    
    # 时间戳
    timestamp = serializers.DateTimeField()


class AgentComplianceScoreUpdateSerializer(serializers.Serializer):
    """Agent合规性评分更新序列化器"""
    
    authentication_score = serializers.FloatField(min_value=0, max_value=100, required=False)
    permission_score = serializers.FloatField(min_value=0, max_value=100, required=False)
    behavior_score = serializers.FloatField(min_value=0, max_value=100, required=False)
    audit_score = serializers.FloatField(min_value=0, max_value=100, required=False)
    
    def validate(self, data):
        """验证至少提供了一个评分"""
        if not any(key in data for key in ['authentication_score', 'permission_score', 'behavior_score', 'audit_score']):
            raise serializers.ValidationError("至少需要提供一个维度的评分")
        return data


class StrategyVersionDeploySerializer(serializers.Serializer):
    """策略版本部署序列化器"""
    
    rollout_percentage = serializers.IntegerField(min_value=0, max_value=100, default=100)
    rollout_agents = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        allow_empty=True
    )
    changelog = serializers.CharField(required=False, allow_blank=True)
    
    def validate(self, data):
        """验证灰度发布参数"""
        rollout_percentage = data.get('rollout_percentage', 100)
        rollout_agents = data.get('rollout_agents', [])
        
        # 如果灰度比例小于100%，则必须指定Agent列表
        if rollout_percentage < 100 and not rollout_agents:
            raise serializers.ValidationError(
                "灰度发布比例小于100%时，必须指定具体的Agent列表"
            )
        
        return data