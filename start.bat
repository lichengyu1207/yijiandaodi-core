@echo off
chcp 65001 > nul
echo ================================================
echo   一鉴到底 - 一键启动
echo ================================================
echo.
echo 正在启动所有服务...
echo.

REM 启动 Python 脚本
python start_all.py

pause