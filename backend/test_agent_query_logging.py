"""
测试AgentIdentity查询方法的日志记录功能
验证索引使用情况和执行耗时记录
"""

import os
import sys
import django
import logging

# 设置Django环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

# 配置日志输出到控制台
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

from django.contrib.auth import get_user_model
from auth_app.agent_identity_models import AgentIdentity

User = get_user_model()


def test_query_logging():
    """测试查询日志记录功能"""

    print("=" * 80)
    print("AgentIdentity查询日志记录测试")
    print("=" * 80)

    # 1. 创建测试用户和Agent
    print("\n[准备] 创建测试数据...")
    test_user, created = User.objects.get_or_create(
        username='query_log_test_user',
        defaults={'email': 'query_log_test@example.com'}
    )
    if created:
        test_user.set_password('test123456')
        test_user.save()
        print(f"✓ 创建测试用户: {test_user.username}")

    # 创建测试Agent
    if not AgentIdentity.objects.filter(agent_name='Query Log Test Agent').exists():
        agent, api_key = AgentIdentity.create_agent(
            agent_name='Query Log Test Agent',
            agent_type='cursor',
            trust_level='high',
            owner=test_user,
            created_by=test_user
        )
        print(f"✓ 创建测试Agent: {agent.agent_id}")
        print(f"  API Key: {api_key[:16]}...")

    print("\n" + "=" * 80)
    print("[测试1] 按类型查询活跃Agent - get_active_agents_by_type()")
    print("=" * 80)

    try:
        queryset = AgentIdentity.get_active_agents_by_type('cursor')
        print(f"✓ 查询成功，找到 {queryset.count()} 个Cursor Agent")
    except Exception as e:
        print(f"✗ 查询失败: {e}")

    print("\n" + "=" * 80)
    print("[测试2] 按信任级别查询Agent - get_agents_by_trust_level()")
    print("=" * 80)

    try:
        # 测试只查询活跃Agent
        queryset1 = AgentIdentity.get_agents_by_trust_level('high', active_only=True)
        print(f"✓ 查询活跃高信任级Agent成功，找到 {queryset1.count()} 个")

        # 测试查询所有Agent（包括非活跃）
        queryset2 = AgentIdentity.get_agents_by_trust_level('high', active_only=False)
        print(f"✓ 查询所有高信任级Agent成功，找到 {queryset2.count()} 个")
    except Exception as e:
        print(f"✗ 查询失败: {e}")

    print("\n" + "=" * 80)
    print("[测试3] 查询用户活跃Agent - get_user_active_agents()")
    print("=" * 80)

    try:
        queryset = AgentIdentity.get_user_active_agents(test_user)
        print(f"✓ 查询成功，用户 {test_user.username} 有 {queryset.count()} 个活跃Agent")
    except Exception as e:
        print(f"✗ 查询失败: {e}")

    print("\n" + "=" * 80)
    print("[测试4] API Key验证日志 - verify_api_key_with_logging()")
    print("=" * 80)

    # 获取测试Agent
    test_agent = AgentIdentity.objects.filter(agent_name='Query Log Test Agent').first()
    if test_agent:
        # 重新生成API Key用于测试
        _, test_api_key = AgentIdentity.generate_api_key()
        test_agent.set_api_key(test_api_key)
        test_agent.save()

        print(f"测试Agent: {test_agent.agent_id}")
        print(f"API Key: {test_api_key[:16]}...")

        # 测试正确验证
        print("\n测试正确的API Key:")
        result = test_agent.verify_api_key_with_logging(test_api_key)
        print(f"验证结果: {result}")

        # 测试错误的API Key
        print("\n测试错误的API Key:")
        result = test_agent.verify_api_key_with_logging("sk_live_wrong_key_123456789012345678901234567890")
        print(f"验证结果: {result}")

        # 测试禁用Agent后的验证
        print("\n测试禁用Agent后的验证:")
        test_agent.is_active = False
        test_agent.save()
        result = test_agent.verify_api_key_with_logging(test_api_key)
        print(f"验证结果: {result}")

        # 恢复Agent状态
        test_agent.is_active = True
        test_agent.save()

    print("\n" + "=" * 80)
    print("日志记录测试完成")
    print("=" * 80)
    print("\n请查看上方日志输出，确认以下信息：")
    print("✓ 查询类型和参数")
    print("✓ 使用的索引名称")
    print("✓ 查询结果数量")
    print("✓ 执行耗时（毫秒）")
    print("✓ 错误和警告信息")


if __name__ == '__main__':
    test_query_logging()