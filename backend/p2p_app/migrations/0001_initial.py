# Generated manually for p2p_app

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='P2PNode',
            fields=[
                (
                    'node_id',
                    models.CharField(
                        max_length=64,
                        primary_key=True,
                        serialize=False,
                        unique=True,
                        verbose_name='节点ID',
                    ),
                ),
                (
                    'node_type',
                    models.CharField(
                        max_length=32,
                        verbose_name='节点类型',
                        choices=[
                            ('browser', '浏览器节点'),
                            ('desktop_windows', 'Windows桌面'),
                            ('desktop_mac', 'macOS桌面'),
                            ('mobile', '移动端'),
                            ('enterprise', '企业级'),
                            ('self_hosted', '自托管'),
                        ],
                    ),
                ),
                (
                    'capabilities',
                    models.JSONField(default=list, verbose_name='能力列表'),
                ),
                (
                    'resources',
                    models.JSONField(default=dict, verbose_name='资源信息'),
                ),
                (
                    'location',
                    models.CharField(max_length=128, verbose_name='地理位置'),
                ),
                (
                    'status',
                    models.CharField(
                        max_length=16,
                        default='offline',
                        verbose_name='状态',
                        choices=[
                            ('online', '在线'),
                            ('offline', '离线'),
                            ('busy', '忙碌'),
                            ('maintenance', '维护中'),
                            ('banned', '已封禁'),
                        ],
                    ),
                ),
                (
                    'last_heartbeat',
                    models.DateTimeField(auto_now=True, verbose_name='最后心跳'),
                ),
                (
                    'public_key',
                    models.TextField(verbose_name='RSA公钥'),
                ),
                (
                    'reputation_score',
                    models.FloatField(default=100.0, verbose_name='信誉评分'),
                ),
                (
                    'total_tasks_completed',
                    models.IntegerField(default=0, verbose_name='完成任务数'),
                ),
                (
                    'total_compute_hours',
                    models.FloatField(default=0.0, verbose_name='总算力时长(小时)'),
                ),
                (
                    'created_at',
                    models.DateTimeField(auto_now_add=True, verbose_name='创建时间'),
                ),
                (
                    'updated_at',
                    models.DateTimeField(auto_now=True, verbose_name='更新时间'),
                ),
            ],
            options={
                'verbose_name': 'P2P节点',
                'verbose_name_plural': 'P2P节点',
                'db_table': 'p2p_node',
                'indexes': [
                    models.Index(fields=['status', 'node_type'], name='idx_p2p_status_type'),
                    models.Index(fields=['location'], name='idx_p2p_location'),
                    models.Index(fields=['reputation_score'], name='idx_p2p_reputation'),
                    models.Index(fields=['last_heartbeat'], name='idx_p2p_heartbeat'),
                ],
            },
        ),
        migrations.CreateModel(
            name='NodeHeartbeat',
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
                    'timestamp',
                    models.DateTimeField(auto_now_add=True, verbose_name='时间戳'),
                ),
                (
                    'cpu_usage',
                    models.FloatField(verbose_name='CPU使用率(%)'),
                ),
                (
                    'memory_usage',
                    models.FloatField(verbose_name='内存使用率(%)'),
                ),
                (
                    'gpu_usage',
                    models.FloatField(
                        blank=True,
                        null=True,
                        verbose_name='GPU使用率(%)',
                    ),
                ),
                (
                    'disk_io_usage',
                    models.FloatField(verbose_name='磁盘IO使用率(%)'),
                ),
                (
                    'network_bandwidth_usage',
                    models.FloatField(verbose_name='网络带宽使用率(%)'),
                ),
                (
                    'idle_state',
                    models.CharField(
                        max_length=16,
                        verbose_name='空闲状态',
                        choices=[
                            ('IDLE', '空闲'),
                            ('PARTIAL_BUSY', '部分忙碌'),
                            ('BUSY', '忙碌'),
                        ],
                    ),
                ),
                (
                    'active_task_count',
                    models.IntegerField(default=0, verbose_name='活跃任务数'),
                ),
                (
                    'node',
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='heartbeats',
                        to='p2p_app.p2pnode',
                        verbose_name='节点',
                    ),
                ),
            ],
            options={
                'verbose_name': '心跳记录',
                'verbose_name_plural': '心跳记录',
                'db_table': 'node_heartbeat',
                'ordering': ['-timestamp'],
            },
        ),
        migrations.CreateModel(
            name='NodeReputation',
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
                    'score',
                    models.FloatField(default=100.0, verbose_name='评分'),
                ),
                (
                    'success_rate',
                    models.FloatField(default=1.0, verbose_name='成功率'),
                ),
                (
                    'avg_response_time_ms',
                    models.FloatField(default=0.0, verbose_name='平均响应时间(ms)'),
                ),
                (
                    'malicious_flags',
                    models.IntegerField(default=0, verbose_name='恶意标记数'),
                ),
                (
                    'last_updated',
                    models.DateTimeField(auto_now=True, verbose_name='最后更新'),
                ),
                (
                    'node',
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name='reputation',
                        to='p2p_app.p2pnode',
                        verbose_name='节点',
                    ),
                ),
            ],
            options={
                'verbose_name': '节点信誉',
                'verbose_name_plural': '节点信誉',
                'db_table': 'node_reputation',
            },
        ),
    ]
