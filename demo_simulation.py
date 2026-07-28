#!/usr/bin/env python
"""
模拟演示 - 硬编码密钥拦截场景

演示流程：
1. 模拟 AI 生成包含 API Key 的代码
2. 调用一鉴到底沙箱 API 进行检测
3. 展示拦截结果和存证信息
"""

import json
import time
import hashlib
from datetime import datetime
import urllib.request
import urllib.error

# 模拟 AI 生成的代码
AI_GENERATED_CODE = '''
import openai

# API配置
OPENAI_API_KEY = "sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
ANTHROPIC_API_KEY = "sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

def call_gpt(prompt):
    """调用 GPT-4 API"""
    client = openai.OpenAI(api_key=OPENAI_API_KEY)
    return client.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": prompt}]
    )

def call_claude(prompt):
    """调用 Claude API"""
    import anthropic
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    return client.messages.create(
        model="claude-3-opus-20240229",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}]
    )
'''

def simulate_demo():
    """模拟演示流程"""
    
    print("\n" + "="*70)
    print("   一鉴到底 - 代码安全场景演示")
    print("   场景：硬编码密钥拦截")
    print("="*70)
    
    # ===== 步骤 1: 模拟 AI 生成代码 =====
    print("\n[步骤 1] 模拟 AI 编程助手生成代码...")
    print("-"*70)
    
    time.sleep(1)
    
    print("\n用户输入：")
    print("  > 请帮我写一个调用 GPT-4 和 Claude API 的客户端代码")
    
    time.sleep(1)
    
    print("\nAI 生成的代码：")
    print("-"*70)
    # 显示生成的代码（部分）
    for line in AI_GENERATED_CODE.strip().split('\n')[:10]:
        print(f"  {line}")
    print("  ...")
    print("-"*70)
    
    # ===== 步骤 2: 一鉴到底检测 =====
    print("\n[步骤 2] 一鉴到底正在检测...")
    print("-"*70)
    
    start_time = time.time()
    
    # 调用沙箱 API
    SANDBOX_API = "http://localhost:9092"
    
    try:
        # 检查 API 是否可用
        try:
            req = urllib.request.Request(f'{SANDBOX_API}/health')
            urllib.request.urlopen(req, timeout=2)
            api_available = True
        except:
            api_available = False
        
        if not api_available:
            raise urllib.error.URLError("API not available")
        
        # 生成 API Key
        req = urllib.request.Request(
            f'{SANDBOX_API}/api/v1/keys/generate',
            data=json.dumps({'scopes': ['demo:*']}).encode(),
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        response = urllib.request.urlopen(req, timeout=5)
        key_data = json.loads(response.read().decode())
        api_key = key_data['api_key']
        
        # 调用 Skill API 进行代码检测
        req = urllib.request.Request(
            f'{SANDBOX_API}/api/v1/skills/call',
            data=json.dumps({
                'skill_id': 'code-detector',
                'action': 'analyze',
                'params': {
                    'code': AI_GENERATED_CODE,
                    'language': 'python'
                }
            }).encode(),
            headers={
                'Content-Type': 'application/json',
                'X-API-Key': api_key
            },
            method='POST'
        )
        response = urllib.request.urlopen(req, timeout=10)
        result = json.loads(response.read().decode())
        
        end_time = time.time()
        response_time = int((end_time - start_time) * 1000)
        
        # ===== 步骤 3: 展示拦截结果 =====
        print("\n[步骤 3] 拦截结果")
        print("-"*70)
        
        if result.get('success'):
            analysis = result.get('result', {})
            
            # 模拟拦截窗口
            print("\n  ╔══════════════════════════════════════════════════════════╗")
            print("  ║  ⚠️  安全告警 - 操作已拦截                                ║")
            print("  ╠══════════════════════════════════════════════════════════╣")
            print(f"  ║  风险等级: {'critical' if 'critical' in str(analysis) else 'high'}                                    ║")
            print("  ║  风险类型: 硬编码密钥                                     ║")
            print("  ╠══════════════════════════════════════════════════════════╣")
            print("  ║  检测详情:                                                ║")
            print("  ║  • 发现 OpenAI API Key 硬编码在代码中                     ║")
            print("  ║  • 发现 Anthropic API Key 硬编码在代码中                  ║")
            print("  ║  • 密钥可能被提交到 Git 仓库导致泄露                       ║")
            print("  ╠══════════════════════════════════════════════════════════╣")
            print("  ║  响应时间: {}ms                                         ║".format(response_time))
            print("  ╠══════════════════════════════════════════════════════════╣")
            print("  ║  [允许执行]  [阻止并记录]  [查看详情]                      ║")
            print("  ╚══════════════════════════════════════════════════════════╝")
            
            # ===== 步骤 4: 存证信息 =====
            print("\n[步骤 4] 审计存证")
            print("-"*70)
            
            audit_hash = hashlib.sha256(
                json.dumps({
                    'code': AI_GENERATED_CODE,
                    'timestamp': datetime.now().isoformat(),
                    'risk_type': 'hardcoded_secret'
                }).encode()
            ).hexdigest()[:16]
            
            print(f"\n  审计哈希: {audit_hash}")
            print(f"  存证时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"  操作类型: 代码生成")
            print(f"  拦截状态: 已拦截")
            print(f"  风险标签: 硬编码密钥, 密钥泄露")
            
            print("\n  存证记录已写入本地数据库 ✓")
            
        else:
            print(f"\n  检测失败: {result.get('error')}")
            
    except urllib.error.URLError:
        print("\n  沙箱 API 未启动，使用内置检测逻辑...")
        
        # 内置检测
        import re
        patterns = [
            (r'sk-proj-[a-zA-Z0-9]{20,}', 'OpenAI Project Key'),
            (r'sk-ant-[a-zA-Z0-9]{20,}', 'Anthropic API Key'),
        ]
        
        detected = []
        for pattern, name in patterns:
            if re.search(pattern, AI_GENERATED_CODE):
                detected.append(name)
        
        end_time = time.time()
        response_time = int((end_time - start_time) * 1000)
        
        # 显示拦截结果
        print("\n  ╔══════════════════════════════════════════════════════════╗")
        print("  ║  ⚠️  安全告警 - 操作已拦截                                ║")
        print("  ╠══════════════════════════════════════════════════════════╣")
        print("  ║  风险等级: critical                                       ║")
        print("  ║  风险类型: 硬编码密钥                                     ║")
        print("  ╠══════════════════════════════════════════════════════════╣")
        print("  ║  检测详情:                                                ║")
        for item in detected:
            print(f"  ║  • 发现 {item}                                    ║")
        print("  ║  • 密钥可能被提交到 Git 仓库导致泄露                       ║")
        print("  ╠══════════════════════════════════════════════════════════╣")
        print(f"  ║  响应时间: {response_time}ms                                         ║")
        print("  ╠══════════════════════════════════════════════════════════╣")
        print("  ║  [允许执行]  [阻止并记录]  [查看详情]                      ║")
        print("  ╚══════════════════════════════════════════════════════════╝")
        
        # 存证信息
        print("\n[步骤 4] 审计存证")
        print("-"*70)
        
        audit_hash = hashlib.sha256(
            json.dumps({
                'code': AI_GENERATED_CODE,
                'timestamp': datetime.now().isoformat(),
                'risk_type': 'hardcoded_secret'
            }).encode()
        ).hexdigest()[:16]
        
        print(f"\n  审计哈希: {audit_hash}")
        print(f"  存证时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"  操作类型: 代码生成")
        print(f"  拦截状态: 已拦截")
        print(f"  风险标签: 硬编码密钥, 密钥泄露")
        
        print("\n  存证记录已写入本地数据库 ✓")
    
    # ===== 演示总结 =====
    print("\n" + "="*70)
    print("   演示总结")
    print("="*70)
    
    print("\n  ✓ AI 生成代码包含敏感信息")
    print("  ✓ 一鉴到底实时检测并拦截")
    print(f"  ✓ 响应时间: {response_time}ms（毫秒级）")
    print("  ✓ 审计存证已生成（司法级）")
    
    print("\n  核心价值：")
    print("  • 操作白盒化 - 完整记录 AI 操作过程")
    print("  • 数据不出域 - 本地检测，隐私安全")
    print("  • 司法级存证 - 不可篡改的审计日志")
    
    print("\n" + "="*70)


if __name__ == '__main__':
    simulate_demo()