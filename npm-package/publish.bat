@echo off
REM NPM 发布脚本
REM 使用方法：运行此脚本，然后输入 NPM 凭据

echo ===================================
echo   一鉴到底核心库发布到 NPM
echo ===================================
echo.

REM 检查是否已登录
echo 步骤1: 检查 NPM 登录状态...
npm whoami 2>nul
if %errorlevel% neq 0 (
    echo 未登录，请先登录 NPM...
    echo.
    echo 用户名: lichengyu1207
    echo 邮箱: (请输入你的邮箱)
    echo 密码: (请输入密码)
    echo.
    npm login
) else (
    echo 已登录
)

REM 确认发布
echo.
echo 步骤2: 准备发布...
echo 包名: yijiandaodi-core
echo 版本: 1.0.0
echo.
set /p confirm="确认发布？(y/n): "
if /i not "%confirm%"=="y" (
    echo 取消发布
    pause
    exit /b
)

REM 发布到 NPM
echo.
echo 步骤3: 发布到 NPM...
npm publish --access public

if %errorlevel% equ 0 (
    echo.
    echo ===================================
    echo   ✅ 发布成功！
    echo ===================================
    echo.
    echo 包地址: https://www.npmjs.com/package/yijiandaodi-core
    echo.
    echo 使用方法:
    echo   npm install yijiandaodi-core
    echo.
) else (
    echo.
    echo ❌ 发布失败，请检查错误信息
)

pause