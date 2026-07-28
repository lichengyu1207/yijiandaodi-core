from django.db import models
from django.conf import settings
from django.utils import timezone


class Product(models.Model):
    CATEGORY_CHOICES = [
        ('template', '模板'),
        ('tool', '工具'),
        ('course', '课程'),
        ('material', '素材'),
    ]
    STATUS_CHOICES = [
        ('draft', '草稿'),
        ('on_sale', '在售'),
        ('off_sale', '下架'),
    ]

    title = models.CharField(max_length=200, verbose_name='标题')
    description = models.TextField(blank=True, default='', verbose_name='描述')
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='template', verbose_name='分类')
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='价格')
    original_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name='原价')
    cover_image = models.URLField(blank=True, default='', verbose_name='封面图')
    images = models.JSONField(default=list, blank=True, verbose_name='图片列表')
    tags = models.JSONField(default=list, blank=True, verbose_name='标签')
    course_meta = models.JSONField(default=dict, blank=True, null=True, verbose_name='课程元信息(大纲/课时/难度)')
    is_hot = models.BooleanField(default=False, verbose_name='是否爆款')
    is_recommend = models.BooleanField(default=False, verbose_name='是否推荐')
    stock = models.IntegerField(default=-1, verbose_name='库存(-1表示无限)')
    sales_count = models.IntegerField(default=0, verbose_name='销量')
    view_count = models.IntegerField(default=0, verbose_name='浏览量')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', verbose_name='状态')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='mall_products',
        null=True,
        blank=True,
        verbose_name='创建者'
    )
    sort_order = models.IntegerField(default=0, verbose_name='排序')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'mall_product'
        verbose_name = '产品'
        verbose_name_plural = '产品'
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class UserFeedback(models.Model):
    RATING_CHOICES = [(1, '1星'), (2, '2星'), (3, '3星'), (4, '4星'), (5, '5星')]
    FEEDBACK_TYPE = [
        ('general', '综合反馈'),
        ('agent_quality', 'Agent回答质量'),
        ('agent_speed', 'Agent响应速度'),
        ('product_suggestion', '产品建议'),
        ('bug_report', '问题反馈'),
    ]

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='feedbacks')

    rating = models.PositiveSmallIntegerField('评分', choices=RATING_CHOICES, default=5)
    feedback_type = models.CharField('反馈类型', max_length=20, choices=FEEDBACK_TYPE, default='general')
    content = models.TextField('反馈内容', blank=True, default='')

    session_id = models.CharField('关联会话ID', max_length=64, blank=True, default='')
    agent_response_time_ms = models.PositiveIntegerField('响应时间(ms)', null=True, blank=True)
    query_text = models.TextField('用户提问', blank=True, default='')
    agent_answer_preview = models.TextField('Agent回答摘要', blank=True, default='', max_length=500)

    is_resolved = models.BooleanField('是否已解决', default=False)
    admin_reply = models.TextField('管理员回复', blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'user_feedback'
        verbose_name = '用户反馈'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at'], name='idx_feedback_user_time'),
            models.Index(fields=['feedback_type'], name='idx_feedback_type'),
            models.Index(fields=['rating'], name='idx_feedback_rating'),
        ]

    def __str__(self):
        return f'Feedback #{self.id} - {self.get_feedback_type_display()} - {self.rating}★'


class Order(models.Model):
    STATUS_CHOICES = [
        ('pending', '待支付'),
        ('paid', '已支付'),
        ('shipped', '已发货'),
        ('completed', '已完成'),
        ('refunded', '已退款'),
        ('cancelled', '已取消'),
    ]
    PAY_METHOD_CHOICES = [
        ('wechat', '微信支付'),
        ('alipay', '支付宝'),
        ('balance', '余额支付'),
    ]

    order_no = models.CharField(max_length=64, unique=True, verbose_name='订单号')
    user_id = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='mall_orders',
        verbose_name='用户'
    )
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='总金额')
    pay_amount = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='实付金额')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name='状态')
    pay_method = models.CharField(max_length=20, choices=PAY_METHOD_CHOICES, blank=True, default='', verbose_name='支付方式')
    pay_time = models.DateTimeField(null=True, blank=True, verbose_name='支付时间')
    shipping_info = models.JSONField(default=dict, blank=True, verbose_name='收货信息')
    remark = models.TextField(blank=True, default='', verbose_name='备注')
    items = models.JSONField(default=list, verbose_name='订单项')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'mall_order'
        verbose_name = '订单'
        verbose_name_plural = '订单'
        ordering = ['-created_at']

    def __str__(self):
        return self.order_no


class PaymentRecord(models.Model):
    METHOD_CHOICES = [
        ('wechat', '微信支付'),
        ('alipay', '支付宝'),
        ('balance', '余额支付'),
    ]
    STATUS_CHOICES = [
        ('pending', '待支付'),
        ('success', '支付成功'),
        ('failed', '支付失败'),
        ('refunded', '已退款'),
    ]

    order_id = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name='payment_records',
        verbose_name='订单'
    )
    trade_no = models.CharField(max_length=128, blank=True, default='', verbose_name='第三方交易号')
    amount = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='金额')
    method = models.CharField(max_length=20, choices=METHOD_CHOICES, verbose_name='支付方式')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name='状态')
    pay_time = models.DateTimeField(null=True, blank=True, verbose_name='支付时间')
    callback_data = models.JSONField(default=dict, blank=True, verbose_name='回调数据')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'mall_payment_record'
        verbose_name = '支付记录'
        verbose_name_plural = '支付记录'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.method} - {self.amount}'


class WithdrawalRecord(models.Model):
    ACCOUNT_TYPE_CHOICES = [
        ('bank', '银行卡'),
        ('alipay', '支付宝'),
        ('wechat', '微信'),
    ]
    STATUS_CHOICES = [
        ('pending', '待审核'),
        ('approved', '已通过'),
        ('rejected', '已拒绝'),
        ('completed', '已完成'),
    ]

    user_id = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='withdrawal_records',
        verbose_name='用户'
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='提现金额')
    account_type = models.CharField(max_length=20, choices=ACCOUNT_TYPE_CHOICES, verbose_name='账户类型')
    account_no = models.CharField(max_length=64, verbose_name='账号')
    account_name = models.CharField(max_length=100, verbose_name='户名')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name='状态')
    handle_remark = models.TextField(blank=True, default='', verbose_name='处理备注')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='申请时间')
    handled_at = models.DateTimeField(null=True, blank=True, verbose_name='处理时间')

    class Meta:
        db_table = 'mall_withdrawal_record'
        verbose_name = '提现记录'
        verbose_name_plural = '提现记录'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.account_name} - {self.amount}'


class HotContentTemplate(models.Model):
    title = models.CharField(max_length=200, verbose_name='标题')
    category = models.CharField(max_length=50, blank=True, default='', verbose_name='分类')
    description = models.TextField(blank=True, default='', verbose_name='描述')
    template_content = models.TextField(verbose_name='模板内容(HTML)')
    usage_count = models.IntegerField(default=0, verbose_name='使用次数')
    rating = models.DecimalField(max_digits=3, decimal_places=1, default=0, verbose_name='评分')
    is_public = models.BooleanField(default=True, verbose_name='是否公开')
    creator_id = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='hot_templates',
        null=True,
        blank=True,
        verbose_name='创建者'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'hot_content_template'
        verbose_name = '爆款内容模板'
        verbose_name_plural = '爆款内容模板'
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class BusinessInquiry(models.Model):
    INQUIRY_TYPE_CHOICES = [
        ('enterprise_rag', '企业RAG部署咨询'),
        ('enterprise_agent', '企业Agent开发咨询'),
        ('ad_cooperation', '广告合作咨询'),
        ('kol_cooperation', 'KOL合作申请'),
    ]
    STATUS_CHOICES = [
        ('pending', '待处理'),
        ('contacted', '已联系'),
        ('converted', '已转化'),
        ('closed', '已关闭'),
    ]

    inquiry_type = models.CharField(max_length=30, choices=INQUIRY_TYPE_CHOICES, verbose_name='咨询类型')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name='状态')

    company = models.CharField(max_length=200, blank=True, default='', verbose_name='公司名称')
    contact_name = models.CharField(max_length=100, verbose_name='联系人')
    phone = models.CharField(max_length=30, blank=True, default='', verbose_name='联系电话')
    email = models.EmailField(blank=True, default='', verbose_name='邮箱')

    requirement = models.TextField(blank=True, default='', verbose_name='需求描述')

    ad_type = models.CharField(max_length=50, blank=True, default='', verbose_name='广告类型')
    budget = models.CharField(max_length=50, blank=True, default='', verbose_name='预算范围')

    kol_target = models.CharField(max_length=100, blank=True, default='', verbose_name='目标合作KOL')
    platform = models.CharField(max_length=50, blank=True, default='', verbose_name='所在平台')
    followers = models.CharField(max_length=50, blank=True, default='', verbose_name='粉丝数量')
    cooperation_intent = models.TextField(blank=True, default='', verbose_name='合作意向')

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name='business_inquiries',
        null=True,
        blank=True,
        verbose_name='提交用户'
    )

    admin_note = models.TextField(blank=True, default='', verbose_name='管理员备注')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='提交时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'business_inquiry'
        verbose_name = '商务咨询'
        verbose_name_plural = '商务咨询'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['inquiry_type', 'status'], name='idx_inquiry_type_status'),
            models.Index(fields=['-created_at'], name='idx_inquiry_created'),
        ]

    def __str__(self):
        return f'{self.get_inquiry_type_display()} - {self.contact_name} - {self.created_at.strftime("%m-%d %H:%M")}'


class ScenarioPackage(models.Model):
    TIER_CHOICES = [
        ('S', 'S级-旗舰场景'),
        ('A', 'A级-核心场景'),
        ('B', 'B级-增强场景'),
        ('C', 'C级-基础场景'),
    ]
    PACKAGE_TYPE_CHOICES = [
        ('combo_sab', 'S+A+B联动套餐'),
        ('combo_sa', 'S+A双核套餐'),
        ('combo_sb', 'S+B快速套餐'),
        ('combo_ab', 'A+B进阶套餐'),
    ]

    name = models.CharField(max_length=200, verbose_name='套餐名称')
    package_type = models.CharField(max_length=20, choices=PACKAGE_TYPE_CHOICES, verbose_name='套餐类型')
    description = models.TextField(verbose_name='套餐描述')
    cover_image = models.URLField(blank=True, default='', verbose_name='封面图')

    s_scenario = models.ForeignKey(
        Product, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='s_in_packages', verbose_name='S级场景产品'
    )
    a_scenario = models.ForeignKey(
        Product, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='a_in_packages', verbose_name='A级场景产品'
    )
    b_scenarios = models.ManyToManyField(
        Product, blank=True, related_name='b_in_packages',
        verbose_name='可选B级场景(选1)'
    )

    original_total_price = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='原价总和')
    package_price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='套餐价格')
    discount_percent = models.PositiveSmallIntegerField(default=60, verbose_name='折扣比例(%)', help_text='相对于单独购买的总价折扣')
    saved_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='节省金额')

    included_features = models.JSONField(default=list, verbose_name='包含权益列表')
    tier_badges = models.JSONField(default=list, verbose_name='等级徽章展示')
    validity_days = models.PositiveIntegerField(default=365, verbose_name='有效期(天)')
    max_users = models.PositiveIntegerField(default=1, verbose_name='最大用户数')

    is_active = models.BooleanField(default=True, verbose_name='是否上架')
    is_featured = models.BooleanField(default=False, verbose_name='是否推荐')
    sort_order = models.IntegerField(default=0, verbose_name='排序权重')
    sales_count = models.IntegerField(default=0, verbose_name='销量')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'scenario_package'
        verbose_name = '场景联动套餐'
        verbose_name_plural = '场景联动套餐'
        ordering = ['sort_order', '-sales_count']

    def __str__(self):
        return f'{self.name} (¥{self.package_price})'

    def save(self, *args, **kwargs):
        if self.original_total_price and self.package_price:
            self.saved_amount = self.original_total_price - self.package_price
            if self.original_total_price > 0:
                self.discount_percent = round(float(self.package_price) / float(self.original_total_price) * 100)
        super().save(*args, **kwargs)


class EnterpriseAuditService(models.Model):
    AUDIT_TIER_CHOICES = [
        ('essential', '基础审计版'),
        ('professional', '专业审计版'),
        ('enterprise', '企业旗舰版'),
        ('flagship', '至尊定制版'),
    ]
    AUDIT_SCOPE_CHOICES = [
        ('ai_content', 'AI内容安全审计'),
        ('agent_security', 'Agent系统安全审计'),
        ('rag_compliance', 'RAG合规性审计'),
        ('data_classification', '数据分类分级审计'),
        ('api_security', 'API接口安全审计'),
        ('full_stack', '全栈安全审计'),
    ]

    name = models.CharField(max_length=200, verbose_name='服务名称')
    audit_tier = models.CharField(max_length=20, choices=AUDIT_TIER_CHOICES, verbose_name='审计级别')
    scope = models.CharField(max_length=30, choices=AUDIT_SCOPE_CHOICES, verbose_name='审计范围')
    description = models.TextField(verbose_name='服务描述')
    deliverables = models.JSONField(default=list, verbose_name='交付物清单')

    base_price = models.DecimalField(max_digits=12, decimal_places=2, verbose_name='基础价格(元/年)')
    min_price = models.DecimalField(max_digits=12, decimal_places=2, default=50000, verbose_name='最低报价(元/年)')
    profit_margin = models.PositiveSmallIntegerField(default=80, verbose_name='利润率(%)')

    audit_days = models.PositiveIntegerField(default=30, verbose_name='审计周期(工作日)')
    on_site_visits = models.PositiveIntegerField(default=1, verbose_name='现场次数')
    report_count = models.PositiveIntegerField(default=4, verbose_name='报告数量')
    includes_remediation = models.BooleanField(default=False, verbose_name='是否含整改建议')
    includes_certification = models.BooleanField(default=False, verbose_name='是否含合规认证辅导')
    includes_training = models.BooleanField(default=False, verbose_name='是否含培训服务')

    target_company_size = models.CharField(max_length=50, blank=True, default='', verbose_name='目标企业规模')
    industry_focus = models.JSONField(default=list, verbose_name='聚焦行业')
    compliance_standards = models.JSONField(default=list, verbose_name='符合标准(等保2.0/ISO27001等)')

    is_active = models.BooleanField(default=True, verbose_name='是否上架')
    is_recommended = models.BooleanField(default=False, verbose_name='是否推荐')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'enterprise_audit_service'
        verbose_name = '企业安全审计服务'
        verbose_name_plural = '企业安全审计服务'
        ordering=['base_price']

    def __str__(self):
        return f'{self.get_audit_tier_display()} | ¥{self.base_price}/年'


class EnterpriseAuditContract(models.Model):
    STATUS_CHOICES = [
        ('inquiry', '咨询中'),
        ('quoting', '报价中'),
        ('negotiating', '洽谈中'),
        ('signed', '已签约'),
        ('auditing', '审计中'),
        ('reporting', '出报告中'),
        ('completed', '已完成'),
        ('renewed', '已续约'),
        ('cancelled', '已取消'),
    ]

    service = models.ForeignKey(
        EnterpriseAuditService, on_delete=models.PROTECT,
        related_name='contracts', verbose_name='审计服务'
    )
    company_name = models.CharField(max_length=200, verbose_name='企业名称')
    contact_person = models.CharField(max_length=100, verbose_name='联系人')
    contact_phone = models.CharField(max_length=30, verbose_name='联系电话')
    contact_email = models.EmailField(verbose_name='联系邮箱')

    contract_no = models.CharField(max_length=64, unique=True, verbose_name='合同编号')
    final_price = models.DecimalField(max_digits=12, decimal_places=2, verbose_name='签约金额(元/年)')
    actual_profit_margin = models.PositiveSmallIntegerField(default=80, verbose_name='实际利润率(%)')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='inquiry', verbose_name='状态')

    start_date = models.DateField(verbose_name='开始日期')
    end_date = models.DateField(null=True, blank=True, verbose_name='结束日期')
    audit_scope_detail = models.JSONField(default=dict, verbose_name='审计范围详情')
    special_requirements = models.TextField(blank=True, default='', verbose_name='特殊要求')

    signed_at = models.DateField(null=True, blank=True, verbose_name='签约时间')
    completed_at = models.DateField(null=True, blank=True, verbose_name='完成时间')
    renewal_count = models.PositiveSmallIntegerField(default=0, verbose_name='续约次数')

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='audit_contracts', verbose_name='关联用户'
    )
    admin_note = models.TextField(blank=True, default='', verbose_name='内部备注')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'enterprise_audit_contract'
        verbose_name = '企业审计合同'
        verbose_name_plural = '企业审计合同'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', '-created_at'], name='idx_audit_status_time'),
            models.Index(fields=['company_name'], name='idx_audit_company'),
        ]

    def __str__(self):
        return f'[{self.contract_no}] {self.company_name} - {self.get_status_display()}'
