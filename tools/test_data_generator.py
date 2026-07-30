"""
测试数据生成器
生成用户数据、行为交互数据、会话数据
"""

import requests
import json
import random
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"

class DataGenerator:
    def __init__(self):
        self.token = None
        self.users = []
        self.sessions = []
        
    def register_user(self, username, email, password):
        """注册用户"""
        response = requests.post(
            f"{BASE_URL}/api/auth/register/",
            json={
                "username": username,
                "email": email,
                "password": password,
                "confirm_password": password,
                "privacy_agreed": True
            },
            timeout=5
        )
        
        if response.status_code in [200, 201]:
            print(f"✅ 用户注册成功: {username}")
            return True
        else:
            print(f"❌ 用户注册失败: {response.json()}")
            return False
    
    def login_user(self, username, password):
        """用户登录"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login/",
            json={
                "username": username,
                "password": password
            },
            timeout=5
        )
        
        if response.status_code == 200:
            data = response.json()
            self.token = data.get('access') or data.get('token')
            print(f"✅ 用户登录成功: {username}")
            return True
        else:
            print(f"❌ 用户登录失败: {response.json()}")
            return False
    
    def create_session(self, platform="DeepSeek"):
        """创建会话"""
        try:
            response = requests.post(
                f"{BASE_URL}/api/browser/sessions/",
                headers={"Authorization": f"Bearer {self.token}"},
                json={
                    "platform": platform,
                    "platform_url": f"https://{platform.lower()}.com",
                    "session_data": {
                        "browser": "Chrome",
                        "os": "Windows",
                        "user_agent": "Mozilla/5.0"
                    }
                },
                timeout=5
            )

            print(f"API响应状态: {response.status_code}")
            print(f"API响应内容: {response.text[:200]}")

            if response.status_code in [200, 201]:
                data = response.json()
                session_id = data.get('data', {}).get('session_id') or data.get('session_id')
                self.sessions.append(session_id)
                print(f"✅ 会话创建成功: {session_id}")
                return session_id
            else:
                print(f"❌ 会话创建失败: 状态码 {response.status_code}")
                return None
        except Exception as e:
            print(f"❌ 会话创建异常: {str(e)}")
            return None
    
    def create_operation(self, session_id, operation_type="text_input", operation_data=None):
        """创建操作记录"""
        if operation_data is None:
            operation_data = {
                "content": "测试输入内容",
                "selector": "input[type='text']"
            }
        
        response = requests.post(
            f"{BASE_URL}/api/browser/operations/",
            headers={"Authorization": f"Bearer {self.token}"},
            json={
                "session": session_id,
                "operation_type": operation_type,
                "operation_data": operation_data,
                "page_url": "https://chat.deepseek.com",
                "page_title": "DeepSeek Chat"
            },
            timeout=5
        )
        
        if response.status_code in [200, 201]:
            print(f"✅ 操作记录创建成功: {operation_type}")
            return True
        else:
            print(f"❌ 操作记录创建失败: {response.json()}")
            return False
    
    def create_fingerprint(self, session_id, content_hash, content_type="text"):
        """创建指纹"""
        response = requests.post(
            f"{BASE_URL}/api/browser/fingerprints/",
            headers={"Authorization": f"Bearer {self.token}"},
            json={
                "session": session_id,
                "content_hash": content_hash,
                "content_type": content_type,
                "content_preview": "测试内容预览..."
            },
            timeout=5
        )
        
        if response.status_code in [200, 201]:
            print(f"✅ 指纹创建成功: {content_hash[:20]}...")
            return True
        else:
            print(f"❌ 指纹创建失败: {response.json()}")
            return False
    
    def get_user_info(self):
        """获取用户信息"""
        response = requests.get(
            f"{BASE_URL}/api/auth/user/",
            headers={"Authorization": f"Bearer {self.token}"},
            timeout=5
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ 用户信息: {json.dumps(data, indent=2, ensure_ascii=False)}")
            return data
        else:
            print(f"❌ 获取用户信息失败: {response.json()}")
            return None
    
    def get_sessions(self):
        """获取会话列表"""
        response = requests.get(
            f"{BASE_URL}/api/browser/sessions/",
            headers={"Authorization": f"Bearer {self.token}"},
            timeout=5
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ 会话列表: {json.dumps(data, indent=2, ensure_ascii=False)}")
            return data
        else:
            print(f"❌ 获取会话列表失败: {response.json()}")
            return None
    
    def get_operations(self, session_id):
        """获取操作记录"""
        response = requests.get(
            f"{BASE_URL}/api/browser/operations/?session={session_id}",
            headers={"Authorization": f"Bearer {self.token}"},
            timeout=5
        )
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ 操作记录: {json.dumps(data, indent=2, ensure_ascii=False)}")
            return data
        else:
            print(f"❌ 获取操作记录失败: {response.json()}")
            return None

    def generate_test_data(self):
        """生成完整测试数据"""
        print("\n" + "="*50)
        print("开始生成测试数据")
        print("="*50)
        
        # 1. 注册测试用户
        username = f"testuser_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        email = f"{username}@test.com"
        password = "Test@123456"
        
        if not self.register_user(username, email, password):
            # 如果注册失败，尝试登录已有用户
            if not self.login_user(username, password):
                print("❌ 无法创建或登录用户")
                return
        
        # 2. 创建会话
        session_id = self.create_session(platform="DeepSeek")
        if not session_id:
            return
        
        # 3. 创建多个操作记录
        operations = [
            ("text_input", {"content": "请写一篇关于AI的文章", "selector": "textarea"}),
            ("click", {"target": "发送按钮", "selector": "button[type='submit']"}),
            ("text_input", {"content": "AI正在改变世界...", "selector": "div.output"}),
            ("copy", {"content": "AI正在改变世界...", "target": "输出文本"}),
        ]
        
        for op_type, op_data in operations:
            self.create_operation(session_id, op_type, op_data)
        
        # 4. 创建指纹
        import hashlib
        content_hashes = [
            hashlib.sha256("请写一篇关于AI的文章".encode()).hexdigest(),
            hashlib.sha256("AI正在改变世界...".encode()).hexdigest(),
        ]
        
        for content_hash in content_hashes:
            self.create_fingerprint(session_id, content_hash)
        
        print("\n" + "="*50)
        print("✅ 测试数据生成完成")
        print("="*50)
        
        # 5. 验证数据可见性
        print("\n" + "="*50)
        print("验证数据可见性")
        print("="*50)
        
        self.get_user_info()
        print()
        self.get_sessions()
        print()
        if session_id:
            self.get_operations(session_id)


if __name__ == "__main__":
    generator = DataGenerator()
    generator.generate_test_data()