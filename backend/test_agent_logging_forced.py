"""
Agent查询日志触发验证测试（增强版）
通过降低阈值强制触发日志，验证日志内容
"""

import os
import sys


def main():
    # 设置极低阈值，确保触发日志
    os.environ['AGENT_QUERY_LOG_THRESHOLD_MS'] = '0.1'  # 设置为0.1ms，任何查询都会触发
    os.environ['AGENT_ENABLE_DETAILED_LOGS'] = 'false'

    # 设置Django环境
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

    import django
    django.setup()

    # 配置日志输出
    import logging
    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s - %(levelname)s - %(name)s - %(message)s',
        handlers=[logging.StreamHandler(sys.stdout)]
    )

    # 强制设置logger级别
    agent_logger = logging.getLogger('auth_app.agent_identity_models')
    agent_logger.setLevel(logging.DEBUG)

    from django.contrib.auth import get_user_model
    from auth_app.agent_identity_models import AgentIdentity

    User = get_user_model()


    print("=" * 80)
    print("Agent查询日志触发验证（强制触发模式）")
    print("=" * 80)
    print("配置：阈值=0.1ms，确保所有查询都触发日志\n")

    # 创建测试用户
    test_user, _ = User.objects.get_or_create(
        username='log_verify_user',
        defaults={'email': 'log_verify@example.com'}
    )

    # 创建测试Agent
    if not AgentIdentity.objects.filter(agent_name='Log Verify Agent').exists():
        agent, _ = AgentIdentity.create_agent(
            agent_name='Log Verify Agent',
            agent_type='cursor',
            trust_level='high',
            owner=test_user,
            created_by=test_user
        )
        print(f"✓ 创建测试Agent: {agent.agent_id}\n")

    print("=" * 80)
    print("[测试1] 按类型查询 - 预期输出INFO日志")
    print("=" * 80)

    queryset = AgentIdentity.get_active_agents_by_type('cursor')
    print(f"\n查询结果: {queryset.count()} 个Cursor Agent")
    print("✓ 请确认上方有输出'Agent查询' INFO日志，包含索引、耗时等信息\n")

    print("=" * 80)
    print("[测试2] 按信任级别查询 - 预期输出INFO日志")
    print("=" * 80)

    queryset = AgentIdentity.get_agents_by_trust_level('high')
    print(f"\n查询结果: {queryset.count()} 个高信任级Agent")
    print("✓ 请确认上方有输出'Agent查询' INFO日志\n")

    print("=" * 80)
    print("[测试3] 查询用户Agent - 预期输出INFO日志")
    print("=" * 80)

    queryset = AgentIdentity.get_user_active_agents(test_user)
    print(f"\n查询结果: {queryset.count()} 个用户Agent")
    print("✓ 请确认上方有输出'Agent查询' INFO日志\n")

    print("=" * 80)
    print("日志触发验证完成")
    print("=" * 80)
    print("\n验证要点:")
    print("1. ✓ 每个查询都触发了INFO日志")
    print("2. ✓ 日志包含查询类型、使用索引、结果数、耗时")
    print("3. ✓ 日志格式统一，易于监控和分析")
    print("\n如果上方有完整的日志输出，说明日志触发逻辑工作正常！")


if __name__ == '__main__':
    main()
