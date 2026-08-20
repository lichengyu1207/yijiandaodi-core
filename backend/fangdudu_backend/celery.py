"""
Celery配置和初始化

配置Celery Beat定时任务，用于定期归档和清理
"""

import os
from celery import Celery
from celery.schedules import crontab

# 设置Django默认配置模块
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'fangdudu_backend.settings')

# 创建Celery应用
app = Celery('fangdudu_backend')

# 使用Django的配置文件加载Celery配置
app.config_from_object('django.conf:settings', namespace='CELERY')

# 自动发现任务
app.autodiscover_tasks()


# Celery Beat定时任务配置
app.conf.beat_schedule = {
    # 每天凌晨2点归档旧轨迹
    'archive-old-trajectories-daily': {
        'task': 'auth_app.tasks.archive_old_trajectories_async',
        'schedule': crontab(hour=2, minute=0),
        'args': (7,),  # 归档7天前的数据
    },

    # 每周日凌晨3点清理旧活动日志
    'cleanup-old-activities-weekly': {
        'task': 'auth_app.tasks.cleanup_old_activities_task',
        'schedule': crontab(day_of_week=0, hour=3, minute=0),
        'args': (30, 1000),  # 清理30天前的数据，批次1000
    },

    # 每小时检查磁盘空间
    'check-disk-space-hourly': {
        'task': 'auth_app.tasks.check_disk_space_task',
        'schedule': crontab(minute=0),  # 每小时整点执行
    },

    # 每天上午10点获取表数据量统计
    'get-table-sizes-daily': {
        'task': 'auth_app.tasks.get_table_sizes_task',
        'schedule': crontab(hour=10, minute=0),
    },
}


@app.task(bind=True)
def debug_task(self):
    """调试任务"""
    print(f'Request: {self.request!r}')