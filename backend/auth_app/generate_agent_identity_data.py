# Agent身份可信层测试数据生成脚本
# 独立脚本，非单元测试，请直接运行: python generate_agent_identity_data.py

from auth_app.agent_identity_models import (
    AgentIdentity,
    AgentPermission,
    AgentAuthenticationLog,
)
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta

User = get_user_model()


def main():
    # 创建测试用户
    test_user, created = User.objects.get_or_create(
        username='test_user',
        defaults={
            'email': 'test@example.com'
        }
    )

    print(f"✅ {'创建' if created else '找到'}测试用户: {test_user.username}")

    # 创建测试Agent
    agent, api_key = AgentIdentity.objects.create_agent(
        agent_name='Test Agent',
        agent_type='cursor',
        trust_level='medium',
        owner=test_user,
        created_by=test_user
    )

    print(f"✅ 创建测试Agent: {agent.agent_id}")
    print(f"   API Key: {api_key}")  # 仅显示一次
    print(f"   信任级别: {agent.get_trust_level_description()}")

    # 创建测试权限
    permission1 = AgentPermission.objects.create(
        agent=agent,
        resource_type='file',
        resource_pattern='/home/user/documents/*',
        action='read',
        granted_by=test_user,
        conditions={'time_range': '09:00-18:00'}
    )

    permission2 = AgentPermission.objects.create(
        agent=agent,
        resource_type='network',
        resource_pattern='https://api.example.com/*',
        action='read',
        granted_by=test_user
    )

    print(f"✅ 创建测试权限: {permission1}")
    print(f"✅ 创建测试权限: {permission2}")

    # 测试API Key验证
    is_valid = agent.verify_api_key(api_key)
    print(f"✅ API Key验证: {'成功' if is_valid else '失败'}")

    # 更新最后活跃时间
    agent.update_last_active()
    print(f"✅ 更新最后活跃时间: {agent.last_active_at}")

    # 创建认证日志
    auth_log = AgentAuthenticationLog.objects.create(
        agent=agent,
        success=True,
        ip_address='127.0.0.1',
        user_agent='Test Client'
    )

    print(f"✅ 创建认证日志: {auth_log}")

    # 测试权限检查
    has_file_read = agent.has_permission('file', 'read')
    has_file_write = agent.has_permission('file', 'write')

    print(f"✅ 文件读取权限: {'有' if has_file_read else '无'}")
    print(f"✅ 文件写入权限: {'有' if has_file_write else '无'}")

    print("\n📊 测试数据创建完成！")
    print(f"Agent总数: {AgentIdentity.objects.count()}")
    print(f"权限总数: {AgentPermission.objects.count()}")
    print(f"认证日志总数: {AgentAuthenticationLog.objects.count()}")


if __name__ == '__main__':
    main()
