"""
模拟用户真实使用行为
完整端到端测试流程
"""

import requests
import json
import time
import hashlib
from datetime import datetime

BASE_URL = "http://localhost:8000"

class RealUserSimulator:
    def __init__(self):
        self.token = None
        self.session_id = None
        self.user_id = None
        
    def step1_register(self):
        """步骤1：用户注册"""
        print("\n" + "="*60)
        print("📝 步骤1：新用户注册")
        print("="*60)
        
        username = f"real_user_{datetime.now().strftime('%H%M%S')}"
        email = f"{username}@test.com"
        password = "RealUser@123"
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register/",
            json={
                "username": username,
                "email": email,
                "password": password,
                "confirm_password": password,
                "privacy_agreed": True
            },
            timeout=10
        )
        
        print(f"API响应: {response.status_code}")
        
        if response.status_code in [200, 201]:
            data = response.json()
            print(f"✅ 注册成功: {username}")
            print(f"   用户ID: {data.get('user', {}).get('id')}")
            return username, password
        else:
            print(f"❌ 注册失败: {response.text}")
            # 尝试登录已有用户
            print("\n尝试登录已有用户...")
            return "testuser2026", "Test@123456"
    
    def step2_login(self, username, password):
        """步骤2：用户登录"""
        print("\n" + "="*60)
        print("🔐 步骤2：用户登录")
        print("="*60)
        
        response = requests.post(
            f"{BASE_URL}/api/auth/login/",
            json={
                "username": username,
                "password": password
            },
            timeout=10
        )
        
        print(f"API响应: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            self.token = data.get('access') or data.get('token') or data.get('data', {}).get('token')
            self.user_id = data.get('user', {}).get('id') or data.get('data', {}).get('user', {}).get('id')
            print(f"✅ 登录成功: {username}")
            print(f"   Token: {self.token[:20] if self.token else 'N/A'}...")
            print(f"   用户ID: {self.user_id}")
            return True
        else:
            print(f"❌ 登录失败: {response.text}")
            return False
    
    def step3_view_profile(self):
        """步骤3：查看个人信息"""
        print("\n" + "="*60)
        print("👤 步骤3：查看个人信息")
        print("="*60)

        # 使用正确的API路径
        response = requests.get(
            f"{BASE_URL}/api/auth/userinfo/",
            headers={"Authorization": f"Bearer {self.token}"},
            timeout=10
        )

        print(f"API响应: {response.status_code}")

        if response.status_code == 200:
            data = response.json()
            print(f"✅ 用户信息获取成功")
            print(f"   用户名: {data.get('username')}")
            print(f"   邮箱: {data.get('email')}")
            print(f"   角色: {data.get('role')}")
            return data
        else:
            print(f"❌ 获取用户信息失败: {response.text}")
            return None
    
    def step4_create_session(self):
        """步骤4：开始创作会话"""
        print("\n" + "="*60)
        print("🎬 步骤4：开始创作会话")
        print("="*60)

        # 模拟用户在DeepSeek平台创作
        session_data = {
            "session_id": f"real_session_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "title": "AI辅助文章创作",
            "platforms": ["DeepSeek"],
            "start_time": datetime.now().isoformat()
        }

        # 使用正确的API路径和数据格式
        response = requests.post(
            f"{BASE_URL}/api/extension/sync/start/",
            headers={"Authorization": f"Bearer {self.token}"},
            json=session_data,  # 直接传session_data，不包装在session字段中
            timeout=10
        )

        print(f"API响应: {response.status_code}")

        if response.status_code in [200, 201]:
            data = response.json()
            self.session_id = data.get('data', {}).get('session', {}).get('session_id') or data.get('session', {}).get('session_id') or session_data['session_id']
            print(f"✅ 会话创建成功")
            print(f"   会话ID: {self.session_id}")
            print(f"   平台: {session_data['platforms']}")
            return True
        else:
            print(f"❌ 会话创建失败: {response.text}")
            return False
    
    def step5_record_operations(self):
        """步骤5：记录创作操作"""
        print("\n" + "="*60)
        print("✍️ 步骤5：记录创作操作")
        print("="*60)
        
        operations = [
            {
                "operation_type": "text_input",
                "content": "请写一篇关于人工智能未来发展的文章",
                "selector": "textarea#prompt-input"
            },
            {
                "operation_type": "click",
                "content": "点击发送按钮",
                "selector": "button[type='submit']"
            },
            {
                "operation_type": "ai_response",
                "content": "人工智能正在以前所未有的速度改变着我们的世界...",
                "selector": "div.output-container"
            },
            {
                "operation_type": "copy",
                "content": "复制AI生成的文章内容",
                "selector": "button.copy-btn"
            },
            {
                "operation_type": "paste",
                "content": "粘贴到编辑器",
                "selector": "div.editor"
            }
        ]
        
        success_count = 0
        for i, op in enumerate(operations):
            # 模拟延迟
            time.sleep(0.5)
            
            operation_data = {
                "session": self.session_id,
                "operation_type": op["operation_type"],
                "operation_id": f"op_{i+1}_{datetime.now().strftime('%H%M%S')}",
                "timestamp": datetime.now().isoformat(),
                "platform_name": "DeepSeek",
                "platform_type": "ai_chat",
                "content_preview": op["content"][:50],
                "content_hash": hashlib.sha256(op["content"].encode()).hexdigest()
            }
            
            response = requests.post(
                f"{BASE_URL}/api/browser/operations/",
                headers={"Authorization": f"Bearer {self.token}"},
                json=operation_data,
                timeout=10
            )
            
            if response.status_code in [200, 201]:
                success_count += 1
                print(f"✅ 操作{i+1}记录成功: {op['operation_type']}")
            else:
                print(f"❌ 操作{i+1}记录失败: {response.text}")
        
        print(f"\n总计: {success_count}/{len(operations)} 操作记录成功")
        return success_count == len(operations)
    
    def step6_generate_fingerprints(self):
        """步骤6：生成指纹"""
        print("\n" + "="*60)
        print("🔒 步骤6：生成内容指纹")
        print("="*60)
        
        contents = [
            "请写一篇关于人工智能未来发展的文章",
            "人工智能正在以前所未有的速度改变着我们的世界..."
        ]
        
        success_count = 0
        prev_hash = "0" * 64
        
        for i, content in enumerate(contents):
            content_hash = hashlib.sha256(content.encode()).hexdigest()
            
            fingerprint_data = {
                "session": self.session_id,
                "hash": content_hash,
                "prev_hash": prev_hash,
                "operation_id": f"op_{i+1}_fingerprint",
                "timestamp": datetime.now().isoformat()
            }
            
            response = requests.post(
                f"{BASE_URL}/api/browser/fingerprints/",
                headers={"Authorization": f"Bearer {self.token}"},
                json=fingerprint_data,
                timeout=10
            )
            
            if response.status_code in [200, 201]:
                success_count += 1
                prev_hash = content_hash
                print(f"✅ 指纹{i+1}生成成功: {content_hash[:20]}...")
            else:
                print(f"❌ 指纹{i+1}生成失败: {response.text}")
        
        print(f"\n总计: {success_count}/{len(contents)} 指纹生成成功")
        return success_count == len(contents)
    
    def step7_view_sessions(self):
        """步骤7：查看会话列表"""
        print("\n" + "="*60)
        print("📋 步骤7：查看会话历史")
        print("="*60)
        
        response = requests.get(
            f"{BASE_URL}/api/browser/sessions/",
            headers={"Authorization": f"Bearer {self.token}"},
            timeout=10
        )
        
        print(f"API响应: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            sessions = data.get('results', []) if isinstance(data, dict) else data
            print(f"✅ 会话列表获取成功")
            print(f"   总会话数: {len(sessions)}")
            
            for session in sessions[:3]:
                print(f"\n   会话ID: {session.get('session_id')}")
                print(f"   标题: {session.get('title')}")
                print(f"   平台: {session.get('platforms')}")
                print(f"   状态: {session.get('status')}")
            
            return True
        else:
            print(f"❌ 获取会话列表失败: {response.text}")
            return False
    
    def step8_export_report(self):
        """步骤8：导出报告"""
        print("\n" + "="*60)
        print("📊 步骤8：导出证据链报告")
        print("="*60)
        
        response = requests.get(
            f"{BASE_URL}/api/browser/sessions/{self.session_id}/export/",
            headers={"Authorization": f"Bearer {self.token}"},
            timeout=30
        )
        
        print(f"API响应: {response.status_code}")
        
        if response.status_code == 200:
            # 保存报告
            filename = f"real_user_report_{datetime.now().strftime('%Y%m%d%H%M%S')}.html"
            with open(filename, 'wb') as f:
                f.write(response.content)
            print(f"✅ 报告导出成功")
            print(f"   文件名: {filename}")
            print(f"   大小: {len(response.content)} bytes")
            return True
        else:
            print(f"❌ 报告导出失败: {response.text}")
            return False
    
    def step9_logout(self):
        """步骤9：用户退出"""
        print("\n" + "="*60)
        print("🚪 步骤9：用户退出登录")
        print("="*60)
        
        response = requests.post(
            f"{BASE_URL}/api/auth/logout/",
            headers={"Authorization": f"Bearer {self.token}"},
            timeout=10
        )
        
        print(f"API响应: {response.status_code}")
        
        if response.status_code in [200, 204]:
            print(f"✅ 退出成功")
            return True
        else:
            print(f"❌ 退出失败: {response.text}")
            return False
    
    def run_full_test(self):
        """运行完整测试流程"""
        print("\n" + "="*60)
        print("🚀 开始模拟真实用户行为测试")
        print("="*60)
        
        # 步骤1：注册
        username, password = self.step1_register()
        
        # 步骤2：登录
        if not self.step2_login(username, password):
            print("\n❌ 测试终止：无法登录")
            return False
        
        # 步骤3：查看个人信息
        self.step3_view_profile()
        
        # 步骤4：创建会话
        if not self.step4_create_session():
            print("\n❌ 测试终止：无法创建会话")
            return False
        
        # 步骤5：记录操作
        self.step5_record_operations()
        
        # 步骤6：生成指纹
        self.step6_generate_fingerprints()
        
        # 步骤7：查看会话
        self.step7_view_sessions()
        
        # 步骤8：导出报告
        self.step8_export_report()
        
        # 步骤9：退出
        self.step9_logout()
        
        print("\n" + "="*60)
        print("✅ 真实用户行为测试完成")
        print("="*60)
        
        return True


if __name__ == "__main__":
    simulator = RealUserSimulator()
    simulator.run_full_test()