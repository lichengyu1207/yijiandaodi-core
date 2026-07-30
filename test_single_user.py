#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
单用户测试脚本
使用已注册的测试用户进行同步功能测试
"""

import requests
import time
import json
from datetime import datetime

# 配置
BASE_URL = "http://localhost:8000/api/auth"

# 已成功注册的用户
TEST_USER = {
    "username": "test_user_concurrent_0_1783864387",
    "password": "Test@123456"
}

def test_login():
    """测试登录"""
    print("\n步骤 1: 用户登录")
    print("-" * 40)
    
    try:
        response = requests.post(
            f"{BASE_URL}/login/",
            json={
                "username": TEST_USER["username"],
                "password": TEST_USER["password"]
            },
            timeout=10
        )
        
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            token = data.get("access") or data.get("token")
            print(f"✅ 登录成功")
            print(f"Token: {token[:30]}..." if token else "无 Token")
            return token
        else:
            print(f"❌ 登录失败: {response.text}")
            return None
    except Exception as e:
        print(f"❌ 登录异常: {e}")
        return None

def test_sync_start(token):
    """测试开始录制同步"""
    print("\n步骤 2: 开始录制同步")
    print("-" * 40)
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    session_id = f"test_session_{int(time.time())}"
    
    try:
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
        
        print(f"状态码: {response.status_code}")
        print(f"响应: {response.text[:200]}")
        
        if response.status_code == 200:
            print(f"✅ 开始录制成功，会话ID: {session_id}")
            return session_id
        else:
            print(f"❌ 开始录制失败")
            return None
    except Exception as e:
        print(f"❌ 开始录制异常: {e}")
        return None

def test_sync_operation(token, session_id):
    """测试操作同步"""
    print("\n步骤 3: 同步操作记录")
    print("-" * 40)
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/extension/sync/operation/",
            headers=headers,
            json={
                "session_id": session_id,
                "operations": [
                    {
                        "operation_type": "ai_prompt",
                        "timestamp": datetime.now().isoformat(),
                        "platform": "DeepSeek",
                        "data": {"content": "帮我写一首诗"}
                    },
                    {
                        "operation_type": "ai_response",
                        "timestamp": datetime.now().isoformat(),
                        "platform": "DeepSeek",
                        "data": {"content": "好的，这是一首诗..."}
                    }
                ]
            },
            timeout=10
        )
        
        print(f"状态码: {response.status_code}")
        print(f"响应: {response.text[:200]}")
        
        if response.status_code == 200:
            print(f"✅ 操作同步成功")
            return True
        else:
            print(f"❌ 操作同步失败")
            return False
    except Exception as e:
        print(f"❌ 操作同步异常: {e}")
        return False

def test_sync_end(token, session_id):
    """测试停止录制同步"""
    print("\n步骤 4: 停止录制同步")
    print("-" * 40)
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/extension/sync/end/",
            headers=headers,
            json={
                "session_id": session_id,
                "end_time": datetime.now().isoformat()
            },
            timeout=10
        )
        
        print(f"状态码: {response.status_code}")
        print(f"响应: {response.text[:200]}")
        
        if response.status_code == 200:
            print(f"✅ 停止录制成功")
            return True
        else:
            print(f"❌ 停止录制失败")
            return False
    except Exception as e:
        print(f"❌ 停止录制异常: {e}")
        return False

def test_get_sessions(token):
    """测试获取会话列表"""
    print("\n步骤 5: 获取会话列表")
    print("-" * 40)
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.get(
            f"{BASE_URL}/extension/sessions/",
            headers=headers,
            timeout=10
        )
        
        print(f"状态码: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ 获取会话列表成功")
            print(f"会话数量: {len(data.get('results', []))}")
            return True
        else:
            print(f"❌ 获取会话列表失败: {response.text}")
            return False
    except Exception as e:
        print(f"❌ 获取会话列表异常: {e}")
        return False

def main():
    """主测试流程"""
    print("=" * 50)
    print("浏览器插件同步功能测试")
    print("=" * 50)
    print(f"测试用户: {TEST_USER['username']}")
    print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # 步骤 1: 登录
    token = test_login()
    if not token:
        print("\n❌ 测试终止：登录失败")
        print("提示：请等待 15 分钟后重试，或使用其他账号")
        return
    
    # 步骤 2: 开始录制
    session_id = test_sync_start(token)
    if not session_id:
        print("\n❌ 测试终止：开始录制失败")
        return
    
    # 步骤 3: 同步操作
    if not test_sync_operation(token, session_id):
        print("\n⚠️ 操作同步失败，但继续测试")
    
    # 步骤 4: 停止录制
    if not test_sync_end(token, session_id):
        print("\n⚠️ 停止录制失败，但继续测试")
    
    # 步骤 5: 获取会话列表
    test_get_sessions(token)
    
    # 总结
    print("\n" + "=" * 50)
    print("测试完成")
    print("=" * 50)

if __name__ == "__main__":
    main()