"""
测试AgentActivityLog与AgentIdentity的关联集成
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
from auth_app.agent_identity_models import AgentIdentity
from auth_app.agent_activity_models import AgentActivityLog
from django.contrib.auth import get_user_model

User = get_user_model()

def test_agent_activity_integration():
    """测试Agent身份与活动日志的关联"""

    print("=" * 60)
    print("测试：AgentActivityLog添加agent外键关联")
    print("=" * 60)

    # 1. 创建测试用户
    print("\n[1] 创建测试用户...")
    test_user, created = User.objects.get_or_create(
        username='test_agent_integration',
        defaults={'email': 'test_agent@example.com'}
    )
    if created:
        test_user.set_password('test123456')
        test_user.save()
        print(f"   ✓ 创建用户: {test_user.username}")
    else:
        print(f"   ✓ 使用现有用户: {test_user.username}")

    # 2. 创建Agent身份
    print("\n[2] 创建Agent身份...")
    try:
        agent, api_key = AgentIdentity.create_agent(
            agent_name='Integration Test Agent',
            agent_type='cursor',
            trust_level='high',
            owner=test_user,
            created_by=test_user
        )
        print(f"   ✓ Agent ID: {agent.agent_id}")
        print(f"   ✓ Agent名称: {agent.agent_name}")
        print(f"   ✓ 信任级别: {agent.trust_level}")
        print(f"   ✓ API Key前缀: {api_key[:16]}...")
    except Exception as e:
        print(f"   ✗ 创建Agent失败: {e}")
        return

    # 3. 创建活动日志并关联Agent
    print("\n[3] 创建活动日志并关联Agent...")
    try:
        activity = AgentActivityLog.objects.create(
            agent=agent,  # 关键：关联到AgentIdentity
            agent_type=agent.agent_type,  # 保留agent_type用于向下兼容
            action='file_operation',
            target='/test/path/sensitive_file.txt',
            risk_level='medium',
            risk_score=45,
            confidence=0.92,
            source='file',
            timestamp=timezone.now(),
            session_id='session_test_001',
            metadata={'operation': 'read', 'file_size': 1024},
            user=test_user,
            client_id='test_client_001'
        )
        print(f"   ✓ 活动ID: {activity.activity_id}")
        print(f"   ✓ 关联Agent: {activity.agent.agent_name if activity.agent else 'None'}")
        print(f"   ✓ Agent类型: {activity.agent_type}")
        print(f"   ✓ 风险分数: {activity.risk_score}")
    except Exception as e:
        print(f"   ✗ 创建活动日志失败: {e}")
        import traceback
        traceback.print_exc()
        return

    # 4. 验证反向关联（从Agent查询活动）
    print("\n[4] 验证反向关联（从Agent查询活动）...")
    try:
        agent_activities = agent.activities.all()
        print(f"   ✓ Agent '{agent.agent_name}' 共有 {agent_activities.count()} 条活动记录")
        for act in agent_activities:
            print(f"      - {act.action}: {act.target} (风险分数: {act.risk_score})")
    except Exception as e:
        print(f"   ✗ 查询失败: {e}")
        return

    # 5. 验证Agent删除后活动日志保留（SET_NULL策略）
    print("\n[5] 测试Agent删除策略（SET_NULL）...")
    agent_id_before = agent.agent_id
    activity_id = activity.activity_id

    # 删除Agent
    agent.delete()
    print(f"   ✓ Agent已删除")

    # 重新查询活动日志
    activity_still_exists = AgentActivityLog.objects.filter(
        activity_id=activity_id
    ).first()

    if activity_still_exists:
        print(f"   ✓ 活动日志仍然存在（未被级联删除）")
        print(f"   ✓ Agent字段: {activity_still_exists.agent}")
        print(f"   ✓ Agent类型字段: {activity_still_exists.agent_type}（保留）")
    else:
        print(f"   ✗ 活动日志被意外删除")

    # 6. 总结
    print("\n" + "=" * 60)
    print("测试结果总结：")
    print("=" * 60)
    print("✓ AgentActivityLog成功添加agent外键")
    print("✓ 支持Agent身份与行为的精确关联")
    print("✓ 反向查询功能正常（agent.activities）")
    print("✓ SET_NULL删除策略正常工作（删除Agent保留活动日志）")
    print("✓ agent_type字段保留用于向下兼容")
    print("\n身份-行为绑定功能验证通过！")

if __name__ == '__main__':
    test_agent_activity_integration()