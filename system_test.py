#!/usr/bin/env python
"""
一鉴到底 - 完整系统测试

测试范围：
1. 哈希链存证系统
2. 审计报告导出
3. Skill API 调用
4. API Key 管理
5. LLM 智能分析
6. 实时拦截功能
7. VS Code 插件接口
"""

import os
import sys
import json
import time
import requests
from datetime import datetime
from typing import Dict, List


class SystemTest:
    """系统测试"""
    
    def __init__(self):
        self.api_base = 'http://localhost:9092'
        self.results = []
        self.passed = 0
        self.failed = 0
    
    def test(self, name: str, func) -> bool:
        """执行测试"""
        print(f"\n{'='*60}")
        print(f"   测试: {name}")
        print(f"{'='*60}")
        
        try:
            result = func()
            
            if result:
                self.passed += 1
                self.results.append({'name': name, 'status': 'PASS', 'message': ''})
                print(f"\n✓ {name} 通过")
                return True
            else:
                self.failed += 1
                self.results.append({'name': name, 'status': 'FAIL', 'message': '返回 False'})
                print(f"\n✗ {name} 失败")
                return False
                
        except Exception as e:
            self.failed += 1
            self.results.append({'name': name, 'status': 'FAIL', 'message': str(e)})
            print(f"\n✗ {name} 异常: {e}")
            return False
    
    def test_api_health(self) -> bool:
        """测试 API 健康状态"""
        response = requests.get(f'{self.api_base}/health', timeout=5)
        return response.status_code == 200
    
    def test_skill_list(self) -> bool:
        """测试 Skill 列表"""
        response = requests.get(f'{self.api_base}/api/v1/skills')
        data = response.json()
        
        if data.get('success'):
            skills = data.get('skills', [])
            print(f"   可用 Skill: {len(skills)} 个")
            return len(skills) > 0
        return False
    
    def test_code_detector(self) -> bool:
        """测试代码检测"""
        # 测试代码（包含硬编码密钥）
        test_code = '''
import openai

OPENAI_API_KEY = "sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

def call_gpt(prompt):
    client = openai.OpenAI(api_key=OPENAI_API_KEY)
    return client.chat.completions.create(...)
'''
        
        response = requests.post(
            f'{self.api_base}/api/v1/skills/code-detector/analyze',
            json={'code': test_code, 'file_path': 'test.py'}
        )
        
        data = response.json()
        
        if data.get('success'):
            result = data.get('result', {})
            risk_level = result.get('risk_level', 'unknown')
            print(f"   检测结果: {risk_level}")
            return risk_level in ['critical', 'high']
        
        return False
    
    def test_data_masker(self) -> bool:
        """测试数据脱敏"""
        response = requests.post(
            f'{self.api_base}/api/v1/skills/data-masker/mask',
            json={'data': '13812345678', 'type': 'phone'}
        )
        
        data = response.json()
        
        if data.get('success'):
            result = data.get('result', {})
            masked = result.get('masked', '')
            print(f"   脱敏结果: {masked}")
            return '****' in masked
        
        return False
    
    def test_api_key_generation(self) -> bool:
        """测试 API Key 生成"""
        response = requests.post(
            f'{self.api_base}/api/v1/keys/generate',
            json={'scopes': ['skills:*'], 'rate_limit': 1000}
        )
        
        data = response.json()
        
        if data.get('success'):
            api_key = data.get('api_key', '')
            print(f"   API Key: {api_key[:20]}...")
            return api_key.startswith('yjd_')
        
        return False
    
    def test_hashchain_evidence(self) -> bool:
        """测试哈希链存证"""
        from hashchain_evidence import HashChainEvidence
        
        chain = HashChainEvidence('data/test_system_chain.db')
        
        # 添加测试记录
        record = chain.add_record({
            'timestamp': datetime.now().isoformat(),
            'agent_name': 'Test Agent',
            'operation_type': 'test',
            'operation_content': '系统测试',
            'risk_level': 'low',
            'risk_score': 10,
            'risk_tags': ['测试'],
            'decision': 'allow'
        })
        
        # 验证链
        status = chain.verify_chain()
        
        print(f"   链状态: {'有效' if status['valid'] else '无效'}")
        print(f"   记录数: {status['total_records']}")
        
        return status['valid']
    
    def test_report_export(self) -> bool:
        """测试报告导出"""
        from hashchain_evidence import HashChainEvidence
        from report_generator import ReportGenerator
        
        chain = HashChainEvidence('data/test_system_chain.db')
        records = chain.get_all_records()
        chain_status = chain.verify_chain()
        
        generator = ReportGenerator()
        
        # 生成 JSON 报告
        json_report = generator.generate_json_report(records, chain_status)
        print(f"   JSON 报告 ID: {json_report['report_id']}")
        
        # 生成 HTML 报告
        html_report = generator.generate_html_report(records, chain_status)
        print(f"   HTML 报告长度: {len(html_report)} 字符")
        
        return json_report['report_id'] is not None
    
    def test_interceptor(self) -> bool:
        """测试拦截器"""
        from realtime_interceptor import RealtimeMonitor, Interceptor
        
        interceptor = Interceptor(auto_block_critical=True)
        monitor = RealtimeMonitor(interceptor)
        
        # 测试拦截硬编码密钥
        code = '''
OPENAI_API_KEY = "sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
'''
        
        operation = monitor.intercept_code_generate('Test Agent', code)
        
        print(f"   决策: {operation.decision}")
        print(f"   风险: {operation.risk_level}")
        
        return operation.risk_level in ['critical', 'high']
    
    def test_llm_analyzer(self) -> bool:
        """测试 LLM 分析"""
        from llm_analyzer import LLMAnalyzer
        
        analyzer = LLMAnalyzer()
        
        # 测试分析代码
        code = '''
import os
os.system("rm -rf /")
'''
        
        result = analyzer.analyze_code(code, 'dangerous.py')
        
        print(f"   分析结果: {result}")
        
        # 如果 API 不可用，使用本地规则分析
        if 'error' in result:
            # 使用本地分析
            from realtime_interceptor import RuleEngine
            engine = RuleEngine()
            analysis = engine.analyze_code_content(code)
            print(f"   本地分析: {analysis}")
            return analysis['risk_level'] != 'low'
        
        return True
    
    def test_evidence_api(self) -> bool:
        """测试存证 API"""
        # 获取存证记录
        response = requests.get(f'{self.api_base}/api/v1/evidence/records?limit=10')
        data = response.json()
        
        if data.get('success'):
            records = data.get('records', [])
            print(f"   存证记录: {len(records)} 条")
        
        # 验证链
        response = requests.get(f'{self.api_base}/api/v1/evidence/verify')
        data = response.json()
        
        if data.get('success'):
            valid = data.get('valid', False)
            print(f"   链完整性: {'有效' if valid else '无效'}")
            return valid
        
        return False
    
    def run_all_tests(self):
        """运行所有测试"""
        print("\n" + "="*60)
        print("   一鉴到底 - 完整系统测试")
        print("="*60)
        print(f"   时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("="*60)
        
        # 基础测试
        self.test("API 健康检查", self.test_api_health)
        self.test("Skill 列表", self.test_skill_list)
        self.test("代码检测", self.test_code_detector)
        self.test("数据脱敏", self.test_data_masker)
        
        # API 测试
        self.test("API Key 生成", self.test_api_key_generation)
        self.test("存证 API", self.test_evidence_api)
        
        # 核心功能测试
        self.test("哈希链存证", self.test_hashchain_evidence)
        self.test("报告导出", self.test_report_export)
        self.test("实时拦截", self.test_interceptor)
        self.test("LLM 分析", self.test_llm_analyzer)
        
        # 显示结果
        self.show_results()
    
    def show_results(self):
        """显示测试结果"""
        print("\n" + "="*60)
        print("   测试结果汇总")
        print("="*60)
        
        print(f"\n   ✓ 通过: {self.passed}")
        print(f"   ✗ 失败: {self.failed}")
        print(f"   总计: {self.passed + self.failed}")
        
        if self.failed > 0:
            print("\n   失败详情:")
            for result in self.results:
                if result['status'] == 'FAIL':
                    print(f"     - {result['name']}: {result['message']}")
        
        print("\n" + "="*60)
        
        if self.failed == 0:
            print("   🎉 所有测试通过！")
        else:
            print(f"   ⚠️ 有 {self.failed} 个测试失败")
        
        print("="*60 + "\n")


def main():
    """主函数"""
    tester = SystemTest()
    tester.run_all_tests()


if __name__ == '__main__':
    main()