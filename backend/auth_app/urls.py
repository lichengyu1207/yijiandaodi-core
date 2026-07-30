from django.urls import path, include
from . import views
from .grammar_views import GrammarCheckView, GrammarImproveView, GrammarStyleView
from .tip_views import CreateTipView, MyGivenTipsView, MyReceivedTipsView, PublicTipWallView, CancelTipView

app_name = 'auth'

urlpatterns = [
    path('login/', views.LoginView.as_view(), name='login'),
    path('register/', views.RegisterView.as_view(), name='register'),
    path('userinfo/', views.UserInfoView.as_view(), name='userinfo'),
    path('logout/', views.LogoutView.as_view(), name='logout'),
    path('change-password/', views.ChangePasswordView.as_view(), name='change-password'),
    path('delete-account/', views.DeleteAccountView.as_view(), name='delete-account'),
    path('system-status/', views.SystemStatusView.as_view(), name='system-status'),
    path('users/', views.UserListView.as_view(), name='user-list'),
    path('users/<int:pk>/', views.UserUpdateView.as_view(), name='user-detail'),
    path('login-logs/', views.LoginLogListView.as_view(), name='login-logs'),
    path('grammar/check/', GrammarCheckView.as_view(), name='grammar-check'),
    path('grammar/improve/', GrammarImproveView.as_view(), name='grammar-improve'),
    path('grammar/style/', GrammarStyleView.as_view(), name='grammar-style'),

    path('tips/create/', CreateTipView.as_view(), name='tip-create'),
    path('tips/my-given/', MyGivenTipsView.as_view(), name='tip-my-given'),
    path('tips/my-received/', MyReceivedTipsView.as_view(), name='tip-my-received'),
    path('tips/public/<int:user_id>/', PublicTipWallView.as_view(), name='tip-public-wall'),
    path('tips/<int:tip_id>/cancel/', CancelTipView.as_view(), name='tip-cancel'),
    
    # Agent行为分析API路由
    path('behavior/', include('auth_app.behavior_urls')),
    
    # 安全测试API路由
    path('security/', include('auth_app.security_test_urls')),
    
    # 告警管理API路由
    path('alert/', include('auth_app.alert_urls')),
    
    # 误报检测API路由
    path('fp/', include('auth_app.fp_urls')),
    
    # 权限控制API路由
    path('permission/', include('auth_app.permission_urls')),
    
    # Agent健康监控API路由
    path('health/', include('auth_app.health_urls')),
    
    # 自动化研判API路由
    path('automated/', include('auth_app.automated_urls')),
    
    # MTTR压缩API路由
    path('mttr/', include('auth_app.mttr_urls')),
    
    # Prompt注入对抗API路由
    path('prompt-defense/', include('auth_app.prompt_defense_urls')),
    
    # SaaS化定价API路由
    path('pricing/', include('auth_app.pricing_urls')),
    
    # Inline编译执行引擎API路由
    path('inline/', include('auth_app.inline_urls')),
    
    # 用户旅程管理API路由
    path('journey/', include('auth_app.journey_urls')),
    
    # 系统管理API路由（用户管理、浏览记录等）
    path('system-manage/', include('auth_app.system_manage_urls')),
    
    # 开发者申请API路由（API Key管理等）
    path('', include('auth_app.developer_urls')),
    
    # 报告生成API路由（三份报告交付）
    path('report/', include('auth_app.report_urls')),
    
    # 可信时间戳API路由（北京时间授时）
    path('timestamp/', include('auth_app.timestamp_urls')),

    # 浏览器插件数据同步API路由
    path('extension/', include('auth_app.extension_sync_urls')),

    # 原创作品审核API路由
    path('original/', include('auth_app.original_work_urls')),

    # 授权码管理API路由
    path('license/', include('auth_app.license_urls')),

    # Agent数据流API路由（Python SDK整合）
    path('agent/', include('auth_app.agent_flow_urls')),

    # Agent配置API路由
    path('agent/', include('auth_app.agent_urls')),

    # 常态化巡检API路由（核心功能）
    path('patrol/', include('auth_app.patrol_urls')),
]
