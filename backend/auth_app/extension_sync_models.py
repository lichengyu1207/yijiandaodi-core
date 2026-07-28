"""
浏览器插件数据同步模型

用于存储从浏览器插件同步的录制数据
"""

from django.db import models
from django.conf import settings
import uuid


class ExtensionSession(models.Model):
    """浏览器插件录制会话"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # 关联用户
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='extension_sessions',
        verbose_name='用户'
    )

    # 会话信息
    session_id = models.CharField('会话ID', max_length=100, unique=True)
    title = models.CharField('会话标题', max_length=255, blank=True, default='')

    # 时间信息
    start_time = models.DateTimeField('开始时间')
    end_time = models.DateTimeField('结束时间', null=True, blank=True)

    # 状态
    status = models.CharField(
        '状态',
        max_length=20,
        choices=[
            ('active', '录制中'),
            ('completed', '已完成'),
            ('exported', '已导出'),
        ],
        default='active'
    )

    # 统计信息
    operations_count = models.IntegerField('操作数', default=0)
    fingerprints_count = models.IntegerField('指纹数', default=0)
    platforms_count = models.IntegerField('平台数', default=0)

    # 平台列表（JSON）
    platforms = models.JSONField('平台列表', default=list)

    # 设备信息
    device_id = models.CharField('设备ID', max_length=100, blank=True)
    extension_version = models.CharField('插件版本', max_length=20, blank=True)

    # 时间戳
    created_at = models.DateTimeField('创建时间', auto_now_add=True)
    updated_at = models.DateTimeField('更新时间', auto_now=True)

    class Meta:
        verbose_name = '插件录制会话'
        verbose_name_plural = '插件录制会话'
        ordering = ['-start_time']

    def __str__(self):
        return f'{self.title} ({self.session_id})'


class ExtensionOperation(models.Model):
    """浏览器插件操作记录"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # 关联会话
    session = models.ForeignKey(
        ExtensionSession,
        on_delete=models.CASCADE,
        related_name='operations',
        verbose_name='会话'
    )

    # 操作信息
    operation_id = models.CharField('操作ID', max_length=100)
    operation_type = models.CharField('操作类型', max_length=50)

    # 时间信息
    timestamp = models.DateTimeField('操作时间')
    timestamp_display = models.CharField('显示时间', max_length=50, blank=True)
    timestamp_source = models.CharField('时间来源', max_length=100, default='ntp.ntsc.ac.cn')

    # 平台信息
    platform_name = models.CharField('平台名称', max_length=100)
    platform_type = models.CharField('平台类型', max_length=50)

    # 内容信息
    content_preview = models.TextField('内容预览', blank=True)
    content_hash = models.CharField('内容哈希', max_length=64, blank=True)

    # 页面信息
    page_url = models.URLField('页面URL', max_length=2000, blank=True)
    page_title = models.CharField('页面标题', max_length=255, blank=True)

    # 元数据（JSON）
    metadata = models.JSONField('元数据', default=dict)

    # 时间戳
    created_at = models.DateTimeField('创建时间', auto_now_add=True)

    class Meta:
        verbose_name = '插件操作记录'
        verbose_name_plural = '插件操作记录'
        ordering = ['timestamp']
        indexes = [
            models.Index(fields=['session', 'timestamp']),
            models.Index(fields=['operation_type']),
        ]

    def __str__(self):
        return f'{self.operation_type} @ {self.platform_name}'


class ExtensionFingerprint(models.Model):
    """浏览器插件指纹记录"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # 关联会话
    session = models.ForeignKey(
        ExtensionSession,
        on_delete=models.CASCADE,
        related_name='fingerprints',
        verbose_name='会话'
    )

    # 指纹信息
    hash = models.CharField('哈希值', max_length=64, unique=True)
    prev_hash = models.CharField('前序哈希', max_length=64, default='0')

    # 操作ID
    operation_id = models.CharField('操作ID', max_length=100)

    # 时间信息
    timestamp = models.DateTimeField('生成时间')
    timestamp_display = models.CharField('显示时间', max_length=50, blank=True)

    # 时间戳
    created_at = models.DateTimeField('创建时间', auto_now_add=True)

    class Meta:
        verbose_name = '插件指纹记录'
        verbose_name_plural = '插件指纹记录'
        ordering = ['timestamp']
        indexes = [
            models.Index(fields=['session', 'timestamp']),
            models.Index(fields=['hash']),
        ]

    def __str__(self):
        return f'指纹 {self.hash[:16]}...'


class ExtensionSyncLog(models.Model):
    """浏览器插件同步日志"""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # 关联用户
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='extension_sync_logs',
        verbose_name='用户'
    )

    # 同步信息
    session_id = models.CharField('会话ID', max_length=100)
    sync_type = models.CharField(
        '同步类型',
        max_length=20,
        choices=[
            ('start', '开始录制'),
            ('operation', '操作同步'),
            ('end', '停止录制'),
            ('full', '完整同步'),
        ]
    )

    # 统计
    operations_synced = models.IntegerField('同步操作数', default=0)
    fingerprints_synced = models.IntegerField('同步指纹数', default=0)

    # 设备信息
    device_id = models.CharField('设备ID', max_length=100, blank=True)
    ip_address = models.GenericIPAddressField('IP地址', blank=True, null=True)

    # 状态
    status = models.CharField(
        '状态',
        max_length=20,
        choices=[
            ('success', '成功'),
            ('failed', '失败'),
        ],
        default='success'
    )
    error_message = models.TextField('错误信息', blank=True)

    # 时间戳
    created_at = models.DateTimeField('创建时间', auto_now_add=True)

    class Meta:
        verbose_name = '插件同步日志'
        verbose_name_plural = '插件同步日志'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.sync_type} - {self.session_id}'