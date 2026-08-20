"""
测试行为轨迹构建

验证：
1. AgentActivityLog自动聚合成BehaviorTrajectory
2. 攻击模式检测正常工作
3. 链路风险评分准确
"""

import os
import sys
import django
import requests
from datetime import datetime, timedelta
import time


def main():
    # 设置Django环境
    sys.path.insert(0, '.')
    os.environ['DJANGO_SETTINGS_MODULE'] = 'fangdudu_backend.settings'
    django.setup()

    from auth_app.agent_activity_models import AgentActivityLog
    from auth_app.trajectory_models import BehaviorTrajectory
    from auth_app.trajectory_builder import TrajectoryBuilder

    API_BASE = 'http://localhost:9092/api'

    print("=" * 60)
    print("测试Agent行为轨迹构建")
    print("=" * 60)

    # 清空测试数据
    print("\n清理旧测试数据...")
    AgentActivityLog.objects.filter(client_id='test_trajectory').delete()
    BehaviorTrajectory.objects.filter(client_id='test_trajectory').delete()

    # 构建攻击场景：数据外泄链路
    session_id = 'test_data_exfiltration_001'

    print(f"\n构建攻击场景: {session_id}")

    attack_sequence = [
        # 第1步：访问敏感文件
        {
            'agent_type': 'cursor',
            'action': 'file_operation',
            'target': '/workspace/.env',
            'risk_level': 'high',
            'risk_score': 75,
            'timestamp': datetime.now().isoformat(),
            'metadata': {'detected_types': ['apikey', 'secret']}
        },
        # 第2步：复制敏感数据
        {
            'agent_type': 'cursor',
            'action': 'clipboard_operation',
            'target': 'clipboard',
            'risk_level': 'high',
            'risk_score': 80,
            'timestamp': (datetime.now() + timedelta(seconds=5)).isoformat(),
            'metadata': {'content_type': 'api_keys'}
        },
        # 第3步：尝试外传
        {
            'agent_type': 'cursor',
            'action': 'network',
            'target': 'pastebin.com',
            'risk_level': 'critical',
            'risk_score': 90,
            'timestamp': (datetime.now() + timedelta(seconds=10)).isoformat(),
            'metadata': {'detected_types': ['data_exfil']}
        },
    ]

    # 发送批量上报
    payload = {
        'client_id': 'test_trajectory',
        'session_id': session_id,
        'activities': attack_sequence
    }

    print(f"\n发送 {len(attack_sequence)} 条攻击链路日志...")

    try:
        response = requests.post(
            f'{API_BASE}/agent-activities/batch/',
            json=payload,
            headers={'Content-Type': 'application/json'}
        )

        if response.ok:
            result = response.json()
            print(f"\n✅ 上报成功:")
            print(f"  创建记录数: {result['created_count']}")
            print(f"  触发告警数: {result['alerts_triggered']}")

            # 等待轨迹构建完成
            time.sleep(1)

            # 查询轨迹
            trajectory = BehaviorTrajectory.objects.filter(session_id=session_id).first()

            if trajectory:
                print(f"\n✅ 轨迹构建成功:")
                print(f"  轨迹ID: {trajectory.trajectory_id}")
                print(f"  总活动数: {trajectory.total_activities}")
                print(f"  链路风险: {trajectory.chain_risk_score:.1f}")
                print(f"  持续时间: {trajectory.duration_seconds}秒")
                print(f"  高风险活动: {trajectory.high_risk_count}")
                print(f"  严重风险活动: {trajectory.critical_count}")
                print(f"  异常标志: {trajectory.anomaly_flags}")

                print(f"\n📊 行为链路详情:")
                for i, activity in enumerate(trajectory.behavior_chain, 1):
                    print(f"  [{i}] {activity['agent_type']} - {activity['action']} - {activity['risk_score']}分")

                print(f"\n🔍 攻击模式检测:")
                if 'data_exfiltration' in trajectory.anomaly_flags:
                    print(f"  ✅ 检测到数据外泄模式")

                if trajectory.chain_risk_score >= 85:
                    print(f"  ✅ 链路风险评分正确（>=85）")

            else:
                print(f"\n❌ 轨迹未构建")

        else:
            print(f"\n❌ 上报失败: {response.status_code}")
            print(f"   {response.text}")

    except Exception as e:
        print(f"\n❌ 测试异常: {e}")
        import traceback
        traceback.print_exc()

    # 查询统计
    print(f"\n📈 轨迹统计:")
    stats = TrajectoryBuilder.get_trajectory_stats()
    for key, value in stats.items():
        print(f"  {key}: {value}")

    # 清理测试数据
    print("\n\n清理测试数据...")
    AgentActivityLog.objects.filter(client_id='test_trajectory').delete()
    BehaviorTrajectory.objects.filter(client_id='test_trajectory').delete()
    print("✅ 测试数据已清理")

    print("\n" + "=" * 60)
    print("✅ 轨迹构建测试完成！")
    print("=" * 60)


if __name__ == '__main__':
    main()
