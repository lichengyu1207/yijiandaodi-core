import re
from rest_framework import serializers
from .risk_control_models import RegexRule, ContentAuditLog, RegexTestCase


class RegexRuleSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    severity_display = serializers.CharField(source='get_severity_display', read_only=True)
    action_display = serializers.CharField(source='get_action_display', read_only=True)

    class Meta:
        model = RegexRule
        fields = [
            'id', 'name', 'category', 'category_display', 'pattern',
            'description', 'severity', 'severity_display', 'action',
            'action_display', 'replacement', 'is_enabled', 'match_count',
            'false_positive_count', 'tags', 'sort_order', 'created_by',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'match_count', 'false_positive_count', 'created_at', 'updated_at']


class RegexRuleCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = RegexRule
        fields = [
            'name', 'category', 'pattern', 'description', 'severity',
            'action', 'replacement', 'is_enabled', 'tags', 'sort_order',
        ]

    def validate_pattern(self, value):
        try:
            re.compile(value)
        except re.error as e:
            raise serializers.ValidationError(f'正则表达式无效: {e}')
        return value


class RegexRuleTestSerializer(serializers.Serializer):
    text = serializers.CharField(max_length=10000, help_text='待测试文本')
    rule_id = serializers.IntegerField(required=False, help_text='规则ID（可选，不传则使用请求体中的pattern）')
    pattern = serializers.CharField(required=False, help_text='正则表达式（与rule_id二选一）')

    def validate(self, attrs):
        if not attrs.get('rule_id') and not attrs.get('pattern'):
            raise serializers.ValidationError('必须提供 rule_id 或 pattern 之一')
        if attrs.get('rule_id') and attrs.get('pattern'):
            raise serializers.ValidationError('rule_id 和 pattern 只能提供其中一个')
        return attrs


class ContentAuditLogSerializer(serializers.ModelSerializer):
    result_display = serializers.CharField(source='get_result_display', read_only=True)
    action_taken_display = serializers.CharField(source='get_action_taken_display', read_only=True)
    username_display = serializers.SerializerMethodField()

    class Meta:
        model = ContentAuditLog
        fields = [
            'id', 'content', 'content_hash', 'source', 'user_id', 'username',
            'username_display', 'ip_address', 'result', 'result_display',
            'risk_level', 'total_matches', 'matched_rules', 'action_taken',
            'action_taken_display', 'processing_time_ms', 'error_message',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def get_username_display(self, obj):
        return obj.username or f'用户#{obj.user_id}'


class TextCheckRequestSerializer(serializers.Serializer):
    content = serializers.CharField(max_length=50000, help_text='待检测内容')
    source = serializers.CharField(max_length=50, default='web', help_text='来源标识')


class TextCheckResponseSerializer(serializers.Serializer):
    result = serializers.ChoiceField(choices=['passed', 'blocked', 'warning', 'pending'])
    risk_level = serializers.CharField()
    total_matches = serializers.IntegerField()
    matched_rules = serializers.ListField()
    processing_time_ms = serializers.IntegerField()
    message = serializers.CharField()


class BatchImportSerializer(serializers.Serializer):
    rules = serializers.ListField(
        child=serializers.DictField(),
        help_text='规则列表'
    )
    overwrite = serializers.BooleanField(default=False, help_text='是否覆盖已存在的同名规则')

    def validate_rules(self, value):
        for i, rule in enumerate(value):
            if 'name' not in rule:
                raise serializers.ValidationError(f'第{i+1}条规则缺少 name 字段')
            if 'pattern' not in rule:
                raise serializers.ValidationError(f'第{i+1}条规则缺少 pattern 字段')
            if 'category' not in rule:
                raise serializers.ValidationError(f'第{i+1}条规则缺少 category 字段')
            try:
                re.compile(rule['pattern'])
            except re.error as e:
                raise serializers.ValidationError(f'第{i+1}条规则的 pattern 无效: {e}')
        return value


class RegexTestCaseSerializer(serializers.ModelSerializer):
    rule_name = serializers.CharField(source='rule.name', read_only=True)
    rule_pattern = serializers.CharField(source='rule.pattern', read_only=True)

    class Meta:
        model = RegexTestCase
        fields = [
            'id', 'rule', 'rule_name', 'rule_pattern', 'test_text',
            'expected_match', 'expected_hits', 'actual_match', 'actual_hits',
            'status', 'notes', 'created_at',
        ]


class StatisticsSerializer(serializers.Serializer):
    total_rules = serializers.IntegerField()
    enabled_rules = serializers.IntegerField()
    disabled_rules = serializers.IntegerField()
    by_category = serializers.DictField()
    by_severity = serializers.DictField()
    total_matches = serializers.IntegerField()
    total_audits = serializers.IntegerField()
    today_audits = serializers.IntegerField()
    blocked_count = serializers.IntegerField()
    passed_count = serializers.IntegerField()
