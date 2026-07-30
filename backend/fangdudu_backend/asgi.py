import os

from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.urls import re_path
from p2p_app.consumers.p2p_events import P2PEventConsumer

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')

application = ProtocolTypeRouter({
    'http': get_asgi_application(),
    'websocket': AllowedHostsOriginValidator(
        URLRouter([
            re_path(r'ws/p2p/v1/(?P<node_id>[^/]+)/events$', P2PEventConsumer.as_asgi()),
        ])
    ),
})
