"""
日志文件清理脚本

检查并清理不符合日志轮转策略的文件

CI/CD集成：
- 自动模式：检查日志状态，返回退出码
- 退出码：0=正常，1=发现问题，2=清理失败
- 生成JSON格式报告：log_check_report.json
"""

import os
import sys
import glob
import json
import argparse
from pathlib import Path
from datetime import datetime

# 日志目录路径
LOG_DIR = Path(__file__).parent / 'logs'

# 报告文件路径
REPORT_FILE = Path(__file__).parent / 'log_check_report.json'

# 日志轮转策略配置
LOG_POLICIES = {
    'security_audit.log': {
        'max_size': 50 * 1024 * 1024,  # 50MB
        'backup_count': 180
    },
    'hippocampus.log': {
        'max_size': 10 * 1024 * 1024,  # 10MB
        'backup_count': 10
    },
    'performance.log': {
        'max_size': 5 * 1024 * 1024,  # 5MB
        'backup_count': 20
    },
    'tracing.log': {
        'max_size': 10 * 1024 * 1024,  # 10MB
        'backup_count': 5
    }
}


def check_log_files():
    """检查日志文件状态"""
    report = {
        'timestamp': datetime.now().isoformat(),
        'log_dir': str(LOG_DIR),
        'total_size': 0,
        'total_files': 0,
        'backup_files': 0,
        'issues': [],
        'log_groups': {}
    }

    # 获取所有日志文件
    all_files = list(LOG_DIR.glob('*.log*'))

    # 按日志类型分组
    log_groups = {}
    for file in all_files:
        # 提取日志名称（去掉备份编号）
        base_name = file.name.split('.')[0] + '.log'
        if base_name not in log_groups:
            log_groups[base_name] = []
        log_groups[base_name].append(file)

    # 分析每个日志组
    for log_name, files in log_groups.items():
        # 获取策略配置
        policy = LOG_POLICIES.get(log_name, {
            'max_size': 10 * 1024 * 1024,  # 默认10MB
            'backup_count': 10  # 默认10个备份
        })

        log_group_info = {
            'policy': {
                'max_size_mb': policy['max_size'] / 1024 / 1024,
                'backup_count': policy['backup_count']
            },
            'current_file': None,
            'backup_files': [],
            'issues': []
        }

        # 排序文件（按备份编号）
        current_file = None
        backup_files = []

        for file in files:
            if file.name == log_name:
                current_file = file
            else:
                backup_files.append(file)

        # 检查当前文件
        if current_file:
            size = current_file.stat().st_size
            report['total_size'] += size
            report['total_files'] += 1
            size_mb = size / 1024 / 1024

            log_group_info['current_file'] = {
                'name': current_file.name,
                'size_mb': round(size_mb, 2),
                'path': str(current_file)
            }

            # 检查是否超过大小限制
            if size > policy['max_size']:
                issue = {
                    'type': 'size_exceeded',
                    'file': current_file.name,
                    'size_mb': round(size_mb, 2),
                    'max_size_mb': policy['max_size'] / 1024 / 1024,
                    'severity': 'warning'
                }
                log_group_info['issues'].append(issue)
                report['issues'].append(issue)

        # 检查备份文件
        if backup_files:
            backup_files.sort(key=lambda x: x.name)
            log_group_info['backup_file_count'] = len(backup_files)
            report['backup_files'] += len(backup_files)

            # 检查备份数量
            if len(backup_files) > policy['backup_count']:
                issue = {
                    'type': 'backup_count_exceeded',
                    'log_name': log_name,
                    'current_count': len(backup_files),
                    'max_count': policy['backup_count'],
                    'severity': 'error'
                }
                log_group_info['issues'].append(issue)
                report['issues'].append(issue)

            # 检查备份文件大小
            for backup_file in backup_files:
                size = backup_file.stat().st_size
                report['total_size'] += size
                report['total_files'] += 1
                size_mb = size / 1024 / 1024

                log_group_info['backup_files'].append({
                    'name': backup_file.name,
                    'size_mb': round(size_mb, 2)
                })

                if size > policy['max_size']:
                    issue = {
                        'type': 'backup_size_exceeded',
                        'file': backup_file.name,
                        'size_mb': round(size_mb, 2),
                        'max_size_mb': policy['max_size'] / 1024 / 1024,
                        'severity': 'warning'
                    }
                    log_group_info['issues'].append(issue)
                    report['issues'].append(issue)

        report['log_groups'][log_name] = log_group_info

    # 计算总大小（MB）
    report['total_size_mb'] = round(report['total_size'] / 1024 / 1024, 2)

    return report


def cleanup_log_files(report):
    """清理不符合策略的日志文件"""
    cleaned_files = []

    for issue in report['issues']:
        if issue['type'] == 'backup_count_exceeded':
            # 清理多余的备份文件
            log_name = issue['log_name']
            policy = LOG_POLICIES.get(log_name, {'backup_count': 10})

            # 获取备份文件列表（按编号排序）
            backup_pattern = LOG_DIR / (log_name.replace('.log', '.log.*'))
            backup_files = sorted(backup_pattern.parent.glob(backup_pattern.name))

            # 计算需要删除的文件数量
            files_to_delete = backup_files[policy['backup_count']:]

            for file in files_to_delete:
                try:
                    file_size = file.stat().st_size
                    file.unlink()
                    cleaned_files.append({
                        'file': file.name,
                        'size_mb': round(file_size / 1024 / 1024, 2),
                        'reason': '备份文件数量超过限制'
                    })
                except Exception as e:
                    issue['cleanup_error'] = str(e)

    return cleaned_files


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='日志文件清理脚本')
    parser.add_argument('--auto', action='store_true', help='自动模式（CI/CD环境）')
    parser.add_argument('--clean', action='store_true', help='自动清理')
    args = parser.parse_args()

    # 检查日志文件
    report = check_log_files()

    # 保存报告
    with open(REPORT_FILE, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    # CI/CD自动模式
    if args.auto:
        print(json.dumps(report, indent=2, ensure_ascii=False))

        # 返回退出码
        if report['issues']:
            if args.clean:
                # 执行清理
                cleaned = cleanup_log_files(report)
                if cleaned:
                    report['cleaned_files'] = cleaned
                    print(f"\n清理了 {len(cleaned)} 个文件")
                sys.exit(0)
            else:
                sys.exit(1)  # 发现问题
        else:
            sys.exit(0)  # 正常

    # 交互模式
    else:
        print("=" * 80)
        print("日志文件检查报告")
        print("=" * 80)

        for log_name, log_info in report['log_groups'].items():
            print(f"\n【{log_name}】")
            if log_info['current_file']:
                print(f"  当前文件: {log_info['current_file']['name']}")
                print(f"  大小: {log_info['current_file']['size_mb']} MB")

            if log_info.get('backup_files'):
                print(f"  备份文件数: {len(log_info['backup_files'])}")
                for backup in log_info['backup_files'][:3]:  # 只显示前3个
                    print(f"    - {backup['name']}: {backup['size_mb']} MB")

            if log_info['issues']:
                for issue in log_info['issues']:
                    print(f"  ⚠️  {issue['type']}: {issue}")

        print("\n" + "=" * 80)
        print(f"总日志文件大小: {report['total_size_mb']} MB")
        print(f"文件总数: {report['total_files']}")
        print(f"发现问题: {len(report['issues'])}")

        if report['issues']:
            print(f"\n报告已保存到: {REPORT_FILE}")
            print("是否执行清理？(y/n): ", end='')

            try:
                response = input().strip().lower()
                if response == 'y':
                    cleaned = cleanup_log_files(report)
                    if cleaned:
                        print(f"\n清理了 {len(cleaned)} 个文件:")
                        for file_info in cleaned:
                            print(f"  - {file_info['file']}: {file_info['size_mb']} MB")
                    else:
                        print("\n无需清理")
            except:
                # 非交互模式，直接清理
                cleaned = cleanup_log_files(report)
                if cleaned:
                    print(f"\n清理了 {len(cleaned)} 个文件")
        else:
            print("\n✅ 所有日志文件符合策略要求")

        print("=" * 80)


if __name__ == '__main__':
    main()