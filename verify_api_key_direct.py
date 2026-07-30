#!/usr/bin/env python
"""
直接通过Django ORM验证API Key系统
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
import time

def test_api_key_direct():
    print("\n" + "="*60)
    print("   验证API Key系统 (Django ORM)")
    print("="*60)

    User = get_user_model()

    # 1. 创建测试用户
    print("\n[1] 创建测试用户...")
    username = f"testuser_direct_{int(time.time())}"

    try:
        user = User.objects.create_user(
            username=username,
            email=f"{username}@example.com",
            password="TestPass123!"
        )
        print(f"   ✓ 用户创建成功: {username}")
    except Exception as e:
        print(f"   用户创建失败: {e}")
        # 尝试获取已存在的用户
        try:
            user = User.objects.get(username=username)
            print(f"   ✓ 使用已存在用户: {username}")
        except:
            print(f"   ✗ 无法创建或获取用户")
            return

    # 2. 创建开发者账号
    print("\n[2] 创建开发者账号...")
    try:
        account, created = DeveloperAccount.objects.get_or_create(
            user=user,
            defaults={
                'company': '测试公司',
                'website': 'https://example.com',
                'use_case': 'API Key测试验证',
                'tier': 'pro',
                'daily_quota': 1000,
                'monthly_quota': 30000,
            }
        )
        if created:
            print(f"   ✓ 开发者账号创建成功")
        else:
            print(f"   ✓ 开发者账号已存在")
        print(f"   套餐等级: {account.get_tier_display()}")
        print(f"   日限额: {account.daily_quota}")
        print(f"   月限额: {account.monthly_quota}")
    except Exception as e:
        print(f"   开发者账号创建失败: {e}")
        return

    # 3. 生成API Key
    print("\n[3] 生成API Key...")
    try:
        api_key_obj, raw_key = DeveloperAPIKey.generate_key(
            developer=account,
            name="测试验证Key",
            key_type="production"
        )
        print(f"   ✓ API Key生成成功")
        print(f"   密钥前缀: {raw_key[:8]}")
        print(f"   密钥后4位: {raw_key[-4:]}")
        print(f"   密钥格式: yjdp_ + 32位随机字符")
        print(f"   密钥长度: {len(raw_key)} 位")
        print(f"   密钥类型: {api_key_obj.get_key_type_display()}")
        print(f"   存储哈希: {api_key_obj.key_hash[:20]}...")

        # 保存到文件
        with open('data/test_api_key.txt', 'w') as f:
            f.write(f"API Key: {raw_key}\n")
            f.write(f"Key ID: {api_key_obj.id}\n")
            f.write(f"User: {username}\n")
        print(f"   ✓ 密钥已保存到: data/test_api_key.txt")

    except Exception as e:
        print(f"   API Key生成失败: {e}")
        import traceback
        traceback.print_exc()
        return

    # 4. 验证API Key
    print("\n[4] 验证API Key...")
    try:
        verified_key = DeveloperAPIKey.authenticate(raw_key)
        if verified_key:
            print(f"   ✓ API Key验证成功")
            print(f"   关联用户: {verified_key.developer.user.username}")
            print(f"   密钥名称: {verified_key.name}")
            print(f"   密钥状态: {'启用' if verified_key.is_active else '禁用'}")
        else:
            print(f"   ✗ API Key验证失败")
    except Exception as e:
        print(f"   验证错误: {e}")
        import traceback
        traceback.print_exc()

    # 5. 测试错误的API Key
    print("\n[5] 测试错误密钥...")
    wrong_key = "yjdp_wrongkey1234567890123456789012"
    try:
        verified_key = DeveloperAPIKey.authenticate(wrong_key)
        if verified_key:
            print(f"   ✗ 错误密钥验证成功（不应该）")
        else:
            print(f"   ✓ 错误密钥验证失败（正确）")
    except Exception as e:
        print(f"   测试错误: {e}")

    # 6. 统计信息
    print("\n[6] 统计信息...")
    total_users = User.objects.count()
    total_developers = DeveloperAccount.objects.count()
    total_keys = DeveloperAPIKey.objects.count()

    print(f"   总用户数: {total_users}")
    print(f"   开发者账号数: {total_developers}")
    print(f"   API Key数量: {total_keys}")

    print("\n" + "="*60)
    print("   ✓ API Key系统验证完成")
    print("="*60)


if __name__ == "__main__":
    test_api_key_direct()