import json
from django.db import models


class P2PNode(models.Model):
    NODE_TYPE_CHOICES = [
        ('browser', '浏览器节点'),
        ('desktop_windows', 'Windows桌面'),
        ('desktop_mac', 'macOS桌面'),
        ('mobile', '移动端'),
        ('enterprise', '企业级'),
        ('self_hosted', '自托管'),
    ]

    STATUS_CHOICES = [
        ('online', '在线'),
        ('offline', '离线'),
        ('busy', '忙碌'),
        ('maintenance', '维护中'),
        ('banned', '已封禁'),
    ]

    node_id = models.CharField(max_length=64, unique=True, primary_key=True, verbose_name='节点ID')
    node_type = models.CharField(max_length=32, choices=NODE_TYPE_CHOICES, verbose_name='节点类型')
    capabilities = models.JSONField(default=list, verbose_name='能力列表')
    resources = models.JSONField(default=dict, verbose_name='资源信息')
    location = models.CharField(max_length=128, verbose_name='地理位置')
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default='offline', verbose_name='状态')
    last_heartbeat = models.DateTimeField(auto_now=True, verbose_name='最后心跳')
    public_key = models.TextField(verbose_name='RSA公钥')
    reputation_score = models.FloatField(default=100.0, verbose_name='信誉评分')
    total_tasks_completed = models.IntegerField(default=0, verbose_name='完成任务数')
    total_compute_hours = models.FloatField(default=0.0, verbose_name='总算力时长(小时)')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        db_table = 'p2p_node'
        verbose_name = 'P2P节点'
        verbose_name_plural = 'P2P节点'
        indexes = [
            models.Index(fields=['status', 'node_type'], name='idx_p2p_status_type'),
            models.Index(fields=['location'], name='idx_p2p_location'),
            models.Index(fields=['reputation_score'], name='idx_p2p_reputation'),
            models.Index(fields=['last_heartbeat'], name='idx_p2p_heartbeat'),
        ]

    def __str__(self):
        return f"{self.node_id} ({self.get_node_type_display()})"


class NodeHeartbeat(models.Model):
    IDLE_STATE_CHOICES = [
        ('IDLE', '空闲'),
        ('PARTIAL_BUSY', '部分忙碌'),
        ('BUSY', '忙碌'),
    ]

    node = models.ForeignKey(
        P2PNode,
        on_delete=models.CASCADE,
        related_name='heartbeats',
        verbose_name='节点'
    )
    timestamp = models.DateTimeField(auto_now_add=True, verbose_name='时间戳')
    cpu_usage = models.FloatField(verbose_name='CPU使用率(%)')
    memory_usage = models.FloatField(verbose_name='内存使用率(%)')
    gpu_usage = models.FloatField(null=True, blank=True, verbose_name='GPU使用率(%)')
    disk_io_usage = models.FloatField(verbose_name='磁盘IO使用率(%)')
    network_bandwidth_usage = models.FloatField(verbose_name='网络带宽使用率(%)')
    idle_state = models.CharField(max_length=16, choices=IDLE_STATE_CHOICES, verbose_name='空闲状态')
    active_task_count = models.IntegerField(default=0, verbose_name='活跃任务数')

    class Meta:
        db_table = 'node_heartbeat'
        verbose_name = '心跳记录'
        verbose_name_plural = '心跳记录'
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.node.node_id} - {self.timestamp}"


class NodeReputation(models.Model):
    node = models.OneToOneField(
        P2PNode,
        on_delete=models.CASCADE,
        related_name='reputation',
        verbose_name='节点'
    )
    score = models.FloatField(default=100.0, verbose_name='评分')
    success_rate = models.FloatField(default=1.0, verbose_name='成功率')
    avg_response_time_ms = models.FloatField(default=0.0, verbose_name='平均响应时间(ms)')
    malicious_flags = models.IntegerField(default=0, verbose_name='恶意标记数')
    last_updated = models.DateTimeField(auto_now=True, verbose_name='最后更新')

    class Meta:
        db_table = 'node_reputation'
        verbose_name = '节点信誉'
        verbose_name_plural = '节点信誉'

    def __str__(self):
        return f"{self.node.node_id} - 评分: {self.score}"


class TaskDispatch(models.Model):
    STATUS_CHOICES = [
        ('created', '已创建'),
        ('sharding', '分片中'),
        ('dispatching', '调度中'),
        ('executing', '执行中'),
        ('aggregating', '聚合中'),
        ('verifying', '验证中'),
        ('completed', '已完成'),
        ('failed', '失败'),
        ('aborted', '已取消'),
    ]

    TASK_TYPE_CHOICES = [
        ('text', '文本'),
        ('image', '图片'),
        ('code', '代码'),
        ('file', '文件'),
        ('mixed', '混合'),
    ]

    SECURITY_LEVEL_CHOICES = [
        ('normal', '普通'),
        ('high', '高安全'),
        ('critical', '极高安全'),
    ]

    PRIVACY_CHOICES = [
        ('public', '公共'),
        ('internal', '内部'),
        ('confidential', '机密'),
    ]

    task_id = models.CharField(max_length=64, unique=True, primary_key=True)
    task_type = models.CharField(max_length=16, choices=TASK_TYPE_CHOICES)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default='created')
    priority = models.CharField(max_length=16, default='normal')

    total_shards = models.IntegerField(default=0)
    completed_shards = models.IntegerField(default=0)
    failed_shards = models.IntegerField(default=0)

    security_level = models.CharField(max_length=16, choices=SECURITY_LEVEL_CHOICES, default='normal')
    privacy_level = models.CharField(max_length=16, choices=PRIVACY_CHOICES, default='public')

    preferred_region = models.CharField(max_length=64, blank=True, default='')
    max_wait_seconds = models.IntegerField(default=300)

    ass_signature = models.TextField(blank=True, default='')

    result_summary = models.JSONField(null=True, blank=True, default=None)
    error_message = models.TextField(blank=True, default='')

    created_by = models.CharField(max_length=64, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'task_dispatch'
        verbose_name = '任务分发'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['task_type']),
            models.Index(fields=['priority']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.task_id} ({self.status})"


class TaskShard(models.Model):
    SHARD_STATUS_CHOICES = [
        ('pending', '待分发'),
        ('dispatched', '已分发'),
        ('executing', '执行中'),
        ('completed', '已完成'),
        ('failed', '失败'),
    ]

    shard_id = models.CharField(max_length=128, unique=True, primary_key=True)
    task = models.ForeignKey(TaskDispatch, on_delete=models.CASCADE, related_name='shards')
    sequence = models.IntegerField()
    total_in_task = models.IntegerField()

    payload_hash = models.CharField(max_length=64)
    payload_size = models.IntegerField(default=0)

    dependencies = models.JSONField(default=list, blank=True)
    required_capabilities = models.JSONField(default=list, blank=True)
    estimated_resources = models.JSONField(default=dict, blank=True)

    status = models.CharField(max_length=16, choices=SHARD_STATUS_CHOICES, default='pending')
    assigned_node_ids = models.JSONField(default=list, blank=True)

    security_level = models.CharField(max_length=16, default='normal')
    data_sensitivity = models.CharField(max_length=16, default='public')

    class Meta:
        db_table = 'task_shard'
        verbose_name = '任务分片'
        unique_together = [['task', 'sequence']]
        indexes = [
            models.Index(fields=['status']),
            models.Index(fields=['task', 'status']),
        ]

    def __str__(self):
        return f"{self.shard_id} (seq={self.sequence}/{self.total_in_task})"


class ShardResult(models.Model):
    shard = models.ForeignKey(TaskShard, on_delete=models.CASCADE, related_name='results')
    node_id = models.CharField(max_length=64)

    exit_code = models.IntegerField(default=0)
    stdout = models.TextField(blank=True, default='')
    stderr = models.TextField(blank=True, default='')

    execution_time_ms = models.IntegerField(default=0)
    resource_usage = models.JSONField(null=True, blank=True, default=None)

    result_signature = models.TextField(blank=True, default='')
    is_accepted = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'shard_result'
        verbose_name = '分片结果'
        indexes = [
            models.Index(fields=['shard', 'is_accepted']),
            models.Index(fields=['node_id']),
        ]

    def __str__(self):
        return f"Result {self.shard.shard_id}@{self.node_id}"


# ════════════════════════════════════
# L7 哈希链审计存证 - 持久化模型
# ════════════════════════════════════

class AuditChain(models.Model):
    """哈希链节点"""

    CHAIN_TYPES = [
        ('task_lifecycle', '任务生命周期链'),
        ('execution_log', '执行日志链'),
        ('security_events', '安全事件链'),
        ('cost_tracking', '成本追踪链'),
    ]

    chain_type = models.CharField(max_length=30, choices=CHAIN_TYPES, db_index=True, verbose_name='链类型')
    event_type = models.CharField(max_length=50, db_index=True, verbose_name='事件类型')
    previous_hash = models.CharField(max_length=64, default='', blank=True, verbose_name='前一节点哈希')
    current_hash = models.CharField(max_length=64, unique=True, verbose_name='当前节点哈希')
    data_hash = models.CharField(max_length=64, verbose_name='数据哈希')
    payload = models.JSONField(default=dict, verbose_name='事件载荷')
    metadata = models.JSONField(default=dict, verbose_name='元信息(IP/用户/时间戳等)')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        db_table = 'p2p_audit_chain'
        verbose_name = '审计链节点'
        verbose_name_plural = '审计链节点'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['chain_type', '-created_at'], name='idx_audit_chain_time'),
            models.Index(fields=['chain_type', 'event_type'], name='idx_audit_chain_event'),
            models.Index(fields=['current_hash'], name='idx_audit_chain_hash'),
        ]

    def __str__(self):
        return f'{self.chain_type}:{self.event_type}#{self.id}'


class SecurityEventLog(models.Model):
    """安全事件日志"""

    EVENT_LEVELS = [
        ('info', '信息'),
        ('warning', '警告'),
        ('critical', '严重'),
    ]

    EVENT_CATEGORIES = [
        ('auth_failure', '认证失败'),
        ('rate_limit_exceeded', '频率超限'),
        ('injection_detected', '注入检测'),
        ('blocked_request', '拦截请求'),
        ('suspicious_activity', '可疑行为'),
        ('access_granted', '正常访问'),
    ]

    level = models.CharField(max_length=10, choices=EVENT_LEVELS, default='info', db_index=True)
    category = models.CharField(max_length=30, choices=EVENT_CATEGORIES, db_index=True)
    user_id = models.CharField(max_length=100, blank=True, default='', verbose_name='用户标识')
    ip_address = models.GenericIPAddressField(blank=True, null=True, verbose_name='IP地址')
    device_fingerprint = models.CharField(max_length=64, blank=True, default='', verbose_name='设备指纹')
    request_path = models.CharField(max_length=255, blank=True, default='')
    message = models.TextField(verbose_name='事件描述')
    details = models.JSONField(default=dict, verbose_name='详细信息')
    risk_score = models.FloatField(default=0.0, verbose_name='风险评分')
    action_taken = models.CharField(max_length=20, default='none', verbose_name='采取动作')  # none/block/warn/log
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='发生时间')

    class Meta:
        db_table = 'p2p_security_event_log'
        verbose_name = '安全事件日志'
        verbose_name_plural = '安全事件日志'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['level', '-created_at'], name='idx_sec_level_time'),
            models.Index(fields=['category', '-created_at'], name='idx_sec_cat_time'),
            models.Index(fields=['user_id'], name='idx_sec_user'),
            models.Index(fields=['ip_address'], name='idx_sec_ip'),
            models.Index(fields=['risk_score'], name='idx_sec_risk'),
        ]

    def __str__(self):
        return f'[{self.level}] {self.category} @{self.created_at:%m-%d %H:%M}'


class RateLimitRecord(models.Model):
    """限流记录（用于分析和告警）"""

    LIMIT_TYPE_CHOICES = [
        ('user', '用户级'),
        ('ip', 'IP级'),
        ('device', '设备指纹级'),
    ]

    limit_type = models.CharField(max_length=10, choices=LIMIT_TYPE_CHOICES, db_index=True)
    identifier = models.CharField(max_length=200, db_index=True, verbose_name='标识(user_id/ip/device_fp)')
    window_start = models.DateTimeField(verbose_name='窗口开始时间')
    request_count = models.IntegerField(default=1, verbose_name='请求次数')
    blocked = models.BooleanField(default=False, verbose_name='是否被拦截')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'p2p_rate_limit_record'
        verbose_name = '限流记录'
        indexes = [
            models.Index(fields=['limit_type', 'identifier', '-created_at'], name='idx_rl_ident'),
        ]

    def __str__(self):
        return f'{self.limit_type}:{self.identifier} #{self.request_count}'
