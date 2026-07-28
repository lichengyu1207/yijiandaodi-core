from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import antifraud_views

router = DefaultRouter()
router.register(r'device-fingerprint', antifraud_views.DeviceFingerprintViewSet, basename='af-device')
router.register(r'risk-event', antifraud_views.RiskEventViewSet, basename='af-event')
router.register(r'fraud-rule', antifraud_views.FraudRuleViewSet, basename='af-rule')
router.register(r'user-risk-profile', antifraud_views.UserRiskProfileViewSet, basename='af-profile')

urlpatterns = [
    path('', include(router.urls)),
]
