# 创建用户分发包

Write-Host "📦 一鉴到底 - 创建分发包" -ForegroundColor Green
Write-Host "=" * 60

# 设置路径
$projectRoot = "c:\MsSafeData\Desktop\yijiandaodi"
$projectDir = "$projectRoot\desktop-client-2.0"
$distDir = "$projectRoot\dist-package"
$zipFile = "$projectRoot\yijiandaodi-desktop-2.0.zip"

# 清理旧的打包目录
if (Test-Path $distDir) {
    Write-Host "🗑️ 清理旧的打包目录..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $distDir
}

if (Test-Path $zipFile) {
    Write-Host "🗑️ 删除旧的压缩包..." -ForegroundColor Yellow
    Remove-Item -Force $zipFile
}

# 创建打包目录
Write-Host "`n📁 创建打包目录..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $distDir | Out-Null

# 复制项目文件（排除不需要的文件）
Write-Host "`n📋 复制项目文件..." -ForegroundColor Cyan

# 需要复制的目录
$includeDirs = @(
    "src",
    "electron",
    "public",
    "docs"
)

# 需要复制的文件
$includeFiles = @(
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "tsconfig.node.json",
    "vite.config.ts",
    "index.html",
    "install.ps1",
    "install.sh",
    "QUICK_START.md",
    "README_FIRST.md",
    "README.md",
    "test-detection.js"
)

# 复制目录
foreach ($dir in $includeDirs) {
    $source = "$projectDir\$dir"
    $dest = "$distDir\desktop-client-2.0\$dir"
    
    if (Test-Path $source) {
        Write-Host "  复制目录: $dir" -ForegroundColor Gray
        Copy-Item -Recurse -Force $source $dest
    }
}

# 复制文件
foreach ($file in $includeFiles) {
    $source = "$projectDir\$file"
    $dest = "$distDir\desktop-client-2.0\$file"
    
    if (Test-Path $source) {
        Write-Host "  复制文件: $file" -ForegroundColor Gray
        Copy-Item -Force $source $dest
    }
}

# 创建 README_FIRST.md 在根目录
Write-Host "`n📝 创建 README_FIRST.md..." -ForegroundColor Cyan
Copy-Item -Force "$projectDir\README_FIRST.md" "$distDir\README_FIRST.md"

# 添加版本信息
Write-Host "`n📝 添加版本信息..." -ForegroundColor Cyan
$versionInfo = @"
# 版本信息

**项目**: 一鉴到底
**版本**: 2.0
**发布日期**: 2026-08-01

## 更新内容

### 新功能
- ✅ 智能检测引擎
- ✅ 桌宠状态提示
- ✅ 审计记录系统
- ✅ 数据导出功能

### 检测能力
- ✅ SQL注入检测
- ✅ XSS攻击检测
- ✅ API Key识别
- ✅ 敏感信息检测
- ✅ 危险代码检测

### 用户体验
- ✅ 静默监控
- ✅ 智能提示
- ✅ 不打扰工作流
"@

Set-Content -Path "$distDir\VERSION.md" -Value $versionInfo -Encoding UTF8

# 计算文件大小
Write-Host "`n📊 计算文件信息..." -ForegroundColor Cyan
$fileCount = (Get-ChildItem -Recurse -File $distDir).Count
$dirSize = (Get-ChildItem -Recurse $distDir | Measure-Object -Property Length -Sum).Sum
$dirSizeMB = [math]::Round($dirSize / 1MB, 2)

Write-Host "  文件数量: $fileCount" -ForegroundColor Gray
Write-Host "  目录大小: $dirSizeMB MB" -ForegroundColor Gray

# 创建压缩包
Write-Host "`n📦 创建压缩包..." -ForegroundColor Cyan
Compress-Archive -Path "$distDir\*" -DestinationPath $zipFile -CompressionLevel Optimal

# 获取压缩包大小
$zipSize = (Get-Item $zipFile).Length / 1MB
$zipSizeMB = [math]::Round($zipSize, 2)

Write-Host "  压缩包大小: $zipSizeMB MB" -ForegroundColor Gray

# 清理临时目录
Write-Host "`n🗑️ 清理临时目录..." -ForegroundColor Yellow
Remove-Item -Recurse -Force $distDir

# 完成
Write-Host "`n" + "=" * 60 -ForegroundColor Green
Write-Host "✅ 分发包创建完成！" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Green

Write-Host "`n📦 输出文件:" -ForegroundColor Cyan
Write-Host "  $zipFile" -ForegroundColor White

Write-Host "`n📊 文件信息:" -ForegroundColor Cyan
Write-Host "  文件数量: $fileCount" -ForegroundColor White
Write-Host "  压缩包大小: $zipSizeMB MB" -ForegroundColor White

Write-Host "`n💡 用户使用步骤:" -ForegroundColor Cyan
Write-Host "  1. 解压 yijiandaodi-desktop-2.0.zip" -ForegroundColor White
Write-Host "  2. 阅读 README_FIRST.md" -ForegroundColor White
Write-Host "  3. 进入 desktop-client-2.0 目录" -ForegroundColor White
Write-Host "  4. 运行 install.ps1 (Windows) 或 install.sh (Mac/Linux)" -ForegroundColor White
Write-Host "  5. 启动应用: npm run electron:dev" -ForegroundColor White

Write-Host "`n✨ 完成！" -ForegroundColor Green