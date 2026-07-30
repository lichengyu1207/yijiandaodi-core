"""
安全审计分析脚本
每周自动分析审计日志，生成安全报告
"""

import os
import sys
import django
from datetime import datetime, timedelta
from collections import Counter, defaultdict
import json

# 设置Django环境
sys.path.append('C:\\MsSafeData\\Desktop\\yijiandaodi\\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from django.utils import timezone
from auth_app.models import UserBehaviorLog, AgentBehaviorLog
from auth_app.two_factor_models import TwoFactorAttempt

User = get_user_model()


class SecurityAuditAnalyzer:
    """安全审计分析器"""

    def __init__(self, days=7):
        self.days = days
        self.start_date = timezone.now() - timedelta(days=days)
        self.end_date = timezone.now()
        self.report = {
            'period': {
                'start': self.start_date.isoformat(),
                'end': self.end_date.isoformat(),
                'days': days
            },
            'summary': {},
            'login_analysis': {},
            'operation_analysis': {},
            'security_events': [],
            'recommendations': []
        }

    def analyze(self):
        """执行完整分析"""
        print(f"开始分析过去 {self.days} 天的审计日志...")
        print(f"时间范围: {self.start_date.strftime('%Y-%m-%d %H:%M')} - {self.end_date.strftime('%Y-%m-%d %H:%M')}")

        # 1. 基本统计
        self._analyze_summary()

        # 2. 登录行为分析
        self._analyze_login_behavior()

        # 3. 操作行为分析
        self._analyze_operations()

        # 4. 安全事件检测
        self._detect_security_events()

        # 5. 生成建议
        self._generate_recommendations()

        return self.report

    def _analyze_summary(self):
        """基本统计"""
        print("\n1. 分析基本统计...")

        # 用户统计
        total_users = User.objects.count()
        active_users = User.objects.filter(
            last_login__gte=self.start_date
        ).count()

        # 行为日志统计
        user_logs = UserBehaviorLog.objects.filter(
            created_at__gte=self.start_date
        ).count()

        agent_logs = AgentBehaviorLog.objects.filter(
            created_at__gte=self.start_date
        ).count()

        # 2FA统计
        two_factor_attempts = TwoFactorAttempt.objects.filter(
            created_at__gte=self.start_date
        ).count()

        two_factor_success = TwoFactorAttempt.objects.filter(
            created_at__gte=self.start_date,
            is_success=True
        ).count()

        self.report['summary'] = {
            'total_users': total_users,
            'active_users': active_users,
            'activity_rate': f"{(active_users / total_users * 100) if total_users > 0 else 0:.2f}%",
            'user_logs': user_logs,
            'agent_logs': agent_logs,
            'two_factor_attempts': two_factor_attempts,
            'two_factor_success_rate': f"{(two_factor_success / two_factor_attempts * 100) if two_factor_attempts > 0 else 0:.2f}%"
        }

        print(f"  ✅ 总用户数: {total_users}")
        print(f"  ✅ 活跃用户: {active_users} ({self.report['summary']['activity_rate']})")
        print(f"  ✅ 用户行为日志: {user_logs}")
        print(f"  ✅ Agent行为日志: {agent_logs}")
        print(f"  ✅ 2FA尝试次数: {two_factor_attempts}")

    def _analyze_login_behavior(self):
        """登录行为分析"""
        print("\n2. 分析登录行为...")

        # 获取所有登录日志
        login_logs = UserBehaviorLog.objects.filter(
            behavior_type='login',
            created_at__gte=self.start_date
        ).values('user_id', 'ip_address', 'created_at', 'success')

        # 统计登录次数
        login_count = login_logs.count()

        # 统计成功/失败
        success_count = sum(1 for log in login_logs if log.get('success', True))
        fail_count = login_count - success_count

        # IP地址分析
        ip_counter = Counter(log['ip_address'] for log in login_logs if log.get('ip_address'))

        # 用户登录次数
        user_login_counter = Counter(log['user_id'] for log in login_logs)

        # 检测异常IP（登录次数过多）
        abnormal_ips = [
            {'ip': ip, 'count': count}
            for ip, count in ip_counter.items()
            if count > 50  # 超过50次登录视为异常
        ]

        # 检测异常用户（登录次数过多）
        abnormal_users = []
        for user_id, count in user_login_counter.items():
            if count > 100:  # 超过100次登录视为异常
                try:
                    user = User.objects.get(id=user_id)
                    abnormal_users.append({
                        'user_id': user_id,
                        'username': user.username,
                        'login_count': count
                    })
                except User.DoesNotExist:
                    pass

        self.report['login_analysis'] = {
            'total_logins': login_count,
            'success_count': success_count,
            'fail_count': fail_count,
            'success_rate': f"{(success_count / login_count * 100) if login_count > 0 else 0:.2f}%",
            'unique_ips': len(ip_counter),
            'top_ips': ip_counter.most_common(10),
            'abnormal_ips': abnormal_ips,
            'abnormal_users': abnormal_users
        }

        print(f"  ✅ 总登录次数: {login_count}")
        print(f"  ✅ 成功率: {self.report['login_analysis']['success_rate']}")
        print(f"  ✅ 唯一IP数: {len(ip_counter)}")

        if abnormal_ips:
            print(f"  ⚠️  发现异常IP: {len(abnormal_ips)} 个")
            self.report['security_events'].append({
                'type': 'abnormal_login_ip',
                'severity': 'high',
                'description': f'发现 {len(abnormal_ips)} 个IP地址登录次数异常',
                'details': abnormal_ips
            })

    def _analyze_operations(self):
        """操作行为分析"""
        print("\n3. 分析操作行为...")

        # 获取所有操作日志
        operation_logs = UserBehaviorLog.objects.filter(
            created_at__gte=self.start_date
        ).exclude(behavior_type='login').values('behavior_type', 'user_id', 'created_at')

        # 操作类型统计
        operation_counter = Counter(log['behavior_type'] for log in operation_logs)

        # 用户操作次数
        user_operation_counter = Counter(log['user_id'] for log in operation_logs)

        # Agent操作统计
        agent_logs = AgentBehaviorLog.objects.filter(
            created_at__gte=self.start_date
        ).values('agent_type', 'status')

        agent_counter = Counter(log['agent_type'] for log in agent_logs)
        agent_status = Counter(log['status'] for log in agent_logs)

        self.report['operation_analysis'] = {
            'total_operations': len(operation_logs),
            'operation_types': dict(operation_counter.most_common(20)),
            'top_users': [
                {'user_id': user_id, 'operation_count': count}
                for user_id, count in user_operation_counter.most_common(10)
            ],
            'agent_operations': {
                'total': len(agent_logs),
                'by_type': dict(agent_counter.most_common(10)),
                'by_status': dict(agent_status)
            }
        }

        print(f"  ✅ 总操作次数: {len(operation_logs)}")
        print(f"  ✅ Agent操作次数: {len(agent_logs)}")
        print(f"  ✅ 操作类型: {len(operation_counter)} 种")

    def _detect_security_events(self):
        """检测安全事件"""
        print("\n4. 检测安全事件...")

        # 1. 检测暴力破解
        failed_logins = UserBehaviorLog.objects.filter(
            behavior_type='login',
            success=False,
            created_at__gte=self.start_date
        ).values('user_id', 'ip_address')

        # 按IP统计失败次数
        ip_fail_counter = Counter(log['ip_address'] for log in failed_logins)

        brute_force_ips = [
            {'ip': ip, 'fail_count': count}
            for ip, count in ip_fail_counter.items()
            if count > 10  # 同一IP失败超过10次
        ]

        if brute_force_ips:
            print(f"  ⚠️  发现暴力破解尝试: {len(brute_force_ips)} 个IP")
            self.report['security_events'].append({
                'type': 'brute_force_attack',
                'severity': 'critical',
                'description': f'发现 {len(brute_force_ips)} 个IP地址存在暴力破解尝试',
                'details': brute_force_ips,
                'recommendation': '建议对这些IP进行封禁，并加强密码策略'
            })

        # 2. 检测异常时间登录（凌晨2-5点）
        abnormal_time_logins = UserBehaviorLog.objects.filter(
            behavior_type='login',
            created_at__gte=self.start_date,
            created_at__hour__gte=2,
            created_at__hour__lte=5
        ).count()

        if abnormal_time_logins > 10:
            print(f"  ⚠️  异常时间登录: {abnormal_time_logins} 次")
            self.report['security_events'].append({
                'type': 'abnormal_login_time',
                'severity': 'medium',
                'description': f'凌晨2-5点登录次数: {abnormal_time_logins}',
                'recommendation': '建议关注这些登录行为，确认是否为正常操作'
            })

        # 3. 检测2FA失败次数过多
        two_factor_fails = TwoFactorAttempt.objects.filter(
            is_success=False,
            created_at__gte=self.start_date
        ).values('user_id')

        user_2fa_fail_counter = Counter(log['user_id'] for log in two_factor_fails)

        abnormal_2fa_users = [
            {'user_id': user_id, 'fail_count': count}
            for user_id, count in user_2fa_fail_counter.items()
            if count > 5  # 同一用户失败超过5次
        ]

        if abnormal_2fa_users:
            print(f"  ⚠️  2FA验证失败过多: {len(abnormal_2fa_users)} 个用户")
            self.report['security_events'].append({
                'type': '2fa_abuse',
                'severity': 'medium',
                'description': f'{len(abnormal_2fa_users)} 个用户双因子认证失败次数过多',
                'details': abnormal_2fa_users,
                'recommendation': '建议联系这些用户确认账户安全'
            })

        # 4. 检测高频操作
        high_freq_users = self.report['operation_analysis'].get('top_users', [])
        high_freq_users = [u for u in high_freq_users if u['operation_count'] > 500]

        if high_freq_users:
            print(f"  ⚠️  高频操作用户: {len(high_freq_users)} 个")
            self.report['security_events'].append({
                'type': 'high_frequency_operations',
                'severity': 'low',
                'description': f'{len(high_freq_users)} 个用户操作频率异常高',
                'details': high_freq_users,
                'recommendation': '建议确认这些用户的操作是否正常'
            })

    def _generate_recommendations(self):
        """生成安全建议"""
        print("\n5. 生成安全建议...")

        recommendations = []

        # 基于安全事件生成建议
        for event in self.report['security_events']:
            if 'recommendation' in event:
                recommendations.append({
                    'priority': event['severity'],
                    'category': event['type'],
                    'recommendation': event['recommendation']
                })

        # 通用建议
        if self.report['summary']['activity_rate'].replace('%', '') < '30':
            recommendations.append({
                'priority': 'low',
                'category': 'user_engagement',
                'recommendation': '用户活跃度较低，建议加强用户运营'
            })

        # 检查2FA启用率
        total_users = self.report['summary']['total_users']
        if total_users > 0:
            two_factor_enabled = User.objects.filter(two_factor__is_enabled=True).count()
            two_factor_rate = (two_factor_enabled / total_users) * 100

            if two_factor_rate < 50:
                recommendations.append({
                    'priority': 'medium',
                    'category': 'security',
                    'recommendation': f'双因子认证启用率仅{two_factor_rate:.2f}%，建议推广使用'
                })

        self.report['recommendations'] = recommendations

        print(f"  ✅ 生成建议: {len(recommendations)} 条")

    def save_report(self, filename=None):
        """保存报告"""
        if not filename:
            filename = f"security_audit_report_{self.end_date.strftime('%Y%m%d')}.json"

        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(self.report, f, indent=2, ensure_ascii=False)

        print(f"\n报告已保存: {filename}")
        return filename

    def print_summary(self):
        """打印摘要"""
        print("\n" + "="*60)
        print("📊 安全审计分析报告摘要")
        print("="*60)
        print(f"分析周期: {self.days} 天")
        print(f"时间范围: {self.start_date.strftime('%Y-%m-%d')} - {self.end_date.strftime('%Y-%m-%d')}")
        print()

        # 基本统计
        print("【基本统计】")
        for key, value in self.report['summary'].items():
            print(f"  - {key}: {value}")
        print()

        # 登录分析
        print("【登录分析】")
        print(f"  - 总登录次数: {self.report['login_analysis']['total_logins']}")
        print(f"  - 成功率: {self.report['login_analysis']['success_rate']}")
        print(f"  - 唯一IP数: {self.report['login_analysis']['unique_ips']}")
        print()

        # 操作分析
        print("【操作分析】")
        print(f"  - 总操作次数: {self.report['operation_analysis']['total_operations']}")
        print(f"  - Agent操作次数: {self.report['operation_analysis']['agent_operations']['total']}")
        print()

        # 安全事件
        print("【安全事件】")
        if self.report['security_events']:
            for event in self.report['security_events']:
                print(f"  ⚠️  [{event['severity'].upper()}] {event['description']}")
        else:
            print("  ✅ 无重大安全事件")
        print()

        # 建议
        print("【安全建议】")
        if self.report['recommendations']:
            for i, rec in enumerate(self.report['recommendations'], 1):
                print(f"  {i}. [{rec['priority'].upper()}] {rec['recommendation']}")
        else:
            print("  ✅ 无需特别处理")

        print("="*60)


def main():
    """主函数"""
    print("一鉴到底安全审计分析工具")
    print("="*60)

    # 创建分析器
    analyzer = SecurityAuditAnalyzer(days=7)

    # 执行分析
    report = analyzer.analyze()

    # 保存报告
    analyzer.save_report()

    # 打印摘要
    analyzer.print_summary()

    print("\n分析完成！")


if __name__ == '__main__':
    main()