from rest_framework import serializers
from .security_test_models import SecurityTestCase, SecurityVulnerability


class SecurityTestCaseSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = SecurityTestCase
        fields = [
            'id', 'name', 'category', 'category_display', 'description',
            'input_payload', 'expected_risk_level', 'expected_action',
            'expected_pattern', 'severity', 'tags', 'status', 'status_display',
            'sort_order', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class SecurityTestCaseCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SecurityTestCase
        fields = [
            'name', 'category', 'description',
            'input_payload', 'expected_risk_level', 'expected_action',
            'expected_pattern', 'severity', 'tags', 'status', 'sort_order',
        ]

    def validate_expected_risk_level(self, value):
        valid_levels = ['low', 'medium', 'high', 'critical']
        if value not in valid_levels:
            raise serializers.ValidationError(f'风险等级必须是: {", ".join(valid_levels)}')
        return value

    def validate_expected_action(self, value):
        valid_actions = ['block', 'warn', 'mask', 'passed']
        if value not in valid_actions:
            raise serializers.ValidationError(f'期望动作必须是: {", ".join(valid_actions)}')
        return value

    def validate_category(self, value):
        valid_categories = [c[0] for c in SecurityTestCase.CATEGORY_CHOICES]
        if value not in valid_categories:
            raise serializers.ValidationError(f'分类必须是: {", ".join(valid_categories)}')
        return value


class SecurityVulnerabilitySerializer(serializers.ModelSerializer):
    severity_display = serializers.CharField(source='get_severity_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    severity_rank = serializers.IntegerField(read_only=True)

    class Meta:
        model = SecurityVulnerability
        fields = [
            'id', 'title', 'description', 'category',
            'severity', 'severity_display', 'severity_rank',
            'status', 'status_display',
            'related_rule_id', 'related_test_case_id',
            'detected_input', 'matched_pattern',
            'fix_description', 'fixed_by', 'fixed_at',
            'created_by', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'severity_rank']


class SecurityVulnerabilityUpdateSerializer(serializers.ModelSerializer):
    """漏洞更新序列化器（仅允许更新状态和修复信息）"""

    class Meta:
        model = SecurityVulnerability
        fields = [
            'status', 'fix_description', 'fixed_by', 'fixed_at',
        ]

    def validate_status(self, value):
        valid_statuses = [s[0] for s in SecurityVulnerability.STATUS_CHOICES]
        if value not in valid_statuses:
            raise serializers.ValidationError(f'状态必须是: {", ".join(valid_statuses)}')
        return value


class RunSingleTestSerializer(serializers.Serializer):
    """执行单个测试用例的响应序列化器"""
    case_id = serializers.IntegerField()
    name = serializers.CharField()
    status = serializers.CharField()  # pass/fail/error
    expected = serializers.CharField()
    actual = serializers.CharField()
    risk_level = serializers.CharField()
    matched_rules = serializers.ListField(child=serializers.DictField(), default=list)
    duration_ms = serializers.IntegerField()
    message = serializers.CharField(default='')


class EngineRunAllRequestSerializer(serializers.Serializer):
    """引擎批量运行请求"""
    category = serializers.CharField(required=False, default='all')


class EngineRunAllResponseSerializer(serializers.Serializer):
    """引擎批量运行响应"""
    run_id = serializers.CharField()
    started_at = serializers.DateTimeField()
    completed_at = serializers.DateTimeField()
    total_cases = serializers.IntegerField()
    passed = serializers.IntegerField()
    failed = serializers.IntegerField()
    skipped = serializers.IntegerField()
    score = serializers.FloatField()
    results = serializers.ListField(child=serializers.DictField())
    summary = serializers.DictField()


class QuickCheckRequestSerializer(serializers.Serializer):
    """快速检测请求"""
    content = serializers.CharField(max_length=10000, required=True)


class QuickCheckResponseSerializer(serializers.Serializer):
    """快速检测响应"""
    is_safe = serializers.BooleanField()
    risk_level = serializers.CharField()
    action_taken = serializers.CharField()
    matched_rules = serializers.ListField(child=serializers.DictField(), default=list)
    warning_message = serializers.CharField(default='')
    detected_at = serializers.DateTimeField()
