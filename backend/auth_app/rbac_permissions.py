from functools import wraps
from django.http import JsonResponse
from rest_framework.permissions import BasePermission
from .rbac_models import Permission, Menu


def has_permission(perm_code):
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return JsonResponse({'success': False, 'message': '未登录'}, status=401)
            user_perms = get_user_permissions(request.user)
            if perm_code in user_perms:
                return view_func(request, *args, **kwargs)
            return JsonResponse({'success': False, 'message': '无权访问'}, status=403)
        return wrapper
    return decorator


class HasPermission(BasePermission):
    def __init__(self, perm_code=''):
        self.perm_code = perm_code

    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        user_perms = get_user_permissions(request.user)
        return self.perm_code in user_perms


def get_user_permissions(user):
    if user.is_superuser:
        return set(Permission.objects.values_list('code', flat=True))
    roles = user.roles.filter(status=True).prefetch_related('permissions')
    perms = set()
    for role in roles:
        for perm in role.permissions.filter(status=True):
            perms.add(perm.code)
            p = perm.parent
            while p:
                perms.add(p.code)
                p = p.parent
    return perms


def get_user_menus(user):
    if user.is_superuser:
        menus = Menu.objects.filter(status=True, visible=True)
    else:
        roles = user.roles.filter(status=True)
        menu_ids = set()
        for role in roles:
            menu_ids.update(role.menus.filter(status=True, visible=True).values_list('id', flat=True))
        menus = Menu.objects.filter(id__in=menu_ids, status=True, visible=True)
    return build_tree(menus)


def build_tree(queryset, parent_id=None):
    tree = []
    for item in queryset.filter(parent_id=parent_id).order_by('sort_order', 'id'):
        node = {
            'id': item.id,
            'name': item.name,
            'code': item.code,
            'type': item.menu_type,
            'path': item.path,
            'component': item.component,
            'icon': item.icon,
            'children': build_tree(queryset, parent_id=item.id),
        }
        tree.append(node)
    return tree


def get_data_scope_queryset(user, model_class):
    if user.is_superuser:
        return model_class.objects.all()
    roles = user.roles.filter(status=True)
    scopes = [r.data_scope for r in roles]
    if 'all' in scopes:
        return model_class.objects.all()
    elif 'role' in scopes:
        role_user_ids = set()
        for r in roles:
            role_user_ids.update(r.users.values_list('id', flat=True))
        queryset = model_class.objects.all()
        if hasattr(model_class, 'created_by'):
            queryset = queryset.filter(created_by__id__in=role_user_ids)
        return queryset
    else:
        queryset = model_class.objects.all()
        if hasattr(model_class, 'created_by'):
            queryset = queryset.filter(created_by=user)
        return queryset
