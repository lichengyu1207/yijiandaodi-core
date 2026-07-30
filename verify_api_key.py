#!/usr/bin/env python
"""
验证API Key系统
"""
import requests
import json

BASE_URL = "http://localhost:8000"

def test_api_key_system():
    print("\n" + "="*60)
    print("   验证API Key系统")
    print("="*60)

    # 1. 注册测试用户
    print("\n[1] 注册测试用户...")
    register_data = {
        "username": f"testuser_api_{int(__import__('time').time())}",
        "password": "TestPass123!",
        "confirm_password": "TestPass123!",
        "email": f"test_{int(__import__('time').time())}@example.com",
        "privacy_agreed": True
    }

    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/register/",
            json=register_data,
            timeout=5
        )
        print(f"   注册响应: {response.status_code}")
        if response.status_code in [200, 201]:
            print("   ✓ 用户注册成功")
        else:
            print(f"   注册响应: {response.text[:200]}")
    except Exception as e:
        print(f"   注册错误: {e}")

    # 2. 登录获取Token
    print("\n[2] 登录获取Token...")
    login_data = {
        "username": register_data["username"],
        "password": register_data["password"]
    }

    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/login/",
            json=login_data,
            timeout=5
        )
        print(f"   登录响应: {response.status_code}")

        if response.status_code == 200:
            token_data = response.json()
            access_token = token_data.get("access") or token_data.get("access_token") or token_data.get("token")
            if access_token:
                print(f"   ✓ 获取Token成功: {access_token[:20]}...")
            else:
                print(f"   Token响应: {token_data}")
                print(f"   警告: 未找到Token字段")
                return
        else:
            print(f"   登录失败: {response.text[:200]}")
            return
    except Exception as e:
        print(f"   登录错误: {e}")
        return

    # 3. 创建开发者账号
    print("\n[3] 创建开发者账号...")
    headers = {"Authorization": f"Bearer {access_token}"}

    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/developer/account/",
            json={
                "company": "测试公司",
                "website": "https://example.com",
                "use_case": "API Key测试"
            },
            headers=headers,
            timeout=5
        )
        print(f"   创建账号响应: {response.status_code}")
        if response.status_code in [200, 201]:
            print("   ✓ 开发者账号创建成功")
        else:
            print(f"   创建账号响应: {response.text[:200]}")
    except Exception as e:
        print(f"   创建账号错误: {e}")

    # 4. 生成API Key
    print("\n[4] 生成API Key...")
    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/developer/account/create_key/",
            json={
                "name": "测试API Key",
                "key_type": "production"
            },
            headers=headers,
            timeout=5
        )
        print(f"   生成Key响应: {response.status_code}")

        if response.status_code == 200:
            key_data = response.json()
            raw_key = key_data.get("raw_key") or key_data.get("data", {}).get("raw_key")
            print(f"   ✓ API Key生成成功")
            print(f"   密钥前缀: {raw_key[:8]}")
            print(f"   密钥后4位: {raw_key[-4:]}")
            print(f"   密钥格式: yjdp_ + 32位字符")
            print(f"   密钥长度: {len(raw_key)} 位")
        else:
            print(f"   生成Key失败: {response.text[:200]}")
            # 尝试直接生成
            print("\n   尝试直接生成API Key...")
            from backend.auth_app.developer_models import DeveloperAccount, DeveloperAPIKey
            from django.contrib.auth import get_user_model
            import os
            import django

            os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
            django.setup()

            User = get_user_model()
            try:
                user = User.objects.get(username=register_data["username"])
                account, _ = DeveloperAccount.objects.get_or_create(user=user)
                api_key_obj, raw_key = DeveloperAPIKey.generate_key(
                    developer=account,
                    name="测试API Key",
                    key_type="production"
                )
                print(f"   ✓ 直接生成API Key成功")
                print(f"   密钥: {raw_key}")
                print(f"   密钥格式: yjdp_ + 32位字符")
                print(f"   密钥长度: {len(raw_key)} 位")

                # 保存到文件供后续使用
                with open('data/test_api_key.txt', 'w') as f:
                    f.write(raw_key)
                print(f"   ✓ 密钥已保存到: data/test_api_key.txt")
            except Exception as e:
                print(f"   直接生成错误: {e}")
            return
    except Exception as e:
        print(f"   生成Key错误: {e}")

    # 5. 使用API Key调用API
    print("\n[5] 使用API Key调用API...")
    api_key_headers = {"X-API-Key": raw_key}

    try:
        # 测试调用技能API
        response = requests.get(
            f"{BASE_URL}/api/auth/developer/skills/",
            headers=api_key_headers,
            timeout=5
        )
        print(f"   调用API响应: {response.status_code}")
        if response.status_code == 200:
            skills = response.json()
            print(f"   ✓ API Key验证成功")
            print(f"   可用技能数量: {len(skills.get('data', skills))}")
        else:
            print(f"   API调用失败: {response.text[:200]}")
    except Exception as e:
        print(f"   API调用错误: {e}")

    print("\n" + "="*60)
    print("   API Key系统验证完成")
    print("="*60)


if __name__ == "__main__":
    test_api_key_system()