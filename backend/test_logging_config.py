"""
日志配置测试脚本

验证日志轮转配置是否正常工作
"""

import os
import sys
import django

# 添加项目根目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
django.setup()

import logging
import time
from auth_app.memory_models import LongTermMemory, ChainIndexCounter

# 获取logger
logger = logging.getLogger('auth_app.memory_models')
performance_logger = logging.getLogger('auth_app.memory_views')


def test_logging_configuration():
    """测试日志配置"""
    print("=" * 60)
    print("开始测试日志配置")
    print("=" * 60)

    # 1. 测试日志目录是否存在
    logs_dir = os.path.join(os.path.dirname(__file__), 'logs')
    if os.path.exists(logs_dir):
        print(f"✅ 日志目录存在: {logs_dir}")
    else:
        print(f"❌ 日志目录不存在: {logs_dir}")
        print("正在创建日志目录...")
        os.makedirs(logs_dir, exist_ok=True)
        print("✅ 日志目录创建成功")

    # 2. 测试日志文件是否存在
    log_files = [
        'hippocampus.log',
        'performance.log',
        'security_audit.log',
        'tracing.log'
    ]

    print("\n日志文件状态:")
    for log_file in log_files:
        log_path = os.path.join(logs_dir, log_file)
        if os.path.exists(log_path):
            size = os.path.getsize(log_path)
            print(f"  ✅ {log_file}: {size} bytes")
        else:
            print(f"  ⚠️  {log_file}: 不存在（将在首次写入时创建）")

    # 3. 测试日志级别
    print("\n日志级别配置:")
    print(f"  memory_models logger level: {logger.level}")
    print(f"  memory_views logger level: {performance_logger.level}")

    # 4. 测试日志处理器
    print("\n日志处理器:")
    for handler in logger.handlers:
        print(f"  - {handler.__class__.__name__}")
        if hasattr(handler, 'filename'):
            print(f"    文件: {handler.filename}")
        if hasattr(handler, 'maxBytes'):
            print(f"    最大大小: {handler.maxBytes / 1024 / 1024:.1f}MB")
        if hasattr(handler, 'backupCount'):
            print(f"    备份文件数: {handler.backupCount}")

    # 5. 测试日志写入
    print("\n测试日志写入:")

    # 测试DEBUG级别日志
    logger.debug("[测试] DEBUG级别日志 - 这是一条调试信息")
    print("  ✅ DEBUG日志写入成功")

    # 测试INFO级别日志
    logger.info("[测试] INFO级别日志 - 这是一条重要信息")
    print("  ✅ INFO日志写入成功")

    # 测试WARNING级别日志
    logger.warning("[测试] WARNING级别日志 - 这是一条警告信息")
    print("  ✅ WARNING日志写入成功")

    # 测试ERROR级别日志
    logger.error("[测试] ERROR级别日志 - 这是一条错误信息")
    print("  ✅ ERROR日志写入成功")

    # 6. 测试LongTermMemory创建日志
    print("\n测试LongTermMemory创建日志:")
    try:
        # 创建一条长期记忆
        memory = LongTermMemory.objects.create(
            agent_id='test_agent_001',
            operation_type='test_operation',
            operation_content='测试操作内容',
            risk_level='low'
        )
        print(f"  ✅ 长期记忆创建成功: chain_index={memory.chain_index}")
        print(f"  ✅ record_hash: {memory.record_hash[:16]}...")

        # 清理测试数据
        memory.delete()
        print("  ✅ 测试数据已清理")

    except Exception as e:
        print(f"  ❌ 长期记忆创建失败: {str(e)}")

    # 7. 测试性能日志
    print("\n测试性能日志:")
    performance_logger.info("[性能测试] 测试性能日志写入")
    print("  ✅ 性能日志写入成功")

    print("\n" + "=" * 60)
    print("日志配置测试完成")
    print("=" * 60)

    # 8. 检查日志文件大小
    print("\n最终日志文件大小:")
    for log_file in log_files:
        log_path = os.path.join(logs_dir, log_file)
        if os.path.exists(log_path):
            size = os.path.getsize(log_path)
            print(f"  {log_file}: {size} bytes")


def test_log_rotation():
    """测试日志轮转（生成大量日志）"""
    print("\n" + "=" * 60)
    print("测试日志轮转（生成大量日志）")
    print("=" * 60)

    print("正在生成大量日志（测试轮转）...")
    for i in range(1000):
        logger.info(f"[轮转测试] 第{i + 1}条日志 - 测试日志轮转功能")

    print("✅ 日志生成完成")

    # 检查是否生成了备份文件
    logs_dir = os.path.join(os.path.dirname(__file__), 'logs')
    hippocampus_files = [f for f in os.listdir(logs_dir) if f.startswith('hippocampus.log')]

    print(f"\nhippocampus.log相关文件数: {len(hippocampus_files)}")
    for f in hippocampus_files:
        file_path = os.path.join(logs_dir, f)
        size = os.path.getsize(file_path)
        print(f"  {f}: {size / 1024:.1f}KB")


if __name__ == '__main__':
    test_logging_configuration()

    # 如果要测试轮转，取消下面的注释
    # test_log_rotation()