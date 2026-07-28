#!/usr/bin/env python
"""
一鉴到底 - 一键启动脚本

启动所有后端服务：
- 沙箱 API (端口 9092)
- 认证服务 (端口 9093)
"""

import os
import sys
import time
import signal
import subprocess
import requests
from pathlib import Path

# 服务配置
SERVICES = [
    {
        'name': '沙箱 API',
        'script': 'sandbox_api.py',
        'port': 9092,
        'health_path': '/health'
    },
    {
        'name': '认证服务',
        'script': 'auth_service.py',
        'port': 9093,
        'health_path': '/health'
    }
]

# 进程列表
processes = []

def check_service_health(port: int, health_path: str = '/health') -> bool:
    """检查服务健康状态"""
    try:
        resp = requests.get(f'http://localhost:{port}{health_path}', timeout=2)
        return resp.status_code == 200
    except:
        return False

def start_service(service: dict) -> subprocess.Popen:
    """启动单个服务"""
    script_path = Path(__file__).parent / service['script']
    
    print(f"\n[启动] {service['name']} (端口 {service['port']})...")
    
    process = subprocess.Popen(
        [sys.executable, str(script_path)],
        cwd=str(script_path.parent),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if sys.platform == 'win32' else 0
    )
    
    # 等待服务启动
    max_wait = 10
    for i in range(max_wait):
        time.sleep(1)
        if check_service_health(service['port'], service['health_path']):
            print(f"✓ {service['name']} 已启动 (PID: {process.pid})")
            return process
    
    print(f"✗ {service['name']} 启动超时")
    return process

def stop_all_services():
    """停止所有服务"""
    print("\n[停止] 所有服务...")
    
    for process in processes:
        try:
            process.terminate()
            process.wait(timeout=5)
            print(f"✓ 已停止 PID: {process.pid}")
        except:
            try:
                process.kill()
                print(f"✓ 已强制停止 PID: {process.pid}")
            except:
                pass

def signal_handler(signum, frame):
    """信号处理"""
    print("\n\n收到退出信号...")
    stop_all_services()
    sys.exit(0)

def main():
    """主函数"""
    print("\n" + "="*60)
    print("   一鉴到底 - 一键启动")
    print("="*60)
    
    # 注册信号处理
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    # 检查已运行的服务
    print("\n[检查] 检查已运行的服务...")
    
    for service in SERVICES:
        if check_service_health(service['port'], service['health_path']):
            print(f"  ✓ {service['name']} 已在运行")
        else:
            process = start_service(service)
            processes.append(process)
    
    # 显示状态
    print("\n" + "="*60)
    print("   服务状态")
    print("="*60)
    
    all_running = True
    for service in SERVICES:
        status = '运行中' if check_service_health(service['port'], service['health_path']) else '已停止'
        status_icon = '✓' if status == '运行中' else '✗'
        print(f"  {status_icon} {service['name']}: {status} (http://localhost:{service['port']})")
        
        if status == '已停止':
            all_running = False
    
    print("="*60)
    
    if all_running:
        print("\n✓ 所有服务已启动")
        print("\n访问地址:")
        print("  • Skill API: http://localhost:9092/api/v1/skills")
        print("  • 认证服务: http://localhost:9093")
        print("\n按 Ctrl+C 停止所有服务")
        
        # 保持运行
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            stop_all_services()
    else:
        print("\n✗ 部分服务启动失败")
        stop_all_services()
        return 1
    
    return 0

if __name__ == '__main__':
    sys.exit(main())