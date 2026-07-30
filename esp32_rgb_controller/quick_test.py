#!/usr/bin/env python3
"""快速测试脚本 - 无需交互"""

import requests
import time

# 手机热点常见网段
test_ips = [
    "192.168.43.1",    # 手机热点网关
    "192.168.43.2",
    "192.168.43.10",
    "192.168.43.20",
    "192.168.43.50",
    "192.168.43.100",
    "192.168.43.150",
    "192.168.43.200",
    "192.168.1.100",   # 路由器常见网段
    "192.168.1.101",
]

print("正在搜索ESP32设备...")

found_ip = None
for ip in test_ips:
    try:
        print(f"尝试 {ip}...", end=" ")
        response = requests.get(f"http://{ip}/status", timeout=1)
        if response.status_code == 200:
            data = response.json()
            print(f"✓ 找到设备！")
            found_ip = ip
            print(f"\n设备信息:")
            print(f"  IP地址: {ip}")
            print(f"  状态: {data['status']}")
            print(f"  Wi-Fi: {data['wifi_ssid']}")
            print(f"  运行时间: {data['uptime']}秒\n")
            break
    except:
        print("×")

if found_ip:
    print("="*60)
    print("开始测试红黄绿灯...")
    print("="*60)

    for state, name in [("red", "红灯"), ("yellow", "黄灯"), ("green", "绿灯")]:
        print(f"\n测试 {name}...")
        response = requests.get(f"http://{found_ip}/status?state={state}", timeout=3)
        if response.status_code == 200:
            print(f"✓ {name}已开启")
            print("  请观察LED灯")
            time.sleep(3)

    print("\n" + "="*60)
    print("✓ 测试完成！")
    print("="*60)
else:
    print("\n❌ 未找到设备")
    print("\n请手动运行以下命令进行测试:")
    print("  python scan_device.py         # 扫描网络")
    print("  python test_led_interactive.py # 交互式测试")