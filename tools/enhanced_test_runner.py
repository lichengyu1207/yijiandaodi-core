"""
增强版测试脚本
包含边缘场景测试和错误处理
"""

import requests
import json
import time
from datetime import datetime
import random

BASE_URL = "http://localhost:8000"

class EnhancedTestRunner:
    def __init__(self):
        self.token = None
        self.results = []
        
    def test_case(self, name, test_func):
        """执行单个测试用例"""
        print(f"\n🧪 测试: {name}")
        start_time = time.time()
        
        try:
            result = test_func()
            duration = time.time() - start_time
            
            test_result = {
                'name': name,
                'status': 'PASS' if result else 'FAIL',
                'duration': round(duration, 2),
                'error': None
            }
            
            print(f"✅ 通过 ({duration:.2f}s)")
            
        except Exception as e:
            duration = time.time() - start_time
            
            test_result = {
                'name': name,
                'status': 'ERROR',
                'duration': round(duration, 2),
                'error': str(e)
            }
            
            print(f"❌ 错误: {str(e)}")
        
        self.results.append(test_result)
        return test_result['status'] == 'PASS'
    
    def test_user_registration_edge_cases(self):
        """测试用户注册边缘场景"""
        
        # 测试1: 空用户名
        def test_empty_username():
            response = requests.post(
                f"{BASE_URL}/api/auth/register/",
                json={
                    "username": "",
                    "email": "test@test.com",
                    "password": "Test@123",
                    "confirm_password": "Test@123",
                    "privacy_agreed": True
                },
                timeout=5
            )
            return response.status_code in [400, 422]
        
        # 测试2: 短密码
        def test_short_password():
            response = requests.post(
                f"{BASE_URL}/api/auth/register/",
                json={
                    "username": f"test_{random.randint(1000,9999)}",
                    "email": "test@test.com",
                    "password": "123",
                    "confirm_password": "123",
                    "privacy_agreed": True
                },
                timeout=5
            )
            return response.status_code in [400, 422]
        
        # 测试3: 不匹配密码
        def test_mismatch_password():
            response = requests.post(
                f"{BASE_URL}/api/auth/register/",
                json={
                    "username": f"test_{random.randint(1000,9999)}",
                    "email": "test@test.com",
                    "password": "Test@123",
                    "confirm_password": "Test@456",
                    "privacy_agreed": True
                },
                timeout=5
            )
            return response.status_code in [400, 422]
        
        # 测试4: 未同意隐私政策
        def test_no_privacy_agreement():
            response = requests.post(
                f"{BASE_URL}/api/auth/register/",
                json={
                    "username": f"test_{random.randint(1000,9999)}",
                    "email": "test@test.com",
                    "password": "Test@123",
                    "confirm_password": "Test@123",
                    "privacy_agreed": False
                },
                timeout=5
            )
            return response.status_code in [400, 422]
        
        self.test_case("空用户名", test_empty_username)
        self.test_case("短密码", test_short_password)
        self.test_case("密码不匹配", test_mismatch_password)
        self.test_case("未同意隐私政策", test_no_privacy_agreement)
    
    def test_user_login_edge_cases(self):
        """测试用户登录边缘场景"""
        
        # 测试1: 错误密码
        def test_wrong_password():
            response = requests.post(
                f"{BASE_URL}/api/auth/login/",
                json={
                    "username": "admin",
                    "password": "wrongpassword123"
                },
                timeout=5
            )
            return response.status_code in [401, 403]
        
        # 测试2: 不存在用户
        def test_nonexistent_user():
            response = requests.post(
                f"{BASE_URL}/api/auth/login/",
                json={
                    "username": "nonexistent_user_xyz",
                    "password": "Test@123"
                },
                timeout=5
            )
            return response.status_code in [401, 403, 404]
        
        # 测试3: 空请求体
        def test_empty_body():
            response = requests.post(
                f"{BASE_URL}/api/auth/login/",
                json={},
                timeout=5
            )
            return response.status_code in [400, 422]
        
        self.test_case("错误密码", test_wrong_password)
        self.test_case("不存在用户", test_nonexistent_user)
        self.test_case("空请求体", test_empty_body)
    
    def test_api_timeout(self):
        """测试API超时"""
        
        def test_long_request():
            try:
                response = requests.get(
                    f"{BASE_URL}/api/health/",
                    timeout=0.001  # 极短超时
                )
                return False
            except requests.exceptions.Timeout:
                return True
        
        self.test_case("API超时处理", test_long_request)
    
    def test_retry_mechanism(self):
        """测试重试机制"""
        
        max_retries = 3
        
        def test_with_retry():
            for attempt in range(max_retries):
                try:
                    response = requests.get(
                        f"{BASE_URL}/api/health/",
                        timeout=5
                    )
                    if response.status_code == 200:
                        return True
                except Exception as e:
                    if attempt < max_retries - 1:
                        print(f"  重试 {attempt + 1}/{max_retries}...")
                        time.sleep(1)
                    else:
                        raise e
            return False
        
        self.test_case("重试机制", test_with_retry)
    
    def generate_report(self):
        """生成测试报告"""
        total = len(self.results)
        passed = sum(1 for r in self.results if r['status'] == 'PASS')
        failed = sum(1 for r in self.results if r['status'] == 'FAIL')
        errors = sum(1 for r in self.results if r['status'] == 'ERROR')
        
        report = {
            'timestamp': datetime.now().isoformat(),
            'summary': {
                'total': total,
                'passed': passed,
                'failed': failed,
                'errors': errors,
                'pass_rate': f"{(passed/total*100):.1f}%" if total > 0 else "0%"
            },
            'results': self.results
        }
        
        print("\n" + "="*60)
        print("📊 测试报告")
        print("="*60)
        print(f"总测试数: {total}")
        print(f"通过: {passed}")
        print(f"失败: {failed}")
        print(f"错误: {errors}")
        print(f"通过率: {report['summary']['pass_rate']}")
        print("="*60)
        
        return report
    
    def run_all_tests(self):
        """运行所有测试"""
        print("\n" + "="*60)
        print("🚀 开始增强版测试")
        print("="*60)
        
        self.test_user_registration_edge_cases()
        self.test_user_login_edge_cases()
        self.test_api_timeout()
        self.test_retry_mechanism()
        
        report = self.generate_report()
        
        # 保存报告
        filename = f"test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        print(f"\n报告已保存: {filename}")


if __name__ == "__main__":
    runner = EnhancedTestRunner()
    runner.run_all_tests()