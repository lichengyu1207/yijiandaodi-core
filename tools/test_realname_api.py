"""
测试实名认证API
"""

import requests
import json

BASE_URL = "http://localhost:8000"

def test_realname_api():
    print("\n" + "="*60)
    print("🧪 测试实名认证API")
    print("="*60)
    
    # 1. 注册用户
    print("\n步骤1: 注册用户...")
    response = requests.post(
        f"{BASE_URL}/api/auth/register/",
        json={
            "username": "test_realname_user",
            "email": "realname@test.com",
            "password": "Test@123",
            "confirm_password": "Test@123",
            "privacy_agreed": True
        }
    )
    print(f"注册响应: {response.status_code}")
    
    # 2. 登录获取Token
    print("\n步骤2: 登录...")
    response = requests.post(
        f"{BASE_URL}/api/auth/login/",
        json={
            "username": "test_realname_user",
            "password": "Test@123"
        }
    )
    print(f"登录响应: {response.status_code}")
    
    if response.status_code != 200:
        print("❌ 登录失败")
        return
    
    token = response.json().get('access') or response.json().get('token')
    print(f"Token: {token[:20] if token else 'N/A'}...")
    
    # 3. 查询认证状态（未认证）
    print("\n步骤3: 查询认证状态...")
    response = requests.get(
        f"{BASE_URL}/api/auth/verify-status/",
        headers={"Authorization": f"Bearer {token}"}
    )
    print(f"状态查询响应: {response.status_code}")
    print(f"状态: {response.json()}")
    
    # 4. 实名认证
    print("\n步骤4: 提交实名认证...")
    response = requests.post(
        f"{BASE_URL}/api/auth/verify-realname/",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "name": "测试用户",
            "id_card": "110101199001011234"
        }
    )
    print(f"认证响应: {response.status_code}")
    print(f"认证结果: {response.json()}")
    
    # 5. 查询认证状态（已认证）
    print("\n步骤5: 查询认证状态...")
    response = requests.get(
        f"{BASE_URL}/api/auth/verify-status/",
        headers={"Authorization": f"Bearer {token}"}
    )
    print(f"状态查询响应: {response.status_code}")
    print(f"状态: {response.json()}")
    
    print("\n" + "="*60)
    print("✅ 实名认证API测试完成")
    print("="*60)

if __name__ == "__main__":
    test_realname_api()