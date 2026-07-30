@echo off
chcp 65001 > nul
echo ================================================
echo   一鉴到底 - 停止所有服务
echo ================================================
echo.

REM 停止 Python 服务
echo 停止沙箱 API...
taskkill /f /im python.exe 2>nul
taskkill /f /im pythonw.exe 2>nul

echo.
echo ✓ 所有服务已停止
echo.
pause