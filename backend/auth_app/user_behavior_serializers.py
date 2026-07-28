from rest_framework import serializers

from .user_behavior_models import UserBehaviorLog, UserProfile
from .skill_config_models import SkillConfig


class BehaviorLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserBehaviorLog
        fields = [
            'id', 'target_type', 'target_id', 'action',
            'skill_tier', 'skill_category', 'scenario', 'source_page',
            'duration_seconds', 'extra_data', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class BehaviorBatchCreateSerializer(serializers.Serializer):
    logs = serializers.ListField(
        child=serializers.DictField(),
        min_length=1,
        max_length=50,
    )
    session_id = serializers.CharField(max_length=64, required=False, default='')


class RecommendationItemSerializer(serializers.ModelSerializer):
    tier_label = serializers.CharField(source='get_tier_display', read_only=True)
    monetization_label = serializers.CharField(source='get_monetization_type_display', read_only=True)
    rec_reason = serializers.CharField(read_only=True)
    rec_score = serializers.FloatField(read_only=True)

    class Meta:
        model = SkillConfig
        fields = [
            'id', 'name', 'category', 'main_scenario', 'keywords',
            'weight', 'dev_days', 'monetization_type', 'tier',
            'icon_name', 'icon_color', 'description',
            'is_recommended', 'is_hot', 'is_new', 'usage_count',
            'tier_label', 'monetization_label',
            'rec_reason', 'rec_score',
        ]


class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = UserProfile
        fields = [
            'id', 'username',
            'preferred_tiers', 'preferred_categories', 'preferred_scenarios',
            'total_clicks', 'total_executions', 'active_days',
            'last_active_at', 'is_vip', 'vip_level', 'conversion_count',
        ]
