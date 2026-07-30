#!/usr/bin/env python
"""
测试 API 是否正常返回数据
"""

import requests
import json

# 测试 API
print("\n" + "="*60)
print("   测试沙箱 API")
print("="*60)

# 1. 测试健康检查
print("\n[1] 健康检查...")
try:
    resp = requests.get('http://localhost:9092/health', timeout=5)
    print(f"   状态: {resp.status_code}")
    print(f"   响应: {resp.text}")
except Exception as e:
    print(f"   错误: {e}")

# 2. 测试获取日志
print("\n[2] 获取日志...")
try:
    resp = requests.get('http://localhost:9092/api/v1/sandbox/logs?limit=10', timeout=5)
    print(f"   状态: {resp.status_code}")
    data = resp.json()
    print(f"   日志数量: {data.get('count', 0)}")
    
    if data.get('logs'):
        print("\n   日志列表:")
        for log in data['logs'][:5]:
            print(f"   - [{log.get('risk_level')}] {log.get('agent_name')}: {log.get('operation_content', '')[:40]}")
    else:
        print("   无日志数据")
except Exception as e:
    print(f"   错误: {e}")

# 3. 测试统计信息
print("\n[3] 获取统计...")
try:
    resp = requests.get('http://localhost:9092/api/v1/sandbox/stats', timeout=5)
    print(f"   状态: {resp.status_code}")
    data = resp.json()
    if data.get('success'):
        stats = data.get('stats', {})
        print(f"   总数: {stats.get('total', 0)}")
        print(f"   按风险等级: {stats.get('by_risk_level', {})}")
        print(f"   按决策: {stats.get('by_decision', {})}")
except Exception as e:
    print(f"   错误: {e}")

print("\n" + "="*60)
print("   测试完成")
print("="*60)