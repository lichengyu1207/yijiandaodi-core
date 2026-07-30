"""
双因子认证路由
"""

from django.urls import path
from . import two_factor_views

app_name = 'two_factor'

urlpatterns = [
    # 状态查询
    path('status/', two_factor_views.two_factor_status, name='status'),

    # 设置和启用
    path('setup/', two_factor_views.two_factor_setup, name='setup'),
    path('enable/', two_factor_views.two_factor_enable, name='enable'),

    # 验证
    path('verify/', two_factor_views.two_factor_verify, name='verify'),

    # 禁用
    path('disable/', two_factor_views.two_factor_disable, name='disable'),

    # 备用码
    path('regenerate-backup-codes/', two_factor_views.two_factor_regenerate_backup_codes, name='regenerate-backup-codes'),
]