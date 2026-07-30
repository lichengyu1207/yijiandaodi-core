from django.db import models
from django.conf import settings


class AffiliateRelationship(models.Model):
    id = models.BigAutoField(primary_key=True)
    inviter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='affiliate_invited', verbose_name='\u9080\u8bf7\u4eba')
    invitee = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='affiliate_inviter', verbose_name='\u88ab\u9080\u8bf7\u4eba')
    invite_code = models.CharField('\u9080\u8bf7\u7801', max_length=20, db_index=True, unique=True)
    status = models.CharField('\u72b6\u6001', max_length=15, default='active',
                               choices=[('active', '\u6709\u6548'), ('disabled', '\u505c\u7528')])

    total_commission = models.DecimalField('\u7d2f\u8ba1\u4f63\u91d1(\u5143)', max_digits=12, decimal_places=2, default=0)
    withdrawn_amount = models.DecimalField('\u5df2\u63d0\u73b0\u91d1\u989d(\u5143)', max_digits=12, decimal_places=2, default=0)
    pending_amount = models.DecimalField('\u5f85\u7ed3\u7b97\u91d1\u989d(\u5143)', max_digits=12, decimal_places=2, default=0)

    invitee_first_order_at = models.DateTimeField('\u88ab\u9080\u9996\u6b21\u4ed8\u6b3e\u65f6\u95f4', null=True, blank=True)
    total_invitee_orders = models.PositiveIntegerField('\u88ab\u9080\u4eba\u603b\u8ba2\u5355\u6570', default=0)
    total_invitee_spent = models.DecimalField('\u88ab\u9080\u4eba\u603b\u6d88\u8d39(\u5143)', max_digits=12, decimal_places=2, default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'affiliate_relationship'
        verbose_name = '\u5206\u9500\u5173\u7cfb'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['inviter', 'status'], name='idx_inviter_status'),
            models.Index(fields=['invite_code'], name='idx_invite_code'),
        ]

    def __str__(self):
        return f'{self.inviter.username} -> {self.invitee.username} [{self.status}]'

    @property
    def available_withdraw(self):
        return max(self.total_commission - self.withdrawn_amount - self.pending_amount, 0)


class CommissionRecord(models.Model):
    COMMISSION_STATUS = [
        ('pending', '\u5f85\u7ed3\u7b97'),
        ('settled', '\u5df2\u7ed3\u7b97'),
        ('withdrawn', '\u5df2\u63d0\u73b0'),
        ('cancelled', '\u5df2\u53d6\u6d88'),
    ]

    id = models.BigAutoField(primary_key=True)
    affiliate = models.ForeignKey(AffiliateRelationship, on_delete=models.CASCADE, related_name='commissions', verbose_name='\u5206\u9500\u5173\u7cfb')
    order = models.ForeignKey('auth_app.PaymentOrder', on_delete=models.SET_NULL, null=True, blank=True, related_name='commission_records', verbose_name='\u5173\u8054\u8ba2\u5355')

    commission_rate = models.DecimalField('\u4f63\u91d1\u6bd4\u4f8b(%)', max_digits=5, decimal_places=2, default=20.00)
    order_amount = models.DecimalField('\u8ba2\u5355\u91d1\u989d(\u5143)', max_digits=10, decimal_places=2, default=0)
    commission_amount = models.DecimalField('\u4f63\u91d1\u91d1\u989d(\u5143)', max_digits=10, decimal_places=2, default=0)

    status = models.CharField('\u72b6\u6001', max_length=15, default='pending', choices=COMMISSION_STATUS)
    settle_at = models.DateTimeField('\u7ed3\u7b97\u65f6\u95f4', null=True, blank=True)
    withdraw_at = models.DateTimeField('\u63d0\u73b0\u65f6\u95f4', null=True, blank=True)

    remark = models.TextField('\u5907\u6ce8', blank=True, default='')
    extra_data = models.JSONField('\u6269\u5c55\u6570\u636e', default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'commission_record'
        verbose_name = '\u4f63\u91d1\u8bb0\u5f55'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['affiliate', 'status'], name='idx_aff_status'),
            models.Index(fields=['status', 'created_at'], name='idx_status_time'),
        ]

    def __str__(self):
        return f'#{self.id} \u00a5{self.commission_amount} ({self.get_status_display()})'


class AffiliateWithdrawalRecord(models.Model):
    WITHDRAWAL_STATUS = [
        ('pending', '\u5ba1\u6838\u4e2d'),
        ('approved', '\u5df2\u901a\u8fc7'),
        ('completed', '\u5df2\u5230\u8d26'),
        ('rejected', '\u5df2\u62d2\u7edd'),
    ]

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='withdrawals', verbose_name='\u7528\u6237', null=True, blank=True)
    affiliate_rel = models.ForeignKey(AffiliateRelationship, on_delete=models.CASCADE, related_name='withdrawals', verbose_name='\u5206\u9500\u5173\u7cfb', null=True, blank=True)

    amount = models.DecimalField('\u63d0\u73b0\u91d1\u989d(\u5143)', max_digits=10, decimal_places=2)
    fee = models.DecimalField('\u624b\u7eed\u8d39(\u5143)', max_digits=8, decimal_places=2, default=0)
    actual_amount = models.DecimalField('\u5b9e\u9645\u5230\u8d26(\u5143)', max_digits=10, decimal_places=2, default=0)

    bank_name = models.CharField('\u94f6\u884c\u540d\u79f0', max_length=50, blank=True, default='')
    account_no = models.CharField('\u8d26\u53f7', max_length=30, blank=True, default='')
    account_holder = models.CharField('\u6237\u540d', max_length=30, blank=True, default='')

    status = models.CharField('\u72b6\u6001', max_length=15, default='pending', choices=WITHDRAWAL_STATUS)
    reviewed_by = models.CharField('\u5ba1\u6838\u4eba', max_length=30, blank=True, default='')
    review_remark = models.TextField('\u5ba1\u6838\u5907\u6ce8', blank=True, default='')
    completed_at = models.DateTimeField('\u5b8c\u6210\u65f6\u95f4', null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'affiliate_withdrawal_record'
        verbose_name = '\u63d0\u73b0\u8bb0\u5f55'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return f'W{self.id:06d} \u00a5{self.amount} [{self.get_status_display()}]'


class MembershipPlan(models.Model):
    PLAN_TYPE_CHOICES = [
        ('per_use', '\u6309\u6b21\u4ed8\u8d39(\u00a519)'),
        ('vip_monthly', '\u6708\u5ea6\u4f1a\u5458(\u00a599)'),
        ('vip_yearly_199', '\u5e74\u5ea6\u4f1a\u5458(\u00a5199)'),
        ('vip_yearly_599', '\u5e74\u5ea6\u4f1a\u5458\u5c08\u4eab(\u00a5599)'),
        ('vip_enterprise', '\u4f01\u4e1a\u5b9a\u5236(\u00a55999)'),
        ('combo_security', '\u5b89\u5168\u68c0\u6d4b\u5957\u9910(\u00a5299)'),
        ('combo_content', '\u5185\u5bb9\u5b89\u5168\u5957\u9910(\u00a5398)'),
        ('combo_enterprise_full', '\u4f01\u4e1a\u5168\u666f\u5957\u9910(\u00a52999)'),
    ]

    id = models.BigAutoField(primary_key=True)
    plan_type = models.CharField('\u5957\u9910\u7c7b\u578b', max_length=25, unique=True, choices=PLAN_TYPE_CHOICES)
    plan_name = models.CharField('\u5957\u9910\u540d\u79f0', max_length=50)
    price = models.DecimalField('\u552e\u4ef7(\u5143)', max_digits=10, decimal_places=2)
    original_price = models.DecimalField('\u539f\u4ef7(\u5143)', max_digits=10, decimal_places=2, default=0)
    duration_days = models.PositiveSmallIntegerField('\u6709\u6548\u5929\u6570', default=0, help_text='0=\u6309\u6b21')
    vip_level = models.PositiveSmallIntegerField('\u4f1a\u5458\u7b49\u7ea7', default=0)
    daily_limit = models.PositiveSmallIntegerField('\u6bcf\u65e5\u9650\u989d', default=0, help_text='0=\u65e0\u9650')

    features = models.JSONField('\u529f\u80fd\u5217\u8868', default=list, blank=True)
    skill_categories = models.JSONField('\u5305\u542b\u6280\u80fd\u5206\u7c7b', default=list, blank=True)
    included_skills_count = models.PositiveIntegerField('\u5305\u542b\u6280\u80fd\u6570', default=0)

    is_hot = models.BooleanField('\u70ed\u95e8\u63a8\u8350', default=False)
    is_new = models.BooleanField('\u65b0\u54c1', default=False)
    sort_order = models.PositiveSmallIntegerField('\u6392\u5e8f', default=0)
    is_active = models.BooleanField('\u662f\u5426\u4e0a\u67b6', default=True)

    description = models.TextField('\u63cf\u8ff0', blank=True, default='')
    badge_text = models.CharField('\u6807\u7b7e\u6587\u5b57', max_length=20, blank=True, default='')
    badge_color = models.CharField('\u6807\u7b7e\u989c\u8272', max_length=10, blank=True, default='#165DFF')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'membership_plan'
        verbose_name = '\u4f1a\u5458\u5957\u9910'
        verbose_name_plural = verbose_name
        ordering = ['sort_order', 'price']

    def __str__(self):
        return f'{self.plan_name} \u00a5{self.price}'
