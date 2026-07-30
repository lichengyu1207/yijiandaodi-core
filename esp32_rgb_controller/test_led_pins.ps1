# ESP32-S3 RGB LED 引脚快速测试脚本
# 自动测试常见的LED引脚

$commonPins = @(48, 47, 45, 39, 21, 38, 18, 17, 16, 8, 3, 2)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "ESP32-S3 RGB LED 引脚快速测试" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "即将测试以下常见引脚：" -ForegroundColor Yellow
Write-Host ($commonPins -join ", ")
Write-Host ""
Write-Host "请观察开发板上的RGB LED（大灯）" -ForegroundColor Green
Write-Host "当LED亮起红色时，按Ctrl+C停止" -ForegroundColor Green
Write-Host ""
Write-Host "按任意键开始测试..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

foreach ($pin in $commonPins) {
    Write-Host ""
    Write-Host "----------------------------------------" -ForegroundColor Gray
    Write-Host "测试 GPIO $pin ..." -ForegroundColor Cyan
    
    # 修改代码中的引脚定义
    $codeFile = "src\main.cpp"
    $content = Get-Content $codeFile -Raw
    $content = $content -replace "#define LED_PIN_BUILTIN\s+\d+", "#define LED_PIN_BUILTIN  $pin"
    Set-Content $codeFile $content
    
    # 编译上传
    Write-Host "编译上传..." -ForegroundColor Yellow
    pio run --target upload 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "上传成功！" -ForegroundColor Green
        Write-Host "请观察开发板LED是否亮起红色" -ForegroundColor Yellow
        Write-Host "等待5秒..." -ForegroundColor Gray
        Start-Sleep -Seconds 5
        
        Write-Host "GPIO $pin 测试完成" -ForegroundColor Cyan
        Write-Host "如果LED亮了，这个就是正确的引脚！" -ForegroundColor Green
    } else {
        Write-Host "上传失败！" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "测试完成！" -ForegroundColor Green
Write-Host "请记住LED亮起时显示的GPIO编号" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan