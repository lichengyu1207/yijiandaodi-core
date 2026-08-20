# 自监控系统生产环境部署指南

## 📋 概述

本指南详细说明如何将自监控系统的日志配置集成到生产环境的 Celery 定时任务中，确保系统稳定运行并方便问题排查。

## 🎯 已完成的配置

### 1. **日志配置**（settings.py）

#### 新增的日志处理器

| 处理器名称 | 文件路径 | 大小限制 | 备份数量 | 用途 |
|-----------|---------|---------|---------|------|
| `self_audit_file` | logs/self_audit.log | 20MB | 30个（约600MB） | 自监控系统主日志 |
| `self_audit_console` | 控制台 | - | - | 自监控控制台输出 |
| `celery_file` | logs/celery.log | 20MB | 10个（约200MB） | Celery 任务日志 |

#### 新增的日志记录器

| 记录器名称 | 处理器 | 日志级别 | 说明 |
|-----------|--------|---------|------|
| `auth_app.self_audit_service` | self_audit_file + self_audit_console + performance_file | INFO | 自监控服务主日志 |
| `auth_app.self_audit_models` | self_audit_file + self_audit_console | WARNING | 自监控数据模型日志 |
| `celery` | celery_file | INFO | Celery 核心日志 |
| `celery.app` | celery_file | INFO | Celery 应用日志 |
| `celery.worker` | celery_file | INFO | Celery Worker 日志 |
| `celery.beat` | celery_file + self_audit_file | INFO | Celery Beat 定时任务日志 |

### 2. **Celery 定时任务配置**

已配置的自监控定时任务：

| 任务名称 | 执行频率 | 队列 | 说明 |
|---------|---------|------|------|
| `check_accuracy_drift_periodic` | 每15分钟 | monitoring | 准确率漂移检测 |
| `check_response_time_periodic` | 每15分钟 | monitoring | 响应时间异常检测 |
| `check_false_positive_rate_periodic` | 每小时 | monitoring | 误报率检测 |
| `audit_permission_usage_periodic` | 每小时 | security | 权限使用审计 |
| `check_rule_freshness_periodic` | 每天 2:00 | monitoring | 规则库时效性检测 |
| `run_all_checks_periodic` | 每小时 | monitoring | 综合自检 |
| `generate_hourly_report` | 每小时 | reporting | 小时报告生成 |
| `generate_daily_report` | 每天 3:00 | reporting | 日报生成 |
| `generate_weekly_report` | 每周一 4:00 | reporting | 周报生成 |
| `generate_monthly_report` | 每月1日 5:00 | reporting | 月报生成 |

## 🚀 生产环境部署步骤

### 步骤 1: 安装依赖

```bash
cd c:\MsSafeData\Desktop\yijiandaodi\backend
pip install celery redis django-celery-beat flower
```

### 步骤 2: 创建日志目录

```bash
mkdir logs
```

### 步骤 3: 数据库迁移（如需要）

```bash
python manage.py migrate
```

### 步骤 4: 初始化 Celery Beat 数据库调度器

```bash
python manage.py migrate django_celery_beat
```

### 步骤 5: 启动 Redis 服务

确保 Redis 服务正在运行：
```bash
redis-cli ping
# 应返回: PONG
```

### 步骤 6: 启动 Celery 服务

#### 方法1：一键启动所有服务（推荐）

```bash
# 双击运行
start_all_celery.bat
```

这会自动启动：
- Celery Worker（后台运行）
- Celery Beat（后台运行）
- Flower 监控面板（http://localhost:5555）

#### 方法2：分别启动各个服务

```bash
# 1. 启动 Worker
start_celery_worker.bat

# 2. 启动 Beat（新窗口）
start_celery_beat.bat

# 3. 启动 Flower 监控（可选）
start_flower.bat
```

### 步骤 7: 验证服务运行状态

#### 检查日志文件

```bash
# Worker 日志
tail -f logs/celery_worker.log

# Beat 日志
tail -f logs/celery_beat.log

# 自监控日志
tail -f logs/self_audit.log

# 性能监控日志
tail -f logs/performance.log
```

#### 访问 Flower 监控面板

打开浏览器访问：http://localhost:5555

可以看到：
- Worker 状态
- 任务执行情况
- 定时任务列表
- 实时监控数据

#### 检查数据库中的定时任务

```bash
python manage.py shell

from django_celery_beat.models import PeriodicTask
PeriodicTask.objects.all().count()  # 应该有11个任务
```

## 🔍 日志文件说明

### 日志文件路径

```
c:\MsSafeData\Desktop\yijiandaodi\backend\logs\
├── celery_worker.log          # Celery Worker 日志
├── celery_beat.log            # Celery Beat 日志
├── self_audit.log             # 自监控系统主日志 ⭐
├── performance.log            # 性能监控日志
├── hippocampus.log            # 海马体记忆系统日志
├── security_audit.log         # 安全审计日志
└── tracing.log                # 追踪日志
```

### 日志轮转策略

| 日志文件 | 单文件大小 | 备份数量 | 总容量 | 轮转周期 |
|---------|-----------|---------|--------|---------|
| self_audit.log | 20MB | 30个 | 600MB | 约1个月 |
| celery_worker.log | 20MB | 10个 | 200MB | 约10天 |
| celery_beat.log | 20MB | 10个 | 200MB | 约10天 |
| performance.log | 5MB | 20个 | 100MB | 约20天 |

### 日志格式示例

```log
[INFO] 2026-08-11 10:15:30 | auth_app.self_audit_service | [Self-Audit] ========== 开始运行所有自监控检查 ==========
[INFO] 2026-08-11 10:15:30 | auth_app.self_audit_service | [Self-Audit] ----- 高优先级检查（1/2）: 准确率漂移检测 -----
[INFO] 2026-08-11 10:15:31 | auth_app.self_audit_service | [Self-Audit] 步骤1: 查询短期记忆数据...
[INFO] 2026-08-11 10:15:31 | auth_app.self_audit_service | [Self-Audit] 查询完成，返回 2 条聚合记录
[INFO] 2026-08-11 10:15:31 | auth_app.self_audit_service | [Self-Audit] ========== 自监控检查汇总 ==========
[INFO] 2026-08-11 10:15:31 | auth_app.self_audit_service | [Self-Audit] 总耗时: 125.15ms
```

## 📊 监控与告警

### Flower 监控面板

访问地址：http://localhost:5555

功能：
- 实时监控 Worker 状态
- 查看任务执行历史
- 监控定时任务执行情况
- 查看任务失败详情

### 关键指标监控

#### 1. 准确率漂移监控
- 日志文件：`self_audit.log`
- 关键词：`准确率漂移`
- 告警条件：偏离率 > 10%

#### 2. 响应时间异常监控
- 日志文件：`self_audit.log`
- 关键词：`响应时间异常`
- 告警条件：P99 > 2000ms

#### 3. 权限审计监控
- 日志文件：`self_audit.log`
- 关键词：`权限异常`
- 告警条件：高风险权限变更

#### 4. 规则时效性监控
- 日志文件：`self_audit.log`
- 关键词：`陈旧规则`
- 告警条件：超过90天未更新

### 告警通知（可选）

#### 邮件告警配置

```python
# settings.py
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.example.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = 'alerts@example.com'
EMAIL_HOST_PASSWORD = 'password'
ADMINS = [
    ('Admin', 'admin@example.com'),
]
```

#### Slack/钉钉告警

可以使用 Webhook 集成第三方告警系统。

## 🔧 常见问题排查

### 问题1：Celery Worker 无法启动

**症状**：
```
Error connecting to redis://localhost:6379/0
```

**解决方案**：
1. 检查 Redis 服务是否运行
2. 检查 Redis 连接配置
3. 检查防火墙设置

### 问题2：定时任务未执行

**症状**：
- Flower 中看不到任务执行记录
- 日志文件无更新

**解决方案**：
1. 检查 Celery Beat 是否启动
2. 检查数据库中的定时任务配置
3. 检查系统时区配置

```bash
python manage.py shell

from django_celery_beat.models import PeriodicTask
tasks = PeriodicTask.objects.filter(enabled=True)
for task in tasks:
    print(f"{task.name}: {task.enabled}")
```

### 问题3：日志文件过大

**症状**：
- 磁盘空间不足
- 日志文件超过预期大小

**解决方案**：
1. 检查日志轮转配置
2. 调整日志级别（生产环境使用 INFO）
3. 手动清理旧日志文件

```bash
# 清理7天前的日志备份
Get-ChildItem logs\*.log.* | Where-Object {$_.LastWriteTime -lt (Get-Date).AddDays(-7)} | Remove-Item
```

### 问题4：自监控检测结果异常

**症状**：
- 检测到错误的漂移
- 假阳性告警

**解决方案**：
1. 检查基线数据是否正确
2. 调整检测阈值
3. 查看详细日志分析原因

```bash
# 查看详细检测日志
Get-Content logs\self_audit.log | Select-String "准确率漂移|响应时间异常"
```

## 📈 性能优化建议

### 1. 日志级别优化

**生产环境推荐配置**：
```python
# 自监控服务：INFO 级别
'auth_app.self_audit_service': {
    'level': 'INFO',
}

# 自监控模型：WARNING 级别（减少日志量）
'auth_app.self_audit_models': {
    'level': 'WARNING',
}

# Celery：INFO 级别
'celery': {
    'level': 'INFO',
}
```

**问题排查时临时启用 DEBUG**：
```python
'auth_app.self_audit_service': {
    'level': 'DEBUG',  # 临时启用详细日志
}
```

### 2. 任务队列优化

根据实际负载调整 Celery Worker 数量：
```bash
# 低负载（开发环境）
celery -A fangdudu_backend worker --concurrency=2

# 中负载（测试环境）
celery -A fangdudu_backend worker --concurrency=4

# 高负载（生产环境）
celery -A fangdudu_backend worker --concurrency=8 --max-tasks-per-child=1000
```

### 3. 内存优化

限制单个任务内存使用：
```bash
--max-memory-per-child=300000  # 300MB
```

### 4. 任务路由优化

将不同类型的任务分配到不同队列：
```python
CELERY_TASK_ROUTES = {
    'auth_app.self_audit_tasks.check_accuracy_drift_periodic': {'queue': 'monitoring'},
    'auth_app.self_audit_tasks.check_response_time_periodic': {'queue': 'monitoring'},
    'auth_app.self_audit_tasks.generate_daily_report': {'queue': 'reporting'},
}
```

## 🔒 安全建议

### 1. 日志文件权限

```bash
# 限制日志文件访问权限
icacls logs\self_audit.log /grant "IIS_IUSRS:(OI)(CI)F"
icacls logs\celery.log /grant "IIS_IUSRS:(OI)(CI)F"
```

### 2. 敏感信息过滤

确保日志中不包含敏感信息：
- API 密钥
- 用户密码
- 个人身份信息

### 3. 日志留存合规

根据网络安全法第21条，日志留存不少于6个月：
- `security_audit.log`: 保留180天 ✅
- `self_audit.log`: 保留30天（可根据需要调整）
- `celery.log`: 保留10天（可根据需要调整）

## 📚 相关文档

- [自监控系统数据模型](../backend/auth_app/self_audit_models.py)
- [自监控服务实现](../backend/auth_app/self_audit_service.py)
- [Celery 定时任务配置](../backend/auth_app/self_audit_tasks.py)
- [日志增强报告](./SELF_AUDIT_SERVICE_LOGGING_ENHANCEMENT_REPORT.md)
- [日志验证报告](./SELF_AUDIT_LOGGING_VERIFICATION_REPORT.md)

## 🎉 总结

自监控系统的日志配置已成功集成到生产环境的 Celery 定时任务中。系统将自动执行以下监控：

- ✅ **准确率漂移检测**：每15分钟
- ✅ **响应时间异常检测**：每15分钟
- ✅ **误报率检测**：每小时
- ✅ **权限使用审计**：每小时
- ✅ **规则库时效性检测**：每天
- ✅ **综合报告生成**：小时/日/周/月

所有日志将自动记录到 `logs/self_audit.log`，并按 20MB 大小轮转，保留最近 30 个备份文件（约一个月的日志）。

建议在生产环境部署后，定期检查：
1. Flower 监控面板的运行状态
2. 自监控日志文件的输出内容
3. 关键指标的告警情况
4. 磁盘空间使用情况

祝部署顺利！🚀