from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import package_views as pv

router = DefaultRouter()
router.register(r'scenario-packages', pv.ScenarioPackageViewSet, basename='scenario-pkg')
router.register(r'audit-services', pv.EnterpriseAuditServiceViewSet, basename='audit-svc')

urlpatterns = [
    path('', include(router.urls)),
]
