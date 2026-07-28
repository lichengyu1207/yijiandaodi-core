"""
浏览器插件数据同步 API 路由
"""

from django.urls import path
from rest_framework.routers import DefaultRouter
from .extension_sync_views import ExtensionSyncViewSet, ExtensionSessionViewSet

app_name = 'extension_sync'

# 使用 DRF Router
router = DefaultRouter()
router.register(r'sessions', ExtensionSessionViewSet, basename='extension-session')

urlpatterns = [
    # 同步接口
    path('sync/start/', ExtensionSyncViewSet.as_view({'post': 'start'}), name='sync-start'),
    path('sync/operation/', ExtensionSyncViewSet.as_view({'post': 'operation'}), name='sync-operation'),
    path('sync/end/', ExtensionSyncViewSet.as_view({'post': 'end'}), name='sync-end'),
    path('sync/full/', ExtensionSyncViewSet.as_view({'post': 'full'}), name='sync-full'),
]

# 添加 Router 路由
urlpatterns += router.urls