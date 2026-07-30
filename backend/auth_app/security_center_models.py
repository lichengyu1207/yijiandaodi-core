from django.db import models
from django.conf import settings


class SecurityScore(models.Model):
    """安全评分记录"""
    SCORE_LEVELS = [
        ('excellent', '优秀'),
        ('good', '良好'),
        ('warning', '警告'),
        ('danger', '危险'),
        ('critical', '严重'),
    ]

    total_score = models.IntegerField(default=100, verbose_name='总分')
    level = models.CharField(max_length=20, choices=SCORE_LEVELS, default='good', verbose_name='等级')
    vulnerability_score = models.IntegerField(default=0, verbose_name='漏洞扣分')
    risk_score = models.IntegerField(default=0, verbose_name='风险扣分')
    audit_score = models.IntegerField(default=0, verbose_name='审计扣分')

    open_vulns = models.IntegerField(default=0, verbose_name='未修复漏洞数')
    critical_vulns = models.IntegerField(default=0, verbose_name='严重漏洞数')
    high_risk_events = models.IntegerField(default=0, verbose_name='高风险事件数')
    blocked_content = models.IntegerField(default=0, verbose_name='拦截内容数')
    failed_tests = models.IntegerField(default=0, verbose_name='失败测试数')

    details = models.JSONField(default=dict, blank=True, verbose_name='详细评分项')
    scored_at = models.DateTimeField(auto_now_add=True, verbose_name='评分时间')

    class Meta:
        db_table = 'security_score'
        verbose_name = '安全评分'
        verbose_name_plural = '安全评分'
        ordering = ['-scored_at']

    def __str__(self):
        return f'[{self.get_level_display()}] {self.total_score}分 - {self.scored_at.strftime("%Y-%m-%d %H:%M")}'


class SecurityAlert(models.Model):
    """安全告警"""
    SEVERITY_CHOICES = [
        ('info', '信息'),
        ('low', '低'),
        ('medium', '中'),
        ('high', '高'),
        ('critical', '严重'),
    ]
    STATUS_CHOICES = [
        ('active', '活跃'),
        ('acknowledged', '已确认'),
        ('resolved', '已解决'),
        ('suppressed', '已抑制'),
    ]
    CATEGORY_CHOICES = [
        ('vulnerability', '漏洞告警'),
        ('risk_event', '风险事件'),
        ('audit_anomaly', '审计异常'),
        ('content_violation', '内容违规'),
        ('system', '系统告警'),
        ('permission', '权限异常'),
    ]

    title = models.CharField(max_length=300, verbose_name='告警标题')
    description = models.TextField(blank=True, default='', verbose_name='描述')
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES, db_index=True, verbose_name='分类')
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default='medium', db_index=True, verbose_name='严重程度')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active', db_index=True, verbose_name='状态')

    source_type = models.CharField(max_length=50, default='', verbose_name='来源类型')
    source_id = models.IntegerField(null=True, blank=True, verbose_name='来源ID')
    source_detail = models.JSONField(default=dict, blank=True, verbose_name='来源详情')

    assignee_id = models.IntegerField(null=True, blank=True, verbose_name='处理人ID')
    assignee_name = models.CharField(max_length=100, blank=True, default='', verbose_name='处理人姓名')
    resolved_by = models.IntegerField(null=True, blank=True, verbose_name='解决人ID')
    resolved_at = models.DateTimeField(null=True, blank=True, verbose_name='解决时间')
    resolution_note = models.TextField(blank=True, default='', verbose_name='解决备注')

    triggered_at = models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='触发时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'security_alert'
        verbose_name = '安全告警'
        verbose_name_plural = '安全告警'
        ordering = ['-triggered_at']
        indexes = [
            models.Index(fields=['severity'], name='idx_alert_severity'),
            models.Index(fields=['status'], name='idx_alert_status'),
            models.Index(fields=['category'], name='idx_alert_category'),
            models.Index(fields=['-triggered_at'], name='idx_alert_triggered'),
        ]

    def __str__(self):
        return f'[{self.get_severity_display()}] {self.title}'


class SecurityReport(models.Model):
    """安全报表"""
    REPORT_TYPE_CHOICES = [
        ('daily', '日报'),
        ('weekly', '周报'),
        ('monthly', '月报'),
        ('custom', '自定义'),
    ]
    STATUS_CHOICES = [
        ('generating', '生成中'),
        ('completed', '已完成'),
        ('failed', '失败'),
    ]

    report_type = models.CharField(max_length=20, choices=REPORT_TYPE_CHOICES, verbose_name='报表类型')
    title = models.CharField(max_length=300, verbose_name='报表标题')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='generating', verbose_name='状态')

    period_start = models.DateField(verbose_name='周期开始')
    period_end = models.DateField(verbose_name='周期结束')

    summary = models.JSONField(default=dict, blank=True, verbose_name='摘要数据')
    detail_data = models.JSONField(default=dict, blank=True, verbose_name='详细数据')
    file_path = models.FilePathField(null=True, blank=True, max_length=500, verbose_name='文件路径')

    created_by = models.IntegerField(null=True, blank=True, verbose_name='创建人ID')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'security_report'
        verbose_name = '安全报表'
        verbose_name_plural = '安全报表'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.title} ({self.get_report_type_display()})'
