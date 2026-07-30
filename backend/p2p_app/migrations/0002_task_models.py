# Generated manually for p2p_app - Batch 2: Task Sharding Models

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('p2p_app', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='TaskDispatch',
            fields=[
                (
                    'task_id',
                    models.CharField(
                        max_length=64,
                        primary_key=True,
                        serialize=False,
                        unique=True,
                    ),
                ),
                (
                    'task_type',
                    models.CharField(
                        max_length=16,
                        choices=[
                            ('text', '文本'),
                            ('image', '图片'),
                            ('code', '代码'),
                            ('file', '文件'),
                            ('mixed', '混合'),
                        ],
                    ),
                ),
                (
                    'status',
                    models.CharField(
                        max_length=16,
                        choices=[
                            ('created', '已创建'),
                            ('sharding', '分片中'),
                            ('dispatching', '调度中'),
                            ('executing', '执行中'),
                            ('aggregating', '聚合中'),
                            ('verifying', '验证中'),
                            ('completed', '已完成'),
                            ('failed', '失败'),
                            ('aborted', '已取消'),
                        ],
                        default='created',
                    ),
                ),
                (
                    'priority',
                    models.CharField(max_length=16, default='normal'),
                ),
                (
                    'total_shards',
                    models.IntegerField(default=0),
                ),
                (
                    'completed_shards',
                    models.IntegerField(default=0),
                ),
                (
                    'failed_shards',
                    models.IntegerField(default=0),
                ),
                (
                    'security_level',
                    models.CharField(
                        max_length=16,
                        choices=[
                            ('normal', '普通'),
                            ('high', '高安全'),
                            ('critical', '极高安全'),
                        ],
                        default='normal',
                    ),
                ),
                (
                    'privacy_level',
                    models.CharField(
                        max_length=16,
                        choices=[
                            ('public', '公共'),
                            ('internal', '内部'),
                            ('confidential', '机密'),
                        ],
                        default='public',
                    ),
                ),
                (
                    'preferred_region',
                    models.CharField(max_length=64, blank=True, default=''),
                ),
                (
                    'max_wait_seconds',
                    models.IntegerField(default=300),
                ),
                (
                    'ass_signature',
                    models.TextField(blank=True, default=''),
                ),
                (
                    'result_summary',
                    models.JSONField(blank=True, default=None, null=True),
                ),
                (
                    'error_message',
                    models.TextField(blank=True, default=''),
                ),
                (
                    'created_by',
                    models.CharField(max_length=64, blank=True, default=''),
                ),
                (
                    'created_at',
                    models.DateTimeField(auto_now_add=True),
                ),
                (
                    'updated_at',
                    models.DateTimeField(auto_now=True),
                ),
                (
                    'completed_at',
                    models.DateTimeField(blank=True, null=True),
                ),
            ],
            options={
                'verbose_name': '任务分发',
                'db_table': 'task_dispatch',
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['status'], name='idx_task_status'),
                    models.Index(fields=['task_type'], name='idx_task_type'),
                    models.Index(fields=['priority'], name='idx_task_priority'),
                    models.Index(fields=['created_at'], name='idx_task_created'),
                ],
            },
        ),
        migrations.CreateModel(
            name='TaskShard',
            fields=[
                (
                    'shard_id',
                    models.CharField(
                        max_length=128,
                        primary_key=True,
                        serialize=False,
                        unique=True,
                    ),
                ),
                (
                    'task',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='shards',
                        to='p2p_app.taskdispatch',
                    ),
                ),
                (
                    'sequence',
                    models.IntegerField(),
                ),
                (
                    'total_in_task',
                    models.IntegerField(),
                ),
                (
                    'payload_hash',
                    models.CharField(max_length=64),
                ),
                (
                    'payload_size',
                    models.IntegerField(default=0),
                ),
                (
                    'dependencies',
                    models.JSONField(blank=True, default=list),
                ),
                (
                    'required_capabilities',
                    models.JSONField(blank=True, default=list),
                ),
                (
                    'estimated_resources',
                    models.JSONField(blank=True, default=dict),
                ),
                (
                    'status',
                    models.CharField(
                        max_length=16,
                        choices=[
                            ('pending', '待分发'),
                            ('dispatched', '已分发'),
                            ('executing', '执行中'),
                            ('completed', '已完成'),
                            ('failed', '失败'),
                        ],
                        default='pending',
                    ),
                ),
                (
                    'assigned_node_ids',
                    models.JSONField(blank=True, default=list),
                ),
                (
                    'security_level',
                    models.CharField(max_length=16, default='normal'),
                ),
                (
                    'data_sensitivity',
                    models.CharField(max_length=16, default='public'),
                ),
            ],
            options={
                'verbose_name': '任务分片',
                'db_table': 'task_shard',
                'indexes': [
                    models.Index(fields=['status'], name='idx_shard_status'),
                    models.Index(fields=['task', 'status'], name='idx_shard_task_status'),
                ],
            },
        ),
        migrations.CreateModel(
            name='ShardResult',
            fields=[
                (
                    'id',
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name='ID',
                    ),
                ),
                (
                    'node_id',
                    models.CharField(max_length=64),
                ),
                (
                    'exit_code',
                    models.IntegerField(default=0),
                ),
                (
                    'stdout',
                    models.TextField(blank=True, default=''),
                ),
                (
                    'stderr',
                    models.TextField(blank=True, default=''),
                ),
                (
                    'execution_time_ms',
                    models.IntegerField(default=0),
                ),
                (
                    'resource_usage',
                    models.JSONField(blank=True, default=None, null=True),
                ),
                (
                    'result_signature',
                    models.TextField(blank=True, default=''),
                ),
                (
                    'is_accepted',
                    models.BooleanField(default=False),
                ),
                (
                    'created_at',
                    models.DateTimeField(auto_now_add=True),
                ),
                (
                    'shard',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='results',
                        to='p2p_app.taskshard',
                    ),
                ),
            ],
            options={
                'verbose_name': '分片结果',
                'db_table': 'shard_result',
                'indexes': [
                    models.Index(fields=['shard', 'is_accepted'], name='idx_result_accepted'),
                    models.Index(fields=['node_id'], name='idx_result_node'),
                ],
            },
        ),
    ]
