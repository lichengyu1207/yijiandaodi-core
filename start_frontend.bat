@echo off
chcp 65001 >nul
echo ========================================
echo   一鉴到底 - 模块一测试环境启动器
echo ========================================
echo.

cd /d C:\MsSafeData\Desktop\yijiandaodi\frontend

echo [1/2] 正在检查Node依赖...
if not exist "node_modules" (
    echo ❌ 依赖未安装，正在安装...
    call npm install
) else (
    echo ✅ Node依赖正常
)

echo.
echo [2/2] 启动React前端服务器...
echo 📍 前端地址: http://localhost:3000
echo 🔗 登录页面: http://localhost:3000/login
echo.
echo 按 Ctrl+C 停止服务器
echo ----------------------------------------

call npm run dev

pause
