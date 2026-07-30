#!/usr/bin/env python
"""测试沙箱 API 完整流程"""

import requests
import json

API_URL = "http://localhost:9092"

print("\n" + "="*60)
print("  一鉴到底 - 沙箱 API 完整流程测试")
print("="*60 + "\n")

# 1. 健康检查
print("【1】健康检查...")
response = requests.get(f"{API_URL}/health")
print(f"状态: {response.json()}")

# 2. 启动沙箱会话
print("\n【2】启动沙箱会话...")
response = requests.post(f"{API_URL}/api/v1/sandbox/start", json={
    "environment_id": "test-env",
    "repository": "test/repo"
})
result = response.json()
print(f"会话 ID: {result.get('session_id')}")
print(f"沙箱 ID: {result.get('sandbox_id')}")

# 3. 执行低风险操作
print("\n【3】执行低风险操作...")
response = requests.post(f"{API_URL}/api/v1/sandbox/execute", json={
    "agent": "Cursor AI",
    "operation_type": "execute",
    "operation": "npm install lodash",
    "context": "安装依赖包"
})
result = response.json()
print(f"操作: npm install lodash")
print(f"风险: {result.get('risk_level')}")
print(f"决策: {result.get('decision')}")

# 4. 执行高风险操作
print("\n【4】执行高风险操作...")
response = requests.post(f"{API_URL}/api/v1/sandbox/execute", json={
    "agent": "Cursor AI",
    "operation_type": "execute",
    "operation": "rm -rf node_modules",
    "context": "清理依赖"
})
result = response.json()
print(f"操作: rm -rf node_modules")
print(f"风险: {result.get('risk_level')}")
print(f"决策: {result.get('decision')}")
print(f"需确认: {result.get('needs_confirmation')}")

# 5. 执行 Git 推送（高风险）
print("\n【5】执行 Git 推送...")
response = requests.post(f"{API_URL}/api/v1/sandbox/execute", json={
    "agent": "Cursor AI",
    "operation_type": "git",
    "operation": "git push origin main",
    "target": "production",
    "context": "推送到生产环境，包含数据库密码配置"
})
result = response.json()
print(f"操作: git push origin main")
print(f"风险: {result.get('risk_level')}")
print(f"决策: {result.get('decision')}")
print(f"需确认: {result.get('needs_confirmation')}")

# 6. 获取待确认操作
print("\n【6】获取待确认操作...")
response = requests.get(f"{API_URL}/api/v1/sandbox/pending")
result = response.json()
print(f"待确认数量: {result.get('count')}")
for op in result.get('pending', []):
    print(f"  - {op['operation']} ({op['risk_level']})")

# 7. 用户响应
if result.get('count', 0) > 0:
    print("\n【7】用户响应（确认放行）...")
    op_id = result['pending'][0]['id']
    response = requests.post(f"{API_URL}/api/v1/sandbox/respond", json={
        "operation_id": op_id,
        "approved": True,
        "response": "用户确认放行"
    })
    result = response.json()
    print(f"操作 ID: {result.get('operation_id')}")
    print(f"已批准: {result.get('approved')}")

# 8. 获取日志
print("\n【8】获取操作日志...")
response = requests.get(f"{API_URL}/api/v1/sandbox/logs?limit=10")
result = response.json()
print(f"日志数量: {result.get('count')}")
for log in result.get('logs', [])[:3]:
    print(f"  - {log['operation_content']} ({log['risk_level']}) - {log['decision']}")

# 9. 获取统计
print("\n【9】获取统计信息...")
response = requests.get(f"{API_URL}/api/v1/sandbox/stats")
result = response.json()
print(f"统计: {json.dumps(result.get('stats'), indent=2)}")

print("\n" + "="*60)
print("  测试完成")
print("="*60)