#!/usr/bin/env python3
"""
ESP32 RGB LED 测试脚本
测试红黄绿灯功能
"""

import requests
import time
import sys

def test_led(ip_address):
    """测试LED控制"""
    base_url = f"http://{ip_address}"

    print(f"\n{'='*50}")
    print(f"ESP32 RGB LED 测试")
    print(f"设备地址: {ip_address}")
    print(f"{'='*50}\n")

    # 测试序列：红 -> 黄 -> 绿
    test_sequence = [
        ("red", "红灯", 3),
        ("yellow", "黄灯", 3),
        ("green", "绿灯", 3),
    ]

    try:
        # 首先获取当前状态
        print("1. 获取当前状态...")
        response = requests.get(f"{base_url}/status", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"   ✓ 当前状态: {data['status']}")
            print(f"   ✓ 运行时间: {data['uptime']}秒")
            print(f"   ✓ Wi-Fi: {data['wifi_ssid']}")
            print(f"   ✓ IP地址: {data['ip_address']}\n")
        else:
            print(f"   ✗ 请求失败: {response.status_code}\n")
            return False

        # 测试红黄绿灯序列
        for state, name, duration in test_sequence:
            print(f"2.{test_sequence.index((state, name, duration))+1}. 测试{name}...")
            response = requests.get(f"{base_url}/status?state={state}", timeout=5)

            if response.status_code == 200:
                data = response.json()
                print(f"   ✓ 状态已切换为: {data['status']}")
                print(f"   ✓ 消息: {data['message']}")
                print(f"   → 等待 {duration} 秒...")
                time.sleep(duration)
                print()
            else:
                print(f"   ✗ 请求失败: {response.status_code}\n")
                return False

        # 测试闪烁模式
        print("3. 测试闪烁模式...")
        response = requests.get(f"{base_url}/status?state=flash", timeout=5)
        if response.status_code == 200:
            print(f"   ✓ 闪烁模式已启动")
            print(f"   → 等待 5 秒...")
            time.sleep(5)
            print()

        # 测试彩虹模式
        print("4. 测试彩虹模式...")
        response = requests.get(f"{base_url}/status?state=rainbow", timeout=5)
        if response.status_code == 200:
            print(f"   ✓ 彩虹模式已启动")
            print(f"   → 等待 5 秒...")
            time.sleep(5)
            print()

        # 最后恢复绿灯
        print("5. 恢复绿灯...")
        response = requests.get(f"{base_url}/status?state=green", timeout=5)
        if response.status_code == 200:
            print(f"   ✓ 已恢复为绿灯\n")

        print(f"{'='*50}")
        print(f"✓ 测试完成！")
        print(f"{'='*50}\n")
        return True

    except requests.exceptions.Timeout:
        print(f"✗ 连接超时，请检查设备是否在线")
        print(f"   确保电脑和ESP32在同一局域网")
        print(f"   确保IP地址正确: {ip_address}\n")
        return False
    except requests.exceptions.ConnectionError:
        print(f"✗ 连接失败，请检查网络连接")
        print(f"   确保电脑和ESP32在同一局域网")
        print(f"   确保IP地址正确: {ip_address}\n")
        return False
    except Exception as e:
        print(f"✗ 测试失败: {str(e)}\n")
        return False

if __name__ == "__main__":
    # 获取IP地址
    if len(sys.argv) > 1:
        ip_address = sys.argv[1]
    else:
        print("\n请输入ESP32的IP地址（例如：192.168.1.100）")
        print("提示：请查看串口监视器获取IP地址\n")
        ip_address = input("IP地址: ").strip()

        if not ip_address:
            print("✗ IP地址不能为空")
            sys.exit(1)

    # 执行测试
    success = test_led(ip_address)
    sys.exit(0 if success else 1)