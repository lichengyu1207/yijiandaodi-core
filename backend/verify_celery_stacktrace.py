"""
快速验证Celery错误堆栈追踪

启动Redis和Celery Worker后运行此脚本
"""

import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
sys.path.insert(0, '/c/MsSafeData/Desktop/yijiandaodi/backend')
django.setup()

import time
from auth_app.tasks import build_trajectory_async
from auth_app.task_monitor import TaskMonitor

print("="*80)
print("快速验证Celery错误堆栈追踪".center(80))
print("="*80)

# 测试1: 提交会失败的任务
print("\n✓ 提交会失败的任务...")
invalid_activity_id = 'invalid_activity_id_verification_test'
result = build_trajectory_async.delay(invalid_activity_id)

print(f"  任务ID: {result.id}")
print(f"  状态: {result.status}")

# 测试2: 等待任务执行（最多60秒）
print("\n✓ 等待任务执行（Celery Worker需运行）...")
print("  如果Worker未运行，任务将一直处于PENDING状态")
print("  请确保已启动:")
print("    1. Redis: docker run -d -p 6379:6379 redis:alpine")
print("    2. Celery Worker: celery -A fangdudu_backend worker -l info -Q trajectory")

# 尝试获取结果
try:
    task_result = result.get(timeout=10)  # 等待10秒
    print(f"\n  任务结果: {task_result}")
except Exception as e:
    print(f"\n  任务执行失败或超时: {e}")

# 测试3: 查询任务状态
print("\n✓ 查询任务状态...")
task_info = TaskMonitor.get_task_status(result.id)

print(f"  状态: {task_info.get('status')}")
print(f"  就绪: {task_info.get('ready')}")

if task_info.get('failed'):
    print("\n✓ 任务失败详情:")
    print(f"  错误类型: {task_info.get('result', {}).get('error_type')}")
    print(f"  错误消息: {task_info.get('result', {}).get('error')}")

    # 检查traceback
    traceback_str = task_info.get('result', {}).get('traceback')
    if traceback_str:
        print("\n✓ 详细堆栈追踪:")
        print(trace traceback_str)

# 测试4: 检查日志文件
print("\n" + "="*80)
print("日志检查指令:")
print("="*80)
print("\n1. 查看Worker实时日志:")
print("   celery -A fangdudu_backend worker -l info")
print("\n2. 搜索错误日志:")
print("   grep 'ERROR' /var/log/celery/worker.log")
print("\n3. 查看详细堆栈:")
print("   grep -A 20 '详细堆栈追踪' /var/log/celery/worker.log")
print("\n4. 查看结构化JSON日志:")
print("   cat /var/log/celery/worker.log | jq 'select(.level==\"ERROR\")'")

print("\n" + "="*80)
print("验证完成".center(80))
print("="*80)