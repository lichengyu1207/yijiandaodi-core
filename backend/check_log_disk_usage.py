#!/usr/bin/env python3
"""
日志磁盘空间监控脚本

功能：
1. 检查日志目录磁盘使用情况
2. 统计各类型日志文件大小
3. 识别大文件（>10MB）
4. 监控磁盘使用率
5. 提供清理建议

使用：
    python check_log_disk_usage.py
"""

import os
import shutil
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple

class LogDiskMonitor:
    """日志磁盘空间监控器"""
    
    def __init__(self, log_dir: str = '/var/log/celery'):
        """
        初始化监控器
        
        Args:
            log_dir: 日志目录路径
        """
        self.log_dir = Path(log_dir)
        self.log_files = []
        self.total_size = 0
        
    def scan_log_files(self) -> List[Tuple[str, int]]:
        """
        扫描所有日志文件
        
        Returns:
            日志文件列表: [(文件名, 大小), ...]
        """
        if not self.log_dir.exists():
            print(f"❌ 日志目录不存在: {self.log_dir}")
            return []
        
        log_files = []
        
        # 扫描所有.log和.log.*文件
        for pattern in ['*.log', '*.log.*']:
            for log_file in self.log_dir.glob(pattern):
                if log_file.is_file():
                    size = log_file.stat().st_size
                    log_files.append((log_file.name, size, log_file.stat().st_mtime))
        
        # 按大小排序
        log_files.sort(key=lambda x: x[1], reverse=True)
        
        return log_files
    
    def format_size(self, size_bytes: int) -> str:
        """
        格式化文件大小
        
        Args:
            size_bytes: 字节数
            
        Returns:
            格式化后的字符串（MB或GB）
        """
        if size_bytes >= 1024 * 1024 * 1024:  # >= 1GB
            return f"{size_bytes / 1024 / 1024 / 1024:.2f}GB"
        elif size_bytes >= 1024 * 1024:  # >= 1MB
            return f"{size_bytes / 1024 / 1024:.2f}MB"
        elif size_bytes >= 1024:  # >= 1KB
            return f"{size_bytes / 1024:.2f}KB"
        else:
            return f"{size_bytes}B"
    
    def check_disk_usage(self) -> Dict[str, float]:
        """
        检查磁盘使用情况
        
        Returns:
            磁盘使用信息字典
        """
        disk_usage = shutil.disk_usage(self.log_dir)
        
        return {
            'total_gb': disk_usage.total / 1024 / 1024 / 1024,
            'used_gb': disk_usage.used / 1024 / 1024 / 1024,
            'free_gb': disk_usage.free / 1024 / 1024 / 1024,
            'used_percent': (disk_usage.used / disk_usage.total) * 100
        }
    
    def generate_report(self) -> None:
        """生成监控报告"""
        
        print("\n" + "="*80)
        print(f"📊 Celery日志磁盘空间监控报告".center(80))
        print(f"时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}".center(80))
        print("="*80)
        
        # 扫描日志文件
        log_files = self.scan_log_files()
        
        if not log_files:
            print("\n✅ 未发现日志文件")
            return
        
        # 统计信息
        total_size = sum(size for _, size, _ in log_files)
        total_count = len(log_files)
        
        print(f"\n📁 日志目录: {self.log_dir}")
        print(f"📊 总文件数: {total_count}")
        print(f"📊 总大小: {self.format_size(total_size)}")
        
        # 按类型分组统计
        print("\n" + "-"*80)
        print("日志文件统计（按类型）:")
        print("-"*80)
        
        file_groups = {}
        
        for filename, size, mtime in log_files:
            # 提取文件类型（去除轮转后缀）
            base_name = filename.split('.')[0]
            
            if 'worker' in base_name:
                group_key = 'Celery Worker日志'
            elif 'error' in base_name:
                group_key = '错误日志'
            elif 'monitor' in base_name:
                group_key = '监控日志'
            else:
                group_key = '其他日志'
            
            if group_key not in file_groups:
                file_groups[group_key] = {'count': 0, 'size': 0}
            
            file_groups[group_key]['count'] += 1
            file_groups[group_key]['size'] += size
        
        for group_name, stats in sorted(file_groups.items()):
            print(f"  {group_name}:")
            print(f"    文件数: {stats['count']}")
            print(f"    大小: {self.format_size(stats['size'])}")
        
        # 大文件告警（>10MB）
        large_files = [(name, size) for name, size, _ in log_files if size > 10 * 1024 * 1024]
        
        if large_files:
            print("\n" + "-"*80)
            print("⚠️ 大文件告警（>10MB）:")
            print("-"*80)
            
            for filename, size in large_files[:10]:  # 只显示前10个
                print(f"  {filename}: {self.format_size(size)}")
        
        # 磁盘使用情况
        print("\n" + "-"*80)
        print("磁盘使用情况:")
        print("-"*80)
        
        disk_info = self.check_disk_usage()
        
        print(f"  总容量: {disk_info['total_gb']:.2f}GB")
        print(f"  已使用: {disk_info['used_gb']:.2f}GB ({disk_info['used_percent']:.1f}%)")
        print(f"  剩余空间: {disk_info['free_gb']:.2f}GB")
        
        # 告警和建议
        if disk_info['used_percent'] > 85:
            print("\n" + "="*80)
            print("🔴 磁盘空间告警".center(80))
            print("="*80)
            
            print(f"\n当前磁盘使用率: {disk_info['used_percent']:.1f}%（超过85%）")
            
            print("\n建议操作:")
            print("  1. 清理旧日志文件:")
            print(f"     find {self.log_dir} -name '*.log.*' -mtime +7 -delete")
            
            print("\n  2. 手动触发日志轮转:")
            print("     logrotate -f /etc/logrotate.d/yijiandaodi-celery")
            
            print("\n  3. 压缩旧日志:")
            print(f"     gzip {self.log_dir}/*.log.[0-9]*")
            
            print("\n  4. 检查是否有进程占用已删除的文件:")
            print("     lsof | grep deleted")
        
        elif disk_info['used_percent'] > 70:
            print("\n⚠️ 警告: 磁盘使用率超过70%")
        
        else:
            print("\n✅ 磁盘空间充足")
        
        # 详细文件列表（可选）
        if total_count > 20:
            print(f"\n💡 提示: 共发现{total_count}个日志文件，建议配置日志轮转")
        
        print("\n" + "="*80)
    
    def clean_old_logs(self, days: int = 7) -> int:
        """
        清理旧日志文件
        
        Args:
            days: 保留最近几天的日志
            
        Returns:
            删除的文件数量
        """
        import time
        
        cutoff_time = time.time() - (days * 86400)
        deleted_count = 0
        
        for log_file in self.log_dir.glob('*.log.*'):
            if log_file.is_file():
                if log_file.stat().st_mtime < cutoff_time:
                    try:
                        log_file.unlink()
                        deleted_count += 1
                        print(f"✅ 删除: {log_file.name}")
                    except Exception as e:
                        print(f"❌ 删除失败: {log_file.name} - {e}")
        
        return deleted_count


def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Celery日志磁盘空间监控')
    parser.add_argument(
        '--log-dir',
        default='/var/log/celery',
        help='日志目录路径（默认: /var/log/celery）'
    )
    parser.add_argument(
        '--clean',
        action='store_true',
        help='清理7天前的旧日志'
    )
    parser.add_argument(
        '--days',
        type=int,
        default=7,
        help='保留最近几天的日志（默认: 7）'
    )
    
    args = parser.parse_args()
    
    monitor = LogDiskMonitor(log_dir=args.log_dir)
    
    # 生成监控报告
    monitor.generate_report()
    
    # 清理旧日志（如果指定）
    if args.clean:
        print("\n" + "="*80)
        print(f"🗑️ 清理{args.days}天前的旧日志...")
        print("="*80)
        
        deleted = monitor.clean_old_logs(days=args.days)
        
        print(f"\n✅ 共删除 {deleted} 个文件")
        
        # 重新生成报告
        monitor.generate_report()


if __name__ == '__main__':
    main()