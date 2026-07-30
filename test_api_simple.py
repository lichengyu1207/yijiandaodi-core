#!/usr/bin/env python
"""
简化版API Key创建测试
"""
import requests
import json

BASE_URL = "http://localhost:8000"

# 登录
print("登录...")
response = requests.post(
    f"{BASE_URL}/api/auth/login/",
    json={"username": "developer_test", "password": "Dev123!@#"},
    timeout=5
)
print(f"状态码: {response.status_code}")

if response.status_code != 200:
    print(f"登录失败: {response.text[:200]}")
    exit(1)

token_data = response.json()
token = token_data.get("access") or token_data.get("token") or token_data.get("data", {}).get("token")
print(f"Token: {token[:20] if token else 'None'}...")

# 创建API Key
print("\n创建API Key...")
headers = {"Authorization": f"Bearer {token}"}
response = requests.post(
    f"{BASE_URL}/api/auth/developer/create_key/",
    json={"name": "测试密钥"},
    headers=headers,
    timeout=5
)
print(f"状态码: {response.status_code}")

if response.status_code == 200:
    data = response.json()
    print(f"响应: {json.dumps(data, ensure_ascii=False, indent=2)}")
else:
    print(f"失败: {response.text[:500]}")