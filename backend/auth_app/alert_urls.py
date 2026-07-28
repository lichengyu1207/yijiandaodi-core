"""
一鉴到底AI Agent行为安全平台 - 告警管理URL路由
"""

from django.urls import path
from . import alert_views

urlpatterns = [
    # 告警处理
    path('process/', alert_views.process_alert, name='process_alert'),
    path('batch-process/', alert_views.batch_process_alerts, name='batch_process_alerts'),
    
    # 告警聚合
    path('aggregate/', alert_views.aggregate_alerts, name='aggregate_alerts'),
    path('aggregated/', alert_views.get_aggregated_alerts, name='get_aggregated_alerts'),
    path('high-risk/', alert_views.get_high_risk_alerts, name='get_high_risk_alerts'),
    
    # 告警统计
    path('statistics/', alert_views.get_alert_statistics, name='get_alert_statistics'),
    
    # 告警规则
    path('rules/', alert_views.get_aggregation_rules, name='get_aggregation_rules'),
    path('rules/update/', alert_views.update_aggregation_rules, name='update_aggregation_rules'),
    
    # 告警定义
    path('priorities/', alert_views.get_alert_priorities, name='get_alert_priorities'),
    path('categories/', alert_views.get_alert_categories, name='get_alert_categories'),
    
    # 告警报告
    path('report/', alert_views.generate_alert_report, name='generate_alert_report'),
    
    # 告警缓存
    path('cache/clear/', alert_views.clear_alert_cache, name='clear_alert_cache'),
]