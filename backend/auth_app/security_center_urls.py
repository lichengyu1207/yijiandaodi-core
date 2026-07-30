from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .security_center_views import (
    DashboardViewSet,
    UnifiedLogCenterViewSet,
    SecurityAlertViewSet,
    SecurityReportViewSet,
)

router = DefaultRouter()
router.register(r'dashboard', DashboardViewSet, basename='security-dashboard')
router.register(r'logs', UnifiedLogCenterViewSet, basename='unified-logs')
router.register(r'alerts', SecurityAlertViewSet, basename='security-alert')
router.register(r'reports', SecurityReportViewSet, basename='security-report')

urlpatterns = [
    path('', include(router.urls)),
]
