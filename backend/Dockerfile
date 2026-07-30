# ============================================================
# 一鉴到底 - 后端 Dockerfile（生产级多阶段构建）
# 构建: docker build -t yijiandaodi-backend:latest .
# 运行: docker run -p 8000:8000 --env-file .env yijiandaodi-backend
# ============================================================

# ---- 阶段1：构建依赖缓存层 ----
FROM python:3.12-slim AS builder

WORKDIR /build

# 安装编译依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev && \
    rm -rf /var/lib/apt/lists/*

# 先复制依赖文件，利用 Docker 缓存
COPY requirements.txt .

# 安装 Python 依赖到虚拟环境
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ---- 阶段2：生产镜像（最小体积）----
FROM python:3.12-slim AS production

LABEL maintainer="yijiandaodi"
LABEL description="一鉴到底智能内容安全检测平台 - 后端服务"
LABEL version="1.0.0"

# 安装运行时依赖（PostgreSQL 客户端）
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 curl && \
    rm -rf /var/lib/apt/lists/* && \
    useradd --create-home --shell /bin/bash appuser

# 从构建阶段复制虚拟环境
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# 设置工作目录
WORKDIR /app

# 复制项目代码
COPY . .

# 创建必要目录
RUN mkdir -p /app/staticfiles /app/media /app/logs && \
    chown -R appuser:appuser /app

USER appuser

# 暴露端口
EXPOSE 8000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:8000/api/health/ || exit 1

# 启动命令（Gunicorn WSGI 服务器）
CMD ["gunicorn", "fangdudu_backend.wsgi:application", \
     "--bind", "0.0.0.0:8000", \
     "--workers", "2", \
     "--worker-class", "sync", \
     "--threads", "4", \
     "--timeout", "120", \
     "--keep-alive", "5", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]
