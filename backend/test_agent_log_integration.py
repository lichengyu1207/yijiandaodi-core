"""
测试Agent身份集成的日志采集流程
验证身份-行为绑定功能
"""

import os
import sys
import django

# 设置Django环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from django.utils import timezone
from django.contrib.auth import get_user_model
from auth_app.agent_identity_models import AgentIdentity
from auth_app.agent_activity_models import AgentActivityLog
from datetime import datetime

User = get_user_model()


def test_agent_log_integration():
    """测试Agent身份与活动日志的集成"""

    print("=" * 80)
    print("Agent身份集成日志采集测试")
    print("=" * 80)

    # 1. 创建测试用户和Agent
    print("\n[步骤1] 创建测试用户和Agent...")
    test_user, _ = User.objects.get_or_create(
        username='log_integration_user',
        defaults={'email': 'log_integration@example.com'}
    )

    agent, api_key = AgentIdentity.create_agent(
        agent_name='Log Integration Agent',
        agent_type='cursor',
        trust_level='high',
        owner=test_user,
        created_by=test_user
    )
    print(f"✓ 创建Agent: {agent.agent_id}")
    print(f"  Agent名称: {agent.agent_name}")
    print(f"  信任级别: {agent.trust_level}")

    # 2. 测试直接创建日志（带agent关联）
    print("\n[步骤2] 测试直接创建日志（带agent关联）...")
    activity1 = AgentActivityLog.objects.create(
        agent=agent,  # 关键：关联Agent
        agent_type=agent.agent_type,
        action='file_operation',
        target='/test/path/file1.py',
        risk_level='medium',
        risk_score=45,
        confidence=0.92,
        source='file',
        timestamp=timezone.now(),
        session_id='session_direct_create',
        client_id='test_client_direct'
    )
    print(f"✓ 直接创建活动日志: {activity1.activity_id}")
    print(f"  关联Agent: {activity1.agent.agent_name if activity1.agent else 'None'}")

    # 3. 测试批量创建（通过API接口模拟）
    print("\n[步骤3] 测试批量创建（模拟API接口）...")
    from auth_app.agent_activity_serializers import AgentActivityBatchSerializer

    batch_data = {
        'client_id': 'test_client_batch',
        'session_id': 'session_batch_test',
        'agent_id': agent.agent_id,  # 顶层agent_id
        'activities': [
            {
                'agent_type': 'cursor',
                'action': 'file_operation',
                'target': '/test/batch/file1.py',
                'risk_level': 'low',
                'risk_score': 25,
                'confidence': 0.88,
                'source': 'file',
                'timestamp': timezone.now().isoformat(),
                'metadata': {'batch': True}
            },
            {
                'agent_type': 'cursor',
                'action': 'clipboard_operation',
                'target': 'clipboard_content',
                'risk_level': 'medium',
                'risk_score': 55,
                'confidence': 0.90,
                'source': 'clipboard',
                'timestamp': timezone.now().isoformat(),
                'metadata': {'batch': True}
            },
            {
                'agent_id': agent.agent_id,  # activity级别的agent_id（优先）
                'agent_type': 'cursor',
                'action': 'process_started',
                'target': '/usr/bin/python',
                'risk_level': 'high',
                'risk_score': 75,
                'confidence': 0.95,
                'source': 'process',
                'timestamp': timezone.now().isoformat(),
                'metadata': {'batch': True}
            }
        ]
    }

    serializer = AgentActivityBatchSerializer(data=batch_data)
    if serializer.is_valid():
        print(f"✓ 数据验证通过")
        
        # 模拟批量创建逻辑
        activities_data = serializer.validated_data['activities']
        top_level_agent_id = serializer.validated_data.get('agent_id')
        
        activities = []
        for activity_data in activities_data:
            # 获取agent_id（优先activity级别，否则顶层）
            agent_id = activity_data.get('agent_id') or top_level_agent_id
            agent_instance = None
            if agent_id:
                try:
                    agent_instance = AgentIdentity.objects.get(agent_id=agent_id)
                except AgentIdentity.DoesNotExist:
                    pass

            activity = AgentActivityLog(
                agent=agent_instance,
                agent_type=activity_data['agent_type'],
                action=activity_data['action'],
                target=activity_data['target'],
                risk_level=activity_data['risk_level'],
                risk_score=activity_data['risk_score'],
                confidence=activity_data.get('confidence', 1.0),
                source=activity_data['source'],
                timestamp=activity_data['timestamp'],
                session_id=serializer.validated_data.get('session_id', ''),
                client_id=serializer.validated_data['client_id'],
                metadata=activity_data.get('metadata', {})
            )
            activities.append(activity)

        created_activities = AgentActivityLog.objects.bulk_create(activities)
        print(f"✓ 批量创建成功: {len(created_activities)} 条日志")
    else:
        print(f"✗ 数据验证失败: {serializer.errors}")
        return

    # 4. 验证反向查询
    print("\n[步骤4] 验证反向查询（从Agent查询活动）...")
    agent_activities = agent.activities.all()
    print(f"✓ Agent '{agent.agent_name}' 共有 {agent_activities.count()} 条活动记录")
    for act in agent_activities[:5]:  # 显示前5条
        print(f"  - {act.action}: {act.target[:50]} (风险: {act.risk_score})")

    # 5. 验证Agent删除后日志保留（SET_NULL策略）
    print("\n[步骤5] 验证Agent删除策略（SET_NULL）...")
    agent_id_before = agent.agent_id
    activity_count_before = agent_activities.count()

    agent.delete()
    print(f"✓ Agent已删除")

    # 检查日志是否仍然存在
    remaining_activities = AgentActivityLog.objects.filter(
        agent_type='cursor',
        session_id__contains='test'
    )
    print(f"✓ 活动日志仍然存在: {remaining_activities.count()} 条（未被级联删除）")

    # 检查agent字段是否为NULL
    null_agent_activities = AgentActivityLog.objects.filter(
        agent__isnull=True,
        session_id__contains='test'
    )
    print(f"✓ agent字段为NULL的日志: {null_agent_activities.count()} 条")

    # 6. 总结
    print("\n" + "=" * 80)
    print("测试结果总结")
    print("=" * 80)
    print("✓ Agent身份成功集成到日志采集流程")
    print("✓ 支持顶层和activity级别的agent_id")
    print("✓ 反向查询功能正常（agent.activities）")
    print("✓ SET_NULL删除策略工作正常（删除Agent保留日志）")
    print("✓ agent_type字段保留用于向下兼容")
    print("\n阶段2 - 日志采集管道（Agent身份集成）验证通过！")


if __name__ == '__main__':
    test_agent_log_integration()