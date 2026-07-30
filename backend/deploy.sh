#!/bin/bash
# ============================================================
# 一鉴到底 - 全栈一键部署脚本（生产环境）
#
# 用法:
#   chmod +x deploy.sh
#   ./deploy.sh            # 首次部署 / 全量重建
#   ./deploy.sh --update   # 仅更新代码重建镜像（保留数据）
#   ./deploy.sh --down     # 停止所有服务
#   ./deploy.sh --logs     # 查看日志
#
# 前置条件:
#   1. 服务器已安装 Docker + Docker Compose
#   2. backend/.env 已填入真实配置
#   3. frontend/ 与 backend/ 同级目录
# ============================================================

set -e

# ---- 颜色 ----
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${BLUE}[INFO]${NC}  $1"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
fail()  { echo -e "${RED}[FAIL]${NC}  $1"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

MODE="${1:-}"
PROJECT_NAME="yijiandaodi"

echo ""
echo "============================================"
echo "  一鉴到底 - 全栈部署工具 v2.0"
echo "============================================"

# ============================================================
# 工具函数
# ============================================================

check_env() {
    echo ""
    echo "--- 环境检查 ---"

    if ! command -v docker &> /dev/null; then
        fail "Docker 未安装！请执行: curl -fsSL https://get.docker.com | sh"
    fi
    ok "Docker: $(docker --version | awk '{print $3}' | tr -d ',')"

    if ! docker compose version &> /dev/null 2>&1; then
        fail "Docker Compose 未安装！请升级 Docker 到最新版"
    fi
    ok "Docker Compose: 已安装"
}

check_config() {
    echo ""
    echo "--- 配置检查 ---"

    # 优先使用 .env.production（生产配置）
    if [ -f ".env.production" ]; then
        info "检测到 .env.production，使用生产配置..."
        cp .env.production .env
        ok "已从 .env.production 生成 .env"
    elif [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            warn ".env 和 .env.production 都不存在，从模板创建..."
            cp .env.example .env
            warn "请编辑 .env 填入真实密钥和数据库密码后重新运行"
            fail "配置未完成"
        else
            fail ".env / .env.production / .env.example 都不存在！"
        fi
    fi

    # 检查关键配置项
    local ERRORS=0

    if grep -q "your-secret-key-here" .env 2>/dev/null; then
        fail "SECRET_KEY 未修改！请编辑 .env.production"
        ((ERRORS++))
    fi

    if grep -q "your-postgres-password" .env 2>/dev/null; then
        warn "DB_PASSWORD 使用默认值，建议修改"
        ((ERRORS++))
    fi

    if [ "$ERRORS" -gt 0 ]; then
        echo ""
        fail "存在 $ERRORS 个配置问题，请修复后重试"
    fi

    ok "后端配置检查通过"
}

check_frontend() {
    echo ""
    echo "--- 前端目录检查 ---"

    if [ ! -d "../frontend" ]; then
        fail "前端目录不存在！请确保 frontend/ 与 backend/ 同级"
    fi
    ok "前端目录存在"

    local REQUIRED_FILES=("package.json" "Dockerfile" "vite.config.ts" "nginx.conf")
    for f in "${REQUIRED_FILES[@]}"; do
        if [ ! -f "../frontend/$f" ]; then
            fail "缺少 frontend/$f"
        else
            ok "  frontend/$f"
        done
    done
}

prepare_dockerignore() {
    echo ""
    echo "--- 准备构建文件 ---"

    cat > .dockerignore << 'EOF'
__pycache__/
*.pyc
*.pyo
.pytest_cache/
.coverage
htmlcov/
.env
.env.local
.git
.gitignore
*.md
node_modules/
.vscode/
.idea/
db.sqlite3
*.log
media/
staticfiles/
logs/
.DS_Store
Thumbs.db
*.egg-info/
dist/
build/
.cache/
EOF
    ok "backend/.dockerignore 已更新"

    # 前端 .dockerignore
    if [ -d "../frontend" ]; then
        cat > ../frontend/.dockerignore << 'EOF'
node_modules
dist
.git
.gitignore
*.md
.vscode
.idea
.env
.env.local
.DS_Store
.cache
EOF
        ok "frontend/.dockerignore 已更新"
    fi
}

# ============================================================
# Docker 网络环境变量覆盖
# ============================================================
setup_docker_env() {
    echo ""
    echo "--- 配置 Docker 网络环境 ---"

    # 创建 Docker 专用环境覆盖文件
    cat > .env.docker << 'DOCKEREOF'
# ===== Docker Compose 内部网络覆盖 =====
# 此文件中的值会覆盖 .env 中的同名变量
# 仅在 Docker 容器内生效，不影响本地开发

# 数据库：使用 docker-compose 服务名
DB_HOST=db
DB_PORT=5432

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# 生产模式关闭 DEBUG
DEBUG=False

# 允许的主机
ALLOWED_HOSTS=yijiandaodi.com,www.yijiandaodi.com,localhost,127.0.0.1

# CSRF 设置
CSRF_TRUSTED_ORIGINS=https://yijiandaodi.com,http://yijiandaodi.com,https://www.yijiandaodi.com,http://www.yijiandaodi.com
DOCKEREOF

    ok "Docker 网络配置已生成 (.env.docker)"

    # 更新 docker-compose.yml 加载顺序
    info "提示：docker-compose 会依次加载 .env → .env.docker"
}

# ============================================================
# 构建
# ============================================================

do_build() {
    echo ""
    echo "============================================"
    echo "  [5/8] 构建 Docker 镜像"
    echo "============================================"

    info "构建后端镜像..."
    docker compose build backend \
        --no-cache \
        --build-arg BUILDKIT_INLINE_CACHE=1 \
        || fail "后端镜像构建失败"
    ok "后端镜像: yijiandaodi-backend:latest"

    echo ""
    info "构建前端镜像..."
    docker compose build frontend \
        --no-cache \
        || fail "前端镜像构建失败"
    ok "前端镜像: yijiandaodi-frontend:latest"
}

# ============================================================
# 启动服务
# ============================================================

do_up() {
    echo ""
    echo "============================================"
    echo "  [6/8] 启动所有服务"
    echo "============================================"

    # 使用 env_file 合并 .env 和 .env.docker
    docker compose up -d || fail "服务启动失败"

    echo ""
    info "等待数据库就绪..."
    local COUNT=0
    while [ $COUNT -lt 30 ]; do
        if docker compose exec -T db pg_isready -U "${DB_USER:-postgres}" > /dev/null 2>&1; then
            ok "PostgreSQL 已就绪"
            break
        fi
        sleep 2
        ((COUNT++))
    done
    if [ $COUNT -ge 30 ]; then
        warn "数据库启动超时，继续等待..."
    fi

    echo ""
    info "等待 Redis 就绪..."
    COUNT=0
    while [ $COUNT -lt 15 ]; do
        if docker compose exec -T redis redis-cli ping > /dev/null 2>&1; then
            ok "Redis 已就绪"
            break
        fi
        sleep 1
        ((COUNT++))
    done

    echo ""
    info "等待后端服务就绪..."
    COUNT=0
    while [ $COUNT -lt 30 ]; do
        if docker compose exec -T backend curl -sf http://localhost:8000/api/health/ > /dev/null 2>&1; then
            ok "后端 Django 已就绪"
            break
        fi
        sleep 2
        ((COUNT++))
    done
    if [ $COUNT -ge 30 ]; then
        warn "后端启动可能较慢，请查看日志：docker compose logs -f backend"
    fi

    echo ""
    info "等待前端 Nginx 就绪..."
    COUNT=0
    while [ $COUNT -lt 15 ]; do
        if docker compose exec -T frontend wget --spider http://localhost/ > /dev/null 2>&1; then
            ok "前端 Nginx 已就绪"
            break
        fi
        sleep 2
        ((COUNT++))
    done
}

# ============================================================
# 数据初始化
# ============================================================

do_init() {
    echo ""
    echo "============================================"
    echo "  [7/8] 初始化数据"
    echo "============================================"

    info "执行数据库迁移..."
    docker compose exec -T backend python manage.py migrate --noinput \
        && ok "迁移完成" || warn "迁移失败（可能已执行过）"

    echo ""
    info "收集静态文件..."
    docker compose exec -T backend python manage.py collectstatic --noinput --clear \
        && ok "静态文件已收集" || warn "静态文件收集失败（非致命）"

    echo ""
    info "检查超级用户..."
    docker compose exec -T backend python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()
if User.objects.filter(username='admin').exists():
    print('EXISTS')
else:
    print('NOT_EXISTS')
" 2>/dev/null | grep -q "EXISTS" && ok "管理员账户已存在" || {
        warn "未检测到管理员账户"
        echo -e "  ${CYAN}创建命令:${NC}"
        echo "  docker compose exec backend python manage.py createsuperuser"
    }

    echo ""
    info "初始化平台技能数据..."
    docker compose exec -T backend python manage.py shell -c "
from content_app.models import Category
if not Category.objects.exists():
    Category.objects.bulk_create([
        Category(name='安全检测', slug='security', icon='shield'),
        Category(name='内容审核', slug='content', icon='file-search'),
        Category(name='合规分析', slug='compliance', icon='audit'),
    ])
    print('CREATED')
else:
    print('EXISTS')
" 2>/dev/null | grep -q "CREATED" && ok "基础分类数据已创建" || ok "基础数据已存在"
}

# ============================================================
# 结果展示
# ============================================================

do_status() {
    echo ""
    echo "============================================"
    echo -e "${GREEN}[ 部署完成 ]${NC}"
    echo "============================================"
    echo ""

    docker compose ps

    echo ""
    echo -e "${CYAN}  服务地址:${NC}"
    echo "    主页:         http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'localhost')/"
    echo "    API:          http://localhost/api/"
    echo "    Admin:        http://localhost/admin/"
    echo "    健康检查:     http://localhost/api/health/"
    echo ""
    echo -e "${CYAN}  常用命令:${NC}"
    echo "    查看全部日志:   docker compose logs -f --tail=100"
    echo "    查看后端日志:   docker compose logs -f backend --tail=50"
    echo "    查看前端日志:   docker compose logs -f frontend --tail=20"
    echo "    重启后端:       docker compose restart backend"
    echo "    重启前端:       docker compose restart frontend"
    echo "    进入后端容器:   docker compose exec backend bash"
    echo "    进入数据库:     docker compose exec db psql -U postgres -d fangdudu_main"
    echo "    执行迁移:       docker compose exec backend python manage.py migrate"
    echo "    收集静态文件:   docker compose exec backend python manage.py collectstatic --noinput"
    echo "    停止全部:       docker compose down"
    echo "    完全清除:       docker compose down -v （警告：删除所有数据！）"
    echo ""
    echo -e "${YELLOW}  注意事项:${NC}"
    echo "    1. 首次访问请通过 /admin/ 创建管理员账号"
    echo "    2. 生产环境请确保 .env 中 SECRET_KEY 为强随机值"
    echo "    3. 启用 HTTPS 需配置 SSL 证书"
    echo "    4. 支付宝回调地址需公网可达"
    echo ""
}

# ============================================================
# 主流程
# ============================================================

case "$MODE" in
    --down)
        info "停止所有服务..."
        docker compose down
        ok "服务已停止"
        ;;
    --logs)
        docker compose logs -f --tail=100
        ;;
    --update)
        check_env
        prepare_dockerignore
        info "仅更新代码并重建镜像（保留数据库数据）..."
        do_build
        docker compose up -d --no-deps frontend backend
        ok "更新完成！前端和后端已重启"
        ;;
    "")
        # 完整部署流程
        check_env
        check_config
        check_frontend
        prepare_dockerignore
        setup_docker_env
        do_build
        do_up
        do_init
        do_status
        ;;
    *)
        echo "用法:"
        echo "  ./deploy.sh           首次部署 / 全量重建"
        echo "  ./deploy.sh --update  仅更新代码重建（保留数据）"
        echo "  ./deploy.sh --down    停止服务"
        echo "  ./deploy.sh --logs    查看日志"
        exit 1
        ;;
esac
