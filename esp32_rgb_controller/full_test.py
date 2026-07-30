#!/usr/bin/env python3
"""完整测试所有颜色"""

import requests
import time

IP = "192.168.43.177"

colors = [
    ("red", "🔴 红灯", 2),
    ("yellow", "🟡 黄灯", 2),
    ("green", "🟢 绿灯", 2),
    ("flash", "🔴🟡 闪烁模式", 5),
    ("rainbow", "🌈 彩虹模式", 5),
]

print("\n" + "="*60)
print("ESP32 LED完整测试")
print("="*60 + "\n")

for state, name, duration in colors:
    print(f"{name}...")
    try:
        r = requests.get(f"http://{IP}/status?state={state}", timeout=2)
        if r.status_code == 200:
            print(f"   ✓ 已开启，持续{duration}秒\n")
            time.sleep(duration)
        else:
            print(f"   ✗ 失败\n")
    except Exception as e:
        print(f"   ✗ 错误: {e}\n")

# 最后恢复绿灯
print("恢复绿灯...")
requests.get(f"http://{IP}/status?state=green")
print("✓ 测试完成！\n")