from django.db import models
from django.conf import settings


class SecurityTestCase(models.Model):
    """安全测试用例"""
    CATEGORY_CHOICES = [
        ('prompt_injection', '提示词注入'),
        ('sensitive_content', '敏感内容'),
        ('tool_abuse', '工具滥用'),
        ('data_leakage', '数据泄露'),
        ('rate_limit', '频率限制'),
        ('output_filter', '输出过滤'),
    ]

    STATUS_CHOICES = [
        ('active', '活跃'),
        ('deprecated', '已废弃'),
        ('draft', '草稿'),
    ]

    name = models.CharField(max_length=200, verbose_name='用例名称')
    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES, verbose_name='分类')
    description = models.TextField(blank=True, default='', verbose_name='描述')

    input_payload = models.TextField(verbose_name='测试输入')
    expected_risk_level = models.CharField(max_length=20, default='high', verbose_name='预期风险等级')
    expected_action = models.CharField(max_length=20, default='block', verbose_name='期望动作')
    expected_pattern = models.CharField(max_length=500, blank=True, default='', verbose_name='应匹配的模式')

    severity = models.CharField(max_length=20, default='high', verbose_name='严重程度')
    tags = models.JSONField(default=list, blank=True, verbose_name='标签')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active', verbose_name='状态')
    sort_order = models.IntegerField(default=0, verbose_name='排序')

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'security_test_case'
        verbose_name = '安全测试用例'
        verbose_name_plural = '安全测试用例'
        ordering = ['sort_order', 'id']
        indexes = [
            models.Index(fields=['category'], name='idx_test_case_category'),
            models.Index(fields=['status'], name='idx_test_case_status'),
            models.Index(fields=['severity'], name='idx_test_case_severity'),
        ]

    def __str__(self):
        return f'[{self.get_category_display()}] {self.name}'


class SecurityVulnerability(models.Model):
    """安全漏洞记录"""
    SEVERITY_CHOICES = [
        ('low', '低'),
        ('medium', '中'),
        ('high', '高'),
        ('critical', '严重'),
    ]
    STATUS_CHOICES = [
        ('open', '待修复'),
        ('in_progress', '修复中'),
        ('fixed', '已修复'),
        ('wontfix', '不修复'),
        ('false_positive', '误报'),
    ]

    SEVERITY_RANK = {'low': 1, 'medium': 2, 'high': 3, 'critical': 4}

    title = models.CharField(max_length=300, verbose_name='漏洞标题')
    description = models.TextField(blank=True, default='', verbose_name='描述')
    category = models.CharField(max_length=50, verbose_name='分类')
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default='high', verbose_name='严重程度')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open', verbose_name='状态')

    related_rule_id = models.IntegerField(null=True, blank=True, verbose_name='关联规则ID')
    related_test_case_id = models.IntegerField(null=True, blank=True, verbose_name='关联测试用例ID')

    detected_input = models.TextField(blank=True, default='', verbose_name='触发输入')
    matched_pattern = models.CharField(max_length=500, blank=True, default='', verbose_name='匹配模式')

    fix_description = models.TextField(blank=True, default='', verbose_name='修复方案')
    fixed_by = models.IntegerField(null=True, blank=True, verbose_name='修复人ID')
    fixed_at = models.DateTimeField(null=True, blank=True, verbose_name='修复时间')

    created_by = models.IntegerField(null=True, blank=True, verbose_name='发现人ID')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'security_vulnerability'
        verbose_name = '安全漏洞'
        verbose_name_plural = '安全漏洞'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status'], name='idx_vuln_status'),
            models.Index(fields=['severity'], name='idx_vuln_severity'),
            models.Index(fields=['category'], name='idx_vuln_category'),
            models.Index(fields=['-created_at'], name='idx_vuln_created'),
        ]

    def __str__(self):
        return f'[{self.get_severity_display()}] {self.title}'

    @property
    def severity_rank(self):
        return self.SEVERITY_RANK.get(self.severity, 0)
