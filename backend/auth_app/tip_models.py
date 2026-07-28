from django.db import models
from django.conf import settings


class TipRecord(models.Model):
    TIP_STATUS_CHOICES = [
        ('pending', '待支付'),
        ('paid', '已支付'),
        ('failed', '支付失败'),
        ('refunded', '已退款'),
    ]

    TIP_OPTION_CHOICES = [
        ('coffee', '咖啡 ¥3'),
        ('tea', '奶茶 ¥5'),
        ('lunch', '午餐 ¥15'),
        ('dinner', '晚餐 ¥30'),
        ('movie', '电影 ¥50'),
        ('custom', '自定义'),
    ]

    id = models.BigAutoField(primary_key=True)

    from_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_tips',
        verbose_name='打赏者'
    )

    to_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='received_tips',
        verbose_name='接收者'
    )

    content_type = models.CharField(
        max_length=50,
        blank=True,
        default='',
        verbose_name='内容类型',
        help_text='article/user/page等'
    )
    content_id = models.IntegerField(
        null=True,
        blank=True,
        verbose_name='内容ID'
    )

    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=3.00,
        verbose_name='金额(元)'
    )
    currency = models.CharField(
        max_length=10,
        default='CNY',
        verbose_name='货币'
    )

    tip_option = models.CharField(
        max_length=20,
        default='coffee',
        choices=TIP_OPTION_CHOICES,
        verbose_name='打赏选项'
    )

    message = models.TextField(
        blank=True,
        default='',
        verbose_name='留言',
        help_text='打赏时的公开留言'
    )

    is_public = models.BooleanField(
        default=True,
        verbose_name='是否公开显示'
    )

    order = models.OneToOneField(
        'auth_app.PaymentOrder',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='tip_record',
        verbose_name='关联订单'
    )

    status = models.CharField(
        max_length=20,
        default='pending',
        choices=TIP_STATUS_CHOICES,
        verbose_name='状态'
    )

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    paid_at = models.DateTimeField(null=True, blank=True, verbose_name='支付时间')

    class Meta:
        db_table = 'tip_record'
        verbose_name = '打赏记录'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['to_user', '-created_at'], name='idx_tip_receiver'),
            models.Index(fields=['from_user', '-created_at'], name='idx_tip_sender'),
            models.Index(fields=['status'], name='idx_tip_status'),
        ]

    def __str__(self):
        return f'#{self.id} {self.from_user.username} → {self.to_user.username} ¥{self.amount} [{self.get_status_display()}]'
