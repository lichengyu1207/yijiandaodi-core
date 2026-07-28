from django.db import models
from django.conf import settings
import uuid
import hashlib
import json


class DeviceFingerprint(models.Model):
    DEVICE_TYPE_CHOICES = [
        ('desktop', '桌面端'),
        ('mobile', '移动端'),
        ('tablet', '平板'),
        ('bot', '机器人/爬虫'),
        ('unknown', '未知'),
    ]
    OS_CHOICES = [
        ('windows', 'Windows'), ('macos', 'macOS'), ('linux', 'Linux'),
        ('android', 'Android'), ('ios', 'iOS'), ('unknown', '未知'),
    ]
    RISK_LEVEL_CHOICES = [
        ('safe', '安全'), ('low_risk', '低风险'),
        ('medium_risk', '中风险'), ('high_risk', '高风险'),
        ('blocked', '已封禁'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    fingerprint_hash = models.CharField(max_length=64, unique=True, db_index=True, verbose_name='设备指纹哈希(SHA256)')

    device_type = models.CharField(max_length=12, choices=DEVICE_TYPE_CHOICES, default='desktop', verbose_name='设备类型')
    os_name = models.CharField(max_length=20, choices=OS_CHOICES, default='unknown', verbose_name='操作系统')
    os_version = models.CharField(max_length=50, blank=True, default='', verbose_name='系统版本')
    browser = models.CharField(max_length=50, blank=True, default='', verbose_name='浏览器')
    browser_version = models.CharField(max_length=30, blank=True, default='', verbose_name='浏览器版本')
    screen_resolution = models.CharField(max_length=20, blank=True, default='', verbose_name='屏幕分辨率')
    language = models.CharField(max_length=10, blank=True, default='zh-CN', verbose_name='语言')
    timezone = models.CharField(max_length=50, blank=True, default='', verbose_name='时区')

    ip_address = models.GenericIPAddressField(null=True, blank=True, verbose_name='IP地址')
    ip_country = models.CharField(max_length=50, blank=True, default='', verbose_name='IP归属国家')
    ip_region = models.CharField(max_length=50, blank=True, default='', verbose_name='IP归属地区')
    ip_isp = models.CharField(max_length=50, blank=True, default='', verbose_name='ISP运营商')
    is_proxy = models.BooleanField(default=False, verbose_name='是否代理/VPN')
    is_datacenter_ip = models.BooleanField(default=False, verbose_name='是否数据中心IP')

    canvas_fingerprint = models.CharField(max_length=64, blank=True, default='', verbose_name='Canvas指纹')
    webgl_vendor = models.CharField(max_length=100, blank=True, default='', verbose_name='WebGL厂商')
    webgl_renderer = models.CharField(max_length=200, blank=True, default='', verbose_name='WebGL渲染器')
    plugins_count = models.PositiveSmallIntegerField(default=0, verbose_name='插件数量')
    fonts_count = models.PositiveSmallIntegerField(default=0, verbose_name='字体数量')

    raw_fingerprint_data = models.JSONField(default=dict, verbose_name='原始指纹数据')
    risk_level = models.CharField(max_length=14, choices=RISK_LEVEL_CHOICES, default='safe', verbose_name='设备风险等级')
    risk_score = models.FloatField(default=0, verbose_name='风险评分(0-100)')
    risk_reasons = models.JSONField(default=list, verbose_name='风险原因列表')

    first_seen_at = models.DateTimeField(auto_now_add=True, verbose_name='首次发现时间')
    last_seen_at = models.DateTimeField(auto_now=True, verbose_name='最后活跃时间')
    event_count = models.PositiveIntegerField(default=0, verbose_name='关联事件数')
    user_count = models.PositiveIntegerField(default=0, verbose_name='关联用户数(多账号检测)')

    tags = models.JSONField(default=list, verbose_name='标签')
    metadata = models.JSONField(default=dict, verbose_name='扩展元数据')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'antifraud_device_fingerprint'
        verbose_name = '设备指纹'
        verbose_name_plural = '设备指纹'
        ordering = ['-last_seen_at']
        indexes = [
            models.Index(fields=['ip_address'], name='idx_af_ip'),
            models.Index(fields=['risk_level'], name='idx_af_dev_risk'),
            models.Index(fields=['risk_score'], name='idx_af_dev_score'),
            models.Index(fields=['fingerprint_hash'], name='idx_af_fp_hash'),
            models.Index(fields=['is_proxy'], name='idx_af_proxy'),
            models.Index(fields=['-event_count'], name='idx_af_event_cnt'),
        ]

    def __str__(self):
        return f'设备指纹-{self.device_type}-{self.fingerprint_hash[:12]}...'


class RiskEvent(models.Model):
    EVENT_TYPE_CHOICES = [
        ('register', '注册'),
        ('login', '登录'),
        ('login_failed', '登录失败'),
        ('logout', '登出'),
        ('password_change', '修改密码'),
        ('password_reset', '重置密码'),
        ('email_verify', '邮箱验证'),
        ('phone_verify', '手机验证'),
        ('profile_update', '资料修改'),
        ('payment_action', '支付操作'),
        ('api_call_high_freq', '高频API调用'),
        ('suspicious_behavior', '可疑行为'),
        ('account_takeover_attempt', '账号接管尝试'),
        ('bulk_registration', '批量注册'),
        ('velocity_violation', '频率违规'),
        ('device_anomaly', '设备异常'),
        ('ip_reputation_alert', 'IP信誉告警'),
    ]
    SEVERITY_CHOICES = [
        ('info', '信息'),
        ('low', '低风险'),
        ('medium', '中风险'),
        ('high', '高风险'),
        ('critical', '严重'),
    ]
    ACTION_TAKEN_CHOICES = [
        ('none', '无动作'),
        ('pass', '放行'),
        ('challenge', '人机验证'),
        ('step_up_auth', '增强认证'),
        ('block', '拦截'),
        ('freeze_account', '冻结账号'),
        ('flag_for_review', '标记待审'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='risk_events', verbose_name='关联用户'
    )
    device = models.ForeignKey(
        DeviceFingerprint, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='events', verbose_name='关联设备'
    )

    event_type = models.CharField(max_length=30, choices=EVENT_TYPE_CHOICES, db_index=True, verbose_name='事件类型')
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default='info', verbose_name='严重程度')
    action_taken = models.CharField(max_length=20, choices=ACTION_TAKEN_CHOICES, default='none', verbose_name='处置动作')

    ip_address = models.GenericIPAddressField(null=True, blank=True, verbose_name='IP地址')
    user_agent = models.TextField(blank=True, default='', verbose_name='User-Agent')
    request_path = models.CharField(max_length=255, blank=True, default='', verbose_name='请求路径')
    request_method = models.CharField(max_length=10, default='GET', verbose_name='请求方法')

    username_attempted = models.CharField(max_length=150, blank=True, default='', verbose_name='尝试的用户名')
    email_attempted = models.EmailField(blank=True, null=True, verbose_name='尝试的邮箱')

    risk_score = models.FloatField(default=0, verbose_name='实时风险评分(0-100)')
    triggered_rules = models.JSONField(default=list, verbose_name='触发的风控规则')
    risk_indicators = models.JSONField(default=list, verbose_name='风险指标详情')

    location_city = models.CharField(max_length=50, blank=True, default='', verbose_name='城市')
    location_region = models.CharField(max_length=50, blank=True, default='', verbose_name='省份/州')
    location_country = models.CharField(max_length=50, blank=True, default='', verbose_name='国家')

    is_blocked = models.BooleanField(default=False, verbose_name='是否被拦截')
    block_reason = models.TextField(blank=True, default='', verbose_name='拦截原因')
    session_id = models.CharField(max_length=64, blank=True, default='', verbose_name='会话ID')

    extra_context = models.JSONField(default=dict, verbose_name='额外上下文数据')
    processing_time_ms = models.PositiveIntegerField(default=0, verbose_name='处理耗时(ms)')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='事件时间')

    class Meta:
        db_table = 'antifraud_risk_event'
        verbose_name = '风险事件'
        verbose_name_plural = '风险事件'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', '-created_at'], name='idx_af_evt_user_time'),
            models.Index(fields=['event_type'], name='idx_af_evt_type'),
            models.Index(fields=['severity'], name='idx_af_evt_sev'),
            models.Index(fields=['ip_address'], name='idx_af_evt_ip'),
            models.Index(fields=['action_taken'], name='idx_af_evt_action'),
            models.Index(fields=['is_blocked'], name='idx_af_evt_blocked'),
            models.Index(fields=['-risk_score'], name='idx_af_evt_risk'),
            models.Index(fields=['created_at'], name='idx_af_evt_created'),
        ]

    def __str__(self):
        return f'风险事件-{self.get_event_type_display()}-{self.severity}-{self.id.hex[:8]}'


class FraudRule(models.Model):
    RULE_CATEGORY_CHOICES = [
        ('registration_abuse', '注册滥用'),
        ('login_attack', '登录攻击'),
        ('account_takeover', '账号接管'),
        ('content_spam', '内容垃圾'),
        ('payment_fraud', '支付欺诈'),
        ('velocity_check', '频率检查'),
        ('device_risk', '设备风险'),
        ('ip_reputation', 'IP信誉'),
        ('behavioral_anomaly', '行为异常'),
        ('custom', '自定义规则'),
    ]
    ACTION_CHOICES = [
        ('none', '无动作'),
        ('add_risk_score', '增加风险分'),
        ('challenge', '触发验证码'),
        ('step_up_auth', '增强认证'),
        ('block', '直接拦截'),
        ('freeze', '冻结账号'),
        ('alert_only', '仅告警'),
        ('require_mfa', '要求多因子认证'),
    ]
    STATUS_CHOICES = [('enabled', '启用'), ('disabled', '停用')]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rule_code = models.CharField(max_length=40, unique=True, verbose_name='规则编号')
    rule_name = models.CharField(max_length=100, verbose_name='规则名称')
    category = models.CharField(max_length=24, choices=RULE_CATEGORY_CHOICES, verbose_name='规则分类')
    description = models.TextField(verbose_name='规则描述')

    condition_config = models.JSONField(default=dict, verbose_name='条件配置(JSON)')
    threshold_value = models.FloatField(default=0, verbose_name='阈值')
    action = models.CharField(max_length=20, choices=ACTION_CHOICES, default='add_risk_score', verbose_name='处置动作')
    action_params = models.JSONField(default=dict, verbose_name='动作参数')

    priority = models.PositiveSmallIntegerField(default=50, verbose_name='优先级(1-100,越高越优先)')
    weight = models.FloatField(default=1.0, verbose_name='权重(影响风险分的倍率)')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='enabled', verbose_name='状态')

    hit_count = models.PositiveIntegerField(default=0, verbose_name='命中次数')
    block_count = models.PositiveIntegerField(default=0, verbose_name='拦截次数')
    false_positive_count = models.PositiveIntegerField(default=0, verbose_name='误报次数')
    last_hit_at = models.DateTimeField(null=True, blank=True, verbose_name='最后命中时间')

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='fraud_rules_created', verbose_name='创建者'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'antifraud_fraud_rule'
        verbose_name = '反欺诈规则'
        verbose_name_plural = '反欺诈规则'
        ordering = ['-priority', '-hit_count']
        indexes = [
            models.Index(fields=['category'], name='idx_af_rule_cat'),
            models.Index(fields=['status'], name='idx_af_rule_status'),
            models.Index(fields=['priority'], name='idx_af_rule_priority'),
            models.Index(fields=['-hit_count'], name='idx_af_rule_hits'),
        ]

    def __str__(self):
        return f'{self.rule_code}: {self.rule_name}'


class UserRiskProfile(models.Model):
    RISK_LEVEL_CHOICES = [
        ('trusted', '可信用户'),
        ('normal', '正常用户'),
        ('watched', '关注用户'),
        ('suspicious', '可疑用户'),
        ('restricted', '受限用户'),
        ('banned', '封禁用户'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='risk_profile', verbose_name='关联用户'
    )

    overall_risk_score = models.FloatField(default=0, verbose_name='综合风险评分(0-100)')
    risk_level = models.CharField(max_length=12, choices=RISK_LEVEL_CHOICES, default='normal', verbose_name='风险等级')

    registration_risk_score = models.FloatField(default=0, verbose_name='注册风险分')
    login_risk_score = models.FloatField(default=0, verbose_name='登录风险分')
    behavior_risk_score = models.FloatField(default=0, verbose_name='行为风险分')
    device_risk_score = models.FloatField(default=0, verbose_name='设备风险分')
    ip_risk_score = models.FloatField(default=0, verbose_name='IP风险分')
    velocity_risk_score = models.FloatField(default=0, verbose_name='频率风险分')

    total_events = models.PositiveIntegerField(default=0, verbose_name='总事件数')
    blocked_events = models.PositiveIntegerField(default=0, verbose_name='被拦截事件数')
    failed_logins_24h = models.PositiveSmallIntegerField(default=0, verbose_name='24h内失败登录次数')
    successful_logins_24h = models.PositiveSmallIntegerField(default=0, verbose_name='24h内成功登录次数')

    known_devices = models.JSONField(default=list, verbose_name='已知设备指纹列表')
    known_ips = models.JSONField(default=list, verbose_name='已知IP列表')
    login_locations = models.JSONField(default=list, verbose_name='登录地理位置历史')
    behavior_baseline = models.JSONField(default=dict, verbose_name='行为基线(正常行为模式)')

    triggered_rules_history = models.JSONField(default=list, verbose_name='触发的规则历史(最近50条)')
    risk_timeline = models.JSONField(default=list, verbose_name='风险评分时间线(最近30天)')

    is_frozen = models.BooleanField(default=False, verbose_name='是否被冻结')
    frozen_until = models.DateTimeField(null=True, blank=True, verbose_name='冻结截止时间')
    frozen_reason = models.TextField(blank=True, default='', verbose_name='冻结原因')
    requires_mfa = models.BooleanField(default=False, verbose_name='是否要求MFA')

    notes = models.TextField(blank=True, default='', verbose_name='运营备注')
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='risk_reviews', verbose_name='审核人'
    )
    reviewed_at = models.DateTimeField(null=True, blank=True, verbose_name='审核时间')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'antifraud_user_risk_profile'
        verbose_name = '用户风险画像'
        verbose_name_plural = '用户风险画像'
        indexes = [
            models.Index(fields=['overall_risk_score'], name='idx_af_prof_score'),
            models.Index(fields=['risk_level'], name='idx_af_prof_level'),
            models.Index(fields=['is_frozen'], name='idx_af_prof_frozen'),
            models.Index(fields=['requires_mfa'], name='idx_af_prof_mfa'),
        ]

    def __str__(self):
        return f'风险画像-{self.user.username}-{self.risk_level}-{self.overall_risk_score:.0f}分'


class AntiFraudDashboardSnapshot(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    snapshot_time = models.DateTimeField(db_index=True, verbose_name='快照时间')

    total_users = models.PositiveIntegerField(default=0, verbose_name='总用户数')
    active_users_24h = models.PositiveIntegerField(default=0, verbose_name='24h活跃用户')
    new_registrations_24h = models.PositiveIntegerField(default=0, verbose_name='24h新注册')
    total_events_24h = models.PositiveIntegerField(default=0, verbose_name='24h总事件')

    blocked_events_24h = models.PositiveIntegerField(default=0, verbose_name='24h拦截事件')
    critical_events_24h = models.PositiveIntegerField(default=0, verbose_name='24h严重事件')
    high_risk_events_24h = models.PositiveIntegerField(default=0, verbose_name='24h高风险事件')

    avg_risk_score = models.FloatField(default=0, verbose_name='平均风险分')
    trusted_user_pct = models.FloatField(default=0, verbose_name='可信用户占比%')
    suspicious_user_count = models.PositiveIntegerField(default=0, verbose_name='可疑用户数')
    banned_user_count = models.PositiveIntegerField(default=0, verbose_name='封禁用户数')
    frozen_user_count = models.PositiveIntegerField(default=0, verbose_name='冻结用户数')

    top_attack_types = models.JSONField(default=list, verbose_name='Top攻击类型')
    top_risk_ips = models.JSONField(default=list, verbose_name='高风险IP Top10')
    top_risk_devices = models.JSONField(default=list, verbose_name='高风险设备 Top10')
    rule_hit_stats = models.JSONField(default=dict, verbose_name='规则命中统计')

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'antifraud_dashboard_snapshot'
        verbose_name = '反欺诈仪表盘快照'
        verbose_name_plural = '反欺诈仪表盘快照'
        ordering = ['-snapshot_time']
        indexes = [models.Index(fields=['snapshot_time'], name='idx_af_snap_time')]
