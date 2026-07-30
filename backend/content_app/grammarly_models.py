import uuid
from django.db import models
from django.conf import settings


class GrammarCheck(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True)

    original_text = models.TextField(verbose_name='原始文本')
    corrected_text = models.TextField(verbose_name='纠正后文本', blank=True)
    text_hash = models.CharField(max_length=64, verbose_name='文本哈希(SHA256)', unique=True)

    content_type = models.CharField(max_length=30, verbose_name='内容类型', choices=[
        ('marketing_copy', '营销文案'),
        ('product_description', '产品描述'),
        ('ad_slogan', '广告标语'),
        ('email_copy', '邮件营销'),
        ('social_media', '社交媒体文案'),
        ('landing_page', '落地页文案'),
        ('press_release', '新闻通稿'),
        ('blog_article', '博客文章'),
        ('academic_paper', '学术论文'),
        ('business_report', '商务报告'),
        ('general_content', '通用内容'),
    ], default='general_content')

    overall_score = models.IntegerField(default=0, verbose_name='综合得分(0-100)')
    correctness_score = models.IntegerField(default=0, verbose_name='正确性得分(0-100)')
    clarity_score = models.IntegerField(default=0, verbose_name='清晰度得分(0-100)')
    engagement_score = models.IntegerField(default=0, verbose_name='吸引力得分(0-100)')
    delivery_score = models.IntegerField(default=0, verbose_name='表达力得分(0-100)')

    total_issues = models.IntegerField(default=0, verbose_name='问题总数')
    critical_count = models.IntegerField(default=0, verbose_name='严重问题数')
    warning_count = models.IntegerField(default=0, verbose_name='警告数')
    suggestion_count = models.IntegerField(default=0, verbose_name='优化建议数')

    issue_categories = models.JSONField(default=dict, verbose_name='问题分类统计')

    readability_metrics = models.JSONField(default=dict, verbose_name='可读性指标')
    tone_analysis = models.JSONField(default=dict, verbose_name='语气分析')
    style_suggestions = models.JSONField(default=list, verbose_name='文风优化建议')

    executive_summary = models.TextField(blank=True, verbose_name='执行摘要')
    improvement_roadmap = models.JSONField(default=list, verbose_name='改进路线图')

    processing_time_ms = models.IntegerField(default=0, verbose_name='处理耗时(ms)')

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'grammar_check'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['text_hash']),
            models.Index(fields=['content_type']),
            models.Index(fields=['overall_score']),
            models.Index(fields=['-created_at']),
            models.Index(fields=['total_issues']),
        ]

    def __str__(self):
        return f'语法检查 #{str(self.id)[:8]} (得分:{self.overall_score})'


class CorrectionSuggestion(models.Model):
    grammar_check = models.ForeignKey(GrammarCheck, on_delete=models.CASCADE, related_name='suggestions')

    suggestion_type = models.CharField(max_length=25, verbose_name='建议类型', choices=[
        ('spelling', '拼写错误'),
        ('grammar', '语法错误'),
        ('punctuation', '标点符号'),
        ('style', '文风问题'),
        ('clarity', '清晰度'),
        ('conciseness', '简洁性'),
        ('vocabulary', '词汇选择'),
        ('tone', '语气调整'),
        ('engagement', '吸引力增强'),
        ('delivery', '表达优化'),
        ('formatting', '格式规范'),
        ('consistency', '一致性'),
    ], default='grammar')

    severity = models.CharField(max_length=10, verbose_name='严重程度', choices=[
        ('critical', '严重'),
        ('warning', '警告'),
        ('info', '提示'),
        ('suggestion', '建议'),
    ], default='warning')

    category = models.CharField(max_length=30, verbose_name='问题分类')

    original_text = models.TextField(verbose_name='原文片段')
    corrected_text = models.TextField(verbose_name='修正后文本', blank='')
    replacement_options = models.JSONField(default=list, verbose_name='替换选项列表')

    start_position = models.IntegerField(default=0, verbose_name='起始位置')
    end_position = models.IntegerField(default=0, verbose_name='结束位置')
    context_before = models.TextField(blank=True, verbose_name='前文上下文')
    context_after = models.TextField(blank=True, verbose_name='后文上下文')

    explanation = models.TextField(verbose_name='解释说明', blank='')
    rule_reference = models.CharField(max_length=200, verbose_name='规则引用', blank='')
    examples = models.JSONField(default=list, verbose_name='示例列表')

    confidence = models.FloatField(default=0.0, verbose_name='置信度(0-1)')
    is_accepted = models.BooleanField(null=True, verbose_name='是否接受(null=待处理)')

    impact_score = models.IntegerField(default=0, verbose_name='影响分(1-10)')

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'correction_suggestion'
        ordering = ['-impact_score', '-confidence']
        indexes = [
            models.Index(fields=['grammar_check']),
            models.Index(fields=['suggestion_type']),
            models.Index(fields=['severity']),
            models.Index(fields=['category']),
            models.Index(fields=['-impact_score']),
        ]

    def __str__(self):
        return f'{self.get_suggestion_type_display()}: {self.original_text[:30]}...'
