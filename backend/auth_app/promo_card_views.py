from rest_framework import viewsets, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import F

from .promo_card_models import PromoCard


class PromoCardSerializer(serializers.ModelSerializer):
    is_active = serializers.BooleanField(read_only=True)
    card_type_label = serializers.CharField(source='get_card_type_display', read_only=True)
    position_label = serializers.CharField(source='get_position_display', read_only=True)

    class Meta:
        model = PromoCard
        fields = [
            'id', 'title', 'subtitle', 'description',
            'card_type', 'position', 'icon_name', 'icon_color',
            'bg_color', 'border_color', 'accent_color',
            'image_url', 'link_url', 'button_text', 'price_text',
            'priority', 'status', 'is_active',
            'card_type_label', 'position_label',
        ]


class PromoCardViewSet(viewsets.ViewSet):
    permission_classes = []

    @action(detail=False, methods=['get'], url_path='feed-cards')
    def feed_cards(self, request):
        position = request.query_params.get('position', 'feed_middle')
        limit = min(int(request.query_params.get('limit', 5)), 10)
        user_type = request.query_params.get('user_type', 'all')

        cards = PromoCard.objects.filter(status='online').order_by('-priority', '-id')

        from django.utils import timezone
        now = timezone.now()
        active_cards = []
        for card in cards:
            if card.start_time and now < card.start_time:
                continue
            if card.end_time and now > card.end_time:
                continue
            if card.show_count_limit > 0 and card.click_count >= card.show_count_limit:
                continue
            if user_type != 'all' and card.target_user_type and card.target_user_type != 'all':
                if card.target_user_type != user_type:
                    continue
            active_cards.append(card)

        position_filtered = [c for c in active_cards if c.position == position]
        result = position_filtered[:limit] if position_filtered else active_cards[:limit]

        serializer = PromoCardSerializer(result, many=True)

        return Response({
            'success': True,
            'data': {
                'cards': serializer.data,
                'count': len(serializer.data),
                'position': position,
            },
        })

    @action(detail=False, methods=['post'], url_path='track-click')
    def track_click(self, request):
        card_id = request.data.get('card_id')
        if not card_id:
            return Response({'success': False, 'message': '缺少card_id'}, status=400)

        updated = PromoCard.objects.filter(id=card_id).update(
            click_count=F('click_count') + 1
        )

        return Response({
            'success': True,
            'message': '点击已记录' if updated > 0 else '卡片不存在',
            'data': {'card_id': card_id, 'updated': updated},
        })
