#!/usr/bin/env python3
"""
自动扫描ESP32设备
"""

import requests
import socket
import sys
from concurrent.futures import ThreadPoolExecutor
import time

def check_device(ip):
    """检查指定IP是否是ESP32设备"""
    try:
        response = requests.get(f"http://{ip}/status", timeout=1)
        if response.status_code == 200:
            data = response.json()
            return ip, data
    except:
        pass
    return None, None

def scan_network(base_ip, start=1, end=255):
    """扫描网络"""
    print(f"\n正在扫描网络: {base_ip}.1-{end}")
    print("这可能需要几秒钟...\n")

    found_devices = []

    with ThreadPoolExecutor(max_workers=50) as executor:
        futures = []
        for i in range(start, end + 1):
            ip = f"{base_ip}.{i}"
            futures.append(executor.submit(check_device, ip))

        for i, future in enumerate(futures, 1):
            ip, data = future.result()
            if ip and data:
                found_devices.append((ip, data))
                print(f"✓ 找到设备: {ip}")
                print(f"  状态: {data['status']}")
                print(f"  Wi-Fi: {data['wifi_ssid']}")
                print(f"  运行时间: {data['uptime']}秒\n")

            if i % 50 == 0:
                print(f"已扫描 {i} 个地址...", end="\r")

    return found_devices

def get_local_ip():
    """获取本机IP地址"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        return None

def main():
    print("\n" + "="*60)
    print("ESP32设备自动扫描工具")
    print("="*60)

    # 获取本机IP
    local_ip = get_local_ip()

    if local_ip:
        print(f"\n本机IP: {local_ip}")
        base_ip = ".".join(local_ip.split(".")[:3])
        print(f"将扫描网段: {base_ip}.1-255")

        scan = input("\n开始扫描? (y/n): ").strip().lower()

        if scan == 'y':
            devices = scan_network(base_ip)

            if devices:
                print("\n" + "="*60)
                print(f"✓ 找到 {len(devices)} 个ESP32设备:")
                print("="*60)

                for ip, data in devices:
                    print(f"\n设备地址: {ip}")
                    print(f"当前状态: {data['status']}")
                    print(f"Wi-Fi: {data['wifi_ssid']}")
                    print(f"运行时间: {data['uptime']}秒")

                print("\n" + "="*60)
                print("测试命令:")
                print("="*60)
                ip = devices[0][0]
                print(f"\n测试红灯: python test_led.py {ip}")
                print(f"交互测试: python test_led_interactive.py")
                print(f"HTTP测试: curl http://{ip}/status?state=red\n")

            else:
                print("\n❌ 未找到ESP32设备")
                print("\n请检查:")
                print("1. ESP32是否已上电")
                print("2. 手机热点是否已开启")
                print("3. 电脑是否连接到热点 'MAIMANG 9 5G'")
                print("4. ESP32是否已连接到热点")
    else:
        print("❌ 无法获取本机IP地址")
        print("请确保电脑已连接到网络")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n扫描已中断")
    except Exception as e:
        print(f"\n❌ 发生错误: {str(e)}")