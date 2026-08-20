"""
用户自有 API Key 模型
用户可填写自己的 DeepSeek API Key，调用时优先使用自有 Key，不再消耗平台共享额度。
密钥加密存储（静态加密），按用户隔离，永不返回明文。
"""

from django.db import models
from django.conf import settings
from django.utils import timezone

from .crypto_utils import encrypt_secret, decrypt_secret


class UserProviderKey(models.Model):
    """用户自有第三方 AI Provider API Key"""

    PROVIDER_CHOICES = [
        ('deepseek', 'DeepSeek'),
        ('grok', 'Grok'),
        ('openai', 'OpenAI'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='provider_keys',
        verbose_name='用户'
    )
    provider = models.CharField('服务商', max_length=20, choices=PROVIDER_CHOICES, default='deepseek')
    name = models.CharField('密钥别名', max_length=100, default='')
    key_encrypted = models.CharField('加密密钥', max_length=1024)
    key_suffix = models.CharField('密钥后缀', max_length=8, blank=True, default='')

    is_active = models.BooleanField('是否启用', default=True)
    last_verified_at = models.DateTimeField('最近验证时间', null=True, blank=True)
    last_verified_ok = models.BooleanField('最近验证是否通过', default=False)
    balance = models.CharField('余额', max_length=50, blank=True, default='')
    today_used = models.IntegerField('今日调用次数', default=0)

    created_at = models.DateTimeField('创建时间', auto_now_add=True)
    updated_at = models.DateTimeField('更新时间', auto_now=True)

    class Meta:
        db_table = 'auth_user_provider_key'
        verbose_name = '用户自有API密钥'
        verbose_name_plural = '用户自有API密钥'
        constraints = [
            models.UniqueConstraint(fields=['user', 'provider'], name='uniq_user_provider_key')
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user_id}:{self.provider}:{self.key_suffix}"

    @property
    def decrypted_key(self) -> str:
        """解密后的真实密钥（仅限调用时使用，永不序列化输出）"""
        return decrypt_secret(self.key_encrypted)

    def set_key(self, raw_key: str) -> None:
        """设置明文密钥（自动加密存储 + 提取后缀）"""
        self.key_encrypted = encrypt_secret(raw_key)
        self.key_suffix = raw_key[-6:] if len(raw_key) >= 6 else raw_key[-min(len(raw_key), 4):]

    def mark_verified(self, ok: bool, balance: str = '') -> None:
        self.last_verified_at = timezone.now()
        self.last_verified_ok = ok
        if balance:
            self.balance = balance
        self.save(update_fields=['last_verified_at', 'last_verified_ok', 'balance', 'updated_at'])

    def is_expired(self) -> bool:
        """密钥本身由服务商校验，模型层不做过期判断"""
        return False
