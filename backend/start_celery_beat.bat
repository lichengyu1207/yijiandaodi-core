@echo off
REM ========================================
REM Celery Beat 启动脚本（生产环境）
REM ========================================

cd /d c:\MsSafeData\Desktop\yijiandaodi\backend

echo 正在启动 Celery Beat（定时任务调度器）...
echo 日志文件: logs\celery.log, logs\self_audit.log
echo.

REM 启动 Celery Beat
REM --loglevel=INFO: 生产环境使用INFO级别
REM 使用 django_celery_beat 数据库调度器

celery -A fangdudu_backend beat ^
    --loglevel=INFO ^
    --logfile=logs\celery_beat.log ^
    --pidfile=logs\celery_beat.pid ^
    --scheduler django_celery_beat.schedulers:DatabaseScheduler

pause