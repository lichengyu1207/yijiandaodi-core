#!/usr/bin/env python3
"""红黄绿灯测试脚本"""

import requests
import time

ESP32_IP = "192.168.43.239"
BASE_URL = f"http://{ESP32_IP}"

print("\n" + "="*60)
print("ESP32 红黄绿灯测试")
print("="*60)
print(f"\n设备IP: {ESP32_IP}")

try:
    # 获取当前状态
    print("\n1. 获取设备当前状态...")
    response = requests.get(f"{BASE_URL}/status", timeout=5)
    data = response.json()
    print(f"   ✓ 当前状态: {data['status']}")
    print(f"   ✓ 运行时间: {data['uptime']}秒")
    print(f"   ✓ Wi-Fi: {data['wifi_ssid']}")

    # 测试红灯
    print("\n2. 测试红灯...")
    response = requests.get(f"{BASE_URL}/status?state=red", timeout=5)
    if response.status_code == 200:
        print("   ✓ 红灯已开启，请观察LED灯")
        time.sleep(3)

    # 测试黄灯
    print("\n3. 测试黄灯...")
    response = requests.get(f"{BASE_URL}/status?state=yellow", timeout=5)
    if response.status_code == 200:
        print("   ✓ 黄灯已开启，请观察LED灯")
        time.sleep(3)

    # 测试绿灯
    print("\n4. 测试绿灯...")
    response = requests.get(f"{BASE_URL}/status?state=green", timeout=5)
    if response.status_code == 200:
        print("   ✓ 绿灯已开启，请观察LED灯")
        time.sleep(3)

    # 测试闪烁模式
    print("\n5. 测试闪烁模式...")
    response = requests.get(f"{BASE_URL}/status?state=flash", timeout=5)
    if response.status_code == 200:
        print("   ✓ 闪烁模式已启动，请观察LED灯")
        time.sleep(5)

    # 测试彩虹模式
    print("\n6. 测试彩虹模式...")
    response = requests.get(f"{BASE_URL}/status?state=rainbo