"""
API Key路由配置
"""

from django.urls import path
from . import apikey_views
from . import user_provider_key_views

app_name = 'apikey'

urlpatterns = [
    # 用户自有 API Key（P1 消费控制：自带 Key 免平台配额）——放在 <int:key_id> 之前避免匹配歧义
    path('user-key/', user_provider_key_views.set_user_key, name='user-key-set'),
    path('user-key/status/', user_provider_key_views.user_key_status, name='user-key-status'),
    path('user-key/delete/', user_provider_key_views.delete_user_key, name='user-key-delete'),

    # API Key管理
    path('generate/', apikey_views.generate_api_key, name='generate'),
    path('list/', apikey_views.list_api_keys, name='list'),
    path('<int:key_id>/', apikey_views.get_api_key, name='detail'),
    path('<int:key_id>/delete/', apikey_views.delete_api_key, name='delete'),
    path('<int:key_id>/update/', apikey_views.update_api_key, name='update'),
    path('<int:key_id>/regenerate/', apikey_views.regenerate_api_key, name='regenerate'),
    path('<int:key_id>/logs/', apikey_views.get_usage_logs, name='logs'),

    # 验证API Key
    path('verify/', apikey_views.verify_api_key, name='verify'),
]