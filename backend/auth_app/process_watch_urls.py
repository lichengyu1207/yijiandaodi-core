"""
进程行为监控 URL 路由
"""

from django.urls import path

from .process_watch_views import (
    ProcessReportView,
    ProcessStatsView,
    ProcessTimelineView,
)

urlpatterns = [
    path('report/', ProcessReportView.as_view(), name='process-report'),
    path('stats/', ProcessStatsView.as_view(), name='process-stats'),
    path('timeline/', ProcessTimelineView.as_view(), name='process-timeline'),
]
