from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .c_scenario_views import AcademicIntegrityCheckViewSet, EnterpriseSecurityAuditViewSet

router = DefaultRouter()
router.register(r'academic', AcademicIntegrityCheckViewSet, basename='cscenario-academic')
router.register(r'enterprise-audit', EnterpriseSecurityAuditViewSet, basename='cscenario-enterprise-audit')

urlpatterns = [
    path('', include(router.urls)),
]
