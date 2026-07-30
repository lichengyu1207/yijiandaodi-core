@echo off
chcp 65001 >nul
echo ========================================
echo ESP32 LED控制菜单
echo ========================================
echo.
echo 设备IP: 192.168.43.177
echo.

:menu
echo 请选择操作：
echo 1. 红灯
echo 2. 黄灯
echo 3. 绿灯
echo 4. 闪烁模式
echo 5. 彩虹模式
echo 6. 查看状态
echo 7. 退出
echo.

set /p choice="请输入选项 (1-7): "

if "%choice%"=="1" (
    echo 切换到红灯...
    curl -s http://192.168.43.177/status?state=red
    echo.
    pause
    goto menu
)

if "%choice%"=="2" (
    echo 切换到黄灯...
    curl -s http://192.168.43.177/status?state=yellow
    echo.
    pause
    goto menu
)

if "%choice%"=="3" (
    echo 切换到绿灯...
    curl -s http://192.168.43.177/status?state=green
    echo.
    pause
    goto menu
)

if "%choice%"=="4" (
    echo 切换到闪烁模式...
    curl -s http://192.168.43.177/status?state=flash
    echo 观察LED红黄闪烁效果...
    timeout /t 5 >nul
    curl -s http://192.168.43.177/status?state=green
    echo 已恢复绿灯
    pause
    goto menu
)

if "%choice%"=="5" (
    echo 切换到彩虹模式...
    curl -s http://192.168.43.177/status?state=rainbow
    echo 观察LED彩虹效果...
    timeout /t 5 >nul
    curl -s http://192.168.43.177/status?state=green
    echo 已恢复绿灯
    pause
    goto menu
)

if "%choice%"=="6" (
    echo 查看当前状态...
    curl -s http://192.168.43.177/status
    echo.
    pause
    goto menu
)

if "%choice%"=="7" (
    echo 退出
    exit
)

echo 无效选项
pause
goto menu