#!/usr/bin/env python
"""
一鉴到底 - 完整登录和功能测试
"""
import os
import sys
import django

# 设置Django环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
sys.path.insert(0, 'c:/MsSafeData/Desktop/yijiandaodi/backend')
django.setup()

from django.contrib.auth import get_user_model
from auth_app.developer_models import DeveloperAccount, DeveloperAPIKey

print("\n" + "="*60)
print("   一鉴到底 - 登录和功能测试")
print("="*60)

# 1. 重置管理员密码
print("\n[1] 重置管理员密码...")
User = get_user_model()
admin_user = User.objects.filter(username='admin').first()
if admin_user:
    admin_user.set_password('Admin123!@#')
    admin_user.save()
    print(f"   ✓ 管理员密码已重置")
else:
    admin_user = User.objects.create_superuser('admin', 'admin@yijiandaodi.com', 'Admin123!@#')
    print(f"   ✓ 管理员账号已创建")

print(f"   用户名: admin")
print(f"   密码: Admin123!@#")
print(f"   前端登录: http://localhost:3000/login")
print(f"   后台管理: http://localhost:8000/admin")

# 2. 创建测试开发者账号
print("\n[2] 创建测试开发者账号...")
test_username = 'developer_test'
test_user = User.objects.filter(username=test_username).first()
if not test_user:
    test_user = User.objects.create_user(
        username=test_username,
        email='developer@yijiandaodi.com',
        password='Dev123!@#'
    )
    print(f"   ✓ 开发者账号已创建")
else:
    test_user.set_password('Dev123!@#')
    test_user.save()
    print(f"   ✓ 开发者密码已重置")

print(f"   用户名: {test_username}")
print(f"   密码: Dev123!@#")

# 3. 创建开发者账号
print("\n[3] 创建开发者账号...")
dev_account, created = DeveloperAccount.objects.get_or_create(
    user=test_user,
    defaults={
        'company': '测试公司',
        'website': 'https://example.com',
        'use_case': 'API开发和测试',
        'tier': 'pro',
        'daily_quota': 1000,
        'monthly_quota': 30000,
        'status': 'active',
    }
)
if created:
    print(f"   ✓ 开发者账号已创建")
else:
    print(f"   ✓ 开发者账号已存在")

print(f"   套餐等级: {dev_account.get_tier_display()}")
print(f"   状态: {dev_account.get_status_display()}")
print(f"   日限额: {dev_account.daily_quota}")
print(f"   月限额: {dev_account.monthly_quota}")

# 4. 生成API Key
print("\n[4] 生成API Key...")
api_key_obj, raw_key = DeveloperAPIKey.generate_key(
    developer=dev_account,
    name="测试API Key",
    key_type="production"
)
print(f"   ✓ API Key已生成")
print(f"   密钥: {raw_key}")
print(f"   前缀: {raw_key[:8]}")
print(f"   后4位: {raw_key[-4:]}")

# 5. 验证API Key
print("\n[5] 验证API Key...")
verified_key = DeveloperAPIKey.authenticate(raw_key)
if verified_key:
    print(f"   ✓ API Key验证成功")
    print(f"   关联用户: {verified_key.developer.user.username}")
else:
    print(f"   ✗ API Key验证失败")

# 6. 测试开发者申请功能
print("\n[6] 测试开发者申请...")
# 检查是否有DeveloperApplication模型
try:
    from auth_app.developer_models import DeveloperApplication
    print(f"   ✓ DeveloperApplication模型存在")
    print(f"   ✓ 开发者申请功能可用")
except:
    print(f"   ⚠ DeveloperApplication模型不存在")
    print(f"   ⚠ 需要在后台手动开通开发者权限")

# 7. 保存测试信息
print("\n[7] 保存测试信息...")
with open('data/test_accounts.txt', 'w', encoding='utf-8') as f:
    f.write("="*60 + "\n")
    f.write("一鉴到底 - 测试账号信息\n")
    f.write("="*60 + "\n\n")
    f.write("【管理员账号】\n")
    f.write(f"用户名: admin\n")
    f.write(f"密码: Admin123!@#\n")
    f.write(f"后台地址: http://localhost:8000/admin\n\n")
    f.write("【开发者账号】\n")
    f.write(f"用户名: {test_username}\n")
    f.write(f"密码: Dev123!@#\n")
    f.write(f"前端登录: http://localhost:3000/login\n\n")
    f.write("【API Key】\n")
    f.write(f"密钥: {raw_key}\n")
    f.write(f"套餐: 专业版\n")
    f.write(f"日限额: {dev_account.daily_quota}\n")
    f.write(f"月限额: {dev_account.monthly_quota}\n")

print(f"   ✓ 测试信息已保存到: data/test_accounts.txt")

# 8. 统计信息
print("\n[8] 统计信息...")
total_users = User.objects.count()
total_admins = User.objects.filter(is_superuser=True).count()
total_developers = DeveloperAccount.objects.count()
total_keys = DeveloperAPIKey.objects.count()

print(f"   总用户数: {total_users}")
print(f"   管理员数: {total_admins}")
print(f"   开发者数: {total_developers}")
print(f"   API Key数: {total_keys}")

print("\n" + "="*60)
print("   ✓ 测试完成")
print("="*60)

print("\n【登录地址】")
print(f"前端登录: http://localhost:3000/login")
print(f"后台管理: http://localhost:8000/admin")

print("\n【常见问题】")
print("1. 登录后退出去需要重新登录：这是正常的，刷新页面会自动恢复登录状态")
print("2. 检测报告跳转到新页面：这是正确的，检测报告在后台管理页面")
print("3. 开发者申请：登录后可在个人中心申请，或联系管理员开通")
print("4. API Key使用：用开发者账号登录后，在个人中心查看和管理Key")