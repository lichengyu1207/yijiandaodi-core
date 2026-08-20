"""
清理测试数据脚本

删除测试生成的所有短期记忆数据
"""

import os
import sys

# Django环境设置
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')

import django
django.setup()

from auth_app.memory_models import ShortTermMemory


def cleanup_all_test_data():
    """清理所有测试数据"""
    print('\n' + '█'*60)
    print('清理测试数据脚本')
    print('█'*60)

    # 测试Agent列表（包含测试脚本中使用的所有Agent）
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

    print('\n开始清理测试数据...\n')

    # 查询当前总数
    total_before = ShortTermMemory.objects.count()
    print(f'清理前总数据量: {total_before} 条\n')

    # 统计各Agent数据量
    print('各Agent数据量:')
    total_to_delete = 0
    for agent in test_agents:
        count = ShortTermMemory.objects.filter(agent_id=agent).count()
        if count > 0:
            print(f'  {agent}: {count} 条')
            total_to_delete += count

    print(f'\n总计需要删除: {total_to_delete} 条\n')

    if total_to_delete == 0:
        print('没有找到测试数据，无需清理。')
        return

    # 确认删除
    print('⚠️  警告：即将删除所有测试数据！')
    print('是否继续？ (yes/no): ', end='')

    try:
        response = input().strip().lower()
        if response != 'yes':
            print('\n取消清理操作。')
            return
    except:
        print('\n无法确认，取消清理操作。')
        return

    # 执行删除
    print('\n正在删除数据...\n')

    deleted_total = 0
    for agent in test_agents:
        count = ShortTermMemory.objects.filter(agent_id=agent).count()
        if count > 0:
            deleted, _ = ShortTermMemory.objects.filter(agent_id=agent).delete()
            deleted_total += deleted
            print(f'✅ 删除 {agent}: {count} 条')

    # 查询清理后总数
    total_after = ShortTermMemory.objects.count()

    print('\n' + '█'*60)
    print('清理完成！')
    print('█'*60)
    print(f'\n📊 清理统计:')
    print(f'   清理前: {total_before} 条')
    print(f'   清理后: {total_after} 条')
    print(f'   已删除: {deleted_total} 条')
    print()


def cleanup_expired_data():
    """清理过期数据"""
    from django.utils import timezone
    from datetime import timedelta

    print('\n' + '█'*60)
    print('清理过期数据')
    print('█'*60)

    threshold = timezone.now() - timedelta(minutes=30)

    # 查询过期数据
    expired_count = ShortTermMemory.objects.filter(
        timestamp__lt=threshold
    ).count()

    print(f'\n发现 {expired_count} 条过期数据（30分钟前）')

    if expired_count > 0:
        print('是否清理过期数据？ (yes/no): ', end='')

        try:
            response = input().strip().lower()
            if response == 'yes':
                deleted, _ = ShortTermMemory.objects.filter(
                    timestamp__lt=threshold
                ).delete()
                print(f'\n✅ 已删除 {deleted} 条过期数据')
        except:
            print('\n取消清理。')
    else:
        print('\n没有过期数据需要清理。')


def cleanup_by_date_range():
    """按日期范围清理"""
    from datetime import datetime

    print('\n' + '█'*60)
    print('按日期范围清理')
    print('█'*60)

    print('\n请输入日期范围（格式: YYYY-MM-DD）')
    print('例如: 2026-08-10')

    try:
        start_date = input('开始日期: ').strip()
        end_date = input('结束日期: ').strip()

        start = datetime.strptime(start_date, '%Y-%m-%d')
        end = datetime.strptime(end_date, '%Y-%m-%d')

        # 统计数据量
        from django.utils import timezone
        count = ShortTermMemory.objects.filter(
            timestamp__date__gte=start.date(),
            timestamp__date__lte=end.date()
        ).count()

        print(f'\n找到 {count} 条数据')

        if count > 0:
            print('是否删除？ (yes/no): ', end='')
            response = input().strip().lower()

            if response == 'yes':
                deleted, _ = ShortTermMemory.objects.filter(
                    timestamp__date__gte=start.date(),
                    timestamp__date__lte=end.date()
                ).delete()
                print(f'\n✅ 已删除 {deleted} 条数据')

    except Exception as e:
        print(f'\n❌ 错误: {str(e)}')


def main():
    """主菜单"""
    print('\n' + '█'*60)
    print('测试数据清理工具')
    print('█'*60)

    print('\n请选择操作:')
    print('1. 清理所有测试数据')
    print('2. 清理过期数据（30分钟前）')
    print('3. 按日期范围清理')
    print('4. 查看当前数据量')
    print('0. 退出')

    print('\n请输入选项 (0-4): ', end='')

    try:
        choice = input().strip()

        if choice == '1':
            cleanup_all_test_data()
        elif choice == '2':
            cleanup_expired_data()
        elif choice == '3':
            cleanup_by_date_range()
        elif choice == '4':
            total = ShortTermMemory.objects.count()
            print(f'\n当前短期记忆总数据量: {total} 条')
        elif choice == '0':
            print('\n退出清理工具。')
            return
        else:
            print('\n无效的选项。')

    except KeyboardInterrupt:
        print('\n\n操作已取消。')
    except Exception as e:
        print(f'\n错误: {str(e)}')


if __name__ == '__main__':
    main()