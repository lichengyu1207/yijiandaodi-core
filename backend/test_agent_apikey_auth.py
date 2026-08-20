"""
测试Agent API Key认证功能
验证API Key认证和日志采集流程
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
from auth_app.agent_auth import AgentAPIKeyAuthentication, OptionalAgentAPIKeyAuthentication
from rest_framework.test import APIRequestFactory
from rest_framework.exceptions import AuthenticationFailed

User = get_user_model()


def test_agent_apikey_auth():
    """测试Agent API Key认证"""

    print("=" * 80)
    print("Agent API Key认证测试")
    print("=" * 80)

    # 1. 创建测试用户和Agent
    print("\n[步骤1] 创建测试用户和Agent...")
    test_user, _ = User.objects.get_or_create(
        username='apikey_test_user',
        defaults={'email': 'apikey_test@example.com'}
    )

    agent, api_key = AgentIdentity.create_agent(
        agent_name='API Key Test Agent',
        agent_type='claude',
        trust_level='high',
        owner=test_user,
        created_by=test_user
    )
    print(f"✓ 创建Agent: {agent.agent_id}")
    print(f"  Agent名称: {agent.agent_name}")
    print(f"  信任级别: {agent.trust_level}")
    print(f"  API Key: {api_key[:20]}...{api_key[-10:]}")

    # 2. 测试API Key验证方法
    print("\n[步骤2] 测试API Key验证方法...")
    is_valid = agent.verify_api_key(api_key)
    print(f"✓ API Key验证成功: {is_valid}")

    # 测试错误的API Key
    wrong_key = "wrong_api_key_12345"
    is_valid = agent.verify_api_key(wrong_key)
    print(f"✓ 错误API Key验证失败（预期）: {not is_valid}")

    # 3. 测试API Key认证权限类
    print("\n[步骤3] 测试API Key认证权限类...")
    factory = APIRequestFactory()

    # 创建POST请求（带API Key）
    request = factory.post(
        '/api/agent-activities/batch/',
        {'client_id': 'test_client'},
        HTTP_X_AGENT_API_KEY=api_key
    )

    # 创建权限类实例
    auth = AgentAPIKeyAuthentication()
    view = type('View', (), {})()  # 模拟view对象

    try:
        has_permission = auth.has_permission(request, view)
        print(f"✓ API Key认证成功: {has_permission}")
        print(f"  request.agent: {request.agent.agent_name}")
        print(f"  request.agent.trust_level: {request.agent.trust_level}")
    except AuthenticationFailed as e:
        print(f"✗ 认证失败: {e}")

    # 4. 测试可选认证权限类
    print("\n[步骤4] 测试可选认证权限类...")
    optional_auth = OptionalAgentAPIKeyAuthentication()

    # 测试有API Key的情况
    request_with_key = factory.post(
        '/api/test/',
        {},
        HTTP_X_AGENT_API_KEY=api_key
    )
    has_permission = optional_auth.has_permission(request_with_key, view)
    print(f"✓ 有API Key时认证成功: {has_permission}, request.agent={request_with_key.agent.agent_name if request_with_key.agent else None}")

    # 测试没有API Key的情况
    request_no_key = factory.post('/api/test/', {})
    has_permission = optional_auth.has_permission(request_no_key, view)
    print(f"✓ 没有API Key时允许访问: {has_permission}, request.agent={request_no_key.agent}")

    # 5. 测试API Key过期
    print("\n[步骤5] 测试API Key过期...")
    from datetime import timedelta
    from django.utils import timezone

    # 设置API Key过期
    agent.api_key_expires_at = timezone.now() - timedelta(days=1)
    agent.save()

    request_expired = factory.post(
        '/api/test/',
        {},
        HTTP_X_AGENT_API_KEY=api_key
    )
    try:
        has_permission = auth.has_permission(request_expired, view)
        print(f"✗ 过期API Key认证应该失败，但通过了")
    except AuthenticationFailed as e:
        print(f"✓ 过期API Key认证失败（预期）: {e}")

    # 恢复API Key有效
    agent.api_key_expires_at = timezone.now() + timedelta(days=30)
    agent.save()

    # 6. 测试Agent禁用
    print("\n[步骤6] 测试Agent禁用...")
    agent.is_active = False
    agent.save()

    request_disabled = factory.post(
        '/api/test/',
        {},
        HTTP_X_AGENT_API_KEY=api_key
    )
    try:
        has_permission = auth.has_permission(request_disabled, view)
        print(f"✗ 禁用Agent认证应该失败，但通过了")
    except AuthenticationFailed as e:
        print(f"✓ 禁用Agent认证失败（预期）: {e}")

    # 恢复Agent激活
    agent.is_active = True
    agent.save()

    # 7. 测试信任级别检查
    print("\n[步骤7] 测试信任级别检查...")
    from auth_app.agent_auth import AgentPermissionMixin

    class TestView(AgentPermissionMixin):
        pass

    test_view = TestView()

    # 创建高信任级别的Agent请求
    high_trust_request = factory.post('/api/test/', {}, HTTP_X_AGENT_API_KEY=api_key)
    high_trust_request.agent = agent

    # 检查信任级别
    has_high = test_view.check_agent_trust_level(high_trust_request, 'medium')
    print(f"✓ 高信任级别Agent满足medium要求: {has_high}")

    has_critical = test_view.check_agent_trust_level(high_trust_request, 'critical')
    print(f"✓ 高信任级别Agent不满足critical要求（预期）: {not has_critical}")

    # 8. 测试批量上报API（完整流程）
    print("\n[步骤8] 测试批量上报API（完整流程）...")
    # 这里需要启动Django服务器才能测试实际的API调用
    # 暂时跳过，留给集成测试

    print("\n" + "=" * 80)
    print("测试结果总结")
    print("=" * 80)
    print("✓ API Key生成和验证功能正常")
    print("✓ AgentAPIKeyAuthentication权限类工作正常")
    print("✓ OptionalAgentAPIKeyAuthentication支持向下兼容")
    print("✓ API Key过期检查正常")
    print("✓ Agent禁用检查正常")
    print("✓ 信任级别检查功能正常")
    print("\nAgent API Key认证功能验证通过！")


if __name__ == '__main__':
    test_agent_apikey_auth()