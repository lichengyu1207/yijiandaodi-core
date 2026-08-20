"""
文件监控系统URL路由

配置文件监控相关的API接口路由
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .file_watch_views import (
    FileWatchConfigViewSet,
    FileOperationLogViewSet,
    FileVerificationViewSet,
    FileHashRecordViewSet,
    FileRiskAssessmentViewSet
)

# 创建路由器
router = DefaultRouter()

# 注册视图集
router.register(r'configs', FileWatchConfigViewSet, basename='file-watch-config')
router.register(r'logs', FileOperationLogViewSet, basename='file-operation-log')
router.register(r'verify', FileVerificationViewSet, basename='file-verification')
router.register(r'hash-records', FileHashRecordViewSet, basename='file-hash-record')
router.register(r'risk-assessments', FileRiskAssessmentViewSet, basename='file-risk-assessment')

# URL模式列表
urlpatterns = [
    path('', include(router.urls)),
]


"""
API接口列表：

1. 监控配置管理
   - GET    /api/v1/file-watch/configs/              # 获取配置列表
   - POST   /api/v1/file-watch/configs/              # 创建配置
   - GET    /api/v1/file-watch/configs/{id}/         # 获取单个配置
   - PUT    /api/v1/file-watch/configs/{id}/         # 更新配置
   - DELETE /api/v1/file-watch/configs/{id}/         # 删除配置
   - POST   /api/v1/file-watch/configs/{id}/activate/   # 激活监控
   - POST   /api/v1/file-watch/configs/{id}/deactivate/ # 停止监控
   - GET    /api/v1/file-watch/configs/{id}/statistics/ # 获取统计信息

2. 操作日志查询
   - GET    /api/v1/file-watch/logs/                 # 获取日志列表
   - GET    /api/v1/file-watch/logs/{id}/            # 获取单个日志
   - POST   /api/v1/file-watch/logs/{id}/confirm/    # 确认高风险操作
   - GET    /api/v1/file-watch/logs/summary/         # 获取日志汇总

3. 文件校验
   - POST   /api/v1/file-watch/verify/               # 手动触发校验

4. 哈希记录查询
   - GET    /api/v1/file-watch/hash-records/         # 获取哈希记录列表
   - GET    /api/v1/file-watch/hash-records/{id}/    # 获取单条记录

5. 风险评估查询
   - GET    /api/v1/file-watch/risk-assessments/     # 获取评估列表
   - GET    /api/v1/file-watch/risk-assessments/{id}/ # 获取单条评估
"""