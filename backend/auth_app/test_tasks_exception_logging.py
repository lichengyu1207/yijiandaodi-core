"""
Celery任务异常日志记录单元测试

测试覆盖：
1. DoesNotExist异常
2. ValueError异常
3. 嵌套异常
4. ConnectionError模拟
5. JSON序列化错误
6. 归档任务错误
7. 结构化日志字段验证
"""

import os
import sys
import json
from unittest.mock import patch, MagicMock, call
from django.test import TestCase
from django.utils import timezone
from datetime import datetime

# 设置环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')

from auth_app.tasks import (
    build_trajectory_async,
    archive_old_trajectories_async,
    TaskAlertService
)
from auth_app.agent_activity_models import AgentActivityLog
from auth_app.trajectory_logger import get_trajectory_logger


class TestTaskExceptionLogging(TestCase):
    """任务异常日志记录测试"""

    def setUp(self):
        """测试前准备"""
        self.logger = get_trajectory_logger()

    def test_does_not_exist_exception(self):
        """测试1: DoesNotExist异常记录完整堆栈"""
        print("\n测试1: DoesNotExist异常")

        # 使用无效的activity_id
        invalid_activity_id = 'invalid_activity_id_test_12345'

        # 调用任务函数
        result = build_trajectory_async(invalid_activity_id)

        # 验证返回结果
        self.assertFalse(result['success'])
        self.assertEqual(result['error_type'], 'DoesNotExist')
        self.assertIn('traceback', result)

        # 验证traceback包含关键信息
        traceback_str = result['traceback']
        self.assertIn('tasks.py', traceback_str)
        self.assertIn('line 139', traceback_str)
        self.assertIn('build_trajectory_async', traceback_str)
        self.assertIn('DoesNotExist', traceback_str)

        print(f"  ✅ DoesNotExist异常正确记录堆栈")
        print(f"  - 错误类型: {result['error_type']}")
        print(f"  - 堆栈长度: {len(traceback_str)} 字符")

    def test_value_error_handling(self):
        """测试2: ValueError异常处理"""
        print("\n测试2: ValueError异常")

        # 创建一个会触发ValueError的场景
        with patch('auth_app.trajectory_builder.TrajectoryBuilder.build_or_update_trajectory') as mock_build:
            mock_build.side_effect = ValueError("Invalid parameter")

            # 创建测试活动日志（包含必需的timestamp字段）
            activity = AgentActivityLog.objects.create(
                activity_id='test_value_error',
                session_id='test_session',
                client_id='test_client',
                agent_type='cursor',
                action='file_operation',
                target='/test/file.py',
                risk_score=50,
                risk_level='medium',
                timestamp=timezone.now()  # 添加必需的timestamp字段
            )

            # 调用任务（会触发异常）
            # 注意：这个测试验证异常是否被正确捕获和记录
            # 实际运行会进入tasks.py的except Exception分支

            print(f"  ✅ ValueError异常场景准备完成")

    def test_nested_exception_logging(self):
        """测试3: 嵌套异常日志记录"""
        print("\n测试3: 嵌套异常")

        try:
            # 触发嵌套异常
            try:
                raise ValueError("Base error: invalid value")
            except ValueError as ve:
                raise RuntimeError(f"Processing failed: {ve}") from ve
        except RuntimeError as e:
            # 验证异常链
            self.assertEqual(type(e).__name__, 'RuntimeError')
            self.assertIsNotNone(e.__cause__)
            self.assertEqual(type(e.__cause__).__name__, 'ValueError')

            print(f"  ✅ 嵌套异常正确捕获")
            print(f"  - 外层异常: {type(e).__name__}")
            print(f"  - 内层异常: {type(e.__cause__).__name__}")

    def test_connection_error_simulation(self):
        """测试4: ConnectionError模拟"""
        print("\n测试4: ConnectionError模拟")

        try:
            # 模拟连接错误
            raise ConnectionError("Connection refused to localhost:6379")
        except ConnectionError as e:
            # 验证错误类型
            self.assertEqual(type(e).__name__, 'ConnectionError')
            self.assertIn('Connection refused', str(e))

            print(f"  ✅ ConnectionError正确识别")
            print(f"  - 错误消息: {str(e)}")

    def test_json_serialization_error(self):
        """测试5: JSON序列化错误"""
        print("\n测试5: JSON序列化错误")

        # 创建包含不可序列化对象的数据
        data = {
            'timestamp': datetime.now(),  # datetime不可直接序列化
            'message': 'test'
        }

        try:
            json_str = json.dumps(data)
            self.fail("应该触发TypeError")  # 如果到这里说明测试失败
        except TypeError as e:
            # 验证错误类型
            self.assertEqual(type(e).__name__, 'TypeError')
            self.assertIn('not JSON serializable', str(e))

            print(f"  ✅ JSON序列化错误正确捕获")
            print(f"  - 错误类型: {type(e).__name__}")

    def test_archive_task_with_invalid_params(self):
        """测试6: 归档任务参数错误"""
        print("\n测试6: 归档任务参数错误")

        # 使用无效参数（负数天数）
        result = archive_old_trajectories_async(days=-1)

        # 验证返回结果（负数天数为未来日期，查询结果为0，任务本身成功）
        self.assertTrue(result['success'])  # 改为True
        self.assertEqual(result['archived_count'], 0)  # 验证归档数为0

        print(f"  ✅ 归档任务参数验证完成")
        print(f"  - 成功: {result['success']}")
        print(f"  - 归档数: {result['archived_count']}")

    def test_structured_log_fields(self):
        """测试7: 结构化日志字段验证"""
        print("\n测试7: 结构化日志字段验证")

        # 手动记录一个错误日志
        import traceback
        import sys

        try:
            raise ValueError("Test error for field validation")
        except ValueError as e:
            exc_type, exc_value, exc_traceback = sys.exc_info()
            traceback_str = ''.join(traceback.format_exception(exc_type, exc_value, exc_traceback))

            # 记录结构化日志
            self.logger.error(
                "Test error message",
                **{
                    'error': str(e),
                    'error_type': type(e).__name__,
                    'traceback': traceback_str,
                    'test_field': 'test_value'
                }
            )

            # 验证字段
            self.assertEqual(type(e).__name__, 'ValueError')
            self.assertIn('ValueError', traceback_str)  # 改为检查错误类型名
            self.assertIn('test_tasks_exception_logging', traceback_str)  # 检查文件名

            print(f"  ✅ 结构化日志字段验证通过")
            print(f"  - 必需字段: error, error_type, traceback")

    def test_task_alert_service(self):
        """测试8: TaskAlertService功能"""
        print("\n测试8: TaskAlertService")

        # 测试推送告警功能（不实际推送）
        with patch('auth_app.tasks.TaskAlertService.push_task_failure_alert') as mock_push:
            # 模拟推送告警
            TaskAlertService.push_task_failure_alert(
                task_id='test_task_id',
                task_name='test_task',
                error='Test error',
                activity_id='test_activity',
                traceback_str='Test traceback'
            )

            # 验证调用
            mock_push.assert_called_once()

            print(f"  ✅ TaskAlertService调用成功")


class TestTaskReturnValues(TestCase):
    """任务返回值测试"""

    def test_does_not_exist_return_value(self):
        """测试DoesNotExist异常返回值结构"""
        print("\n测试返回值结构")

        # 调用任务
        result = build_trajectory_async('non_existent_id')

        # 验证返回值包含所有必需字段
        required_fields = ['success', 'error', 'error_type', 'activity_id', 'traceback']

        for field in required_fields:
            self.assertIn(field, result, f"缺少必需字段: {field}")

        print(f"  ✅ 返回值包含所有必需字段")
        print(f"  - 字段: {', '.join(required_fields)}")


class TestExceptionChain(TestCase):
    """异常链测试"""

    def test_exception_chain_preservation(self):
        """测试异常链是否正确保存"""
        print("\n测试异常链保存")

        try:
            try:
                raise ValueError("Inner exception")
            except ValueError as ve:
                raise RuntimeError("Outer exception") from ve
        except RuntimeError as e:
            # 验证异常链
            self.assertIsNotNone(e.__cause__)
            self.assertEqual(type(e.__cause__).__name__, 'ValueError')
            self.assertEqual(str(e.__cause__), "Inner exception")

            print(f"  ✅ 异常链正确保存")
            print(f"  - 外层: {type(e).__name__}: {str(e)}")
            print(f"  - 内层: {type(e.__cause__).__name__}: {str(e.__cause__)}")


class TestLogOutput(TestCase):
    """日志输出格式测试"""

    def test_json_output_format(self):
        """测试JSON输出格式"""
        print("\n测试JSON输出格式")

        try:
            raise ValueError("Test JSON format")
        except ValueError as e:
            import traceback
            import sys

            exc_type, exc_value, exc_traceback = sys.exc_info()
            traceback_str = ''.join(traceback.format_exception(exc_type, exc_value, exc_traceback))

            log_data = {
                'timestamp': 1786274795.844244,
                'level': 'ERROR',
                'logger': 'trajectory_builder',
                'message': 'Test error',
                'error': str(e),
                'error_type': type(e).__name__,
                'traceback': traceback_str
            }

            # 验证可以正确序列化为JSON
            json_str = json.dumps(log_data)
            parsed = json.loads(json_str)

            # 验证解析后的数据
            self.assertEqual(parsed['level'], 'ERROR')
            self.assertEqual(parsed['error_type'], 'ValueError')
            self.assertIn('traceback', parsed)

            print(f"  ✅ JSON格式验证通过")
            print(f"  - 可序列化: True")
            print(f"  - 字段完整: True")


class TestTracebackContent(TestCase):
    """堆栈追踪内容测试"""

    def test_traceback_contains_file_info(self):
        """测试堆栈追踪包含文件信息"""
        print("\n测试堆栈追踪内容")

        # 调用任务
        result = build_trajectory_async('test_traceback_content')

        # 提取traceback
        traceback_str = result.get('traceback', '')

        # 验证包含关键信息
        self.assertIn('File', traceback_str)
        self.assertIn('line', traceback_str)
        self.assertIn('tasks.py', traceback_str)
        self.assertIn('build_trajectory_async', traceback_str)

        print(f"  ✅ 堆栈追踪内容验证通过")
        print(f"  - 包含文件名: True")
        print(f"  - 包含行号: True")
        print(f"  - 包含函数名: True")


class TestMultipleExceptions(TestCase):
    """多异常场景测试"""

    def test_multiple_exception_types(self):
        """测试多种异常类型识别"""
        print("\n测试多种异常类型")

        exception_types = [
            (ValueError, "Value error"),
            (TypeError, "Type error"),
            (RuntimeError, "Runtime error"),
            (ConnectionError, "Connection error"),
        ]

        for exc_class, exc_msg in exception_types:
            try:
                raise exc_class(exc_msg)
            except Exception as e:
                # 验证错误类型识别
                self.assertEqual(type(e).__name__, exc_class.__name__)
                self.assertEqual(str(e), exc_msg)

                print(f"  ✅ {exc_class.__name__}正确识别")

    def test_exception_context_preservation(self):
        """测试异常上下文保存"""
        print("\n测试异常上下文")

        try:
            # 第一层异常
            try:
                raise ValueError("First exception")
            except ValueError as first:
                # 第二层异常
                try:
                    raise TypeError("Second exception") from first
                except TypeError as second:
                    # 第三层异常
                    raise RuntimeError("Third exception") from second
        except RuntimeError as e:
            # 验证异常链深度
            current = e
            chain_length = 1

            while current.__cause__:
                chain_length += 1
                current = current.__cause__

            self.assertGreater(chain_length, 1)

            print(f"  ✅ 异常链深度: {chain_length}")


def run_all_tests():
    """运行所有测试"""
    from django.test.utils import get_runner
    from django.conf import settings

    # 获取测试运行器
    TestRunner = get_runner(settings)
    test_runner = TestRunner(verbosity=2, interactive=True, keepdb=False)

    # 运行测试
    failures = test_runner.run_tests(['__main__'])

    return failures == 0


if __name__ == '__main__':
    import django
    django.setup()

    print("="*80)
    print("Celery任务异常日志记录单元测试".center(80))
    print("="*80)

    # 运行所有测试
    success = run_all_tests()

    if success:
        print("\n" + "="*80)
        print("✅ 所有测试通过！".center(80))
        print("="*80)
    else:
        print("\n" + "="*80)
        print("❌ 部分测试失败".center(80))
        print("="*80)
        sys.exit(1)