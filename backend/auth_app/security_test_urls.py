"""
一鉴到底AI Agent行为安全平台 - 安全测试URL路由
"""

from django.urls import path
from . import security_test_views

urlpatterns = [
    # 安全测试执行
    path('run/', security_test_views.run_security_test, name='run_security_test'),
    
    # 实时输入安全校验
    path('verify/', security_test_views.verify_input_security, name='verify_input_security'),
    
    # 失败方式清单
    path('failure-modes/', security_test_views.get_failure_modes_list, name='get_failure_modes_list'),
    path('failure-modes/<str:failure_id>/', security_test_views.get_failure_mode_detail, name='get_failure_mode_detail'),
    
    # Critical级别失败方式
    path('critical-failures/', security_test_views.get_critical_failures, name='get_critical_failures'),
    
    # 缓解措施报告
    path('mitigation-report/', security_test_views.get_mitigation_report, name='get_mitigation_report'),
    
    # 多层校验引擎状态
    path('layer-status/', security_test_views.get_layer_status, name='get_layer_status'),
    
    # 自定义攻击测试
    path('custom-test/', security_test_views.generate_custom_attack_test, name='generate_custom_attack_test'),
    
    # 测试历史记录
    path('history/', security_test_views.get_test_history, name='get_test_history'),
    
    # 测试metrics
    path('metrics/', security_test_views.get_test_metrics, name='get_test_metrics'),
]