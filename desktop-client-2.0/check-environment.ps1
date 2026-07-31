# 环境检查脚本

Write-Host "🔍 一鉴到底 - 环境检查工具" -ForegroundColor Green
Write-Host "=" * 60

$allChecksPassed = $true

# ============================================================================
# 1. Node.js 检查
# ============================================================================
Write-Host "`n📦 检查 Node.js..." -ForegroundColor Cyan

if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeVersion = node --version
    $nodeVersionNumber = $nodeVersion -replace 'v', ''
    
    Write-Host "  ✅ Node.js 已安装: $nodeVersion" -ForegroundColor Green
    
    # 检查版本是否 >= 18.0
    $majorVersion = $nodeVersionNumber.Split('.')[0]
    if ([int]$majorVersion -ge 18) {
        Write-Host "  ✅ 版本符合要求 (>= 18.0)" -ForegroundColor Green
    } else {
        Write-Host "  ❌ 版本过低，需要 >= 18.0" -ForegroundColor Red
        Write-Host "     下载地址: https://nodejs.org" -ForegroundColor Yellow
        $allChecksPassed = $false
    }
} else {
    Write-Host "  ❌ Node.js 未安装" -ForegroundColor Red
    Write-Host "     下载地址: https://nodejs.org" -ForegroundColor Yellow
    $allChecksPassed = $false
}

# ============================================================================
# 2. npm 检查
# ============================================================================
Write-Host "`n📦 检查 npm..." -ForegroundColor Cyan

if (Get-Command npm -ErrorAction SilentlyContinue) {
    $npmVersion = npm --version
    Write-Host "  ✅ npm 已安装: $npmVersion" -ForegroundColor Green
    
    # 检查版本是否 >= 9.0
    $majorVersion = $npmVersion.Split('.')[0]
    if ([int]$majorVersion -ge 9) {
        Write-Host "  ✅ 版本符合要求 (>= 9.0)" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  版本较低，建议升级到 >= 9.0" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ❌ npm 未安装" -ForegroundColor Red
    $allChecksPassed = $false
}

# ============================================================================
# 3. 项目文件检查
# ============================================================================
Write-Host "`n📁 检查项目文件..." -ForegroundColor Cyan

$requiredFiles = @(
    "package.json",
    "tsconfig.json",
    "vite.config.ts",
    "index.html"
)

foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "  ✅ 找到: $file" -ForegroundColor Green
    } else {
        Write-Host "  ❌ 缺少: $file" -ForegroundColor Red
        $allChecksPassed = $false
    }
}

# ============================================================================
# 4. 源代码目录检查
# ============================================================================
Write-Host "`n📂 检查源代码目录..." -ForegroundColor Cyan

$requiredDirs = @(
    "src",
    "electron",
    "public"
)

foreach ($dir in $requiredDirs) {
    if (Test-Path $dir) {
        Write-Host "  ✅ 找到: $dir" -ForegroundColor Green
    } else {
        Write-Host "  ❌ 缺少: $dir" -ForegroundColor Red
        $allChecksPassed = $false
    }
}

# ============================================================================
# 5. 监控模块检查
# ============================================================================
Write-Host "`n🔍 检查监控模块..." -ForegroundColor Cyan

$monitoringFiles = @(
    "electron\monitoring\autoDetector.ts",
    "electron\monitoring\smartAlerter.ts",
    "electron\monitoring\fileMonitor.ts",
    "electron\monitoring\clipboardMonitor.ts",
    "electron\monitoring\processMonitor.ts",
    "electron\monitoring\networkMonitor.ts",
    "electron\securityKnowledgeBase.ts"
)

foreach ($file in $monitoringFiles) {
    if (Test-Path $file) {
        Write-Host "  ✅ 找到: $file" -ForegroundColor Green
    } else {
        Write-Host "  ❌ 缺少: $file" -ForegroundColor Red
        $allChecksPassed = $false
    }
}

# ============================================================================
# 6. Skill 依赖检查
# ============================================================================
Write-Host "`n🔌 检查 Skill 依赖..." -ForegroundColor Cyan

if (Test-Path "package.json") {
    $packageJson = Get-Content "package.json" | ConvertFrom-Json
    
    # 检查是否有 skill 相关依赖
    $skillDeps = @()
    if ($packageJson.dependencies) {
        $packageJson.dependencies.PSObject.Properties | ForEach-Object {
            if ($_.Name -like "*skill*" -or $_.Name -like "*code-detector*" -or $_.Name -like "*content-moderator*") {
                $skillDeps += $_.Name
            }
        }
    }
    
    if ($skillDeps.Count -eq 0) {
        Write-Host "  ✅ 无外部 Skill 依赖（正确）" -ForegroundColor Green
        Write-Host "     所有功能均为自研实现" -ForegroundColor Gray
    } else {
        Write-Host "  ⚠️  发现外部依赖:" -ForegroundColor Yellow
        $skillDeps | ForEach-Object {
            Write-Host "     - $_" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "  ❌ 未找到 package.json" -ForegroundColor Red
    $allChecksPassed = $false
}

# ============================================================================
# 7. node_modules 检查
# ============================================================================
Write-Host "`n📦 检查依赖安装状态..." -ForegroundColor Cyan

if (Test-Path "node_modules") {
    Write-Host "  ✅ node_modules 已存在" -ForegroundColor Green
    
    # 检查关键依赖
    $criticalDeps = @("electron", "react", "typescript")
    $depsOk = $true
    
    foreach ($dep in $criticalDeps) {
        if (Test-Path "node_modules\$dep") {
            Write-Host "  ✅ $dep 已安装" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  $dep 未安装" -ForegroundColor Yellow
            $depsOk = $false
        }
    }
    
    if (-not $depsOk) {
        Write-Host "`n  💡 运行 'npm install' 安装依赖" -ForegroundColor Cyan
    }
} else {
    Write-Host "  ⚠️  node_modules 不存在" -ForegroundColor Yellow
    Write-Host "     需要运行: npm install" -ForegroundColor Gray
}

# ============================================================================
# 8. 构建产物检查
# ============================================================================
Write-Host "`n🔨 检查构建状态..." -ForegroundColor Cyan

if (Test-Path "dist") {
    Write-Host "  ✅ 构建产物已存在" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  尚未构建" -ForegroundColor Yellow
    Write-Host "     需要运行: npm run build" -ForegroundColor Gray
}

# ============================================================================
# 总结
# ============================================================================
Write-Host "`n" + "=" * 60 -ForegroundColor Green

if ($allChecksPassed) {
    Write-Host "✅ 环境检查通过！" -ForegroundColor Green
    Write-Host "`n💡 下一步:" -ForegroundColor Cyan
    
    if (-not (Test-Path "node_modules")) {
        Write-Host "  1. 安装依赖: npm install" -ForegroundColor White
    }
    
    if (-not (Test-Path "dist")) {
        Write-Host "  2. 构建项目: npm run build" -ForegroundColor White
    }
    
    Write-Host "  3. 启动应用: npm run electron:dev" -ForegroundColor White
} else {
    Write-Host "❌ 环境检查未通过" -ForegroundColor Red
    Write-Host "`n请先解决上述问题后再运行应用" -ForegroundColor Yellow
}

Write-Host "`n📚 帮助文档:" -ForegroundColor Cyan
Write-Host "  - README_FIRST.md  - 首先阅读" -ForegroundColor White
Write-Host "  - QUICK_START.md   - 快速开始" -ForegroundColor White
Write-Host "  - docs/            - 详细文档" -ForegroundColor White

Write-Host "`n" + "=" * 60 -ForegroundColor Green