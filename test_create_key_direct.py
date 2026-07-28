#!/usr/bin/env python
"""
直接使用Django ORM创建API Key（绕过HTTP）
"""
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
sys.path.insert(0, 'c:/MsSafeData/Desktop/yijiandaodi/backend')
django.setup()

from django.contrib.auth import get_user_model
from auth_app.developer_models import DeveloperAccount, DeveloperAPIKey

User = get_user_model()

# 获取测试用户
user = User.objects.get(username='developer_test')
print(f"用户: {user.username}")

# 获取或创建开发者账号
account, created = DeveloperAccount.objects.get_or_create(
    user=user,
    defaults={'tier': 'pro', 'status': 'active'}
)
print(f"开发者账号: {account.id}, 套餐: {account.get_tier_display()}")

# 创建API Key
try:
    api_key_obj, raw_key = DeveloperAPIKey.generate_key(
        developer=account,
        name="测试密钥",
        key_type="production"
    )
    print(f"\n✓ API Key创建成功!")
    print(f"密钥: {raw_key}")
    print(f"前缀: {raw_key[:8]}")
    print(f"后4位: {raw_key[-4:]}")
except Exception as e:
    print(f"\n✗ API Key创建失败!")
    print(f"错误: {e}")
    import traceback
    traceback.print_exc()