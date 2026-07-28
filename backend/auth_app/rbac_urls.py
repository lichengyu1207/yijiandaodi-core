from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .rbac_views import (
    RoleViewSet, PermissionViewSet, MenuViewSet,
    UserManageViewSet, OperationLogViewSet, PermissionAuditLogViewSet
)

router = DefaultRouter()
router.register(r'roles', RoleViewSet, basename='rbac-role')
router.register(r'permissions', PermissionViewSet, basename='rbac-permission')
router.register(r'menus', MenuViewSet, basename='rbac-menu')
router.register(r'users-manage', UserManageViewSet, basename='rbac-user-manage')
router.register(r'operation-logs', OperationLogViewSet, basename='rbac-operation-log')
router.register(r'permission-audit-logs', PermissionAuditLogViewSet, basename='rbac-permission-audit-log')

urlpatterns = [
    path('', include(router.urls)),
]
