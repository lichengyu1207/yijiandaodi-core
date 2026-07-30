# 一鉴到底生产环境数据安全配置手册

## 一、自动备份配置

### 1. 部署备份脚本

```bash
# 1. 创建脚本目录
mkdir -p /usr/local/bin
mkdir -p /var/backups/postgres/{daily,weekly,monthly}
mkdir -p /var/log

# 2. 复制脚本
cp scripts/postgres_backup.sh /usr/local/bin/
chmod +x /usr/local/bin/postgres_backup.sh

# 3. 配置环境变量（可选）
export DB_NAME="yijiandaodi"
export DB_USER="postgres"
export BACKUP_DIR="/var/backups/postgres"
```

### 2. 配置定时任务

```bash
# 编辑crontab
crontab -e

# 添加以下内容：
# 每天凌晨2点执行备份
0 2 * * * /usr/local/bin/postgres_backup.sh >> /var/log/cron-backup.log 2>&1

# 每周日凌晨3点执行恢复测试（可选）
0 3 * * 0 /usr/local/bin/postgres_restore_test.sh >> /var/log/cron-restore.log 2>&1
```

### 3. 验证备份

```bash
# 手动执行一次备份
/usr/local/bin/postgres_backup.sh

# 检查备份文件
ls -lh /var/backups/postgres/daily/
cat /var/log/postgres-backup.log

# 检查备份清单
cat /var/backups/postgres/backup_manifest.json
```

---

## 二、数据恢复测试

### 1. 手动恢复测试

```bash
# 1. 执行恢复测试脚本
/usr/local/bin/postgres_restore_test.sh

# 2. 查看测试报告
cat /var/backups/postgres/restore_test_report_*.json

# 3. 检查日志
cat /var/log/postgres-restore-test.log
```

### 2. 灾难恢复流程

```bash
# 1. 停止应用服务
systemctl stop yijiandaodi-backend

# 2. 创建恢复数据库
psql -U postgres -c "CREATE DATABASE yijiandaodi_restore;"

# 3. 恢复数据
LATEST_BACKUP=$(find /var/backups/postgres/daily -name "*.sql.gz" | sort -r | head -n 1)
gunzip -c $LATEST_BACKUP | psql -U postgres -d yijiandaodi_restore

# 4. 切换数据库（谨慎操作）
psql -U postgres -c "ALTER DATABASE yijiandaodi RENAME TO yijiandaodi_old;"
psql -U postgres -c "ALTER DATABASE yijiandaodi_restore RENAME TO yijiandaodi;"

# 5. 验证数据
python manage.py migrate --check
python manage.py runserver

# 6. 启动服务
systemctl start yijiandaodi-backend
```

---

## 三、监控告警配置

### 1. 安装监控组件

```bash
# 1. 安装Prometheus
wget https://github.com/prometheus/prometheus/releases/download/v2.45.0/prometheus-2.45.0.linux-amd64.tar.gz
tar xzf prometheus-*.tar.gz
mv prometheus-*/prometheus /usr/local/bin/

# 2. 安装PostgreSQL Exporter
wget https://github.com/prometheus-community/postgres_exporter/releases/download/v0.14.0/postgres_exporter-0.14.0.linux-amd64.tar.gz
tar xzf postgres_exporter-*.tar.gz
mv postgres_exporter-*/postgres_exporter /usr/local/bin/

# 3. 安装Alertmanager
wget https://github.com/prometheus/alertmanager/releases/download/v0.25.0/alertmanager-0.25.0.linux-amd64.tar.gz
tar xzf alertmanager-*.tar.gz
mv alertmanager-*/alertmanager /usr/local/bin/
```

### 2. 配置PostgreSQL Exporter

```bash
# 1. 创建配置文件
cat > /etc/postgres_exporter.yml <<EOF
auth_modules:
  default:
    type: userpass
    userpass:
      username: postgres
      password: YourPassword
    options:
      sslmode: disable
EOF

# 2. 启动Exporter
DATA_SOURCE_NAME="postgresql://postgres:YourPassword@localhost:5432/yijiandaodi?sslmode=disable"
nohup postgres_exporter --web.listen-address=:9187 &
```

### 3. 配置Prometheus

```bash
# 1. 复制配置文件
mkdir -p /etc/prometheus
cp configs/prometheus.yml /etc/prometheus/
cp configs/alert_rules.yml /etc/prometheus/

# 2. 启动Prometheus
nohup prometheus --config.file=/etc/prometheus/prometheus.yml --storage.tsdb.path=/var/lib/prometheus/ &
```

### 4. 配置Alertmanager

```bash
# 1. 复制配置文件
mkdir -p /etc/alertmanager
cp configs/alertmanager.yml /etc/alertmanager/

# 2. 修改邮箱配置（重要！）
vi /etc/alertmanager/alertmanager.yml
# 修改：
#   smtp_smarthost: 'smtp.qq.com:587'
#   smtp_from: 'your-email@qq.com'
#   smtp_auth_username: 'your-email@qq.com'
#   smtp_auth_password: 'your-smtp-password'

# 3. 启动Alertmanager
nohup alertmanager --config.file=/etc/alertmanager/alertmanager.yml --storage.path=/var/lib/alertmanager/ &
```

### 5. 验证监控

```bash
# 1. 检查服务状态
ps aux | grep -E 'prometheus|postgres_exporter|alertmanager'

# 2. 访问监控面板
# Prometheus: http://localhost:9090
# Alertmanager: http://localhost:9093
# PostgreSQL Exporter: http://localhost:9187/metrics

# 3. 检查告警规则
curl http://localhost:9090/api/v1/rules

# 4. 检查活跃告警
curl http://localhost:9090/api/v1/alerts
```

---

## 四、定期维护计划

### 每日任务

```bash
# 自动执行（已配置crontab）
- 凌晨2点：自动备份
- 凌晨3点：检查备份完整性
```

### 每周任务

```bash
# 手动执行
# 1. 检查备份文件
ls -lh /var/backups/postgres/

# 2. 检查日志
tail -100 /var/log/postgres-backup.log

# 3. 检查监控告警
curl http://localhost:9090/api/v1/alerts

# 4. 数据库维护
psql -U postgres -d yijiandaodi -c "VACUUM ANALYZE;"
```

### 每月任务

```bash
# 手动执行
# 1. 数据恢复测试
/usr/local/bin/postgres_restore_test.sh

# 2. 检查恢复报告
cat /var/backups/postgres/restore_test_report_*.json

# 3. 清理旧备份（保留最近30天）
find /var/backups/postgres/weekly -name "*.gz" -mtime +30 -delete
find /var/backups/postgres/monthly -name "*.gz" -mtime +90 -delete

# 4. 检查磁盘空间
df -h

# 5. 更新告警配置（如有需要）
vi /etc/prometheus/alert_rules.yml
```

---

## 五、故障排查

### 备份失败

```bash
# 检查日志
tail -100 /var/log/postgres-backup.log

# 检查磁盘空间
df -h /var/backups/

# 检查数据库连接
psql -U postgres -c "SELECT 1;"

# 手动执行备份
/usr/local/bin/postgres_backup.sh
```

### 恢复失败

```bash
# 检查备份文件完整性
gunzip -t /var/backups/postgres/daily/backup_*.sql.gz

# 检查数据库权限
psql -U postgres -c "\l"

# 查看恢复日志
tail -100 /var/log/postgres-restore-test.log
```

### 监控无数据

```bash
# 检查Exporter状态
curl http://localhost:9187/metrics

# 检查Prometheus目标
curl http://localhost:9090/api/v1/targets

# 检查网络连通性
telnet localhost 9187
```

---

## 六、配置检查清单

### 备份配置 ✅

- [ ] 备份脚本已部署：`/usr/local/bin/postgres_backup.sh`
- [ ] 定时任务已配置：`crontab -l | grep backup`
- [ ] 备份目录存在：`ls /var/backups/postgres/`
- [ ] 备份文件存在：`ls /var/backups/postgres/daily/`
- [ ] 备份日志正常：`cat /var/log/postgres-backup.log`

### 恢复测试 ✅

- [ ] 恢复脚本已部署：`/usr/local/bin/postgres_restore_test.sh`
- [ ] 测试数据库可创建
- [ ] 数据可恢复
- [ ] 数据完整性验证通过
- [ ] 测试报告已生成

### 监控告警 ✅

- [ ] Prometheus已安装并运行
- [ ] PostgreSQL Exporter已安装并运行
- [ ] Alertmanager已安装并运行
- [ ] 邮箱配置已修改
- [ ] 告警规则已配置
- [ ] 测试告警可触发

---

**配置完成后，请按检查清单逐项验证！**