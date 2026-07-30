from django.db import models
from django.conf import settings


class AgentConfig(models.Model):
    AGENT_CHOICES = [
        ('auditor', 'auditor'),
        ('verifier', 'verifier'),
        ('archiver', 'archiver'),
        ('judge', 'judge'),
        ('detector', 'detector'),
    ]

    code = models.CharField(max_length=20, unique=True, choices=AGENT_CHOICES, verbose_name='code')
    name = models.CharField(max_length=50, verbose_name='name')
    enabled = models.BooleanField(default=True, verbose_name='enabled')
    sort_order = models.IntegerField(default=0, verbose_name='sort_order')

    short_desc = models.CharField(max_length=200, default='', verbose_name='short_desc')
    full_desc = models.TextField(default='', verbose_name='full_desc')
    icon = models.CharField(max_length=50, default='RobotOutlined', verbose_name='icon')
    color = models.CharField(max_length=20, default='#2563EB', verbose_name='color')
    bg_color = models.CharField(max_length=20, default='#EFF6FF', verbose_name='bg_color')

    system_prompt = models.TextField(default='', verbose_name='system_prompt')
    welcome_msg = models.CharField(max_length=500, default='', verbose_name='welcome_msg')
    temperature = models.FloatField(default=0.7, verbose_name='temperature')
    max_tokens = models.IntegerField(default=2000, verbose_name='max_tokens')

    allow_summary = models.BooleanField(default=True, verbose_name='allow_summary')
    allow_analysis = models.BooleanField(default=True, verbose_name='allow_analysis')
    allow_query = models.BooleanField(default=True, verbose_name='allow_query')
    allow_export = models.BooleanField(default=False, verbose_name='allow_export')

    timeout = models.IntegerField(default=30, verbose_name='timeout')
    retry_count = models.IntegerField(default=2, verbose_name='retry_count')
    model = models.CharField(max_length=50, default='gpt-4o', verbose_name='model')
    api_endpoint = models.CharField(max_length=500, blank=True, default='', verbose_name='api_endpoint')
    api_key_encrypted = models.CharField(max_length=500, blank=True, default='', verbose_name='api_key_encrypted')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'agent_config'
        verbose_name = 'AgentConfig'
        verbose_name_plural = 'AgentConfig'
        ordering = ['sort_order', 'id']

    def __str__(self):
        return f'{self.name}({self.code})'


class AgentSession(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='agent_sessions', null=True, blank=True, verbose_name='user')
    agent_code = models.CharField(max_length=20, verbose_name='agent_code')
    session_id = models.CharField(max_length=64, unique=True, verbose_name='session_id')
    title = models.CharField(max_length=200, default='', verbose_name='title')
    status = models.CharField(max_length=20, default='active', verbose_name='status')
    message_count = models.IntegerField(default=0, verbose_name='message_count')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    expired_at = models.DateTimeField(null=True, blank=True, verbose_name='expired_at')

    class Meta:
        db_table = 'agent_session'
        verbose_name = 'AgentSession'
        ordering = ['-updated_at']


class AgentMessage(models.Model):
    ROLE_CHOICES = [
        ('user', 'user'),
        ('assistant', 'assistant'),
        ('system', 'system'),
    ]

    session = models.ForeignKey(AgentSession, on_delete=models.CASCADE, related_name='messages', verbose_name='session')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, verbose_name='role')
    content = models.TextField(verbose_name='content')
    token_count = models.IntegerField(default=0, verbose_name='token_count')
    model_used = models.CharField(max_length=50, blank=True, default='', verbose_name='model_used')
    latency_ms = models.IntegerField(default=0, verbose_name='latency_ms')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'agent_message'
        verbose_name = 'AgentMessage'
        ordering = ['created_at']


class AgentVerificationRecord(models.Model):
    STATUS_CHOICES = [
        ('pending', 'pending'),
        ('running', 'running'),
        ('completed', 'completed'),
        ('failed', 'failed'),
    ]

    article_id = models.IntegerField(verbose_name='article_id')
    agent_code = models.CharField(max_length=20, choices=AgentConfig.AGENT_CHOICES, verbose_name='agent_code')
    agent_name = models.CharField(max_length=50, verbose_name='agent_name')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name='status')
    title = models.CharField(max_length=200, verbose_name='title')
    summary = models.TextField(default='', verbose_name='summary')
    detail = models.TextField(blank=True, default='', verbose_name='detail')
    duration_ms = models.IntegerField(default=0, verbose_name='duration_ms')
    result_data = models.JSONField(null=True, blank=True, verbose_name='result_data')
    sort_order = models.IntegerField(default=0, verbose_name='sort_order')
    operator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='verification_records', verbose_name='operator')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='created_time')

    class Meta:
        db_table = 'agent_verification_record'
        verbose_name = 'AgentVerificationRecord'
        ordering = ['article_id', 'sort_order', 'created_at']
        indexes = [
            models.Index(fields=['article_id', 'agent_code']),
        ]
