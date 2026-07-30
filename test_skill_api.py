#!/usr/bin/env python
"""测试 Skill API"""

import requests
import json

BASE_URL = "http://localhost:9092"

print("=" * 60)
print("  Skill API 测试")
print("=" * 60)

# 1. 列出所有 Skill
print("\n1. 获取所有 Skill:")
resp = requests.get(f"{BASE_URL}/api/v1/skills")
data = resp.json()
print(f"   状态: {resp.status_code}")
print(f"   Skill 数量: {data.get('count', 0)}")
for skill in data.get('skills', [])[:5]:
    print(f"   - {skill['id']}: {skill['name']}")

# 2. 获取单个 Skill 详情
print("\n2. 获取 Skill 详情 (ass-gateway):")
resp = requests.get(f"{BASE_URL}/api/v1/skills/ass-gateway")
data = resp.json()
print(f"   状态: {resp.status_code}")
print(f"   信息: {json.dumps(data, indent=2, ensure_ascii=False)}")

# 3. 调用 Skill (通用接口)
print("\n3. 调用 Skill (ass-gateway.inspect):")
resp = requests.post(
    f"{BASE_URL}/api/v1/skills/call",
    json={
        "skill_id": "ass-gateway",
        "action": "inspect",
        "params": {"input": "<script>alert(1)</script>"}
    }
)
data = resp.json()
print(f"   状态: {resp.status_code}")
print(f"   结果: {json.dumps(data, indent=2, ensure_ascii=False)}")

# 4. 动态调用 Skill
print("\n4. 动态调用 Skill (data-masker.mask):")
resp = requests.post(
    f"{BASE_URL}/api/v1/skills/data-masker/mask",
    json={"data": "13812345678", "type": "phone"}
)
data = resp.json()
print(f"   状态: {resp.status_code}")
print(f"   结果: {json.dumps(data, indent=2, ensure_ascii=False)}")

# 5. 调用代码检测
print("\n5. 调用代码检测 (code-detector.analyze):")
resp = requests.post(
    f"{BASE_URL}/api/v1/skills/call",
    json={
        "skill_id": "code-detector",
        "action": "analyze",
        "params": {"code": "eval(input())\nos.system('rm -rf /')"}
    }
)
data = resp.json()
print(f"   状态: {resp.status_code}")
print(f"   结果: {json.dumps(data, indent=2, ensure_ascii=False)}")

print("\n" + "=" * 60)
print("  测试完成")
print("=" * 60)