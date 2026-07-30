#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
浏览器插件并发测试脚本
测试场景：多个用户同时进行录制和同步
"""

import requests
import time
import threading
import json
from datetime import datetime

# 配置
BASE_URL = "http://localhost:8000/api/auth"
TEST_USER_PREFIX = "test_user_concurrent"

# 结果收集
results = {
    "total_requests": 0,
    "success_requests": 0,
    "failed_requests": 0,
    "errors": [],
    "response_times": [],
}

def register_user(user_index):
    """注册新用户"""
    username = f"{TEST_USER_PREFIX}_{user_index}_{int(time.time())}"
    email = f"{username}@test.com"
    password = "Test@123456"
    
    try:
        response = requests.post(
            f"{BASE_URL}/register/",
            json={
                "username": username,
                "email": email,
                "password": password,
                "confirm_password": password,
                "privacy_agreed": True
            },
            timeout=10
        )
        
        if response.status_code == 201:
            print(f"✅ 用户 {username} 注册成功")
            return {
                "username": username,
                "email": email,
                "password": password
            }
        else:
            print(f"❌ 用户 {username} 注册失败: {response.text}")
            return None
    except Exception as e:
        print(f"❌ 注册异常: {e}")
        return None

def login_user(user_data):
    """用户登录获取 Token"""
    try:
        response = requests.post(
            f"{BASE_URL}/login/",
            json={
                "username": user_data["username"],
                "password": user_data["password"]
            },
            timeout=10
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ 用户 {user_data['username']} 登录成功")
            return data.get("access") or data.get("token")
        else:
            print(f"❌ 用户 {user_data['username']} 登录失败: {response.text}")
            return None
    except Exception as e:
        print(f"❌ 登录异常: {e}")
        return None

def sync_session(user_index, token, session_id):
    """同步录制会话"""
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # 开始录制
    try:
        start_time = time.time()
        response = requests.post(
            f"{BASE_URL}/extension/sync/start/",
            headers=headers,
            json={
                "session_id": session_id,
                "start_time": datetime.now().isoformat(),
                "platform": "DeepSeek",
                "platform_type": "ai_chat"
            },
            timeout=10
        )
        response_time = time.time() - start_time
        
        results["total_requests"] += 1
        results["response_times"].append(response_time)
        
        if response.status_code == 200:
            results["success_requests"] += 1
            print(f"  用户{user_index}: 开始录制成功 ({response_time:.2f}s)")
        else:
            results["failed_requests"] += 1
            results["errors"].append(f"开始录制失败: {response.text}")
            print(f"  用户{user_index}: 开始录制失败 - {response.status_code}")
            return False
    except Exception as e:
        results["failed_requests"] += 1
        results["errors"].append(str(e))
        print(f"  用户{user_index}: 开始录制异常 - {e}")
        return False
    
    # 同步操作
    for i in range(3):
        try:
            start_time = time.time()
            response = requests.post(
                f"{BASE_URL}/extension/sync/operation/",
                headers=headers,
                json={
                    "session_id": session_id,
                    "operations": [{
                        "operation_type": "ai_prompt",
                        "timestamp": datetime.now().isoformat(),
                        "platform": "DeepSeek",
                        "data": {"content": f"测试内容 {i}"}
                    }]
                },
                timeout=10
            )
            response_time = time.time() - start_time
            
            results["total_requests"] += 1
            results["response_times"].append(response_time)
            
            if response.status_code == 200:
                results["success_requests"] += 1
            else:
                results["failed_requests"] += 1
        except Exception as e:
            results["failed_requests"] += 1
            results["errors"].append(str(e))
    
    print(f"  用户{user_index}: 同步操作完成")
    
    # 停止录制
    try:
        start_time = time.time()
        response = requests.post(
            f"{BASE_URL}/extension/sync/end/",
            headers=headers,
            json={
                "session_id": session_id,
                "end_time": datetime.now().isoformat()
            },
            timeout=10
        )
        response_time = time.time() - start_time
        
        results["total_requests"] += 1
        results["response_times"].append(response_time)
        
        if response.status_code == 200:
            results["success_requests"] += 1
            print(f"  用户{user_index}: 停止录制成功 ({response_time:.2f}s)")
        else:
            results["failed_requests"] += 1
            results["errors"].append(f"停止录制失败: {response.text}")
    except Exception as e:
        results["failed_requests"] += 1
        results["errors"].append(str(e))
    
    return True

def run_concurrent_test(num_users):
    """运行并发测试"""
    print(f"\n{'='*60}")
    print(f"开始并发测试: {num_users} 个用户同时操作")
    print(f"{'='*60}\n")
    
    # 注册用户
    print("步骤 1: 注册测试用户")
    users = []
    for i in range(num_users):
        user = register_user(i)
        if user:
            users.append(user)
    
    if not users:
        print("❌ 没有成功注册用户，测试终止")
        return
    
    print(f"\n成功注册 {len(users)} 个用户\n")
    
    # 登录获取 Token
    print("步骤 2: 用户登录获取 Token")
    tokens = []
    for i, user in enumerate(users):
        token = login_user(user)
        if token:
            tokens.append({
                "user_index": i,
                "token": token,
                "user": user
            })
    
    if not tokens:
        print("❌ 没有成功登录用户，测试终止")
        return
    
    print(f"\n成功登录 {len(tokens)} 个用户\n")
    
    # 并发同步测试
    print("步骤 3: 开始并发同步测试")
    threads = []
    
    for i, token_data in enumerate(tokens):
        session_id = f"session_{i}_{int(time.time())}"
        thread = threading.Thread(
            target=sync_session,
            args=(i, token_data["token"], session_id)
        )
        threads.append(thread)
    
    # 同时启动所有线程
    start_time = time.time()
    for thread in threads:
        thread.start()
    
    # 等待所有线程完成
    for thread in threads:
        thread.join()
    
    total_time = time.time() - start_time
    
    # 打印结果
    print(f"\n{'='*60}")
    print("测试结果")
    print(f"{'='*60}")
    print(f"总请求数: {results['total_requests']}")
    print(f"成功请求: {results['success_requests']}")
    print(f"失败请求: {results['failed_requests']}")
    print(f"成功率: {results['success_requests']/results['total_requests']*100:.2f}%")
    print(f"总耗时: {total_time:.2f}s")
    
    if results['response_times']:
        avg_time = sum(results['response_times']) / len(results['response_times'])
        print(f"平均响应时间: {avg_time:.2f}s")
        print(f"最大响应时间: {max(results['response_times']):.2f}s")
        print(f"最小响应时间: {min(results['response_times']):.2f}s")
    
    if results['errors']:
        print(f"\n错误详情 (前5个):")
        for error in results['errors'][:5]:
            print(f"  - {error}")
    
    print(f"{'='*60}\n")

if __name__ == "__main__":
    # 运行并发测试
    run_concurrent_test(num_users=5)