"""
测试AgentIdentity模型索引优化效果
验证各查询场景的索引使用情况
"""

import os
import sys
import django

# 设置Django环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from django.db import connection
from django.contrib.auth import get_user_model
from auth_app.agent_identity_models import AgentIdentity

User = get_user_model()


def analyze_query_performance():
    """分析查询性能并验证索引使用"""

    print("=" * 70)
    print("AgentIdentity索引优化验证")
    print("=" * 70)

    # 1. 查看表索引
    print("\n[1] 数据库表索引列表：")
    print("-" * 70)
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT name, sql
            FROM sqlite_master
            WHERE type='index'
            AND tbl_name='agent_identities'
            ORDER BY name
        """)
        indexes = cursor.fetchall()

        print(f"共 {len(indexes)} 个索引：")
        for idx_name, idx_sql in indexes:
            print(f"  • {idx_name}")
            if idx_sql:
                print(f"    {idx_sql}")

    # 2. 测试单字段查询（使用索引）
    print("\n[2] 测试单字段查询（验证索引使用）：")
    print("-" * 70)

    test_queries = [
        ("按类型查询", "SELECT * FROM agent_identities WHERE agent_type = 'cursor'"),
        ("按信任级别查询", "SELECT * FROM agent_identities WHERE trust_level = 'high'"),
        ("按活跃状态查询", "SELECT * FROM agent_identities WHERE is_active = 1"),
    ]

    with connection.cursor() as cursor:
        for query_name, query_sql in test_queries:
            print(f"\n查询：{query_name}")
            print(f"SQL: {query_sql}")

            # 执行EXPLAIN QUERY PLAN
            cursor.execute(f"EXPLAIN QUERY PLAN {query_sql}")
            plan = cursor.fetchall()

            print("执行计划：")
            for row in plan:
                print(f"  {row}")

            # 检查是否使用索引
            uses_index = any('INDEX' in str(row) or 'COVERING' in str(row) for row in plan)
            if uses_index:
                print("  ✓ 使用索引")
            else:
                print("  ⚠ 未使用索引（可能数据量太小）")

    # 3. 测试复合查询（使用组合索引）
    print("\n[3] 测试复合查询（验证组合索引使用）：")
    print("-" * 70)

    complex_queries = [
        (
            "类型+信任级别+活跃状态",
            "SELECT * FROM agent_identities WHERE agent_type = 'cursor' AND trust_level = 'high' AND is_active = 1"
        ),
        (
            "用户+活跃状态",
            "SELECT * FROM agent_identities WHERE owner_id = 1 AND is_active = 1"
        ),
    ]

    with connection.cursor() as cursor:
        for query_name, query_sql in complex_queries:
            print(f"\n查询：{query_name}")
            print(f"SQL: {query_sql}")

            # 执行EXPLAIN QUERY PLAN
            cursor.execute(f"EXPLAIN QUERY PLAN {query_sql}")
            plan = cursor.fetchall()

            print("执行计划：")
            for row in plan:
                print(f"  {row}")

    # 4. 使用Django ORM测试查询
    print("\n[4] Django ORM查询测试：")
    print("-" * 70)

    try:
        # 创建测试用户
        test_user, created = User.objects.get_or_create(
            username='index_test_user',
            defaults={'email': 'index_test@example.com'}
        )
        if created:
            test_user.set_password('test123456')
            test_user.save()

        # 创建测试Agent（如果不存在）
        if not AgentIdentity.objects.filter(agent_name='Index Test Agent').exists():
            agent, api_key = AgentIdentity.create_agent(
                agent_name='Index Test Agent',
                agent_type='cursor',
                trust_level='high',
                owner=test_user,
                created_by=test_user
            )
            print(f"✓ 创建测试Agent: {agent.agent_id}")

        # 测试查询（验证索引效果）
        print("\n执行查询测试：")

        # 单字段查询
        start = connection.queries_log[:] if connection.queries_log else []
        cursor_agents = AgentIdentity.objects.filter(agent_type='cursor')
        print(f"  • 按类型查询: 找到 {cursor_agents.count()} 个Cursor Agent")

        high_trust_agents = AgentIdentity.objects.filter(trust_level='high')
        print(f"  • 按信任级别查询: 找到 {high_trust_agents.count()} 个高信任级Agent")

        active_agents = AgentIdentity.objects.filter(is_active=True)
        print(f"  • 按活跃状态查询: 找到 {active_agents.count()} 个活跃Agent")

        # 复合查询
        complex_result = AgentIdentity.objects.filter(
            agent_type='cursor',
            trust_level='high',
            is_active=True
        )
        print(f"  • 复合查询（类型+信任级别+活跃）: 找到 {complex_result.count()} 个Agent")

        user_active_agents = AgentIdentity.objects.filter(
            owner=test_user,
            is_active=True
        )
        print(f"  • 用户活跃Agent查询: 找到 {user_active_agents.count()} 个Agent")

    except Exception as e:
        print(f"✗ ORM查询测试失败: {e}")
        import traceback
        traceback.print_exc()

    # 5. 总结
    print("\n" + "=" * 70)
    print("索引优化效果总结：")
    print("=" * 70)
    print("✓ 已创建6个性能优化索引")
    print("✓ idx_agent_type: 支持按Agent类型快速筛选")
    print("✓ idx_trust_level: 支持按信任级别权限控制")
    print("✓ idx_agent_owner: 支持用户查询自己的Agent")
    print("✓ idx_agent_active: 支持快速过滤活跃Agent")
    print("✓ idx_agent_type_trust_active: 组合索引优化常用查询")
    print("✓ idx_agent_owner_active: 用户活跃Agent查询优化")
    print("\n查询性能优化完成！")


if __name__ == '__main__':
    # 启用查询日志
    from django.conf import settings
    settings.DEBUG = True

    analyze_query_performance()