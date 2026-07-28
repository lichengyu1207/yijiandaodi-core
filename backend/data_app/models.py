from django.db import models
from django.conf import settings
from django.utils import timezone


class DataExportRecord(models.Model):
    EXPORT_TYPE_CHOICES = [
        ('articles', '文章数据'),
        ('users', '用户数据'),
        ('login_logs', '登录日志'),
    ]

    export_type = models.CharField(max_length=20, choices=EXPORT_TYPE_CHOICES, verbose_name='导出类型')
    file_name = models.CharField(max_length=200, verbose_name='文件名')
    record_count = models.IntegerField(default=0, verbose_name='记录数')
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='export_records',
        verbose_name='导出人'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='导出时间')

    class Meta:
        db_table = 'data_export_record'
        verbose_name = '导出记录'
        verbose_name_plural = '导出记录'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.get_export_type_display()} - {self.file_name}"


class SystemConfig(models.Model):
    key = models.CharField(max_length=100, unique=True, verbose_name='配置键')
    value = models.TextField(default='', verbose_name='配置值')
    value_type = models.CharField(
        max_length=20,
        default='string',
        choices=[('string', '文本'), ('number', '数字'), ('boolean', '布尔'), ('json', 'JSON')],
        verbose_name='值类型'
    )
    description = models.CharField(max_length=200, blank=True, default='', verbose_name='描述')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'data_system_config'
        verbose_name = '系统配置'
        verbose_name_plural = '系统配置'

    def __str__(self):
        return self.key
