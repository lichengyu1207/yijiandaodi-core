from django.db import models
from django.conf import settings


class UserBehaviorLog(models.Model):
    ACTION_CHOICES = [
        ('click', '点击'),
        ('view', '浏览'),
        ('select', '选择'),
        ('execute', '执行'),
        ('favorite', '收藏'),
        ('share', '分享'),
    ]

    TARGET_TYPE_CHOICES = [
        ('skill', '技能'),
        ('article', '文章'),
        ('promo', '推广卡片'),
        ('scenario', '场景'),
    ]

    id = models.BigAutoField(primary_key=True)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='behavior_logs', null=True, blank=True, verbose_name='\u7528\u6237')
    session_id = models.CharField('会话ID', max_length=64, db_index=True, default='')
    target_type = models.CharField('目标类型', max_length=20, choices=TARGET_TYPE_CHOICES, default='skill')
    target_id = models.PositiveIntegerField('目标ID', db_index=True)
    action = models.CharField('行为类型', max_length=20, choices=ACTION_CHOICES, default='click')
    skill_tier = models.CharField('技能层级', max_length=30, blank=True, default='')
    skill_category = models.CharField('技能分类', max_length=50, blank=True, default='')
    scenario = models.CharField('关联场景', max_length=50, blank=True, default='')
    source_page = models.CharField('来源页面', max_length=50, blank=True, default='')
    duration_seconds = models.PositiveIntegerField('停留时长(秒)', default=0)
    ip_address = models.GenericIPAddressField('IP地址', null=True, blank=True)
    user_agent = models.TextField('User-Agent', blank=True, default='')
    extra_data = models.JSONField('扩展数据', default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'user_behavior_log'
        verbose_name = '用户行为日志'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'target_type', 'target_id'], name='idx_user_target'),
            models.Index(fields=['session_id', 'target_type'], name='idx_session_target'),
            models.Index(fields=['skill_tier', 'created_at'], name='idx_tier_time'),
            models.Index(fields=['action', 'created_at'], name='idx_action_time'),
        ]

    def __str__(self):
        return f'{self.user_id or "anon"}-{self.action}-{self.target_type}:{self.target_id}'


class UserProfile(models.Model):
    id = models.BigAutoField(primary_key=True)
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='recommend_profile', verbose_name='\u7528\u6237')

    preferred_tiers = models.JSONField('偏好层级列表', default=list, blank=True)
    preferred_categories = models.JSONField('偏好分类列表', default=list, blank=True)
    preferred_scenarios = models.JSONField('偏好场景列表', default=list, blank=True)

    total_clicks = models.PositiveIntegerField('总点击次数', default=0)
    total_executions = models.PositiveIntegerField('总执行次数', default=0)
    active_days = models.PositiveIntegerField('活跃天数', default=1)
    last_active_at = models.DateTimeField('最后活跃时间', auto_now=True)

    is_vip = models.BooleanField('是否VIP会员', default=False)
    vip_level = models.PositiveSmallIntegerField('会员等级', default=0, choices=[(0, '普通'), (1, '基础'), (2, '高级'), (3, '企业')])

    conversion_count = models.PositiveIntegerField('付费转化次数', default=0)

    # P1-4 个性化数据持久化（主题 / 布局 / 收藏）：跨端（桌面端/官网）登录态互通
    theme = models.CharField('个性化主题', max_length=32, blank=True, default='')
    layout = models.JSONField('界面布局偏好', default=dict, blank=True)
    favorites = models.JSONField('收藏列表', default=list, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_recommend_profile'
        verbose_name = '用户推荐画像'
        verbose_name_plural = verbose_name

    def __str__(self):
        return f'{self.user.username}画像-L{self.vip_level}'
