# 用户安装指南

**目标用户**: 下载项目压缩包的用户
**核心问题**: 如何处理本地 npm 包依赖

---

## 📦 方案1: 一起打包（推荐）

### 打包结构
```
yijiandaodi-desktop-2.0.zip
├── desktop-client-2.0/          # 主项目
│   ├── package.json
│   ├── src/
│   ├── electron/
│   └── ...
│
└── npm-package/                  # 本地包（一起打包）
    ├── package.json
    ├── src/
    ├── dist/
    └── ...
```

### 用户安装步骤

#### Windows 用户
```powershell
# 1. 解压到任意目录
Expand-Archive yijiandaodi-desktop-2.0.zip

# 2. 进入目录
cd yijiandaodi-desktop-2.0

# 3. 先安装本地包
cd npm-package
npm install
npm run build
cd ..

# 4. 安装主项目依赖
cd desktop-client-2.0
npm install

# 5. 启动应用
npm run electron:dev
```

#### Mac/Linux 用户
```bash
# 1. 解压
unzip yijiandaodi-desktop-2.0.zip

# 2. 进入目录
cd yijiandaodi-desktop-2.0

# 3. 安装本地包
cd npm-package
npm install
npm run build
cd ..

# 4. 安装主项目
cd desktop-client-2.0
npm install

# 5. 启动
npm run electron:dev
```

---

## 📦 方案2: 简化版（无本地包）

### 修改后的 package.json
```json
{
  "dependencies": {
    // 已移除本地包依赖
    "axios": "^1.6.2",
    "date-fns": "^2.30.0",
    // ... 其他依赖
  }
}
```

### 用户安装步骤（更简单）
```powershell
# 1. 解压
Expand-Archive yijiandaodi-desktop-2.0.zip

# 2. 进入项目目录
cd yijiandaodi-desktop-2.0\desktop-client-2.0

# 3. 安装依赖
npm install

# 4. 启动应用
npm run electron:dev
```

---

## 📦 方案3: 发布到 npm（高级）

### 步骤1: 发布本地包到 npm
```powershell
cd npm-package
npm login
npm publish
```

### 步骤2: 修改 package.json
```json
{
  "dependencies": {
    "@lichengyu1207/yijiandaodi-security-core": "^1.0.0",  // 从 npm 安装
    "axios": "^1.6.2",
    // ...
  }
}
```

### 用户安装（最简单）
```powershell
npm install  # 自动从 npm 安装所有依赖
npm run electron:dev
```

---

## 🛠️ 创建自动化安装脚本

### install.ps1（Windows）
```powershell
# 一键安装脚本

Write-Host "🚀 一鉴到底 - 自动安装脚本" -ForegroundColor Green

# 检查 Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ 请先安装 Node.js: https://nodejs.org" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Node.js 版本: $(node --version)"

# 检查是否在项目根目录
if (-not (Test-Path "package.json")) {
    Write-Host "❌ 请在 desktop-client-2.0 目录下运行此脚本" -ForegroundColor Red
    exit 1
}

# 安装依赖
Write-Host "`n📦 安装依赖..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 依赖安装失败" -ForegroundColor Red
    exit 1
}

Write-Host "✅ 依赖安装完成" -ForegroundColor Green

# 构建项目
Write-Host "`n🔨 构建项目..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 构建失败" -ForegroundColor Red
    exit 1
}

Write-Host "✅ 构建完成" -ForegroundColor Green

Write-Host "`n🎉 安装成功！" -ForegroundColor Green
Write-Host "启动命令: npm run electron:dev" -ForegroundColor Cyan
```

### install.sh（Mac/Linux）
```bash
#!/bin/bash

echo "🚀 一鉴到底 - 自动安装脚本"

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 请先安装 Node.js: https://nodejs.org"
    exit 1
fi

echo "✅ Node.js 版本: $(node --version)"

# 检查 package.json
if [ ! -f "package.json" ]; then
    echo "❌ 请在 desktop-client-2.0 目录下运行此脚本"
    exit 1
fi

# 安装依赖
echo ""
echo "📦 安装依赖..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ 依赖安装失败"
    exit 1
fi

echo "✅ 依赖安装完成"

# 构建项目
echo ""
echo "🔨 构建项目..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ 构建失败"
    exit 1
fi

echo "✅ 构建完成"

echo ""
echo "🎉 安装成功！"
echo "启动命令: npm run electron:dev"
```

---

## 📋 用户快速开始指南

创建文件：`QUICK_START.md`

```markdown
# 快速开始

## 前置要求

- Node.js >= 18.0
- npm >= 9.0

## 安装步骤

### Windows 用户
1. 双击运行 `install.ps1`
2. 或手动执行：
   ```powershell
   npm install
   npm run build
   ```

### Mac/Linux 用户
1. 运行安装脚本：
   ```bash
   chmod +x install.sh
   ./install.sh
   ```
2. 或手动执行：
   ```bash
   npm install
   npm run build
   ```

## 启动应用

```bash
npm run electron:dev
```

## 打包应用

```bash
# Windows
npm run electron:build:win

# Mac
npm run electron:build:mac

# Linux
npm run electron:build:linux
```

## 常见问题

### Q: npm install 报错？
A: 请确保 Node.js 版本 >= 18.0

### Q: 缺少依赖？
A: 删除 node_modules 重新安装：
```bash
rm -rf node_modules package-lock.json
npm install
```

### Q: 构建失败？
A: 检查 TypeScript 错误：
```bash
npx tsc --noEmit
```
```

---

## 🎯 推荐方案对比

| 方案 | 优点 | 缺点 | 推荐度 |
|------|------|------|--------|
| 方案1: 一起打包 | 功能完整 | 用户需手动安装本地包 | ⭐⭐⭐ |
| 方案2: 简化版 | 安装简单 | 无（功能已实现） | ⭐⭐⭐⭐⭐ |
| 方案3: 发布npm | 最专业 | 需要 npm 账号 | ⭐⭐⭐⭐ |

---

## 📝 打包建议

### 推荐：方案2（简化版）

**打包内容**：
```
yijiandaodi-desktop-2.0.zip
├── desktop-client-2.0/
│   ├── package.json         # 已移除本地包依赖
│   ├── src/
│   ├── electron/
│   ├── install.ps1          # 自动安装脚本
│   ├── install.sh           # 自动安装脚本
│   ├── QUICK_START.md       # 快速开始指南
│   └── README.md
│
└── README_FIRST.md          # 首先阅读文档
```

**用户只需**：
```powershell
1. 解压
2. 进入 desktop-client-2.0
3. 运行 install.ps1
4. 完成！
```

---

## 🚀 最终建议

### 对用户最友好的方案：

1. **使用方案2（简化版）**
   - 移除本地包依赖 ✅ 已完成
   - 打包时不包含 npm-package 目录
   - 用户安装更简单

2. **提供自动化脚本**
   - `install.ps1` - Windows 一键安装
   - `install.sh` - Mac/Linux 一键安装
   - `QUICK_START.md` - 快速开始指南

3. **清晰的 README**
   - 安装步骤
   - 运行方法
   - 常见问题

---

## ✅ 你已经完成的工作

1. ✅ 移除了本地包依赖
2. ✅ 项目功能完整（不依赖本地包）
3. ✅ 创建了测试方案
4. ✅ 优化了用户体验

---

## 📦 打包命令

### 创建分发包
```powershell
# 假设你在项目根目录
cd c:\MsSafeData\Desktop\yijiandaodi

# 创建分发目录
mkdir dist-package

# 复制必要文件（不包括 npm-package）
Copy-Item -Recurse desktop-client-2.0 dist-package\desktop-client-2.0
Copy-Item QUICK_START.md dist-package\
Copy-Item README_FIRST.md dist-package\

# 打包
Compress-Archive -Path dist-package\* -DestinationPath yijiandaodi-desktop-2.0.zip
```

---

**一句话总结**: **推荐使用简化版（已移除本地包依赖），用户只需解压、安装、运行！**