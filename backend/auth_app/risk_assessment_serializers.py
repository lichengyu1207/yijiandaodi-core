"""
风险评估API序列化器

定义风险评估和告警相关的数据序列化格式
"""

from rest_framework import serializers


class RiskAssessmentRequestSerializer(serializers.Serializer):
    """风险评估请求序列化器"""

    activity_id = serializers.CharField(
        max_length=64,
        help_text='活动日志ID'
    )

    class Meta:
        fields = ['activity_id']


class BatchRiskAssessmentRequestSerializer(serializers.Serializer):
    """批量风险评估请求序列化器"""

    activity_ids = serializers.ListField(
        child=serializers.CharField(max_length=64),
        max_length=50,
        help_text='活动日志ID列表（最多50个）'
    )

    class Meta:
        fields = ['activity_ids']


class RiskAssessmentResultSerializer(serializers.Serializer):
    """风险评估结果序列化器"""

    activity_id = serializers.CharField(help_text='活动日志ID')
    overall_score = serializers.FloatField(help_text='综合风险分数')
    risk_level = serializers.CharField(help_text='风险等级')
    should_alert = serializers.BooleanField(help_text='是否触发告警')
    recommendations = serializers.ListField(
        child=serializers.CharField(),
        help_text='建议列表'
    )

    # Agent身份信息
    agent_id = serializers.CharField(
        allow_null=True,
        help_text='Agent ID'
    )
    agent_name = serializers.CharField(
        allow_null=True,
        help_text='Agent名称'
    )
    agent_trust_level = serializers.CharField(
        allow_null=True,
        help_text='Agent信任级别'
    )

    # 阈值信息
    alert_threshold = serializers.FloatField(help_text='调整后告警阈值')
    critical_threshold = serializers.FloatField(help_text='调整后严重阈值')
    permission_bonus = serializers.FloatField(
        default=0.0,
        help_text='权限风险加成'
    )


class TriggerAlertRequestSerializer(serializers.Serializer):
    """触发告警请求序列化器"""

    activity_id = serializers.CharField(
        max_length=64,
        help_text='活动日志ID'
    )
    force = serializers.BooleanField(
        default=False,
        help_text='是否强制触发（忽略风险评估结果）'
    )

    class Meta:
        fields = ['activity_id', 'force']


class AlertDataSerializer(serializers.Serializer):
    """告警数据序列化器"""

    alert_id = serializers.CharField(help_text='告警ID')
    timestamp = serializers.DateTimeField(help_text='告警时间')
    session_id = serializers.CharField(help_text='会话ID')
    client_id = serializers.CharField(help_text='客户端ID')

    # Agent身份信息
    agent = serializers.DictField(help_text='Agent身份信息')

    # 行为信息
    action = serializers.CharField(help_text='操作类型')
    target = serializers.CharField(help_text='操作目标')
    source = serializers.CharField(help_text='来源')

    # 风险信息
    risk_level = serializers.CharField(help_text='风险等级')
    overall_score = serializers.FloatField(help_text='综合风险分数')
    risk_score = serializers.IntegerField(help_text='单次风险分数')

    # 建议和详情
    recommendations = serializers.ListField(
        child=serializers.CharField(),
        help_text='建议列表'
    )
    metadata = serializers.DictField(help_text='元数据')


class CacheStatsSerializer(serializers.Serializer):
    """缓存统计序列化器"""

    total_sessions = serializers.IntegerField(help_text='总会话数')
    total_activities = serializers.IntegerField(help_text='总活动数')
    sessions = serializers.DictField(help_text='各会话活动数')