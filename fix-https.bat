@echo off
echo ============================================
echo   一鉴到底 - HTTPS 问题修复工具
echo ============================================
echo.
echo [1/4] 正在检查 Chrome 进程...
tasklist /FI "IMAGENAME eq chrome.exe" 2>NUL | find /I "chrome.exe" >NUL
if %ERRORLEVEL%==0 (
    echo     ⚠️  发现 Chrome 正在运行
    echo.
    echo [2/4] 正在关闭 Chrome（必须完全关闭才能清除缓存）...
    taskkill /F /IM chrome.exe >NUL 2>&1
    timeout /t 2 >NUL
    echo     ✓ Chrome 已关闭
) else (
    echo     ✓ Chrome 未运行
)

echo.
echo [3/4] 正在清除 Chrome HSTS 缓存...
echo.

REM 删除 Chrome 的 HSTS 数据文件
set CHROME_DATA=%LOCALAPPDATA%\Google\Chrome\User Data

if exist "%CHROME_DATA%" (
    for /d %%i in ("%CHROME_DATA%\*") do (
        if exist "%%i\TransportSecurity" (
            echo     发现缓存: %%~nxi
            rd /s /q "%%i\TransportSecurity" 2>NUL
            echo     ✓ 已删除: %%~nxi\TransportSecurity
        )
    )
) else (
    echo     ⚠️  未找到 Chrome 用户数据目录
)

echo.
echo [4/4] 正在重启 Chrome...
start "" "chrome" "http://localhost:3000"
timeout /t 3 >NUL
echo.
echo ============================================
echo   ✅ 修复完成！
echo ============================================
echo.
echo   Chrome 已重新打开，请访问: http://localhost:3000
echo   如果还有问题，请尝试无痕模式 (Ctrl+Shift+N)
echo.
pause
