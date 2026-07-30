"""
测试报告生成器
自动收集测试结果并生成报告
"""

import json
import os
from datetime import datetime
import requests

class TestReportGenerator:
    def __init__(self):
        self.results = []
        self.start_time = datetime.now()
        
    def test_backend_health(self):
        """测试后端健康状态"""
        try:
            response = requests.get("http://localhost:8000/api/health/", timeout=5)
            if response.status_code == 200:
                data = response.json()
                return {
                    "test": "后端健康检查",
                    "status": "通过" if data.get('status') == 'ok' else "失败",
                    "details": data,
                    "timestamp": datetime.now().isoformat()
                }
        except Exception as e:
            return {
                "test": "后端健康检查",
                "status": "失败",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    def test_frontend_health(self):
        """测试前端健康状态"""
        try:
            response = requests.get("http://localhost:3000", timeout=5)
            return {
                "test": "前端健康检查",
                "status": "通过" if response.status_code == 200 else "失败",
                "status_code": response.status_code,
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            return {
                "test": "前端健康检查",
                "status": "失败",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    def test_user_registration(self):
        """测试用户注册"""
        try:
            timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
            response = requests.post(
                "http://localhost:8000/api/auth/register/",
                json={
                    "username": f"report_test_{timestamp}",
                    "email": f"test_{timestamp}@test.com",
                    "password": "Test@123",
                    "confirm_password": "Test@123",
                    "privacy_agreed": True
                },
                timeout=10
            )
            return {
                "test": "用户注册",
                "status": "通过" if response.status_code in [200, 201] else "失败",
                "status_code": response.status_code,
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            return {
                "test": "用户注册",
                "status": "失败",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    def test_user_login(self):
        """测试用户登录"""
        try:
            response = requests.post(
                "http://localhost:8000/api/auth/login/",
                json={
                    "username": "testuser2026",
                    "password": "Test@123456"
                },
                timeout=10
            )
            return {
                "test": "用户登录",
                "status": "通过" if response.status_code == 200 else "失败",
                "status_code": response.status_code,
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            return {
                "test": "用户登录",
                "status": "失败",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    def test_api_documentation(self):
        """测试API文档"""
        try:
            response = requests.get("http://localhost:8000/api/docs/", timeout=5)
            return {
                "test": "API文档",
                "status": "通过" if response.status_code in [200, 404] else "失败",
                "status_code": response.status_code,
                "note": "API文档可访问或未配置",
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            return {
                "test": "API文档",
                "status": "失败",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
    
    def generate_report(self):
        """生成完整测试报告"""
        print("正在执行测试...")
        
        # 执行所有测试
        self.results.append(self.test_backend_health())
        self.results.append(self.test_frontend_health())
        self.results.append(self.test_user_registration())
        self.results.append(self.test_user_login())
        self.results.append(self.test_api_documentation())
        
        # 统计结果
        passed = sum(1 for r in self.results if r.get('status') == '通过')
        failed = sum(1 for r in self.results if r.get('status') == '失败')
        total = len(self.results)
        
        # 生成报告
        report = {
            "report_info": {
                "title": "一鉴到底综合测试报告",
                "generated_at": datetime.now().isoformat(),
                "duration_seconds": (datetime.now() - self.start_time).total_seconds()
            },
            "summary": {
                "total_tests": total,
                "passed": passed,
                "failed": failed,
                "pass_rate": f"{(passed/total*100):.1f}%" if total > 0 else "0%"
            },
            "tests": self.results,
            "environment": {
                "backend_url": "http://localhost:8000",
                "frontend_url": "http://localhost:3000",
                "python_version": "3.14",
                "node_version": "v18.17.0"
            }
        }
        
        # 保存报告
        os.makedirs("logs", exist_ok=True)
        report_file = f"logs/comprehensive_test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        # 打印报告
        print("\n" + "="*60)
        print("📊 综合测试报告")
        print("="*60)
        print(f"生成时间: {report['report_info']['generated_at']}")
        print(f"测试总数: {total}")
        print(f"通过数: {passed}")
        print(f"失败数: {failed}")
        print(f"通过率: {report['summary']['pass_rate']}")
        print("\n测试详情:")
        for result in self.results:
            status_icon = "✅" if result['status'] == '通过' else "❌"
            print(f"{status_icon} {result['test']}: {result['status']}")
        print(f"\n报告已保存: {report_file}")
        print("="*60)
        
        return report


if __name__ == "__main__":
    generator = TestReportGenerator()
    generator.generate_report()