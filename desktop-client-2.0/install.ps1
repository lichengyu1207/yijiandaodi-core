# 一鉴到底 - 自动安装脚本 (Windows)

Write-Host "🚀 一鉴到底 - 自动安装脚本" -ForegroundColor Green
Write-Host "=" * 60

# 检查 Node.js
Write-Host "`n🔍 检查环境..." -ForegroundColor Cyan
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ 未找到 Node.js" -ForegroundColor Red
    Write-Host "请先安装 Node.js: https://nodejs.org" -ForegroundColor Yellow
    Write-Host "推荐版本: Node.js 18.x 或更高" -ForegroundColor Yellow
    exit 1
}

$nodeVersion = node --version
Write-Host "✅ Node.js 版本: $nodeVersion" -ForegroundColor Green

# 检查 npm
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "❌ 未找到 npm" -ForegroundColor Red
    exit 1
}

$npmVersion = npm --version
Write-Host "✅ npm 版本: $npmVersion" -ForegroundColor Green

# 检查是否在正确的目录
Write-Host "`n🔍 检查项目目录..." -ForegroundColor Cyan
if (-not (Test-Path "package.json")) {
    Write-Host "❌ 未找到 package.json" -ForegroundColor Red
    Write-Host "请在 desktop-client-2.0 目录下运行此脚本" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ 找到项目文件" -ForegroundColor Green

# 安装依赖
Write-Host "`n📦 安装项目依赖..." -ForegroundColor Cyan
Write-Host "这可能需要几分钟时间..." -ForegroundColor Gray

npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ 依赖安装失败" -ForegroundColor Red
    Write-Host "请尝试:" -ForegroundColor Yellow
    Write-Host "  1. 删除 node_modules 目录" -ForegroundColor White
    Write-Host "  2. 删除 package-lock.json 文件" -ForegroundColor White
    Write-Host "  3. 重新运行此脚本" -ForegroundColor White
    exit 1
}

Write-Host "✅ 依赖安装完成" -ForegroundColor Green

# 构建项目
Write-Host "`n🔨 构建项目..." -ForegroundColor Cyan

npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ 项目构建失败" -ForegroundColor Red
    Write-Host "请检查错误信息并修复" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ 项目构建完成" -ForegroundColor Green

# 安装成功
Write-Host "`n" + "=" * 60 -ForegroundColor Green
Write-Host "🎉 安装成功！" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Green

Write-Host "`n💡 下一步:" -ForegroundColor Cyan
Write-Host "  启动开发模式: npm run electron:dev" -ForegroundColor White
Write-Host "  打包Windows版: npm run electron:build:win" -ForegroundColor White
Write-Host "  打包Mac版: npm run electron:build:mac" -ForegroundColor White
Write-Host "  打包Linux版: npm run electron:build:linux" -ForegroundColor White

Write-Host "`n📚 文档:" -ForegroundColor Cyan
Write-Host "  快速开始: QUICK_START.md" -ForegroundColor White
Write-Host "  测试指南: docs/TEST_PLAN.md" -ForegroundColor White
Write-Host "  用户手册: docs/AUTO_DETECTOR_GUIDE.md" -ForegroundColor White

Write-Host "`n✨ 准备就绪，开始使用吧！" -ForegroundColor Green