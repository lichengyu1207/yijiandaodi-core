"""
Django Admin 配置

注册所有数据模型到管理后台
"""

from django.contrib import admin

# 导入文件监控管理配置
from .file_watch_admin import (
    FileWatchConfigAdmin,
    FileOperationLogAdmin,
    FileHashRecordAdmin,
    FileRiskAssessmentAdmin
)

# 导入合规治理管理配置
from .governance_admin import AgentComplianceScoreAdmin

# 注意：实际的模型注册在各个 *admin.py 文件中
# 这里只是确保所有管理配置被导入

# 为了让Django识别这些管理类，需要在模型的admin.py中注册
# 由于我们使用了 @admin.register() 装饰器，所以不需要在这里额外注册