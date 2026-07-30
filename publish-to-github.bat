@echo off
REM GitHub Packages 发布脚本

echo ===================================
echo   GitHub Packages 发布
echo ===================================
echo.

REM 检查是否已安装 Git
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: 未安装 Git
    echo 请先安装 Git: https://git-scm.com/downloads
    pause
    exit /b 1
)

echo 步骤1: 初始化 Git 仓库
if not exist ".git" (
    git init
    echo ✅ Git 仓库已初始化
) else (
    echo ✅ Git 仓库已存在
)

echo.
echo 步骤2: 添加文件到 Git
git add .
echo ✅ 文件已添加

echo.
echo 步骤3: 创建提交
git commit -m "发布 yijiandaodi-security-core v1.0.0"
echo ✅ 提交已创建

echo.
echo 步骤4: 检查远程仓库
git remote -v | findstr "origin" >nul
if %errorlevel% neq 0 (
    echo.
    echo ⚠️  未配置远程仓库
    echo.
    echo 请先在 GitHub 创建仓库：
    echo https://github.com/new
    echo.
    echo 仓库名建议：yijiandaodi-core
    echo.
    set /p repo_url="请输入 GitHub 仓库 URL (https://github.com/用户名/仓库名.git): "
    git remote add origin %repo_url%
    echo ✅ 远程仓库已配置
) else (
    echo ✅ 远程仓库已配置
)

echo.
echo 步骤5: 推送到 GitHub
git branch -M main
git push -u origin main
if %errorlevel% equ 0 (
    echo ✅ 推送成功
) else (
    echo ❌ 推送失败，请检查网络和权限
    pause
    exit /b 1
)

echo.
echo ===================================
echo   ✅ GitHub 发布完成！
echo ===================================
echo.
echo 用户可以通过以下方式安装：
echo.
echo 方式1: GitHub URL
echo   npm install https://github.com/用户名/yijiandaodi-core.git
echo.
echo 方式2: package.json
echo   "yijiandaodi-security-core": "github:用户名/yijiandaodi-core"
echo.
echo 方式3: GitHub Packages (需要配置)
echo   npm install @用户名/yijiandaodi-core
echo.
echo 请将 "用户名" 替换为你的 GitHub 用户名
echo.

pause