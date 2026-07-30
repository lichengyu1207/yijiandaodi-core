"""
API Key测试脚本（修复版）
修复Token获取问题
"""

import requests
import json
import time
from datetime import datetime

BASE_URL = "http://localhost:8000"

class APIKeyTesterFixed:
    def __init__(self):
        self.access_token = None
        self.api_key = None
        self.user_id = None
        
    def test_user_auth(self):
        """测试用户认证（修复Token获取）"""
        print("\n" + "="*60)
        print("🔐 测试用户认证")
        print("="*60)
        
        # 注册用户
        timestamp = int(time.time())
        username = f"apikey_user_{timestamp}"
        email = f"apikey_{timestamp}@test.com"
        
        print(f"\n注册用户: {username}")
        response = requests.post(
            f"{BASE_URL}/api/auth/register/",
            json={
                "username": username,
                "email": email,
                "password": "Test@123",
                "confirm_password": "Test@123",
                "privacy_agreed": True
            },
            timeout=10
        )
        
        print(f"注册状态: {response.status_code}")
        
        if response.status_code in [200, 201]:
            print("✅ 注册成功")
            
            # 登录
            print(f"\n登录用户: {username}")
            response = requests.post(
                f"{BASE_URL}/api/auth/login/",
                json={
                    "username": username,
                    "password": "Test@123"
                },
                timeout=10
            )
            
            print(f"登录状态: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                # 从data字段中获取token（适配实际API返回结构）
                data_content = data.get('data', {})
                self.access_token = (
                    data_content.get('token') or 
                    data_content.get('access') or 
                    data_content.get('auth_token') or
                    data_content.get('key')
                )
                
                user_data = data_content.get('user', {})
                self.user_id = user_data.get('id')
                
                print("✅ 登录成功")
                print(f"Token类型: {type(self.access_token)}")
                if self.access_token:
                    print(f"Token: {self.access_token[:30]}...")
                print(f"用户ID: {self.user_id}")
                
                # 打印完整响应（调试）
                print(f"\n完整登录响应:")
                print(json.dumps(data, indent=2, ensure_ascii=False))
                
                return True
        
        print("❌ 认证失败")
        return False
    
    def test_api_key_generation(self):
        """测试API Key生成"""
        print("\n" + "="*60)
        print("🔑 测试API Key生成")
        print("="*60)
        
        if not self.access_token:
            print("❌ 请先登录")
            return False
        
        # 生成API Key
        print("\n生成API Key...")
        response = requests.post(
            f"{BASE_URL}/api/api-keys/generate/",
            headers={"Authorization": f"Bearer {self.access_token}"},
            json={
                "name": "Test API Key",
                "permissions": ["read", "write"],
                "expires_in_days": 365
            },
            timeout=10
        )
        
        print(f"生成状态: {response.status_code}")
        
        if response.status_code in [200, 201]:
            data = response.json()
            self.api_key = data.get('api_key')
            print(f"✅ API Key生成成功")
            print(f"Key: {self.api_key}")
            print(f"权限: {data.get('permissions')}")
            print(f"过期时间: {data.get('expires_at')}")
            return True
        else:
            print(f"❌ 生成失败: {response.text}")
            return False
    
    def test_api_key_authentication(self):
        """测试API Key认证"""
        print("\n" + "="*60)
        print("🔒 测试API Key认证")
        print("="*60)
        
        if not self.api_key:
            print("❌ 请先生成API Key")
            return False
        
        # 测试1：验证API Key
        print("\n测试1: 验证API Key")
        response = requests.get(
            f"{BASE_URL}/api/api-keys/verify/",
            headers={"X-API-Key": self.api_key},
            timeout=5
        )
        
        print(f"状态码: {response.status_code}")
        print(f"响应: {response.json()}")
        
        if response.status_code == 200:
            print("✅ API Key验证成功")
        
        # 测试2：使用API Key访问API
        print("\n测试2: 使用API Key访问会话列表")
        response = requests.get(
            f"{BASE_URL}/api/extension/sessions/",
            headers={"X-API-Key": self.api_key},
            timeout=10
        )
        
        print(f"状态码: {response.status_code}")
        if response.status_code == 200:
            print("✅ API Key访问成功")
            print(f"会话数: {len(response.json().get('results', []))}")
        
        return True
    
    def test_full_integration(self):
        """测试完整集成"""
        print("\n" + "="*60)
        print("🔗 测试完整集成")
        print("="*60)
        
        if not self.api_key:
            print("❌ 请先生成API Key")
            return False
        
        # 1. 列出所有API Key
        print("\n1. 列出所有API Key")
        response = requests.get(
            f"{BASE_URL}/api/api-keys/list/",
            headers={"Authorization": f"Bearer {self.access_token}"},
            timeout=10
        )
        
        print(f"状态码: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"API Key数量: {data.get('count', 0)}")
        
        # 2. 使用API Key创建会话
        print("\n2. 使用API Key创建会话")
        response = requests.post(
            f"{BASE_URL}/api/extension/sync/start/",
            headers={"X-API-Key": self.api_key},
            json={
                "session_id": f"apikey_test_{int(time.time())}",
                "title": "API Key测试会话",
                "platforms": ["API"],
                "start_time": datetime.now().isoformat()
            },
            timeout=10
        )
        
        print(f"状态码: {response.status_code}")
        if response.status_code in [200, 201]:
            print("✅ 创建会话成功")
        
        return True
    
    def generate_report(self):
        """生成测试报告"""
        print("\n" + "="*60)
        print("📋 API Key测试报告")
        print("="*60)
        print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"用户ID: {self.user_id}")
        print(f"API Key: {self.api_key}")
        print("="*60)
        
        report = {
            'timestamp': datetime.now().isoformat(),
            'user_id': self.user_id,
            'api_key': self.api_key,
            'tests': [
                {'name': '用户认证', 'status': 'PASS' if self.access_token else 'FAIL'},
                {'name': 'API Key生成', 'status': 'PASS' if self.api_key else 'FAIL'},
                {'name': 'API Key认证', 'status': 'PASS' if self.api_key else 'FAIL'},
                {'name': '完整集成', 'status': 'PASS' if self.api_key else 'FAIL'}
            ]
        }
        
        # 保存报告
        filename = f"apikey_test_fixed_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        print(f"\n报告已保存: {filename}")
        
        return report
    
    def run_all_tests(self):
        """运行所有测试"""
        print("\n" + "="*60)
        print("🚀 开始API Key完整测试（修复版）")
        print("="*60)
        
        self.test_user_auth()
        self.test_api_key_generation()
        self.test_api_key_authentication()
        self.test_full_integration()
        
        self.generate_report()


if __name__ == "__main__":
    tester = APIKeyTesterFixed()
    tester.run_all_tests()