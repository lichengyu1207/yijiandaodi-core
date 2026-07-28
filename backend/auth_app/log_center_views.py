import csv
import io
from datetime import datetime
from django.db.models import Q
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import LoginLog as LoginLogModel
from .rbac_models import OperationLog
from .log_center_models import PermissionInterceptLog
from .log_center_serializers import (
    LoginLogSerializer,
    OperationLogSerializer,
    PermissionInterceptLogSerializer,
)


class BaseLogViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return self.queryset

    @action(detail=False, methods=['get'], url_path='export')
    def export(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        data = self.get_serializer(queryset[:10000], many=True).data
        if not data:
            return Response({'success': False, 'message': '暂无数据可导出'})
        output = io.StringIO()
        if data:
            writer = csv.DictWriter(output, fieldnames=data[0].keys())
            writer.writeheader()
            writer.writerows(data)
        response = Response(
            content=output.getvalue(),
            content_type='text/csv',
            headers={'Content-Disposition': f'attachment; filename="{self.export_filename}_{datetime.now():%Y%m%d}.csv"'},
        )
        return response


class LoginLogViewSet(BaseLogViewSet):
    serializer_class = LoginLogSerializer
    export_filename = 'login_logs'

    def get_queryset(self):
        qs = LoginLogModel.objects.all()
        params = self.request.query_params
        keyword = params.get('keyword', '')
        status_filter = params.get('status', '')
        start_date = params.get('start_date', '')
        end_date = params.get('end_date', '')

        if keyword:
            qs = qs.filter(Q(username__icontains=keyword) | Q(ip_address__icontains=keyword))
        if status_filter and status_filter != 'all':
            qs = qs.filter(status=status_filter)
        if start_date:
            qs = qs.filter(login_time__gte=start_date)
        if end_date:
            qs = qs.filter(login_time__lte=end_date + ' 23:59:59')

        return qs.order_by('-login_time')

    @action(detail=False, methods=['post'], url_path='record-login')
    def record_login(self, request):
        data = {
            'user': request.user,
            'username': request.user.username,
            'ip_address': request.META.get('REMOTE_ADDR', ''),
            'device_info': request.META.get('HTTP_USER_AGENT', '')[:200],
            'user_agent': request.META.get('HTTP_USER_AGENT', ''),
            'login_time': timezone.now(),
            'status': 'success',
            'session_id': '',
        }
        LoginLogModel.objects.create(**data)
        return Response({'success': True})

    @action(detail=False, methods=['post'], url_path='record-logout')
    def record_logout(self, request):
        LoginLogModel.objects.filter(
            user=request.user, status='success', logout_time__isnull=True
        ).update(logout_time=timezone.now(), status='logout')
        return Response({'success': True})


class OperationLogViewSet(BaseLogViewSet):
    serializer_class = OperationLogSerializer
    export_filename = 'operation_logs'

    def get_queryset(self):
        qs = OperationLog.objects.all()
        params = self.request.query_params
        keyword = params.get('keyword', '')
        module = params.get('module', '')
        action = params.get('action', '')
        result = params.get('result', '')
        start_date = params.get('start_date', '')
        end_date = params.get('end_date', '')

        if keyword:
            qs = qs.filter(
                Q(operator_name__icontains=keyword) |
                Q(url__icontains=keyword) |
                Q(message__icontains=keyword)
            )
        if module and module != 'all':
            qs = qs.filter(module=module)
        if action and action != 'all':
            qs = qs.filter(action=action)
        if result and result != 'all':
            qs = qs.filter(result=result)
        if start_date:
            qs = qs.filter(created_at__gte=start_date)
        if end_date:
            qs = qs.filter(created_at__lte=end_date + ' 23:59:59')

        return qs.order_by('-created_at')


class PermissionInterceptLogViewSet(BaseLogViewSet):
    serializer_class = PermissionInterceptLogSerializer
    export_filename = 'permission_intercept_logs'

    def get_queryset(self):
        qs = PermissionInterceptLog.objects.all()
        params = self.request.query_params
        keyword = params.get('keyword', '')
        intercept_type = params.get('intercept_type', '')
        start_date = params.get('start_date', '')
        end_date = params.get('end_date', '')

        if keyword:
            qs = qs.filter(
                Q(username__icontains=keyword) |
                Q(target_resource__icontains=keyword) |
                Q(request_url__icontains=keyword)
            )
        if intercept_type and intercept_type != 'all':
            qs = qs.filter(intercept_type=intercept_type)
        if start_date:
            qs = qs.filter(created_at__gte=start_date)
        if end_date:
            qs = qs.filter(created_at__lte=end_date + ' 23:59:59')

        return qs.order_by('-created_at')

    @action(detail=False, methods=['post'], url_path='record')
    def record(self, request):
        data = request.data
        user = request.user if request.user.is_authenticated else None
        log_data = {
            'user': user,
            'username': user.username if user else data.get('username', ''),
            'intercept_type': data.get('intercept_type', 'api_unauthorized'),
            'target_resource': data.get('target_resource', ''),
            'request_method': request.method,
            'request_url': request.path,
            'ip_address': request.META.get('REMOTE_ADDR', ''),
            'user_agent': request.META.get('HTTP_USER_AGENT', ''),
            'detail': data.get('detail', ''),
        }
        PermissionInterceptLog.objects.create(**log_data)
        return Response({'success': True})
