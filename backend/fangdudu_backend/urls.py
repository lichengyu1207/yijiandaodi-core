from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.views.static import serve
from django.http import JsonResponse, HttpResponse
from django.contrib.sitemaps.views import sitemap
from django.utils.functional import lazy
from content_app.front_views import BannerPublicListView as FrontBannerView
from .sitemap import sitemaps as yijiandaodi_sitemaps

# 导入实名认证视图（使用绝对导入）
from auth_app import realname_views

# 导入任务监控视图
from auth_app import task_monitor_views

# P0 统一控制面（M1 MVP）：内部运维/诊断通道
from content_app import control_plane_views

# P1-4 账号互通二期：用户个性化数据（主题/布局/收藏）持久化
from auth_app import profile_views


def health_check(request):
    """健康检查端点（Docker/Nginx 负载均衡探活用）"""
    return JsonResponse({
        'status': 'ok',
        'service': 'yijiandaodi-backend',
        'version': '1.0.0',
        'debug': settings.DEBUG,
    })


def robots_txt(request):
    """robots.txt 爬虫协议"""
    domain = request.get_host().split(':')[0]
    return HttpResponse(
        f"""User-agent: *
Allow: /

# 站点地图
Sitemap: https://{domain}/sitemap.xml

# 禁止爬取的路径
Disallow: /admin/
Disallow: /api/
Disallow: /static/
""",
        content_type='text/plain',
    )

urlpatterns = [
    path('api/health/', health_check, name='health-check'),
    path('admin/', admin.site.urls),
    path('api/auth/', include('auth_app.urls')),
    path('api/auth/verify-realname/', realname_views.verify_realname, name='verify-realname'),
    path('api/auth/verify-status/', realname_views.verify_status, name='verify-status'),
    
    # API Key管理
    path('api/api-keys/', include('auth_app.apikey_urls')),

    # 双因子认证
    path('api/auth/2fa/', include('auth_app.two_factor_urls')),

    path('api/rbac/', include('auth_app.rbac_urls')),
    path('api/agent/', include('auth_app.agent_urls')),
    path('api/security/', include('auth_app.security_urls')),
    path('api/risk-control/', include('auth_app.risk_control_urls')),
    path('api/agent-activities/', include('auth_app.agent_activity_urls')),
    path('api/risk-assessment/', include('auth_app.risk_assessment_urls')),  # 新增：风险评估API
    path('api/security-center/', include('auth_app.security_center_urls')),
    path('api/system/', include('auth_app.system_urls')),
    path('api/rag/', include('content_app.rag_urls')),
    path('api/content/', include('content_app.urls')),
    path('api/data/', include('data_app.urls')),
    path('api/front/', include('content_app.front_urls')),
    path('api/banners/public/', FrontBannerView.as_view(), name='banner-public'),
    path('api/mall/', include('auth_app.mall_urls')),
    path('api/log-center/', include('auth_app.log_center_urls')),
    path('api/system-manage/', include('auth_app.system_manage_urls')),
    path('api/function-cards/', include('auth_app.function_card_urls')),
    path('api/skill-config/', include('auth_app.skill_config_urls')),
    path('api/recommendation/', include('auth_app.recommendation_urls')),
    path('api/payment/', include('auth_app.payment_urls')),
    path('api/affiliate/', include('auth_app.affiliate_urls')),
    path('api/stats/', include('auth_app.stats_urls')),
    # P1-2 计费落库：消费费用分解
    path('api/usage/', include('auth_app.usage_urls')),
    # P2 计费实时挂钩：套餐消费账单
    path('api/billing/', include('auth_app.billing_urls')),
    path('api/ab/', include('auth_app.abtest_urls')),
    path('api/enterprise/', include('auth_app.enterprise_urls')),
    path('api/open/', include('auth_app.developer_urls')),
    path('api/data-classification/', include('auth_app.data_classification_urls')),
    path('api/packages/', include('auth_app.package_urls')),
    path('api/b-scenario/', include('content_app.b_scenario_urls')),
    path('api/tech/', include('content_app.tech_urls')),
    path('api/c-scenario/', include('content_app.c_scenario_urls')),
    path('api/unified-scan/', include('content_app.unified_scan_urls')),
    path('api/dual-engine/', include('content_app.dual_engine_urls')),
    path('api/anti-fraud/', include('content_app.antifraud_urls')),
    path('api/chapter-detect/', include('content_app.chapter_detect_urls')),
    path('api/copyscape/', include('content_app.copyscape_urls')),
    path('api/grammarly/', include('content_app.grammarly_urls')),
    path('api/resume/', include('content_app.resume_urls')),
    path('api/tipping/', include('content_app.tipping_urls')),
    path('api/workflow/', include('auth_app.workflow_urls')),
    path('api/pet/', include('auth_app.pet_urls')),  # 桌宠交互记录（新增）
    path('api/extension/', include('auth_app.extension_sync_urls')),  # 浏览器插件同步（新增）
    path('api/behavior/', include('auth_app.behavior_urls')),  # Agent行为监控（新增）
    path('api/v1/memory/', include('auth_app.memory_urls')),  # 海马体记忆系统（新增）
    path('api/v1/governance/', include('auth_app.governance_urls')),  # 合规治理层（新增）
    path('api/v1/file-watch/', include('auth_app.file_watch_urls')),  # 文件系统监控（新增）
    path('api/v1/process/', include('auth_app.process_watch_urls')),  # 进程行为监控（新增）
    path('api/p2p/v1/', include('p2p_app.urls')),

    # P0 统一控制面（M1 MVP）：内部运维/诊断通道
    path('api/modules/status/', control_plane_views.modules_status, name='modules-status'),
    path('api/deepseek/quota/', control_plane_views.deepseek_quota, name='deepseek-quota'),
    path('api/settings/log-level/', control_plane_views.log_level, name='log-level'),
    # P1-2 消费额度预警配置（开关/阈值/通知方式）
    path('api/settings/quota-alert/', control_plane_views.quota_alert, name='quota-alert'),
    # P1-4 用户个性化数据（主题/布局/收藏）持久化
    path('api/user/profile/', profile_views.user_profile, name='user-profile'),

    # Celery任务监控API（新增）
    path('api/tasks/<str:task_id>/status/', task_monitor_views.get_task_status_api, name='get-task-status'),
    path('api/tasks/<str:task_id>/error/', task_monitor_views.get_task_error_api, name='get-task-error'),
    path('api/tasks/<str:task_id>/retry-history/', task_monitor_views.get_retry_history_api, name='get-retry-history'),
    path('api/tasks/<str:task_id>/retry/', task_monitor_views.retry_task_api, name='retry-task'),
    path('api/tasks/failed/', task_monitor_views.get_recent_failed_tasks_api, name='get-failed-tasks'),
    path('api/tasks/performance/', task_monitor_views.get_task_performance_api, name='get-task-performance'),
    path('api/platform/v1/capabilities/', include('auth_app.platform_urls')),

    # 站点地图（SEO）
    path('sitemap.xml', sitemap, {
        'sitemaps': yijiandaodi_sitemaps,
    }, name='django-sitemap'),

    # 爬虫协议
    path('robots.txt', robots_txt, name='robots-txt'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
