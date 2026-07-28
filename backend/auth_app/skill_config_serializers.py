from rest_framework import serializers
from rest_framework.pagination import PageNumberPagination
from .skill_config_models import SkillConfig


class SkillConfigListSerializer(serializers.ModelSerializer):
    tier_label = serializers.CharField(source='get_tier_display', read_only=True)
    monetization_label = serializers.CharField(source='get_monetization_type_display', read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = SkillConfig
        fields = [
            'id', 'name', 'category', 'main_scenario', 'keywords',
            'weight', 'dev_days', 'monetization_type', 'tier',
            'icon_name', 'icon_color', 'description', 'status',
            'is_recommended', 'is_hot', 'is_new', 'usage_count',
            'api_endpoint', 'target_product',
            'tier_label', 'monetization_label', 'status_label',
            'created_at',
        ]


class SkillConfigCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SkillConfig
        fields = [
            'name', 'category', 'main_scenario', 'keywords',
            'weight', 'dev_days', 'monetization_type', 'tier',
            'icon_name', 'icon_color', 'description', 'status',
            'sort_order', 'is_recommended', 'is_hot', 'is_new',
        ]


class SkillConfigUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SkillConfig
        fields = [
            'name', 'category', 'main_scenario', 'keywords',
            'weight', 'dev_days', 'monetization_type', 'tier',
            'icon_name', 'icon_color', 'description', 'status',
            'sort_order', 'is_recommended', 'is_hot', 'is_new',
        ]


class SkillConfigPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 50

    def get_paginated_response(self, data):
        from rest_framework.response import Response
        return Response({
            'success': True,
            'message': '\u6280\u80fd\u5217\u8868\u83b7\u53d6\u6210\u529f',
            'data': {
                'results': data,
                'count': self.page.paginator.count,
                'total_pages': self.page.paginator.num_pages,
                'current_page': self.page.number,
                'has_next': self.page.has_next(),
                'has_previous': self.page.has_previous(),
            },
        })
