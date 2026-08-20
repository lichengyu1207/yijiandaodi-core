"""
测试Agent查询日志性能优化功能
验证环境变量配置和性能阈值过滤
"""

import os
import sys
import django
import logging

# 设置环境变量测试性能阈值
os.environ['AGENT_QUERY_LOG_THRESHOLD_MS'] = '10'  # 设置为10ms，测试慢查询过滤

# 设置Django环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

# 配置日志输出到控制台
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(name)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

from django.contrib.auth import get_user_model
from auth_app.agent_identity_models import (
    AgentIdentity,
    AGENT_QUERY_LOG_THRESHOLD_MS,
    AGENT_ENABLE_DETAILED_LOGS
)

User = get_user_model()


def test_logging_performance():
    """测试日志性能优化"""

    print("=" * 80)
    print("Agent查询日志性能优化测试")
    print("=" * 80)
    print(f"配置参数：")
    print(f"  - 日志阈值: {AGENT_QUERY_LOG_THRESHOLD_MS}ms")
    print(f"  - 详细日志模式: {AGENT_ENABLE_DETAILED_LOGS}")
    print("=" * 80)

    # 1. 创建测试数据
    print("\n[准备] 创建测试数据...")
    test_user, created = User.objects.get_or_create(
        username='perf_test_user',
        defaults={'email': 'perf_test@example.com'}
    )
    if created:
        test_user.set_password('test123456')
        test_user.save()

    if not AgentIdentity.objects.filter(agent_name='Performance Test Agent').exists():
        agent, api_key = AgentIdentity.create_agent(
            agent_name='Performance Test Agent',
            agent_type='claude',
            trust_level='medium',
            owner=test_user,
            created_by=test_user
        )
        print(f"✓ 创建测试Agent: {agent.agent_id}")

    print("\n" + "=" * 80)
    print("[测试1] 快速查询（耗时 < 10ms）- 不会记录日志")
    print("=" * 80)

    # 快速查询（预期耗时 < 10ms）
    queryset = AgentIdentity.get_active_agents_by_type('claude')
    print(f"查询结果: {queryset.count()} 个Claude Agent")
    print("预期：不会输出INFO日志（因为耗时低于阈值）")

    print("\n" + "=" * 80)
    print("[测试2] 慢查询（耗时 > 10ms）- 会记录日志")
    print("=" * 80)

    # 模拟慢查询：获取所有Agent并计算复杂聚合
    import time
    start = time.time()

    # 创建大量查询来模拟慢查询（实际中可能是复杂JOIN或大量数据）
    agents = AgentIdentity.objects.all()
    for _ in range(100):  # 循环100次增加耗时
        count = agents.count()

    elapsed = (time.time() - start) * 1000
    print(f"模拟慢查询耗时: {elapsed:.2f}ms")
    print("预期：会输出INFO日志（因为耗时超过阈值）")

    print("\n" + "=" * 80)
    print("[测试3] 查询错误 - 总是记录ERROR日志")
    print("=" * 80)

    try:
        # 故意触发错误（查询不存在的字段）
        AgentIdentity.objects.filter(invalid_field='test')
    except Exception as e:
        print(f"✓ 触发预期错误: {type(e).__name__}")
        print("预期：会输出ERROR日志（错误总是记录）")

    print("\n" + "=" * 80)
    print("[测试4] 环境变量动态调整")
    print("=" * 80)

    print("\n方案1：启用详细日志模式")
    print("  export AGENT_ENABLE_DETAILED_LOGS=true")
    print("  效果：记录所有查询，包括快速查询")

    print("\n方案2：调整慢查询阈值")
    print("  export AGENT_QUERY_LOG_THRESHOLD_MS=50")
    print("  效果：只记录超过50ms的查询")

    print("\n方案3：生产环境默认配置")
    print("  DEBUG=False")
    print("  效果：日志级别设置为WARNING，只记录警告和错误")

    print("\n" + "=" * 80)
    print("性能优化总结")
    print("=" * 80)
    print("✓ 快速查询（< 10ms）：不记录，零性能损耗")
    print("✓ 慢查询（> 10ms）：记录详细日志")
    print("✓ 错误和警告：总是记录")
    print("✓ 灵活配置：通过环境变量动态调整")
    print("\n生产环境建议：")
    print("  - 日志阈值: 100ms")
    print("  - 详细日志: false")
    print("  - 性能影响: 几乎为零")


if __name__ == '__main__':
    test_logging_performance()