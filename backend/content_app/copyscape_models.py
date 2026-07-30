import uuid
from django.db import models
from django.conf import settings


class PlagiarismScan(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True)

    original_text = models.TextField(verbose_name='待检测文本')
    text_hash = models.CharField(max_length=64, verbose_name='文本哈希(SHA256)', unique=True)

    content_type = models.CharField(max_length=30, verbose_name='内容类型', choices=[
        ('marketing_copy', '营销文案'),
        ('product_description', '产品描述'),
        ('ad_slogan', '广告标语'),
        ('brand_story', '品牌故事'),
        ('landing_page', '落地页文案'),
        ('social_media', '社交媒体文案'),
        ('email_copy', '邮件营销'),
        ('press_release', '新闻通稿'),
        ('blog_article', '博客文章'),
        ('academic_paper', '学术论文'),
        ('general_content', '通用内容'),
    ], default='general_content')

    overall_similarity = models.FloatField(default=0.0, verbose_name='整体相似度(0-100)')
    unique_score = models.FloatField(default=100.0, verbose_name='原创度(0-100)')
    plagiarism_risk = models.CharField(max_length=20, verbose_name='抄袭风险等级', choices=[
        ('low', '低风险'),
        ('medium', '中等风险'),
        ('high', '高风险'),
        ('critical', '严重风险'),
    ], default='low')

    match_count = models.IntegerField(default=0, verbose_name='匹配源数量')
    total_sources = models.IntegerField(default=0, verbose_name='检索到的总源数')
    exact_matches = models.IntegerField(default=0, verbose_name='完全匹配数')
    near_duplicates = models.IntegerField(default=0, verbose_name='近似重复数')
    paraphrased = models.IntegerField(default=0, verbose_name='改写匹配数')

    plagiarism_breakdown = models.JSONField(default=dict, verbose_name='抄袭类型分布')
    platform_distribution = models.JSONField(default=dict, verbose_name='平台分布')

    sentence_analyses = models.JSONField(default=list, verbose_name='逐句分析结果')

    executive_summary = models.TextField(blank=True, verbose_name='执行摘要')
    detailed_report = models.TextField(blank=True, verbose_name='详细报告')
    improvement_suggestions = models.JSONField(default=list, verbose_name='改进建议')

    scan_metadata = models.JSONField(default=dict, verbose_name='扫描元数据')
    processing_time_ms = models.IntegerField(default=0, verbose_name='处理耗时(ms)')

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'plagiarism_scan'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['text_hash']),
            models.Index(fields=['content_type']),
            models.Index(fields=['overall_similarity']),
            models.Index(fields=['plagiarism_risk']),
            models.Index(fields=['-created_at']),
            models.Index(fields=['match_count']),
        ]

    def __str__(self):
        return f'抄袭检测 #{str(self.id)[:8]} ({self.get_content_type_display()})'


class MatchSource(models.Model):
    scan = models.ForeignKey(PlagiarismScan, on_delete=models.CASCADE, related_name='match_sources')

    source_url = models.URLField(max_length=500, verbose_name='来源URL')
    source_title = models.CharField(max_length=300, verbose_name='来源标题', blank=True)
    domain = models.CharField(max_length=200, verbose_name='域名')
    platform_type = models.CharField(max_length=30, verbose_name='平台类型', choices=[
        ('website', '网站'),
        ('ecommerce', '电商平台'),
        ('social_media', '社交媒体'),
        ('news', '新闻媒体'),
        ('blog', '博客'),
        ('forum', '论坛'),
        ('document', '文档库'),
        ('unknown', '未知'),
    ], default='website')

    similarity_percent = models.FloatField(default=0.0, verbose_name='相似度百分比')
    matched_words = models.IntegerField(default=0, verbose_name='匹配字数')
    total_words = models.IntegerField(default=0, verbose_name='总字数')

    match_type = models.CharField(max_length=25, verbose_name='匹配类型', choices=[
        ('exact_copy', '完全复制'),
        ('minor_edits', '轻微修改'),
        ('restructured', '结构调整'),
        ('paraphrased', '改写重述'),
        ('translated', '翻译复制'),
        ('ai_rewritten', 'AI改写'),
        ('fragment_match', '片段匹配'),
    ], default='exact_copy')

    confidence = models.FloatField(default=0.0, verbose_name='置信度(0-1)')

    matched_snippets = models.JSONField(default=list, verbose_name='匹配片段列表')
    source_excerpt = models.TextField(blank=True, verbose_name='来源摘要')
    context_before = models.TextField(blank=True, verbose_name='上下文前文')
    context_after = models.TextField(blank=True, verbose_name='上下文后文')

    publish_date = models.DateTimeField(null=True, blank=True, verbose_name='发布时间')
    last_crawled = models.DateTimeField(null=True, blank=True, verbose_name='最后爬取时间')
    page_authority = models.FloatField(default=0.0, verbose_name='页面权重(0-100)')

    is_verified = models.BooleanField(default=False, verbose_name='是否已验证')
    verification_status = models.CharField(max_length=25, verbose_name='验证状态', choices=[
        ('pending', '待验证'),
        ('verified_confirmed', '已确认'),
        ('verified_false_positive', '误报'),
        ('error', '验证失败'),
    ], default='pending')

    risk_level = models.CharField(max_length=10, verbose_name='风险级别', choices=[
        ('info', '信息'),
        ('low', '低'),
        ('medium', '中'),
        ('high', '高'),
        ('critical', '严重'),
    ], default='info')

    notes = models.TextField(blank=True, verbose_name='备注')

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='发现时间')

    class Meta:
        db_table = 'match_source'
        ordering = ['-similarity_percent']
        indexes = [
            models.Index(fields=['scan']),
            models.Index(fields=['domain']),
            models.Index(fields=['platform_type']),
            models.Index(fields=['-similarity_percent']),
            models.Index(fields=['match_type']),
            models.Index(fields=['risk_level']),
        ]

    def __str__(self):
        return f'{self.domain} ({self.similarity_percent:.1f}%)'
