from rest_framework import serializers
from .function_card_models import FunctionCard


class FunctionCardSerializer(serializers.ModelSerializer):
    icon_display = serializers.CharField(source='get_icon_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    knowledge_base_name = serializers.CharField(source='knowledge_base.name', default='', read_only=True)

    class Meta:
        model = FunctionCard
        fields = [
            'id', 'name', 'icon', 'icon_display', 'icon_color',
            'description', 'prompt_template', 'knowledge_base',
            'knowledge_base_name', 'sort_order', 'weight', 'status',
            'status_display', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class FunctionCardCreateUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = FunctionCard
        fields = [
            'name', 'icon', 'icon_color', 'description',
            'prompt_template', 'knowledge_base', 'sort_order',
            'weight', 'status',
        ]


class PublicFunctionCardSerializer(serializers.ModelSerializer):
    class Meta:
        model = FunctionCard
        fields = [
            'id', 'name', 'icon', 'icon_color',
            'description', 'sort_order', 'weight',
        ]
