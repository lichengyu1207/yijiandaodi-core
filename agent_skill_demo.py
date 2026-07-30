#!/usr/bin/env python
"""
模拟 AI Agent 使用 Skill API

场景：代码助手 Agent 处理用户请求
- 接收用户代码
- 检测代码安全性
- 脱敏敏感信息
- 记录审计日志
"""

import requests
import json
import time
from datetime import datetime

BASE_URL = "http://localhost:9092"

class CodeAgent:
    """代码助手 Agent"""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.headers = {
            "Content-Type": "application/json",
            "X-API-Key": api_key
        }
        self.session_id = f"agent_{int(time.time())}"
        self.operations = []

    def log(self, message: str):
        """打印日志"""
        print(f"[{datetime.now().strftime('%H:%M:%S')}] {message}")

    def call_skill(self, skill_id: str, action: str, params: dict) -> dict:
        """调用 Skill"""
        self.log(f"调用 Skill: {skill_id}.{action}")

        resp = requests.post(
            f"{BASE_URL}/api/v1/skills/call",
            headers=self.headers,
            json={
                "skill_id": skill_id,
                "action": action,
                "params": params
            }
        )

        result = resp.json()
        self.operations.append({
            "skill": skill_id,
            "action": action,
            "success": result.get("success"),
            "audit_hash": result.get("audit_hash")
        })

        return result

    def analyze_code(self, code: str) -> dict:
        """分析代码安全性"""
        self.log(f"分析代码 (长度: {len(code)} 字符)")
        return self.call_skill("code-detector", "analyze", {"code": code})

    def sanitize_input(self, input_text: str) -> dict:
        """净化用户输入"""
        self.log(f"净化输入")
        return self.call_skill("ass-gateway", "sanitize", {"input": input_text})

    def inspect_input(self, input_text: str) -> dict:
        """检测输入安全性"""
        self.log(f"检测输入安全性")
        return self.call_skill("ass-gateway", "inspect", {"input": input_text})

    def mask_phone(self, phone: str) -> str:
        """脱敏手机号"""
        result = self.call_skill("data-masker", "mask", {"data": phone, "type": "phone"})
        if result.get("success"):
            return result["result"]["masked"]
        return phone

    def sign_output(self, data: str) -> str:
        """签名输出"""
        result = self.call_skill("output-verifier", "sign", {"data": data, "key": self.session_id})
        if result.get("success"):
            return result["result"]["signature"]
        return ""

    def audit_log(self, operation: str, details: dict):
        """记录审计日志"""
        return self.call_skill("hashchain-audit", "record", {
            "data": {
                "operation": operation,
                "session": self.session_id,
                "details": details,
                "timestamp": datetime.now().isoformat()
            }
        })


def simulate_agent_workflow():
    """模拟 Agent 工作流程"""

    print("=" * 70)
    print("  AI Agent Skill API 集成测试")
    print("=" * 70)

    # ==================== 步骤 1: Agent 获取 API Key ====================
    print("\n【Agent 启动】获取 API Key...")

    resp = requests.post(
        f"{BASE_URL}/api/v1/keys/generate",
        json={
            "scopes": ["skills:*"],
            "expires_days": 1,
            "rate_limit": 100
        }
    )

    api_key = resp.json().get("api_key")
    print(f"✓ 获取 API Key: {api_key[:20]}...")

    # ==================== 步骤 2: 创建 Agent ====================
    print("\n【创建 Agent】代码助手 Agent 初始化...")

    agent = CodeAgent(api_key)
    print(f"✓ Agent Session: {agent.session_id}")

    # ==================== 步骤 3: 处理用户请求 ====================
    print("\n" + "=" * 70)
    print("  开始处理用户请求")
    print("=" * 70)

    # 场景 1: 用户提交可疑代码
    print("\n【场景 1】用户提交代码片段...")

    user_code = """
import os
import subprocess

# 用户代码
def risky_function():
    user_input = input("输入命令: ")
    eval(user_input)  # 危险！
    os.system(user_input)  # 危险！
    subprocess.call(user_input, shell=True)  # 危险！
"""

    print(f"用户代码:\n{user_code[:200]}...")

    # Agent 检测代码
    result = agent.analyze_code(user_code)

    print(f"\n✓ 安全检测结果:")
    print(f"  - 风险等级: {result['result']['risk_level']}")
    print(f"  - 发现风险: {', '.join(result['result']['risks'])}")
    print(f"  - 审计哈希: {result['audit_hash'][:32]}...")

    # 场景 2: 用户输入包含恶意脚本
    print("\n【场景 2】用户输入检测...")

    user_input = "<script>document.cookie</script><img onerror='alert(1)' src=x>"
    print(f"用户输入: {user_input[:50]}...")

    # 检测安全性
    inspect_result = agent.inspect_input(user_input)
    print(f"\n✓ 输入检测:")
    print(f"  - 安全: {inspect_result['result']['safe']}")
    print(f"  - 风险: {inspect_result['result']['risks']}")

    # 净化输入
    sanitize_result = agent.sanitize_input(user_input)
    print(f"\n✓ 净化结果:")
    print(f"  - 原始: {user_input[:50]}...")
    print(f"  - 净化: {sanitize_result['result']['sanitized'][:50]}...")

    # 场景 3: 用户请求处理包含敏感信息
    print("\n【场景 3】处理敏感信息...")

    user_phone = "13812345678"
    user_idcard = "320123199001011234"

    print(f"原始手机号: {user_phone}")
    masked_phone = agent.mask_phone(user_phone)
    print(f"脱敏手机号: {masked_phone}")

    # 场景 4: Agent 输出签名
    print("\n【场景 4】输出签名验签...")

    output = "代码分析完成，发现 3 处高风险操作"
    signature = agent.sign_output(output)

    print(f"✓ 输出内容: {output}")
    print(f"✓ 数字签名: {signature}")

    # ==================== 步骤 4: 审计日志 ====================
    print("\n【审计存证】记录操作日志...")

    audit_result = agent.audit_log("code_analysis", {
        "code_length": len(user_code),
        "risks_found": result['result']['risks'],
        "input_sanitized": True,
        "sensitive_data_masked": True
    })

    print(f"✓ 审计哈希: {audit_result['result']['hash']}")
    print(f"✓ 时间戳: {audit_result['result']['timestamp']}")

    # ==================== 步骤 5: 统计报告 ====================
    print("\n" + "=" * 70)
    print("  Agent 操作报告")
    print("=" * 70)

    print(f"\n总操作数: {len(agent.operations)}")
    print("\n详细记录:")

    for i, op in enumerate(agent.operations, 1):
        status = "✓" if op["success"] else "✗"
        print(f"  {i}. [{status}] {op['skill']}.{op['action']}")
        if op.get("audit_hash"):
            print(f"     审计: {op['audit_hash'][:32]}...")

    # ==================== 步骤 6: 验证 API Key ====================
    print("\n【API Key 状态】")

    resp = requests.get(f"{BASE_URL}/api/v1/keys/list")
    keys = resp.json().get("keys", [])

    print(f"当前有效 Key: {len(keys)} 个")
    for key in keys:
        print(f"  - {key['key_id']}: {key['prefix']}...")

    print("\n" + "=" * 70)
    print("  ✓ Agent 测试完成")
    print("=" * 70)


if __name__ == "__main__":
    simulate_agent_workflow()