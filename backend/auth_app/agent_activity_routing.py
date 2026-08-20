"""
Agent活动告警WebSocket路由配置
"""

from django.urls import re_path
from .agent_activity_consumers import AgentAlertConsumer

websocket_urlpatterns = [
    # WebSocket连接端点：ws://localhost:9092/ws/agent-alerts/{client_id}/
    re_path(
        r'^ws/agent-alerts/(?P<client_id>[a-zA-Z0-9_-]+)/$',
        AgentAlertConsumer.as_asgi()
    ),
]