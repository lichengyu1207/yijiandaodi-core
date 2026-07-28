#!/usr/bin/env python
"""
重置管理员密码并解决登录持久化问题
"""
import os
import sys
import django

# 设置Django环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
sys.path.insert(0, 'c:/MsSafeData/Desktop/yijiandaodi/backend')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()

# 重置管理员密码
admin_user = User.objects.filter(username='admin').first()
if admin_user:
    admin_user.set_password('Admin123!@#')
    admin_user.save()
    print(f"✓ 管理员密码已重置")
    print(f"  用户名: admin")
    print(f"  密码: Admin123!@#")
    print(f"  后台地址: http://localhost:8000/admin")
else:
    # 创建管理员
    User.objects.create_superuser('admin', 'admin@yijiandaodi.com', 'Admin123!@#')
    print(f"✓ 管理员账号已创建")
    print(f"  用户名: admin")
    print(f"  密码: Admin123!@#")

print(f"\n其他管理员账号：")
for user in User.objects.filter(is_superuser=True).exclude(username='admin'):
    user.set_password('Admin123!@#')
    user.save()
    print(f"  用户名: {user.username}")

print(f"\n✓ 密码重置完成")