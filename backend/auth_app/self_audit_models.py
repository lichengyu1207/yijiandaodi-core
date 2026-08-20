"""
自监控数据模型 - Self-Audit Models

实现系统的自监控能力，包括：
1. 校验准确率漂移检测
2. 响应时间异常监控
3. 误报率变化统计
4. 权限使用审计
5. 规则库时效性检测

参考实现：
- trusted-agent-engine的自我感知（Self-Audit）能力
- ka88-agent-shield的Self-Audit模块
"""

from django.db import models
from django.conf import settings
from django.utils import timezone
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)


class PerformanceDriftRecord(models.Model):
    """
    性能漂移记录
    
    记录系统性能指标的变化趋势，包括：
    - 校验准确率漂移
    - 响应时间异常
    - 误报率变化
    """
    
    DRIFT_TYPE_CHOICES = [
        ('accuracy', '准确率漂移'),
        ('precision', '精确率漂移'),
        ('recall', '召回率漂移'),
        ('f1_score', 'F1分数漂移'),
        ('response_time', '响应时间异常'),
        ('false_positive_rate', '误报率变化'),
    ]
    
    SEVERITY_CHOICES = [
        ('low', '低'),
        ('medium', '中'),
        ('high', '高'),
        ('critical', '严重'),
    ]
    
    # 基本信息
    drift_type = models.CharField('漂移类型', max_length=50, choices=DRIFT_TYPE_CHOICES)
    severity = models.CharField('严重程度', max_length=20, choices=SEVERITY_CHOICES, default='low')
    
    # 数值信息
    baseline_value = models.FloatField('基线值', help_text='历史平均值或阈值')
    current_value = models.FloatField('当前值')
    deviation_rate = models.FloatField('偏离率', help_text='偏离基线的百分比')
    
    # 统计信息
    sample_size = models.IntegerField('样本大小', default=0)
    time_window = models.DurationField('时间窗口', default=timedelta(hours=1))
    
    # 关联信息
    baseline = models.ForeignKey(
        'BehaviorBaseline',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='关联基线'
    )
    
    # 状态
    is_resolved = models.BooleanField('是否已解决', default=False)
    resolved_at = models.DateTimeField('解决时间', null=True, blank=True)
    resolution_note = models.TextField('解决说明', blank=True)
    
    # 元数据
    detected_at = models.DateTimeField('检测时间', auto_now_add=True)
    metadata = models.JSONField('元数据', default=dict, help_text='额外的上下文信息')
    
    class Meta:
        db_table = 'performance_drift_records'
        ordering = ['-detected_at']
        indexes = [
            models.Index(fields=['drift_type', '-detected_at']),
            models.Index(fields=['severity', 'is_resolved']),
        ]
    
    def __str__(self):
        return f"{self.get_drift_type_display()} - {self.severity} ({self.deviation_rate:.2%})"
    
    def calculate_severity(self):
        """根据偏离率自动计算严重程度"""
        abs_deviation = abs(self.deviation_rate)
        
        if abs_deviation >= 0.30:  # 30%以上偏离
            self.severity = 'critical'
        elif abs_deviation >= 0.20:  # 20-30%偏离
            self.severity = 'high'
        elif abs_deviation >= 0.10:  # 10-20%偏离
            self.severity = 'medium'
        else:  # 10%以下偏离
            self.severity = 'low'
        
        return self.severity


class AgentPermissionAuditLog(models.Model):
    """
    Agent权限审计日志

    记录所有Agent权限变更操作，包括：
    - 权限授予/撤销
    - 权限范围变更
    - 权限使用异常
    """
    
    ACTION_CHOICES = [
        ('grant', '授予权限'),
        ('revoke', '撤销权限'),
        ('modify', '修改权限'),
        ('escalate', '权限提升'),
        ('de-escalate', '权限降低'),
        ('use', '权限使用'),
        ('abuse', '权限滥用'),
    ]
    
    # 操作信息
    action = models.CharField('操作类型', max_length=20, choices=ACTION_CHOICES)
    agent = models.ForeignKey(
        'AgentIdentity',
        on_delete=models.CASCADE,
        related_name='permission_audit_logs',
        verbose_name='Agent'
    )
    
    # 权限信息
    permission = models.ForeignKey(
        'AgentPermission',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='关联权限'
    )
    permission_type = models.CharField('权限类型', max_length=50)
    resource_type = models.CharField('资源类型', max_length=50)
    
    # 变更详情
    old_value = models.JSONField('旧值', null=True, blank=True)
    new_value = models.JSONField('新值', null=True, blank=True)
    change_description = models.TextField('变更说明')
    
    # 执行者
    performed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='执行人'
    )
    performed_ip = models.GenericIPAddressField('执行IP', null=True, blank=True)
    
    # 风险评估
    risk_level = models.CharField('风险等级', max_length=20, choices=[
        ('safe', '安全'),
        ('low', '低风险'),
        ('medium', '中风险'),
        ('high', '高风险'),
        ('critical', '严重风险'),
    ], default='safe')
    
    # 异常标记
    is_anomaly = models.BooleanField('是否异常', default=False)
    anomaly_reason = models.TextField('异常原因', blank=True)
    
    # 时间戳
    timestamp = models.DateTimeField('操作时间', auto_now_add=True)
    
    class Meta:
        db_table = 'agent_permission_audit_logs'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['agent', '-timestamp']),
            models.Index(fields=['action', 'risk_level']),
            models.Index(fields=['is_anomaly', '-timestamp']),
        ]
    
    def __str__(self):
        return f"{self.agent} - {self.get_action_display()} ({self.timestamp})"
    
    def assess_risk(self):
        """评估权限操作风险"""
        risk_factors = []
        
        # 权限提升通常是高风险
        if self.action == 'escalate':
            risk_factors.append('权限提升')
        
        # 敏感资源访问
        if self.resource_type in ['system', 'database', 'api']:
            risk_factors.append('敏感资源')
        
        # 时间异常（非工作时间）
        hour = self.timestamp.hour
        if hour < 6 or hour > 22:
            risk_factors.append('非工作时间')
        
        # IP异常
        if self.performed_ip:
            # 这里可以添加IP白名单检查
            pass
        
        # 根据风险因素数量判定风险等级
        risk_count = len(risk_factors)
        if risk_count >= 3:
            self.risk_level = 'critical'
            self.is_anomaly = True
        elif risk_count >= 2:
            self.risk_level = 'high'
            self.is_anomaly = True
        elif risk_count >= 1:
            self.risk_level = 'medium'
        else:
            self.risk_level = 'safe'
        
        if self.is_anomaly:
            self.anomaly_reason = '; '.join(risk_factors)
        
        return self.risk_level


class RuleFreshnessCheck(models.Model):
    """
    规则库时效性检查
    
    检测规则库更新频率，识别过期规则
    """
    
    RULE_TYPE_CHOICES = [
        ('detection_rule', '检测规则'),
        ('response_policy', '响应策略'),
        ('risk_assessment', '风险评估'),
        ('behavior_constraint', '行为约束'),
    ]
    
    STATUS_CHOICES = [
        ('fresh', '新鲜'),
        ('stale', '陈旧'),
        ('outdated', '过期'),
        ('deprecated', '废弃'),
    ]
    
    # 规则信息
    rule_type = models.CharField('规则类型', max_length=50, choices=RULE_TYPE_CHOICES)
    strategy = models.ForeignKey(
        'StrategicMemory',
        on_delete=models.CASCADE,
        related_name='freshness_checks',
        verbose_name='关联策略'
    )
    
    # 时效性信息
    last_updated = models.DateTimeField('最后更新时间')
    days_since_update = models.IntegerField('距上次更新天数', default=0)
    freshness_status = models.CharField('时效状态', max_length=20, choices=STATUS_CHOICES, default='fresh')
    
    # 性能指标
    effectiveness_score = models.FloatField('有效性评分', default=100.0)
    usage_count = models.IntegerField('使用次数', default=0)
    success_rate = models.FloatField('成功率', default=100.0)
    
    # 建议
    recommendation = models.TextField('建议', blank=True)
    
    # 检查时间
    checked_at = models.DateTimeField('检查时间', auto_now_add=True)
    
    class Meta:
        db_table = 'rule_freshness_checks'
        ordering = ['-checked_at']
        indexes = [
            models.Index(fields=['rule_type', 'freshness_status']),
            models.Index(fields=['days_since_update']),
        ]
    
    def __str__(self):
        return f"{self.get_rule_type_display()} - {self.freshness_status} ({self.days_since_update}天)"
    
    def check_freshness(self):
        """检查规则时效性"""
        from django.utils import timezone
        
        self.days_since_update = (timezone.now() - self.last_updated).days
        
        # 根据更新时间和性能指标判定时效性
        if self.days_since_update > 180:  # 超过6个月
            self.freshness_status = 'deprecated'
            self.recommendation = '规则已废弃，建议立即更新或删除'
        elif self.days_since_update > 90:  # 超过3个月
            self.freshness_status = 'outdated'
            self.recommendation = '规则已过期，建议尽快审核和更新'
        elif self.days_since_update > 30:  # 超过1个月
            self.freshness_status = 'stale'
            self.recommendation = '规则可能陈旧，建议定期审核'
        else:
            self.freshness_status = 'fresh'
            self.recommendation = '规则保持新鲜，无需处理'
        
        # 考虑性能指标
        if self.effectiveness_score < 60 or self.success_rate < 70:
            if self.freshness_status == 'fresh':
                self.freshness_status = 'stale'
                self.recommendation = '虽然规则更新时间较新，但性能指标下降，建议优化'
        
        return self.freshness_status


class SelfAuditReport(models.Model):
    """
    自审计报告
    
    汇总自监控结果，生成综合审计报告
    """
    
    REPORT_TYPE_CHOICES = [
        ('hourly', '小时报告'),
        ('daily', '日报'),
        ('weekly', '周报'),
        ('monthly', '月报'),
    ]
    
    # 基本信息
    report_type = models.CharField('报告类型', max_length=20, choices=REPORT_TYPE_CHOICES)
    period_start = models.DateTimeField('报告周期开始')
    period_end = models.DateTimeField('报告周期结束')
    
    # 统计数据
    total_checks = models.IntegerField('总检查次数', default=0)
    issues_found = models.IntegerField('发现问题数', default=0)
    issues_resolved = models.IntegerField('已解决问题数', default=0)
    
    # 性能漂移统计
    performance_drifts = models.IntegerField('性能漂移次数', default=0)
    critical_drifts = models.IntegerField('严重漂移次数', default=0)
    
    # 权限审计统计
    permission_changes = models.IntegerField('权限变更次数', default=0)
    permission_anomalies = models.IntegerField('权限异常次数', default=0)
    
    # 规则时效性统计
    stale_rules = models.IntegerField('陈旧规则数', default=0)
    deprecated_rules = models.IntegerField('废弃规则数', default=0)
    
    # 健康度评分
    overall_health_score = models.FloatField('整体健康度评分', default=100.0)
    security_score = models.FloatField('安全评分', default=100.0)
    performance_score = models.FloatField('性能评分', default=100.0)
    compliance_score = models.FloatField('合规评分', default=100.0)
    
    # 报告内容
    summary = models.TextField('摘要')
    recommendations = models.JSONField('建议列表', default=list)
    
    # 元数据
    generated_at = models.DateTimeField('生成时间', auto_now_add=True)
    generated_by = models.CharField('生成方式', max_length=50, default='automatic')
    
    class Meta:
        db_table = 'self_audit_reports'
        ordering = ['-generated_at']
        indexes = [
            models.Index(fields=['report_type', '-period_start']),
        ]
    
    def __str__(self):
        return f"自审计报告 - {self.get_report_type_display()} ({self.period_start} ~ {self.period_end})"
    
    def calculate_scores(self):
        """计算各项评分"""
        # 性能评分：基于漂移次数扣分
        if self.performance_drifts > 0:
            penalty = min(self.performance_drifts * 2 + self.critical_drifts * 5, 40)
            self.performance_score = max(100 - penalty, 0)
        
        # 安全评分：基于权限异常扣分
        if self.permission_anomalies > 0:
            penalty = min(self.permission_anomalies * 10, 50)
            self.security_score = max(100 - penalty, 0)
        
        # 合规评分：基于废弃规则扣分
        if self.deprecated_rules > 0:
            penalty = min(self.deprecated_rules * 5, 30)
            self.compliance_score = max(100 - penalty, 0)
        
        # 整体健康度：加权平均
        self.overall_health_score = (
            self.performance_score * 0.4 +
            self.security_score * 0.3 +
            self.compliance_score * 0.3
        )
        
        return {
            'overall': self.overall_health_score,
            'security': self.security_score,
            'performance': self.performance_score,
            'compliance': self.compliance_score,
        }