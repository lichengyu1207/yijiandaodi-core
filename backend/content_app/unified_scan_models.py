from django.db import models
from django.conf import settings
import uuid
import hashlib
import json


class UnifiedContentScan(models.Model):
    STATUS_CHOICES = [
        ('queued', '排队中'),
        ('classifying', '智能分类中'),
        ('scanning', '多维度扫描中'),
        ('aggregating', '结果聚合中'),
        ('completed', '已完成'),
        ('partial', '部分完成'),
        ('failed', '检测失败'),
    ]
    CONTENT_CATEGORY_CHOICES = [
        ('auto_detect', '自动识别'),
        ('general_text', '通用文本'),
        ('medical_report', '医疗报告'),
        ('legal_document', '法律文书'),
        ('financial_statement', '财务报表'),
        ('design_draft', '设计稿'),
        ('academic_paper', '学术论文'),
        ('enterprise_content', '企业文档'),
        ('video_media', '视频媒体'),
        ('image_media', '图片媒体'),
        ('code_source', '代码/源码'),
        ('api_response', 'API响应数据'),
        ('email_comm', '邮件/通讯'),
        ('social_content', '社交媒体'),
    ]
    RISK_LEVEL_CHOICES = [
        ('critical', '严重违规'),
        ('high', '高风险'),
        ('medium', '中风险'),
        ('low', '低风险'),
        ('info', '信息级'),
        ('safe', '安全'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='unified_scans', verbose_name='提交用户'
    )

    input_category = models.CharField(max_length=20, choices=CONTENT_CATEGORY_CHOICES, default='auto_detect', verbose_name='输入分类')
    detected_category = models.CharField(max_length=20, choices=CONTENT_CATEGORY_CHOICES, blank=True, default='', verbose_name='智能检测结果分类')
    classification_confidence = models.FloatField(default=0, verbose_name='分类置信度(0-1)')

    file_name = models.CharField(max_length=255, blank=True, default='', verbose_name='文件名')
    file_size = models.PositiveIntegerField(default=0, verbose_name='文件大小(bytes)')
    file_hash_sha256 = models.CharField(max_length=64, blank=True, default='', verbose_name='SHA256哈希')
    file_type = models.CharField(max_length=50, blank=True, default='', verbose_name='文件类型(MIME)')
    original_content = models.TextField(blank=True, default='', verbose_name='原始内容')
    content_preview = models.TextField(blank=True, default='', verbose_name='内容预览(前3000字符)')
    content_language = models.CharField(max_length=10, blank=True, default='zh', verbose_name='检测到的语言')

    overall_risk_level = models.CharField(max_length=12, choices=RISK_LEVEL_CHOICES, default='safe', verbose_name='综合风险等级')
    overall_risk_score = models.FloatField(default=0, verbose_name='综合风险评分(0-100)')
    compliance_score = models.FloatField(default=100, verbose_name='合规评分(0-100)')
    integrity_score = models.FloatField(default=100, verbose_name='完整性/诚信评分(0-100)')

    ai_generated_probability = models.FloatField(default=0, verbose_name='AI生成概率(0-1)')
    plagiarism_similarity = models.FloatField(default=0, verbose_name='抄袭/相似度(0-1)')
    deepfake_probability = models.FloatField(default=0, verbose_name='深伪概率(0-1)')
    data_leak_risk = models.FloatField(default=0, verbose_name='数据泄露风险(0-1)')
    sensitivity_level = models.CharField(max_length=4, default='L1', verbose_name='敏感级别(L1-L4)')

    dimension_results = models.JSONField(default=dict, verbose_name='各维度检测结果')
    triggered_detectors = models.JSONField(default=list, verbose_name='触发的检测器列表')
    scan_timeline = models.JSONField(default=list, verbose_name='扫描时间线(各阶段耗时)')

    findings_summary = models.JSONField(default=dict, verbose_name='发现摘要(按严重度分组)')
    finding_details = models.JSONField(default=list, verbose_name='发现详情列表')
    risk_indicators = models.JSONField(default=list, verbose_name='风险指标列表')

    compliance_mapping = models.JSONField(default=dict, verbose_name='合规法规映射(发现→法条)')
    affected_regulations = models.JSONField(default=list, verbose_name='涉及法规列表')
    remediation_plan = models.JSONField(default=list, verbose_name='整改建议清单')
    audit_trail = models.JSONField(default=list, verbose_name='审计追踪记录')

    unified_report = models.TextField(blank=True, default='', verbose_name='统一检测报告')
    executive_brief = models.TextField(blank=True, default='', verbose_name='高管简报(一页纸)')

    status = models.CharField(max_length=14, choices=STATUS_CHOICES, default='queued', verbose_name='状态')
    processing_time_ms = models.PositiveIntegerField(default=0, verbose_name='总处理耗时(ms)')
    detectors_executed = models.PositiveIntegerField(default=0, verbose_name='执行检测器数量')
    detectors_passed = models.PositiveIntegerField(default=0, verbose_name='通过检测器数量')
    detectors_failed = models.PositiveIntegerField(default=0, verbose_name='未通过检测器数量')

    tags = models.JSONField(default=list, verbose_name='自动标签')
    metadata = models.JSONField(default=dict, verbose_name='扩展元数据')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'unified_content_scan'
        verbose_name = '全品类内容安全检测'
        verbose_name_plural = '全品类内容安全检测'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at'], name='idx_unified_user_time'),
            models.Index(fields=['status'], name='idx_unified_status'),
            models.Index(fields=['overall_risk_level'], name='idx_unified_risk'),
            models.Index(fields=['detected_category'], name='idx_unified_cat'),
            models.Index(fields=['input_category'], name='idx_unified_input_cat'),
            models.Index(fields=['file_hash_sha256'], name='idx_unified_hash'),
            models.Index(fields=['-overall_risk_score'], name='idx_unified_risk_score'),
            models.Index(fields=['-compliance_score'], name='idx_unified_compliance'),
        ]

    def __str__(self):
        return f'全品类检测-{self.detected_category or self.input_category}-{self.id.hex[:8]}'


class ComplianceRule(models.Model):
    RULE_TYPE_CHOICES = [
        ('cybersecurity_law', '网络安全法'),
        ('data_security_law', '数据安全法'),
        ('pipl', '个人信息保护法'),
        ('djb_level3', '等保2.0三级'),
        ('iso27001', 'ISO 27001'),
        ('ad_law', '广告法'),
        ('copyright_law', '著作权法'),
        ('academic_integrity', '学术规范'),
        ('financial_regulation', '金融监管规定'),
        ('medical_regulation', '医疗行业规定'),
        ('industry_custom', '行业自定义规则'),
    ]
    SEVERITY_CHOICES = [('must', '强制'), ('should', '推荐'), ('may', '可选')]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rule_code = models.CharField(max_length=30, unique=True, verbose_name='规则编号')
    rule_type = models.CharField(max_length=24, choices=RULE_TYPE_CHOICES, verbose_name='法规类型')
    article_reference = models.CharField(max_length=100, verbose_name='法条引用')
    severity = models.CharField(max_length=8, choices=SEVERITY_CHOICES, default='should', verbose_name='严重程度')
    title = models.CharField(max_length=200, verbose_name='规则标题')
    description = models.TextField(verbose_name='规则描述')
    detection_pattern = models.JSONField(default=dict, verbose_name='检测模式(关键词/正则/语义特征)')
    applicable_categories = models.JSONField(default=list, verbose_name='适用内容类别')
    penalty_description = models.TextField(blank=True, default='', verbose_name='违规后果说明')
    is_active = models.BooleanField(default=True, verbose_name='是否启用')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'compliance_rule'
        verbose_name = '合规规则'
        verbose_name_plural = '合规规则'
        ordering = ['rule_type', 'severity', 'rule_code']

    def __str__(self):
        return f'{self.rule_code}: {self.title}'
