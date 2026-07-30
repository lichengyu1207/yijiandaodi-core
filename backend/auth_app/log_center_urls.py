from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .log_center_views import LoginLogViewSet, OperationLogViewSet, PermissionInterceptLogViewSet

router = DefaultRouter()
router.register(r'login-logs', LoginLogViewSet, basename='login-log')
router.register(r'operation-logs', OperationLogViewSet, basename='operation-log')
router.register(r'permission-intercepts', PermissionInterceptLogViewSet, basename='permission-intercept')

urlpatterns = [
    path('', include(router.urls)),
]
