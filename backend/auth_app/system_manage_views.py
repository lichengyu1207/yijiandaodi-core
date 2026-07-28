from django.db.models import Q, Sum
from django.utils import timezone
from django.core.cache import cache
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .system_manage_models import FrontendUserManager, UserBrowseRecord, SystemSecurityConfig
from .system_manage_serializers import (
    FrontendUserSerializer,
    FrontendUserUpdateSerializer,
    UserBrowseRecordSerializer,
    SystemSecurityConfigSerializer,
)


DEFAULT_SECURITY_CONFIGS = {
    'token_expire_seconds': {'value': '86400', 'type': 'int', 'desc': 'Token过期时间(秒)，默认24小时'},
    'session_timeout_seconds': {'value': '7200', 'type': 'int', 'desc': '会话超时时间(秒)，默认2小时'},
    'api_whitelist': {'value': '/api/auth/login/,/api/auth/register/,/api/front/,/api/mall/,/api/media/', 'type': 'json', 'desc': '无需Token校验的接口白名单'},
    'password_min_length': {'value': '8', 'type': 'int', 'desc': '密码最小长度'},
    'password_require_uppercase': {'value': 'true', 'type': 'bool', 'desc': '密码必须包含大写字母'},
    'password_require_lowercase': {'value': 'true', 'type': 'bool', 'desc': '密码必须包含小写字母'},
    'password_require_digit': {'value': 'true', 'type': 'bool', 'desc': '密码必须包含数字'},
    'password_require_special': {'value': 'false', 'type': 'bool', 'desc': '密码必须包含特殊字符'},
    'default_password': {'value': 'Yjdd@2026!', 'type': 'string', 'desc': '初始默认密码'},
    'log_retention_days': {'value': '90', 'type': 'int', 'desc': '日志自动保留天数'},
    'max_login_attempts': {'value': '5', 'type': 'int', 'desc': '最大登录尝试次数'},
    'login_lockout_minutes': {'value': '30', 'type': 'int', 'desc': '登录失败后锁定分钟数'},
}


class FrontendUserManageViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = FrontendUserSerializer

    def get_queryset(self):
        qs = FrontendUserManager.objects.select_related('user').all()
        params = self.request.query_params
        keyword = params.get('keyword', '')
        status_filter = params.get('status', '')
        sort = params.get('ordering', '-user__date_joined')

        if keyword:
            qs = qs.filter(
                Q(user__username__icontains=keyword) |
                Q(nickname__icontains=keyword) |
                Q(phone__icontains=keyword)
            )
        if status_filter == 'active':
            qs = qs.filter(is_banned=False, user__is_active=True)
        elif status_filter == 'banned':
            qs = qs.filter(is_banned=True)
        elif status_filter == 'inactive':
            qs = qs.filter(user__is_active=False)

        return qs.order_by(sort)

    @action(detail=True, methods=['post'], url_path='ban')
    def ban_user(self, request, pk=None):
        obj = self.get_object()
        reason = request.data.get('reason', '违规操作')
        obj.is_banned = True
        obj.ban_reason = reason
        obj.banned_at = timezone.now()
        obj.banned_by = request.user
        obj.save()
        obj.user.is_active = False
        obj.user.save()
        return Response({'success': True, 'message': '已禁用该用户'})

    @action(detail=True, methods=['post'], url_path='unban')
    def unban_user(self, request, pk=None):
        obj = self.get_object()
        obj.is_banned = False
        obj.ban_reason = ''
        obj.banned_at = None
        obj.banned_by = None
        obj.save()
        obj.user.is_active = True
        obj.user.save()
        return Response({'success': True, 'message': '已解除禁用'})

    @action(detail=True, methods=['post'], url_path='reset-info')
    def reset_info(self, request, pk=None):
        obj = self.get_object()
        serializer = FrontendUserUpdateSerializer(obj, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({'success': True, 'message': '重置成功'})
        return Response({'success': False, 'errors': serializer.errors}, status=400)

    @action(detail=True, methods=['get'], url_path='browse-records')
    def browse_records(self, request, pk=None):
        obj = self.get_object()
        records = UserBrowseRecord.objects.filter(user=obj.user)[:100]
        serializer = UserBrowseRecordSerializer(records, many=True)
        return Response({
            'success': True,
            'data': serializer.data,
            'total': records.count(),
        })

    @action(detail=False, methods=['get'], url_path='stats')
    def stats(self, request):
        total = FrontendUserManager.objects.count()
        active = FrontendUserManager.objects.filter(is_banned=False, user__is_active=True).count()
        banned = FrontendUserManager.objects.filter(is_banned=True).count()
        today_new = FrontendUserManager.objects.filter(
            user__date_joined__date=timezone.now().date()
        ).count()
        total_logins = FrontendUserManager.objects.aggregate(
            total=Sum('login_count')
        )['total'] or 0
        return Response({
            'total_users': total,
            'active_users': active,
            'banned_users': banned,
            'today_new': today_new,
            'total_logins': total_logins,
        })


class SystemSecurityConfigViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        configs = {}
        for key, default in DEFAULT_SECURITY_CONFIGS.items():
            try:
                obj = SystemSecurityConfig.objects.get(config_key=key)
                configs[key] = {
                    'id': obj.id,
                    'config_key': key,
                    'config_value': obj.config_value,
                    'config_type': obj.config_type,
                    'description': obj.description,
                }
            except SystemSecurityConfig.DoesNotExist:
                SystemSecurityConfig.objects.create(
                    config_key=key,
                    config_value=default['value'],
                    config_type=default['type'],
                    description=default['desc'],
                )
                configs[key] = {
                    'config_key': key,
                    'config_value': default['value'],
                    'config_type': default['type'],
                    'description': default['desc'],
                }
        return Response({'success': True, 'data': list(configs.values())})

    @action(detail=False, methods=['put'], url_path='update-config')
    def update_config(self, request):
        config_key = request.data.get('config_key')
        config_value = str(request.data.get('config_value', ''))

        if not config_key or config_key not in DEFAULT_SECURITY_CONFIGS:
            return Response({'success': False, 'message': '无效的配置项'}, status=400)

        obj, created = SystemSecurityConfig.objects.update_or_create(
            config_key=config_key,
            defaults={
                'config_value': config_value,
                'config_type': DEFAULT_SECURITY_CONFIGS[config_key]['type'],
                'description': DEFAULT_SECURITY_CONFIGS[config_key]['desc'],
                'updated_by': request.user,
            }
        )

        return Response({'success': True, 'message': '配置已更新'})

    @action(detail=False, methods=['post'], url_path='refresh-cache')
    def refresh_cache(self, request):
        cache.clear()
        return Response({'success': True, 'message': '缓存已刷新'})

    @action(detail=False, methods=['post'], url_path='cleanup-logs')
    def cleanup_logs(self, request):
        days = int(request.data.get('days', 90))
        cutoff = timezone.now() - timezone.timedelta(days=days)
        from .log_center_models import OperationLog, PermissionInterceptLog
        from .models import LoginLog as LoginLogModel
        login_deleted, _ = LoginLogModel.objects.filter(login_time__lt=cutoff).delete()
        op_deleted, _ = OperationLog.objects.filter(created_at__lt=cutoff).delete()
        perm_deleted, _ = PermissionInterceptLog.objects.filter(created_at__lt=cutoff).delete()

        return Response({
            'success': True,
            'message': f'清理完成：删除登录日志{login_deleted}条、操作日志{op_deleted}条、拦截日志{perm_deleted}条',
        })
