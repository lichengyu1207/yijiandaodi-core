from django.db import models
from django.conf import settings
import json


class DataSensitivityLevel(models.Model):
    LEVEL_CHOICES = [
        ('L1', 'L1-公开'),
        ('L2', 'L2-内部'),
        ('L3', 'L3-机密'),
        ('L4', 'L4-绝密'),
    ]

    code = models.CharField(max_length=10, unique=True, verbose_name='级别代码', choices=LEVEL_CHOICES)
    name = models.CharField(max_length=50, verbose_name='级别名称')
    description = models.TextField(blank=True, default='', verbose_name='级别说明')
    color = models.CharField(max_length=7, default='#86909C', verbose_name='标识颜色')
    icon = models.CharField(max_length=30, default='', blank=True, verbose_name='标识图标')

    retention_days = models.PositiveIntegerField(default=180, verbose_name='最小保留天数(天)')
    encryption_required = models.BooleanField(default=False, verbose_name='是否需要加密存储')
    access_log_required = models.BooleanField(default=True, verbose_name='是否记录访问日志')
    export_approval_required = models.BooleanField(default=False, verbose_name='导出是否需要审批')
    allowed_roles = models.JSONField(default=list, verbose_name='允许访问的角色列表')
    dpo_review_required = models.BooleanField(default=False, verbose_name='是否需要DPO审核')

    sort_order = models.IntegerField(default=0, verbose_name='排序权重')
    is_active = models.BooleanField(default=True, verbose_name='是否启用')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'data_sensitivity_level'
        verbose_name = '数据敏感度等级'
        verbose_name_plural = '数据敏感度等级'
        ordering = ['sort_order']

    def __str__(self):
        return f'{self.code}-{self.name}'


class DataCategory(models.Model):
    CATEGORY_TYPE_CHOICES = [
        ('personal_info', '个人信息'),
        ('business_data', '业务数据'),
        ('system_data', '系统运行数据'),
        ('log_audit_data', '日志审计数据'),
        ('financial_data', '财务数据'),
        ('security_data', '安全相关数据'),
        ('third_party_data', '第三方数据'),
        ('knowledge_base', '知识库数据'),
    ]

    code = models.CharField(max_length=50, unique=True, verbose_name='分类代码')
    name = models.CharField(max_length=100, verbose_name='分类名称')
    category_type = models.CharField(max_length=30, choices=CATEGORY_TYPE_CHOICES, verbose_name='分类类型')
    description = models.TextField(blank=True, default='', verbose_name='分类描述')

    default_level = models.ForeignKey(
        DataSensitivityLevel,
        on_delete=models.PROTECT,
        related_name='default_categories',
        verbose_name='默认敏感级别',
        null=True,
        blank=True
    )

    legal_basis = models.CharField(
        max_length=200, blank=True, default='',
        verbose_name='法律依据（如：个人信息保护法第XX条）'
    )
    compliance_requirements = models.JSONField(default=list, verbose_name='合规要求清单')
    cross_border_transfer_allowed = models.BooleanField(default=False, verbose_name='允许跨境传输')

    is_active = models.BooleanField(default=True, verbose_name='是否启用')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'data_category'
        verbose_name = '数据分类'
        verbose_name_plural = '数据分类'
        ordering = ['category_type', 'code']

    def __str__(self):
        return f'[{self.get_category_type_display()}] {self.name}'


class DataFieldTag(models.Model):
    PII_TYPES = [
        ('identity_card', '身份证号'),
        ('phone', '手机号码'),
        ('email', '电子邮箱'),
        ('real_name', '真实姓名'),
        ('address', '居住地址'),
        ('bank_account', '银行账号'),
        ('ip_address', 'IP地址'),
        ('device_id', '设备标识'),
        ('biometric', '生物识别信息'),
        ('location', '位置信息'),
        ('password_hash', '密码哈希'),
        ('api_key', 'API密钥'),
        ('session_token', '会话令牌'),
        ('financial', '财务信息'),
        ('health', '健康信息'),
        ('other_sensitive', '其他敏感信息'),
    ]

    field_path = models.CharField(max_length=200, unique=True, verbose_name='字段路径（如：auth_app.User.email）')
    field_label = models.CharField(max_length=100, verbose_name='字段中文名')
    pii_type = models.CharField(max_length=30, choices=PII_TYPES, verbose_name='PII类型')
    sensitivity_level = models.ForeignKey(
        DataSensitivityLevel,
        on_delete=models.PROTECT,
        related_name='tagged_fields',
        verbose_name='敏感级别'
    )
    data_category = models.ForeignKey(
        DataCategory,
        on_delete=models.PROTECT,
        related_name='tagged_fields',
        verbose_name='所属分类'
    )

    mask_rule = models.CharField(
        max_length=100, default='partial',
        choices=[('none', '不脱敏'), ('full', '完全脱敏'), ('partial', '部分脱敏'), ('hash', '哈希替换')],
        verbose_name='展示脱敏规则'
    )
    mask_pattern = models.CharField(max_length=200, blank=True, default='', verbose_name='脱敏模式（正则）')
    is_encrypted_at_rest = models.BooleanField(default=False, verbose_name='静态加密存储')

    legal_basis = models.CharField(max_length=200, blank=True, default='', verbose_name='法律依据')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'data_field_tag'
        verbose_name = '数据字段标签（PII标注）'
        verbose_name_plural = '数据字段标签（PII标注）'
        ordering = ['pii_type', 'field_path']

    def __str__(self):
        return f'{self.field_path} ({self.get_pii_type_display()})'


class DataClassificationRecord(models.Model):
    ACTION_TYPE_CHOICES = [
        ('auto_classified', '自动分级'),
        ('manual_classified', '手动分级'),
        ('level_changed', '级别变更'),
        ('access_granted', '访问授权'),
        ('access_denied', '访问拒绝'),
        ('exported', '数据导出'),
        ('deleted', '数据删除'),
        ('retention_expired', '保留期满销毁'),
    ]

    object_type = models.CharField(max_length=100, verbose_name='对象类型（模型名）')
    object_id = models.PositiveIntegerField(verbose_name='对象ID')
    object_repr = models.CharField(max_length=300, blank=True, default='', verbose_name='对象摘要')

    sensitivity_level = models.ForeignKey(
        DataSensitivityLevel,
        on_delete=models.PROTECT,
        verbose_name='敏感级别',
        null=True,
        blank=True
    )
    data_category = models.ForeignKey(
        DataCategory,
        on_delete=models.PROTECT,
        verbose_name='数据分类',
        null=True,
        blank=True
    )

    action_type = models.CharField(max_length=30, choices=ACTION_TYPE_CHOICES, verbose_name='操作类型')
    operator = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='classification_actions',
        verbose_name='操作人'
    )
    operator_role = models.CharField(max_length=50, blank=True, default='', verbose_name='操作时角色')
    reason = models.TextField(blank=True, default='', verbose_name='操作原因/备注')
    ip_address = models.GenericIPAddressField(null=True, blank=True, verbose_name='操作IP')

    previous_level_code = models.CharField(max_length=10, blank=True, default='', verbose_name='变更前级别')
    new_level_code = models.CharField(max_length=10, blank=True, default='', verbose_name='变更后级别')

    auto_classification_score = models.FloatField(null=True, blank=True, verbose_name='自动分类置信度(0-1)')
    classification_rules_matched = models.JSONField(default=list, verbose_name='匹配的分类规则')

    created_at = models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='操作时间')

    class Meta:
        db_table = 'data_classification_record'
        verbose_name = '数据分级操作记录'
        verbose_name_plural = '数据分级操作记录'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['object_type', 'object_id'], name='idx_dc_object'),
            models.Index(fields=['action_type'], name='idx_dc_action'),
            models.Index(fields=['sensitivity_level'], name='idx_dc_level'),
        ]

    def __str__(self):
        return f'{self.object_type}#{self.object_id} - {self.action_type}'


class DataExportApproval(models.Model):
    STATUS_CHOICES = [
        ('pending', '待审批'),
        ('approved', '已批准'),
        ('rejected', '已拒绝'),
        ('expired', '已过期'),
        ('revoked', '已撤销'),
    ]

    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='export_requests',
        verbose_name='申请人'
    )
    approver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='export_approvals',
        verbose_name='审批人'
    )

    data_description = models.TextField(verbose_name='导出数据描述')
    object_types = models.JSONField(default=list, verbose_name='涉及的数据类型列表')
    max_sensitivity_level = models.CharField(max_length=10, blank=True, default='', verbose_name='涉及最高敏感级别')
    record_count_estimate = models.PositiveIntegerField(default=0, verbose_name='预估记录数')

    purpose = models.TextField(verbose_name='导出用途')
    recipient = models.CharField(max_length=200, blank=True, default='', verbose_name='接收方')
    export_format = models.CharField(
        max_length=20, default='csv',
        choices=[('csv', 'CSV'), ('excel', 'Excel'), ('json', 'JSON'), ('pdf', 'PDF')],
        verbose_name='导出格式'
    )

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name='状态')
    approval_comment = models.TextField(blank=True, default='', verbose_name='审批意见')
    approved_at = models.DateTimeField(null=True, blank=True, verbose_name='审批时间')
    expires_at = models.DateTimeField(null=True, blank=True, verbose_name='授权过期时间')

    file_path = models.CharField(max_length=500, blank=True, default='', verbose_name='生成文件路径')
    download_count = models.PositiveIntegerField(default=0, verbose_name='下载次数')
    last_download_at = models.DateTimeField(null=True, blank=True, verbose_name='最后下载时间')

    ip_address = models.GenericIPAddressField(null=True, blank=True, verbose_name='申请IP')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='申请时间')

    class Meta:
        db_table = 'data_export_approval'
        verbose_name = '数据导出审批'
        verbose_name_plural = '数据导出审批'
        ordering = ['-created_at']

    def __str__(self):
        return f'导出申请#{self.id} - {self.get_status_display()}'


class DataProtectionOfficer(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='dpo_profile',
        verbose_name='关联用户'
    )
    employee_id = models.CharField(max_length=50, blank=True, default='', verbose_name='工号')
    department = models.CharField(max_length=100, blank=True, default='', verbose_name='部门')
    phone = models.CharField(max_length=20, blank=True, default='', verbose_name='联系电话')
    certificate = models.CharField(max_length=200, blank=True, default='', verbose_name='资质证书')
    scope = models.JSONField(default=list, verbose_name='负责范围（数据分类列表）')

    is_active = models.BooleanField(default=True, verbose_name='在职状态')
    appointed_at = models.DateField(verbose_name='任命日期')
    term_end_date = models.DateField(null=True, blank=True, verbose_name='任期结束日期')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'data_protection_officer'
        verbose_name = '数据保护官(DPO)'
        verbose_name_plural = '数据保护官(DPO)'

    def __str__(self):
        return f'DPO: {self.user.username}'
