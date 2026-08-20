@echo off
REM ========================================
REM Celery Worker 启动脚本（生产环境）
REM ========================================

cd /d c:\MsSafeData\Desktop\yijiandaodi\backend

echo 正在启动 Celery Worker...
echo 日志文件: logs\celery.log
echo.

REM 启动 Celery Worker
REM --concurrency=4: 4个并发进程
REM --loglevel=INFO: 生产环境使用INFO级别
REM --max-tasks-per-child=1000: 每个子进程最多执行1000个任务后重启
REM --max-memory-per-child=300000: 每个子进程最多使用300MB内存

celery -A fangdudu_backend worker ^
    --concurrency=4 ^
    --loglevel=INFO ^
    --max-tasks-per-child=1000 ^
    --max-memory-per-child=300000 ^
    --logfile=logs\celery_worker.log ^
    --pidfile=logs\celery_worker.pid ^
    -n worker1@%%h

pause