"""
快速清理所有测试数据脚本

无需交互，直接清理所有测试数据
"""

import os
import sys

# Django环境设置
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')

import django
django.setup()

from auth_app.memory_models import ShortTermMemory


def quick_cleanup():
    """快速清理所有测试数据"""
    print('开始清理测试数据...')

    # 测试Agent列表
    test_agents = [
        'GPT-4-Turbo',
        'Claude-3-Opus',
        'Gemini-Pro',
        'Llama-3-70B',
        'Qwen-2-72B',
        'DeepSeek-V3',
        'Yi-34B',
        'Baichuan-2-Turbo',
        'ExpiredAgent'
    ]

    # 查询当前总数
    total_before = ShortTermMemory.objects.count()
    print(f'清理前总数据量: {total_before} 条')

    # 统计需要删除的数据量
    total_to_delete = 0
    for agent in test_agents:
        count = ShortTermMemory.objects.filter(agent_id=agent).count()
        total_to_delete += count

    print(f'需要删除: {total_to_delete} 条')

    # 执行删除
    deleted_total = 0
    for agent in test_agents:
        count = ShortTermMemory.objects.filter(agent_id=agent).count()
        if count > 0:
            deleted, _ = ShortTermMemory.objects.filter(agent_id=agent).delete()
            deleted_total += count
            print(f'删除 {agent}: {count} 条')

    # 查询清理后总数
    total_after = ShortTermMemory.objects.count()

    print('\n清理完成！')
    print(f'清理前: {total_before} 条')
    print(f'清理后: {total_after} 条')
    print(f'已删除: {deleted_total} 条')


if __name__ == '__main__':
    quick_cleanup()