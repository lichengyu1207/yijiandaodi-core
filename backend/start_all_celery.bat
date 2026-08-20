@echo off
REM ========================================
REM 一键启动所有 Celery 服务
REM ========================================

cd /d c:\MsSafeData\Desktop\yijiandaodi\backend

echo ========================================
echo 正在启动所有 Celery 服务...
echo ========================================
echo.

REM 创建日志目录
if not exist "logs" mkdir logs

REM 启动 Worker（后台运行）
echo [1/3] 启动 Celery Worker...
start "Celery Worker" /MIN celery -A fangdudu_backend worker ^
    --concurrency=4 ^
    --loglevel=INFO ^
    --max-tasks-per-child=1000 ^
    --logfile=logs\celery_worker.log ^
    --pidfile=logs\celery_worker.pid ^
    -n worker1@%%h

timeout /t 3 /nobreak >nul

REM 启动 Beat（后台运行）
echo [2/3] 启动 Celery Beat...
start "Celery Beat" /MIN celery -A fangdudu_backend beat ^
    --loglevel=INFO ^
    --logfile=logs\celery_beat.log ^
    --pidfile=logs\celery_beat.pid ^
    --scheduler django_celery_beat.schedulers:DatabaseScheduler

timeout /t 3 /nobreak >nul

REM 启动 Flower 监控面板
echo [3/3] 启动 Flower 监控面板...
start "Flower Monitor" /MIN celery -A fangdudu_backend flower ^
    --port=5555 ^
    --broker=redis://localhost:6379/0 ^
    --logging_level=INFO

echo.
echo ========================================
echo 所有服务已启动！
echo ========================================
echo.
echo 日志文件位置:
echo   - Worker: logs\celery_worker.log
echo   - Beat:   logs\celery_beat.log
echo   - 自监控: logs\self_audit.log
echo.
echo 监控面板: http://localhost:5555
echo.
echo 按任意键关闭此窗口（服务将继续后台运行）...
pause >nul