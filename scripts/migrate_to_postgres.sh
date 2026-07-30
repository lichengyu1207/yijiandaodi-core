#!/bin/bash
# 一键迁移到PostgreSQL脚本

set -e

echo "=========================================="
echo "一鉴到底 - 数据库迁移工具"
echo "从SQLite迁移到PostgreSQL"
echo "=========================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查PostgreSQL是否安装
if ! command -v psql &> /dev/null; then
    echo -e "${RED}错误：PostgreSQL未安装${NC}"
    echo "请先安装PostgreSQL："
    echo "  Windows: https://www.postgresql.org/download/windows/"
    echo "  Linux: sudo apt-get install postgresql"
    echo "  Mac: brew install postgresql"
    exit 1
fi

# 检查Python依赖
if ! python -c "import psycopg2" &> /dev/null; then
    echo -e "${YELLOW}安装psycopg2...${NC}"
    pip install psycopg2-binary
fi

# 备份SQLite数据
echo -e "${GREEN}步骤1：备份SQLite数据${NC}"
BACKUP_FILE="sqlite_backup_$(date +%Y%m%d_%H%M%S).json"
python manage.py dumpdata > $BACKUP_FILE
echo -e "${GREEN}✓ 备份完成：$BACKUP_FILE${NC}"

# 创建PostgreSQL数据库
echo -e "${GREEN}步骤2：创建PostgreSQL数据库${NC}"
read -p "请输入PostgreSQL用户名 [postgres]: " DB_USER
DB_USER=${DB_USER:-postgres}

read -p "请输入PostgreSQL密码: " -s DB_PASSWORD
echo

read -p "请输入数据库名称 [yijiandaodi]: " DB_NAME
DB_NAME=${DB_NAME:-yijiandaodi}

# 创建数据库
psql -U $DB_USER -c "CREATE DATABASE $DB_NAME;" 2>/dev/null || echo "数据库已存在"

# 更新环境变量
echo -e "${GREEN}步骤3：配置环境变量${NC}"
export DB_HOST=localhost
export DB_NAME=$DB_NAME
export DB_USER=$DB_USER
export DB_PASSWORD=$DB_PASSWORD
export DB_PORT=5432

# 迁移数据
echo -e "${GREEN}步骤4：创建PostgreSQL表结构${NC}"
python manage.py migrate

echo -e "${GREEN}步骤5：导入数据${NC}"
python manage.py loaddata $BACKUP_FILE

# 验证数据
echo -e "${GREEN}步骤6：验证数据完整性${NC}"
python manage.py dbshell <<EOF
SELECT '用户数: ' || COUNT(*) FROM auth_user;
SELECT '会话数: ' || COUNT(*) FROM auth_app_extensionsession;
EOF

echo -e "${GREEN}=========================================="
echo "✓ 迁移完成！"
echo "==========================================${NC}"
echo ""
echo "下一步："
echo "1. 更新 .env 文件："
echo "   DB_HOST=localhost"
echo "   DB_NAME=$DB_NAME"
echo "   DB_USER=$DB_USER"
echo "   DB_PASSWORD=$DB_PASSWORD"
echo ""
echo "2. 启动服务："
echo "   python manage.py runserver"
echo ""
echo "3. 访问管理后台验证："
echo "   http://localhost:8000/admin"
echo ""
echo "备份文件位置：$BACKUP_FILE"
echo "请妥善保管备份文件！"