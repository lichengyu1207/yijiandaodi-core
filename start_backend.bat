@echo off
chcp 65001 >nul
echo ========================================
echo   一鉴到底 - 模块一测试环境启动器
echo ========================================
echo.

cd /d C:\MsSafeData\Desktop\yijiandaodi\backend

echo [1/2] 正在检查Python依赖...
.\venv\Scripts\python.exe -c "import django; import rest_framework" >nul 2>&1
if errorlevel 1 (
    echo ❌ 依赖未安装，正在安装...
    .\venv\Scripts\pip.exe install -r requirements.txt
) else (
    echo ✅ Python依赖正常
)

echo.
echo [2/2] 启动Django后端服务器...
echo 📍 后端地址: http://localhost:8000
echo 🔗 API接口: http://localhost:8000/api/auth/
echo.
echo 按 Ctrl+C 停止服务器
echo ----------------------------------------

.\venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000

pause
