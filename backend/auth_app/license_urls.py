"""
授权码API路由
"""

from django.urls import path
from . import license_views

urlpatterns = [
    # 用户端
    path('activate/', license_views.activate_license, name='activate_license'),
    path('verify/', license_views.verify_license, name='verify_license'),

    # 管理员
    path('admin/list/', license_views.my_licenses, name='my_licenses'),
    path('admin/generate/', license_views.generate_license, name='generate_license'),
    path('admin/revoke/<uuid:license_id>/', license_views.revoke_license, name='revoke_license'),
    path('admin/track/<str:watermark_code>/', license_views.track_watermark, name='track_watermark'),
]