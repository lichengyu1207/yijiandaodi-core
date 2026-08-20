"""
自监控模型管理后台配置 - Self-Audit Admin Configuration

提供自监控模型的管理界面，包括：
1. PerformanceDriftRecord - 性能漂移记录
2. AgentPermissionAuditLog - Agent权限审计日志
3. RuleFreshnessCheck - 规则库时效性检查
4. SelfAuditReport - 自审计报告
"""

from django.contrib import admin
from django.utils.html import format_html
from django.utils import timezone

from .self_audit_models import (
    PerformanceDriftRecord, AgentPermissionAuditLog,
    RuleFreshnessCheck, SelfAuditReport
)


@admin.register(PerformanceDriftRecord)
class PerformanceDriftRecordAdmin(admin.ModelAdmin):
    """性能漂移记录管理"""
    list_display = [
        'drift_type_display', 'severity_display', 'baseline_value', 'current_value',
        'deviation_rate_display', 'sample_size', 'is_resolved', 'detected_at'
    ]
    list_filter = ['drift_type', 'severity', 'is_resolved', 'detected_at']
    search_fields = ['baseline__agent_code']
    ordering = ['-detected_at']
    readonly_fields = ['detected_at', 'resolved_at']

    fieldsets = (
        ('漂移信息', {
            'fields': ('drift_type', 'severity', 'baseline', 'is_resolved')
        }),
        ('数值信息', {
            'fields': ('baseline_value', 'current_value', 'deviation_rate')
        }),
        ('统计信息', {
            'fields': ('sample_size', 'time_window')
        }),
        ('解决信息', {
            'fields': ('resolved_at', 'resolution_note'),
            'classes': ('collapse',)
        }),
        ('元数据', {
            'fields': ('metadata',),
            'classes': ('collapse',)
        }),
        ('时间戳', {
            'fields': ('detected_at',),
            'classes': ('collapse',)
        }),
    )

    actions = ['mark_as_resolved', 'recalculate_severity']

    def drift_type_display(self, obj):
        """漂移类型显示"""
        colors = {
            'accuracy': 'blue',
            'precision': 'green',
            'recall': 'orange',
            'f1_score': 'purple',
            'response_time': 'red',
            'false_positive_rate': 'darkred'
        }
        color = colors.get(obj.drift_type, 'black')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color,
            obj.get_drift_type_display()
        )
    drift_type_display.short_description = '漂移类型'
    drift_type_display.admin_order_field = 'drift_type'

    def severity_display(self, obj):
        """严重程度显示"""
        colors = {
            'low': 'gray',
            'medium': 'orange',
            'high': 'red',
            'critical': 'darkred'
        }
        color = colors.get(obj.severity, 'black')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color,
            obj.get_severity_display()
        )
    severity_display.short_description = '严重程度'
    severity_display.admin_order_field = 'severity'

    def deviation_rate_display(self, obj):
        """偏离率显示"""
        abs_deviation = abs(obj.deviation_rate)
        if abs_deviation >= 0.30:
            color = 'red'
        elif abs_deviation >= 0.20:
            color = 'orange'
        elif abs_deviation >= 0.10:
            color = 'blue'
        else:
            color = 'green'

        return format_html(
            '<span style="color: {}; font-weight: bold;">{:.2%}</span>',
            color,
            obj.deviation_rate
        )
    deviation_rate_display.short_description = '偏离率'
    deviation_rate_display.admin_order_field = 'deviation_rate'

    def mark_as_resolved(self, request, queryset):
        """标记为已解决"""
        updated = queryset.filter(is_resolved=False).update(
            is_resolved=True,
            resolved_at=timezone.now()
        )
        self.message_user(request, f'已标记 {updated} 条漂移记录为已解决')
    mark_as_resolved.short_description = '标记为已解决'

    def recalculate_severity(self, request, queryset):
        """重新计算严重程度"""
        count = 0
        for record in queryset:
            record.calculate_severity()
            record.save()
            count += 1
        self.message_user(request, f'已重新计算 {count} 条记录的严重程度')
    recalculate_severity.short_description = '重新计算严重程度'


@admin.register(AgentPermissionAuditLog)
class AgentPermissionAuditLogAdmin(admin.ModelAdmin):
    """Agent权限审计日志管理"""
    list_display = [
        'agent_link', 'action_display', 'permission_type', 'resource_type',
        'risk_level_display', 'is_anomaly', 'performed_by_link', 'timestamp'
    ]
    list_filter = ['action', 'risk_level', 'is_anomaly', 'timestamp']
    search_fields = ['agent__agent_id', 'agent__agent_name', 'performed_by__username']
    ordering = ['-timestamp']
    readonly_fields = ['timestamp']

    fieldsets = (
        ('操作信息', {
            'fields': ('agent', 'action', 'permission', 'timestamp')
        }),
        ('权限信息', {
            'fields': ('permission_type', 'resource_type')
        }),
        ('变更详情', {
            'fields': ('old_value', 'new_value', 'change_description'),
            'classes': ('collapse',)
        }),
        ('执行者', {
            'fields': ('performed_by', 'performed_ip')
        }),
        ('风险评估', {
            'fields': ('risk_level', 'is_anomaly', 'anomaly_reason')
        }),
    )

    actions = ['assess_risk']

    def agent_link(self, obj):
        """Agent链接"""
        return f"{obj.agent.agent_id} ({obj.agent.agent_name})"
    agent_link.short_description = 'Agent'
    agent_link.admin_order_field = 'agent__agent_id'

    def action_display(self, obj):
        """操作类型显示"""
        colors = {
            'grant': 'green',
            'revoke': 'orange',
            'modify': 'blue',
            'escalate': 'red',
            'de-escalate': 'purple',
            'use': 'gray',
            'abuse': 'darkred'
        }
        color = colors.get(obj.action, 'black')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color,
            obj.get_action_display()
        )
    action_display.short_description = '操作类型'
    action_display.admin_order_field = 'action'

    def risk_level_display(self, obj):
        """风险等级显示"""
        colors = {
            'safe': 'green',
            'low': 'blue',
            'medium': 'orange',
            'high': 'red',
            'critical': 'darkred'
        }
        color = colors.get(obj.risk_level, 'black')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color,
            obj.get_risk_level_display()
        )
    risk_level_display.short_description = '风险等级'
    risk_level_display.admin_order_field = 'risk_level'

    def performed_by_link(self, obj):
        """执行人"""
        return obj.performed_by.username if obj.performed_by else '系统'
    performed_by_link.short_description = '执行人'
    performed_by_link.admin_order_field = 'performed_by__username'

    def assess_risk(self, request, queryset):
        """评估风险"""
        count = 0
        for log in queryset:
            log.assess_risk()
            log.save()
            count += 1
        self.message_user(request, f'已评估 {count} 条记录的风险')
    assess_risk.short_description = '评估风险'


@admin.register(RuleFreshnessCheck)
class RuleFreshnessCheckAdmin(admin.ModelAdmin):
    """规则库时效性检查管理"""
    list_display = [
        'strategy_link', 'rule_type_display', 'freshness_status_display',
        'days_since_update', 'effectiveness_score', 'success_rate', 'checked_at'
    ]
    list_filter = ['rule_type', 'freshness_status', 'checked_at']
    search_fields = ['strategy__rule_name']
    ordering = ['-checked_at']
    readonly_fields = ['checked_at']

    fieldsets = (
        ('规则信息', {
            'fields': ('strategy', 'rule_type')
        }),
        ('时效性信息', {
            'fields': ('last_updated', 'days_since_update', 'freshness_status')
        }),
        ('性能指标', {
            'fields': ('effectiveness_score', 'usage_count', 'success_rate')
        }),
        ('建议', {
            'fields': ('recommendation',)
        }),
        ('时间戳', {
            'fields': ('checked_at',),
            'classes': ('collapse',)
        }),
    )

    actions = ['check_freshness']

    def strategy_link(self, obj):
        """策略链接"""
        return obj.strategy.rule_name
    strategy_link.short_description = '策略名称'
    strategy_link.admin_order_field = 'strategy__rule_name'

    def rule_type_display(self, obj):
        """规则类型显示"""
        return obj.get_rule_type_display()
    rule_type_display.short_description = '规则类型'
    rule_type_display.admin_order_field = 'rule_type'

    def freshness_status_display(self, obj):
        """时效状态显示"""
        colors = {
            'fresh': 'green',
            'stale': 'orange',
            'outdated': 'red',
            'deprecated': 'darkred'
        }
        color = colors.get(obj.freshness_status, 'black')
        return format_html(
            '<span style="color: {}; font-weight: bold;">{}</span>',
            color,
            obj.get_freshness_status_display()
        )
    freshness_status_display.short_description = '时效状态'
    freshness_status_display.admin_order_field = 'freshness_status'

    def check_freshness(self, request, queryset):
        """检查时效性"""
        count = 0
        for check in queryset:
            check.check_freshness()
            check.save()
            count += 1
        self.message_user(request, f'已检查 {count} 条规则的时效性')
    check_freshness.short_description = '检查时效性'


@admin.register(SelfAuditReport)
class SelfAuditReportAdmin(admin.ModelAdmin):
    """自审计报告管理"""
    list_display = [
        'report_type_display', 'period_display', 'overall_health_score_display',
        'issues_found', 'performance_drifts', 'permission_anomalies',
        'generated_at'
    ]
    list_filter = ['report_type', 'generated_at']
    ordering = ['-generated_at']
    readonly_fields = ['generated_at', 'generated_by']

    fieldsets = (
        ('报告信息', {
            'fields': ('report_type', 'period_start', 'period_end')
        }),
        ('统计数据', {
            'fields': ('total_checks', 'issues_found', 'issues_resolved')
        }),
        ('性能漂移统计', {
            'fields': ('performance_drifts', 'critical_drifts')
        }),
        ('权限审计统计', {
            'fields': ('permission_changes', 'permission_anomalies')
        }),
        ('规则时效性统计', {
            'fields': ('stale_rules', 'deprecated_rules')
        }),
        ('健康度评分', {
            'fields': (
                'overall_health_score',
                'security_score',
                'performance_score',
                'compliance_score'
            )
        }),
        ('报告内容', {
            'fields': ('summary', 'recommendations'),
            'classes': ('collapse',)
        }),
        ('元数据', {
            'fields': ('generated_at', 'generated_by'),
            'classes': ('collapse',)
        }),
    )

    def report_type_display(self, obj):
        """报告类型显示"""
        return obj.get_report_type_display()
    report_type_display.short_description = '报告类型'
    report_type_display.admin_order_field = 'report_type'

    def period_display(self, obj):
        """报告周期显示"""
        return f"{obj.period_start.strftime('%m-%d %H:%M')} ~ {obj.period_end.strftime('%m-%d %H:%M')}"
    period_display.short_description = '报告周期'

    def overall_health_score_display(self, obj):
        """整体健康度评分显示"""
        score = obj.overall_health_score
        if score >= 90:
            color = 'green'
        elif score >= 75:
            color = 'blue'
        elif score >= 60:
            color = 'orange'
        else:
            color = 'red'

        return format_html(
            '<span style="color: {}; font-weight: bold; font-size: 14px;">{:.1f}</span>',
            color,
            score
        )
    overall_health_score_display.short_description = '健康度评分'
    overall_health_score_display.admin_order_field = 'overall_health_score'

    def has_add_permission(self, request):
        """禁用手动添加"""
        return False

    def has_change_permission(self, request, obj=None):
        """禁用手动修改"""
        return False