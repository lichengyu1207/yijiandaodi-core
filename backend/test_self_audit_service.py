"""
自监控系统测试脚本 - Self-Audit System Test Script

构造模拟数据并运行自监控服务，验证日志输出是否正常
"""

import os
import sys
import django

# 设置 Django 环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
sys.path.insert(0, r'c:\MsSafeData\Desktop\yijiandaodi\backend')
django.setup()

import logging
from datetime import timedelta
from django.utils import timezone
from django.contrib.auth import get_user_model

from auth_app.self_audit_service import SelfAuditService
from auth_app.memory_models import ShortTermMemory, LongTermMemory, StrategicMemory
from auth_app.behavior_models import BehaviorBaseline
from auth_app.agent_identity_models import AgentIdentity

# 配置日志
logging.basicConfig(
    level=logging.DEBUG,  # 显示所有详细日志
    format='%(levelname)s:%(name)s:%(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)

User = get_user_model()


def create_test_user():
    """创建测试用户"""
    logger.info("=" * 60)
    logger.info("步骤1: 创建测试用户")
    logger.info("=" * 60)

    user, created = User.objects.get_or_create(
        username='test_audit_user',
        defaults={
            'role': 'admin',
            'email': 'test@example.com'
        }
    )

    if created:
        logger.info(f"✓ 测试用户已创建: {user.username} (ID: {user.id})")
    else:
        logger.info(f"✓ 测试用户已存在: {user.username} (ID: {user.id})")

    return user


def create_behavior_baselines():
    """创建行为基线数据"""
    logger.info("=" * 60)
    logger.info("步骤2: 创建行为基线数据")
    logger.info("=" * 60)

    # 准确率基线
    baseline_accuracy, created = BehaviorBaseline.objects.get_or_create(
        agent_code='system',
        baseline_type='accuracy',
        metric_name='accuracy',
        defaults={
            'sample_count': 1000,
            'accuracy': 95.0,
            'is_active': True
        }
    )

    if created:
        logger.info(f"✓ 准确率基线已创建: {baseline_accuracy.accuracy}% (ID: {baseline_accuracy.id})")
    else:
        logger.info(f"✓ 准确率基线已存在: {baseline_accuracy.accuracy}% (ID: {baseline_accuracy.id})")

    # 误报率基线
    baseline_fp, created = BehaviorBaseline.objects.get_or_create(
        agent_code='system',
        baseline_type='false_positive_rate',
        defaults={
            'sample_count': 1000,
            'accuracy': 97.0,
            'is_active': True
        }
    )

    if created:
        logger.info(f"✓ 误报率基线已创建: {baseline_fp.accuracy}% (ID: {baseline_fp.id})")
    else:
        logger.info(f"✓ 误报率基线已存在: {baseline_fp.accuracy}% (ID: {baseline_fp.id})")

    return baseline_accuracy, baseline_fp


def create_short_term_memories(user):
    """创建短期记忆数据"""
    logger.info("=" * 60)
    logger.info("步骤3: 创建短期记忆数据")
    logger.info("=" * 60)

    # 清理旧数据
    ShortTermMemory.objects.filter(user=user).delete()
    logger.info("✓ 已清理旧的短期记忆数据")

    # 创建新的短期记忆（模拟准确率接近基线）
    now = timezone.now()

    # 创建100条记录，大部分是安全的（模拟93%准确率）
    safe_count = 0
    danger_count = 0

    for i in range(100):
        is_safe = i < 93  # 前93条是安全的，后7条是危险的

        # 模拟响应时间（大部分在500-1000ms，少数超过2000ms）
        if i < 90:
            response_time = 500 + i * 5  # 500-950ms（正常范围）
        else:
            response_time = 2100 + i * 10  # 2100-2170ms（超过P99阈值）

        ShortTermMemory.objects.create(
            user=user,
            operation_type='file_access' if i % 2 == 0 else 'api_call',
            operation_content=f'test_operation_{i}',
            decision='allow' if is_safe else 'block',
            risk_level='safe' if is_safe else 'high',
            risk_score=10 if is_safe else 80,
            metadata={
                'response_time': response_time,
                'test_data': True
            }
        )

        if is_safe:
            safe_count += 1
        else:
            danger_count += 1

    logger.info(f"✓ 已创建100条短期记忆数据: 安全={safe_count}, 危险={danger_count}")
    logger.info(f"✓ 准确率: {safe_count / 100 * 100:.1f}%")
    logger.info(f"✓ 响应时间范围: 500-2170ms (10条超过2000ms阈值)")

    return safe_count, danger_count


def create_long_term_memories(user):
    """创建长期记忆数据"""
    logger.info("=" * 60)
    logger.info("步骤4: 创建长期记忆数据")
    logger.info("=" * 60)

    # 清理旧数据
    LongTermMemory.objects.filter(user=user).delete()
    logger.info("✓ 已清理旧的长期记忆数据")

    # 创建长期记忆（模拟少量误报）
    false_positive_count = 0
    true_positive_count = 0

    for i in range(50):
        # 系统判定
        system_safe = i < 45  # 前45条系统判定为安全

        # 人工复核结果（95%与系统一致，5%是误报）
        if system_safe:
            verified_result = True  # 系统判定安全，人工也确认安全
            true_positive_count += 1
        else:
            # 系统判定危险，但有2条人工确认为安全（误报）
            if i < 47:
                verified_result = False  # 人工确认危险
            else:
                verified_result = True  # 人工确认安全（误报）
                false_positive_count += 1

        LongTermMemory.objects.create(
            user=user,
            operation_type='file_access',
            operation_content=f'verified_operation_{i}',
            verified_result=verified_result,
            verification_notes='测试数据' if verified_result else None
        )

    logger.info(f"✓ 已创建50条长期记忆数据")
    logger.info(f"✓ 真阳性: {true_positive_count}, 误报: {false_positive_count}")
    logger.info(f"✓ 误报率: {false_positive_count / 50 * 100:.1f}%")

    return false_positive_count


def create_strategic_memories():
    """创建策略记忆数据"""
    logger.info("=" * 60)
    logger.info("步骤5: 创建策略记忆数据")
    logger.info("=" * 60)

    # 清理旧数据
    StrategicMemory.objects.filter(strategy_id__startswith='test_').delete()
    logger.info("✓ 已清理旧的策略记忆数据")

    # 创建新规则（大部分是新鲜的，少部分是陈旧的）
    fresh_count = 0
    stale_count = 0

    for i in range(10):
        # 前8条是新鲜规则，后2条是陈旧规则
        if i < 8:
            strategy = StrategicMemory.objects.create(
                strategy_id=f'test_fresh_rule_{i:03d}',
                rule_name=f'新鲜规则_{i}',
                strategy_type='detection_rule',
                rule_condition={'threshold': 0.8},
                is_active=True
            )
            fresh_count += 1
        else:
            strategy = StrategicMemory.objects.create(
                strategy_id=f'test_stale_rule_{i:03d}',
                rule_name=f'陈旧规则_{i}',
                strategy_type='detection_rule',
                rule_condition={'threshold': 0.6},
                is_active=True
            )
            # 模拟陈旧规则（120天前更新）
            strategy.updated_at = timezone.now() - timedelta(days=120)
            strategy.save()
            stale_count += 1

    logger.info(f"✓ 已创建10条策略记忆数据")
    logger.info(f"✓ 新鲜规则: {fresh_count}, 陈旧规则: {stale_count}")

    return fresh_count, stale_count


def run_self_audit_tests():
    """运行自监控测试"""
    logger.info("=" * 60)
    logger.info("步骤6: 运行自监控测试")
    logger.info("=" * 60)

    # 运行所有检查
    logger.info("\n" + "=" * 80)
    logger.info("开始运行 SelfAuditService.run_all_checks()...")
    logger.info("=" * 80 + "\n")

    results = SelfAuditService.run_all_checks()

    logger.info("\n" + "=" * 80)
    logger.info("测试结果汇总")
    logger.info("=" * 80)

    logger.info(f"准确率漂移: {'发现异常' if results['accuracy_drift'] else '正常'}")
    if results['accuracy_drift']:
        logger.info(f"  - 漂移记录ID: {results['accuracy_drift'].id}")
        logger.info(f"  - 严重程度: {results['accuracy_drift'].severity}")
        logger.info(f"  - 偏离率: {results['accuracy_drift'].deviation_rate:.2%}")

    logger.info(f"响应时间异常: {len(results['response_time_anomalies'])} 个")
    for i, anomaly in enumerate(results['response_time_anomalies'], 1):
        logger.info(f"  - 异常{i}: ID={anomaly.id}, 类型={anomaly.metadata.get('metric')}, 值={anomaly.current_value:.2f}ms")

    logger.info(f"误报率异常: {'发现异常' if results['false_positive_drift'] else '正常'}")
    if results['false_positive_drift']:
        logger.info(f"  - 漂移记录ID: {results['false_positive_drift'].id}")
        logger.info(f"  - 严重程度: {results['false_positive_drift'].severity}")

    logger.info(f"权限审计: 总变更={results['permission_audit'].get('total_changes', 0)}, 异常={len(results['permission_audit'].get('anomalies', []))}")

    logger.info(f"规则时效性: {len(results['rule_freshness'])} 条问题规则")
    for i, rule in enumerate(results['rule_freshness'], 1):
        logger.info(f"  - 问题{i}: {rule['strategy']}, 状态={rule['status']}, 距更新{rule['days_since_update']}天")

    return results


def main():
    """主函数"""
    logger.info("\n" + "=" * 80)
    logger.info("自监控系统测试开始")
    logger.info("=" * 80 + "\n")

    try:
        # 1. 创建测试用户
        user = create_test_user()

        # 2. 创建行为基线
        baseline_accuracy, baseline_fp = create_behavior_baselines()

        # 3. 创建短期记忆
        safe_count, danger_count = create_short_term_memories(user)

        # 4. 创建长期记忆
        false_positive_count = create_long_term_memories(user)

        # 5. 创建策略记忆
        fresh_count, stale_count = create_strategic_memories()

        # 6. 运行自监控测试
        results = run_self_audit_tests()

        logger.info("\n" + "=" * 80)
        logger.info("✓ 自监控系统测试完成！")
        logger.info("=" * 80)

        # 显示预期结果
        logger.info("\n预期结果:")
        logger.info("- 准确率漂移: 正常（93% vs 95%基线，偏离率约2%）")
        logger.info("- 响应时间异常: 1-2个（P99值约2170ms，超过2000ms阈值）")
        logger.info("- 误报率异常: 正常（4%误报率，未超过5%阈值）")
        logger.info("- 权限审计: 0次变更")
        logger.info("- 规则时效性: 2条陈旧规则（超过90天）")

    except Exception as e:
        logger.error(f"\n✗ 测试失败: {type(e).__name__}: {e}", exc_info=True)
        raise


if __name__ == '__main__':
    main()