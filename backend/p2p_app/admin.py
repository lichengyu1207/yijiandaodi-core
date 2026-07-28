from django.contrib import admin
from .models import P2PNode, NodeHeartbeat, NodeReputation


@admin.register(P2PNode)
class P2PNodeAdmin(admin.ModelAdmin):
    list_display = ['node_id', 'node_type_display', 'location', 'status_display',
                    'reputation_score', 'total_tasks_completed', 'last_heartbeat', 'created_at']
    list_filter = ['status', 'node_type', 'location']
    search_fields = ['node_id', 'location']
    ordering = ['-last_heartbeat']
    readonly_fields = ['last_heartbeat', 'created_at', 'updated_at']

    fieldsets = (
        ('基本信息', {
            'fields': ('node_id', 'node_type', 'location', 'status')
        }),
        ('能力与资源', {
            'fields': ('capabilities', 'resources')
        }),
        ('安全信息', {
            'fields': ('public_key',)
        }),
        ('统计信息', {
            'fields': ('reputation_score', 'total_tasks_completed', 'total_compute_hours')
        }),
        ('时间信息', {
            'fields': ('last_heartbeat', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )

    def node_type_display(self, obj):
        return obj.get_node_type_display()
    node_type_display.short_description = '节点类型'

    def status_display(self, obj):
        return obj.get_status_display()
    status_display.short_description = '状态'


@admin.register(NodeHeartbeat)
class NodeHeartbeatAdmin(admin.ModelAdmin):
    list_display = ['node', 'timestamp', 'cpu_usage', 'memory_usage',
                    'gpu_usage', 'idle_state_display', 'active_task_count']
    list_filter = ['idle_state', 'timestamp']
    search_fields = ['node__node_id']
    ordering = ['-timestamp']
    readonly_fields = ['timestamp']

    def idle_state_display(self, obj):
        return obj.get_idle_state_display()
    idle_state_display.short_description = '空闲状态'


@admin.register(NodeReputation)
class NodeReputationAdmin(admin.ModelAdmin):
    list_display = ['node', 'score', 'success_rate', 'avg_response_time_ms',
                    'malicious_flags', 'last_updated']
    list_filter = ['malicious_flags']
    search_fields = ['node__node_id']
    readonly_fields = ['last_updated']
