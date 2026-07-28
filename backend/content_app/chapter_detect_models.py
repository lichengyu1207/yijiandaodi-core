from django.db import models
from django.conf import settings
import uuid
import hashlib


class PaperSubmission(models.Model):
    PAPER_TYPE_CHOICES = [
        ('undergraduate_thesis', '本科毕业论文'),
        ('master_thesis', '硕士学位论文'),
        ('doctoral_dissertation', '博士学位论文'),
        ('journal_article', '期刊论文'),
        ('conference_paper', '会议论文'),
        ('course_paper', '课程论文'),
        ('research_report', '研究报告'),
        ('other', '其他'),
    ]
    SUBJECT_AREA_CHOICES = [
        ('cs', '计算机科学'), ('ee', '电子工程'), ('math', '数学'),
        ('physics', '物理学'), ('chemistry', '化学'), ('biology', '生物学'),
        ('medicine', '医学'), ('economics', '经济学'), ('management', '管理学'),
        ('law', '法学'), ('literature', '文学'), ('history', '历史学'),
        ('philosophy', '哲学'), ('education', '教育学'), ('psychology', '心理学'),
        ('sociology', '社会学'), ('engineering', '工程学'), ('environmental', '环境科学'),
        ('art', '艺术学'), ('other', '其他'),
    ]
    STATUS_CHOICES = [
        ('uploaded', '已上传'),
        ('parsing_structure', '解析结构中'),
        ('analyzing_chapters', '逐章分析中'),
        ('completed', '检测完成'),
        ('partial', '部分完成'),
        ('failed', '检测失败'),
    ]
    VERDICT_CHOICES = [
        ('original', '原创通过'),
        ('minor_issues', '轻微问题(可修改后通过)'),
        ('moderate_risk', '中等风险(需大幅修改)'),
        ('high_risk', '高风险(建议重写)'),
        ('ai_generated_suspected', '疑似AI生成'),
        ('plagiarism_detected', '抄袭检测阳性'),
        ('mixed_violation', '混合违规(AI+抄袭)'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='paper_submissions', verbose_name='提交用户'
    )

    title = models.CharField(max_length=300, verbose_name='论文标题')
    author_name = models.CharField(max_length=100, blank=True, default='', verbose_name='作者姓名')
    institution = models.CharField(max_length=200, blank=True, default='', verbose_name='所属机构')
    paper_type = models.CharField(max_length=24, choices=PAPER_TYPE_CHOICES, default='course_paper', verbose_name='论文类型')
    subject_area = models.CharField(max_length=16, choices=SUBJECT_AREA_CHOICES, default='cs', verbose_name='学科领域')

    original_text = models.TextField(verbose_name='原始全文')
    text_preview = models.TextField(blank=True, default='', verbose_name='预览(前500字符)')
    total_characters = models.PositiveIntegerField(default=0, verbose_name='总字符数')
    total_words = models.PositiveIntegerField(default=0, verbose_name='总字数(中文字+英文词)')
    estimated_pages = models.PositiveSmallIntegerField(default=0, verbose_name='预估页数')

    file_name = models.CharField(max_length=255, blank=True, default='', verbose_name='文件名')
    file_size = models.PositiveIntegerField(default=0, verbose_name='文件大小(bytes)')
    file_hash_sha256 = models.CharField(max_length=64, blank=True, default='', verbose_name='SHA256哈希')

    overall_integrity_score = models.FloatField(default=100, verbose_name='综合诚信得分(0-100) [核心指标]')
    overall_ai_score = models.FloatField(default=0, verbose_name='AI生成概率(0-100)')
    overall_plagiarism_score = models.FloatField(default=0, verbose_name='抄袭相似度(0-100)')
    overall_verdict = models.CharField(max_length=26, choices=VERDICT_CHOICES, default='original', verbose_name='综合判定')
    confidence_level = models.CharField(max_length=12, default='high', verbose_name='检测置信度')

    chapter_count = models.PositiveSmallIntegerField(default=0, verbose_name='章节数')
    sections_analyzed = models.PositiveSmallIntegerField(default=0, verbose_name='已分析节数')
    problematic_sections_count = models.PositiveSmallIntegerField(default=0, verbose_name='问题节数')
    clean_sections_count = models.PositiveSmallIntegerField(default=0, verbose_name='清洁节数')

    structure_analysis = models.JSONField(default=dict, verbose_name='论文结构分析(JSON: 章节树)')
    chapter_results = models.JSONField(default=list, verbose_name='各章节检测结果(JSON数组)')
    key_findings = models.JSONField(default=list, verbose_name='关键发现列表')
    risk_indicators = models.JSONField(default=dict, verbose_name='风险指标汇总')
    citation_analysis = models.JSONField(default=dict, verbose_name='引用分析结果')

    detailed_report = models.TextField(blank=True, default='', verbose_name='详细检测报告')
    student_friendly_summary = models.TextField(blank=True, default='', verbose_name='学生友好摘要(通俗语言)')
    improvement_recommendations = models.JSONField(default=list, verbose_name='修改建议列表')

    status = models.CharField(max_length=18, choices=STATUS_CHOICES, default='uploaded', verbose_name='状态')
    processing_time_ms = models.PositiveIntegerField(default=0, verbose_name='总处理耗时(ms)')
    error_message = models.TextField(blank=True, default='', verbose_name='错误信息')

    tags = models.JSONField(default=list, verbose_name='自动标签')
    metadata = models.JSONField(default=dict, verbose_name='扩展元数据')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'chapter_detect_submission'
        verbose_name = '论文分章节检测'
        verbose_name_plural = '论文分章节检测'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at'], name='idx_cd_user_time'),
            models.Index(fields=['status'], name='idx_cd_status'),
            models.Index(fields=['overall_verdict'], name='idx_cd_verdict'),
            models.Index(fields=['overall_integrity_score'], name='idx_cd_integrity'),
            models.Index(fields=['paper_type'], name='idx_cd_type'),
            models.Index(fields=['subject_area'], name='idx_cd_subject'),
            models.Index(fields=['file_hash_sha256'], name='idx_cd_hash'),
        ]

    def __str__(self):
        return f'论文检测-{self.title[:30]}-{self.get_overall_verdict_display()}-{self.overall_integrity_score:.0f}%'


class ChapterAnalysis(models.Model):
    CHAPTER_TYPE_CHOICES = [
        ('abstract', '摘要'), ('introduction', '引言/绪论'), ('literature_review', '文献综述'),
        ('methodology', '研究方法'), ('results', '研究结果'), ('discussion', '讨论'),
        ('conclusion', '结论'), ('references', '参考文献'), ('appendix', '附录'),
        ('acknowledgement', '致谢'), ('declaration', '声明'), ('other', '其他章节'),
    ]
    VERDICT_CHOICES = [
        ('original_clean', '原创·清洁'),
        ('minor_ai_hints', '轻微AI痕迹'),
        ('moderate_ai_content', '中等AI内容'),
        ('highly_ai_generated', '高度AI生成'),
        ('plagiarism_found', '发现抄袭'),
        ('mixed_issues', '混合问题'),
        ('inconclusive', '无法判定'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submission = models.ForeignKey(PaperSubmission, on_delete=models.CASCADE, related_name='chapters', verbose_name='所属论文')

    chapter_order = models.PositiveSmallIntegerField(default=1, verbose_name='章节序号')
    chapter_title = models.CharField(max_length=200, verbose_name='章节标题')
    chapter_type = models.CharField(max_length=20, choices=CHAPTER_TYPE_CHOICES, default='other', verbose_name='章节类型')

    original_text = models.TextField(verbose_name='章节原文')
    char_count = models.PositiveIntegerField(default=0, verbose_name='字符数')
    word_count = models.PositiveIntegerField(default=0, verbose_name='字数')
    paragraph_count = models.PositiveIntegerField(default=0, verbose_name='段落数')
    sentence_count = models.PositiveIntegerField(default=0, verbose_name='句子数')

    ai_probability = models.FloatField(default=0, verbose_name='AI生成概率(0-100)')
    plagiarism_similarity = models.FloatField(default=0, verbose_name='抄袭相似度(0-100)')
    integrity_score = models.FloatField(default=100, verbose_name='本章诚信分(0-100)')
    verdict = models.CharField(max_length=22, choices=VERDICT_CHOICES, default='original_clean', verbose_name='本章判定')

    perplexity_score = models.FloatField(default=0, verbose_name='困惑度评分')
    burstiness_score = models.FloatField(default=0, verbose_name='突发性评分')
    vocabulary_diversity = models.FloatField(default=0, verbose_name='词汇多样性(TTR)')
    academic_tone_score = models.FloatField(default=0, verbose_name='学术语气评分(0-100)')
    citation_density = models.FloatField(default=0, verbose_name='引用密度(引用/千字)')

    problem_sentences = models.JSONField(default=list, verbose_name='问题句子列表(JSON)')
    plagiarism_sources = models.JSONField(default=list, verbose_name='抄袭来源匹配')
    ai_markers = models.JSONField(default=list, verbose_name='AI特征标记')
    writing_style_notes = models.TextField(blank=True, default='', verbose_name='写作风格备注')

    detailed_analysis = models.JSONField(default=dict, verbose_name='详细分析数据')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'chapter_detect_analysis'
        verbose_name = '章节分析'
        verbose_name_plural = '章节分析'
        ordering = ['submission', 'chapter_order']
        indexes = [
            models.Index(fields=['submission', 'chapter_order'], name='idx_cd_ch_order'),
            models.Index(fields=['verdict'], name='idx_cd_ch_verdict'),
            models.Index(fields=['-ai_probability'], name='idx_ch_ai_prob'),
            models.Index(fields=['-plagiarism_similarity'], name='idx_ch_plag_sim'),
            models.Index(fields=['chapter_type'], name='idx_cd_ch_type'),
        ]

    def __str__(self):
        return f'第{self.chapter_order}章-{self.chapter_title}-{self.verdict}'
