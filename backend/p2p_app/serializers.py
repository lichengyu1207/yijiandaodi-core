from rest_framework import serializers

from .models import P2PNode, TaskDispatch, TaskShard, ShardResult


class NodeRegisterSerializer(serializers.Serializer):
    node_type = serializers.ChoiceField(
        choices=[
            'browser', 'desktop_windows', 'desktop_mac',
            'mobile', 'enterprise', 'self_hosted',
        ],
        help_text='节点类型',
    )
    capabilities = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list,
        help_text='能力列表',
    )
    resources = serializers.DictField(
        child=serializers.CharField(),
        required=False,
        default=dict,
        help_text='资源信息（cpu_cores, memory_gb, gpu_available等）',
    )
    location = serializers.CharField(
        max_length=128,
        required=False,
        default='unknown',
        help_text='地理位置',
    )
    client_version = serializers.CharField(
        max_length=32,
        required=False,
        help_text='客户端版本',
    )
    public_key_fingerprint = serializers.CharField(
        required=False,
        default='',
        help_text='公钥指纹',
    )

    def validate_resources(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError('resources 必须为JSON对象')
        return value


class NodeRegisterResponseSerializer(serializers.Serializer):
    node_id = serializers.CharField(help_text='节点ID')
    node_type = serializers.CharField(help_text='节点类型')
    status = serializers.CharField(help_text='状态')
    created_at = serializers.DateTimeField(help_text='创建时间')
    platform_certificate = serializers.CharField(help_text='平台证书')


class NodeDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = P2PNode
        fields = [
            'node_id', 'node_type', 'capabilities', 'resources',
            'location', 'status', 'last_heartbeat', 'reputation_score',
            'total_tasks_completed', 'total_compute_hours',
            'created_at', 'updated_at',
        ]


class NodeListSerializer(serializers.ModelSerializer):
    class Meta:
        model = P2PNode
        fields = [
            'node_id', 'node_type', 'status', 'location',
            'reputation_score', 'last_heartbeat',
        ]


class HeartbeatSerializer(serializers.Serializer):
    timestamp = serializers.DateTimeField(required=False, help_text='客户端时间戳')
    metrics = serializers.DictField(
        child=serializers.FloatField(min_value=0.0, max_value=100.0),
        help_text='资源指标（cpu_usage, memory_usage, gpu_usage, disk_io_usage, network_bandwidth_usage）',
    )
    idle_state = serializers.ChoiceField(
        choices=['IDLE', 'PARTIAL_BUSY', 'BUSY'],
        required=False,
        help_text='空闲状态',
    )
    active_tasks = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list,
        help_text='活跃任务ID列表',
    )
    signature = serializers.CharField(required=False, help_text='心跳签名')

    def validate_metrics(self, value):
        required_keys = {'cpu_usage', 'memory_usage', 'disk_io_usage', 'network_bandwidth_usage'}
        missing = required_keys - set(value.keys())
        if missing:
            raise serializers.ValidationError(f'metrics 缺少必填字段: {missing}')
        return value


class HeartbeatAckSerializer(serializers.Serializer):
    status = serializers.CharField(help_text='响应状态')
    server_time = serializers.DateTimeField(help_text='服务器时间')
    pending_tasks = serializers.ListField(
        child=serializers.CharField(),
        help_text='待处理任务列表',
    )
    next_heartbeat_in_seconds = serializers.IntegerField(help_text='下次心跳间隔(秒)')


class OfflineReasonSerializer(serializers.Serializer):
    reason = serializers.CharField(
        max_length=256,
        required=False,
        default='用户主动下线',
        help_text='下线原因',
    )


class ReputationInfoSerializer(serializers.Serializer):
    score = serializers.FloatField(help_text='信誉评分')
    success_rate = serializers.FloatField(help_text='成功率')
    avg_response_time_ms = serializers.FloatField(help_text='平均响应时间(ms)')
    malicious_flags = serializers.IntegerField(help_text='恶意标记数')
    rank = serializers.CharField(help_text='等级(S/A/B/C/D/F)')


class TaskShardInputSerializer(serializers.Serializer):
    sequence = serializers.IntegerField(min_value=0, help_text='分片序号')
    payload_hash = serializers.CharField(max_length=64, help_text='负载哈希(SHA-256)')
    payload_size = serializers.IntegerField(min_value=0, required=False, default=0, help_text='负载大小(字节)')
    dependencies = serializers.ListField(
        child=serializers.CharField(max_length=128),
        required=False,
        default=list,
        help_text='依赖的分片ID列表',
    )
    required_capabilities = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list,
        help_text='所需能力列表',
    )
    estimated_resources = serializers.DictField(
        required=False,
        default=dict,
        help_text='预估资源需求',
    )


class TaskDispatchSerializer(serializers.Serializer):
    task_type = serializers.ChoiceField(
        choices=['text', 'image', 'code', 'file', 'mixed'],
        help_text='任务类型',
    )
    priority = serializers.ChoiceField(
        choices=['low', 'normal', 'high', 'critical'],
        required=False,
        default='normal',
        help_text='优先级',
    )
    security_level = serializers.ChoiceField(
        choices=['normal', 'high', 'critical'],
        required=False,
        default='normal',
        help_text='安全级别',
    )
    privacy_level = serializers.ChoiceField(
        choices=['public', 'internal', 'confidential'],
        required=False,
        default='public',
        help_text='隐私级别',
    )
    preferred_region = serializers.CharField(
        max_length=64,
        required=False,
        default='',
        help_text='首选区域',
    )
    max_wait_seconds = serializers.IntegerField(
        min_value=1,
        max_value=86400,
        required=False,
        default=300,
        help_text='最大等待时间(秒)',
    )
    ass_signature = serializers.CharField(
        required=False,
        default='',
        help_text='ASS安全签名',
    )
    shards = serializers.ListField(
        child=TaskShardInputSerializer(),
        min_length=1,
        help_text='分片列表',
    )

    def validate_shards(self, value):
        sequences = [s['sequence'] for s in value]
        if len(set(sequences)) != len(sequences):
            raise serializers.ValidationError('分片序号不能重复')
        return value


class TaskShardSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaskShard
        fields = [
            'shard_id', 'task', 'sequence', 'total_in_task',
            'payload_hash', 'payload_size', 'dependencies',
            'required_capabilities', 'estimated_resources',
            'status', 'assigned_node_ids', 'security_level',
            'data_sensitivity',
        ]
        read_only_fields = ['shard_id', 'task']


class TaskDispatchDetailSerializer(serializers.ModelSerializer):
    shards = TaskShardSerializer(many=True, read_only=True)

    class Meta:
        model = TaskDispatch
        fields = [
            'task_id', 'task_type', 'status', 'priority',
            'total_shards', 'completed_shards', 'failed_shards',
            'security_level', 'privacy_level', 'preferred_region',
            'max_wait_seconds', 'ass_signature', 'result_summary',
            'error_message', 'created_by', 'created_at', 'updated_at',
            'completed_at', 'shards',
        ]
        read_only_fields = ['task_id', 'created_at', 'updated_at', 'completed_at']


class ShardResultSubmissionSerializer(serializers.Serializer):
    shard_id = serializers.CharField(max_length=128, help_text='分片ID')
    exit_code = serializers.IntegerField(default=0, help_text='退出码')
    stdout = serializers.CharField(required=False, default='', help_text='标准输出')
    stderr = serializers.CharField(required=False, default='', help_text='标准错误输出')
    execution_time_ms = serializers.IntegerField(min_value=0, default=0, help_text='执行时间(毫秒)')
    resource_usage = serializers.DictField(
        required=False,
        default=None,
        allow_null=True,
        help_text='资源使用情况',
    )
    result_signature = serializers.CharField(required=False, default='', help_text='结果签名')


class TaskStatusResponseSerializer(serializers.Serializer):
    task_id = serializers.CharField(help_text='任务ID')
    status = serializers.CharField(help_text='当前状态')
    progress = serializers.DictField(help_text='进度信息(completed/total/percentage)')


class TaskCancelSerializer(serializers.Serializer):
    reason = serializers.CharField(
        max_length=256,
        required=False,
        default='用户主动取消',
        help_text='取消原因',
    )
