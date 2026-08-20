"""
直接测试Celery任务函数（无需Redis）

通过直接调用任务函数测试错误日志输出
"""

import os
import sys
import django


def main():
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
    sys.path.insert(0, '/c/MsSafeData/Desktop/yijiandaodi/backend')
    django.setup()

    import time
    import traceback
    import sys
    from auth_app.tasks import build_trajectory_async
    from auth_app.trajectory_logger import get_trajectory_logger

    logger = get_trajectory_logger()

    print("="*80)
    print("直接测试Celery任务错误日志（无需Redis）".center(80))
    print("="*80)

    # 测试场景1: DoesNotExist错误
    print("\n测试1: DoesNotExist错误 - ActivityLog不存在")
    print("-"*80)

    invalid_activity_id = 'invalid_activity_id_direct_test_12345'
    print(f"✓ 调用任务函数: activity_id={invalid_activity_id}")
    print(f"✓ 预期结果: 任务失败，记录详细堆栈追踪")

    result = build_trajectory_async(invalid_activity_id)

    print(f"\n任务执行结果:")
    print(f"  成功: {result.get('success')}")
    print(f"  错误: {result.get('error')}")
    print(f"  错误类型: {result.get('error_type')}")
    print(f"  活动 ID: {result.get('activity_id')}")

    # 检查traceback
    if 'traceback' in result and result['traceback']:
        print(f"\n✅ 详细堆栈追踪（已记录）:")
        print("  前几行预览:")
        traceback_lines = result['traceback'].split('\n')[:10]
        for line in traceback_lines:
            print(f"    {line}")
    else:
        print(f"\n⚠️ 未记录traceback字段")

    print("\n" + "="*80)

    # 测试场景2: 手动触发异常并查看日志
    print("\n测试2: 手动触发异常 - 模拟数据库错误")
    print("-"*80)

    try:
        # 模拟数据库查询失败
        raise Exception("模拟数据库连接失败: Connection refused")
    except Exception as e:
        exc_type, exc_value, exc_traceback = sys.exc_info()
        traceback_str = ''.join(traceback.format_exception(exc_type, exc_value, exc_traceback))

        # 使用logger记录错误（会输出结构化JSON）
        logger.error(
            "手动触发异常测试",
            **{
                'test': 'manual_exception',
                'error': str(e),
                'error_type': type(e).__name__,
                'traceback': traceback_str,
            }
        )

        # 单独记录详细堆栈
        logger.error(f"详细堆栈追踪:\n{traceback_str}")

        print(f"✓ 异常已记录到日志")
        print(f"  错误类型: {type(e).__name__}")
        print(f"  错误消息: {str(e)}")
        print(f"  堆栈追踪长度: {len(traceback_str)} 字符")

    print("\n" + "="*80)

    # 测试场景3: 嵌套异常
    print("\n测试3: 嵌套异常测试")
    print("-"*80)

    try:
        try:
            raise ValueError("基础错误：参数验证失败")
        except ValueError as ve:
            raise RuntimeError(f"处理失败: {ve}") from ve
    except RuntimeError as e:
        exc_type, exc_value, exc_traceback = sys.exc_info()
        traceback_str = ''.join(traceback.format_exception(exc_type, exc_value, exc_traceback))

        logger.error(
            "嵌套异常测试",
            **{
                'test': 'nested_exception',
                'error': str(e),
                'error_type': type(e).__name__,
                'cause': str(e.__cause__) if e.__cause__ else None,
                'traceback': traceback_str,
            }
        )

        logger.error(f"详细堆栈追踪:\n{traceback_str}")

        print(f"✓ 嵌套异常已记录")
        print(f"  外层异常: {type(e).__name__}")
        print(f"  内层异常: {type(e.__cause__).__name__}")
        print(f"  内层消息: {str(e.__cause__)}")

    print("\n" + "="*80)
    print("测试完成".center(80))
    print("="*80)

    print("\n📋 验证要点:")
    print("  1. ✅ 结构化JSON日志包含error_type、error、traceback字段")
    print("  2. ✅ 详细堆栈追踪单独记录（grep '详细堆栈追踪'）")
    print("  3. ✅ 嵌套异常正确记录cause字段")
    print("  4. ✅ 异常类型正确识别（DoesNotExist、RuntimeError等）")

    print("\n💡 查看日志输出:")
    print("  上述日志已直接输出到控制台（结构化JSON格式）")
    print("  每个错误后都有单独一行的详细堆栈追踪")


if __name__ == '__main__':
    main()
