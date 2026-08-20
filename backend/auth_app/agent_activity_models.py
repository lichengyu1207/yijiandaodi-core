"""
Agent活动日志模型 - 桌面端监控专用
用于记录桌面端实时监控到的Agent操作行为
"""

from django.db import models
from django.conf import settings
import uuid


def generate_activity_id():
    """生成活动ID: act_xxxx"""
    return f"act_{uuid.uuid4().hex[:16]}"


class AgentActivityLog(models.Model):
    """
    Agent活动日志 - 桌面端监控专用

    设计原则：
    1. 只存储单次risk_score，综合分数由后端实时计算
    2. 与前端agentBehaviorParser.ts数据结构保持一致
    3. 支持高效的时间范围查询和风险分析
    """

    # ========== 基础信息 ==========
    activity_id = models.CharField(
        max_length=64,
        primary_key=True,
        default=generate_activity_id,
        verbose_name='活动ID'
    )

    # ========== Agent身份关联 ==========
    agent = models.ForeignKey(
        'AgentIdentity',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_index=True,
        related_name='activities',
        verbose_name='关联Agent',
        help_text='执行该行为的Agent身份实例'
    )

    agent_type = models.CharField(
        max_length=20,
        db_index=True,
        verbose_name='Agent类型',
        help_text='cursor/claude/copilot/unknown（保留用于类型级查询）'
    )

    action = models.CharField(
        max_length=50,
        db_index=True,
        verbose_name='操作类型',
        help_text='file_operation/clipboard_operation/process_started/agent_detected/ai_api_call'
    )

    target = models.TextField(
        verbose_name='操作目标',
        help_text='文件路径/剪贴板/进程名/网络域名'
    )

    # ========== 风险评估（单次） ==========
    risk_level = models.CharField(
        max_length=10,
        db_index=True,
        verbose_name='风险等级',
        help_text='low/medium/high/critical'
    )

    risk_score = models.IntegerField(
        db_index=True,
        verbose_name='风险分数',
        help_text='0-100，单次行为风险分数'
    )

    confidence = models.FloatField(
        default=1.0,
        verbose_name='置信度',
        help_text='0.5-1.0，检测结果的可信程度'
    )

    # ========== 监控来源 ==========
    source = models.CharField(
        max_length=20,
        db_index=True,
        verbose_name='监控来源',
        help_text='file/clipboard/process/network'
    )

    # ========== 时间与会话 ==========
    timestamp = models.DateTimeField(
        db_index=True,
        verbose_name='发生时间',
        help_text='精确到毫秒的时间戳'
    )

    session_id = models.CharField(
        max_length=50,
        db_index=True,
        verbose_name='会话ID',
        help_text='用于关联同一Agent会话的多个行为'
    )

    # ========== 详细信息 ==========
    metadata = models.JSONField(
        default=dict,
        verbose_name='元数据',
        help_text='包含检测详情、内容片段等'
    )

    # ========== 用户关联（可选） ==========
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        verbose_name='关联用户'
    )

    # ========== 系统信息 ==========
    created_at = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        verbose_name='记录创建时间'
    )

    # ========== 数据来源 ==========
    client_id = models.CharField(
        max_length=64,
        db_index=True,
        verbose_name='客户端ID',
        help_text='桌面端唯一标识，用于数据隔离'
    )

    class Meta:
        db_table = 'agent_activity_log'
        verbose_name = 'Agent活动日志'
        verbose_name_plural = 'Agent活动日志'
        ordering = ['-timestamp']

        # 性能优化索引
        indexes = [
            # 时间范围查询（最常用）
            models.Index(fields=['-timestamp'], name='idx_activity_time'),

            # Agent类型+时间（分析特定Agent行为）
            models.Index(fields=['agent_type', '-timestamp'], name='idx_activity_agent_time'),

            # 风险等级+时间（高风险行为追踪）
            models.Index(fields=['risk_level', '-timestamp'], name='idx_activity_risk_time'),

            # 会话查询（分析完整会话）
            models.Index(fields=['session_id', '-timestamp'], name='idx_activity_session'),

            # 客户端+时间（多租户数据隔离）
            models.Index(fields=['client_id', '-timestamp'], name='idx_activity_client_time'),

            # 风险分数范围查询（实时告警）
            models.Index(fields=['-risk_score', '-timestamp'], name='idx_activity_score_time'),
        ]

    def __str__(self):
        return f'{self.agent_type} - {self.action} - {self.risk_score}分 - {self.timestamp}'

    def to_dict(self):
        """转换为字典，用于API响应"""
        return {
            'activity_id': self.activity_id,
            'agent_type': self.agent_type,
            'action': self.action,
            'target': self.target,
            'risk_level': self.risk_level,
            'risk_score': self.risk_score,
            'confidence': self.confidence,
            'source': self.source,
            'timestamp': self.timestamp.isoformat(),
            'session_id': self.session_id,
            'metadata': self.metadata,
            'client_id': self.client_id,
        }


class AgentActivityAggregation(models.Model):
    """
    Agent活动聚合统计（物化视图）
    用于快速查询统计数据，避免实时聚合计算
    """

    # 时间维度
    time_bucket = models.DateTimeField(
        db_index=True,
        verbose_name='时间桶',
        help_text='1分钟/5分钟/1小时聚合'
    )

    bucket_type = models.CharField(
        max_length=20,
        verbose_name='桶类型',
        help_text='1min/5min/1hour'
    )

    # 统计维度
    agent_type = models.CharField(
        max_length=20,
        verbose_name='Agent类型'
    )

    client_id = models.CharField(
        max_length=64,
        verbose_name='客户端ID'
    )

    # 聚合指标
    total_activities = models.IntegerField(
        default=0,
        verbose_name='总活动数'
    )

    avg_risk_score = models.FloatField(
        default=0.0,
        verbose_name='平均风险分数'
    )

    max_risk_score = models.IntegerField(
        default=0,
        verbose_name='最高风险分数'
    )

    high_risk_count = models.IntegerField(
        default=0,
        verbose_name='高风险行为数',
        help_text='risk_score > 60的行为数量'
    )

    critical_count = models.IntegerField(
        default=0,
        verbose_name='严重风险行为数',
        help_text='risk_score > 80的行为数量'
    )

    # 行为分布
    action_distribution = models.JSONField(
        default=dict,
        verbose_name='操作类型分布'
    )

    # 系统信息
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='创建时间'
    )

    class Meta:
        db_table = 'agent_activity_aggregation'
        verbose_name = 'Agent活动聚合统计'
        verbose_name_plural = 'Agent活动聚合统计'
        unique_together = [['time_bucket', 'bucket_type', 'agent_type', 'client_id']]
        indexes = [
            models.Index(fields=['-time_bucket'], name='idx_agg_time'),
            models.Index(fields=['client_id', '-time_bucket'], name='idx_agg_client_time'),
        ]

    def __str__(self):
        return f'{self.agent_type} - {self.bucket_type} - {self.time_bucket}'