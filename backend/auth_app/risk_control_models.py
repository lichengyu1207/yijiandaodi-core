import re
from django.db import models
from django.conf import settings


class RegexRule(models.Model):
    """正则规则表"""
    CATEGORY_CHOICES = [
        ('sensitive_word', '敏感词'),
        ('spam', '垃圾广告'),
        ('political', '政治敏感'),
        ('pornography', '色情低俗'),
        ('violence', '暴力恐吓'),
        ('personal_info', '个人信息'),
    ]
    SEVERITY_CHOICES = [
        ('low', '低风险'),
        ('medium', '中风险'),
        ('high', '高风险'),
        ('critical', '严重'),
    ]
    ACTION_CHOICES = [
        ('warn', '警告'),
        ('block', '拦截'),
        ('replace', '替换'),
        ('review', '人工审核'),
    ]

    name = models.CharField(max_length=200, verbose_name='规则名称')
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES, db_index=True, verbose_name='分类')
    pattern = models.TextField(verbose_name='正则表达式')
    description = models.TextField(blank=True, default='', verbose_name='规则描述')
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default='medium', verbose_name='风险等级')
    action = models.CharField(max_length=20, choices=ACTION_CHOICES, default='warn', verbose_name='处置动作')
    replacement = models.CharField(max_length=500, blank=True, default='', verbose_name='替换文本')
    is_enabled = models.BooleanField(default=True, db_index=True, verbose_name='是否启用')
    match_count = models.IntegerField(default=0, verbose_name='匹配次数')
    false_positive_count = models.IntegerField(default=0, verbose_name='误报次数')
    tags = models.JSONField(default=list, blank=True, verbose_name='标签')
    sort_order = models.IntegerField(default=0, verbose_name='排序')
    created_by = models.IntegerField(null=True, blank=True, verbose_name='创建人ID')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'regex_rule'
        verbose_name = '正则规则'
        verbose_name_plural = '正则规则'
        ordering = ['sort_order', 'id']
        indexes = [
            models.Index(fields=['category'], name='idx_rule_category'),
            models.Index(fields=['is_enabled'], name='idx_rule_enabled'),
            models.Index(fields=['severity'], name='idx_rule_severity'),
            models.Index(fields=['-match_count'], name='idx_rule_match_count'),
        ]

    def __str__(self):
        return f'[{self.get_category_display()}] {self.name}'

    def test_pattern(self, text: str) -> dict:
        """测试正则表达式是否有效并能匹配文本"""
        try:
            compiled = re.compile(self.pattern)
            matches = compiled.findall(text)
            matched_text = compiled.search(text)
            return {
                'valid': True,
                'matched': len(matches) > 0,
                'match_count': len(matches),
                'matches': matches[:20],
                'matched_text': matched_text.group() if matched_text else '',
                'position': matched_text.span() if matched_text else None,
            }
        except re.error as e:
            return {
                'valid': False,
                'error': str(e),
                'matched': False,
                'match_count': 0,
                'matches': [],
                'matched_text': '',
                'position': None,
            }


class ContentAuditLog(models.Model):
    """内容审核日志"""
    ACTION_CHOICES = [
        ('check', '内容检测'),
        ('block', '拦截'),
        ('pass', '放行'),
        ('manual_review', '转人工审核'),
    ]
    RESULT_CHOICES = [
        ('passed', '通过'),
        ('blocked', '已拦截'),
        ('warning', '警告'),
        ('pending', '待审核'),
    ]

    content = models.TextField(verbose_name='原始内容')
    content_hash = models.CharField(max_length=64, blank=True, default='', db_index=True, verbose_name='内容哈希')
    source = models.CharField(max_length=50, default='web', verbose_name='来源')
    user_id = models.IntegerField(null=True, blank=True, verbose_name='用户ID')
    username = models.CharField(max_length=100, blank=True, default='', verbose_name='用户名')
    ip_address = models.GenericIPAddressField(null=True, blank=True, verbose_name='IP地址')

    result = models.CharField(max_length=20, choices=RESULT_CHOICES, default='passed', verbose_name='检测结果')
    risk_level = models.CharField(max_length=20, default='low', verbose_name='风险等级')
    total_matches = models.IntegerField(default=0, verbose_name='匹配总数')
    matched_rules = models.JSONField(default=list, blank=True, verbose_name='命中规则详情')
    action_taken = models.CharField(max_length=30, choices=ACTION_CHOICES, default='check', verbose_name='执行动作')

    processing_time_ms = models.IntegerField(default=0, verbose_name='处理耗时(ms)')
    error_message = models.TextField(blank=True, default='', verbose_name='错误信息')

    created_at = models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='创建时间')

    class Meta:
        db_table = 'content_audit_log'
        verbose_name = '内容审核日志'
        verbose_name_plural = '内容审核日志'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['result'], name='idx_audit_result'),
            models.Index(fields=['risk_level'], name='idx_audit_risk'),
            models.Index(fields=['source'], name='idx_audit_source'),
            models.Index(fields=['-created_at'], name='idx_audit_created'),
            models.Index(fields=['user_id'], name='idx_audit_user'),
        ]

    def __str__(self):
        return f'[{self.get_result_display()}] {self.content[:50]}'


class RegexTestCase(models.Model):
    """正则测试用例"""
    STATUS_CHOICES = [
        ('active', '活跃'),
        ('inactive', '停用'),
    ]

    rule = models.ForeignKey(RegexRule, on_delete=models.CASCADE, related_name='test_cases', null=True, blank=True, verbose_name='关联规则')
    test_text = models.TextField(verbose_name='测试文本')
    expected_match = models.BooleanField(default=True, verbose_name='预期是否匹配')
    expected_hits = models.IntegerField(default=1, verbose_name='预期命中次数')
    actual_match = models.BooleanField(null=True, blank=True, verbose_name='实际是否匹配')
    actual_hits = models.IntegerField(null=True, blank=True, verbose_name='实际命中次数')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active', verbose_name='状态')
    notes = models.TextField(blank=True, default='', verbose_name='备注')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'regex_test_case'
        verbose_name = '正则测试用例'
        verbose_name_plural = '正则测试用例'
        ordering = ['-created_at']

    def __str__(self):
        return f'测试用例#{self.id}: {self.test_text[:30]}'
