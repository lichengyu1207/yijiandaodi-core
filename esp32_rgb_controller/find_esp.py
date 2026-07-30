#!/usr/bin/env python3
"""详细扫描"""

import requests
import time

print("正在扫描192.168.43网段...")

for i in range(1, 255):
    ip = f"192.168.43.{i}"
    try:
        r = requests.get(f"http://{ip}/status", timeout=0.3)
        if r.status_code == 200:
            print(f"\n✓ 找到ESP32设备！")
            print(f"IP地址: {ip}")
            data = r.json()
            print(f"状态: {data['status']}")
            print(f"Wi-Fi: {data['wifi_ssid']}")
            print(f"\n测试命令:")
            print(f"  curl http://{ip}/status?state=red    # 红灯")
            print(f"  curl http://{ip}/status?state=yellow # 黄灯")
            print(f"  curl http://{ip}/status?state=green  # 绿灯")
            break
    except:
        if i % 20 == 0:
            print(f"已扫描: {i}/254", end="\r")
else:
    print("\n未找到设备")