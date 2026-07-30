#!/usr/bin/env python
"""
测试 API Key 完整流程：
1. 生成 API Key
2. 使用 API Key 调用 Skill
"""

import requests
import json
import time

BASE_URL = "http://localhost:9092"

print("=" * 60)
print("  API Key 流程测试")
print("=" * 60)

# ==================== 步骤 1: 生成 API Key ====================
print("\n【步骤 1】生成 API Key...")

resp = requests.post(
    f"{BASE_URL}/api/v1/keys/generate",
    json={
        "scopes": ["skills:*", "sandbox:*"],
        "expires_days": 30,
        "rate_limit": 1000
    }
)

print(f"   状态: {resp.status_code}")

if resp.status_code != 200:
    print(f"   错误: {resp.text}")
    exit(1)

key_data = resp.json()
api_key = key_data.get('api_key')

print(f"   ✓ Key ID: {key_data.get('key_id')}")
print(f"   ✓ API Key: {api_key}")
print(f"   ✓ 有效期: {key_data.get('expires_at')}")
print(f"   ✓ 权限: {key_data.get('scopes')}")
print(f"   ✓ 限流: {key_data.get('rate_limit')} 次/天")

# ==================== 步骤 2: 使用 API Key 调用 Skill ====================
print("\n【步骤 2】使用 API Key 调用 Skill...")

headers = {
    "Content-Type": "application/json",
    "X-API-Key": api_key
}

# 测试 1: 安全检测
print("\n   测试 1: ass-gateway.inspect")
resp = requests.post(
    f"{BASE_URL}/api/v1/skills/call",
    headers=headers,
    json={
        "skill_id": "ass-gateway",
        "action": "inspect",
        "params": {"input": "<script>alert('xss')</script>"}
    }
)
print(f"   状态: {resp.status_code}")
result = resp.json()
print(f"   结果: {json.dumps(result, indent=2, ensure_ascii=False)}")

# 测试 2: 数据脱敏
print("\n   测试 2: data-masker.mask")
resp = requests.post(
    f"{BASE_URL}/api/v1/skills/data-masker/mask",
    headers=headers,
    json={"data": "13812345678", "type": "phone"}
)
print(f"   状态: {resp.status_code}")
result = resp.json()
print(f"   结果: {json.dumps(result, indent=2, ensure_ascii=False)}")

# 测试 3: 代码检测
print("\n   测试 3: code-detector.analyze")
resp = requests.post(
    f"{BASE_URL}/api/v1/skills/call",
    headers=headers,
    json={
        "skill_id": "code-detector",
        "action": "analyze",
        "params": {"code": "import os\nos.system('rm -rf /')\neval(input())"}
    }
)
print(f"   状态: {resp.status_code}")
result = resp.json()
print(f"   结果: {json.dumps(result, indent=2, ensure_ascii=False)}")

# 测试 4: 签名验签
print("\n   测试 4: output-verifier.sign")
resp = requests.post(
    f"{BASE_URL}/api/v1/skills/call",
    headers=headers,
    json={
        "skill_id": "output-verifier",
        "action": "sign",
        "params": {"data": "重要操作记录", "key": "my-secret-key"}
    }
)
print(f"   状态: {resp.status_code}")
result = resp.json()
print(f"   结果: {json.dumps(result, indent=2, ensure_ascii=False)}")

# ==================== 步骤 3: 查看所有 Key ====================
print("\n【步骤 3】查看所有 API Key...")

resp = requests.get(f"{BASE_URL}/api/v1/keys/list")
print(f"   状态: {resp.status_code}")
keys_data = resp.json()
print(f"   Key 总数: {keys_data.get('count', 0)}")

for key_info in keys_data.get('keys', []):
    print(f"   - {key_info.get('key_id')}: {key_info.get('prefix')}...")

# ==================== 步骤 4: 查看调用统计 ====================
print("\n【步骤 4】Skill API 调用统计...")

resp = requests.get(f"{BASE_URL}/api/v1/skills")
print(f"   可用 Skill: {resp.json().get('count', 0)} 个")

print("\n" + "=" * 60)
print("  ✓ 测试完成")
print("=" * 60)