@echo off
echo.
echo ========================================
echo    YiJianDaoDi - Service Launcher
echo ========================================
echo.

cd /d "%~dp0backend"

echo [1/3] Starting Django backend...
start "YiJianDaoDi-Django" cmd /c "python manage.py runserver 8000"
timeout /t 2 >nul

echo [2/3] Starting MCP Proxy...
start "YiJianDaoDi-MCP-Proxy" cmd /c "python run_mcp_proxy.py --port 8765"
timeout /t 2 >nul

echo [3/3] Starting System Monitor...
start "YiJianDaoDi-SystemMonitor" cmd /c "python -c "from auth_app.system_monitor import SystemMonitor; import asyncio; asyncio.run(SystemMonitor().start())""
timeout /t 2 >nul

echo.
echo ========================================
echo    All services started
echo ========================================
echo.
echo   - Django Backend: http://localhost:8000
echo   - MCP Proxy:      127.0.0.1:8765
echo   - System Monitor: Running
echo.
echo Press any key to close this window...
pause >nul