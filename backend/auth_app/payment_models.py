from django.db import models
from django.conf import settings


class SkillHotnessSnapshot(models.Model):
    id = models.BigAutoField(primary_key=True)
    skill = models.ForeignKey('auth_app.SkillConfig', on_delete=models.CASCADE, related_name='hotness_snapshots', verbose_name='技能')

    hour_key = models.CharField('小时标识(YYYYMMDDHH)', max_length=12, db_index=True)
    click_count = models.PositiveIntegerField('点击次数', default=0)
    select_count = models.PositiveIntegerField('选择次数', default=0)
    execute_count = models.PositiveIntegerField('执行次数', default=0)
    share_count = models.PositiveIntegerField('分享次数', default=0)

    raw_hotness = models.FloatField('原始热度值', default=0.0)
    normalized_hotness = models.FloatField('归一化热度(0~100)', default=0.0)
    rank = models.PositiveSmallIntegerField('当前排名', default=999)
    trend = models.SmallIntegerField('趋势(-1下降/0平稳/1上升)', default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'skill_hotness_snapshot'
        verbose_name = '技能热度快照'
        verbose_name_plural = verbose_name
        ordering = ['-hour_key', '-normalized_hotness']
        unique_together = [('skill', 'hour_key')]
        indexes = [
            models.Index(fields=['hour_key', '-normalized_hotness'], name='idx_hour_hot'),
            models.Index(fields=['hour_key', 'rank'], name='idx_hour_rank'),
        ]

    def __str__(self):
        return f'#{self.skill_id} {self.skill.name if self.skill else "?"} [{self.hour_key}] 热度:{self.normalized_hotness:.1f} 排名#{self.rank}'


class UserQuota(models.Model):
    id = models.BigAutoField(primary_key=True)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='usage_quota', verbose_name='用户')
    
    free_daily_remaining = models.PositiveSmallIntegerField('免费每日剩余次数', default=3)
    free_daily_limit = models.PositiveSmallIntegerField('免费每日上限', default=3)
    free_used_today = models.PositiveSmallIntegerField('今日已用免费次数', default=0)
    quota_reset_date = models.DateField('配额重置日期', auto_now_add=True)

    is_vip = models.BooleanField('是否VIP会员', default=False)
    vip_level = models.PositiveSmallIntegerField('会员等级', default=0, choices=[(0,'普通'),(1,'基础'),(2,'高级'),(3,'企业')])
    vip_expire_at = models.DateTimeField('会员到期时间', null=True, blank=True)

    total_paid_uses = models.PositiveIntegerField('付费使用总次数', default=0)
    total_free_uses = models.PositiveIntegerField('免费使用总次数', default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_usage_quota'
        verbose_name = '用户使用配额'
        verbose_name_plural = verbose_name

    def __str__(self):
        vip_tag = f'VIP-L{self.vip_level}' if self.is_vip else '普通'
        return f'{self.user.username} | {vip_tag} | 剩余{self.free_daily_remaining}/{self.free_daily_limit}'


class PaymentOrder(models.Model):
    ORDER_STATUS_CHOICES = [
        ('pending', '待支付'),
        ('paid', '已支付'),
        ('failed', '支付失败'),
        ('refunded', '已退款'),
        ('expired', '已过期'),
    ]
    ORDER_TYPE_CHOICES = [
        ('per_use', '\u6309\u6b21\u4ed8\u8d39(\u00a519)'),
        ('vip_monthly', '\u6708\u5ea6\u4f1a\u5458(\u00a599)'),
        ('vip_yearly_199', '\u5e74\u5ea6\u4f1a\u5458(\u00a5199)\u2666\u8d85\u503c'),
        ('vip_yearly_599', '\u5e74\u5ea6\u4f1a\u5458\u4e13\u4eab(\u00a5599)'),
        ('vip_enterprise', '\u4f01\u4e1a\u5b9a\u5236(\u00a55999)'),
        ('combo_security', '\u5b89\u5168\u68c0\u6d4b\u5957\u9910(\u00a5299)'),
        ('combo_content', '\u5185\u5bb9\u5b89\u5168\u5957\u9910(\u00a5398)'),
        ('combo_enterprise_full', '\u4f01\u4e1a\u5168\u666f\u5957\u9910(\u00a52999)'),
        ('vip_monthly_trial', '\u6708\u5ea6\u4f1a\u5458\u9996\u6708\u7279\u60e0(\u00a59.9)'),
        ('digital_prompt_pack', '\u63d0\u793a\u8bcd\u5927\u793c\u5305(\u00a59.9)'),
        ('digital_handbook', '\u5b89\u5168\u5f00\u53d1\u624b\u518c(\u00a519.9)'),
        ('digital_toolkit', '\u4f01\u4e1a\u5b89\u5168\u5de5\u5177\u5305(\u00a529.9)'),
        ('enterprise_rag_deploy', '\u4f01\u4e1a\u79c1\u6709RAG\u90e8\u7f72(\u00a55000\u8d77)'),
        ('enterprise_agent_dev', '\u5b9a\u5236Agent\u5f00\u53d1(\u00a510000\u8d77)'),
        ('course_agent_dev', 'AI Agent\u5f00\u53d1\u5b9e\u6218\u8bfe(\u00a5299)'),
        ('course_rag_intro', 'RAG\u642d\u5efa\u5165\u95e8\u8bfe(\u00a599)'),
        ('ad_cooperation', '\u5e7f\u544a\u5408\u4f5c(\u9762\u8bae)'),
        ('kol_cooperation', 'KOL\u5408\u4f5c(\u9762\u8bae)'),
    ]

    id = models.BigAutoField(primary_key=True)
    order_no = models.CharField('\u8ba2\u5355\u53f7', max_length=40, unique=True, db_index=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='payment_orders', verbose_name='\u7528\u6237')
    order_type = models.CharField('\u8ba2\u5355\u7c7b\u578b', max_length=25, choices=ORDER_TYPE_CHOICES, default='per_use')
    status = models.CharField('\u72b6\u6001', max_length=15, choices=ORDER_STATUS_CHOICES, default='pending')

    amount = models.DecimalField('\u91d1\u989d(\u5143)', max_digits=10, decimal_places=2, default=19.00)
    original_amount = models.DecimalField('\u539f\u4ef7(\u5143)', max_digits=10, decimal_places=2, default=19.00)
    discount_amount = models.DecimalField('\u4f18\u60e0\u989d(\u5143)', max_digits=10, decimal_places=2, default=0)

    pay_channel = models.CharField('\u652f\u4ed8\u6e20\u9053', max_length=20, blank=True, default='', help_text='alipay/wechat/mock')
    pay_trade_no = models.CharField('\u4ea4\u6613\u53f7', max_length=64, blank=True, default='')
    pay_time = models.DateTimeField('\u652f\u4ed8\u65f6\u95f4', null=True, blank=True)

    subject = models.CharField('\u8ba2\u5355\u6807\u9898', max_length=100, default='')
    description = models.TextField('\u63cf\u8ff0', blank=True, default='')
    extra_data = models.JSONField('\u6269\u5c55\u6570\u636e', default=dict, blank=True)

    paid_at = models.DateTimeField('\u652f\u4ed8\u6210\u529f\u65f6\u95f4', null=True, blank=True)
    refunded_at = models.DateTimeField('\u9000\u6b3e\u65f6\u95f4', null=True, blank=True)
    expire_at = models.DateTimeField('\u8fc7\u671f\u65f6\u95f4', null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'payment_order'
        verbose_name = '\u652f\u4ed8\u8ba2\u5355'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at'], name='idx_payment_user_time'),
            models.Index(fields=['status'], name='idx_payment_status'),
            models.Index(fields=['order_type'], name='idx_payment_order_type'),
            models.Index(fields=['user', 'status'], name='idx_payment_user_status'),
        ]

    def __str__(self):
        return f'{self.order_no} [{self.get_status_display()}] ¥{self.amount}'


class FirstOrderPromo(models.Model):
    PROMO_STATUS = [('active', '活动中'), ('paused', '已暂停'), ('expired', '已结束')]

    id = models.BigAutoField(primary_key=True)
    name = models.CharField('活动名称', max_length=100, default='新人首单优惠')

    discount_type = models.CharField('折扣类型', max_length=20, choices=[
        ('percent', '百分比折扣'),
        ('fixed', '固定金额减免'),
    ], default='percent')
    discount_value = models.DecimalField('折扣值', max_digits=10, decimal_places=2, default=50.00)
    max_discount = models.DecimalField('最大优惠金额(元)', max_digits=10, decimal_places=2, default=100.00)
    min_order_amount = models.DecimalField('最低订单金额(元)', max_digits=10, decimal_places=2, default=19.00)

    applicable_types = models.JSONField('适用订单类型', default=list)

    start_time = models.DateTimeField('开始时间')
    end_time = models.DateTimeField('结束时间')

    total_limit = models.PositiveIntegerField('总使用次数限制', default=0, help_text='0=无限制')
    used_count = models.PositiveIntegerField('已使用次数', default=0)
    per_user_limit = models.PositiveIntegerField('每人限用次数', default=1, help_text='每人只能用一次')

    status = models.CharField('状态', max_length=15, choices=PROMO_STATUS, default='active')

    extra_config = models.JSONField('额外配置', default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'first_order_promo'
        verbose_name = '首单优惠活动'
        verbose_name_plural = verbose_name
        indexes = [
            models.Index(fields=['status'], name='idx_promo_status'),
            models.Index(fields=['start_time', 'end_time'], name='idx_promo_time_range'),
            models.Index(fields=['status', 'start_time', 'end_time'], name='idx_promo_active'),
        ]

    def __str__(self):
        return f'{self.name} [{self.get_status_display()}]'


class UserCoupon(models.Model):
    COUPON_STATUS = [('unused', '未使用'), ('used', '已使用'), ('expired', '已过期')]

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='coupons')
    promo = models.ForeignKey(FirstOrderPromo, on_delete=models.CASCADE, related_name='user_coupons')

    coupon_code = models.CharField('优惠码', max_length=32, unique=True, db_index=True)
    status = models.CharField('状态', max_length=15, choices=COUPON_STATUS, default='unused')

    order = models.OneToOneField(PaymentOrder, on_delete=models.SET_NULL, null=True, blank=True,
                                  related_name='used_coupon', verbose_name='使用的订单')
    discount_amount = models.DecimalField('实际优惠金额', max_digits=10, decimal_places=2, default=0)

    used_at = models.DateTimeField('使用时间', null=True, blank=True)
    expire_at = models.DateTimeField('过期时间')

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'user_coupon'
        verbose_name = '用户优惠券'
        verbose_name_plural = verbose_name
        unique_together = [('user', 'promo')]

    def __str__(self):
        return f'{self.coupon_code} [{self.get_status_display()}] {self.user.username}'
