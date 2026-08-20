from django.urls import path, include
from django.views.decorators.csrf import csrf_exempt
from rest_framework.routers import DefaultRouter
from .agent_views import AgentConfigViewSet, AgentPublicViewSet, AgentVerificationViewSet, GrokToolsViewSet, GrokMemoryViewSet, GrokMemorySearchView

router = DefaultRouter()
router.register(r'configs', AgentConfigViewSet, basename='agent-config')

urlpatterns = [
    path('', include(router.urls)),
    path('public/<action_name>/', csrf_exempt(AgentPublicViewSet.as_view()), name='agent-public'),
    path('public/sessions/<str:session_id>/messages/', csrf_exempt(AgentPublicViewSet.as_view()), name='agent-session-messages'),
    path('verification/', AgentVerificationViewSet.as_view(), name='agent-verification'),
    # Grok Tools API
    path('tools/', GrokToolsViewSet.as_view(), name='grok-tools'),
    # Grok Memory API
    path('memory/', GrokMemoryViewSet.as_view(), name='grok-memory'),
    path('memory/search/', GrokMemorySearchView.as_view(), name='grok-memory-search'),
]
