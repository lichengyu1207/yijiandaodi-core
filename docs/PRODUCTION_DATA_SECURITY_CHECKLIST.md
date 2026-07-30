# 生产环境数据安全检查清单

## 一、当前架构确认

### 生产环境架构 ✅

```
生产环境：
客户端 → Django后端 → PostgreSQL独立数据库
                      ↓
                  数据持久化存储

✅ 数据与应用已解耦
✅ 使用专业数据库
✅ 符合生产环境最佳实践
```

### 本地开发架构 ✅

```
开发环境：
开发者 → Django本地 → SQLite轻量级数据库

✅ 快速开发
✅ 无需额外配置
✅ 适合单机开发
```

---

## 二、生产环境安全检查清单

### 1. 数据库连接安全

#### 检查项

```python
# 确认生产环境配置
# settings.py

# ✅ 正确配置
if _db_host and _db_host != 'localhost':
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get('DB_NAME'),
            'USER': os.environ.get('DB_USER'),
            'PASSWORD': os.environ.get('DB_PASSWORD'),
            'HOST': os.environ.get('DB_HOST'),
            'PORT': os.environ.get('DB_PORT', 5432),
        }
    }
```

#### 验证命令

```bash
# 登录生产服务器
ssh user@your-server

# 检查PostgreSQL状态
systemctl status postgresql

# 检查数据库连接
psql -U postgres -d yijiandaodi -c "SELECT version();"

# 检查数据库大小
psql -U postgres -c "SELECT pg_size_pretty(pg_database_size('yijiandaodi'));"
```

---

### 2. 自动备份检查

#### 必备项

```bash
# 1. 检查备份脚本是否存在
ls -la /etc/cron.daily/postgres-backup
ls -la /usr/local/bin/backup-postgres.sh

# 2. 检查定时任务
crontab -l | grep backup
cat /etc/crontab | grep backup

# 3. 检查备份文件
ls -la /var/backups/postgres/
find /var/backups -name "*.sql.gz" -mtime -7
```

#### 备份脚本示例

```bash
#!/bin/bash
# /usr/local/bin/backup-postgres.sh

BACKUP_DIR="/var/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_NAME="yijiandaodi"

# 创建备份
pg_dump -U postgres $DB_NAME | gzip > $BACKUP_DIR/backup_$TIMESTAMP.sql.gz

# 删除7天前的备份
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

# 上传到OSS（可选）
# aws s3 cp $BACKUP_DIR/backup_$TIMESTAMP.sql.gz s3://your-bucket/backups/
```

#### 添加定时任务

```bash
# 编辑crontab
crontab -e

# 每天凌晨2点备份
0 2 * * * /usr/local/bin/backup-postgres.sh
```

---

### 3. 主从复制检查（高可用）

#### 检查主库配置

```bash
# postgresql.conf
listen_addresses = '*'
wal_level = replica
max_wal_senders = 3
wal_keep_segments = 64

# pg_hba.conf
host replication replica <从库IP>/32 trust
```

#### 检查从库状态

```bash
# 在主库执行
psql -U postgres -c "SELECT * FROM pg_stat_replication;"

# 在从库执行
psql -U postgres -c "SELECT pg_is_in_recovery();"
```

---

### 4. 监控告警检查

#### 必备监控项

| 监控项 | 阈值 | 告警方式 |
|--------|------|---------|
| 数据库连接数 | >80% | 邮件+短信 |
| 慢查询 | >1s | 邮件 |
| 磁盘空间 | >80% | 邮件+短信 |
| 主从延迟 | >60s | 邮件 |
| 备份失败 | - | 邮件+短信 |

#### 监控工具

```
推荐：
✅ Prometheus + Grafana（开源）
✅ 阿里云监控（云数据库）
✅ Zabbix（传统监控）
```

---

### 5. 数据库安全检查

#### 访问控制

```bash
# pg_hba.conf 配置
# 只允许应用服务器访问
host yijiandaodi app_user <应用服务器IP>/32 md5

# 禁止远程超级用户登录
local all postgres peer
host all postgres 127.0.0.1/32 md5
```

#### 防火墙配置

```bash
# 只允许应用服务器访问数据库端口
iptables -A INPUT -p tcp -s <应用服务器IP> --dport 5432 -j ACCEPT
iptables -A INPUT -p tcp --dport 5432 -j DROP
```

#### 定期更新密码

```sql
-- 每3个月更新密码
ALTER USER postgres WITH PASSWORD 'new_strong_password';

-- 创建应用专用用户
CREATE USER app_user WITH PASSWORD 'app_password';
GRANT ALL PRIVILEGES ON DATABASE yijiandaodi TO app_user;
```

---

## 三、灾难恢复测试

### 测试步骤

```bash
# 1. 模拟数据丢失
psql -U postgres -d yijiandaodi -c "DROP TABLE test_table;"

# 2. 从备份恢复
gunzip -c /var/backups/postgres/backup_20260712.sql.gz | psql -U postgres -d yijiandaodi

# 3. 验证数据
python manage.py check
python manage.py runserver
# 访问 http://your-domain/admin 验证

# 4. 记录恢复时间
# 目标：<30分钟
```

---

## 四、生产环境优化建议

### 1. 性能优化

```sql
-- 检查慢查询
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- 创建必要索引
CREATE INDEX idx_user_username ON auth_user(username);
CREATE INDEX idx_session_timestamp ON auth_app_extensionsession(timestamp);
```

### 2. 连接池优化

```python
# settings.py
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'CONN_MAX_AGE': 600,  # 连接池
        'OPTIONS': {
            'connect_timeout': 10,
        }
    }
}
```

### 3. 定期维护

```bash
# 每周执行
# 1. 清理旧数据
psql -U postgres -d yijiandaodi -c "VACUUM ANALYZE;"

# 2. 重建索引
psql -U postgres -d yijiandaodi -c "REINDEX DATABASE yijiandaodi;"

# 3. 统计信息更新
psql -U postgres -d yijiandaodi -c "ANALYZE;"
```

---

## 五、成本估算（已优化）

### 当前架构成本

```
生产环境：
- PostgreSQL服务器：已部署
- 数据库维护：已有运维团队
- 备份存储：已配置

本地开发：
- SQLite：免费
- 无额外成本

✅ 架构合理，成本可控
```

---

## 六、检查清单（请逐项确认）

### 数据安全 ✅

- [ ] 生产环境使用PostgreSQL
- [ ] 数据库与应用分离部署
- [ ] 配置了自动备份
- [ ] 备份文件存储到OSS
- [ ] 测试过数据恢复流程

### 高可用 ⚠️

- [ ] 配置了主从复制
- [ ] 实现了自动故障转移
- [ ] 配置了负载均衡

### 监控告警 ✅

- [ ] 监控数据库连接数
- [ ] 监控慢查询
- [ ] 监控磁盘空间
- [ ] 配置了告警通知

### 安全防护 ✅

- [ ] 限制数据库访问IP
- [ ] 定期更新密码
- [ ] 启用SSL连接
- [ ] 审计日志记录

---

## 七、下一步行动

### 立即检查（今天）

```bash
# 1. 登录生产服务器
ssh user@your-server

# 2. 检查数据库状态
systemctl status postgresql

# 3. 检查备份文件
ls -la /var/backups/postgres/
find /var/backups -name "*.sql.gz" -mtime -1

# 4. 测试备份恢复（测试环境）
gunzip -c backup_*.sql.gz | psql -U postgres -d test_restore
```

### 本周完成

```
1. 配置自动备份（如果未配置）
2. 测试数据恢复流程
3. 配置监控告警
4. 优化慢查询
```

### 本月完成

```
1. 配置主从复制（高可用）
2. 定期维护计划
3. 安全审计
```

---

## 八、总结

### 当前架构评估

```
✅ 生产环境：PostgreSQL独立数据库
✅ 本地开发：SQLite轻量级
✅ 数据安全：已解耦
✅ 架构合理：符合最佳实践

风险点：
⚠️ 需确认是否配置自动备份
⚠️ 需确认是否有主从复制
⚠️ 需确认是否有监控告警
```

### 推荐行动

1. **立即检查**：确认备份策略
2. **本周完成**：测试数据恢复
3. **本月完成**：配置主从复制

---

**生产环境架构合理，请按检查清单逐项确认安全性！**