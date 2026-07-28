# ============================================================
# Celery 应用配置 - 一鉴到底消息队列系统
# 
# 功能:
#   - 异步任务处理（邮件发送、数据处理、报告生成）
#   - 定时任务调度（数据清理、统计计算、告警检测）
#   - 任务重试与错误处理
#   - 任务进度跟踪
# ============================================================

from celery import Celery
from celery.schedules import crontab
import os

# 设置默认Django settings模块
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')

# 创建Celery应用
app = Celery('yijiandaodi')

# 从Django settings加载配置
app.config_from_object('django.conf:settings', namespace='CELERY')

# 自动发现所有app下的tasks.py
app.autodiscover_tasks()


# ============================================================
# Celery 配置说明
# ============================================================
# 在 settings.py 中添加以下配置:
#
# CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL', 'redis://localhost:6379/0')
# CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND', 'redis://localhost:6379/1')
# CELERY_ACCEPT_CONTENT = ['json']
# CELERY_TASK_SERIALIZER = 'json'
# CELERY_RESULT_SERIALIZER = 'json'
# CELERY_TIMEZONE = 'Asia/Shanghai'
# CELERY_ENABLE_UTC = True
# CELERY_TASK_TRACK_STARTED = True
# CELERY_TASK_TIME_LIMIT = 30 * 60  # 30分钟超时
# CELERY_TASK_SOFT_TIME_LIMIT = 25 * 60  # 25分钟软超时
# CELERY_WORKER_PREFETCH_MULTIPLIER = 4
# CELERY_WORKER_MAX_TASKS_PER_CHILD = 1000


# ============================================================
# 定时任务配置 (Celery Beat)
# ============================================================
app.conf.beat_schedule = {
    # 每5分钟清理过期Token
    'cleanup-expired-tokens-every-5-min': {
        'task': 'auth_app.tasks.cleanup_expired_tokens',
        'schedule': 300.0,  # 5分钟
    },
    # 每小时清理过期会话
    'cleanup-expired-sessions-every-hour': {
        'task': 'auth_app.tasks.cleanup_expired_sessions',
        'schedule': 3600.0,  # 1小时
    },
    # 每天凌晨2点清理旧日志
    'cleanup-old-logs-daily': {
        'task': 'auth_app.tasks.cleanup_old_logs',
        'schedule': crontab(hour=2, minute=0),
    },
    # 每10分钟检查Agent健康状态
    'check-agent-health-every-10-min': {
        'task': 'auth_app.tasks.check_agent_health',
        'schedule': 600.0,  # 10分钟
    },
    # 每小时聚合告警
    'aggregate-alerts-hourly': {
        'task': 'auth_app.tasks.aggregate_alerts',
        'schedule': 3600.0,  # 1小时
    },
    # 每天凌晨3点生成统计报告
    'generate-daily-stats-report': {
        'task': 'auth_app.tasks.generate_daily_stats',
        'schedule': crontab(hour=3, minute=0),
    },
}


# ============================================================
# 启动命令
# ============================================================
# 启动Worker:
#   celery -A fangdudu_backend.celery_app worker -l info
# 
# 启动Beat (定时任务调度器):
#   celery -A fangdudu_backend.celery_app beat -l info
#
# 生产环境启动 (使用supervisor或systemd):
#   celery -A fangdudu_backend.celery_app worker \
#       --loglevel=info \
#       --concurrency=4 \
#       --max-tasks-per-child=1000 \
#       --queues=default,high_priority,low_priority