import sys
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
django.setup()

modules_to_check = [
    'auth_app.risk_control_models',
    'auth_app.risk_control_views',
    'auth_app.risk_control_serializers',
    'auth_app.risk_control_urls',
    'auth_app.security_models',
    'auth_app.security_views',
    'auth_app.security_serializers',
    'auth_app.security_urls',
    'auth_app.security_center_models',
    'auth_app.security_center_views',
    'auth_app.security_center_serializers',
    'auth_app.security_center_urls',
    'auth_app.system_manage_models',
    'auth_app.system_manage_views',
    'auth_app.system_manage_serializers',
    'auth_app.system_manage_urls',
    'auth_app.log_center_models',
    'auth_app.log_center_views',
    'auth_app.log_center_serializers',
    'auth_app.log_center_urls',
    'auth_app.stats_models',
    'auth_app.stats_views',
    'auth_app.stats_serializers',
    'auth_app.stats_urls',
]

for module in modules_to_check:
    try:
        __import__(module)
        print(f'OK: {module}')
    except Exception as e:
        print(f'FAIL: {module}: {type(e).__name__}: {str(e)[:150]}')
