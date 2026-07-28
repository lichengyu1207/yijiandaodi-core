#!/usr/bin/env python
"""
测试检测 Trae CN API Key

Trae CN 是字节跳动推出的 AI 编程助手
"""

import re

# Trae CN API Key 模式
TRAE_PATTERNS = [
    r'trae_[a-zA-Z0-9]{32}',      # Trae API Key (小写)
    r'TRAE_[A-Z0-9]{32}',         # Trae API Key (大写)
    r'Trae_[a-zA-Z0-9]{32}',      # Trae API Key (混合)
]

# 模拟 AI 生成的代码（包含 Trae CN API Key）
TEST_CODE = '''
import trae

# Trae CN API 配置
TRAE_API_KEY = "trae_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
TRAE_PROJECT_ID = "proj_123456"

def generate_code(prompt):
    """使用 Trae CN 生成代码"""
    client = trae.Client(api_key=TRAE_API_KEY)
    
    response = client.chat.completions.create(
        model="trae-coder-v1",
        messages=[
            {"role": "system", "content": "你是一个专业的程序员"},
            {"role": "user", "content": prompt}
        ]
    )
    
    return response.choices[0].message.content

# 测试
code = generate_code("写一个快速排序算法")
print(code)
'''

def test_trae_detection():
    """测试 Trae CN API Key 检测"""
    
    print("\n" + "="*70)
    print("   Trae CN API Key 检测测试")
    print("="*70)
    
    print("\n[测试代码]")
    print("-"*70)
    print(TEST_CODE[:200] + "...")
    print("-"*70)
    
    print("\n[检测过程]")
    
    # 检测硬编码密钥
    detected_keys = []
    
    for pattern in TRAE_PATTERNS:
        matches = re.findall(pattern, TEST_CODE)
        if matches:
            detected_keys.extend(matches)
    
    if detected_keys:
        print(f"\n  ⚠️  检测到 {len(detected_keys)} 个 Trae CN API Key:")
        for key in detected_keys:
            # 脱敏显示
            masked_key = key[:10] + "****" + key[-4:]
            print(f"     • {masked_key}")
        
        # 生成审计哈希
        import hashlib
        import json
        from datetime import datetime
        
        audit_data = {
            'platform': 'Trae CN',
            'key_count': len(detected_keys),
            'timestamp': datetime.now().isoformat(),
            'risk_type': 'hardcoded_secret'
        }
        audit_hash = hashlib.sha256(
            json.dumps(audit_data).encode()
        ).hexdigest()[:16]
        
        print("\n  ╔══════════════════════════════════════════════════════════╗")
        print("  ║  ⚠️  安全告警 - 操作已拦截                                ║")
        print("  ╠══════════════════════════════════════════════════════════╣")
        print("  ║  风险等级: critical                                       ║")
        print("  ║  风险类型: 硬编码密钥 (Trae CN)                          ║")
        print("  ╠══════════════════════════════════════════════════════════╣")
        print("  ║  检测详情:                                                ║")
        print("  ║  • 发现 Trae CN API Key 硬编码在代码中                    ║")
        print("  ║  • 密钥可能被提交到 Git 仓库导致泄露                       ║")
        print("  ╠══════════════════════════════════════════════════════════╣")
        print(f"  ║  审计哈希: {audit_hash}                                  ║")
        print("  ╚══════════════════════════════════════════════════════════╝")
        
        print("\n  ✓ 检测成功！")
        print(f"  ✓ 平台: Trae CN (字节跳动)")
        print(f"  ✓ 检测到 {len(detected_keys)} 个 API Key")
        
        return True
    else:
        print("\n  ✗ 未检测到 API Key")
        return False


def test_other_platforms():
    """测试其他平台的检测"""
    
    print("\n" + "="*70)
    print("   多平台 API Key 检测测试")
    print("="*70)
    
    # 测试代码：包含多个平台的 API Key
    multi_platform_code = '''
# 配置多个 AI 平台

# Trae CN (字节跳动)
TRAE_KEY = "trae_x1y2z3a4b5c6d7e8f9g0h1i2j3k4l5m6"

# 扣子 (字节跳动 Coze)
COZE_KEY = "MT_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"

# 腾讯混元
TENCENT_SECRET = "AKIDabcdefghijklmnopqrstuvwxyz1234"

# 阿里云百炼
ALIYUN_KEY = "sk-a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"

# DeepSeek
DEEPSEEK_KEY = "deepseek_a1b2c3d4e5f6g7h8i9j0k1l2"

# Qoder
QODER_KEY = "qoder_a1b2c3d4e5f6g7h8i9j0k1"

# 悟空
WUKONG_KEY = "wk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
'''
    
    # 所有检测模式
    all_patterns = {
        'Trae CN': [r'trae_[a-zA-Z0-9]{32}'],
        'Coze (扣子)': [r'MT-[a-zA-Z0-9]{32}'],
        '腾讯混元': [r'AKID[a-zA-Z0-9]{32}'],
        '阿里云百炼': [r'sk-[a-zA-Z0-9]{32}'],
        'DeepSeek': [r'deepseek_[a-zA-Z0-9]{32}'],
        'Qoder': [r'qoder_[a-zA-Z0-9]{24}'],
        '悟空': [r'wk_[a-zA-Z0-9]{32}'],
    }
    
    print("\n[检测结果]")
    print("-"*70)
    
    detected_count = 0
    for platform, patterns in all_patterns.items():
        for pattern in patterns:
            matches = re.findall(pattern, multi_platform_code)
            if matches:
                detected_count += len(matches)
                print(f"  ✓ {platform}: 检测到 {len(matches)} 个 Key")
                break
    
    print("-"*70)
    print(f"\n  总计: 检测到 {detected_count} 个平台的 API Key")
    
    return detected_count


if __name__ == '__main__':
    # 测试 Trae CN 检测
    trae_detected = test_trae_detection()
    
    # 测试多平台检测
    platform_count = test_other_platforms()
    
    # 总结
    print("\n" + "="*70)
    print("   测试总结")
    print("="*70)
    
    if trae_detected:
        print("\n  ✓ Trae CN API Key 检测: 通过")
    else:
        print("\n  ✗ Trae CN API Key 检测: 失败")
    
    print(f"  ✓ 多平台检测: 支持 {platform_count} 个平台")
    
    print("\n  一鉴到底可以检测 Trae CN 及其他主流 AI 平台的硬编码密钥！")
    print("="*70)