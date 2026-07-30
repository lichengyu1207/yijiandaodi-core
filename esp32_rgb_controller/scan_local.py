#!/usr/bin/env python3
"""快速扫描192.168.43网段"""

import requests
from concurrent.futures import ThreadPoolExecutor

def check_ip(ip):
    try:
        r = requests.get(f"http://{ip}/status", timeout=0.5)
        if r.status_code == 200:
            return ip, r.json()
    except:
        pass
    return None, None

print("正在扫描192.168.43.1-254...")

ips = [f"192.168.43.{i}" for i in range(1, 255)]

with ThreadPoolExecutor(max_workers=100) as executor:
    results = list(executor.map(check_ip, ips))

found = [(ip, data) for ip, data in results if ip]

if found:
    print(f"\n✓ 找到设备！")
    for ip, data in found:
        print(f"IP地址: {ip}")
        print(f"状态: {data['status']}")
        print(f"Wi-Fi: {data['wifi_ssid']}")
else:
    print("\n❌ 未找到设备")