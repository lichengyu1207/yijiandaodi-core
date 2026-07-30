from django.db import models
from django.conf import settings


class PermissionInterceptLog(models.Model):
    INTERCEPT_TYPE_CHOICES = [
        ('menu_unauthorized', '越权访问菜单'),
        ('api_unauthorized', '越权调用接口'),
        ('button_denied', '无权限按钮点击'),
        ('token_expired', 'Token过期访问'),
        ('token_invalid', '无效Token访问'),
        ('rate_limited', '频率限制拦截'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='intercept_logs',
        verbose_name='用户'
    )
    username = models.CharField(max_length=150, blank=True, default='', verbose_name='账号', db_index=True)
    intercept_type = models.CharField(
        max_length=30,
        choices=INTERCEPT_TYPE_CHOICES,
        verbose_name='拦截类型',
        db_index=True
    )
    target_resource = models.CharField(max_length=500, verbose_name='目标资源(菜单/接口/按钮)')
    request_method = models.CharField(max_length=10, blank=True, default='', verbose_name='请求方法')
    request_url = models.CharField(max_length=500, blank=True, default='', verbose_name='请求URL')
    ip_address = models.GenericIPAddressField(verbose_name='IP地址')
    user_agent = models.TextField(blank=True, default='', verbose_name='User-Agent')
    detail = models.TextField(blank=True, default='', verbose_name='拦截详情')
    created_at = models.DateTimeField(db_index=True, verbose_name='拦截时间')

    class Meta:
        db_table = 'log_center_permission_intercept'
        verbose_name = '权限拦截日志'
        verbose_name_plural = '权限拦截日志'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.username or 'Anonymous'} - {self.get_intercept_type_display()} - {self.target_resource}"
