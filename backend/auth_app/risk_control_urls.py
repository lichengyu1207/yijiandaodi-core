from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .risk_control_views import (
    RegexRuleViewSet,
    ContentAuditLogViewSet,
    CheckContentViewSet,
    RegexTestCaseViewSet,
)

router = DefaultRouter()
router.register(r'rules', RegexRuleViewSet, basename='risk-rule')
router.register(r'audit-logs', ContentAuditLogViewSet, basename='audit-log')
router.register(r'test-cases', RegexTestCaseViewSet, basename='regex-test-case')
router.register(r'check', CheckContentViewSet, basename='text-check')

urlpatterns = [
    path('', include(router.urls)),
]
