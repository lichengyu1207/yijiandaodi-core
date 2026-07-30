"""
报告生成API路由

三份报告交付：
1. 创作时间线报告
2. 素材风险报告
3. 账号资产报告
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .report_views import ReportViewSet

router = DefaultRouter()
router.register(r'', ReportViewSet, basename='report')

urlpatterns = [
    path('', include(router.urls)),
]