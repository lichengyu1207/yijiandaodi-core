import uuid
from django.db import models
from django.conf import settings


class CreatorProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='creator_profile')

    display_name = models.CharField(max_length=50, verbose_name='创作者昵称')
    bio = models.TextField(verbose_name='个人简介', blank=True, default='')
    avatar_url = models.URLField(max_length=500, verbose_name='头像URL', blank=True, default='')

    is_verified = models.BooleanField(default=False, verbose_name='是否认证创作者')
    verification_reason = models.CharField(max_length=200, verbose_name='认证理由', blank=True, default='')

    tip_enabled = models.BooleanField(default=True, verbose_name='开启打赏')
    min_tip_amount = models.DecimalField(max_digits=10, decimal_places=2, default=1.00, verbose_name='最低打赏金额(元)')
    suggested_amounts = models.JSONField(default=list, verbose_name='推荐金额列表', help_text='如 [3, 5, 10, 20, 50]')

    thank_you_message = models.TextField(verbose_name='感谢语', blank=True, default='谢谢你的支持！☕ 这对我意义重大！')
    custom_goal = models.CharField(max_length=100, verbose_name='筹款目标描述', blank=True, default='')
    goal_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True, verbose_name='目标金额(元)')

    total_tips_count = models.IntegerField(default=0, verbose_name='总打赏次数')
    total_tips_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name='总打赏金额(元)')
    unique_supporters = models.IntegerField(default=0, verbose_name='独立支持者数')

    monthly_tips_count = models.IntegerField(default=0, verbose_name='本月打赏次数')
    monthly_tips_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0, verbose_name='本月打赏金额(元)')

    social_links = models.JSONField(default=dict, verbose_name='社交链接')
    featured_on = models.JSONField(default=list, verbose_name='展示位置')

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'creator_profile'
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['is_verified']),
            models.Index(fields=['tip_enabled']),
            models.Index(fields=['-total_tips_amount']),
            models.Index(fields=['-created_at']),
        ]

    def __str__(self):
        return f'创作者: {self.display_name}'


class CreatorApplication(models.Model):
    """创作者申请表"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='creator_applications')

    # 申请信息
    display_name = models.CharField(max_length=50, verbose_name='申请昵称')
    bio = models.TextField(verbose_name='个人简介', blank=True, default='')
    reason = models.TextField(verbose_name='申请理由', help_text='为什么想成为创作者？')
    portfolio_url = models.URLField(max_length=500, verbose_name='作品集链接', blank=True, default='')
    social_links = models.JSONField(default=dict, verbose_name='社交账号链接')

    # 申请状态
    status = models.CharField(max_length=20, verbose_name='审核状态', choices=[
        ('pending', '待审核'),
        ('approved', '已通过'),
        ('rejected', '已拒绝'),
    ], default='pending')

    # 审核信息
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_applications',
        verbose_name='审核人'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True, verbose_name='审核时间')
    review_comment = models.TextField(verbose_name='审核备注', blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='申请时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'creator_application'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['status']),
            models.Index(fields=['-created_at']),
        ]

    def __str__(self):
        return f'{self.user.username} 的创作者申请 ({self.status})'


class TipDonation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    creator = models.ForeignKey(CreatorProfile, on_delete=models.CASCADE, related_name='tips_received')
    supporter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='tips_sent')

    amount = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='打赏金额(元)')
    currency = models.CharField(max_length=10, default='CNY', verbose_name='货币')

    message = models.TextField(verbose_name='留言', blank=True, default='')
    is_anonymous = models.BooleanField(default=False, verbose_name='匿名打赏')
    supporter_display_name = models.CharField(max_length=50, verbose_name='支持者显示名', blank=True, default='')

    source_page = models.CharField(max_length=50, verbose_name='来源页面', choices=[
        ('unified_scan', '全品类检测报告'),
        ('dual_engine', '双引擎检测报告'),
        ('chapter_detect', '论文检测报告'),
        ('copyscape', '抄袭检测报告'),
        ('grammarly', '语法纠错报告'),
        ('resume', '简历优化报告'),
        ('anti_fraud', '反欺诈报告'),
        ('profile', '创作者主页'),
        ('other', '其他页面'),
    ], default='other')
    source_id = models.CharField(max_length=100, verbose_name='来源记录ID', blank=True, default='')

    status = models.CharField(max_length=20, verbose_name='状态', choices=[
        ('pending', '待支付'),
        ('completed', '已完成'),
        ('failed', '支付失败'),
        ('refunded', '已退款'),
    ], default='pending')

    payment_method = models.CharField(max_length=30, verbose_name='支付方式', choices=[
        ('wechat', '微信支付'),
        ('alipay', '支付宝'),
        ('balance', '余额支付'),
        ('test', '测试支付'),
    ], default='wechat')
    transaction_id = models.CharField(max_length=100, verbose_name='交易流水号', blank=True, default='')

    ip_address = models.GenericIPAddressField(verbose_name='IP地址', null=True, blank=True)
    user_agent = models.TextField(verbose_name='User-Agent', blank=True, default='')

    creator_reply = models.TextField(verbose_name='创作者回复', blank=True, default='')
    replied_at = models.DateTimeField(null=True, blank=True, verbose_name='回复时间')

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'tip_donation'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['creator']),
            models.Index(fields=['supporter']),
            models.Index(fields=['status']),
            models.Index(fields=['-amount']),
            models.Index(fields=['source_page']),
            models.Index(fields=['-created_at']),
        ]

    def __str__(self):
        return f'打赏 ¥{self.amount} → {self.creator.display_name}'
