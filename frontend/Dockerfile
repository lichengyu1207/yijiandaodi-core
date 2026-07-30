# ============================================================
# 一鉴到底 - 前端 Dockerfile（生产级多阶段构建）
# 构建: docker build -t yijiandaodi-frontend:latest .
# ============================================================

# ---- 阶段1：Node.js 构建前端 ----
FROM node:20-alpine AS builder

WORKDIR /app

# 先复制依赖文件，利用 Docker 缓存
COPY package.json package-lock.json* ./

# 安装依赖（生产依赖 + 开发依赖用于构建）
RUN npm ci --registry=https://registry.npmmirror.com || npm install --registry=https://registry.npmmirror.com

# 复制源码
COPY . .

# 设置生产环境变量
ENV VITE_API_BASE_URL=/api/
ENV NODE_ENV=production

# TypeScript 类型检查 + Vite 构建
RUN npx tsc -b && npx vite build

# ---- 阶段2：Nginx 托管静态文件 ----
FROM nginx:1.25-alpine AS production

LABEL maintainer="yijiandaodi"
LABEL description="一鉴到底 AI Agent行为安全平台 - 前端"
LABEL version="1.0.0"

# 删除默认 Nginx 配置
RUN rm /etc/nginx/conf.d/default.conf

# 复制自定义 Nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 从构建阶段复制产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 暴露端口
EXPOSE 80

# 健康检查
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
