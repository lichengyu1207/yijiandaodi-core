from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .unified_scan_views import UnifiedContentScanViewSet

router = DefaultRouter()
router.register(r'unified-scan', UnifiedContentScanViewSet, basename='unified-scan')

urlpatterns = [
    path('', include(router.urls)),
]
