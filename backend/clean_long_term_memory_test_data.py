"""
清理长期记忆测试数据
"""

import os
import sys
import django

# 设置Django环境
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
django.setup()

from auth_app.memory_models import LongTermMemory


def clean_cache_test_data():
    """清理缓存测试数据"""
    print("\n" + "=" * 60)
    print("清理长期记忆测试数据")
    print("=" * 60)

    test_agents = ['CacheTest-Agent-1', 'CacheTest-Agent-2', 'CacheTest-Agent-3']

    print("\n查询测试数据...")
    for agent in test_agents:
        count = LongTermMemory.objects.filter(agent_id=agent).count()
        print(f"  {agent}: {count} 条")

    total_before = LongTermMemory.objects.count()
    print(f"\n当前总记录数: {total_before}")

    print("\n删除测试数据...")
    deleted_count = 0
    for agent in test_agents:
        count = LongTermMemory.objects.filter(agent_id=agent).count()
        if count > 0:
            LongTermMemory.objects.filter(agent_id=agent).delete()
            deleted_count += count
            print(f"  删除 {agent}: {count} 条")

    total_after = LongTermMemory.objects.count()
    print(f"\n删除后总记录数: {total_after}")
    print(f"总计删除: {deleted_count} 条")

    print("\n" + "=" * 60)
    print("清理完成")
    print("=" * 60)


if __name__ == '__main__':
    clean_cache_test_data()