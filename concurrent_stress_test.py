#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
浏览器插件同步 API 并发压力测试脚本

测试目标：
- 开始录制同步 API: POST /api/auth/extension/sync/start/
- 操作批量同步 API: POST /api/auth/extension/sync/operation/
- 停止录制同步 API: POST /api/auth/extension/sync/end/
"""

import requests
import time
import json
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from collections import defaultdict
import statistics
import sys


class StressTestConfig:
    """测试配置"""
    def __init__(self):
        self.base_url = "http://localhost:8000"
        self.username = "admin"
        self.password = "Admin@2026"
        self.concurrent_users = 10  # 并发用户数
        self.operations_per_user = 5  # 每个用户的操作数
        self.timeout = 30  # 请求超时时间（秒）
        self.shared_token = None  # 共享token，避免频繁登录


class TestMetrics:
    """测试指标收集器"""
    def __init__(self):
        self.lock = threading.Lock()
        self.response_times = defaultdict(list)  # 按API类型存储响应时间
        self.success_count = defaultdict(int)  # 按API类型存储成功次数
        self.error_count = defaultdict(int)  # 按API类型存储失败次数
        self.errors = defaultdict(list)  # 按API类型存储错误详情
        self.start_times = {}  # 记录每个用户的开始时间
        self.end_times = {}  # 记录每个用户的结束时间
    
    def record_request(self, api_type, response_time, success, error_msg=None):
        """记录请求结果"""
        with self.lock:
            self.response_times[api_type].append(response_time)
            if success:
                self.success_count[api_type] += 1
            else:
                self.error_count[api_type] += 1
                if error_msg:
                    self.errors[api_type].append(error_msg)
    
    def get_stats(self, api_type):
        """获取指定API类型的统计数据"""
        with self.lock:
            times = self.response_times[api_type]
            if not times:
                return None
            
            return {
                'total_requests': len(times),
                'success_count': self.success_count[api_type],
                'error_count': self.error_count[api_type],
                'success_rate': (self.success_count[api_type] / len(times) * 100) if times else 0,
                'avg_time': statistics.mean(times) if times else 0,
                'min_time': min(times) if times else 0,
                'max_time': max(times) if times else 0,
                'median_time': statistics.median(times) if times else 0,
                'std_dev': statistics.stdev(times) if len(times) > 1 else 0,
                'errors': self.errors[api_type][:10]  # 只显示前10个错误
            }


class UserSession:
    """用户会话"""
    def __init__(self, user_id, config, metrics):
        self.user_id = user_id
        self.config = config
        self.metrics = metrics
        self.session = requests.Session()
        self.token = None
        self.session_id = None
    
    def login(self):
        """登录获取token"""
        url = f"{self.config.base_url}/api/auth/login/"
        data = {
            "username": self.config.username,
            "password": self.config.password
        }

        try:
            response = self.session.post(url, json=data, timeout=self.config.timeout)
            if response.status_code == 200:
                result = response.json()
                # 根据后端API格式，token在 data.token 字段
                if 'data' in result and 'token' in result['data']:
                    self.token = result['data']['token']
                elif 'access' in result:
                    self.token = result['access']
                elif 'access_token' in result:
                    self.token = result['access_token']
                elif 'token' in result:
                    self.token = result['token']
                else:
                    print(f"用户 {self.user_id}: 登录响应中未找到token字段，响应: {result}")
                    return False

                self.session.headers.update({
                    'Authorization': f'Bearer {self.token}',
                    'Content-Type': 'application/json'
                })
                return True
            else:
                error_detail = response.text[:200] if response.text else "无详细信息"
                print(f"用户 {self.user_id}: 登录失败，状态码: {response.status_code}, 错误: {error_detail}")
                return False
        except Exception as e:
            print(f"用户 {self.user_id}: 登录异常: {str(e)}")
            return False
    
    def start_recording(self):
        """开始录制"""
        url = f"{self.config.base_url}/api/auth/extension/sync/start/"
        
        try:
            start_time = time.time()
            response = self.session.post(url, json={}, timeout=self.config.timeout)
            response_time = time.time() - start_time
            
            if response.status_code in [200, 201]:
                result = response.json()
                # 获取session_id
                if 'session_id' in result:
                    self.session_id = result['session_id']
                elif 'data' in result and 'session_id' in result['data']:
                    self.session_id = result['data']['session_id']
                
                self.metrics.record_request('start', response_time, True)
                self.metrics.start_times[self.user_id] = start_time
                return True
            else:
                error_msg = f"状态码: {response.status_code}, 响应: {response.text[:200]}"
                self.metrics.record_request('start', response_time, False, error_msg)
                return False
        except Exception as e:
            error_msg = f"异常: {str(e)}"
            self.metrics.record_request('start', 0, False, error_msg)
            return False
    
    def send_operation(self, op_index):
        """发送操作记录"""
        url = f"{self.config.base_url}/api/auth/extension/sync/operation/"
        
        # 构造操作数据
        operation_data = {
            "session_id": self.session_id,
            "operation_type": "click",
            "element_selector": f"#element-{op_index}",
            "element_text": f"测试元素 {op_index}",
            "page_url": "http://example.com/test",
            "timestamp": datetime.now().isoformat(),
            "additional_data": {
                "user_id": self.user_id,
                "op_index": op_index
            }
        }
        
        try:
            start_time = time.time()
            response = self.session.post(url, json=operation_data, timeout=self.config.timeout)
            response_time = time.time() - start_time
            
            if response.status_code in [200, 201]:
                self.metrics.record_request('operation', response_time, True)
                return True
            else:
                error_msg = f"状态码: {response.status_code}, 响应: {response.text[:200]}"
                self.metrics.record_request('operation', response_time, False, error_msg)
                return False
        except Exception as e:
            error_msg = f"异常: {str(e)}"
            self.metrics.record_request('operation', 0, False, error_msg)
            return False
    
    def stop_recording(self):
        """停止录制"""
        url = f"{self.config.base_url}/api/auth/extension/sync/end/"
        
        try:
            start_time = time.time()
            response = self.session.post(url, json={
                "session_id": self.session_id
            }, timeout=self.config.timeout)
            response_time = time.time() - start_time
            
            if response.status_code in [200, 201]:
                self.metrics.record_request('end', response_time, True)
                self.metrics.end_times[self.user_id] = start_time
                return True
            else:
                error_msg = f"状态码: {response.status_code}, 响应: {response.text[:200]}"
                self.metrics.record_request('end', response_time, False, error_msg)
                return False
        except Exception as e:
            error_msg = f"异常: {str(e)}"
            self.metrics.record_request('end', 0, False, error_msg)
            return False


def run_user_test(user_id, config, metrics):
    """执行单个用户的测试流程"""
    session = UserSession(user_id, config, metrics)
    
    # 1. 登录
    if not session.login():
        return {"user_id": user_id, "status": "failed", "stage": "login"}
    
    # 2. 开始录制
    if not session.start_recording():
        return {"user_id": user_id, "status": "failed", "stage": "start"}
    
    # 3. 发送多个操作
    op_results = []
    for i in range(config.operations_per_user):
        result = session.send_operation(i + 1)
        op_results.append(result)
        time.sleep(0.1)  # 操作之间稍微间隔
    
    # 4. 停止录制
    if not session.stop_recording():
        return {"user_id": user_id, "status": "failed", "stage": "end", "operations": op_results}
    
    return {
        "user_id": user_id,
        "status": "success",
        "operations": op_results
    }


def print_test_report(config, metrics, user_results, total_time):
    """打印测试报告"""
    print("\n" + "="*80)
    print("浏览器插件同步 API 并发压力测试报告")
    print("="*80)
    
    print(f"\n测试配置:")
    print(f"  - 并发用户数: {config.concurrent_users}")
    print(f"  - 每用户操作数: {config.operations_per_user}")
    print(f"  - 总请求数: {config.concurrent_users * (2 + config.operations_per_user)}")
    print(f"  - 测试时长: {total_time:.2f} 秒")
    
    print(f"\n用户测试结果:")
    success_users = sum(1 for r in user_results if r['status'] == 'success')
    failed_users = len(user_results) - success_users
    print(f"  - 成功用户: {success_users}/{config.concurrent_users} ({success_users/config.concurrent_users*100:.1f}%)")
    print(f"  - 失败用户: {failed_users}")
    
    # 按阶段统计失败
    stage_failures = defaultdict(int)
    for result in user_results:
        if result['status'] == 'failed':
            stage_failures[result.get('stage', 'unknown')] += 1
    
    if stage_failures:
        print(f"  - 失败阶段分布:")
        for stage, count in stage_failures.items():
            print(f"    * {stage}: {count} 个用户")
    
    print(f"\nAPI 性能统计:")
    print("-" * 80)
    
    for api_type in ['start', 'operation', 'end']:
        stats = metrics.get_stats(api_type)
        if stats:
            api_names = {
                'start': '开始录制 API (/api/auth/extension/sync/start/)',
                'operation': '操作批量同步 API (/api/auth/extension/sync/operation/)',
                'end': '停止录制 API (/api/auth/extension/sync/end/)'
            }
            
            print(f"\n{api_names[api_type]}:")
            print(f"  - 总请求数: {stats['total_requests']}")
            print(f"  - 成功次数: {stats['success_count']}")
            print(f"  - 失败次数: {stats['error_count']}")
            print(f"  - 成功率: {stats['success_rate']:.2f}%")
            print(f"  - 响应时间统计:")
            print(f"    * 平均: {stats['avg_time']*1000:.2f} ms")
            print(f"    * 最小: {stats['min_time']*1000:.2f} ms")
            print(f"    * 最大: {stats['max_time']*1000:.2f} ms")
            print(f"    * 中位数: {stats['median_time']*1000:.2f} ms")
            print(f"    * 标准差: {stats['std_dev']*1000:.2f} ms")
            
            if stats['errors']:
                print(f"  - 错误示例 (前5条):")
                for i, error in enumerate(stats['errors'][:5], 1):
                    print(f"    {i}. {error}")
    
    print(f"\n吞吐量分析:")
    total_requests = sum(len(metrics.response_times[api]) for api in ['start', 'operation', 'end'])
    throughput = total_requests / total_time if total_time > 0 else 0
    print(f"  - 总请求数: {total_requests}")
    print(f"  - 吞吐量: {throughput:.2f} 请求/秒")
    
    print("\n" + "="*80)
    print("测试完成!")
    print("="*80 + "\n")


def main():
    """主测试函数"""
    print("开始浏览器插件同步 API 并发压力测试...")
    print(f"测试开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    config = StressTestConfig()
    metrics = TestMetrics()
    
    # 测试后端服务是否可用
    try:
        response = requests.get(f"{config.base_url}/api/auth/", timeout=5)
        print(f"后端服务可用: {config.base_url}")
    except Exception as e:
        print(f"错误: 无法连接到后端服务 {config.base_url}")
        print(f"详细信息: {str(e)}")
        sys.exit(1)
    
    print(f"\n配置信息:")
    print(f"  - 并发用户数: {config.concurrent_users}")
    print(f"  - 每用户操作数: {config.operations_per_user}")
    print(f"  - 测试账号: {config.username}")
    print(f"\n开始执行并发测试...\n")
    
    start_time = time.time()
    
    # 使用线程池执行并发测试
    with ThreadPoolExecutor(max_workers=config.concurrent_users) as executor:
        futures = {
            executor.submit(run_user_test, user_id, config, metrics): user_id
            for user_id in range(1, config.concurrent_users + 1)
        }
        
        user_results = []
        for future in as_completed(futures):
            user_id = futures[future]
            try:
                result = future.result()
                user_results.append(result)
                status_icon = "✓" if result['status'] == 'success' else "✗"
                print(f"用户 {user_id:2d} 测试完成 {status_icon}")
            except Exception as e:
                print(f"用户 {user_id:2d} 测试异常: {str(e)}")
                user_results.append({
                    "user_id": user_id,
                    "status": "failed",
                    "stage": "exception",
                    "error": str(e)
                })
    
    end_time = time.time()
    total_time = end_time - start_time
    
    # 打印测试报告
    print_test_report(config, metrics, user_results, total_time)
    
    # 将结果保存到文件
    report_data = {
        "test_time": datetime.now().isoformat(),
        "config": {
            "concurrent_users": config.concurrent_users,
            "operations_per_user": config.operations_per_user,
            "base_url": config.base_url
        },
        "total_time": total_time,
        "user_results": user_results,
        "metrics": {
            "start": metrics.get_stats('start'),
            "operation": metrics.get_stats('operation'),
            "end": metrics.get_stats('end')
        }
    }
    
    report_file = f"stress_test_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump(report_data, f, ensure_ascii=False, indent=2)
    
    print(f"详细报告已保存到: {report_file}\n")


if __name__ == "__main__":
    main()