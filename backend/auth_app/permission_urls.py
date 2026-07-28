"""权限控制URL路由"""

from django.urls import path
from . import permission_views

urlpatterns = [
    path('check/', permission_views.check_permission, name='check_permission'),
    path('audit/', permission_views.audit_permission, name='audit_permission'),
    path('register/', permission_views.register_agent, name='register_agent'),
    path('shadow-detect/', permission_views.detect_shadow_ai, name='detect_shadow_ai'),
    path('registry-summary/', permission_views.registry_summary, name='registry_summary'),
    path('audit-logs/', permission_views.audit_logs, name='audit_logs'),
    path('violations/', permission_views.violations, name='violations'),
]