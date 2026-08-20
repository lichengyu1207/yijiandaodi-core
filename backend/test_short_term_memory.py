"""
短期记忆功能测试脚本

模拟真实AI Agent操作场景，验证短期记忆功能
"""

import os
import sys
import random
import time
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed

# Django环境设置
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')

import django
django.setup()

from auth_app.memory_models import ShortTermMemory
from django.utils import timezone
from django.db import transaction


# ==================== 模拟真实场景数据 ====================

AGENTS = [
    'GPT-4-Turbo',
    'Claude-3-Opus',
    'Gemini-Pro',
    'Llama-3-70B',
    'Qwen-2-72B',
    'DeepSeek-V3',
    'Yi-34B',
    'Baichuan-2-Turbo'
]

OPERATION_TYPES = {
    'file_access': {
        'weight': 30,
        'templates': [
            '访问用户配置文件: /home/user/.config/settings.json',
            '读取日志文件: /var/log/app/debug.log',
            '写入临时文件: /tmp/cache/session_{id}.tmp',
            '创建目录: /home/user/Documents/Projects',
            '删除缓存文件: /tmp/cache/old_*.tmp',
            '修改配置: /etc/app/config.yaml',
            '读取数据库备份: /backup/db/2024-01.sql',
            '写入日志: /var/log/agent/activity.log'
        ]
    },
    'network_request': {
        'weight': 25,
        'templates': [
            '发送HTTP GET请求: https://api.example.com/data',
            '调用外部API: POST https://llm-provider.com/v1/chat',
            '下载文件: https://cdn.example.com/models/base.tar.gz',
            '上传数据: PUT https://storage.cloud.com/bucket/key',
            'WebSocket连接: wss://realtime.example.com/stream',
            'DNS查询: example.com',
            'SSL证书验证: api.secure.com',
            '代理请求: http://proxy.internal:8080/forward'
        ]
    },
    'system_command': {
        'weight': 20,
        'templates': [
            '执行系统命令: ls -la /home/user',
            '进程管理: ps aux | grep python',
            '环境变量读取: echo $PATH',
            '系统信息获取: uname -a',
            '磁盘空间检查: df -h',
            '网络状态检查: netstat -an',
            '服务管理: systemctl status nginx',
            '用户权限检查: whoami'
        ]
    },
    'database_operation': {
        'weight': 15,
        'templates': [
            '查询数据: SELECT * FROM users WHERE id = {id}',
            '插入记录: INSERT INTO logs (message) VALUES (\'{message}\')',
            '更新状态: UPDATE tasks SET status = \'completed\' WHERE id = {id}',
            '删除过期数据: DELETE FROM cache WHERE expires_at < NOW()',
            '事务开始: BEGIN TRANSACTION',
            '创建索引: CREATE INDEX idx_timestamp ON logs(timestamp)',
            '备份数据库: pg_dump -U user dbname > backup.sql',
            '恢复数据: psql -U user dbname < backup.sql'
        ]
    },
    'api_call': {
        'weight': 10,
        'templates': [
            '调用内部API: GET /api/v1/users/{id}',
            '创建资源: POST /api/v1/projects',
            '更新配置: PATCH /api/v1/settings/{id}',
            '删除资源: DELETE /api/v1/cache/{key}',
            '批量操作: POST /api/v1/batch/process',
            '健康检查: GET /health',
            '认证请求: POST /auth/login',
            '文件上传: POST /api/v1/files/upload'
        ]
    }
}

RISK_WEIGHTS = {
    'low': 70,
    'medium': 20,
    'high': 8,
    'critical': 2
}

DECISION_WEIGHTS = {
    'allow': 85,
    'deny': 10,
    'review': 5
}


# ==================== 辅助函数 ====================

def get_weighted_random(choices_dict):
    """根据权重随机选择"""
    items = list(choices_dict.keys())
    weights = list(choices_dict.values())
    return random.choices(items, weights=weights, k=1)[0]


def generate_operation_content():
    """生成操作内容"""
    op_type = get_weighted_random({
        k: v['weight'] for k, v in OPERATION_TYPES.items()
    })

    template = random.choice(OPERATION_TYPES[op_type]['templates'])

    # 填充模板占位符
    content = template.format(
        id=random.randint(1, 1000),
        message=f'Log message {random.randint(1, 10000)}'
    )

    return op_type, content


def create_single_memory(agent_id=None, delay=0):
    """创建单条短期记忆"""
    if delay > 0:
        time.sleep(delay)

    if not agent_id:
        agent_id = random.choice(AGENTS)

    op_type, op_content = generate_operation_content()
    risk_level = get_weighted_random(RISK_WEIGHTS)
    decision = get_weighted_random(DECISION_WEIGHTS)

    # 高风险操作更容易被拦截
    if risk_level in ['high', 'critical']:
        if random.random() < 0.7:
            decision = 'deny'

    try:
        memory = ShortTermMemory.objects.create(
            agent_id=agent_id,
            operation_type=op_type,
            operation_content=op_content,
            risk_level=risk_level,
            decision=decision
        )

        return {
            'success': True,
            'id': memory.id,
            'agent': agent_id,
            'type': op_type,
            'risk': risk_level,
            'decision': decision
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


# ==================== 测试场景 ====================

def test_single_insert():
    """测试1：单条数据插入"""
    print('\n' + '='*60)
    print('测试1：单条数据插入')
    print('='*60)

    result = create_single_memory()

    if result['success']:
        print(f'✅ 成功创建记忆 ID: {result["id"]}')
        print(f'   Agent: {result["agent"]}')
        print(f'   类型: {result["type"]}')
        print(f'   风险: {result["risk"]}')
        print(f'   决策: {result["decision"]}')
    else:
        print(f'❌ 创建失败: {result["error"]}')

    return result


def test_batch_insert(count=10):
    """测试2：批量数据插入"""
    print('\n' + '='*60)
    print(f'测试2：批量插入 {count} 条数据')
    print('='*60)

    start_time = time.time()
    results = []

    with transaction.atomic():
        for i in range(count):
            result = create_single_memory()
            results.append(result)

            if (i + 1) % 5 == 0:
                print(f'进度: {i+1}/{count}')

    end_time = time.time()
    duration = end_time - start_time

    success_count = sum(1 for r in results if r['success'])
    failed_count = count - success_count

    print(f'\n📊 结果统计:')
    print(f'   成功: {success_count} 条')
    print(f'   失败: {failed_count} 条')
    print(f'   耗时: {duration:.2f} 秒')
    print(f'   平均: {duration/count*1000:.2f} 毫秒/条')

    return results


def test_concurrent_insert(count=20, workers=4):
    """测试3：并发数据插入"""
    print('\n' + '='*60)
    print(f'测试3：并发插入 {count} 条数据（{workers}个线程）')
    print('='*60)

    start_time = time.time()
    results = []

    with ThreadPoolExecutor(max_workers=workers) as executor:
        # 提交任务
        futures = [
            executor.submit(create_single_memory, delay=random.uniform(0, 0.1))
            for _ in range(count)
        ]

        # 收集结果
        for i, future in enumerate(as_completed(futures), 1):
            result = future.result()
            results.append(result)

            if i % 5 == 0:
                print(f'进度: {i}/{count}')

    end_time = time.time()
    duration = end_time - start_time

    success_count = sum(1 for r in results if r['success'])
    failed_count = count - success_count

    print(f'\n📊 结果统计:')
    print(f'   成功: {success_count} 条')
    print(f'   失败: {failed_count} 条')
    print(f'   耗时: {duration:.2f} 秒')
    print(f'   吞吐量: {count/duration:.2f} 条/秒')

    return results


def test_risk_distribution():
    """测试4：风险分布测试"""
    print('\n' + '='*60)
    print('测试4：风险分布测试（插入50条数据）')
    print('='*60)

    results = test_batch_insert(50)

    # 统计风险分布
    risk_stats = {'low': 0, 'medium': 0, 'high': 0, 'critical': 0}
    for result in results:
        if result['success']:
            risk_stats[result['risk']] += 1

    print(f'\n📊 风险分布:')
    total = sum(risk_stats.values())
    for risk, count in risk_stats.items():
        percentage = (count / total * 100) if total > 0 else 0
        bar = '█' * int(percentage / 2)
        print(f'   {risk:8s}: {count:2d} ({percentage:5.1f}%) {bar}')

    return risk_stats


def test_time_based_expiry():
    """测试5：时间过期测试"""
    print('\n' + '='*60)
    print('测试5：时间过期测试')
    print('='*60)

    # 创建测试数据
    print('\n创建测试数据...')
    create_single_memory()

    # 查询总数
    total_count = ShortTermMemory.objects.count()
    print(f'当前短期记忆总数: {total_count}')

    # 查询未过期数据
    threshold = timezone.now() - timedelta(minutes=30)
    active_count = ShortTermMemory.objects.filter(
        timestamp__gte=threshold
    ).count()

    print(f'未过期记录数: {active_count}')
    print(f'已过期记录数: {total_count - active_count}')

    # 手动创建一条过期记录
    print('\n手动创建过期记录（测试过期清理）...')
    expired_time = timezone.now() - timedelta(minutes=31)

    expired_memory = ShortTermMemory(
        agent_id='ExpiredAgent',
        operation_type='test',
        operation_content='这是一条过期的测试数据',
        risk_level='low',
        decision='allow',
        timestamp=expired_time,
        expires_at=expired_time + timedelta(minutes=30)
    )
    expired_memory.save()

    print(f'已创建过期记录 ID: {expired_memory.id}')

    return expired_memory


def test_agent_specific():
    """测试6：特定Agent数据测试"""
    print('\n' + '='*60)
    print('测试6：特定Agent数据测试')
    print('='*60)

    agent = 'GPT-4-Turbo'
    print(f'\n为Agent [{agent}] 创建10条数据...')

    results = []
    for i in range(10):
        result = create_single_memory(agent_id=agent)
        results.append(result)

    success_count = sum(1 for r in results if r['success'])

    print(f'\n📊 结果:')
    print(f'   Agent: {agent}')
    print(f'   成功: {success_count} 条')

    # 查询该Agent的数据
    agent_memories = ShortTermMemory.objects.filter(agent_id=agent)
    print(f'   数据库中该Agent的记录数: {agent_memories.count()}')

    return results


def test_performance_stress():
    """测试7：性能压力测试"""
    print('\n' + '='*60)
    print('测试7：性能压力测试（100条数据）')
    print('='*60)

    start_time = time.time()

    results = []
    batch_size = 20

    for i in range(5):  # 5批，每批20条
        batch_results = test_batch_insert(batch_size)
        results.extend(batch_results)

        elapsed = time.time() - start_time
        print(f'已插入 {len(results)} 条，耗时 {elapsed:.2f} 秒')

    end_time = time.time()
    total_duration = end_time - start_time

    success_count = sum(1 for r in results if r['success'])

    print(f'\n📊 性能统计:')
    print(f'   总数据量: {len(results)} 条')
    print(f'   成功: {success_count} 条')
    print(f'   总耗时: {total_duration:.2f} 秒')
    print(f'   吞吐量: {len(results)/total_duration:.2f} 条/秒')
    print(f'   平均耗时: {total_duration/len(results)*1000:.2f} 毫秒/条')


# ==================== 数据验证 ====================

def validate_data_integrity():
    """验证数据完整性"""
    print('\n' + '='*60)
    print('数据完整性验证')
    print('='*60)

    # 统计各Agent数据量
    from django.db.models import Count

    agent_stats = ShortTermMemory.objects.values('agent_id').annotate(
        count=Count('id')
    ).order_by('-count')

    print('\n📊 各Agent数据量:')
    for stat in agent_stats:
        print(f'   {stat["agent_id"]}: {stat["count"]} 条')

    # 统计风险分布
    risk_stats = ShortTermMemory.objects.values('risk_level').annotate(
        count=Count('id')
    ).order_by('risk_level')

    print('\n📊 风险分布:')
    for stat in risk_stats:
        print(f'   {stat["risk_level"]}: {stat["count"]} 条')

    # 统计操作类型分布
    op_stats = ShortTermMemory.objects.values('operation_type').annotate(
        count=Count('id')
    ).order_by('-count')

    print('\n📊 操作类型分布:')
    for stat in op_stats[:5]:  # 只显示前5
        print(f'   {stat["operation_type"]}: {stat["count"]} 条')

    # 总数
    total = ShortTermMemory.objects.count()
    print(f'\n总计: {total} 条短期记忆')


# ==================== 清理测试数据 ====================

def cleanup_test_data():
    """清理测试数据"""
    print('\n' + '='*60)
    print('清理测试数据')
    print('='*60)

    # 删除测试Agent的数据
    test_agents = ['ExpiredAgent']
    deleted_count = 0

    for agent in test_agents:
        count = ShortTermMemory.objects.filter(agent_id=agent).count()
        if count > 0:
            ShortTermMemory.objects.filter(agent_id=agent).delete()
            deleted_count += count
            print(f'删除 {agent} 的数据: {count} 条')

    print(f'\n总计删除: {deleted_count} 条测试数据')


# ==================== 主测试流程 ====================

def main():
    """主测试流程"""
    print('\n' + '█'*60)
    print('短期记忆功能测试脚本')
    print('模拟真实AI Agent操作场景')
    print('█'*60)

    # 记录初始数据量
    initial_count = ShortTermMemory.objects.count()
    print(f'\n初始数据量: {initial_count} 条')

    try:
        # 执行测试
        test_single_insert()
        time.sleep(1)

        test_batch_insert(10)
        time.sleep(1)

        test_concurrent_insert(20, 4)
        time.sleep(1)

        test_risk_distribution()
        time.sleep(1)

        test_time_based_expiry()
        time.sleep(1)

        test_agent_specific()
        time.sleep(1)

        test_performance_stress()

        # 验证数据
        validate_data_integrity()

        # 清理测试数据
        print('\n是否清理测试数据？(y/n): ', end='')
        try:
            response = input().strip().lower()
            if response == 'y':
                cleanup_test_data()
        except:
            pass

        # 最终统计
        final_count = ShortTermMemory.objects.count()
        print(f'\n最终数据量: {final_count} 条')
        print(f'新增数据: {final_count - initial_count} 条')

        print('\n' + '█'*60)
        print('✅ 所有测试完成！')
        print('█'*60)

    except Exception as e:
        print(f'\n❌ 测试失败: {str(e)}')
        import traceback
        traceback.print_exc()


if __name__ == '__main__':
    main()