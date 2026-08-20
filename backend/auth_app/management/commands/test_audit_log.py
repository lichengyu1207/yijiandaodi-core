"""
简化版自监控系统测试 - 验证日志输出

不创建复杂的模拟数据，直接运行核心功能观察日志输出
"""

from django.core.management.base import BaseCommand
import logging

from auth_app.self_audit_service import SelfAuditService

# 配置日志
logging.basicConfig(
    level=logging.DEBUG,
    format='%(levelname)s:%(name)s:%(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = '简化版测试：验证自监控系统的日志输出'

    def handle(self, *args, **options):
        """主处理函数"""
        self.stdout.write(self.style.SUCCESS("\n" + "=" * 80))
        self.stdout.write(self.style.SUCCESS("简化版自监控系统测试 - 验证日志输出"))
        self.stdout.write(self.style.SUCCESS("=" * 80 + "\n"))

        try:
            self.stdout.write(self.style.SUCCESS("运行 SelfAuditService.run_all_checks()...\n"))

            # 运行所有检查，观察日志输出
            results = SelfAuditService.run_all_checks()

            self.stdout.write("\n" + "=" * 80)
            self.stdout.write(self.style.SUCCESS("测试完成！"))
            self.stdout.write("=" * 80)

            self.stdout.write("\n结果摘要:")
            self.stdout.write(f"- 准确率漂移检测: { '发现异常' if results['accuracy_drift'] else '正常'}")
            self.stdout.write(f"- 响应时间异常检测: 发现 {len(results['response_time_anomalies'])} 个异常")
            self.stdout.write(f"- 误报率检测: {'发现异常' if results['false_positive_drift'] else '正常'}")
            self.stdout.write(f"- 权限审计: 总变更={results['permission_audit'].get('total_changes', 0)}")
            self.stdout.write(f"- 规则时效性: {len(results['rule_freshness'])} 条问题规则")

            self.stdout.write("\n" + self.style.SUCCESS("[OK] 日志输出验证完成！"))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"\n[ERROR] 测试失败: {type(e).__name__}: {e}"))
            logger.error(f"详细错误信息:", exc_info=True)
            raise