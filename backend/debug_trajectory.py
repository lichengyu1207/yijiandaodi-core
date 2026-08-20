"""
调试build_trajectory_async失败原因
"""

import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
sys.path.insert(0, '/c/MsSafeData/Desktop/yijiandaodi/backend')
django.setup()

from django.utils import timezone
import uuid

from auth_app.tasks import build_trajectory_async
from auth_app.agent_activity_models import AgentActivityLog
from auth_app.trajectory_builder import TrajectoryBuilder

# 创建真实数据
session_id = f'debug_session_{uuid.uuid4().hex[:8]}'
client_id = f'debug_client_{uuid.uuid4().hex[:8]}'

print("="*80)
print("调试build_trajectory_async失败原因".center(80))
print("="*80)

print("\n步骤1: 创建AgentActivityLog")
activity = AgentActivityLog.objects.create(
    activity_id=f'act_debug_{uuid.uuid4().hex[:8]}',
    session_id=session_id,
    client_id=client_id,
    agent_type='cursor',
    action='file_operation',
    target='/test/file.py',
    risk_score=30,
    risk_level='low',
    timestamp=timezone.now()
)

print(f"  ✅ ActivityLog创建成功: {activity.activity_id}")
print(f"    - Session: {activity.session_id}")
print(f"    - Client: {activity.client_id}")

print("\n步骤2: 调用build_trajectory_async")
result = build_trajectory_async(activity.activity_id)

print(f"\n任务返回结果:")
print(f"  - Success: {result.get('success')}")
print(f"  - Activity ID: {result.get('activity_id')}")

if not result.get('success'):
    print(f"  - Error: {result.get('error')}")
    print(f"  - Error Type: {result.get('error_type')}")

    if 'traceback' in result:
        print(f"\n  详细堆栈追踪:")
        traceback_lines = result['traceback'].split('\n')[:15]
        for line in traceback_lines:
            print(f"    {line}")

print("\n步骤3: 尝试直接调用TrajectoryBuilder")
try:
    trajectory = TrajectoryBuilder.build_or_update_trajectory(activity)
    print(f"  ✅ 直接调用成功")
    print(f"    - Trajectory ID: {trajectory.trajectory_id}")
    print(f"    - Total Activities: {trajectory.total_activities}")
except Exception as e:
    print(f"  ❌ 直接调用失败")
    print(f"    - Error Type: {type(e).__name__}")
    print(f"    - Error Message: {str(e)}")

    import traceback
    traceback.print_exc()

print("\n" + "="*80)
print("调试完成".center(80))
print("="*80)