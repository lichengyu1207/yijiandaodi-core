#!/usr/bin/env python3
"""
ESP32 RGB LED 交互式测试脚本
"""

import requests
import time

def test_connection(ip_address):
    """测试设备连接"""
    try:
        response = requests.get(f"http://{ip_address}/status", timeout=3)
        if response.status_code == 200:
            return response.json()
    except:
        pass
    return None

def main():
    print("\n" + "="*60)
    print("ESP32 RGB LED 测试工具")
    print("="*60)

    # 提示用户如何获取IP地址
    print("\n请按以下步骤获取设备IP地址：")
    print("1. 查看手机热点设置中的已连接设备")
    print("2. 或在串口监视器中查看启动日志")
    print("3. ESP32设备名称通常包含'ESP32'或'ESP'")

    # 获取IP地址
    ip_address = input("\n请输入ESP32的IP地址: ").strip()

    if not ip_address:
        print("❌ IP地址不能为空")
        return

    # 测试连接
    print(f"\n正在连接 {ip_address}...")
    status = test_connection(ip_address)

    if not status:
        print("❌ 无法连接到设备，请检查：")
        print("   1. IP地址是否正确")
        print("   2. 手机热点是否已开启")
        print("   3. 电脑是否连接到同一热点")
        return

    print("✓ 连接成功！")
    print(f"\n设备信息：")
    print(f"  状态: {status['status']}")
    print(f"  运行时间: {status['uptime']}秒")
    print(f"  Wi-Fi: {status['wifi_ssid']}")
    print(f"  IP地址: {status['ip_address']}")

    # 测试菜单
    while True:
        print("\n" + "-"*60)
        print("测试选项：")
        print("1. 测试红灯")
        print("2. 测试黄灯")
        print("3. 测试绿灯")
        print("4. 测试红黄绿灯序列")
        print("5. 测试闪烁模式")
        print("6. 测试彩虹模式")
        print("7. 查看当前状态")
        print("8. 退出")

        choice = input("\n请选择 (1-8): ").strip()

        if choice == "1":
            # 测试红灯
            print("\n测试红灯...")
            response = requests.get(f"http://{ip_address}/status?state=red", timeout=3)
            if response.status_code == 200:
                print("✓ 红灯已开启")
                time.sleep(2)

        elif choice == "2":
            # 测试黄灯
            print("\n测试黄灯...")
            response = requests.get(f"http://{ip_address}/status?state=yellow", timeout=3)
            if response.status_code == 200:
                print("✓ 黄灯已开启")
                time.sleep(2)

        elif choice == "3":
            # 测试绿灯
            print("\n测试绿灯...")
            response = requests.get(f"http://{ip_address}/status?state=green", timeout=3)
            if response.status_code == 200:
                print("✓ 绿灯已开启")
                time.sleep(2)

        elif choice == "4":
            # 测试红黄绿灯序列
            print("\n测试红黄绿灯序列...")
            for state, name in [("red", "红灯"), ("yellow", "黄灯"), ("green", "绿灯")]:
                response = requests.get(f"http://{ip_address}/status?state={state}", timeout=3)
                if response.status_code == 200:
                    print(f"✓ {name}已开启")
                    time.sleep(3)
            print("✓ 序列测试完成")

        elif choice == "5":
            # 测试闪烁模式
            print("\n测试闪烁模式...")
            response = requests.get(f"http://{ip_address}/status?state=flash", timeout=3)
            if response.status_code == 200:
                print("✓ 闪烁模式已启动")
                print("观察LED闪烁效果（将持续5秒）...")
                time.sleep(5)

        elif choice == "6":
            # 测试彩虹模式
            print("\n测试彩虹模式...")
            response = requests.get(f"http://{ip_address}/status?state=rainbow", timeout=3)
            if response.status_code == 200:
                print("✓ 彩虹模式已启动")
                print("观察LED彩虹效果（将持续5秒）...")
                time.sleep(5)

        elif choice == "7":
            # 查看当前状态
            status = test_connection(ip_address)
            if status:
                print(f"\n当前状态: {status['status']}")
                print(f"运行时间: {status['uptime']}秒")
            else:
                print("❌ 无法获取状态")

        elif choice == "8":
            # 退出
            print("\n退出测试")
            break

        else:
            print("❌ 无效选择，请重新输入")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n测试已中断")
    except Exception as e:
        print(f"\n❌ 发生错误: {str(e)}")