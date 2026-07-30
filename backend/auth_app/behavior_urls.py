"""
Agent行为分析API路由配置
"""

from django.urls import path
from . import behavior_views

app_name = 'behavior'

urlpatterns = [
    # 行为监控总览
    path('overview/', behavior_views.behavior_overview, name='overview'),
    
    # 行为日志查询
    path('list/', behavior_views.behavior_list, name='list'),
    path('<int:behavior_id>/', behavior_views.behavior_detail, name='detail'),
    
    # 行为统计分析
    path('statistics/', behavior_views.behavior_statistics, name='statistics'),
    
    # 行为分析报告
    path('report/', behavior_views.behavior_report, name='report'),
    
    # 行为模式列表
    path('pattern/list/', behavior_views.pattern_list, name='pattern_list'),
    
    # 基线模型管理
    path('baseline/list/', behavior_views.baseline_list, name='baseline_list'),
    path('baseline/<int:baseline_id>/', behavior_views.baseline_detail, name='baseline_detail'),
    path('baseline/build/', behavior_views.baseline_build, name='baseline_build'),
    path('baseline/build-all/', behavior_views.baseline_build_all, name='baseline_build_all'),
    
    # 异常检测管理
    path('anomaly/list/', behavior_views.anomaly_list, name='anomaly_list'),
    path('anomaly/<int:anomaly_id>/', behavior_views.anomaly_detail, name='anomaly_detail'),
    path('anomaly/<int:anomaly_id>/resolve/', behavior_views.anomaly_resolve, name='anomaly_resolve'),
    
    # 系统健康状态
    path('health/', behavior_views.behavior_health, name='health'),
]