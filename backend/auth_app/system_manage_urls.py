from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .system_manage_views import FrontendUserManageViewSet, SystemSecurityConfigViewSet

router = DefaultRouter()
router.register(r'frontend-users', FrontendUserManageViewSet, basename='frontend-user')
router.register(r'security-configs', SystemSecurityConfigViewSet, basename='security-config')

urlpatterns = [
    path('', include(router.urls)),
]
