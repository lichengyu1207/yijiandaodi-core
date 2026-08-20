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
        
    def scan_log_files(self, recursive: bool = True) -> List[Tuple[str, int, float, str]]:
        """
        扫描所有日志文件和相关文件
        
        Args:
            recursive: 是否递归扫描子目录
            
        Returns:
            文件列表: [(文件名, 大小, 修改时间, 文件类型), ...]
        """
        if not self.log_dir.exists():
            print(f"❌ 日志目录不存在: {self.log_dir}")
            return []
        
        all_files = []
        
        # 定义文件类型和对应的模式
        file_patterns = {
            'Celery日志': ['*.log', '*.log.*'],
            '数据库文件': ['*.sqlite3', '*.db', '*.sqlite'],
            'Python缓存': ['*.pyc', '*.pyo', '__pycache__'],
            '测试覆盖率': ['.coverage', '*.coverage', 'htmlcov/*'],
            '性能分析': ['*.prof', '*.lprof'],
            '临时文件': ['*.tmp', '*.bak', '*.swp', '*~'],
            '压缩文件': ['*.gz', '*.zip', '*.tar', '*.rar'],
        }
        
        # 扫描每种类型的文件
        for file_type, patterns in file_patterns.items():
            for pattern in patterns:
                # 使用rglob进行递归扫描，或glob进行当前目录扫描
                if recursive:
                    matched_files = self.log_dir.rglob(pattern)
                else:
                    matched_files = self.log_dir.glob(pattern)
                
                for file_path in matched_files:
                    if file_path.is_file():
                        try:
                            size = file_path.stat().st_size
                            mtime = file_path.stat().st_mtime
                            # 使用相对路径（便于显示）
                            rel_path = file_path.relative_to(self.log_dir)
                            all_files.append((str(rel_path), size, mtime, file_type))
                        except (OSError, PermissionError) as e:
                            # 跳过无法访问的文件
                            pass
        
        # 按大小排序
        all_files.sort(key=lambda x: x[1], reverse=True)
        
        return all_files
    
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
        
        # 扫描文件（递归）
        all_files = self.scan_log_files(recursive=True)
        
        if not all_files:
            print("\n✅ 未发现日志或相关文件")
            return
        
        # 统计信息
        total_size = sum(size for _, size, _, _ in all_files)
        total_count = len(all_files)
        
        print(f"\n📁 扫描目录: {self.log_dir}")
        print(f"📊 总文件数: {total_count}")
        print(f"📊 总大小: {self.format_size(total_size)}")
        
        # 按类型分组统计（使用新的file_type字段）
        print("\n" + "-"*80)
        print("文件统计（按类型）:")
        print("-"*80)
        
        file_groups = {}
        
        for filename, size, mtime, file_type in all_files:
            if file_type not in file_groups:
                file_groups[file_type] = {'count': 0, 'size': 0}
            
            file_groups[file_type]['count'] += 1
            file_groups[file_type]['size'] += size
        
        # 按大小排序显示
        for group_name, stats in sorted(file_groups.items(), key=lambda x: x[1]['size'], reverse=True):
            print(f"  {group_name}:")
            print(f"    文件数: {stats['count']}")
            print(f"    大小: {self.format_size(stats['size'])}")
        
        # 大文件告警（>10MB）
        large_files = [(name, size, ftype) for name, size, _, ftype in all_files if size > 10 * 1024 * 1024]
        
        if large_files:
            print("\n" + "-"*80)
            print(f"⚠️ 大文件告警（>10MB）:")
            print("-"*80)
            
            for filename, size, file_type in large_files[:10]:  # 只显示前10个
                print(f"  [{file_type}] {filename}: {self.format_size(size)}")
        
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
    
    def clean_old_logs(self, days: int = 7, file_types: List[str] = None) -> int:
        """
        清理旧日志文件和缓存文件
        
        Args:
            days: 保留最近几天的日志
            file_types: 要清理的文件类型列表（默认：所有类型）
            
        Returns:
            删除的文件数量
        """
        import time
        
        if file_types is None:
            file_types = ['Celery日志', 'Python缓存', '临时文件']
        
        cutoff_time = time.time() - (days * 86400)
        deleted_count = 0
        
        # 扫描所有文件
        all_files = self.scan_log_files(recursive=True)
        
        for filename, size, mtime, file_type in all_files:
            if file_type in file_types:
                file_path = self.log_dir / filename
                
                if mtime < cutoff_time:
                    try:
                        file_path.unlink()
                        deleted_count += 1
                        print(f"✅ 删除: {filename} ({self.format_size(size)})")
                    except Exception as e:
                        print(f"❌ 删除失败: {filename} - {e}")
        
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
        help='清理旧文件'
    )
    parser.add_argument(
        '--days',
        type=int,
        default=7,
        help='保留最近几天的文件（默认: 7）'
    )
    parser.add_argument(
        '--file-types',
        nargs='+',
        default=['Celery日志', 'Python缓存', '临时文件'],
        help='要清理的文件类型（默认: Celery日志 Python缓存 临时文件）'
    )
    parser.add_argument(
        '--no-recursive',
        action='store_true',
        help='不递归扫描子目录'
    )
    
    args = parser.parse_args()
    
    monitor = LogDiskMonitor(log_dir=args.log_dir)
    
    # 生成监控报告
    monitor.generate_report()
    
    # 清理旧文件（如果指定）
    if args.clean:
        print("\n" + "="*80)
        print(f"🗑️ 清理{args.days}天前的旧文件...")
        print(f"文件类型: {', '.join(args.file_types)}")
        print("="*80)
        
        deleted = monitor.clean_old_logs(days=args.days, file_types=args.file_types)
        
        print(f"\n✅ 共删除 {deleted} 个文件")
        
        # 重新生成报告
        monitor.generate_report()


if __name__ == '__main__':
    main()