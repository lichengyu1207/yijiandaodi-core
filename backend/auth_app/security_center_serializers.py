from rest_framework import serializers
from .security_center_models import SecurityScore, SecurityAlert, SecurityReport


class SecurityScoreSerializer(serializers.ModelSerializer):
    level_display = serializers.CharField(source='get_level_display', read_only=True)

    class Meta:
        model = SecurityScore
        fields = [
            'id', 'total_score', 'level', 'level_display',
            'vulnerability_score', 'risk_score', 'audit_score',
            'open_vulns', 'critical_vulns', 'high_risk_events',
            'blocked_content', 'failed_tests', 'details', 'scored_at',
        ]


class SecurityAlertSerializer(serializers.ModelSerializer):
    severity_display = serializers.CharField(source='get_severity_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    category_display = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model = SecurityAlert
        fields = [
            'id', 'title', 'description', 'category', 'category_display',
            'severity', 'severity_display', 'status', 'status_display',
            'source_type', 'source_id', 'source_detail',
            'assignee_id', 'assignee_name', 'resolved_by', 'resolved_at',
            'resolution_note', 'triggered_at', 'updated_at',
        ]


class SecurityAlertUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SecurityAlert
        fields = ['status', 'assignee_id', 'assignee_name', 'resolution_note']


class SecurityReportSerializer(serializers.ModelSerializer):
    report_type_display = serializers.CharField(source='get_report_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = SecurityReport
        fields = [
            'id', 'report_type', 'report_type_display', 'title', 'status',
            'status_display', 'period_start', 'period_end', 'summary',
            'detail_data', 'file_path', 'created_by', 'created_at',
        ]


class DashboardSummarySerializer(serializers.Serializer):
    security_score = serializers.IntegerField()
    score_level = serializers.CharField()
    today_events = serializers.IntegerField()
    open_alerts = serializers.IntegerField()
    critical_alerts = serializers.IntegerField()
    unresolved_vulns = serializers.IntegerField()
    today_blocked = serializers.IntegerField()
    today_audits = serializers.IntegerField()
    active_rules = serializers.IntegerField()
    recent_alerts = serializers.ListField()
    trend_7d = serializers.ListField()
    by_category = serializers.DictField()


class UnifiedLogEntrySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    log_type = serializers.CharField()
    source = serializers.CharField()
    user = serializers.CharField()
    action = serializers.CharField()
    detail = serializers.CharField()
    result = serializers.CharField()
    risk_level = serializers.CharField(default='')
    ip_address = serializers.CharField(default='')
    created_at = serializers.DateTimeField()
