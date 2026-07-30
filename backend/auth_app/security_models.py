from django.db import models
from django.conf import settings


class AgentSecurityRule(models.Model):
    RULE_TYPE_CHOICES = [
        ('prompt_injection', '提示词注入检测'),
        ('sensitive_content', '敏感内容过滤'),
        ('tool_permission', '工具调用权限'),
        ('rate_limit', '频率限制'),
        ('input_length', '输入长度限制'),
        ('output_filter', '输出内容过滤'),
    ]

    SEVERITY_CHOICES = [
        ('low', '低风险'),
        ('medium', '中风险'),
        ('high', '高风险'),
        ('critical', '严重风险'),
    ]

    ACTION_CHOICES = [
        ('block', '拦截并拒绝'),
        ('warn', '警告但放行'),
        ('mask', '脱敏处理'),
        ('log_only', '仅记录日志'),
    ]

    STATUS_CHOICES = [
        ('enabled', '启用'),
        ('disabled', '禁用'),
    ]

    name = models.CharField(max_length=200, verbose_name='规则名称')
    rule_type = models.CharField(max_length=50, choices=RULE_TYPE_CHOICES, verbose_name='规则类型')
    description = models.TextField(blank=True, default='', verbose_name='规则描述')

    pattern = models.TextField(verbose_name='匹配模式/关键词')
    pattern_type = models.CharField(
        max_length=20,
        default='keyword',
        choices=[
            ('keyword', '关键词匹配'),
            ('regex', '正则表达式'),
            ('ml_model', 'ML模型检测'),
        ],
        verbose_name='模式类型'
    )

    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default='high', verbose_name='风险等级')
    action = models.CharField(max_length=20, choices=ACTION_CHOICES, default='block', verbose_name='处理动作')

    is_enabled = models.BooleanField(default=True, verbose_name='是否启用')
    priority = models.IntegerField(default=100, verbose_name='优先级（数字越小越优先）')

    target_roles = models.JSONField(default=list, blank=True, verbose_name='适用角色ID列表')
    exclude_users = models.JSONField(default=list, blank=True, verbose_name='排除用户ID列表')

    metadata = models.JSONField(default=dict, blank=True, verbose_name='扩展配置')

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    created_by = models.IntegerField(default=0, verbose_name='创建人ID')

    class Meta:
        db_table = 'agent_security_rule'
        verbose_name = 'Agent安全规则'
        verbose_name_plural = 'Agent安全规则'
        ordering=['priority', '-created_at']
        indexes = [
            models.Index(fields=['rule_type'], name='idx_security_rule_type'),
            models.Index(fields=['is_enabled'], name='idx_security_enabled'),
            models.Index(fields=['severity'], name='idx_security_severity'),
        ]

    def __str__(self):
        return f'{self.get_rule_type_display()}: {self.name}'


class AgentRiskLog(models.Model):
    RISK_LEVEL_CHOICES = [
        ('info', '信息'),
        ('low', '低风险'),
        ('medium', '中风险'),
        ('high', '高风险'),
        ('critical', '严重'),
    ]

    STATUS_CHOICES = [
        ('blocked', '已拦截'),
        ('warned', '已警告'),
        ('passed', '已放行'),
        ('masked', '已脱敏'),
    ]

    session_id = models.CharField(max_length=100, blank=True, default='', db_index=True, verbose_name='会话ID')
    user_id = models.IntegerField(default=0, db_index=True, verbose_name='用户ID')
    agent_role = models.CharField(max_length=50, blank=True, default='', verbose_name='Agent角色')

    rule = models.ForeignKey(AgentSecurityRule, on_delete=models.SET_NULL, null=True, blank=True, related_name='risk_logs', verbose_name='触发的规则')

    risk_level = models.CharField(max_length=20, choices=RISK_LEVEL_CHOICES, default='medium', verbose_name='风险等级')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='blocked', verbose_name='处理状态')

    input_content = models.TextField(blank=True, default='', verbose_name='输入内容（截断）')
    detected_pattern = models.CharField(max_length=500, blank=True, default='', verbose_name='检测到的模式')
    action_taken = models.CharField(max_length=20, default='block', verbose_name='执行的动作')

    ip_address = models.GenericIPAddressField(default='', verbose_name='IP地址')
    user_agent = models.TextField(blank=True, default='', verbose_name='User-Agent')

    response_message = models.TextField(blank=True, default='', verbose_name='响应消息')
    processing_time_ms = models.IntegerField(default=0, verbose_name='处理耗时(ms)')

    created_at = models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='创建时间')

    class Meta:
        db_table = 'agent_risk_log'
        verbose_name = 'Agent风控日志'
        verbose_name_plural = 'Agent风控日志'
        ordering=['-created_at']
        indexes = [
            models.Index(fields=['user_id', '-created_at'], name='idx_risk_user_time'),
            models.Index(fields=['risk_level'], name='idx_risk_level'),
            models.Index(fields=['status'], name='idx_risk_status'),
            models.Index(fields=['-created_at'], name='idx_risk_created'),
        ]

    def __str__(self):
        return f'[{self.get_risk_level_display()}] {self.detected_pattern or "N/A"} - {self.created_at}'
