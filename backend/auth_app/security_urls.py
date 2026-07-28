"""安全中心API路由（修复版）"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .security_views import (
    AgentSecurityRuleViewSet,
    AgentRiskLogViewSet,
    SecurityCheckViewSet,
)
from .security_test_views import (
    run_security_test,
    verify_input_security,
    get_failure_modes_list,
    get_failure_mode_detail,
    get_critical_failures,
    get_mitigation_report,
    get_layer_status,
    generate_custom_attack_test,
    get_test_history,
    get_test_metrics,
)

router = DefaultRouter()
router.register(r'rules', AgentSecurityRuleViewSet, basename='security-rule')
router.register(r'risk-logs', AgentRiskLogViewSet, basename='risk-log')
router.register(r'check', SecurityCheckViewSet, basename='security-check')

urlpatterns = [
    path('', include(router.urls)),
    
    # 安全测试API（使用函数式接口代替ViewSet）
    path('test/run/', run_security_test, name='run-test'),
    path('test/verify/', verify_input_security, name='verify-input'),
    path('test/failure-modes/', get_failure_modes_list, name='failure-modes'),
    path('test/failure-modes/<int:failure_id>/', get_failure_mode_detail, name='failure-mode-detail'),
    path('test/critical-failures/', get_critical_failures, name='critical-failures'),
    path('test/mitigation-report/', get_mitigation_report, name='mitigation-report'),
    path('test/layer-status/', get_layer_status, name='layer-status'),
    path('test/custom-attack/', generate_custom_attack_test, name='custom-attack'),
    path('test/history/', get_test_history, name='test-history'),
    path('test/metrics/', get_test_metrics, name='test-metrics'),
]