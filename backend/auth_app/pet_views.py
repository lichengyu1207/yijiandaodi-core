"""
桌宠交互记录序列化器和API视图
"""

from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Count
from datetime import datetime, timedelta
from .pet_models import PetInteractionLog


class PetInteractionLogSerializer(serializers.ModelSerializer):
    """桌宠交互记录序列化器"""

    class Meta:
        model = PetInteractionLog
        fields = '__all__'
        read_only_fields = ['user', 'created_at']


class PetInteractionViewSet(viewsets.ModelViewSet):
    """桌宠交互记录API"""

    queryset = PetInteractionLog.objects.all()
    serializer_class = PetInteractionLogSerializer

    def get_queryset(self):
        """用户只能查看自己的交互记录"""
        return self.queryset.filter(user=self.request.user)

    def perform_create(self, serializer):
        """创建时自动关联用户"""
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """交互统计"""
        user = request.user

        # 统计各类型交互次数
        stats = {
            'total': PetInteractionLog.objects.filter(user=user).count(),
            'by_type': list(
                PetInteractionLog.objects.filter(user=user)
                .values('interaction_type')
                .annotate(count=Count('id'))
            ),
            'recent_7_days': PetInteractionLog.objects.filter(
                user=user,
                created_at__gte=datetime.now() - timedelta(days=7)
            ).count(),
            'recent_30_days': PetInteractionLog.objects.filter(
                user=user,
                created_at__gte=datetime.now() - timedelta(days=30)
            ).count()
        }

        return Response(stats)

    @action(detail=False, methods=['post'])
    def sync(self, request):
        """同步到云端"""
        # 获取未同步的记录
        unsynced_logs = PetInteractionLog.objects.filter(
            user=request.user,
            synced=False
        )

        # 标记为已同步
        count = unsynced_logs.count()
        unsynced_logs.update(synced=True)

        return Response({
            'status': 'success',
            'synced_count': count
        })

    @action(detail=False, methods=['get'])
    def recent(self, request):
        """最近交互记录"""
        limit = int(request.query_params.get('limit', 50))
        logs = PetInteractionLog.objects.filter(user=request.user)[:limit]
        serializer = self.get_serializer(logs, many=True)
        return Response(serializer.data)