from django.db import models
from django.conf import settings


class PrivacyAgreement(models.Model):
    """隐私协议"""
    AGREEMENT_TYPES = [
        ('privacy', '隐私政策'),
        ('terms', '用户服务条款'),
        ('cookie', 'Cookie政策'),
    ]

    title = models.CharField(max_length=200, verbose_name='标题')
    agreement_type = models.CharField(max_length=20, choices=AGREEMENT_TYPES, default='privacy', verbose_name='类型')
    content = models.TextField(verbose_name='协议内容（HTML/富文本）')
    version = models.CharField(max_length=20, default='1.0', verbose_name='版本号')
    is_active = models.BooleanField(default=True, db_index=True, verbose_name='是否生效')
    is_required = models.BooleanField(default=True, verbose_name='是否必须同意')
    effective_date = models.DateField(null=True, blank=True, verbose_name='生效日期')

    created_by = models.IntegerField(null=True, blank=True, verbose_name='创建人ID')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'privacy_agreement'
        verbose_name = '隐私协议'
        verbose_name_plural = '隐私协议'
        ordering = ['-version', '-created_at']

    def __str__(self):
        return f'[{self.get_agreement_type_display()}] {self.title} v{self.version}'


class UserConsentRecord(models.Model):
    """用户同意记录"""
    CONSENT_STATUS = [
        ('agreed', '已同意'),
        ('declined', '已拒绝'),
        ('pending', '待处理'),
    ]

    user_id = models.IntegerField(db_index=True, verbose_name='用户ID')
    username = models.CharField(max_length=100, blank=True, default='', verbose_name='用户名')
    agreement_type = models.CharField(max_length=20, verbose_name='协议类型')
    agreement_version = models.CharField(max_length=20, verbose_name='协议版本')
    status = models.CharField(max_length=20, choices=CONSENT_STATUS, default='pending', verbose_name='状态')

    ip_address = models.GenericIPAddressField(null=True, blank=True, verbose_name='IP地址')
    user_agent = models.TextField(blank=True, default='', verbose_name='User Agent')

    consented_at = models.DateTimeField(auto_now_add=True, verbose_name='同意时间')

    class Meta:
        db_table = 'user_consent_record'
        verbose_name = '用户同意记录'
        verbose_name_plural = '用户同意记录'
        ordering = ['-consented_at']
        unique_together = ['user_id', 'agreement_type', 'agreement_version']
        indexes = [
            models.Index(fields=['user_id', 'agreement_type'], name='idx_consent_user_type'),
            models.Index(fields=['status'], name='idx_consent_status'),
        ]

    def __str__(self):
        return f'{self.username or self.user_id} - {self.agreement_type} ({self.status})'


class IMMessage(models.Model):
    """IM消息记录"""
    MESSAGE_TYPES = [
        ('text', '文本消息'),
        ('image', '图片消息'),
        ('file', '文件消息'),
        ('system', '系统消息'),
    ]
    SENDER_TYPES = [
        ('user', '用户'),
        ('agent', '客服'),
        ('system', '系统'),
        ('auto_reply', '自动回复'),
    ]

    session_id = models.CharField(max_length=64, db_index=True, verbose_name='会话ID')
    sender_type = models.CharField(max_length=20, choices=SENDER_TYPES, default='user', verbose_name='发送者类型')
    user_id = models.IntegerField(null=True, blank=True, verbose_name='发送者用户ID（用户时）')
    agent_id = models.IntegerField(null=True, blank=True, verbose_name='客服ID（客服时）')
    message_type = models.CharField(max_length=20, choices=MESSAGE_TYPES, default='text', verbose_name='消息类型')
    content = models.TextField(blank=True, default='', verbose_name='消息内容')
    file_url = models.URLField(blank=True, default='', verbose_name='文件URL')
    is_read = models.BooleanField(default=False, db_index=True, verbose_name='是否已读')

    created_at = models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='创建时间')

    class Meta:
        db_table = 'im_message'
        verbose_name = 'IM消息'
        verbose_name_plural = 'IM消息'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['session_id', '-created_at'], name='idx_im_session_time'),
            models.Index(fields=['is_read'], name='idx_im_read'),
        ]

    def __str__(self):
        return f'[{self.session_id}] {self.sender_type}: {self.content[:30]}'


class IMAutoReply(models.Model):
    """IM自动回复规则"""
    TRIGGER_TYPES = [
        ('keyword', '关键词匹配'),
        ('regex', '正则表达式'),
        ('welcome', '欢迎语'),
        ('offline', '离线自动回复'),
        ('default', '默认回复'),
    ]

    trigger_type = models.CharField(max_length=20, choices=TRIGGER_TYPES, verbose_name='触发类型')
    keyword = models.CharField(max_length=200, blank=True, default='', verbose_name='关键词/正则')
    reply_content = models.TextField(verbose_name='回复内容')
    priority = models.IntegerField(default=0, verbose_name='优先级（数字越大越优先）')
    is_enabled = models.BooleanField(default=True, verbose_name='是否启用')
    match_count = models.IntegerField(default=0, verbose_name='匹配次数')

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'im_auto_reply'
        verbose_name = 'IM自动回复'
        verbose_name_plural = 'IM自动回复'
        ordering = ['-priority', 'id']

    def __str__(self):
        return f'[{self.get_trigger_type_display()}] {self.keyword or "默认"}'


class VoiceAssistantConfig(models.Model):
    """语音助手配置"""
    CONFIG_KEYS = [
        ('voice_enabled', '语音助手开关'),
        ('wake_word', '唤醒词'),
        ('voice_language', '语音语言'),
        ('auto_response', '自动回复开关'),
        ('tts_engine', 'TTS引擎'),
        ('stt_engine', 'STT引擎'),
        ('max_record_seconds', '最长录音秒数'),
    ]

    config_key = models.CharField(max_length=50, unique=True, verbose_name='配置键')
    config_value = models.TextField(blank=True, default='', verbose_name='配置值')
    description = models.CharField(max_length=200, blank=True, default='', verbose_name='描述')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'voice_assistant_config'
        verbose_name = '语音助手配置'
        verbose_name_plural = '语音助手配置'

    def __str__(self):
        return f'{self.config_key}: {self.config_value[:30]}'
