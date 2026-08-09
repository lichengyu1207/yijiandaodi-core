#!/usr/bin/env python3
"""
Celery任务日志实时监控脚本

功能：
1. 实时跟踪Celery Worker日志
2. 统计错误类型和频率
3. 监控任务性能
4. 发送告警通知
5. 生成监控报告

使用：
    python monitor_celery_logs.py --log-file /var/log/celery/worker.log
"""

import time
import json
import re
import argparse
from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Any

class CeleryLogMonitor:
    """Celery日志实时监控"""
    
    def __init__(self, log_file: str, alert_threshold: int = 3):
        """
        初始化监控器
        
        Args:
            log_file: 日志文件路径
            alert_threshold: 错误告警阈值（同一错误出现多少次后告警）
        """
        self.log_file = log_file
        self.alert_threshold = alert_threshold
        self.error_counts = defaultdict(int)
        self.performance_stats = defaultdict(list)
        self.task_success_rate = defaultdict(lambda: {'success': 0, 'failure': 0})
        
    def tail_log_file(self):
        """实时跟踪日志文件"""
        print(f"📋 开始监控日志文件: {self.log_file}")
        print(f"⏰ 开始时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("="*80)
        
        try:
            with open(self.log_file, 'r', encoding='utf-8') as f:
                # 移动到文件末尾
                f.seek(0, 2)
                
                while True:
                    line = f.readline()
                    
                    if not line:
                        time.sleep(0.1)
                        continue
                    
                    self.process_log_line(line.strip())
        
        except FileNotFoundError:
            print(f"❌ 日志文件不存在: {self.log_file}")
        except KeyboardInterrupt:
            print("\n\n⏹️ 停止监控...")
            self.generate_report()
    
    def process_log_line(self, line: str):
        """处理单行日志"""
        # 尝试解析JSON
        if line.startswith('{'):
            self.process_json_log(line)
        else:
            self.process_raw_log(line)
    
    def process_json_log(self, line: str):
        """处理JSON格式日志"""
        try:
            log_data = json.loads(line)
            
            level = log_data.get('level', 'INFO')
            logger = log_data.get('logger', 'unknown')
            message = log_data.get('message', '')
            
            # 只处理trajectory_builder和tasks相关日志
            if not ('trajectory' in logger or 'tasks' in logger):
                return
            
            # 实时显示关键日志
            if level in ['ERROR', 'CRITICAL']:
                print(f"\n[{datetime.now().strftime('%H:%M:%S')}] 🔴 {message}")
                
                # 显示错误详情
                if 'error' in log_data:
                    print(f"  错误: {log_data['error']}")
                if 'error_type' in log_data:
                    print(f"  类型: {log_data['error_type']}")
                if 'task_name' in log_data or 'task_id' in log_data:
                    print(f"  任务: {log_data.get('task_name', log_data.get('task_id'))}")
            
            # 统计错误
            if level == 'ERROR' and 'error_type' in log_data:
                error_type = log_data['error_type']
                task_name = log_data.get('task_name', log_data.get('task', 'unknown'))
                
                key = f"{task_name}:{error_type}"
                self.error_counts[key] += 1
                
                # 错误告警
                if self.error_counts[key] >= self.alert_threshold:
                    self.send_alert(
                        "🔴 频繁错误告警",
                        f"任务: {task_name}",
                        f"错误类型: {error_type}",
                        f"错误次数: {self.error_counts[key]}",
                        f"最近错误: {log_data.get('error', 'N/A')}"
                    )
            
            # 性能监控
            if 'duration_ms' in log_data:
                task_name = log_data.get('task_name', log_data.get('task', 'unknown'))
                duration = log_data['duration_ms']
                
                self.performance_stats[task_name].append(duration)
                
                # 慢任务告警（>5秒）
                if duration > 5000:
                    self.send_alert(
                        "⚠️ 慢任务告警",
                        f"任务: {task_name}",
                        f"耗时: {duration:.2f}ms ({duration/1000:.2f}s)"
                    )
                
                # 性能警告（>1秒）
                elif duration > 1000:
                    print(f"[{datetime.now().strftime('%H:%M:%S')}] ⏱️ 慢任务: {task_name} - {duration:.2f}ms")
            
            # 成功率统计
            if 'success' in log_data:
                task_name = log_data.get('task_name', log_data.get('task', 'unknown'))
                
                if log_data['success']:
                    self.task_success_rate[task_name]['success'] += 1
                else:
                    self.task_success_rate[task_name]['failure'] += 1
        
        except json.JSONDecodeError as e:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] ⚠️ JSON解析失败: {line[:50]}...")
    
    def process_raw_log(self, line: str):
        """处理原始日志（非JSON）"""
        # 检测详细堆栈追踪
        if '详细堆栈追踪' in line:
            print(f"\n{'='*80}")
            print(f"[{datetime.now().strftime('%H:%M:%S')}] 📋 {line}")
        elif 'Traceback' in line or 'File "' in line:
            print(line)
    
    def send_alert(self, *messages):
        """发送告警"""
        print("\n" + "="*80)
        for i, msg in enumerate(messages, 1):
            print(f"{msg}" if i == 1 else f"  {msg}")
        print("="*80)
        
        # 这里可以集成到其他告警系统
        # 例如: Slack、Email、PagerDuty等
        # self.send_slack_alert(messages)
        # self.send_email_alert(messages)
    
    def generate_report(self):
        """生成监控报告"""
        print("\n" + "="*80)
        print("📊 Celery任务监控报告".center(80))
        print("="*80)
        
        # 错误统计
        if self.error_counts:
            print("\n🔴 错误统计（Top 10）:")
            for i, (key, count) in enumerate(sorted(self.error_counts.items(), key=lambda x: x[1], reverse=True)[:10], 1):
                task_name, error_type = key.split(':', 1) if ':' in key else (key, 'Unknown')
                print(f"  {i}. {task_name} - {error_type}: {count}次")
        else:
            print("\n✅ 无错误记录")
        
        # 性能统计
        if self.performance_stats:
            print("\n⏱️ 性能统计:")
            for task_name, durations in sorted(self.performance_stats.items()):
                avg_duration = sum(durations) / len(durations)
                max_duration = max(durations)
                min_duration = min(durations)
                
                print(f"  {task_name}:")
                print(f"    平均耗时: {avg_duration:.2f}ms")
                print(f"    最大耗时: {max_duration:.2f}ms")
                print(f"    最小耗时: {min_duration:.2f}ms")
                print(f"    样本数: {len(durations)}")
        
        # 成功率统计
        if self.task_success_rate:
            print("\n📈 任务成功率:")
            for task_name, stats in sorted(self.task_success_rate.items()):
                total = stats['success'] + stats['failure']
                success_rate = (stats['success'] / total * 100) if total > 0 else 0
                
                print(f"  {task_name}:")
                print(f"    成功率: {success_rate:.2f}%")
                print(f"    成功数: {stats['success']}")
                print(f"    失败数: {stats['failure']}")
        
        print("\n" + "="*80)
        print(f"报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}".center(80))
        print("="*80)


def main():
    parser = argparse.ArgumentParser(description='Celery任务日志实时监控')
    parser.add_argument(
        '--log-file',
        default='/var/log/celery/worker.log',
        help='日志文件路径（默认: /var/log/celery/worker.log）'
    )
    parser.add_argument(
        '--alert-threshold',
        type=int,
        default=3,
        help='错误告警阈值（默认: 3）'
    )
    
    args = parser.parse_args()
    
    monitor = CeleryLogMonitor(
        log_file=args.log_file,
        alert_threshold=args.alert_threshold
    )
    
    try:
        monitor.tail_log_file()
    except Exception as e:
        print(f"❌ 监控异常: {e}")
        monitor.generate_report()


if __name__ == '__main__':
    main()