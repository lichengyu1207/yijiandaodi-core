from django.db import models
from django.conf import settings
import uuid


class BScenarioMedicalReport(models.Model):
    STATUS_CHOICES = [
        ('pending', '待检测'),
        ('processing', '检测中'),
        ('completed', '已完成'),
        ('failed', '检测失败'),
    ]
    RISK_LEVEL_CHOICES = [
        ('high', '高风险'),
        ('medium', '中风险'),
        ('low', '低风险'),
        ('safe', '安全'),
    ]
    REPORT_TYPE_CHOICES = [
        ('lab_report', '检验报告'),
        ('imaging_report', '影像报告'),
        ('pathology_report', '病理报告'),
        ('discharge_summary', '出院小结'),
        ('prescription', '处方单'),
        ('other', '其他医疗文书'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='medical_reports', verbose_name='提交用户'
    )
    report_type = models.CharField(max_length=20, choices=REPORT_TYPE_CHOICES, verbose_name='报告类型')
    file_name = models.CharField(max_length=255, blank=True, default='', verbose_name='文件名')
    file_size = models.PositiveIntegerField(default=0, verbose_name='文件大小(bytes)')
    original_text = models.TextField(verbose_name='原始文本内容')

    ai_generated_prob = models.FloatField(default=0, verbose_name='AI生成概率(0-1)')
    medical_error_score = models.FloatField(default=0, verbose_name='医疗错误风险评分(0-100)')
    risk_level = models.CharField(max_length=10, choices=RISK_LEVEL_CHOICES, default='safe', verbose_name='风险等级')
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='pending', verbose_name='状态')

    detection_result = models.JSONField(default=dict, verbose_name='检测结果详情')
    medical_issues = models.JSONField(default=list, verbose_name='医疗问题列表')
    ai_indicators = models.JSONField(default=dict, verbose_name='AI生成指标')
    professional_report = models.TextField(blank=True, default='', verbose_name='专业鉴别报告')

    patient_id_masked = models.CharField(max_length=50, blank=True, default='', verbose_name='患者ID(脱敏)')
    institution = models.CharField(max_length=200, blank=True, default='', verbose_name='医疗机构')
    department = models.CharField(max_length=100, blank=True, default='', verbose_name='科室')
    report_date = models.DateField(null=True, blank=True, verbose_name='报告日期')

    processing_time_ms = models.PositiveIntegerField(default=0, verbose_name='处理耗时(ms)')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'bscenario_medical_report'
        verbose_name = 'B级-医疗报告鉴别'
        verbose_name_plural = 'B级-医疗报告鉴别'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at'], name='idx_medical_user_time'),
            models.Index(fields=['status'], name='idx_medical_status'),
            models.Index(fields=['risk_level'], name='idx_medical_risk'),
            models.Index(fields=['report_type'], name='idx_medical_type'),
        ]

    def __str__(self):
        return f'医疗报告鉴别-{self.report_type}-{self.id.hex[:8]}'


class BScenarioLegalDocument(models.Model):
    STATUS_CHOICES = [
        ('pending', '待检测'),
        ('processing', '检测中'),
        ('completed', '已完成'),
        ('failed', '检测失败'),
    ]
    RISK_LEVEL_CHOICES = [
        ('high', '高风险'),
        ('medium', '中风险'),
        ('low', '低风险'),
        ('safe', '安全'),
    ]
    DOC_TYPE_CHOICES = [
        ('contract', '合同协议'),
        ('litigation', '诉讼文书'),
        ('intellectual_property', '知识产权文件'),
        ('company_governance', '公司治理文件'),
        ('compliance', '合规文件'),
        ('legal_opinion', '法律意见书'),
        ('other', '其他法律文书'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='legal_documents', verbose_name='提交用户'
    )
    doc_type = models.CharField(max_length=30, choices=DOC_TYPE_CHOICES, verbose_name='文书类型')
    file_name = models.CharField(max_length=255, blank=True, default='', verbose_name='文件名')
    file_size = models.PositiveIntegerField(default=0, verbose_name='文件大小(bytes)')
    original_text = models.TextField(verbose_name='原始文本内容')

    ai_generated_prob = models.FloatField(default=0, verbose_name='AI生成概率(0-1)')
    legal_risk_score = models.FloatField(default=0, verbose_name='法律风险评分(0-100)')
    risk_level = models.CharField(max_length=10, choices=RISK_LEVEL_CHOICES, default='safe', verbose_name='风险等级')
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='pending', verbose_name='状态')

    detection_result = models.JSONField(default=dict, verbose_name='检测结果详情')
    legal_risks = models.JSONField(default=list, verbose_name='法律风险列表')
    compliance_issues = models.JSONField(default=list, verbose_name='合规问题列表')
    ai_indicators = models.JSONField(default=dict, verbose_name='AI生成指标')
    professional_report = models.TextField(blank=True, default='', verbose_name='专业鉴别报告')

    parties_involved = models.JSONField(default=list, verbose_name='相关方信息(脱敏)')
    jurisdiction = models.CharField(max_length=100, blank=True, default='', verbose_name='管辖区域')
    effective_date = models.DateField(null=True, blank=True, verbose_name='生效日期')
    doc_amount = models.DecimalField(max_digits=16, decimal_places=2, null=True, blank=True, verbose_name='涉及金额(元)')

    processing_time_ms = models.PositiveIntegerField(default=0, verbose_name='处理耗时(ms)')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'bscenario_legal_document'
        verbose_name = 'B级-法律文书鉴别'
        verbose_name_plural = 'B级-法律文书鉴别'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at'], name='idx_legal_user_time'),
            models.Index(fields=['status'], name='idx_legal_status'),
            models.Index(fields=['risk_level'], name='idx_legal_risk'),
            models.Index(fields=['doc_type'], name='idx_legal_type'),
        ]

    def __str__(self):
        return f'法律文书鉴别-{self.doc_type}-{self.id.hex[:8]}'


class BScenarioFinancialStatement(models.Model):
    STATUS_CHOICES = [
        ('pending', '待检测'),
        ('processing', '检测中'),
        ('completed', '已完成'),
        ('failed', '检测失败'),
    ]
    RISK_LEVEL_CHOICES = [
        ('high', '高风险'),
        ('medium', '中风险'),
        ('low', '低风险'),
        ('safe', '安全'),
    ]
    STATEMENT_TYPE_CHOICES = [
        ('balance_sheet', '资产负债表'),
        ('income_statement', '利润表'),
        ('cash_flow', '现金流量表'),
        ('equity_change', '所有者权益变动表'),
        ('audit_report', '审计报告'),
        ('financial_notes', '财务报表附注'),
        ('other', '其他财务文件'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='financial_statements', verbose_name='提交用户'
    )
    statement_type = models.CharField(max_length=20, choices=STATEMENT_TYPE_CHOICES, verbose_name='报表类型')
    file_name = models.CharField(max_length=255, blank=True, default='', verbose_name='文件名')
    file_size = models.PositiveIntegerField(default=0, verbose_name='文件大小(bytes)')
    original_text = models.TextField(verbose_name='原始文本内容')

    ai_generated_prob = models.FloatField(default=0, verbose_name='AI生成概率(0-1)')
    fraud_risk_score = models.FloatField(default=0, verbose_name='造假风险评分(0-100)')
    risk_level = models.CharField(max_length=10, choices=RISK_LEVEL_CHOICES, default='safe', verbose_name='风险等级')
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='pending', verbose_name='状态')

    detection_result = models.JSONField(default=dict, verbose_name='检测结果详情')
    fraud_indicators = models.JSONField(default=list, verbose_name='造假指标列表')
    anomaly_items = models.JSONField(default=list, verbose_name='异常项目列表')
    ai_indicators = models.JSONField(default=dict, verbose_name='AI生成指标')
    professional_report = models.TextField(blank=True, default='', verbose_name='专业审计报告')

    company_name_masked = models.CharField(max_length=200, blank=True, default='', verbose_name='企业名称(脱敏)')
    reporting_period = models.CharField(max_length=50, blank=True, default='', verbose_name='报告期间')
    total_assets = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True, verbose_name='资产总额(元)')
    total_revenue = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True, verbose_name='营收总额(元)')
    audit_firm = models.CharField(max_length=200, blank=True, default='', verbose_name='会计师事务所')

    processing_time_ms = models.PositiveIntegerField(default=0, verbose_name='处理耗时(ms)')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'bscenario_financial_statement'
        verbose_name = 'B级-财务报表鉴别'
        verbose_name_plural = 'B级-财务报表鉴别'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at'], name='idx_finance_user_time'),
            models.Index(fields=['status'], name='idx_finance_status'),
            models.Index(fields=['risk_level'], name='idx_finance_risk'),
            models.Index(fields=['statement_type'], name='idx_finance_type'),
        ]

    def __str__(self):
        return f'财务报表鉴别-{self.statement_type}-{self.id.hex[:8]}'


class BScenarioDesignDraft(models.Model):
    STATUS_CHOICES = [
        ('pending', '待检测'),
        ('processing', '检测中'),
        ('completed', '已完成'),
        ('failed', '检测失败'),
    ]
    RISK_LEVEL_CHOICES = [
        ('high', '高风险'),
        ('medium', '中风险'),
        ('low', '低风险'),
        ('safe', '安全'),
    ]
    DESIGN_TYPE_CHOICES = [
        ('ui_design', 'UI设计稿'),
        ('ux_wireframe', 'UX线框图'),
        ('graphic_design', '平面设计'),
        ('logo_design', 'Logo设计'),
        ('illustration', '插画作品'),
        ('3d_model', '3D模型'),
        ('motion_graphics', '动效设计'),
        ('brand_identity', '品牌VI设计'),
        ('other', '其他设计稿'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='design_drafts', verbose_name='提交用户'
    )
    design_type = models.CharField(max_length=20, choices=DESIGN_TYPE_CHOICES, verbose_name='设计类型')
    file_name = models.CharField(max_length=255, blank=True, default='', verbose_name='文件名')
    file_size = models.PositiveIntegerField(default=0, verbose_name='文件大小(bytes)')
    original_text = models.TextField(blank=True, default='', verbose_name='原始文本/描述')
    image_preview_url = models.URLField(blank=True, default='', verbose_name='预览图URL')

    ai_generated_prob = models.FloatField(default=0, verbose_name='AI生成概率(0-1)')
    plagiarism_score = models.FloatField(default=0, verbose_name='抄袭相似度(0-100)')
    originality_score = models.FloatField(default=100, verbose_name='原创度评分(0-100)')
    risk_level = models.CharField(max_length=10, choices=RISK_LEVEL_CHOICES, default='safe', verbose_name='风险等级')
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default='pending', verbose_name='状态')

    detection_result = models.JSONField(default=dict, verbose_name='检测结果详情')
    plagiarism_sources = models.JSONField(default=list, verbose_name='疑似抄袭来源列表')
    ai_style_markers = models.JSONField(default=list, verbose_name='AI风格特征列表')
    ai_indicators = models.JSONField(default=dict, verbose_name='AI生成指标')
    professional_report = models.TextField(blank=True, default='', verbose_name='原创度分析报告')

    designer_alias = models.CharField(max_length=100, blank=True, default='', verbose_name='设计师昵称(脱敏)')
    design_tool = models.CharField(max_length=50, blank=True, default='', verbose_name='使用工具')
    color_palette = models.JSONField(default=list, verbose_name='色彩方案')
    dimensions = models.CharField(max_length=50, blank=True, default='', verbose_name='尺寸规格')

    processing_time_ms = models.PositiveIntegerField(default=0, verbose_name='处理耗时(ms)')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'bscenario_design_draft'
        verbose_name = 'B级-设计稿鉴别'
        verbose_name_plural = 'B级-设计稿鉴别'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at'], name='idx_design_user_time'),
            models.Index(fields=['status'], name='idx_design_status'),
            models.Index(fields=['risk_level'], name='idx_design_risk'),
            models.Index(fields=['design_type'], name='idx_design_type'),
        ]

    def __str__(self):
        return f'设计稿鉴别-{self.design_type}-{self.id.hex[:8]}'
