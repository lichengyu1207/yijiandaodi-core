"""
海马体记忆系统URL路由

提供三层记忆模型的完整API路由
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .memory_views import (
    ShortTermMemoryViewSet,
    LongTermMemoryViewSet,
    StrategicMemoryViewSet,
    MemoryStatisticsViewSet
)

# 创建路由器
router = DefaultRouter()
router.register(r'short-term', ShortTermMemoryViewSet, basename='short-term-memory')
router.register(r'long-term', LongTermMemoryViewSet, basename='long-term-memory')
router.register(r'strategic', StrategicMemoryViewSet, basename='strategic-memory')
router.register(r'statistics', MemoryStatisticsViewSet, basename='memory-statistics')

urlpatterns = [
    # 包含路由器的所有路由
    path('', include(router.urls)),
]

"""
API端点列表：

短期记忆（ShortTermMemory）：
- POST   /api/v1/memory/short-term/                    创建短期记忆
- GET    /api/v1/memory/short-term/                    查询短期记忆列表（自动过滤过期）
- GET    /api/v1/memory/short-term/{id}/               查询短期记忆详情
- PUT    /api/v1/memory/short-term/{id}/               更新短期记忆
- DELETE /api/v1/memory/short-term/{id}/               删除短期记忆
- POST   /api/v1/memory/short-term/cleanup_expired/    清理过期的短期记忆
- GET    /api/v1/memory/short-term/risk_statistics/    风险统计

长期记忆（LongTermMemory）：
- POST   /api/v1/memory/long-term/                    创建长期记忆（自动关联用户）
- GET    /api/v1/memory/long-term/                    查询长期记忆列表
- GET    /api/v1/memory/long-term/{id}/               查询长期记忆详情
- PUT    /api/v1/memory/long-term/{id}/               更新长期记忆
- DELETE /api/v1/memory/long-term/{id}/               删除长期记忆
- GET    /api/v1/memory/long-term/chain_verification/ 验证五元组链完整性
- POST   /api/v1/memory/long-term/export_report/      导出审计报告

策略记忆（StrategicMemory）：
- POST   /api/v1/memory/strategic/                    创建策略记忆
- GET    /api/v1/memory/strategic/                    查询策略记忆列表
- GET    /api/v1/memory/strategic/{id}/               查询策略记忆详情
- PUT    /api/v1/memory/strategic/{id}/               更新策略记忆
- DELETE /api/v1/memory/strategic/{id}/               删除策略记忆
- POST   /api/v1/memory/strategic/{id}/iterate/       策略迭代（创建新版本）
- POST   /api/v1/memory/strategic/{id}/activate/      激活策略
- POST   /api/v1/memory/strategic/{id}/deactivate/    停用策略
- GET    /api/v1/memory/strategic/effective_strategies/ 获取当前生效的策略

记忆统计（MemoryStatistics）：
- GET    /api/v1/memory/statistics/                   获取记忆统计信息
"""