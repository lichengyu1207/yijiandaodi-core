from django.urls import path
from .platform_capabilities import PlatformCapabilitiesView, OpenRathInfoView

app_name = 'platform'

urlpatterns = [
    path('', PlatformCapabilitiesView.as_view(), name='capability-list'),
    path('<str:capability_id>/', PlatformCapabilitiesView.as_view(), name='capability-detail'),
    path('call-agent/', PlatformCapabilitiesView.as_view(), name='call-agent'),
    path('detect/', PlatformCapabilitiesView.as_view(), name='detect'),
    path('compress/', PlatformCapabilitiesView.as_view(), name='compress'),
    path('openrath-info/', OpenRathInfoView.as_view(), name='openrath-info'),
]
