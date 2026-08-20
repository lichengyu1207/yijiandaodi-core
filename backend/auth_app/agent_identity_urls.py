"""
Agent身份认证URL路由

提供Agent身份管理的完整API路由
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .agent_identity_views import (
    AgentIdentityViewSet,
    AgentPermissionViewSet,
    AgentAuthSessionViewSet
)

# 创建路由器
router = DefaultRouter()
router.register(r'identities', AgentIdentityViewSet, basename='agent-identity')
router.register(r'permissions', AgentPermissionViewSet, basename='agent-permission')
router.register(r'sessions', AgentAuthSessionViewSet, basename='agent-session')

urlpatterns = [
    # 包含路由器的所有路由
    path('', include(router.urls)),
]

"""
API端点列表：

Agent身份管理：
- POST   /api/agent/identities/                    创建Agent
- GET    /api/agent/identities/                    查询Agent列表
- GET    /api/agent/identities/{id}/               查询Agent详情
- PUT    /api/agent/identities/{id}/               更新Agent信息
- DELETE /api/agent/identities/{id}/               删除Agent
- POST   /api/agent/identities/{id}/verify_api_key/    验证API Key
- POST   /api/agent/identities/{id}/regenerate_api_key/ 重新生成API Key
- POST   /api/agent/identities/{id}/deactivate/    停用Agent
- POST   /api/agent/identities/{id}/activate/      激活Agent
- GET    /api/agent/identities/{id}/permissions/   获取Agent权限列表
- GET    /api/agent/identities/{id}/sessions/      获取Agent会话列表
- GET    /api/agent/identities/{id}/auth_logs/     获取Agent认证日志

Agent权限管理：
- POST   /api/agent/permissions/                   创建权限
- GET    /api/agent/permissions/                   查询权限列表
- GET    /api/agent/permissions/{id}/              查询权限详情
- PUT    /api/agent/permissions/{id}/              更新权限
- DELETE /api/agent/permissions/{id}/              删除权限

Agent会话管理：
- GET    /api/agent/sessions/                      查询会话列表
- GET    /api/agent/sessions/{id}/                 查询会话详情
- POST   /api/agent/sessions/{id}/terminate/       终止会话
"""