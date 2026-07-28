"""
授权码管理系统
用于控制内测版本的分发和验证
"""

from django.db import models
from django.conf import settings
import uuid
import secrets
import hashlib
from datetime import datetime, timedelta


class LicenseKey(models.Model):
    """授权码"""

    STATUS_CHOICES = [
        ('active', '有效'),
        ('expired', '已过期'),
        ('revoked', '已撤销'),
        ('unused', '未使用'),
    ]

    TYPE_CHOICES = [
        ('beta', '内测版'),
        ('pro', '专业版'),
        ('enterprise', '企业版'),
        ('lifetime', '永久版'),
    ]

    # 基本信息
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    license_key = models.CharField('授权码', max_length=32, unique=True, db_index=True)

    # 授权类型
    license_type = models.CharField('授权类型', max_length=20, choices=TYPE_CHOICES, default='beta')

    # 用户绑定
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='license_keys'
    )
    device_fingerprint = models.CharField('设备指纹', max_length=64, blank=True)
    bound_at = models.DateTimeField('绑定时间', null=True, blank=True)

    # 有效期
    valid_days = models.IntegerField('有效天数', default=30)
    activated_at = models.DateTimeField('激活时间', null=True, blank=True)
    expires_at = models.DateTimeField('过期时间', null=True, blank=True)

    # 状态
    status = models.CharField('状态', max_length=20, choices=STATUS_CHOICES, default='unused')

    # 水印追踪码（用于追踪泄露）
    watermark_code = models.CharField('水印码', max_length=16, unique=True)

    # 使用记录
    last_verify_at = models.DateTimeField('最后验证时间', null=True, blank=True)
    verify_count = models.IntegerField('验证次数', default=0)

    # 备注
    note = models.TextField('备注', blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_licenses'
    )

    # 时间戳
    created_at = models.DateTimeField('创建时间', auto_now_add=True)
    updated_at = models.DateTimeField('更新时间', auto_now=True)

    class Meta:
        db_table = 'auth_license_key'
        ordering = ['-created_at']
        verbose_name = '授权码'
        verbose_name_plural = verbose_name

    def __str__(self):
        return f"{self.license_key[:8]}... ({self.get_status_display()})"

    @classmethod
    def generate_key(cls):
        """生成授权码"""
        # 格式: XXXX-XXXX-XXXX-XXXX
        parts = []
        for _ in range(4):
            parts.append(secrets.token_hex(2).upper())
        return '-'.join(parts)

    @classmethod
    def generate_watermark(cls):
        """生成水印码"""
        return secrets.token_hex(8)

    def activate(self, user=None, device_fingerprint=None):
        """激活授权码"""
        if self.status != 'unused':
            return False, '授权码已被使用'

        self.status = 'active'
        self.activated_at = datetime.now()
        self.expires_at = datetime.now() + timedelta(days=self.valid_days)

        if user:
            self.user = user
        if device_fingerprint:
            self.device_fingerprint = device_fingerprint

        self.bound_at = datetime.now()
        self.save()

        return True, '激活成功'

    def verify(self, device_fingerprint=None):
        """验证授权码"""
        self.verify_count += 1
        self.last_verify_at = datetime.now()
        self.save(update_fields=['verify_count', 'last_verify_at'])

        if self.status == 'revoked':
            return False, '授权码已被撤销'

        if self.status == 'expired' or (self.expires_at and datetime.now() > self.expires_at):
            self.status = 'expired'
            self.save(update_fields=['status'])
            return False, '授权码已过期'

        if self.status == 'unused':
            return False, '授权码未激活'

        # 设备指纹验证（如果已绑定）
        if self.device_fingerprint and device_fingerprint:
            if self.device_fingerprint != device_fingerprint:
                return False, '设备不匹配，授权码已绑定其他设备'

        return True, '验证成功'

    def revoke(self):
        """撤销授权码"""
        self.status = 'revoked'
        self.save(update_fields=['status'])

    def is_valid(self):
        """检查是否有效"""
        if self.status != 'active':
            return False
        if self.expires_at and datetime.now() > self.expires_at:
            return False
        return True


class LicenseVerificationLog(models.Model):
    """授权验证日志"""

    license_key = models.ForeignKey(LicenseKey, on_delete=models.CASCADE, related_name='verification_logs')

    # 验证信息
    device_fingerprint = models.CharField('设备指纹', max_length=64, blank=True)
    ip_address = models.GenericIPAddressField('IP地址', null=True, blank=True)
    user_agent = models.CharField('User-Agent', max_length=500, blank=True)

    # 验证结果
    success = models.BooleanField('是否成功', default=False)
    error_message = models.CharField('错误信息', max_length=200, blank=True)

    # 时间戳
    created_at = models.DateTimeField('验证时间', auto_now_add=True)

    class Meta:
        db_table = 'auth_license_verification_log'
        ordering = ['-created_at']
        verbose_name = '授权验证日志'
        verbose_name_plural = verbose_name

    def __str__(self):
        return f"{self.license_key.license_key[:8]}... - {self.created_at}"