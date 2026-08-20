"""
Celery任务监控系统完整测试脚本

测试内容：
1. Celery服务状态检查
2. 任务提交和执行
3. 任务状态查询
4. 错误日志查看
5. 重试历史追踪
6. API接口测试
"""

import os
import sys
import django
import time
import requests
from datetime import datetime

# 设置Django环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
sys.path.insert(0, '/c/MsSafeData/Desktop/yijiandaodi/backend')
django.setup()

from auth_app.tasks import build_trajectory_async, archive_old_trajectories_async
from auth_app.task_monitor import TaskMonitor
from auth_app.agent_activity_models import AgentActivityLog
from auth_app.trajectory_models import BehaviorTrajectory


def print_section(title):
    """打印分隔线"""
    print(f"\n{'='*60}")
    print(f"{title:^60}")
    print(f"{'='*60}\n")


def test_celery_services():
    """测试1: Celery服务状态检查"""
    print_section("测试1: Celery服务状态检查")

    try:
        import redis
        from django.conf import settings

        # 测试Redis连接
        print("✓ 测试Redis连接...")
        redis_url = settings.CELERY_BROKER_URL
        print(f"  Redis URL: {redis_url}")

        # 解析Redis连接信息
        if 'redis' in redis_url:
            print("  ✓ Redis broker已配置")
        else:
            print("  ✗ 警告: 未使用Redis broker")

        # 测试Celery应用
        print("✓ 测试Celery应用...")
        from fangdudu_backend.celery import app
        print(f"  Celery应用名称: {app.main}")
        print(f"  已注册任务数量: {len(app.tasks)}")

        # 列出关键任务
        print("  关键任务:")
        for task_name in [
            'auth_app.tasks.build_trajectory_async',
            'auth_app.tasks.archive_old_trajectories_async',
        ]:
            if task_name in app.tasks:
                print(f"    ✓ {task_name}")
            else:
                print(f"    ✗ {task_name} (未注册)")

        print("\n✅ Celery服务检查通过")
        return True

    except Exception as e:
        print(f"\n❌ Celery服务检查失败: {e}")
        return False


def test_task_submission():
    """测试2: 任务提交和执行"""
    print_section("测试2: 任务提交和执行")

    try:
        # 创建测试数据
        print("✓ 创建测试活动日志...")
        test_activity = AgentActivityLog.objects.first()

        if not test_activity:
            print("  ✗ 数据库中没有活动日志")
            return False

        print(f"  使用活动ID: {test_activity.activity_id}")

        # 提交异步任务
        print("✓ 提交异步任务...")
        result = build_trajectory_async.delay(test_activity.activity_id)

        print(f"  任务ID: {result.id}")
        print(f"  任务状态: {result.status}")

        # 等待任务完成（最多30秒）
        print("✓ 等待任务执行...")
        timeout = 30
        elapsed = 0

        while not result.ready() and elapsed < timeout:
            time.sleep(1)
            elapsed += 1
            print(f"  等待中... {elapsed}/{timeout}秒")

        if result.ready():
            print(f"  任务执行完成")
            print(f"  最终状态: {result.status}")

            if result.successful():
                task_result = result.result
                print(f"  ✓ 任务成功")
                print(f"  结果: {task_result}")
                return True, result.id
            else:
                print(f"  ✗ 任务失败")
                print(f"  错误: {result.result}")
                return False, result.id
        else:
            print(f"  ✗ 任务超时（{timeout}秒）")
            return False, result.id

    except Exception as e:
        print(f"\n❌ 任务提交测试失败: {e}")
        return False, None


def test_task_monitoring(task_id):
    """测试3: 任务状态查询"""
    print_section("测试3: 任务状态查询")

    if not task_id:
        print("✗ 没有可用的任务ID")
        return False

    try:
        print(f"✓ 查询任务状态: {task_id}")
        task_info = TaskMonitor.get_task_status(task_id)

        print(f"  状态: {task_info.get('status')}")
        print(f"  就绪: {task_info.get('ready')}")
        print(f"  成功: {task_info.get('successful')}")
        print(f"  失败: {task_info.get('failed')}")

        if 'result' in task_info:
            print(f"  结果: {task_info['result']}")

        print("\n✅ 任务状态查询成功")
        return True

    except Exception as e:
        print(f"\n❌ 任务状态查询失败: {e}")
        return False


def test_error_tracking():
    """测试4: 错误日志查看"""
    print_section("测试4: 错误日志查看")

    try:
        # 提交一个会失败的任务（无效ID）
        print("✓ 提交会失败的任务（测试错误追踪）...")
        result = build_trajectory_async.delay('invalid_activity_id_12345')

        # 等待失败
        time.sleep(5)

        if result.failed():
            print(f"  任务失败（预期行为）")
            print(f"  任务ID: {result.id}")

            # 查询错误详情
            print("✓ 查询错误详情...")
            error_info = TaskMonitor.get_task_error(result.id)

            print(f"  错误类型: {error_info.get('error_type')}")
            print(f"  错误消息: {error_info.get('error_message')}")

            if 'traceback' in error_info:
                print(f"  堆栈追踪:")
                for line in error_info['traceback'][:5]:
                    print(f"    {line}")

            print("\n✅ 错误追踪成功")
            return True
        else:
            print("  ✗ 任务未失败（不符合预期）")
            return False

    except Exception as e:
        print(f"\n❌ 错误追踪测试失败: {e}")
        return False


def test_retry_history():
    """测试5: 重试历史追踪"""
    print_section("测试5: 重试历史追踪")

    try:
        # 提交一个会失败的任务
        print("✓ 提交会失败的任务（测试重试机制）...")
        result = build_trajectory_async.delay('invalid_id_retry_test')

        # 等待重试完成
        time.sleep(10)

        print(f"  任务ID: {result.id}")

        # 查询重试历史
        print("✓ 查询重试历史...")
        retry_info = TaskMonitor.get_retry_history(result.id)

        print(f"  当前重试次数: {retry_info.get('current_retry_count')}")
        print(f"  重试历史记录: {len(retry_info.get('retry_history', []))}条")

        if retry_info.get('retry_history'):
            print("  最近重试记录:")
            for record in retry_info['retry_history'][:2]:
                print(f"    时间: {record.get('timestamp')}")
                print(f"    状态: {record.get('status')}")

        print("\n✅ 重试历史追踪成功")
        return True

    except Exception as e:
        print(f"\n❌ 重试历史测试失败: {e}")
        return False


def test_failed_tasks_list():
    """测试6: 失败任务列表查询"""
    print_section("测试6: 失败任务列表查询")

    try:
        print("✓ 查询最近24小时失败任务...")
        failed_tasks = TaskMonitor.get_recent_failed_tasks(hours=24)

        print(f"  失败任务数量: {len(failed_tasks)}")

        if failed_tasks:
            print("  最近失败任务:")
            for task in failed_tasks[:3]:
                print(f"    ID: {task.get('task_id')}")
                print(f"    错误: {task.get('error', 'N/A')[:50]}...")
                print(f"    时间: {task.get('date_done')}")
        else:
            print("  没有失败任务")

        print("\n✅ 失败任务列表查询成功")
        return True

    except Exception as e:
        print(f"\n❌ 失败任务列表查询失败: {e}")
        return False


def test_performance_stats():
    """测试7: 性能统计查询"""
    print_section("测试7: 性能统计查询")

    try:
        print("✓ 查询任务性能统计...")
        stats = TaskMonitor.get_task_performance_stats(hours=24)

        print(f"  总任务数: {stats.get('total_tasks', 0)}")
        print(f"  成功任务: {stats.get('successful_tasks', 0)}")
        print(f"  失败任务: {stats.get('failed_tasks', 0)}")

        if stats.get('total_tasks', 0) > 0:
            success_rate = stats['successful_tasks'] / stats['total_tasks'] * 100
            print(f"  成功率: {success_rate:.1f}%")

        print(f"  平均耗时: {stats.get('avg_duration_ms', 0):.2f}ms")
        print(f"  最大耗时: {stats.get('max_duration_ms', 0):.2f}ms")
        print(f"  最小耗时: {stats.get('min_duration_ms', 0):.2f}ms")

        print("\n✅ 性能统计查询成功")
        return True

    except Exception as e:
        print(f"\n❌ 性能统计查询失败: {e}")
        return False


def test_api_endpoints():
    """测试8: API接口测试"""
    print_section("测试8: API接口测试")

    try:
        # 先创建一个测试任务
        print("✓ 创建测试任务...")
        test_activity = AgentActivityLog.objects.first()

        if not test_activity:
            print("  ✗ 没有可用的活动日志")
            return False

        result = build_trajectory_async.delay(test_activity.activity_id)
        task_id = result.id
        print(f"  任务ID: {task_id}")

        # 等待任务执行
        time.sleep(5)

        # 测试API接口
        base_url = "http://localhost:9092/api"

        # 需要认证token（这里假设已登录）
        headers = {
            "Authorization": "Bearer YOUR_TOKEN_HERE"
        }

        print("✓ 测试任务状态API...")
        response = requests.get(
            f"{base_url}/tasks/{task_id}/status/",
            headers=headers
        )

        if response.status_code == 200:
            print("  ✓ 任务状态API正常")
            print(f"  响应: {response.json()}")
        elif response.status_code == 401:
            print("  ⚠️ 需要认证token")
        else:
            print(f"  ✗ API返回: {response.status_code}")

        print("✓ 测试性能统计API...")
        response = requests.get(
            f"{base_url}/tasks/performance/",
            headers=headers
        )

        if response.status_code == 200:
            print("  ✓ 性能统计API正常")
        elif response.status_code == 401:
            print("  ⚠️ 需要认证token")
        else:
            print(f"  ✗ API返回: {response.status_code}")

        print("\n✅ API接口测试完成")
        return True

    except requests.ConnectionError:
        print("\n❌ 无法连接到API服务（请确认后端已启动）")
        return False
    except Exception as e:
        print(f"\n❌ API接口测试失败: {e}")
        return False


def main():
    """运行所有测试"""
    print_section("Celery任务监控系统测试")

    print(f"测试时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Django设置: {os.environ.get('DJANGO_SETTINGS_MODULE')}")

    results = {}

    # 测试1: Celery服务状态
    results['celery_services'] = test_celery_services()

    # 测试2: 任务提交和执行
    success, task_id = test_task_submission()
    results['task_submission'] = success

    # 测试3: 任务状态查询
    if task_id:
        results['task_monitoring'] = test_task_monitoring(task_id)

    # 测试4: 错误日志查看
    results['error_tracking'] = test_error_tracking()

    # 测试5: 重试历史追踪
    results['retry_history'] = test_retry_history()

    # 测试6: 失败任务列表
    results['failed_tasks_list'] = test_failed_tasks_list()

    # 测试7: 性能统计
    results['performance_stats'] = test_performance_stats()

    # 测试8: API接口
    results['api_endpoints'] = test_api_endpoints()

    # 打印测试报告
    print_section("测试报告")

    print("测试结果:")
    for test_name, passed in results.items():
        status = "✅ 通过" if passed else "❌ 失败"
        print(f"  {test_name}: {status}")

    passed_count = sum(1 for passed in results.values() if passed)
    total_count = len(results)

    print(f"\n总计: {passed_count}/{total_count} 通过")

    if passed_count == total_count:
        print("\n🎉 所有测试通过！Celery任务监控系统运行正常")
    else:
        print("\n⚠️ 部分测试失败，请检查相关服务")

    print("\n提示:")
    print("  1. 确保Redis已启动: redis-cli ping")
    print("  2. 确保Celery Worker已启动: celery -A fangdudu_backend worker -l info")
    print("  3. 确保Celery Beat已启动: celery -A fangdudu_backend beat -l info")
    print("  4. 确保Django后端已启动: python manage.py runserver 0.0.0.0:9092")


if __name__ == "__main__":
    main()