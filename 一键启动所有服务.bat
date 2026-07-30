@echo off
chcp 65001 >nul
title 一鉴到底 - 模块一 完整测试环境
color 0A
echo.
echo ╔═══════════════════════════════════════════════════════════╗
echo ║          🚀 一鉴到底 - 模块一 测试环境启动器            ║
echo ║     Frontend(React) + Backend(Django) + Node.js           ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.

cd /d C:\MsSafeData\Desktop\yijiandaodi

echo [检查环境]
echo ----------------------------------------

if not exist "frontend\node_modules" (
    echo ⚠️  前端依赖未安装，正在安装...
    cd frontend && call npm install >nul 2>&1 && cd ..
    echo ✅ 前端依赖安装完成
) else (
    echo ✅ 前端依赖正常
)

if not exist "nodejs-service\node_modules" (
    echo ⚠️  Node.js服务依赖未安装，正在安装...
    cd nodejs-service && call npm install >nul 2>&1 && cd ..
    echo ✅ Node.js服务依赖安装完成
) else (
    echo ✅ Node.js服务依赖正常
)

echo.
echo ========================================
echo   正在启动所有服务...
echo ========================================
echo.

echo [1/3] 启动 Django 后端服务器 (端口: 8000)
start "Django-Backend" cmd /k "cd backend && .\venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000"
timeout /t 3 /nobreak >nul

echo.
echo [2/3] 启动 Node.js 辅助服务 (端口: 4000)
start "NodeJS-Service" cmd /k "cd nodejs-service && node src/index.js"
timeout /t 2 /nobreak >nul

echo.
echo [3/3] 启动 React 前端服务器 (端口: 3000)
start "React-Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ╔═══════════════════════════════════════════════════════════╗
echo ║                    ✅ 所有服务已启动！                     ║
echo ╠═══════════════════════════════════════════════════════════╣
echo ║  📍 前端地址:    http://localhost:3000                    ║
echo ║  🔗 登录页面:    http://localhost:3000/login              ║
echo ║  🐍 后端API:     http://localhost:8000                    ║
echo ║  🔌 Node.js:     http://localhost:4000                    ║
echo ╠═══════════════════════════════════════════════════════════╣
echo ║  👤 测试账号:    admin / Admin@2026                      ║
echo ╚═══════════════════════════════════════════════════════════╝
echo.
echo 按任意键打开浏览器访问登录页面...
pause >nul

start http://localhost:3000/login

echo.
echo 服务运行中... 按任意键查看使用说明
pause >nul

echo.
echo ╔════════════════════════════════════════════════╗
echo ║               使用说明                        ║
echo ╠════════════════════════════════════════════════╣
echo ║  1. 打开浏览器访问 http://localhost:3000/login ║
echo ║  2. 输入账号: admin                           ║
echo ║  3. 输入密码: Admin@2026                       ║
echo ║  4. 点击登录按钮                              ║
echo ║  5. 成功后跳转到后台管理页面                   ║
echo ╚════════════════════════════════════════════════╝
echo.
pause
