from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import dual_engine_views

router = DefaultRouter()
router.register(r'dual-engine-scan', dual_engine_views.DualEngineScanViewSet, basename='dual-engine-scan')

urlpatterns = [
    path('', include(router.urls)),
]
