"""验证Agent活动日志测试数据"""

import os
import sys
import django

# 设置Django环境
sys.path.insert(0, '.')
os.environ['DJANGO_SETTINGS_MODULE'] = 'fangdudu_backend.settings'
django.setup()

from auth_app.agent_activity_models import AgentActivityLog
from django.db.models import Count, Avg, Max

# 统计信息
total = AgentActivityLog.objects.count()
print(f'总记录数: {total}')

# 按Agent类型统计
agent_dist = AgentActivityLog.objects.values('agent_type').annotate(count=Count('activity_id'))
print('\nAgent类型分布:')
for item in agent_dist:
    print(f'  {item["agent_type"]}: {item["count"]}条')

# 按风险等级统计
risk_dist = AgentActivityLog.objects.values('risk_level').annotate(count=Count('activity_id'))
print('\n风险等级分布:')
for item in risk_dist:
    print(f'  {item["risk_level"]}: {item["count"]}条')

# 按操作类型统计
action_dist = AgentActivityLog.objects.values('action').annotate(count=Count('activity_id'))
print('\n操作类型分布:')
for item in action_dist:
    print(f'  {item["action"]}: {item["count"]}条')

# 风险分数统计
stats = AgentActivityLog.objects.aggregate(
    avg_score=Avg('risk_score'),
    max_score=Max('risk_score')
)
print(f'\n风险分数统计:')
print(f'  平均分: {stats["avg_score"]:.1f}')
print(f'  最高分: {stats["max_score"]}')

# 显示前5条记录
print('\n前5条记录:')
for log in AgentActivityLog.objects.all()[:5]:
    print(f'  [{log.timestamp}] {log.agent_type} - {log.action} - {log.risk_score}分 - {log.risk_level}')

# 会话分析
print('\n会话信息:')
session = AgentActivityLog.objects.first()
if session:
    print(f'  会话ID: {session.session_id}')
    print(f'  客户端ID: {session.client_id}')

print('\n✅ 数据验证完成！')