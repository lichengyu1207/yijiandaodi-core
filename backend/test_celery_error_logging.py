"""
测试Celery任务错误日志输出

测试场景：
1. DoesNotExist错误
2. ValueError错误
3. ConnectionError错误
4. 嵌套异常（异常中抛出异常）
"""

import os
import sys
import django

# 设置Django环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
sys.path.insert(0, '/c/MsSafeData/Desktop/yijiandaodi/backend')
django.setup()

import time
from auth_app.tasks import build_trajectory_async, archive_old_trajectories_async
from auth_app.agent_activity_models import AgentActivityLog
from auth_app.trajectory_logger import get_trajectory_logger

logger = get_trajectory_logger()


def print_section(title):
    """打印分隔线"""
    print(f"\n{'='*80}")
    print(f"{title:^80}")
    print(f"{'='*80}\n")


def test_does_not_exist_error():
    """测试1: DoesNotExist错误"""
    print_section("测试1: DoesNotExist错误 - ActivityLog不存在")

    # 提交一个不存在的activity_id
    invalid_activity_id = 'invalid_activity_id_test_12345'

    print(f"✓ 提交任务: activity_id={invalid_activity_id}")
    result = build_trajectory_async.delay(invalid_activity_id)

    print(f"  任务ID: {result.id}")
    print(f"  状态: {result.status}")

    # 等待任务执行（同步模式）
    print("✓ 等待任务执行...")
    try:
        task_result = result.get(timeout=60)  # 等待60秒
        print(f"  结果: {task_result}")
    except Exception as e:
        print(f"  任务失败（预期行为）: {e}")

    print(f"  最终状态: {result.status}")
    print(f"  成功: {result.successful()}")
    print(f"  失败: {result.failed()}")

    # 查看详细错误信息
    if result.failed():
        print("\n✓ 错误详情:")
        print(f"  错误类型: {type(result.result).__name__}")
        print(f"  错误消息: {str(result.result)}")

        # 查看traceback
        if hasattr(result, 'traceback') and result.traceback:
            print("\n✓ 堆栈追踪:")
            print(result.traceback)

    return result


def test_value_error():
    """测试2: ValueError错误"""
    print_section("测试2: ValueError错误 - 无效参数")

    # 创建一个会触发ValueError的场景
    # 注意：这个测试需要修改任务代码或使用特殊参数
    print("✓ 提交任务（测试ValueError）...")

    # 直接调用任务函数（不经过Celery）
    try:
        from auth_app.trajectory_builder import TrajectoryBuilder

        # 创建一个无效的ActivityLog对象（不保存到数据库）
        print("  创建无效ActivityLog对象...")
        invalid_log = AgentActivityLog(
            activity_id='test_value_error',
            session_id='test_session',
            client_id='test_client',
            agent_type='invalid_type',  # 可能触发验证错误
            action='invalid_action',
            target='test_target',
            risk_score=-1,  # 无效分数
            risk_level='invalid_level'  # 无效等级
        )

        # 尝试构建轨迹
        print("  尝试构建轨迹...")
        trajectory = TrajectoryBuilder.build_or_update_trajectory(invalid_log)

        print("  ⚠️ 未触发异常（不符合预期）")

    except Exception as e:
        print(f"  ✓ 触发异常（预期行为）")
        print(f"    异常类型: {type(e).__name__}")
        print(f"    异常消息: {str(e)}")

        # 记录日志（测试日志输出）
        logger.error(
            "测试ValueError",
            **{
                'test': 'value_error',
                'error': str(e),
                'error_type': type(e).__name__,
            }
        )


def test_connection_error_simulation():
    """测试3: ConnectionError模拟"""
    print_section("测试3: ConnectionError模拟 - 数据库连接失败")

    # 模拟数据库连接失败的场景
    # 注意：这个测试需要临时修改数据库配置或停止数据库服务

    print("✓ 模拟数据库连接失败...")

    # 方法1：使用无效的数据库配置
    from django.conf import settings
    from django.db import connections

    try:
        # 创建一个会失败的查询
        print("  尝试查询不存在的表...")
        from django.db import connection

        with connection.cursor() as cursor:
            cursor.execute("SELECT * FROM non_existent_table_test")
            cursor.fetchall()

    except Exception as e:
        print(f"  ✓ 触发异常（预期行为）")
        print(f"    异常类型: {type(e).__name__}")
        print(f"    异常消息: {str(e)}")

        # 记录日志
        logger.error(
            "测试ConnectionError",
            **{
                'test': 'connection_error',
                'error': str(e),
                'error_type': type(e).__name__,
            }
        )


def test_nested_exception():
    """测试4: 嵌套异常"""
    print_section("测试4: 嵌套异常 - 异常中抛出异常")

    print("✓ 模拟嵌套异常...")

    try:
        # 第一层异常
        try:
            # 触发一个基础异常
            raise ValueError("基础错误：无效的参数值")

        except ValueError as ve:
            # 捕获后抛出另一个异常
            raise RuntimeError(f"处理ValueError时发生错误: {ve}") from ve

    except RuntimeError as e:
        print(f"  ✓ 触发嵌套异常")
        print(f"    外层异常: {type(e).__name__}")
        print(f"    外层消息: {str(e)}")
        print(f"    内层异常: {type(e.__cause__).__name__}")
        print(f"    内层消息: {str(e.__cause__)}")

        # 记录日志
        logger.error(
            "测试嵌套异常",
            **{
                'test': 'nested_exception',
                'error': str(e),
                'error_type': type(e).__name__,
                'cause': str(e.__cause__) if e.__cause__ else None,
            }
        )


def test_archive_error():
    """测试5: 归档任务错误"""
    print_section("测试5: 归档任务错误 - 参数错误")

    print("✓ 提交归档任务（测试参数错误）...")

    # 使用无效参数（负数天数）
    result = archive_old_trajectories_async.delay(days=-1)

    print(f"  任务ID: {result.id}")
    print(f"  状态: {result.status}")

    # 等待执行
    print("✓ 等待任务执行...")
    try:
        task_result = result.get(timeout=30)
        print(f"  结果: {task_result}")
    except Exception as e:
        print(f"  任务失败（可能触发错误）: {e}")

    print(f"  最终状态: {result.status}")


def test_json_serialization_error():
    """测试6: JSON序列化错误"""
    print_section("测试6: JSON序列化错误 - datetime对象")

    print("✓ 测试JSON序列化错误...")

    import json
    from datetime import datetime

    try:
        # 尝试序列化datetime对象
        data = {
            'timestamp': datetime.now(),  # 无法直接序列化
            'message': 'test'
        }

        json_str = json.dumps(data)
        print("  ⚠️ 序列化成功（不符合预期）")

    except TypeError as e:
        print(f"  ✓ 触发TypeError（预期行为）")
        print(f"    异常类型: {type(e).__name__}")
        print(f"    异常消息: {str(e)}")

        # 记录日志
        logger.error(
            "测试JSON序列化错误",
            **{
                'test': 'json_serialization',
                'error': str(e),
                'error_type': type(e).__name__,
            }
        )


def test_direct_task_execution():
    """测试7: 直接执行任务（不通过Celery）"""
    print_section("测试7: 直接执行任务 - 验证日志输出")

    print("✓ 直接调用任务函数（同步执行）...")

    try:
        # 直接调用任务函数，不经过Celery
        # 这可以立即看到日志输出
        task_result = build_trajectory_async('direct_test_invalid_id')

        print(f"  任务结果: {task_result}")

    except Exception as e:
        print(f"  ✓ 任务执行失败")
        print(f"    异常类型: {type(e).__name__}")
        print(f"    异常消息: {str(e)}")


def main():
    """运行所有测试"""
    print_section("Celery任务错误日志测试")

    print("测试时间:", time.strftime("%Y-%m-%d %H:%M:%S"))
    print("Django设置:", os.environ.get('DJANGO_SETTINGS_MODULE'))

    results = {}

    # 测试1: DoesNotExist错误
    try:
        results['does_not_exist'] = test_does_not_exist_error()
    except Exception as e:
        print(f"❌ 测试1失败: {e}")
        results['does_not_exist'] = None

    # 测试2: ValueError错误
    try:
        test_value_error()
        results['value_error'] = True
    except Exception as e:
        print(f"❌ 测试2失败: {e}")
        results['value_error'] = False

    # 测试3: ConnectionError模拟
    try:
        test_connection_error_simulation()
        results['connection_error'] = True
    except Exception as e:
        print(f"❌ 测试3失败: {e}")
        results['connection_error'] = False

    # 测试4: 嵌套异常
    try:
        test_nested_exception()
        results['nested_exception'] = True
    except Exception as e:
        print(f"❌ 测试4失败: {e}")
        results['nested_exception'] = False

    # 测试5: 归档任务错误
    try:
        test_archive_error()
        results['archive_error'] = True
    except Exception as e:
        print(f"❌ 测试5失败: {e}")
        results['archive_error'] = False

    # 测试6: JSON序列化错误
    try:
        test_json_serialization_error()
        results['json_error'] = True
    except Exception as e:
        print(f"❌ 测试6失败: {e}")
        results['json_error'] = False

    # 测试7: 直接执行任务
    try:
        test_direct_task_execution()
        results['direct_execution'] = True
    except Exception as e:
        print(f"❌ 测试7失败: {e}")
        results['direct_execution'] = False

    # 打印测试报告
    print_section("测试报告")

    print("测试结果:")
    for test_name, passed in results.items():
        status = "✅ 通过" if passed else "❌ 失败"
        print(f"  {test_name}: {status}")

    print("\n日志检查:")
    print("  1. 查看结构化日志: cat /var/log/celery/worker.log | jq 'select(.level==\"ERROR\")'")
    print("  2. 查看详细堆栈: grep -A 20 '详细堆栈追踪' /var/log/celery/worker.log")
    print("  3. 查看错误类型: cat /var/log/celery/worker.log | jq '.error_type'")

    print("\n✅ 测试完成！请检查日志输出是否包含完整的堆栈追踪信息")


if __name__ == "__main__":
    main()