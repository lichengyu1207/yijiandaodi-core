"""
误报率检测详细日志测试

创建人工复核数据，验证误报率检测的详细日志输出
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
import random

from auth_app.memory_models import LongTermMemory
from auth_app.behavior_models import BehaviorBaseline
from auth_app.self_audit_service import SelfAuditService
from django.contrib.auth import get_user_model

User = get_user_model()


class Command(BaseCommand):
    help = '误报率检测详细日志测试'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("\n" + "=" * 80))
        self.stdout.write(self.style.SUCCESS("误报率检测详细日志测试"))
        self.stdout.write(self.style.SUCCESS("=" * 80))

        # 1. 创建测试用户
        user, created = User.objects.get_or_create(
            username='test_verifier',
            defaults={'email': 'verifier@example.com', 'role': 'admin'}
        )
        self.stdout.write(f"\n[1] 创建测试用户: {user.username}")

        # 2. 创建误报率基线
        baseline, created = BehaviorBaseline.objects.get_or_create(
            agent_code='system',
            baseline_type='false_positive_rate',
            defaults={
                'accuracy': 5.0,  # 基线误报率5%
                'sample_count': 1000,
                'is_active': True
            }
        )
        self.stdout.write(
            f"[2] {'创建' if created else '已存在'}误报率基线: {baseline.accuracy}%"
        )

        # 3. 创建长期记忆（带人工复核）
        self.stdout.write(f"\n[3] 创建长期记忆数据（带人工复核）...")
        
        # 清理旧数据
        LongTermMemory.objects.filter(
            operation_type='false_positive_test'
        ).delete()

        # 创建100条记录，10条误报
        for i in range(100):
            # 前10条标记为误报（verified_result=True）
            # 后90条标记为正确（verified_result=False）
            is_false_positive = i < 10
            
            memory = LongTermMemory.objects.create(
                agent_id='test_agent',
                operation_type='false_positive_test',
                operation_content=f'test_operation_{i}',
                decision='block',  # 系统判定为危险
                risk_level='high',
                risk_score=0.8,
                verified_result=is_false_positive,  # True=误报, False=正确
                verified_by=user,
                verified_at=timezone.now() - timedelta(minutes=random.randint(1, 50)),
                verification_note='人工复核测试数据'
            )

        self.stdout.write(self.style.SUCCESS(f"    [OK] 已创建100条长期记忆"))
        self.stdout.write(f"    - 误报数(verified_result=True): 10条")
        self.stdout.write(f"    - 正确数(verified_result=False): 90条")
        self.stdout.write(f"    - 预期误报率: 10%")

        # 4. 运行误报率检测
        self.stdout.write(f"\n[4] 运行误报率检测...")
        self.stdout.write(f"    查看详细日志输出（需要DEBUG级别）:")

        drift_record = SelfAuditService.check_false_positive_rate(
            time_window=timedelta(hours=1)
        )

        # 5. 验证结果
        self.stdout.write(f"\n[5] 检测结果:")
        if drift_record:
            self.stdout.write(self.style.WARNING(f"    [ALERT] 检测到误报率异常！"))
            self.stdout.write(f"    - 漂移记录ID: {drift_record.id}")
            self.stdout.write(f"    - 当前误报率: {drift_record.current_value:.2%}")
            self.stdout.write(f"    - 基线误报率: {drift_record.baseline_value:.2%}")
            self.stdout.write(f"    - 偏离率: {drift_record.deviation_rate:.2%}")
            self.stdout.write(f"    - 严重程度: {drift_record.severity}")
            self.stdout.write(f"    - 样本数: {drift_record.sample_size}")
        else:
            self.stdout.write(self.style.SUCCESS(f"    [OK] 未检测到误报率异常"))

        # 6. 清理测试数据
        self.stdout.write(f"\n[6] 清理测试数据...")
        deleted_count = LongTermMemory.objects.filter(
            operation_type='false_positive_test'
        ).delete()[0]
        self.stdout.write(f"    已清理: {deleted_count}条长期记忆")

        self.stdout.write(self.style.SUCCESS("\n" + "=" * 80))
        self.stdout.write(self.style.SUCCESS("✓ 测试完成！"))
        self.stdout.write(self.style.SUCCESS("=" * 80))
        
        self.stdout.write("\n详细日志说明:")
        self.stdout.write("  - 查询条件日志: 显示数据库查询的详细条件")
        self.stdout.write("  - 计算过程日志: 显示误报率和偏离率的逐步计算")
        self.stdout.write("  - 阈值对比日志: 显示当前值与阈值的详细对比")
        self.stdout.write("  - 数据库写入日志: 显示PerformanceDriftRecord的创建参数")
        self.stdout.write("\n要查看DEBUG级别日志，请修改日志配置:")
        self.stdout.write("  'auth_app.self_audit_service': {'level': 'DEBUG'}")