from django.db import models
from django.conf import settings


class FrontendUserManager(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='frontend_profile',
        verbose_name='关联用户'
    )
    nickname = models.CharField(max_length=100, blank=True, default='', verbose_name='昵称')
    phone = models.CharField(max_length=20, blank=True, default='', verbose_name='手机号')
    avatar = models.URLField(blank=True, default='', verbose_name='头像')
    login_count = models.IntegerField(default=0, verbose_name='登录次数')
    last_login_ip = models.GenericIPAddressField(null=True, blank=True, verbose_name='最后登录IP')
    is_banned = models.BooleanField(default=False, verbose_name='是否禁用')
    ban_reason = models.CharField(max_length=500, blank=True, default='', verbose_name='禁用原因')
    banned_at = models.DateTimeField(null=True, blank=True, verbose_name='禁用时间')
    banned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='banned_users',
        verbose_name='禁用人'
    )
    remark = models.TextField(blank=True, default='', verbose_name='备注')

    class Meta:
        db_table = 'system_frontend_user_manager'
        verbose_name = '前台用户管理'
        verbose_name_plural = '前台用户管理'

    def __str__(self):
        return f"{self.user.username} ({self.nickname or '未设置昵称'})"


class UserBrowseRecord(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='browse_records',
        verbose_name='用户'
    )
    page_url = models.CharField(max_length=500, verbose_name='页面URL')
    page_title = models.CharField(max_length=200, blank=True, default='', verbose_name='页面标题')
    ip_address = models.GenericIPAddressField(verbose_name='IP地址')
    stay_duration = models.IntegerField(default=0, verbose_name='停留时长(秒)')
    created_at = models.DateTimeField(db_index=True, verbose_name='访问时间')

    class Meta:
        db_table = 'system_user_browse_record'
        verbose_name = '用户浏览记录'
        verbose_name_plural = '用户浏览记录'
        ordering = ['-created_at']


class SystemSecurityConfig(models.Model):
    CONFIG_KEY_CHOICES = [
        ('token_expire_seconds', 'Token过期时间(秒)'),
        ('session_timeout_seconds', '会话超时时间(秒)'),
        ('api_whitelist', '接口白名单'),
        ('password_min_length', '密码最小长度'),
        ('password_require_uppercase', '密码需要大写字母'),
        ('password_require_lowercase', '密码需要小写字母'),
        ('password_require_digit', '密码需要数字'),
        ('password_require_special', '密码需要特殊字符'),
        ('default_password', '初始默认密码'),
        ('log_retention_days', '日志保留天数'),
        ('max_login_attempts', '最大登录尝试次数'),
        ('login_lockout_minutes', '登录锁定分钟数'),
    ]

    config_key = models.CharField(max_length=50, unique=True, verbose_name='配置键')
    config_value = models.TextField(verbose_name='配置值')
    config_type = models.CharField(
        max_length=10,
        choices=[('string', '字符串'), ('int', '整数'), ('json', 'JSON'), ('bool', '布尔')],
        default='string',
        verbose_name='值类型'
    )
    description = models.CharField(max_length=200, blank=True, default='', verbose_name='描述')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='更新人'
    )

    class Meta:
        db_table = 'system_security_config'
        verbose_name = '系统安全配置'
        verbose_name_plural = '系统安全配置'

    def __str__(self):
        return f"{self.get_config_key_display()}: {self.config_value}"
