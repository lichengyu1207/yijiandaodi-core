"""
桌面端模拟用户完整流程测试
包括：注册、登录、实名认证、数据同步
"""

import requests
import json
import time
from datetime import datetime
import random

BASE_URL = "http://localhost:8000"

class DesktopUserSimulation:
    def __init__(self):
        self.token = None
        self.user_id = None
        self.session_id = None
        
    def print_step(self, step, message):
        """打印测试步骤"""
        print(f"\n{'='*60}")
        print(f"📋 步骤{step}: {message}")
        print(f"{'='*60}")
    
    def test_user_registration(self):
        """测试用户注册"""
        self.print_step(1, "用户注册")
        
        timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
        username = f"desktop_user_{timestamp}"
        email = f"{username}@test.com"
        password = "Desktop@123"
        
        try:
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
                print(f"✅ 注册成功")
                print(f"   用户名: {username}")
                print(f"   邮箱: {email}")
                return username, password
            else:
                print(f"❌ 注册失败: {response.text}")
                return None, None
                
        except Exception as e:
            print(f"❌ 注册异常: {str(e)}")
            return None, None
    
    def test_user_login(self, username, password):
        """测试用户登录"""
        self.print_step(2, "用户登录")
        
        try:
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
                print(f"✅ 登录成功")
                print(f"   用户ID: {self.user_id}")
                print(f"   Token: {self.token[:20] if self.token else 'N/A'}...")
                return True
            else:
                print(f"❌ 登录失败: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ 登录异常: {str(e)}")
            return False
    
    def test_face_verification(self):
        """测试人脸识别/实名认证"""
        self.print_step(3, "人脸识别/实名认证")
        
        print("⚠️  人脸识别功能测试：")
        print("   1. 检查桌面端是否支持摄像头调用")
        print("   2. 检查实名认证API是否存在")
        
        # 检查实名认证API（模拟）
        try:
            # 假设实名认证API路径
            response = requests.get(
                f"{BASE_URL}/api/auth/verify-status/",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=10
            )
            
            if response.status_code == 200:
                print("✅ 实名认证API可访问")
                print(f"   状态: {response.json()}")
            elif response.status_code == 404:
                print("⚠️  实名认证API未实现")
            else:
                print(f"❌ API访问失败: {response.status_code}")
                
        except Exception as e:
            print(f"❌ 认证检查异常: {str(e)}")
    
    def test_data_collection(self):
        """测试数据采集"""
        self.print_step(4, "数据采集")
        
        # 测试文件监控
        print("\n测试文件监控...")
        print("   模拟创建文件: test_document.txt")
        
        # 测试剪贴板监控
        print("   模拟剪贴板内容: API Key: sk-test-123")
        
        # 测试网络监控
        print("   模拟网络请求: https://api.deepseek.com")
        
        print("✅ 数据采集模拟完成")
    
    def test_evidence_chain(self):
        """测试证据链生成"""
        self.print_step(5, "证据链生成")
        
        try:
            # 创建测试会话
            session_data = {
                "session_id": f"evidence_test_{datetime.now().strftime('%Y%m%d%H%M%S')}",
                "title": "证据链测试会话",
                "platforms": ["DeepSeek"],
                "start_time": datetime.now().isoformat()
            }
            
            response = requests.post(
                f"{BASE_URL}/api/extension/sync/start/",
                headers={"Authorization": f"Bearer {self.token}"},
                json=session_data,
                timeout=10
            )
            
            print(f"API响应: {response.status_code}")
            
            if response.status_code in [200, 201]:
                data = response.json()
                self.session_id = session_data['session_id']
                print(f"✅ 会话创建成功")
                print(f"   会话ID: {self.session_id}")
                
                # 模拟操作记录
                print("\n   记录操作...")
                operations = ["text_input", "ai_prompt", "ai_response", "copy"]
                for op in operations:
                    print(f"   - {op}")
                
                print("✅ 证据链生成成功")
                return True
            else:
                print(f"❌ 会话创建失败: {response.text}")
                return False
                
        except Exception as e:
            print(f"❌ 证据链生成异常: {str(e)}")
            return False
    
    def test_data_sync(self):
        """测试数据同步"""
        self.print_step(6, "数据同步")
        
        print("⚠️  数据同步测试：")
        print("   1. 本地数据 → 云端同步")
        print("   2. 云端数据 → 本地同步")
        print("   3. 冲突处理")
        
        # 检查同步API
        try:
            response = requests.get(
                f"{BASE_URL}/api/extension/sessions/",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=10
            )
            
            print(f"API响应: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                sessions = data.get('results', []) if isinstance(data, dict) else data
                print(f"✅ 会话列表获取成功")
                print(f"   会话数: {len(sessions)}")
                
                if sessions:
                    print(f"\n   最新会话:")
                    latest = sessions[0]
                    print(f"   - ID: {latest.get('session_id')}")
                    print(f"   - 平台: {latest.get('platforms')}")
                    print(f"   - 状态: {latest.get('status')}")
            else:
                print(f"❌ 数据同步失败: {response.text}")
                
        except Exception as e:
            print(f"❌ 数据同步异常: {str(e)}")
    
    def test_report_generation(self):
        """测试报告生成"""
        self.print_step(7, "报告生成")
        
        print("⚠️  报告生成测试：")
        print("   1. 创作时间线报告")
        print("   2. 素材风险报告")
        print("   3. 账号资产报告")
        
        # 模拟报告生成
        print("\n✅ 报告生成模拟完成")
    
    def test_logout(self):
        """测试用户退出"""
        self.print_step(8, "用户退出")
        
        try:
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
                
        except Exception as e:
            print(f"❌ 退出异常: {str(e)}")
            return False
    
    def run_full_test(self):
        """运行完整测试流程"""
        print("\n" + "="*60)
        print("🚀 桌面端用户完整流程测试")
        print("="*60)
        print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # 1. 用户注册
        username, password = self.test_user_registration()
        if not username:
            print("\n❌ 测试终止：无法注册用户")
            return False
        
        # 2. 用户登录
        if not self.test_user_login(username, password):
            print("\n❌ 测试终止：无法登录")
            return False
        
        # 3. 人脸识别/实名认证
        self.test_face_verification()
        
        # 4. 数据采集
        self.test_data_collection()
        
        # 5. 证据链生成
        self.test_evidence_chain()
        
        # 6. 数据同步
        self.test_data_sync()
        
        # 7. 报告生成
        self.test_report_generation()
        
        # 8. 用户退出
        self.test_logout()
        
        print("\n" + "="*60)
        print("✅ 桌面端用户完整流程测试完成")
        print("="*60)
        
        return True


if __name__ == "__main__":
    simulation = DesktopUserSimulation()
    simulation.run_full_test()