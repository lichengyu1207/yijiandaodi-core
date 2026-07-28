from django.db import models
from django.conf import settings
import uuid
import hashlib


class DualEngineScan(models.Model):
    STATUS_CHOICES = [
        ('queued', '排队中'),
        ('analyzing_sentences', '逐句分析中'),
        ('ai_engine_running', 'AI检测引擎运行中'),
        ('plagiarism_engine_running', '抄袭引擎运行中'),
        ('fusing_results', '融合评分中'),
        ('completed', '已完成'),
        ('partial', '部分完成'),
        ('failed', '检测失败'),
    ]
    VERDICT_CHOICES = [
        ('human_written', '人工撰写'),
        ('ai_generated', 'AI生成'),
        ('mixed_content', '混合内容(人+AI)'),
        ('plagiarized', '抄袭内容'),
        ('ai_plus_plagiarism', 'AI生成+抄袭'),
        ('inconclusive', '无法判定'),
    ]
    CONFIDENCE_CHOICES = [
        ('very_high', '极高置信度(>95%)'),
        ('high', '高置信度(85-95%)'),
        ('medium', '中等置信度(70-84%)'),
        ('low', '低置信度(<70%)'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='dual_engine_scans', verbose_name='提交用户'
    )

    original_text = models.TextField(verbose_name='原始文本')
    text_preview = models.TextField(blank=True, default='', verbose_name='文本预览(前500字符)')
    word_count = models.PositiveIntegerField(default=0, verbose_name='字数')
    sentence_count = models.PositiveIntegerField(default=0, verbose_name='句子数')
    paragraph_count = models.PositiveIntegerField(default=0, verbose_name='段落数')

    file_name = models.CharField(max_length=255, blank=True, default='', verbose_name='文件名')
    file_size = models.PositiveIntegerField(default=0, verbose_name='文件大小(bytes)')
    file_hash_sha256 = models.CharField(max_length=64, blank=True, default='', verbose_name='SHA256哈希')
    content_language = models.CharField(max_length=10, default='zh', verbose_name='语言')
    detected_language_confidence = models.FloatField(default=0, verbose_name='语言检测置信度')

    ai_score = models.FloatField(default=0, verbose_name='AI生成概率得分(0-100)')
    plagiarism_score = models.FloatField(default=0, verbose_name='抄袭相似度得分(0-100)')
    originality_score = models.FloatField(default=100, verbose_name='原创性综合得分(0-100) [核心指标]')

    human_written_percent = models.FloatField(default=100, verbose_name='人工撰写占比%')
    ai_generated_percent = models.FloatField(default=0, verbose_name='AI生成占比%')
    mixed_content_percent = models.FloatField(default=0, verbose_name='混合内容占比%')
    plagiarized_percent = models.FloatField(default=0, verbose_name='抄袭内容占比%')

    overall_verdict = models.CharField(max_length=24, choices=VERDICT_CHOICES, default='human_written', verbose_name='综合判定')
    confidence_level = models.CharField(max_length=12, choices=CONFIDENCE_CHOICES, default='medium', verbose_name='检测置信度')
    confidence_value = models.FloatField(default=0, verbose_name='置信度数值(0-1)')

    ai_model_detected = models.CharField(max_length=50, blank=True, default='', verbose_name='推测AI模型(GPT-4/Claude/Gemini等)')
    ai_model_confidence = models.FloatField(default=0, verbose_name='AI模型识别置信度(0-1)')

    reading_ease_score = models.FloatField(default=0, verbose_name='可读性评分(Flesch-Kincaid风格)')
    avg_sentence_length = models.FloatField(default=0, verbose_name='平均句长')
    vocab_richness = models.FloatField(default=0, verbose_name='词汇丰富度(TTR)')
    style_consistency = models.FloatField(default=0, verbose_name='风格一致性(0-1)')

    sentence_analyses = models.JSONField(default=list, verbose_name='逐句分析结果(JSON数组)')
    source_matches = models.JSONField(default=list, verbose_name='抄袭来源匹配列表')
    ai_indicators = models.JSONField(default=dict, verbose_name='AI特征指标详情')
    plagiarism_indicators = models.JSONField(default=dict, verbose_name='抄袭特征指标详情')

    detailed_report = models.TextField(blank=True, default='', verbose_name='详细检测报告')
    executive_summary = models.TextField(blank=True, default='', verbose_name='执行摘要(一页纸)')

    status = models.CharField(max_length=26, choices=STATUS_CHOICES, default='queued', verbose_name='状态')
    processing_time_ms = models.PositiveIntegerField(default=0, verbose_name='总处理耗时(ms)')
    ai_engine_time_ms = models.PositiveIntegerField(default=0, verbose_name='AI引擎耗时(ms)')
    plagiarism_engine_time_ms = models.PositiveIntegerField(default=0, verbose_name='抄袭引擎耗时(ms)')

    tags = models.JSONField(default=list, verbose_name='自动标签')
    metadata = models.JSONField(default=dict, verbose_name='扩展元数据')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'dual_engine_scan'
        verbose_name = '双引擎检测(AI+抄袭)'
        verbose_name_plural = '双引擎检测(AI+抄袭)'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at'], name='idx_dual_user_time'),
            models.Index(fields=['status'], name='idx_dual_status'),
            models.Index(fields=['overall_verdict'], name='idx_dual_verdict'),
            models.Index(fields=['originality_score'], name='idx_dual_originality'),
            models.Index(fields=['-ai_score'], name='idx_dual_ai_score'),
            models.Index(fields=['-plagiarism_score'], name='idx_dual_plagiarism'),
            models.Index(fields=['file_hash_sha256'], name='idx_dual_hash'),
            models.Index(fields=['confidence_level'], name='idx_dual_confidence'),
        ]

    def __str__(self):
        return f'双引擎检测-{self.overall_verdict}-原创{self.originality_score:.0f}%-{self.id.hex[:8]}'
