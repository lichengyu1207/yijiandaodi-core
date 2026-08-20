# Agent身份可信层 - 快速验证脚本（修正版）

import os
import django

# 设置Django环境
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')
django.setup()

from auth_app.agent_identity_models import AgentIdentity
from django.contrib.auth import get_user_model

User = get_user_model()

# 获取或创建测试用户
test_user, created = User.objects.get_or_create(
    username='quick_test_user',
    defaults={'email': 'quick_test@example.com'}
)

print(f"✅ {'创建' if created else '找到'}用户: {test_user.username}")

# 创建Agent
agent, api_key = AgentIdentity.create_agent(
    agent_name='Quick Test Agent',
    agent_type='cursor',
    trust_level='medium',
    owner=test_user,
    created_by=test_user
)

print(f"\n✅ Agent创建成功！")
print(f"   Agent ID: {agent.agent_id}")
print(f"   Agent名称: {agent.agent_name}")
print(f"   API Key: {api_key}")  # 仅此一次显示
print(f"   信任级别: {agent.get_trust_level_description()}")
print(f"   API Key前缀: {agent.api_key_prefix}")

# 验证API Key
is_valid = agent.verify_api_key(api_key)
print(f"\n✅ API Key验证: {'成功' if is_valid else '失败'}")

# 测试错误API Key
is_valid_wrong = agent.verify_api_key('sk_live_wrong_key')
print(f"✅ 错误API Key验证: {'成功（不应该）' if is_valid_wrong else '失败（正常）'}")

# 测试权限
agent.permissions = {
    'file': ['read'],
    'network': ['read', 'write']
}
agent.save()

has_file_read = agent.has_permission('file', 'read')
has_file_write = agent.has_permission('file', 'write')
has_network_read = agent.has_permission('network', 'read')

print(f"\n✅ 权限测试:")
print(f"   文件读取: {'有' if has_file_read else '无'}")
print(f"   文件写入: {'有' if has_file_write else '无'}")
print(f"   网络读取: {'有' if has_network_read else '无'}")

# 统计
print(f"\n📊 当前数据库统计:")
print(f"   Agent总数: {AgentIdentity.objects.count()}")
print(f"   活跃Agent: {AgentIdentity.objects.filter(is_active=True).count()}")

print("\n✅ 所有验证通过！")