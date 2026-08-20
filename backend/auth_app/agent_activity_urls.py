"""
Agent活动日志URL路由
"""

from django.urls import path
from .agent_activity_views import (
    batch_create_activities,
    get_activities,
    get_cache_stats,
)

urlpatterns = [
    # 批量上报
    path('batch/', batch_create_activities, name='agent-activity-batch'),

    # 查询日志
    path('', get_activities, name='agent-activity-list'),

    # 缓存统计（调试）
    path('cache-stats/', get_cache_stats, name='agent-activity-cache-stats'),
]