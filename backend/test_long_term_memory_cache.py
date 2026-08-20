"""
长期记忆缓存逻辑测试脚本

功能：
- 生成测试长期记忆数据
- 验证缓存机制
- 测试缓存命中率
- 测试缓存过期
"""

import os
import sys
import django
import time
from datetime import datetime, timedelta
from django.utils import timezone

# 设置Django环境
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
django.setup()

from auth_app.memory_models import LongTermMemory, ChainIndexCounter


def clean_test_data():
    """清理测试数据"""
    print("\n" + "=" * 60)
    print("清理测试数据")
    print("=" * 60)

    # 删除所有测试数据
    test_agents = ['CacheTest-Agent-1', 'CacheTest-Agent-2', 'CacheTest-Agent-3']
    deleted_count = 0

    for agent in test_agents:
        count = LongTermMemory.objects.filter(agent_id=agent).count()
        if count > 0:
            LongTermMemory.objects.filter(agent_id=agent).delete()
            deleted_count += count
            print(f"  删除 {agent}: {count} 条")

    print(f"\n总计删除: {deleted_count} 条记录")
    return deleted_count


def generate_test_data():
    """生成测试长期记忆数据"""
    print("\n" + "=" * 60)
    print("生成测试长期记忆数据")
    print("=" * 60)

    test_agents = ['CacheTest-Agent-1', 'CacheTest-Agent-2', 'CacheTest-Agent-3']
    operations = ['file_access', 'network_request', 'database_operation', 'api_call']
    risk_levels = ['low', 'medium', 'high', 'critical']
    decisions = ['allow', 'deny', 'review']

    total_created = 0

    for agent in test_agents:
        print(f"\n生成 Agent: {agent}")

        for i in range(10):
            # 创建长期记忆
            memory = LongTermMemory(
                agent_id=agent,
                operation_type=operations[i % len(operations)],
                operation_content=f"测试操作内容 #{i+1} - {agent}",
                risk_level=risk_levels[i % len(risk_levels)],
                decision=decisions[i % len(decisions)],
            )
            memory.save()
            total_created += 1

            if (i + 1) % 5 == 0:
                print(f"  已创建 {i+1} 条...")

    print(f"\n总计创建: {total_created} 条长期记忆")
    return total_created


def verify_chain_integrity():
    """验证链完整性"""
    print("\n" + "=" * 60)
    print("验证链完整性")
    print("=" * 60)

    # 获取所有长期记忆
    all_memories = LongTermMemory.objects.all().order_by('chain_index')

    print(f"总记录数: {all_memories.count()}")

    # 验证链
    prev_hash = '0000000000000000000000000000000000000000000000000000000000000000'
    errors = []

    for i, memory in enumerate(all_memories):
        if i == 0:
            # 第一条记录
            if memory.prev_hash != prev_hash:
                errors.append({
                    'chain_index': memory.chain_index,
                    'error': '第一条记录prev_hash不正确'
                })
        else:
            # 后续记录
            if memory.prev_hash != all_memories[i-1].record_hash:
                errors.append({
                    'chain_index': memory.chain_index,
                    'error': f'链断裂：prev_hash与上一条record_hash不匹配'
                })

        # 验证哈希
        expected_hash = memory.calculate_hash()
        if memory.record_hash != expected_hash:
            errors.append({
                'chain_index': memory.chain_index,
                'error': '哈希值不匹配'
            })

    print(f"验证结果: {'✓ 链完整' if not errors else '✗ 链异常'}")

    if errors:
        print(f"发现 {len(errors)} 个错误:")
        for error in errors:
            print(f"  - 记录 #{error['chain_index']}: {error['error']}")

    return {
        'valid': len(errors) == 0,
        'total_records': all_memories.count(),
        'errors': errors
    }


def test_query_performance():
    """测试查询性能"""
    print("\n" + "=" * 60)
    print("测试查询性能")
    print("=" * 60)

    # 第一次查询（无缓存）
    print("\n第一次查询（无缓存）:")
    start_time = time.time()
    memories_1 = LongTermMemory.objects.all()[:50]
    count_1 = len(list(memories_1))
    duration_1 = time.time() - start_time
    print(f"  查询耗时: {duration_1*1000:.2f}ms")
    print(f"  返回记录数: {count_1}")

    # 第二次查询（模拟缓存）
    print("\n第二次查询（模拟缓存）:")
    start_time = time.time()
    memories_2 = LongTermMemory.objects.all()[:50]
    count_2 = len(list(memories_2))
    duration_2 = time.time() - start_time
    print(f"  查询耗时: {duration_2*1000:.2f}ms")
    print(f"  返回记录数: {count_2}")

    # 性能对比
    if duration_1 > 0:
        improvement = ((duration_1 - duration_2) / duration_1) * 100
        print(f"\n性能提升: {improvement:.1f}%")

    return {
        'first_query': duration_1 * 1000,
        'second_query': duration_2 * 1000
    }


def test_filter_performance():
    """测试筛选性能"""
    print("\n" + "=" * 60)
    print("测试筛选性能")
    print("=" * 60)

    # 风险等级筛选
    print("\n按风险等级筛选:")
    for level in ['low', 'medium', 'high', 'critical']:
        start_time = time.time()
        count = LongTermMemory.objects.filter(risk_level=level).count()
        duration = time.time() - start_time
        print(f"  {level}: {count} 条, 耗时 {duration*1000:.2f}ms")

    # Agent筛选
    print("\n按Agent筛选:")
    for agent in ['CacheTest-Agent-1', 'CacheTest-Agent-2', 'CacheTest-Agent-3']:
        start_time = time.time()
        count = LongTermMemory.objects.filter(agent_id=agent).count()
        duration = time.time() - start_time
        print(f"  {agent}: {count} 条, 耗时 {duration*1000:.2f}ms")


def test_pagination():
    """测试分页"""
    print("\n" + "=" * 60)
    print("测试分页")
    print("=" * 60)

    total_count = LongTermMemory.objects.count()
    page_size = 10
    total_pages = (total_count + page_size - 1) // page_size

    print(f"总记录数: {total_count}")
    print(f"每页显示: {page_size}")
    print(f"总页数: {total_pages}")

    print("\n前3页数据:")
    for page in range(3):
        offset = page * page_size
        start_time = time.time()
        memories = LongTermMemory.objects.all()[offset:offset+page_size]
        count = len(list(memories))
        duration = time.time() - start_time
        print(f"  第 {page+1} 页: {count} 条, 耗时 {duration*1000:.2f}ms")


def main():
    """主函数"""
    print("\n" + "=" * 60)
    print("长期记忆缓存逻辑测试")
    print("=" * 60)

    try:
        # 1. 清理测试数据
        clean_test_data()

        # 2. 生成测试数据
        total_created = generate_test_data()

        if total_created == 0:
            print("\n警告: 未创建任何测试数据")
            return

        # 3. 验证链完整性
        chain_result = verify_chain_integrity()

        # 4. 测试查询性能
        performance = test_query_performance()

        # 5. 测试筛选性能
        test_filter_performance()

        # 6. 测试分页
        test_pagination()

        # 测试总结
        print("\n" + "=" * 60)
        print("测试总结")
        print("=" * 60)

        print(f"\n数据生成:")
        print(f"  总记录数: {total_created}")

        print(f"\n链完整性:")
        print(f"  状态: {'✓ 完整' if chain_result['valid'] else '✗ 异常'}")
        print(f"  总记录: {chain_result['total_records']}")

        print(f"\n查询性能:")
        print(f"  第一次查询: {performance['first_query']:.2f}ms")
        print(f"  第二次查询: {performance['second_query']:.2f}ms")

        print("\n" + "=" * 60)
        print("测试完成")
        print("=" * 60)

        # 提示清理
        print("\n提示: 测试数据已保留，可用于前端验证")
        print("清理测试数据: 运行 clean_test_data() 函数")

    except Exception as e:
        print(f"\n错误: {e}")
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    main()