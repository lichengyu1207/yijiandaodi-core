"""Agent健康监控URL路由"""

from django.urls import path
from . import health_views

urlpatterns = [
    path('heartbeat/', health_views.record_heartbeat, name='record_heartbeat'),
    path('timeout/', health_views.check_timeout, name='check_timeout'),
    path('loop/', health_views.detect_loop, name='detect_loop'),
    path('context/', health_views.check_business_context, name='check_business_context'),
    path('summary/', health_views.health_summary, name='health_summary'),
    path('heartbeat-history/', health_views.heartbeat_history, name='heartbeat_history'),
    path('loop-history/', health_views.loop_detection_history, name='loop_history'),
]