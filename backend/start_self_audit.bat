@echo off
REM ============================================================
REM 一键启动自监控系统 - 启动所有必要的服务
REM ============================================================

echo.
echo ========================================================
echo    一鉴到底 - 自监控系统启动脚本
echo ========================================================
echo.

REM 检查是否在正确的目录
if not exist "manage.py" (
    echo [ERROR] 请在 backend 目录下运行此脚本！
    echo 当前目录：%CD%
    pause
    exit /b 1
)

echo [步骤1] 检查Redis服务...
echo.
echo 注意：如果Redis未安装，请先安装：
echo   - Chocolatey: choco install redis-64
echo   - 或下载：https://github.com/microsoftarchive/redis/releases
echo.

REM 尝试启动Redis（如果已安装）
where redis-server >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Redis已安装，尝试启动...
    start "Redis Server" redis-server
    timeout /t 2 /nobreak >nul
) else (
    echo [WARNING] Redis未安装或不在PATH中
    echo 请手动启动Redis服务
)

echo.
echo [步骤2] 启动Celery Worker...
echo.
start "Celery Worker" cmd /k "celery -A fangdudu_backend.celery_app worker -l info --pool=solo"
timeout /t 3 /nobreak >nul

echo [步骤3] 启动Celery Beat (定时任务调度器)...
echo.
start "Celery Beat" cmd /k "celery -A fangdudu_backend.celery_app beat -l info"
timeout /t 3 /nobreak >nul

echo.
echo ========================================================
echo    所有服务已启动！
echo ========================================================
echo.
echo 已启动的服务：
echo   [1] Redis Server (消息队列)
echo   [2] Celery Worker (任务执行器)
echo   [3] Celery Beat (定时任务调度器)
echo.
echo 定时任务执行频率：
echo   - 准确率漂移检测：每15分钟
echo   - 响应时间异常检测：每15分钟
echo   - 误报率检测：每小时
echo   - 权限审计：每小时
echo   - 规则时效性检测：每天凌晨4点
echo   - 综合检查：每小时
echo   - 报告生成：小时/日/周/月
echo.
echo 查看日志：
echo   Get-Content logs\self_audit.log -Wait
echo.
echo 监控面板：
echo   celery -A fangdudu_backend.celery_app flower --port=5555
echo   访问：http://localhost:5555
echo.
echo 按任意键关闭此窗口（服务将继续运行）...
pause >nul