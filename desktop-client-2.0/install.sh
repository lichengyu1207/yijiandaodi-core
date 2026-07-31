#!/bin/bash

# 一鉴到底 - 自动安装脚本 (Mac/Linux)

echo "🚀 一鉴到底 - 自动安装脚本"
echo "============================================================"

# 检查 Node.js
echo ""
echo "🔍 检查环境..."
if ! command -v node &> /dev/null; then
    echo "❌ 未找到 Node.js"
    echo "请先安装 Node.js: https://nodejs.org"
    echo "推荐版本: Node.js 18.x 或更高"
    exit 1
fi

NODE_VERSION=$(node --version)
echo "✅ Node.js 版本: $NODE_VERSION"

# 检查 npm
if ! command -v npm &> /dev/null; then
    echo "❌ 未找到 npm"
    exit 1
fi

NPM_VERSION=$(npm --version)
echo "✅ npm 版本: $NPM_VERSION"

# 检查是否在正确的目录
echo ""
echo "🔍 检查项目目录..."
if [ ! -f "package.json" ]; then
    echo "❌ 未找到 package.json"
    echo "请在 desktop-client-2.0 目录下运行此脚本"
    exit 1
fi

echo "✅ 找到项目文件"

# 安装依赖
echo ""
echo "📦 安装项目依赖..."
echo "这可能需要几分钟时间..."

npm install

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ 依赖安装失败"
    echo "请尝试:"
    echo "  1. 删除 node_modules 目录"
    echo "  2. 删除 package-lock.json 文件"
    echo "  3. 重新运行此脚本"
    exit 1
fi

echo "✅ 依赖安装完成"

# 构建项目
echo ""
echo "🔨 构建项目..."

npm run build

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ 项目构建失败"
    echo "请检查错误信息并修复"
    exit 1
fi

echo "✅ 项目构建完成"

# 安装成功
echo ""
echo "============================================================"
echo "🎉 安装成功！"
echo "============================================================"

echo ""
echo "💡 下一步:"
echo "  启动开发模式: npm run electron:dev"
echo "  打包Mac版: npm run electron:build:mac"
echo "  打包Linux版: npm run electron:build:linux"

echo ""
echo "📚 文档:"
echo "  快速开始: QUICK_START.md"
echo "  测试指南: docs/TEST_PLAN.md"
echo "  用户手册: docs/AUTO_DETECTOR_GUIDE.md"

echo ""
echo "✨ 准备就绪，开始使用吧！"