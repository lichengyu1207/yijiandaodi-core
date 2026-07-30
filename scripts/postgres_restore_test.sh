#!/bin/bash
# 生产环境数据恢复测试脚本
# 每月执行一次，验证备份可用性

set -e

# ==================== 配置区 ====================
DB_NAME="yijiandaodi"
DB_USER="postgres"
DB_HOST="localhost"
DB_PORT="5432"
BACKUP_DIR="/var/backups/postgres"
TEST_DB_NAME="yijiandaodi_restore_test"
LOG_FILE="/var/log/postgres-restore-test.log"

# ==================== 函数定义 ====================

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

error_exit() {
    log "❌ 错误: $1"
    exit 1
}

# ==================== 主流程 ====================

log "========== 开始数据恢复测试 =========="

# 1. 检查备份文件
log "1. 检查备份文件..."
LATEST_BACKUP=$(find $BACKUP_DIR/daily -name "*.sql.gz" -type f | sort -r | head -n 1)

if [ -z "$LATEST_BACKUP" ]; then
    error_exit "未找到备份文件"
fi

log "✓ 找到最新备份: $LATEST_BACKUP"

# 2. 校验备份文件
log "2. 校验备份文件完整性..."
CHECKSUM_FILE="${LATEST_BACKUP}.sha256"

if [ -f $CHECKSUM_FILE ]; then
    if sha256sum -c $CHECKSUM_FILE; then
        log "✓ 校验和验证通过"
    else
        error_exit "校验和验证失败"
    fi
else
    log "⚠️  未找到校验文件，跳过验证"
fi

# 3. 解压备份文件
log "3. 解压备份文件..."
TEMP_SQL="/tmp/restore_test_$(date +%Y%m%d_%H%M%S).sql"
gunzip -c $LATEST_BACKUP > $TEMP_SQL
log "✓ 解压完成: $TEMP_SQL"

# 4. 创建测试数据库
log "4. 创建测试数据库..."
psql -U $DB_USER -h $DB_HOST -p $DB_PORT -c "DROP DATABASE IF EXISTS $TEST_DB_NAME;"
psql -U $DB_USER -h $DB_HOST -p $DB_PORT -c "CREATE DATABASE $TEST_DB_NAME;"
log "✓ 测试数据库创建成功"

# 5. 恢复数据
log "5. 恢复数据到测试数据库..."
START_TIME=$(date +%s)

if psql -U $DB_USER -h $DB_HOST -p $DB_PORT -d $TEST_DB_NAME -f $TEMP_SQL; then
    END_TIME=$(date +%s)
    RESTORE_TIME=$((END_TIME - START_TIME))
    log "✓ 数据恢复成功（耗时: ${RESTORE_TIME}秒）"
else
    error_exit "数据恢复失败"
fi

# 6. 验证数据完整性
log "6. 验证数据完整性..."

# 检查表数量
TABLE_COUNT=$(psql -U $DB_USER -h $DB_HOST -p $DB_PORT -d $TEST_DB_NAME -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
log "✓ 表数量: $TABLE_COUNT"

# 检查用户数量
USER_COUNT=$(psql -U $DB_USER -h $DB_HOST -p $DB_PORT -d $TEST_DB_NAME -t -c "SELECT COUNT(*) FROM auth_user;")
log "✓ 用户数量: $USER_COUNT"

# 检查会话数量
SESSION_COUNT=$(psql -U $DB_USER -h $DB_HOST -p $DB_PORT -d $TEST_DB_NAME -t -c "SELECT COUNT(*) FROM auth_app_extensionsession;")
log "✓ 会话数量: $SESSION_COUNT"

# 检查数据库大小
DB_SIZE=$(psql -U $DB_USER -h $DB_HOST -p $DB_PORT -d $TEST_DB_NAME -t -c "SELECT pg_size_pretty(pg_database_size('$TEST_DB_NAME'));")
log "✓ 数据库大小: $DB_SIZE"

# 7. 运行Django检查（可选）
log "7. 运行Django数据检查..."
# python manage.py check --database=$TEST_DB_NAME

# 8. 清理测试数据
log "8. 清理测试数据..."
psql -U $DB_USER -h $DB_HOST -p $DB_PORT -c "DROP DATABASE $TEST_DB_NAME;"
rm -f $TEMP_SQL
log "✓ 测试数据已清理"

# 9. 生成测试报告
log "9. 生成测试报告..."
REPORT_FILE="$BACKUP_DIR/restore_test_report_$(date +%Y%m%d).json"
python3 <<EOF
import json
from datetime import datetime

report = {
    "test_date": "$(date '+%Y-%m-%d %H:%M:%S')",
    "backup_file": "$LATEST_BACKUP",
    "database": "$TEST_DB_NAME",
    "restore_time_seconds": $RESTORE_TIME,
    "table_count": $TABLE_COUNT,
    "user_count": $USER_COUNT,
    "session_count": $SESSION_COUNT,
    "database_size": "$DB_SIZE",
    "status": "success"
}

with open("$REPORT_FILE", 'w') as f:
    json.dump(report, f, indent=2)
EOF

log "✓ 测试报告已生成: $REPORT_FILE"

# ==================== 告警通知 ====================

# 检查恢复时间（超过5分钟告警）
if [ $RESTORE_TIME -gt 300 ]; then
    log "⚠️ 警告：恢复时间过长（${RESTORE_TIME}秒）"
    # 发送告警
    # curl -X POST "https://your-webhook-url" -d "恢复时间过长：${RESTORE_TIME}秒"
fi

log "========== 数据恢复测试完成 =========="
log ""

exit 0