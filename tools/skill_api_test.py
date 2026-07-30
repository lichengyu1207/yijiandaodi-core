"""
Skill平台API测试脚本
测试Skill配置API是否可正常访问
"""

import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000"

class SkillAPITester:
    def __init__(self):
        self.results = []

    def test_public_list(self):
        """测试公开Skill列表"""
        print("\n" + "="*60)
        print("📋 测试公开Skill列表")
        print("="*60)

        try:
            response = requests.get(
                f"{BASE_URL}/api/skill-config/public-list/",
                timeout=10
            )

            print(f"状态码: {response.status_code}")

            if response.status_code == 200:
                data = response.json()
                print(f"✅ 成功获取公开Skill列表")
                print(f"Skill数量: {data.get('count', 0)}")

                if data.get('results'):
                    print(f"示例Skill: {data['results'][0].get('name', 'N/A')}")

                self.results.append({
                    'test': 'public_list',
                    'status': 'PASS',
                    'status_code': response.status_code
                })
            else:
                print(f"❌ 请求失败: {response.text}")
                self.results.append({
                    'test': 'public_list',
                    'status': 'FAIL',
                    'status_code': response.status_code,
                    'error': response.text
                })

        except Exception as e:
            print(f"❌ 异常: {str(e)}")
            self.results.append({
                'test': 'public_list',
                'status': 'ERROR',
                'error': str(e)
            })

    def test_categories(self):
        """测试Skill分类"""
        print("\n" + "="*60)
        print("📂 测试Skill分类")
        print("="*60)

        try:
            response = requests.get(
                f"{BASE_URL}/api/skill-config/categories/",
                timeout=10
            )

            print(f"状态码: {response.status_code}")

            if response.status_code == 200:
                data = response.json()
                print(f"✅ 成功获取Skill分类")
                print(f"分类数量: {len(data)}")

                if data:
                    print(f"示例分类: {data[0]}")

                self.results.append({
                    'test': 'categories',
                    'status': 'PASS',
                    'status_code': response.status_code
                })
            else:
                print(f"❌ 请求失败: {response.text}")
                self.results.append({
                    'test': 'categories',
                    'status': 'FAIL',
                    'status_code': response.status_code,
                    'error': response.text
                })

        except Exception as e:
            print(f"❌ 异常: {str(e)}")
            self.results.append({
                'test': 'categories',
                'status': 'ERROR',
                'error': str(e)
            })

    def test_stats(self):
        """测试Skill统计"""
        print("\n" + "="*60)
        print("📊 测试Skill统计")
        print("="*60)

        try:
            response = requests.get(
                f"{BASE_URL}/api/skill-config/stats/",
                timeout=10
            )

            print(f"状态码: {response.status_code}")

            if response.status_code == 200:
                data = response.json()
                print(f"✅ 成功获取Skill统计")
                print(f"统计数据: {json.dumps(data, indent=2)}")

                self.results.append({
                    'test': 'stats',
                    'status': 'PASS',
                    'status_code': response.status_code
                })
            else:
                print(f"❌ 请求失败: {response.text}")
                self.results.append({
                    'test': 'stats',
                    'status': 'FAIL',
                    'status_code': response.status_code,
                    'error': response.text
                })

        except Exception as e:
            print(f"❌ 异常: {str(e)}")
            self.results.append({
                'test': 'stats',
                'status': 'ERROR',
                'error': str(e)
            })

    def test_public_search(self):
        """测试Skill搜索"""
        print("\n" + "="*60)
        print("🔍 测试Skill搜索")
        print("="*60)

        try:
            response = requests.get(
                f"{BASE_URL}/api/skill-config/public-search/",
                params={'keyword': 'test'},
                timeout=10
            )

            print(f"状态码: {response.status_code}")

            if response.status_code == 200:
                data = response.json()
                print(f"✅ 成功执行Skill搜索")
                print(f"搜索结果数量: {data.get('count', 0)}")

                self.results.append({
                    'test': 'public_search',
                    'status': 'PASS',
                    'status_code': response.status_code
                })
            else:
                print(f"❌ 请求失败: {response.text}")
                self.results.append({
                    'test': 'public_search',
                    'status': 'FAIL',
                    'status_code': response.status_code,
                    'error': response.text
                })

        except Exception as e:
            print(f"❌ 异常: {str(e)}")
            self.results.append({
                'test': 'public_search',
                'status': 'ERROR',
                'error': str(e)
            })

    def generate_report(self):
        """生成测试报告"""
        print("\n" + "="*60)
        print("📋 Skill API测试报告")
        print("="*60)
        print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"测试总数: {len(self.results)}")
        print(f"通过数量: {sum(1 for r in self.results if r['status'] == 'PASS')}")
        print(f"失败数量: {sum(1 for r in self.results if r['status'] == 'FAIL')}")
        print(f"错误数量: {sum(1 for r in self.results if r['status'] == 'ERROR')}")
        print("="*60)

        report = {
            'timestamp': datetime.now().isoformat(),
            'total_tests': len(self.results),
            'passed': sum(1 for r in self.results if r['status'] == 'PASS'),
            'failed': sum(1 for r in self.results if r['status'] == 'FAIL'),
            'errors': sum(1 for r in self.results if r['status'] == 'ERROR'),
            'results': self.results
        }

        # 保存报告
        filename = f"skill_api_test_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)

        print(f"\n报告已保存: {filename}")

        return report

    def run_all_tests(self):
        """运行所有测试"""
        print("\n" + "="*60)
        print("🚀 开始Skill API测试")
        print("="*60)

        self.test_public_list()
        self.test_categories()
        self.test_stats()
        self.test_public_search()

        self.generate_report()


if __name__ == "__main__":
    tester = SkillAPITester()
    tester.run_all_tests()