#!/usr/bin/env python
"""
测试API Key创建功能
"""
import requests
import json

BASE_URL = "http://localhost:8000"

def test_create_api_key():
    print("\n" + "="*60)
    print("   测试API Key创建功能")
    print("="*60)

    # 1. 登录
    print("\n[1] 登录...")
    login_data = {
        "username": "developer_test",
        "password": "Dev123!@#"
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
            access_token = token_data.get("access") or token_data.get("token") or token_data.get("data", {}).get("token")

            if not access_token:
                print(f"   Token数据: {token_data}")
                print(f"   ✗ 未找到Token")
                return

            print(f"   ✓ 登录成功")
            print(f"   Token: {access_token[:20]}...")
        else:
            print(f"   ✗ 登录失败: {response.text}")
            return
    except Exception as e:
        print(f"   ✗ 登录错误: {e}")
        return

    # 2. 创建API Key
    print("\n[2] 创建API Key...")
    headers = {"Authorization": f"Bearer {access_token}"}

    try:
        response = requests.post(
            f"{BASE_URL}/api/auth/developer/create_key/",
            json={"name": "测试密钥"},
            headers=headers,
            timeout=5
        )
        print(f"   创建响应: {response.status_code}")

        if response.status_code == 200:
            data = response.json()
            print(f"   ✓ API Key创建成功")
            print(f"   响应数据: {json.dumps(data, ensure_ascii=False, indent=2)}")

            if data.get("success"):
                raw_key = data.get("data", {}).get("raw_key")
                print(f"\n   密钥: {raw_key}")
                print(f"   前缀: {raw_key[:8]}")
                print(f"   后4位: {raw_key[-4:]}")
            else:
                print(f"   ✗ 创建失败: {data.get('message')}")
        else:
            print(f"   ✗ 创建失败: {response.text}")
    except Exception as e:
        print(f"   ✗ 创建错误: {e}")

    print("\n" + "="*60)


if __name__ == "__main__":
    test_create_api_key()