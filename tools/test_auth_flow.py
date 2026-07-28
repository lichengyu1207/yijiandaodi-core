"""
官网和桌面端登录注册测试脚本
测试流程：
1. 用户注册
2. 用户登录
3. Token验证
4. 用户信息获取
5. 登出
"""

import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000"
USERNAME = f"test_user_{datetime.now().strftime('%Y%m%d%H%M%S')}"
EMAIL = f"{USERNAME}@test.com"
PASSWORD = "Test@123456"


class AuthFlowTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.token = None
        self.refresh_token = None
        self.results = []
        
    def log(self, step, success, message=""):
        """记录测试结果"""
        result = {
            "step": step,
            "success": success,
            "message": message,
            "timestamp": datetime.now().isoformat()
        }
        self.results.append(result)
        status = "✅" if success else "❌"
        print(f"{status} {step}: {message}")
        
    def test_register(self):
        """测试注册"""
        print("\n=== 步骤1：用户注册 ===")
        try:
            response = requests.post(
                f"{self.base_url}/api/auth/register/",
                json={
                    "username": USERNAME,
                    "email": EMAIL,
                    "password": PASSWORD,
                    "password2": PASSWORD
                },
                timeout=5
            )
            
            if response.status_code in [200, 201]:
                data = response.json()
                self.log("注册", True, f"用户 {USERNAME} 注册成功")
                return True
            else:
                error = response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text
                self.log("注册", False, f"注册失败: {error}")
                return False
                
        except Exception as e:
            self.log("注册", False, f"请求异常: {str(e)}")
            return False
    
    def test_login(self):
        """测试登录"""
        print("\n=== 步骤2：用户登录 ===")
        try:
            response = requests.post(
                f"{self.base_url}/api/auth/login/",
                json={
                    "username": USERNAME,
                    "password": PASSWORD
                },
                timeout=5
            )
            
            if response.status_code == 200:
                data = response.json()
                self.token = data.get('access')
                self.refresh_token = data.get('refresh')
                self.log("登录", True, f"登录成功，获取Token: {self.token[:20]}...")
                return True
            else:
                error = response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text
                self.log("登录", False, f"登录失败: {error}")
                return False
                
        except Exception as e:
            self.log("登录", False, f"请求异常: {str(e)}")
            return False
    
    def test_get_user_info(self):
        """测试获取用户信息"""
        print("\n=== 步骤3：获取用户信息 ===")
        if not self.token:
            self.log("获取用户信息", False, "未登录，无Token")
            return False
            
        try:
            response = requests.get(
                f"{self.base_url}/api/auth/user/",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=5
            )
            
            if response.status_code == 200:
                data = response.json()
                self.log("获取用户信息", True, f"用户: {data.get('username')}, 邮箱: {data.get('email')}")
                return True
            else:
                error = response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text
                self.log("获取用户信息", False, f"获取失败: {error}")
                return False
                
        except Exception as e:
            self.log("获取用户信息", False, f"请求异常: {str(e)}")
            return False
    
    def test_logout(self):
        """测试登出"""
        print("\n=== 步骤4：用户登出 ===")
        if not self.refresh_token:
            self.log("登出", False, "无refresh_token")
            return False
            
        try:
            response = requests.post(
                f"{self.base_url}/api/auth/logout/",
                json={"refresh": self.refresh_token},
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=5
            )
            
            if response.status_code == 200:
                self.log("登出", True, "登出成功，Token已失效")
                return True
            else:
                error = response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text
                self.log("登出", False, f"登出失败: {error}")
                return False
                
        except Exception as e:
            self.log("登出", False, f"请求异常: {str(e)}")
            return False
    
    def test_token_invalid(self):
        """测试Token失效验证"""
        print("\n=== 步骤5：验证Token失效 ===")
        try:
            response = requests.get(
                f"{self.base_url}/api/auth/user/",
                headers={"Authorization": f"Bearer {self.token}"},
                timeout=5
            )
            
            if response.status_code == 401:
                self.log("Token失效验证", True, "Token已失效，返回401")
                return True
            else:
                self.log("Token失效验证", False, f"Token未失效，返回{response.status_code}")
                return False
                
        except Exception as e:
            self.log("Token失效验证", False, f"请求异常: {str(e)}")
            return False
    
    def run_all_tests(self):
        """运行所有测试"""
        print("\n" + "="*50)
        print("开始测试官网和桌面端登录注册流程")
        print("="*50)
        
        results = []
        
        # 执行测试
        results.append(("注册", self.test_register()))
        results.append(("登录", self.test_login()))
        results.append(("获取用户信息", self.test_get_user_info()))
        results.append(("登出", self.test_logout()))
        results.append(("Token失效验证", self.test_token_invalid()))
        
        # 统计结果
        print("\n" + "="*50)
        print("测试结果汇总")
        print("="*50)
        
        passed = sum(1 for _, success in results if success)
        total = len(results)
        
        for step, success in results:
            status = "✅ 通过" if success else "❌ 失败"
            print(f"{status} - {step}")
        
        print(f"\n总计: {passed}/{total} 通过")
        
        return {
            "passed": passed,
            "total": total,
            "success_rate": f"{(passed/total*100):.1f}%",
            "results": self.results
        }


if __name__ == "__main__":
    print("一鉴到底 - 登录注册测试")
    print("="*50)
    print(f"测试地址: {BASE_URL}")
    print(f"测试用户: {USERNAME}")
    print("="*50)
    
    tester = AuthFlowTester()
    result = tester.run_all_tests()
    
    print("\n测试完成！")
    
    # 保存结果
    with open("auth_test_result.json", "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)
    
    print(f"详细结果已保存到 auth_test_result.json")