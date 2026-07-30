"""
API Key模型
用户关联、权限、过期时间管理
"""

from django.db import models
from django.conf import settings
from django.utils import timezone
import secrets
import hashlib
from datetime import datetime, timedelta


class APIKey(models.Model):
    """API Key模型"""
    
    # 用户关联
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='api_keys',
        verbose_name='用户'
    )
    
    # API Key信息
    name = models.CharField('密钥名称', max_length=100)
    key_hash = models.CharField('密钥哈希', max_length=64, unique=True)
    key_prefix = models.CharField('密钥前缀', max_length=10, db_index=True)
    
    # 权限
    PERMISSION_CHOICES = [
        ('read', '读取'),
        ('write', '写入'),
        ('delete', '删除'),
    ]
    permissions = models.JSONField('权限列表', default=list)
    
    # 状态
    is_active = models.BooleanField('是否激活', default=True)
    
    # 时间相关
    created_at = models.DateTimeField('创建时间', auto_now_add=True)
    last_used_at = models.DateTimeField('最后使用时间', null=True, blank=True)
    expires_at = models.DateTimeField('过期时间', null=True, blank=True)
    
    # 限流配置
    rate_limit = models.IntegerField('频率限制（次/分钟）', default=100)
    
    # 元数据
    metadata = models.JSONField('元数据', default=dict, blank=True)
    
    class Meta:
        db_table = 'auth_api_key'
        verbose_name = 'API密钥'
        verbose_name_plural = 'API密钥'
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.name} ({self.key_prefix}...)"
    
    @classmethod
    def generate_key(cls):
        """生成API Key"""
        # 格式: yijia_sk_live_{random_32_chars}
        random_part = secrets.token_urlsafe(24)
        api_key = f"yijia_sk_live_{random_part}"
        return api_key
    
    @classmethod
    def create_for_user(cls, user, name, permissions=None, expires_in_days=365):
        """为用户创建API Key"""
        # 生成原始密钥
        raw_key = cls.generate_key()
        
        # 计算哈希
        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
        
        # 提取前缀（用于快速查找）
        key_prefix = raw_key[:10]
        
        # 设置权限
        if permissions is None:
            permissions = ['read']
        
        # 计算过期时间
        expires_at = None
        if expires_in_days:
            expires_at = timezone.now() + timedelta(days=expires_in_days)
        
        # 创建记录
        api_key_obj = cls.objects.create(
            user=user,
            name=name,
            key_hash=key_hash,
            key_prefix=key_prefix,
            permissions=permissions,
            expires_at=expires_at
        )
        
        return api_key_obj, raw_key
    
    def verify_key(self, raw_key):
        """验证API Key"""
        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
        return self.key_hash == key_hash
    
    def has_permission(self, permission):
        """检查是否有指定权限"""
        return permission in self.permissions
    
    def is_expired(self):
        """检查是否过期"""
        if self.expires_at is None:
            return False
        return timezone.now() > self.expires_at
    
    def update_last_used(self):
        """更新最后使用时间"""
        self.last_used_at = timezone.now()
        self.save(update_fields=['last_used_at'])


class APIKeyUsageLog(models.Model):
    """API Key使用日志"""
    
    api_key = models.ForeignKey(
        APIKey,
        on_delete=models.CASCADE,
        related_name='usage_logs',
        verbose_name='API密钥'
    )
    
    # 请求信息
    endpoint = models.CharField('端点', max_length=200)
    method = models.CharField('方法', max_length=10)
    status_code = models.IntegerField('状态码')
    response_time_ms = models.IntegerField('响应时间（毫秒）')
    
    # 时间戳
    timestamp = models.DateTimeField('时间', auto_now_add=True)
    
    # 元数据
    ip_address = models.GenericIPAddressField('IP地址', null=True, blank=True)
    user_agent = models.CharField('用户代理', max_length=255, blank=True)
    
    class Meta:
        db_table = 'auth_api_key_usage_log'
        verbose_name = 'API密钥使用日志'
        verbose_name_plural = 'API密钥使用日志'
        ordering = ['-timestamp']
    
    def __str__(self):
        return f"{self.api_key.name} - {self.method} {self.endpoint}"