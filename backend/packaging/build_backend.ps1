# 一鉴到底 - 后端打包脚本（PyInstaller）
# 用法：powershell -ExecutionPolicy Bypass -File packaging\build_backend.ps1
# 产出：dist\backend\backend.exe（onedir，零 Python 依赖）

$ErrorActionPreference = 'Stop'
$BackendDir = Split-Path -Parent $PSScriptRoot
Set-Location $BackendDir

$Python = Join-Path $BackendDir 'venv\Scripts\python.exe'
if (-not (Test-Path $Python)) {
    Write-Error "未找到 venv Python: $Python"
    exit 1
}

Write-Host "[build] 清理旧产物..."
if (Test-Path 'dist\backend') { Remove-Item -Recurse -Force 'dist\backend' }
if (Test-Path 'build\backend') { Remove-Item -Recurse -Force 'build\backend' }

Write-Host "[build] PyInstaller 构建 Django 后端（数分钟）..."
& $Python -m PyInstaller packaging\backend.spec --noconfirm --clean
if ($LASTEXITCODE -ne 0) {
    Write-Error "[build] Django 后端构建失败"
    exit $LASTEXITCODE
}

Write-Host "[build] PyInstaller 构建沙箱服务..."
& $Python -m PyInstaller packaging\sandbox.spec --noconfirm --clean
if ($LASTEXITCODE -ne 0) {
    Write-Error "[build] 沙箱服务构建失败"
    exit $LASTEXITCODE
}

$Exe = Join-Path $BackendDir 'dist\backend\backend.exe'
$SandboxExe = Join-Path $BackendDir 'dist\sandbox-api\sandbox-api.exe'
if (-not (Test-Path $Exe)) {
    Write-Error "[build] 产物缺失: $Exe"
    exit 1
}
if (-not (Test-Path $SandboxExe)) {
    Write-Error "[build] 产物缺失: $SandboxExe"
    exit 1
}
Write-Host "[build] 完成: $Exe"
Write-Host "[build] 完成: $SandboxExe"
