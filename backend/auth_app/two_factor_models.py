"""
双因子认证模型
支持TOTP（基于时间的一次性密码）
"""

from django.db import models
from django.conf import settings
import pyotp
import qrcode
import io
import base64
from django.utils import timezone
from datetime import timedelta


class TwoFactorAuth(models.Model):
    """双因子认证配置"""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='two_factor'
    )

    # TOTP配置
    totp_secret = models.CharField('TOTP密钥', max_length=32, blank=True)
    is_enabled = models.BooleanField('是否启用', default=False)
    backup_codes = models.JSONField('备用码', default=list, blank=True)

    # 时间戳
    created_at = models.DateTimeField('创建时间', auto_now_add=True)
    updated_at = models.DateTimeField('更新时间', auto_now=True)
    last_used_at = models.DateTimeField('最后使用时间', null=True, blank=True)

    class Meta:
        db_table = 'auth_two_factor'
        verbose_name = '双因子认证'
        verbose_name_plural = '双因子认证'

    def __str__(self):
        return f'{self.user.username} - {"已启用" if self.is_enabled else "未启用"}'

    def generate_totp_secret(self):
        """生成TOTP密钥"""
        if not self.totp_secret:
            self.totp_secret = pyotp.random_base32()
            self.save()
        return self.totp_secret

    def get_totp(self):
        """获取TOTP实例"""
        if not self.totp_secret:
            self.generate_totp_secret()
        return pyotp.TOTP(self.totp_secret)

    def verify_totp(self, code):
        """验证TOTP代码"""
        if not self.is_enabled or not self.totp_secret:
            return False

        totp = self.get_totp()
        # 允许当前时间和前后30秒的代码
        if totp.verify(code, valid_window=1):
            self.last_used_at = timezone.now()
            self.save(update_fields=['last_used_at'])
            return True
        return False

    def generate_qr_code(self, email):
        """生成二维码"""
        if not self.totp_secret:
            self.generate_totp_secret()

        totp = self.get_totp()
        provisioning_uri = totp.provisioning_uri(
            name=email,
            issuer_name='一鉴到底'
        )

        # 生成二维码
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(provisioning_uri)
        qr.make(fit=True)

        img = qr.make_image(fill_color="black", back_color="white")

        # 转换为base64
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        img_str = base64.b64encode(buffer.getvalue()).decode()

        return f'data:image/png;base64,{img_str}'

    def generate_backup_codes(self):
        """生成备用码"""
        import secrets
        self.backup_codes = [
            secrets.token_hex(4).upper() for _ in range(10)
        ]
        self.save()
        return self.backup_codes

    def verify_backup_code(self, code):
        """验证备用码"""
        if code.upper() in self.backup_codes:
            # 使用后删除备用码
            self.backup_codes.remove(code.upper())
            self.save()
            return True
        return False


class TwoFactorAttempt(models.Model):
    """双因子认证尝试记录"""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='two_factor_attempts'
    )

    attempt_type = models.CharField(
        '尝试类型',
        max_length=20,
        choices=[
            ('totp', 'TOTP验证'),
            ('backup', '备用码验证'),
        ]
    )

    is_success = models.BooleanField('是否成功', default=False)
    ip_address = models.GenericIPAddressField('IP地址', null=True, blank=True)
    user_agent = models.CharField('用户代理', max_length=255, blank=True)

    created_at = models.DateTimeField('创建时间', auto_now_add=True)

    class Meta:
        db_table = 'auth_two_factor_attempt'
        verbose_name = '双因子认证尝试'
        verbose_name_plural = '双因子认证尝试'
        ordering = ['-created_at']

    @classmethod
    def check_rate_limit(cls, user, max_attempts=5, window_minutes=15):
        """检查频率限制"""
        cutoff_time = timezone.now() - timedelta(minutes=window_minutes)
        recent_attempts = cls.objects.filter(
            user=user,
            is_success=False,
            created_at__gte=cutoff_time
        ).count()

        return recent_attempts < max_attempts

    @classmethod
    def log_attempt(cls, user, attempt_type, is_success, request=None):
        """记录尝试"""
        return cls.objects.create(
            user=user,
            attempt_type=attempt_type,
            is_success=is_success,
            ip_address=request.META.get('REMOTE_ADDR') if request else None,
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:255] if request else ''
        )