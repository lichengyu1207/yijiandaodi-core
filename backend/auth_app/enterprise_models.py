from django.db import models
from django.conf import settings
import secrets
import string


class EnterpriseAccount(models.Model):
    PLAN_CHOICES = [
        ('starter', '企业基础版(¥2999)'),
        ('professional', '企业专业版(¥19999)'),
        ('enterprise_premium', '企业高级版(¥19999)'),
    ]
    STATUS_CHOICES = [
        ('trial', '试用中'),
        ('active', '正常'),
        ('suspended', '已停用'),
        ('expired', '已过期'),
    ]

    id = models.BigAutoField(primary_key=True)
    name = models.CharField('企业名称', max_length=100)
    company_name = models.CharField('公司全称', max_length=200, blank=True, default='')
    contact_person = models.CharField('联系人', max_length=50)
    contact_phone = models.CharField('联系电话', max_length=20, blank=True, default='')
    contact_email = models.EmailField('邮箱', blank=True, default='')
    business_license = models.CharField('营业执照号', max_length=30, blank=True, default='')
    tax_id = models.CharField('纳税号', max_length=25, blank=True, default='')

    plan_type = models.CharField('套餐类型', max_length=20, choices=PLAN_CHOICES, default='starter')
    status = models.CharField('状态', max_length=15, choices=STATUS_CHOICES, default='trial')
    
    admin_user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='enterprise_admin', verbose_name='企业管理员')
    
    api_calls_limit = models.PositiveIntegerField('API调用限额(每月)', default=10000)
    api_calls_used = models.PositiveIntegerField('API已调用(本月)', default=0)
    members_limit = models.PositiveSmallIntegerField('成员数限制', default=10)
    concurrent_sessions = models.PositiveSmallIntegerField('并发会话数', default=5)

    balance = models.DecimalField('余额(元)', max_digits=14, decimal_places=2, default=0)
    total_recharged = models.DecimalField('总充值(元)', max_digits=16, decimal_places=2, default=0)
    total_spent = models.DecimalField('总消费(元)', max_digits=16, decimal_places=2, default=0)

    trial_ends_at = models.DateTimeField('试用截止时间', null=True, blank=True)
    paid_until = models.DateTimeField('到期时间', null=True, blank=True)
    auto_renew = models.BooleanField('自动续费', default=False)

    webhook_url = models.URLField('Webhook URL', blank=True, default='')
    webhook_secret = models.CharField('Webhook Secret', max_length=64, blank=True, default='')
    ip_whitelist = models.TextField('IP白名单', blank=True, default='')
    
    notes = models.TextField('备注', blank=True, default='')
    extra_config = models.JSONField('扩展配置', default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'enterprise_account'
        verbose_name = '企业账号'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['admin_user'], name='idx_ent_admin'),
            models.Index(fields=['status', 'plan_type'], name='idx_ent_status_plan'),
            models.Index(fields=['paid_until'], name='idx_ent_paid_until'),
        ]

    def __str__(self):
        return f'{self.name} [{self.get_plan_type_display()}]'

    @property
    def is_active(self):
        return self.status == 'active'

    @property
    def remaining_balance(self):
        return self.balance

    @property
    def api_calls_remaining(self):
        return max(0, self.api_calls_limit - self.api_calls_used)


class EnterpriseMember(models.Model):
    ROLE_CHOICES = [
        ('owner', '创始人'),
        ('admin', '管理员'),
        ('developer', '开发者'),
        ('analyst', '分析师'),
        ('viewer', '只读用户'),
    ]
    STATUS_CHOICES = [
        ('active', '正常'),
        ('pending', '待接受'),
        ('disabled', '已禁用'),
        ('removed', '已移除'),
    ]

    id = models.BigAutoField(primary_key=True)
    enterprise = models.ForeignKey(EnterpriseAccount, on_delete=models.CASCADE, related_name='members', verbose_name='企业')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='enterprise_memberships', verbose_name='用户')
    role = models.CharField('角色', max_length=15, choices=ROLE_CHOICES, default='developer')
    status = models.CharField('状态', max_length=12, choices=STATUS_CHOICES, default='pending')
    
    department = models.CharField('部门', max_length=50, blank=True, default='')
    position = models.CharField('职位', max_length=50, blank=True, default='')

    api_daily_limit = models.PositiveIntegerField('API日限额', default=500)
    api_monthly_limit = models.PositiveIntegerField('API月限额', default=5000)

    last_login_at = models.DateTimeField('最后登录', null=True, blank=True)
    invited_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='invited_enterprise_members', verbose_name='邀请人')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'enterprise_member'
        verbose_name = '企业成员'
        verbose_name_plural = verbose_name
        ordering = ['role', '-created_at']
        unique_together = [['enterprise', 'user']]
        indexes = [
            models.Index(fields=['enterprise', 'role'], name='idx_mem_ent_role'),
            models.Index(fields=['user', 'status'], name='idx_mem_user_status'),
        ]

    def __str__(self):
        return f'{self.user.username} @ {self.enterprise.name} ({self.get_role_display()})'


class EnterpriseAPIKey(models.Model):
    KEY_TYPES = [
        ('production', '正式环境'),
        ('sandbox', '测试环境'),
        ('readonly', '只读密钥'),
    ]

    id = models.BigAutoField(primary_key=True)
    enterprise = models.ForeignKey(EnterpriseAccount, on_delete=models.CASCADE, related_name='api_keys', verbose_name='企业')
    name = models.CharField('密钥名称', max_length=50)
    key_type = models.CharField('密钥类型', max_length=15, choices=KEY_TYPES, default='production')
    
    key_hash = models.CharField('密钥Hash', max_length=64, unique=True, db_index=True)
    key_prefix = models.CharField('密钥前缀', max_length=8, default='yjd_')
    key_last_4 = models.CharField('密钥后4位', max_length=4, default='****')

    allowed_endpoints = models.JSONField('允许接口', default=list, blank=True)
    rate_limit_per_minute = models.PositiveSmallIntegerField('分钟限额', default=120)
    daily_quota = models.PositiveIntegerField('日限额', default=5000)
    monthly_quota = models.PositiveIntegerField('月限额', default=50000)

    ip_restrictions = models.TextField('IP限制', blank=True, default='')

    is_active = models.BooleanField('是否启用', default=True)
    expires_at = models.DateTimeField('过期时间', null=True, blank=True)
    last_used_at = models.DateTimeField('最后使用', null=True, blank=True)

    total_calls = models.PositiveIntegerField('总调用次数', default=0)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_api_keys')

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'enterprise_api_key'
        verbose_name = 'API密钥'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.key_prefix}{self.key_last_4} ({self.name})'

    @classmethod
    def generate_key(cls, enterprise, name, key_type='production', created_by=None, **kwargs):
        raw_key = 'yjd_' + ''.join(secrets.choice(string.ascii_lowercase + string.digits) for _ in range(32))
        import hashlib
        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
        
        obj = cls.objects.create(
            enterprise=enterprise,
            name=name,
            key_type=key_type,
            key_hash=key_hash,
            key_prefix='yjd_',
            key_last_4=raw_key[-4:],
            created_by=created_by,
            **kwargs,
        )
        return obj, raw_key


class EnterpriseBatchRecharge(models.Model):
    RECHARGE_TYPE = [
        ('balance', '余额充值'),
        ('api_quota', 'API额额度补充'),
        ('plan_upgrade', '升级套餐'),
        ('extension', '续费延长'),
    ]
    STATUS_CHOICES = [
        ('pending', '待处理'),
        ('approved', '已审核通过'),
        ('completed', '已完成'),
        ('rejected', '已拒绝'),
        ('refunded', '已退款'),
    ]

    id = models.BigAutoField(primary_key=True)
    enterprise = models.ForeignKey(EnterpriseAccount, on_delete=models.CASCADE, related_name='recharges', verbose_name='企业')
    recharge_type = models.CharField('充值类型', max_length=15, choices=RECHARGE_TYPE, default='balance')
    
    amount = models.DecimalField('金额(元)', max_digits=14, decimal_places=2)
    api_calls_added = models.PositiveIntegerField('补充API调用次数', default=0)
    days_added = models.PositiveSmallIntegerField('补充天数', default=0)

    payment_method = models.CharField('支付方式', max_length=20, default='bank_transfer',
                              choices=[('bank_transfer', '银行汇款'), ('alipay', '支付宝'), ('wechat', '微信支付'), ('system', '系统充值')])
    transaction_no = models.CharField('交易号', max_length=64, unique=True, db_index=True)
    invoice_requested = models.BooleanField('是否开票', default=False)
    invoice_no = models.CharField('发票号', max_length=30, blank=True, default='')

    status = models.CharField('状态', max_length=12, choices=STATUS_CHOICES, default='pending')
    reviewed_by = models.CharField('审核人', max_length=30, blank=True, default='')
    review_remark = models.TextField('审核备注', blank=True, default='')

    operator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='batch_recharges', verbose_name='操作员')

    created_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField('处理时间', null=True, blank=True)

    class Meta:
        db_table = 'enterprise_batch_recharge'
        verbose_name = '批量充值'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return f'[{self.get_status_display()}] {self.enterprise.name} ¥{self.amount}'


class EnterpriseUsageLog(models.Model):
    RESOURCE_TYPES = [
        ('api_call', 'API调用'),
        ('skill_execute', '技能执行'),
        ('report_download', '报告下载'),
        ('storage_usage', '存储使用'),
        ('member_seat', '成员位置'),
    ]

    id = models.BigAutoField(primary_key=True)
    enterprise = models.ForeignKey(EnterpriseAccount, on_delete=models.CASCADE, related_name='usage_logs', verbose_name='企业')
    member = models.ForeignKey(EnterpriseMember, on_delete=models.SET_NULL, null=True, blank=True, related_name='usage_logs', verbose_name='操作成员')
    api_key = models.ForeignKey(EnterpriseAPIKey, on_delete=models.SET_NULL, null=True, blank=True, related_name='usage_logs', verbose_name='API密钥')

    resource_type = models.CharField('资源类型', max_length=20, choices=RESOURCE_TYPES)
    endpoint = models.CharField('接口路径', max_length=200, blank=True, default='')
    method = models.CharField('HTTP方法', max_length=10, default='GET')
    
    quantity = models.PositiveIntegerField('消耗量', default=1)
    cost = models.DecimalField('组成本(元)', max_digits=10, decimal_places=4, default=0)

    request_id = models.CharField('请求ID', max_length=64, db_index=True, blank=True, default='')
    response_time_ms = models.PositiveIntegerField('响应时间(ms)', default=0)
    status_code = models.PositiveSmallIntegerField('状态码', default=200)

    user_agent = models.CharField('User-Agent', max_length=300, blank=True, default='')
    ip_address = models.GenericIPAddressField('IP地址', null=True, blank=True)

    extra_data = models.JSONField('扩展数据', default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'enterprise_usage_log'
        verbose_name = '使用日志'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['enterprise', 'resource_type', 'created_at'], name='idx_use_ent_res_time'),
            models.Index(fields=['api_key', 'created_at'], name='idx_use_api_time'),
        ]


class SoftwareCopyrightApplication(models.Model):
    SOFTWARE_TYPES = [
        ('ai_detection_platform', 'AI内容检测平台'),
        ('ai_recommendation_engine', 'AI智能推荐引擎'),
        ('enterprise_security_system', '企业安全管理系统'),
        ('data_monitoring_dashboard', '数据监控可视化平台'),
        ('affiliate_marketing_system', '分销营销系统'),
    ]
    STATUS_CHOICES = [
        ('draft', '草稿'),
        ('submitted', '已提交'),
        ('under_review', '审核中'),
        ('accepted', '已受理'),
        ('certificate_issued', '证书已发'),
        ('rejected', '已驳回'),
    ]

    id = models.BigAutoField(primary_key=True)
    software_name = models.CharField('软件名称', max_length=100)
    software_type = models.CharField('软件类型', max_length=35, choices=SOFTWARE_TYPES)
    
    version = models.CharField('版本号', max_length=10, default='V1.0')
    description = models.TextField('功能描述', blank=True, default='')
    tech_stack = models.CharField('技术栈栈', max_length=200, default='Python/Django/React/TypeScript')
    
    lines_of_code = models.PositiveIntegerField('代码行数(行)', default=0)
    development_start_date = models.DateField('开发完成日期', null=True, blank=True)
    first_public_date = models.DateField('首次发表日期', null=True, blank=True)

    applicant_name = models.CharField('申请人', max_length=50)
    applicant_type = models.CharField('申请人类型', max_length=15, default='corporate',
                               choices=[('individual', '自然人'), ('corporate', '法人'), ('institution', '事业单位')])
    applicant_id = models.CharField('身份证号/号', max_length=20, blank=True, default='')

    registration_number = models.CharField('登记号', max_length=13, blank=True, default='', unique=True)
    certificate_number = models.CharField('证书号', max_length=13, blank=True, default='')

    status = models.CharField('状态', max_length=18, choices=STATUS_CHOICES, default='draft')
    submit_to = models.CharField('提交机关', max_length=20, default='csdncc',
                            choices=[('csdncc', '中国软件登记'), ('sipa', '知产知保'), ('copyright_center', '版权中心')])

    documents = models.JSONField('附件清单', default=list, blank=True)
    source_code_repo = models.URLField('源代码仓库', blank=True, default='')
    screenshots = models.JSONField('截图', default=list, blank=True)

    review_notes = models.TextField('审核意见', blank=True, default='')
    certificate_file = models.FileField('证书文件', upload_to='copyright_certs/', null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'software_copyright_application'
        verbose_name = '软件著保申请'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.software_name} [{self.get_software_type_display()}]'