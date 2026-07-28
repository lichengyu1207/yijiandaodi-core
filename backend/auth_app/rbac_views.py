import json
from rest_framework import viewsets, status, mixins
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from django.db.models import Q

from .rbac_models import Role, Permission, Menu, OperationLog, PermissionAuditLog
from .rbac_serializers import (
    RoleSerializer, PermissionSerializer, MenuSerializer,
    OperationLogSerializer, PermissionAuditLogSerializer,
    CreateUserSerializer, ResetPasswordSerializer
)
from .models import User


def _get_client_ip(request):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


def _create_operation_log(request, module, action, result, message='', duration=0):
    try:
        OperationLog.objects.create(
            operator=request.user if request.user.is_authenticated else None,
            module=module,
            action=action,
            method=request.method,
            url=request.path,
            request_data=json.dumps(request.data, ensure_ascii=False)[:2000] if request.data else '',
            ip_address=_get_client_ip(request),
            response_code=200,
            result=result,
            message=message[:1000],
            duration=duration
        )
    except Exception:
        pass


def _create_audit_log(request, target_type, target_id, target_name, action,
                      detail_before='', detail_after=''):
    try:
        PermissionAuditLog.objects.create(
            operator=request.user if request.user.is_authenticated else None,
            target_type=target_type,
            target_id=target_id,
            target_name=target_name,
            action=action,
            detail_before=str(detail_before)[:2000] if detail_before else '',
            detail_after=str(detail_after)[:2000] if detail_after else '',
            ip_address=_get_client_ip(request)
        )
    except Exception:
        pass


class RoleViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Role.objects.all()
    serializer_class = RoleSerializer

    def get_queryset(self):
        queryset = Role.objects.all()
        search = self.request.query_params.get('search', '')
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(code__icontains=search)
            )
        return queryset.order_by('sort_order', 'id')

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'success': True,
            'message': '获取角色列表成功',
            'data': serializer.data
        })

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        data = serializer.data
        data['permissions'] = PermissionSerializer(instance.permissions.all(), many=True).data
        return Response({
            'success': True,
            'message': '获取角色详情成功',
            'data': data
        })

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        permissions = serializer.validated_data.pop('permissions', [])
        role = serializer.save()
        if permissions:
            role.permissions.set(permissions)
        _create_operation_log(request, '角色管理', 'create', 'success',
                              f'创建角色: {role.name}')
        return Response({
            'success': True,
            'message': '创建角色成功',
            'data': RoleSerializer(role).data
        }, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        detail_before = RoleSerializer(instance).data
        serializer = self.get_serializer(instance, data=request.data)
        serializer.is_valid(raise_exception=True)
        permissions = serializer.validated_data.pop('permissions', None)
        role = serializer.save()
        if permissions is not None:
            role.permissions.set(permissions)
        detail_after = RoleSerializer(role).data
        _create_audit_log(request, 'role', instance.id, instance.name,
                          'update_role', detail_before, detail_after)
        return Response({
            'success': True,
            'message': '更新角色成功',
            'data': RoleSerializer(role).data
        })

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        role_name = instance.name
        role_id = instance.id
        instance.delete()
        _create_audit_log(request, 'role', role_id, role_name, 'delete_role')
        return Response({
            'success': True,
            'message': '删除角色成功'
        })

    @action(detail=True, methods=['post'])
    def assign_permissions(self, request, pk=None):
        role = self.get_object()
        permission_ids = request.data.get('permission_ids', [])
        permissions = Permission.objects.filter(id__in=permission_ids)
        role.permissions.set(permissions)
        perm_codes = list(permissions.values_list('code', flat=True))
        _create_audit_log(request, 'role', role.id, role.name, 'assign_perm',
                          '', f'分配权限: {perm_codes}')
        return Response({
            'success': True,
            'message': '权限分配成功'
        })


class PermissionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Permission.objects.filter(parent__isnull=True)
    serializer_class = PermissionSerializer

    def get_queryset(self):
        queryset = Permission.objects.all()
        perm_type = self.request.query_params.get('type', '')
        if perm_type:
            queryset = queryset.filter(perm_type=perm_type)
        return queryset.order_by('sort_order', 'id')

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset().filter(parent__isnull=True)
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'success': True,
            'message': '获取权限列表成功',
            'data': serializer.data
        })

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response({
            'success': True,
            'message': '获取权限详情成功',
            'data': serializer.data
        })

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        permission = serializer.save()
        _create_operation_log(request, '权限管理', 'create', 'success',
                              f'创建权限: {permission.name}')
        return Response({
            'success': True,
            'message': '创建权限成功',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response({
            'success': True,
            'message': '更新权限成功',
            'data': serializer.data
        })

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        return Response({
            'success': True,
            'message': '删除权限成功'
        })

    @action(detail=False, methods=['get'])
    def tree(self, request):
        queryset = Permission.objects.filter(
            parent__isnull=True,
            status=True
        ).order_by('sort_order', 'id')
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'success': True,
            'message': '获取权限树成功',
            'data': serializer.data
        })


class MenuViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = Menu.objects.filter(parent__isnull=True)
    serializer_class = MenuSerializer

    def get_queryset(self):
        return Menu.objects.all().order_by('sort_order', 'id')

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset().filter(parent__isnull=True)
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'success': True,
            'message': '获取菜单列表成功',
            'data': serializer.data
        })

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response({
            'success': True,
            'message': '获取菜单详情成功',
            'data': serializer.data
        })

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        menu = serializer.save()
        _create_operation_log(request, '菜单管理', 'create', 'success',
                              f'创建菜单: {menu.name}')
        return Response({
            'success': True,
            'message': '创建菜单成功',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        detail_before = MenuSerializer(instance).data
        serializer = self.get_serializer(instance, data=request.data)
        serializer.is_valid(raise_exception=True)
        menu = serializer.save()
        detail_after = MenuSerializer(menu).data
        _create_audit_log(request, 'menu', instance.id, instance.name,
                          'update_menu', detail_before, detail_after)
        return Response({
            'success': True,
            'message': '更新菜单成功',
            'data': serializer.data
        })

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        menu_name = instance.name
        menu_id = instance.id
        instance.delete()
        _create_audit_log(request, 'menu', menu_id, menu_name, 'delete_menu')
        return Response({
            'success': True,
            'message': '删除菜单成功'
        })

    @action(detail=False, methods=['get'])
    def tree(self, request):
        queryset = Menu.objects.filter(
            parent__isnull=True,
            status=True,
            visible=True
        ).order_by('sort_order', 'id')
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'success': True,
            'message': '获取菜单树成功',
            'data': serializer.data
        })

    @action(detail=False, methods=['get'], url_path='user-menus')
    def user_menus(self, request):
        user = request.user
        try:
            # 兼容多种角色值写法
            is_admin = (
                user.is_superuser
                or getattr(user, 'is_staff', False)
                or str(user.role) in ('super_admin', 'superadmin', 'admin')
            )
            if is_admin:
                queryset = Menu.objects.filter(status=True, visible=True).order_by('sort_order', 'id')
            else:
                from .rbac_models import Role
                try:
                    role_id = getattr(user, 'role_id', None)
                    if role_id:
                        role = Role.objects.get(id=role_id)
                        if role and role.menus.exists():
                            menu_ids = list(role.menus.values_list('id', flat=True))
                            queryset = Menu.objects.filter(id__in=menu_ids, status=True, visible=True).order_by('sort_order', 'id')
                        else:
                            queryset = Menu.objects.none()
                    else:
                        queryset = Menu.objects.none()
                except Exception:
                    queryset = Menu.objects.filter(parent__isnull=True, status=True, visible=True).order_by('sort_order', 'id')

            serializer = self.get_serializer(queryset, many=True)
            return Response({
                'success': True,
                'data': serializer.data
            })
        except Exception as e:
            import logging
            logging.getLogger('auth_app').error(f"user_menus error: {e}", exc_info=True)
            return Response({'success': True, 'data': []})


class UserManageViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = User.objects.all()
    serializer_class = CreateUserSerializer

    def get_queryset(self):
        queryset = User.objects.all()
        search = self.request.query_params.get('search', '')
        role_filter = self.request.query_params.get('role', '')
        status_filter = self.request.query_params.get('status', '')

        if search:
            queryset = queryset.filter(
                Q(username__icontains=search) | Q(email__icontains=search)
            )
        if role_filter:
            queryset = queryset.filter(role=role_filter)
        if status_filter is not None:
            is_active = status_filter.lower() == 'true'
            queryset = queryset.filter(is_active=is_active)

        return queryset.order_by('-date_joined')

    def get_serializer_class(self):
        if self.action in ['create']:
            return CreateUserSerializer
        from .serializers import UserSerializer
        return UserSerializer

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response({
                'success': True,
                'message': '获取用户列表成功',
                'data': serializer.data
            })
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'success': True,
            'message': '获取用户列表成功',
            'data': serializer.data
        })

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        from .serializers import UserSerializer
        serializer = UserSerializer(instance)
        data = serializer.data
        data['roles'] = list(instance.roles.values('id', 'name', 'code')) if hasattr(instance, 'roles') else []
        return Response({
            'success': True,
            'message': '获取用户详情成功',
            'data': data
        })

    def create(self, request, *args, **kwargs):
        serializer = CreateUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validated_data = serializer.validated_data
        role_ids = validated_data.pop('role_ids', [])

        user = User.objects.create_user(**validated_data)
        # 安全设置角色（兼容无 roles M2M 字段的情况）
        if role_ids and hasattr(user, 'roles'):
            try:
                user.roles.set(role_ids)
            except Exception:
                pass
        _create_operation_log(request, '用户管理', 'create', 'success',
                              f'创建用户: {user.username}')
        from .serializers import UserSerializer
        return Response({
            'success': True,
            'message': '创建用户成功',
            'data': UserSerializer(user).data
        }, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        from .serializers import UserSerializer
        detail_before = UserSerializer(instance).data
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        allowed_fields = ['username', 'email', 'avatar', 'role', 'is_active']
        data = {k: v for k, v in request.data.items() if k in allowed_fields}

        for key, value in data.items():
            setattr(instance, key, value)
        instance.save()

        role_ids = request.data.get('role_ids', None)
        if role_ids is not None and hasattr(instance, 'roles'):
            try:
                instance.roles.set(role_ids)
            except Exception:
                pass

        detail_after = UserSerializer(instance).data
        _create_operation_log(request, '用户管理', 'update', 'success',
                              f'更新用户: {instance.username}')
        _create_audit_log(request, 'user', instance.id, instance.username,
                          'assign_role' if role_ids is not None else 'update_role',
                          detail_before, detail_after)
        return Response({
            'success': True,
            'message': '更新用户成功',
            'data': UserSerializer(instance).data
        })

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        username = instance.username
        instance.is_active = False
        instance.save()
        _create_operation_log(request, '用户管理', 'delete', 'success',
                              f'禁用用户: {username}')
        return Response({
            'success': True,
            'message': '用户已禁用'
        })

    @action(detail=True, methods=['post'])
    def reset_password(self, request, pk=None):
        user = self.get_object()
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_password = serializer.validated_data['new_password']
        user.set_password(new_password)
        user.save()
        _create_operation_log(request, '用户管理', 'other', 'success',
                              f'重置密码: {user.username}')
        return Response({
            'success': True,
            'message': '密码重置成功'
        })

    @action(detail=True, methods=['post'])
    def assign_roles(self, request, pk=None):
        user = self.get_object()
        role_ids = request.data.get('role_ids', [])
        roles = Role.objects.filter(id__in=role_ids)
        old_roles = list(user.roles.values_list('id', flat=True))
        user.roles.set(roles)
        new_roles = list(role_ids)
        _create_audit_log(request, 'user', user.id, user.username, 'assign_role',
                          f'旧角色: {old_roles}', f'新角色: {new_roles}')
        return Response({
            'success': True,
            'message': '角色分配成功'
        })


class OperationLogViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = OperationLog.objects.all()
    serializer_class = OperationLogSerializer

    def get_queryset(self):
        queryset = OperationLog.objects.all()

        module = self.request.query_params.get('module', '')
        action = self.request.query_params.get('action', '')
        result = self.request.query_params.get('result', '')
        user_id = self.request.query_params.get('user_id', '')
        start_date = self.request.query_params.get('start_date', '')
        end_date = self.request.query_params.get('end_date', '')

        if module:
            queryset = queryset.filter(module__icontains=module)
        if action:
            queryset = queryset.filter(action=action)
        if result:
            queryset = queryset.filter(result=result)
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        if start_date:
            queryset = queryset.filter(created_at__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__lte=end_date)

        return queryset

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response({
                'success': True,
                'message': '获取操作日志成功',
                'data': serializer.data
            })
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'success': True,
            'message': '获取操作日志成功',
            'data': serializer.data
        })


class PermissionAuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    queryset = PermissionAuditLog.objects.all()
    serializer_class = PermissionAuditLogSerializer

    def get_queryset(self):
        queryset = PermissionAuditLog.objects.all()

        target_type = self.request.query_params.get('target_type', '')
        action = self.request.query_params.get('action', '')
        operator_id = self.request.query_params.get('operator_id', '')

        if target_type:
            queryset = queryset.filter(target_type=target_type)
        if action:
            queryset = queryset.filter(action=action)
        if operator_id:
            queryset = queryset.filter(operator_id=operator_id)

        return queryset

    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response({
                'success': True,
                'message': '获取审计日志成功',
                'data': serializer.data
            })
        serializer = self.get_serializer(queryset, many=True)
        return Response({
            'success': True,
            'message': '获取审计日志成功',
            'data': serializer.data
        })
