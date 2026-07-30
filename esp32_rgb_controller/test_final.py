#!/usr/bin/env python3
"""测试ESP32 RGB LED - 192.168.43.177"""

import requests
import time

IP = "192.168.43.177"

print("\n" + "="*60)
print(f"ESP32 RGB LED 测试")
print(f"设备地址: {IP}")
print("="*60)

# 测试连接
print("\n1. 测试连接...")
try:
    r = requests.get(f"http://{IP}/status", timeout=3)
    if r.status_code == 200:
        data = r.json()
        print("   ✓ 连接成功！")
        print(f"   状态: {data['status']}")
        print(f"   Wi-Fi: {data['wifi_ssid']}")
        print(f"   运行时间: {data['uptime']}秒")
except Exception as e:
    print(f"   ✗ 连接失败: {e}")
    exit(1)

# 测试红灯
print("\n2. 测试红灯...")
r = requests.get(f"http://{IP}/status?state=red", timeout=3)
if r.status_code == 200:
    print("   ✓ 红灯已开启，请观察LED")
    time.sleep(3)

# 测试黄灯
print("\n3. 测试黄灯...")
r = requests.get(f"http://{IP}/status?state=yellow", timeout=3)
if r.status_code == 200:
    print("   ✓ 黄灯已开启，请观察LED")
    time.sleep(3)

# 测试绿灯
print("\n4. 测试绿灯...")
r = requests.get(f"http://{IP}/status?state=green", timeout=3)
if r.status_code == 200:
    print("   ✓ 绿灯已开启，请观察LED")
    time.sleep(3)

print("\n" + "="*60)
print("✓ 测试完成！LED应该依次显示了红、黄、绿三种颜色")
print("="*60)