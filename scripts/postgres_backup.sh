#!/bin/bash
# 生产环境PostgreSQL自动备份脚本
# 每日凌晨2点自动执行

set -e

# ==================== 配置区 ====================
DB_NAME="yijiandaodi"
DB_USER="postgres"
DB_HOST="localhost"
DB_PORT="5432"
BACKUP_DIR="/var/backups/postgres"
LOG_FILE="/var/log/postgres-backup.log"
RETENTION_DAYS=7
OSS_BUCKET="your-oss-bucket"  # 阿里云OSS或AWS S3

# ==================== 函数定义 ====================

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

# ==================== 主流程 ====================

log "========== 开始备份 =========="

# 1. 创建备份目录
mkdir -p $BACKUP_DIR/daily
mkdir -p $BACKUP_DIR/weekly
mkdir -p $BACKUP_DIR/monthly

# 2. 生成备份文件名
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/daily/backup_$TIMESTAMP.sql"

# 3. 执行数据库备份
log "开始备份数据库: $DB_NAME"
if pg_dump -U $DB_USER -h $DB_HOST -p $DB_PORT $DB_NAME > $BACKUP_FILE; then
    log "✓ 数据库备份成功: $BACKUP_FILE"
else
    log "✗ 数据库备份失败"
    exit 1
fi

# 4. 压缩备份文件
log "压缩备份文件..."
gzip $BACKUP_FILE
BACKUP_FILE_GZ="${BACKUP_FILE}.gz"
log "✓ 压缩完成: $BACKUP_FILE_GZ"

# 5. 计算校验和
log "计算校验和..."
CHECKSUM=$(sha256sum $BACKUP_FILE_GZ | awk '{print $1}')
echo "$CHECKSUM  $BACKUP_FILE_GZ" > "${BACKUP_FILE_GZ}.sha256"
log "✓ 校验和: $CHECKSUM"

# 6. 上传到OSS（可选）
if command -v ossutil &> /dev/null; then
    log "上传到OSS..."
    ossutil cp $BACKUP_FILE_GZ oss://$OSS_BUCKET/backups/daily/
    log "✓ OSS上传成功"
fi

# 7. 删除旧备份
log "清理$RETENTION_DAYS天前的旧备份..."
find $BACKUP_DIR/daily -name "*.gz" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR/daily -name "*.sha256" -mtime +$RETENTION_DAYS -delete
log "✓ 清理完成"

# 8. 每周备份（周日）
if [ $(date +%u) -eq 7 ]; then
    log "创建每周备份..."
    cp $BACKUP_FILE_GZ $BACKUP_DIR/weekly/
    log "✓ 每周备份创建成功"
fi

# 9. 每月备份（每月1号）
if [ $(date +%d) -eq 01 ]; then
    log "创建每月备份..."
    cp $BACKUP_FILE_GZ $BACKUP_DIR/monthly/
    log "✓ 每月备份创建成功"
fi

# 10. 记录备份清单
BACKUP_MANIFEST="$BACKUP_DIR/backup_manifest.json"
python3 <<EOF
import json
from datetime import datetime
from pathlib import Path

manifest = {
    "timestamp": "$TIMESTAMP",
    "database": "$DB_NAME",
    "file": "$BACKUP_FILE_GZ",
    "size": Path("$BACKUP_FILE_GZ").stat().st_size,
    "checksum": "$CHECKSUM",
    "type": "daily",
    "status": "success"
}

Path("$BACKUP_MANIFEST").write_text(json.dumps(manifest, indent=2))
EOF

log "✓ 备份清单已更新"

# ==================== 告警通知 ====================

# 检查备份文件大小（小于10MB可能异常）
BACKUP_SIZE=$(stat -c%s $BACKUP_FILE_GZ)
MIN_SIZE=$((10 * 1024 * 1024))  # 10MB

if [ $BACKUP_SIZE -lt $MIN_SIZE ]; then
    log "⚠️ 警告：备份文件过小 ($BACKUP_SIZE bytes)"
    # 发送告警（示例）
    # curl -X POST "https://your-webhook-url" -d "备份文件异常：$BACKUP_FILE_GZ"
fi

log "========== 备份完成 =========="
log ""

exit 0