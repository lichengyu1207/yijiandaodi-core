@echo off
chcp 65001 >nul
echo ================================
echo 一鉴到底 Logo 动画演示
echo ================================
echo.
echo 请选择要查看的版本：
echo.
echo [1] 极简版（炫酷旋转展开）✨✨推荐
echo [2] 产品发布会级（高端动效）
echo [3] AI Agent安全版
echo [4] 完整版（粒子效果）
echo.
set /p choice="请输入选项 (1/2/3/4): "

if "%choice%"=="1" (
    set "filename=logo-animation-minimal.html"
    echo.
    echo 正在启动极简版动画演示...
) else if "%choice%"=="2" (
    set "filename=logo-animation-premium.html"
    echo.
    echo 正在启动产品发布会级动画演示...
) else if "%choice%"=="3" (
    set "filename=logo-animation-agent.html"
    echo.
    echo 正在启动AI Agent安全版动画演示...
) else if "%choice%"=="4" (
    set "filename=logo-animation-demo.html"
    echo.
    echo 正在启动完整版动画演示...
) else (
    echo.
    echo [提示] 无效选项，将打开极简版...
    set "filename=logo-animation-minimal.html"
)

REM 检查文件是否存在
if not exist "%filename%" (
    echo.
    echo [错误] 找不到动画演示文件：%filename%
    echo 请确保在 animations 目录下运行此脚本。
    pause
    exit /b 1
)

REM 尝试使用默认浏览器打开
echo 正在打开浏览器...
start "" "%filename%"

echo.
echo ================================
echo 演示页面已在浏览器中打开！
echo ================================
echo.
if "%choice%"=="1" (
    echo 动画效果说明：
    echo ✓ 使用抠图Logo（无背景）
    echo ✓ Logo旋转展开动效（Z轴+Y轴）
    echo ✓ 外部旋转光环（3层）
    echo ✓ 爆炸粒子效果
    echo ✓ 缩放入场动画
    echo ✓ 模糊到清晰过渡
    echo ✓ 持续发光效果
    echo ✓ 标题字母间距动画
    echo.
    echo 设计风格：极简炫酷、专注Logo动效
) else if "%choice%"=="2" (
    echo 动画效果说明：
    echo ✓ 使用抠图Logo（无背景）
    echo ✓ 3D Logo旋转入场动画
    echo ✓ Logo持续浮动效果
    echo ✓ 粒子系统（50个粒子）
    echo ✓ 光束效果
    echo ✓ 光环扩散效果
    echo ✓ 标题字母间距动画
    echo ✓ 功能卡片悬停特效
    echo ✓ Agent标签渐变效果
    echo ✓ 进度条流光效果
    echo.
    echo 设计风格：Apple/Google/Cursor发布会级别
) else if "%choice%"=="3" (
    echo 动画效果说明：
    echo ✓ 使用您的Logo图片 yi.jpg
    echo ✓ Logo淡入旋转动画
    echo ✓ 持续呼吸发光效果
    echo ✓ AI Agent安全定位展示
    echo ✓ 四大核心能力：监控/拦截/审计/裁决
    echo ✓ 四大内置Agent：审计官/验证官/存证官/裁决官
    echo.
    echo 平台定位：AI Agent安全检测平台
) else (
    echo 动画效果说明：
    echo 1. Logo淡入旋转动画
    echo 2. 持续呼吸效果
    echo 3. 光晕脉冲效果
    echo 4. 粒子背景动画
    echo 5. 文字滑入动画
    echo.
    echo 控制按钮：
    echo - 点击"重新播放"可重新播放入场动画
    echo - 点击"切换粒子"可显示/隐藏粒子效果
)
echo.
echo 按任意键退出...
pause >nul