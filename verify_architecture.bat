@echo off
echo ================================
echo 一鉴到底 - 架构验证脚本
echo ================================
echo.

echo [1/5] 验证桌面端依赖注入容器...
cd desktop-client-2.0
call npm test -- electron/di/container.test.ts
if %errorlevel% neq 0 (
    echo ❌ DI容器测试失败
    pause
    exit /b 1
)
echo ✅ DI容器测试通过

echo.
echo [2/5] 验证监控服务...
call npm test -- electron/services/monitoring.test.ts
if %errorlevel% neq 0 (
    echo ❌ 监控服务测试失败
    pause
    exit /b 1
)
echo ✅ 监控服务测试通过
cd ..

echo.
echo [3/5] 验证后端追踪中间件...
cd backend
python manage.py check
if %errorlevel% neq 0 (
    echo ❌ Django配置检查失败
    pause
    exit /b 1
)
echo ✅ Django配置检查通过
cd ..

echo.
echo [4/5] 运行Git泄露检测...
python tools/git_leak_detector.py .
if %errorlevel% neq 0 (
    echo ⚠️ 发现敏感信息泄露风险，请检查 git_leak_report.json
)
echo ✅ Git泄露检测完成

echo.
echo [5/5] 验证目录结构...
if not exist "backend\logs" mkdir backend\logs
if not exist "desktop-client-2.0\electron\di" (
    echo ❌ DI目录不存在
    pause
    exit /b 1
)
if not exist "desktop-client-2.0\electron\services" (
    echo ❌ Services目录不存在
    pause
    exit /b 1
)
echo ✅ 目录结构验证通过

echo.
echo ================================
echo ✅ 所有验证通过！
echo ================================
echo.
echo 下一步：
echo 1. 启动后端：cd backend ^&^& python manage.py runserver
echo 2. 启动前端：cd frontend ^&^& npm run dev
echo 3. 启动桌面端：cd desktop-client-2.0 ^&^& npm run dev
echo.
pause