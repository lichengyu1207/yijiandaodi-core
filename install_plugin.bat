@echo off
chcp 65001 >nul
echo.
echo ========================================
echo    一鉴到底 - VS Code 插件安装
echo ========================================
echo.

cd vscode-extension

echo [步骤 1] 安装依赖...
call npm install
if errorlevel 1 (
    echo 依赖安装失败！
    pause
    exit /b 1
)

echo.
echo [步骤 2] 编译 TypeScript...
call npm run compile
if errorlevel 1 (
    echo 编译失败！
    pause
    exit /b 1
)

echo.
echo [步骤 3] 打包为 .vsix...
call npx vsce package
if errorlevel 1 (
    echo 打包失败！
    echo 请确保已安装 vsce: npm install -g @vscode/vsce
    pause
    exit /b 1
)

echo.
echo ========================================
echo    安装完成！
echo ========================================
echo.
echo 插件文件: yijiandaodi-interceptor-1.0.0.vsix
echo.
echo 安装方式:
echo   1. 在 VS Code 中按 Ctrl+Shift+P
echo   2. 输入 "从 VSIX 安装"
echo   3. 选择 .vsix 文件
echo.
echo 或者使用命令行:
echo   code --install-extension yijiandaodi-interceptor-1.0.0.vsix
echo.
pause