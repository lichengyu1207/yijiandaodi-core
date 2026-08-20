"""
风险评估和告警API URL路由
"""

from django.urls import path
from . import risk_assessment_views

app_name = 'risk_assessment'

urlpatterns = [
    # 风险评估接口
    path('assess/', risk_assessment_views.assess_risk, name='assess_risk'),
    path('assess-batch/', risk_assessment_views.assess_risk_batch, name='assess_risk_batch'),

    # 缓存管理接口
    path('cache-stats/', risk_assessment_views.get_cache_stats, name='get_cache_stats'),
    path('clear-cache/', risk_assessment_views.clear_cache, name='clear_cache'),

    # 告警触发接口
    path('alerts/trigger/', risk_assessment_views.trigger_alert, name='trigger_alert'),
]