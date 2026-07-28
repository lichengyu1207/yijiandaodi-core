from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .system_views import (
    PrivacyAgreementViewSet,
    IMMessageViewSet,
    IMAutoReplyViewSet,
    VoiceAssistantViewSet,
)

router = DefaultRouter()
router.register(r'privacy', PrivacyAgreementViewSet, basename='privacy')
router.register(r'im-messages', IMMessageViewSet, basename='im-message')
router.register(r'auto-replies', IMAutoReplyViewSet, basename='auto-reply')
router.register(r'voice', VoiceAssistantViewSet, basename='voice-assistant')

urlpatterns = [
    path('', include(router.urls)),
]
