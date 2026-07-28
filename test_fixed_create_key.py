#!/usr/bin/env python
"""
测试修复后的create_key接口
"""
import requests
import json

BASE_URL = "http://localhost:8000"

print("\n" + "="*60)
print("   测试修复后的create_key接口")
print("="*60)

# 1. 登录
print("\n[1] 登录...")
response = requests.post(
    f"{BASE_URL}/api/auth/login/",
    json={"username": "developer_test", "password": "Dev123!@#"},
    timeout=5
)

if response.status_code != 200:
    print(f"   ✗ 登录失败: {response.status_code}")
    print(f"   {response.text[:200]}")
    exit(1)

token_data = response.json()
token = token_data.get("access") or token_data.get("token") or token_data.get("data", {}).get("token")
print(f"   ✓ 登录成功")

# 2. 创建API Key（不带key_type）
print("\n[2] 创建API Key（不带key_type）...")
headers = {"Authorization": f"Bearer {token}"}
response = requests.post(
    f"{BASE_URL}/api/auth/developer/create_key/",
    json={"name": "测试密钥"},
    headers=headers,
    timeout=5
)

print(f"   状态码: {response.status_code}")
if response.status_code == 201:
    data = response.json()
    print(f"   ✓ API Key创建成功")
    print(f"   密钥: {data['data']['raw_key']}")
else:
    print(f"   响应: {response.text[:500]}")

# 3. 创建API Key（带key_type）
print("\n[3] 创建API Key（带key_type）...")
response = requests.post(
    f"{BASE_URL}/api/auth/developer/create_key/",
    json={"name": "正式密钥", "key_type": "production"},
    headers=headers,
    timeout=5
)

print(f"   状态码: {response.status_code}")
if response.status_code == 201:
    data = response.json()
    print(f"   ✓ API Key创建成功")
    print(f"   密钥: {data['data']['raw_key']}")
    print(f"   类型: {data['data']['key_type']}")
else:
    print(f"   响应: {response.text[:500]}")

print("\n" + "="*60)
print("   测试完成")
print("="*60)