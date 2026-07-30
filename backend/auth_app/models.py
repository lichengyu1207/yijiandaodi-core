from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    def create_user(self, username, email=None, password=None, **extra_fields):
        if not username:
            raise ValueError('用户名必须填写')
        email = self.normalize_email(email)
        user = self.model(username=username, email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, username, email=None, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)
        extra_fields.setdefault('role', 'super_admin')

        if extra_fields.get('is_staff') is not True:
            raise ValueError('超级管理员必须有is_staff=True')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('超级管理员必须有is_superuser=True')

        return self.create_user(username, email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    username = models.CharField(max_length=150, unique=True, verbose_name='用户名')
    email = models.EmailField(blank=True, null=True, verbose_name='邮箱')
    avatar = models.URLField(blank=True, null=True, verbose_name='头像URL')
    role = models.CharField(
        max_length=50,
        default='viewer',
        choices=[
            ('super_admin', '超级管理员'),
            ('admin', '普通管理员'),
            ('editor', '编辑'),
            ('viewer', '访客'),
        ],
        verbose_name='角色'
    )
    is_active = models.BooleanField(default=True, verbose_name='是否激活')
    is_staff = models.BooleanField(default=False, verbose_name='是否员工')
    date_joined = models.DateTimeField(default=timezone.now, verbose_name='注册时间')
    last_login = models.DateTimeField(null=True, blank=True, verbose_name='最后登录')

    objects = UserManager()

    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['email']

    class Meta:
        db_table = 'auth_user'
        verbose_name = '用户'
        verbose_name_plural = '用户'

    def __str__(self):
        return self.username

    def get_full_name(self):
        return self.username

    def get_short_name(self):
        return self.username


class BlacklistedToken(models.Model):
    token = models.TextField(unique=True, verbose_name='Token')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='blacklisted_tokens', verbose_name='用户')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    expires_at = models.DateTimeField(verbose_name='过期时间')

    class Meta:
        db_table = 'auth_token_blacklist'
        verbose_name = 'Token黑名单'
        verbose_name_plural = 'Token黑名单'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.username} - {self.token[:20]}..."


class LoginLog(models.Model):
    STATUS_CHOICES = [
        ('success', '登录成功'),
        ('failed', '登录失败'),
        ('logout', '正常退出'),
        ('timeout', '会话超时'),
        ('kicked', '被踢下线'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='login_logs', verbose_name='账号')
    username = models.CharField(max_length=150, verbose_name='账号', db_index=True, default='')
    ip_address = models.GenericIPAddressField(verbose_name='登录IP', null=True, blank=True)
    device_info = models.CharField(max_length=500, blank=True, default='', verbose_name='登录设备')
    user_agent = models.TextField(blank=True, default='', verbose_name='User-Agent')
    login_time = models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='登录时间')
    logout_time = models.DateTimeField(null=True, blank=True, verbose_name='退出时间')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='success', verbose_name='登录状态')
    message = models.CharField(max_length=500, blank=True, default='', verbose_name='备注信息')
    session_id = models.CharField(max_length=64, blank=True, default='', verbose_name='会话ID')

    class Meta:
        db_table = 'auth_login_log'
        verbose_name = '登录日志'
        verbose_name_plural = '登录日志'
        ordering = ['-login_time']

    def __str__(self):
        return f"{self.username} - {self.get_status_display()} - {self.login_time}"


from .security_models import AgentSecurityRule, AgentRiskLog
from .skill_config_models import SkillConfig
from .user_behavior_models import UserBehaviorLog, UserProfile
from .promo_card_models import PromoCard
from .payment_models import SkillHotnessSnapshot, UserQuota, PaymentOrder
from .affiliate_models import AffiliateRelationship, CommissionRecord, AffiliateWithdrawalRecord, MembershipPlan
from .stats_models import DailyPlatformStats, SkillDailyStats, AreaClickStats, RevenueDailyStats
from .abtest_models import ABTestExperiment, ABTestAssignment, ABTestEvent, PromoCardScheduleRule, PromoCardImpressionLog
from .enterprise_models import EnterpriseAccount, EnterpriseMember, EnterpriseAPIKey, EnterpriseBatchRecharge, EnterpriseUsageLog, SoftwareCopyrightApplication
from .tip_models import TipRecord
