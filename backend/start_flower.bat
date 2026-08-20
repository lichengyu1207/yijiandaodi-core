@echo off
REM ========================================
REM Celery Flower 监控面板启动脚本
REM ========================================

cd /d c:\MsSafeData\Desktop\yijiandaodi\backend

echo 正在启动 Celery Flower（监控面板）...
echo 访问地址: http://localhost:5555
echo.

REM 启动 Flower 监控面板
REM --port=5555: 监听5555端口
REM --broker=redis://localhost:6379/0: Redis broker地址

celery -A fangdudu_backend flower ^
    --port=5555 ^
    --broker=redis://localhost:6379/0 ^
    --logging_level=INFO

pause