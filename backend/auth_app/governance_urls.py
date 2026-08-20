"""
合规治理层 URL 路由配置

提供Agent合规性评分、治理健康度监控、策略版本管理的URL路由
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .governance_views import (
    AgentComplianceScoreViewSet,
    GovernanceHealthViewSet,
    StrategyVersionViewSet
)

# 创建DRF路由器
router = DefaultRouter()

# 注册视图集
router.register(r'compliance-scores', AgentComplianceScoreViewSet, basename='compliance-score')
router.register(r'health', GovernanceHealthViewSet, basename='governance-health')
router.register(r'strategy-versions', StrategyVersionViewSet, basename='strategy-version')

# URL模式
urlpatterns = [
    path('', include(router.urls)),
]


# API端点说明：
# 
# Agent合规性评分API:
# - GET    /api/v1/governance/compliance-scores/                    # 列表（支持筛选）
# - POST   /api/v1/governance/compliance-scores/                    # 创建
# - GET    /api/v1/governance/compliance-scores/{id}/               # 详情
# - PUT    /api/v1/governance/compliance-scores/{id}/               # 更新
# - DELETE /api/v1/governance/compliance-scores/{id}/               # 删除
# - GET    /api/v1/governance/compliance-scores/statistics/         # 统计
# - POST   /api/v1/governance/compliance-scores/{id}/update_scores/ # 更新评分
# - POST   /api/v1/governance/compliance-scores/{id}/record_violation/ # 记录违规
#
# 治理健康度监控API:
# - GET    /api/v1/governance/health/                    # 列表（支持时间范围筛选）
# - GET    /api/v1/governance/health/{id}/               # 详情
# - GET    /api/v1/governance/health/latest/             # 最新快照
# - POST   /api/v1/governance/health/take_snapshot/      # 拍摄快照
# - GET    /api/v1/governance/health/dashboard/          # 仪表板数据
#
# 策略版本管理API:
# - GET    /api/v1/governance/strategy-versions/         # 列表（支持状态筛选）
# - POST   /api/v1/governance/strategy-versions/         # 创建
# - GET    /api/v1/governance/strategy-versions/{id}/    # 详情
# - PUT    /api/v1/governance/strategy-versions/{id}/    # 更新
# - DELETE /api/v1/governance/strategy-versions/{id}/    # 删除
# - POST   /api/v1/governance/strategy-versions/{id}/deploy/   # 部署
# - POST   /api/v1/governance/strategy-versions/{id}/rollback/ # 回滚
# - GET    /api/v1/governance/strategy-versions/active/  # 激活的策略版本