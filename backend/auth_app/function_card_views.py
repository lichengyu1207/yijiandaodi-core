from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny

from .function_card_models import FunctionCard
from .function_card_serializers import (
    FunctionCardSerializer,
    FunctionCardCreateUpdateSerializer,
    PublicFunctionCardSerializer,
)


class FunctionCardViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = FunctionCard.objects.all()

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return FunctionCardCreateUpdateSerializer
        return FunctionCardSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        params = self.request.query_params
        keyword = params.get('keyword', '')
        status_filter = params.get('status', '')

        if keyword:
            qs = qs.filter(name__icontains=keyword)
        if status_filter and status_filter != 'all':
            qs = qs.filter(status=status_filter)

        return qs.order_by('sort_order', '-weight')

    @action(detail=False, methods=['get'], url_path='public-cards', permission_classes=[AllowAny])
    def public_cards(self, request):
        cards = FunctionCard.objects.filter(status='online').order_by('sort_order', '-weight')[:12]
        serializer = PublicFunctionCardSerializer(cards, many=True)
        return Response({
            'success': True,
            'data': serializer.data,
        })

    @action(detail=True, methods=['post'], url_path='toggle-status')
    def toggle_status(self, request, pk=None):
        obj = self.get_object()
        obj.status = 'offline' if obj.status == 'online' else 'online'
        obj.save()
        return Response({
            'success': True,
            'message': f'已{"上线" if obj.status == "online" else "下线"}',
            'data': FunctionCardSerializer(obj).data,
        })
