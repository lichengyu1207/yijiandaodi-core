@echo off
chcp 65001 >nul
echo ========================================
echo   Node.js 辅助服务启动器
echo ========================================
echo.

cd /d C:\MsSafeData\Desktop\yijiandaodi\nodejs-service

if not exist "node_modules" (
    echo [1/2] 正在安装依赖...
    call npm install
) else (
    echo ✅ 依赖已安装
)

echo.
echo [2/2] 启动Node.js服务...
echo 📍 服务地址: http://localhost:4000
echo 🔗 WebSocket: ws://localhost:4000/ws
echo 📁 文件上传: http://localhost:4000/api/upload
echo.
echo 按 Ctrl+C 停止服务器
echo ----------------------------------------

call npm run dev

pause
