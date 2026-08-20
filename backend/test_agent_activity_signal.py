"""测试Agent活动日志信号和风险评估"""

import os
import sys
import django


def main():
    # 设置Django环境
    sys.path.insert(0, '.')
    os.environ['DJANGO_SETTINGS_MODULE'] = 'fangdudu_backend.settings'
    django.setup()

    from auth_app.agent_activity_models import AgentActivityLog
    from auth_app.risk_assessment_service import RiskAssessmentService
    from django.utils import timezone
    import uuid

    print("=" * 60)
    print("测试Agent活动日志信号和风险评估")
    print("=" * 60)

    # 清空缓存
    RiskAssessmentService.clear_cache()

    # 创建测试会话ID
    session_id = f"test_signal_{uuid.uuid4().hex[:8]}"
    client_id = "test_client_signal"

    print(f"\n会话ID: {session_id}")
    print(f"客户端ID: {client_id}")

    # 测试场景：模拟高风险行为序列
    test_activities = [
        {'risk_score': 75, 'action': 'file_operation', 'agent_type': 'cursor'},
        {'risk_score': 80, 'action': 'clipboard_operation', 'agent_type': 'cursor'},
        {'risk_score': 85, 'action': 'file_operation', 'agent_type': 'cursor'},  # 应该触发high risk
    ]

    print("\n开始插入测试数据...")
    for i, activity_data in enumerate(test_activities, 1):
        # 创建活动日志
        activity = AgentActivityLog.objects.create(
            agent_type=activity_data['agent_type'],
            action=activity_data['action'],
            target=f"/test/file_{i}.py",
            risk_level='high' if activity_data['risk_score'] > 70 else 'medium',
            risk_score=activity_data['risk_score'],
            confidence=0.95,
            source='file',
            timestamp=timezone.now(),
            session_id=session_id,
            client_id=client_id,
            metadata={'test': True, 'sequence': i}
        )

        print(f"\n[{i}] 插入记录: {activity.activity_id}")
        print(f"    Agent: {activity.agent_type}")
        print(f"    Action: {activity.action}")
        print(f"    Risk Score: {activity.risk_score}")

        # 检查风险评估缓存状态
        cache_stats = RiskAssessmentService.get_cache_stats()
        print(f"    缓存状态: {cache_stats['total_activities']} 条活动")

    # 查看最终缓存统计
    print("\n" + "=" * 60)
    print("最终缓存统计:")
    cache_stats = RiskAssessmentService.get_cache_stats()
    print(f"  总会话数: {cache_stats['total_sessions']}")
    print(f"  总活动数: {cache_stats['total_activities']}")
    print(f"  Session详情: {cache_stats['sessions']}")

    # 查询数据库记录
    db_count = AgentActivityLog.objects.filter(session_id=session_id).count()
    print(f"\n数据库记录数: {db_count}")

    # 清理测试数据
    print("\n清理测试数据...")
    AgentActivityLog.objects.filter(session_id=session_id).delete()
    print("✅ 测试数据已清理")

    print("\n" + "=" * 60)
    print("✅ 信号测试完成！")
    print("=" * 60)


if __name__ == '__main__':
    main()
