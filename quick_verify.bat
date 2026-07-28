@echo off
echo ================================
echo 一鉴到底 - 快速验证脚本
echo ================================
echo.

echo [Step 1/5] 验证Django配置...
cd backend
python manage.py check
if %errorlevel% neq 0 (
    echo ❌ Django配置检查失败
    pause
    exit /b 1
)
echo ✅ Django配置正常
cd ..

echo.
echo [Step 2/5] 运行数据库迁移...
cd backend
python manage.py migrate
if %errorlevel% neq 0 (
    echo ❌ 数据库迁移失败
    pause
    exit /b 1
)
echo ✅ 数据库迁移完成
cd ..

echo.
echo [Step 3/5] 验证管理员API...
python tools/verify_admin_api_connection.py
echo ✅ 管理员API验证完成

echo.
echo [Step 4/5] 运行Git泄露检测...
python tools/git_leak_detector.py .
echo ✅ Git泄露检测完成

echo.
echo [Step 5/5] 检查环境配置...
if exist "frontend\.env" (
    echo ✅ 前端配置文件存在
) else (
    echo ❌ 前端配置文件不存在
)

echo.
echo ================================
echo ✅ 所有验证完成！
echo ================================
echo.
echo 下一步：
echo 1. 启动后端：cd backend ^&^& python manage.py runserver
echo 2. 启动前端：cd frontend ^&^& npm run dev
echo 3. 启动桌面端：cd desktop-client-2.0 ^&^& npm run dev
echo.
pause