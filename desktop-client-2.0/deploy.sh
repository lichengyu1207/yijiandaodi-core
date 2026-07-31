#!/bin/bash

# 一鉴到底 Skill API 生产环境部署脚本

set -e

echo "🚀 开始部署一鉴到底 Skill API..."
echo ""

# 1. 检查环境
echo "📋 检查环境..."
command -v node >/dev/null 2>&1 || { echo "❌ 需要安装 Node.js"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "⚠️  未检测到 Docker，将使用 PM2 部署"; USE_DOCKER=false; }
USE_DOCKER=${USE_DOCKER:-true}

# 2. 安装依赖
echo ""
echo "📦 安装依赖..."
npm install --production

# 3. 检查配置
echo ""
echo "🔧 检查配置..."
if [ ! -f ".env.production" ]; then
    echo "⚠️  未找到 .env.production，请配置环境变量"
    exit 1
fi

# 4. 创建日志目录
mkdir -p logs

# 5. 部署
echo ""
if [ "$USE_DOCKER" = true ]; then
    echo "🐳 使用 Docker 部署..."
    docker-compose down
    docker-compose build
    docker-compose up -d
    echo "✅ Docker 部署完成"
else
    echo "🚀 使用 PM2 部署..."
    npm install -g pm2
    pm2 delete all
    pm2 start pm2.config.json --env production
    pm2 save
    pm2 startup
    echo "✅ PM2 部署完成"
fi

# 6. 健康检查
echo ""
echo "🏥 健康检查..."
sleep 5
curl -f http://localhost:3000/health || {
    echo "❌ 健康检查失败"
    exit 1
}

echo ""
echo "✅ 部署成功！"
echo ""
echo "📊 服务信息:"
echo "  - API 地址: http://localhost:3000"
echo "  - 健康检查: http://localhost:3000/health"
echo "  - 文档: http://localhost:3000/docs"
echo ""
echo "💡 下一步:"
echo "  1. 配置域名: api.yijiandaodi.com"
echo "  2. 启用 HTTPS (Let's Encrypt)"
echo "  3. 配置监控和告警"
echo "  4. 设置日志收集"
echo ""