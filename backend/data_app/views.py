from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.generics import ListAPIView

from django.utils import timezone
from datetime import timedelta, date

from .models import DataExportRecord, SystemConfig
from .serializers import DataExportRecordSerializer, SystemConfigSerializer

from content_app.models import Article, Category
from auth_app.models import User, LoginLog


class DataOverviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)

        return Response({
            'success': True,
            'data': {
                'article_count': Article.objects.count(),
                'published_count': Article.objects.filter(status='published').count(),
                'draft_count': Article.objects.filter(status='draft').count(),
                'user_count': User.objects.count(),
                'category_count': Category.objects.count() if hasattr(Category, 'objects') else 0,
                'today_login_count': LoginLog.objects.filter(login_time__gte=today_start, status='success').count(),
            }
        })


class DataExportView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        export_type = request.data.get('export_type')
        if export_type not in ['articles', 'users', 'login_logs']:
            return Response({'success': False, 'message': '无效的导出类型'}, status=status.HTTP_400_BAD_REQUEST)

        if export_type == 'articles':
            qs = Article.objects.all()
            file_name = f'articles_{date.today().isoformat()}'
            record_count = qs.count()
        elif export_type == 'users':
            qs = User.objects.all()
            file_name = f'users_{date.today().isoformat()}'
            record_count = qs.count()
        else:
            qs = LoginLog.objects.all()
            file_name = f'login_logs_{date.today().isoformat()}'
            record_count = qs.count()

        record = DataExportRecord.objects.create(
            export_type=export_type,
            file_name=file_name,
            record_count=record_count,
            created_by=request.user
        )

        return Response({
            'success': True,
            'message': '导出成功',
            'data': DataExportRecordSerializer(record).data
        })


class ExportHistoryListView(ListAPIView):
    permission_classes = [IsAuthenticated]
    queryset = DataExportRecord.objects.all()
    serializer_class = DataExportRecordSerializer


class AnalysisView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        now = timezone.now()

        article_trend = []
        for i in range(6, -1, -1):
            day = (now - timedelta(days=i)).date()
            count = Article.objects.filter(created_at__date=day).count()
            article_trend.append({'date': day.isoformat(), 'count': count})

        article_status_dist = [
            {'name': '已发布', 'value': Article.objects.filter(status='published').count()},
            {'name': '草稿', 'value': Article.objects.filter(status='draft').count()},
        ]

        user_role_dist = []
        for choice in User._meta.get_field('role').choices:
            user_role_dist.append({
                'name': choice[1],
                'value': User.objects.filter(role=choice[0]).count()
            })

        login_trend = []
        for i in range(29, -1, -1):
            day = (now - timedelta(days=i)).date()
            count = LoginLog.objects.filter(login_time__date=day, status='success').count()
            login_trend.append({'date': day.isoformat(), 'count': count})

        return Response({
            'success': True,
            'data': {
                'article_trend': article_trend,
                'article_status_dist': article_status_dist,
                'user_role_dist': user_role_dist,
                'login_trend': login_trend,
            }
        })


class ConfigListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        configs = SystemConfig.objects.all()
        serializer = SystemConfigSerializer(configs, many=True)
        return Response({'success': True, 'data': serializer.data})

    def put(self, request):
        items = request.data.get('items', [])
        updated = []
        for item in items:
            config, _ = SystemConfig.objects.update_or_create(
                key=item['key'],
                defaults={'value': item.get('value', ''), 'description': item.get('description', '')}
            )
            updated.append(SystemConfigSerializer(config).data)
        return Response({'success': True, 'message': '配置更新成功', 'data': updated})


class ProfileUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request):
        user = request.user
        data = request.data
        if 'username' in data and data['username']:
            user.username = data['username']
        if 'email' in data:
            user.email = data['email'] or ''
        if 'avatar' in data:
            user.avatar = data.get('avatar') or None
        user.save()
        from auth_app.serializers import UserInfoSerializer
        return Response({
            'success': True,
            'message': '个人信息更新成功',
            'data': UserInfoSerializer(user).data
        })
