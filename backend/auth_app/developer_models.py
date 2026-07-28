import secrets
import string
import hashlib
from django.db import models
from django.conf import settings


class DeveloperApplication(models.Model):
    """API开发者申请表"""
    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='developer_applications')

    # 申请信息
    company = models.CharField('公司/组织', max_length=100, blank=True, default='')
    website = models.URLField('网站', blank=True, default='')
    contact_email = models.EmailField('联系邮箱', blank=True, default='')
    use_case = models.TextField('使用场景描述', max_length=500, blank=True, default='')
    reason = models.TextField('申请理由', max_length=500, help_text='为什么需要API访问权限？')

    # 申请套餐
    requested_tier = models.CharField('申请套餐', max_length=15, choices=[
        ('free', '免费版'),
        ('pro', '专业版'),
        ('team', '团队版'),
    ], default='free')

    # 申请状态
    status = models.CharField('审核状态', max_length=20, choices=[
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
        related_name='reviewed_developer_applications',
        verbose_name='审核人'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True, verbose_name='审核时间')
    review_comment = models.TextField('审核备注', blank=True, default='')

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='申请时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'developer_application'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user']),
            models.Index(fields=['status']),
            models.Index(fields=['-created_at']),
        ]

    def __str__(self):
        return f'{self.user.username} 的API申请 ({self.status})'


class DeveloperAccount(models.Model):
    TIER_CHOICES = [
        ('free', '免费版'),
        ('pro', '专业版(¥99/月)'),
        ('team', '团队版(¥299/月)'),
        ('unlimited', '无限版'),
    ]
    STATUS_CHOICES = [
        ('active', '正常'),
        ('suspended', '已停用'),
        ('expired', '已过期'),
    ]

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='developer_account', verbose_name='用户')
    company = models.CharField('公司/组织', max_length=100, blank=True, default='')
    website = models.URLField('网站', blank=True, default='')
    contact_email = models.EmailField('联系邮箱', blank=True, default='')
    use_case = models.TextField('使用场景描述', max_length=500, blank=True, default='')

    tier = models.CharField('套餐等级', max_length=15, choices=TIER_CHOICES, default='free')
    status = models.CharField('状态', max_length=12, choices=STATUS_CHOICES, default='active')

    daily_quota = models.PositiveIntegerField('日调用限额', default=100)
    monthly_quota = models.PositiveIntegerField('月调用限额', default=3000)
    calls_today = models.PositiveIntegerField('今日已用', default=0)
    calls_this_month = models.PositiveIntegerField('本月已用', default=0)
    calls_today_date = models.DateField('今日日期（用于重置）', null=True, blank=True)

    total_calls = models.PositiveIntegerField('累计调用次数', default=0)
    webhook_url = models.URLField('回调通知URL', blank=True, default='')
    extra_config = models.JSONField('扩展配置', default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'developer_account'
        verbose_name = '开发者账号'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user'], name='idx_dev_user'),
            models.Index(fields=['status', 'tier'], name='idx_dev_status_tier'),
        ]

    def __str__(self):
        return f'{self.user.username} [{self.get_tier_display()}]'

    @property
    def remaining_daily(self):
        return max(0, self.daily_quota - self.calls_today)

    @property
    def remaining_monthly(self):
        return max(0, self.monthly_quota - self.calls_this_month)


class DeveloperAPIKey(models.Model):
    KEY_TYPES = [
        ('production', '正式环境'),
        ('sandbox', '测试环境'),
    ]

    developer = models.ForeignKey(DeveloperAccount, on_delete=models.CASCADE, related_name='api_keys', verbose_name='开发者')
    name = models.CharField('密钥名称', max_length=50)
    key_type = models.CharField('密钥类型', max_length=15, choices=KEY_TYPES, default='production')

    key_hash = models.CharField('密钥Hash(SHA-256)', max_length=64, unique=True, db_index=True)
    key_prefix = models.CharField('密钥前缀', max_length=8, default='yjdp_')
    key_last_4 = models.CharField('密钥后4位', max_length=4, default='****')

    allowed_apis = models.JSONField('允许调用的API列表', default=list, blank=True)
    rate_limit_per_minute = models.PositiveSmallIntegerField('分钟速率限制', default=60)
    daily_quota = models.PositiveIntegerField('日限额（覆盖账号默认）', default=0)

    ip_whitelist = models.TextField('IP白名单（空=不限制）', blank=True, default='')
    is_active = models.BooleanField('是否启用', default=True)
    expires_at = models.DateTimeField('过期时间', null=True, blank=True)
    last_used_at = models.DateTimeField('最后使用时间', null=True, blank=True)
    last_used_ip = models.GenericIPAddressField('最后使用IP', null=True, blank=True)

    total_calls = models.PositiveIntegerField('总调用次数', default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    revoked_at = models.DateTimeField('撤销时间', null=True, blank=True)

    class Meta:
        db_table = 'developer_api_key'
        verbose_name = '开发者API密钥'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.key_prefix}{self.key_last_4} ({self.name})'

    @classmethod
    def generate_key(cls, developer, name, key_type='production', **kwargs):
        raw_key = 'yjdp_' + ''.join(secrets.choice(string.ascii_lowercase + string.digits) for _ in range(32))
        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
        obj = cls.objects.create(
            developer=developer,
            name=name,
            key_type=key_type,
            key_hash=key_hash,
            key_prefix='yjdp_',
            key_last_4=raw_key[-4:],
            **kwargs,
        )
        return obj, raw_key

    @classmethod
    def authenticate(cls, raw_key):
        if not raw_key or not raw_key.startswith('yjdp_'):
            return None
        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
        try:
            return cls.objects.select_related('developer__user').get(
                key_hash=key_hash,
                is_active=True,
                revoked_at__isnull=True,
            )
        except cls.DoesNotExist:
            return None


class DeveloperUsageLog(models.Model):
    API_TYPES = [
        ('detect_text', 'AI文本检测'),
        ('detect_image', 'AI图像检测'),
        ('agent_chat', 'Agent对话'),
        ('rag_search', 'RAG检索'),
        ('rag_ask', 'RAG问答'),
        ('skill_execute', '技能执行'),
    ]
    STATUS_CHOICES = [
        ('success', '成功'),
        ('rate_limited', '限流'),
        ('auth_failed', '认证失败'),
        ('quota_exceeded', '配额耗尽'),
        ('server_error', '服务端错误'),
    ]

    api_key = models.ForeignKey(DeveloperAPIKey, on_delete=models.SET_NULL, null=True, related_name='usage_logs', verbose_name='API密钥')
    developer = models.ForeignKey(DeveloperAccount, on_delete=models.SET_NULL, null=True, related_name='usage_logs', verbose_name='开发者')

    api_type = models.CharField('API类型', max_length=20, choices=API_TYPES)
    endpoint = models.CharField('接口路径', max_length=200, blank=True, default='')
    method = models.CharField('HTTP方法', max_length=10, default='POST')

    request_id = models.CharField('请求ID', max_length=64, db_index=True, blank=True, default='')
    input_preview = models.CharField('输入摘要', max_length=200, blank=True, default='')
    response_time_ms = models.PositiveIntegerField('响应时间(ms)', default=0)
    status_code = models.PositiveSmallIntegerField('HTTP状态码', default=200)
    status = models.CharField('状态', max_length=15, choices=STATUS_CHOICES, default='success')

    tokens_used = models.PositiveIntegerField('消耗Token数', default=0)
    cost = models.DecimalField('费用(元)', max_digits=10, decimal_places=4, default=0)

    ip_address = models.GenericIPAddressField('客户端IP', null=True, blank=True)
    user_agent = models.CharField('User-Agent', max_length=300, blank=True, default='')
    error_message = models.CharField('错误信息', max_length=500, blank=True, default='')

    extra_data = models.JSONField('扩展数据', default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'developer_usage_log'
        verbose_name = '开发者调用日志'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['api_key', 'created_at'], name='idx_dul_api_time'),
            models.Index(fields=['developer', 'api_type', 'created_at'], name='idx_dul_dev_api_time'),
            models.Index(fields=['api_type', 'status', 'created_at'], name='idx_dul_api_status_time'),
        ]


class APICallRateLimit(models.Model):
    api_key_id = models.IntegerField('API Key ID')
    window_start = models.DateTimeField('窗口开始时间')
    count = models.PositiveIntegerField('窗口内调用次数', default=1)

    class Meta:
        db_table = 'api_call_rate_limit'
        unique_together = [['api_key_id', 'window_start']]
