"""
可信时间戳API路由
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .timestamp_views import TrustedTimestampViewSet

router = DefaultRouter()
router.register(r'', TrustedTimestampViewSet, basename='timestamp')

urlpatterns = [
    path('', include(router.urls)),
]