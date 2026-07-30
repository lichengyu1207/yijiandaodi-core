from rest_framework import serializers
from .unified_scan_models import ComplianceRule


class ComplianceRuleSerializer(serializers.ModelSerializer):
    rule_type_display = serializers.CharField(source='get_rule_type_display', read_only=True)
    severity_display = serializers.CharField(source='get_severity_display', read_only=True)

    class Meta:
        model = ComplianceRule
        fields = [
            'id', 'rule_code', 'rule_type', 'rule_type_display',
            'article_reference', 'severity', 'severity_display',
            'title', 'description', 'detection_pattern',
            'applicable_categories', 'penalty_description',
            'is_active', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']
