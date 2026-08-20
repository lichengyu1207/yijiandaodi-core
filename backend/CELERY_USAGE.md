# Celery异步任务使用指南

## 启动Celery服务

### 1. 安装依赖
```bash
pip install celery django-celery-beat redis
```

### 2. 启动Redis（如果未启动）
```bash
# Windows: 使用WSL或Docker运行Redis
docker run -d -p 6379:6379 redis:alpine

# Linux: 直接启动
redis-server
```

### 3. 启动Celery Worker（处理任务）
```bash
cd backend

# 启动worker处理所有队列
celery -A fangdudu_backend worker -l info

# 或分别启动不同队列的worker
celery -A fangdudu_backend worker -l info -Q trajectory,maintenance,monitoring
```

### 4. 启动Celery Beat（定时任务调度器）
```bash
cd backend

# 启动beat调度器
celery -A fangdudu_backend beat -l info

# 或使用Django数据库调度器（推荐）
celery -A fangdudu_backend beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
```

### 5. 启动Flower（任务监控界面，可选）
```bash
pip install flower
celery -A fangdudu_backend flower --port=5555
```

访问 http://localhost:5555 查看任务状态

---

## Celery Beat定时任务

系统已配置以下定时任务：

| 任务名称 | 执行时间 | 功能 |
|---------|---------|------|
| `archive-old-trajectories-daily` | 每天凌晨2点 | 归档7天前的轨迹 |
| `cleanup-old-activities-weekly` | 每周日凌晨3点 | 清理30天前的活动日志 |
| `check-disk-space-hourly` | 每小时整点 | 检查磁盘空间 |
| `get-table-sizes-daily` | 每天10点 | 获取表数据量统计 |

---

## 任务队列分配

| 队列名称 | 任务类型 | 优先级 |
|---------|---------|--------|
| `trajectory` | 轨迹构建任务 | 高（实时性要求） |
| `maintenance` | 归档和清理任务 | 低（后台执行） |
| `monitoring` | 磁盘空间和统计任务 | 中 |
| `notifications` | 邮件和WebSocket通知 | 高 |

---

## 异步任务调用示例

### 1. 异步构建轨迹（已在信号中自动触发）
```python
from auth_app.tasks import build_trajectory_async

# 通过activity_id异步构建轨迹
result = build_trajectory_async.delay('act_xxx')

# 获取任务状态
task_status = result.status  # PENDING, STARTED, SUCCESS, FAILURE

# 获取任务结果
task_result = result.result
```

### 2. 手动触发归档任务
```python
from auth_app.tasks import archive_old_trajectories_async

# 异步归档7天前的数据
result = archive_old_trajectories_async.delay(days=7)
```

### 3. 手动触发清理任务
```python
from auth_app.tasks import cleanup_old_activities_task

# 异步清理30天前的数据
result = cleanup_old_activities_task.delay(days=30, batch_size=1000)
```

---

## 监控和调试

### 查看活跃任务
```python
from celery.result import AsyncResult
from auth_app.tasks import build_trajectory_async

# 查询任务状态
result = AsyncResult('task-id-here')
print(result.status)
print(result.result)
```

### 查看队列长度
```bash
# 使用redis-cli
redis-cli llen trajectory
redis-cli llen maintenance
```

### 查看Celery日志
```bash
# Worker日志
tail -f /var/log/celery/worker.log

# Beat日志
tail -f /var/log/celery/beat.log
```

---

## 性能优化建议

### 1. Worker并发数
```bash
# 根据CPU核心数调整
celery -A fangdudu_backend worker -l info --concurrency=4
```

### 2. 任务超时配置
已在settings.py中配置：
- 硬超时：30分钟
- 软超时：25分钟

### 3. 内存限制（防止内存泄漏）
```bash
# 每个worker处理1000个任务后重启
celery -A fangdudu_backend worker -l info --max-tasks-per-child=1000
```

---

## 生产环境部署

### 使用Supervisor管理进程
```ini
# /etc/supervisor/conf.d/celery.conf

[program:celery-worker]
command=/path/to/python /path/to/manage.py celery worker -l info
directory=/path/to/backend
user=celery
autostart=true
autorestart=true
stdout_logfile=/var/log/celery/worker.log
stderr_logfile=/var/log/celery/worker_error.log

[program:celery-beat]
command=/path/to/python /path/to/manage.py celery beat -l info
directory=/path/to/backend
user=celery
autostart=true
autorestart=true
stdout_logfile=/var/log/celery/beat.log
stderr_logfile=/var/log/celery/beat_error.log
```

### 使用Systemd管理进程
```ini
# /etc/systemd/system/celery-worker.service

[Unit]
Description=Celery Worker
After=network.target

[Service]
Type=forking
User=celery
Group=celery
WorkingDirectory=/path/to/backend
ExecStart=/path/to/python /path/to/manage.py celery worker -l info
Restart=always

[Install]
WantedBy=multi-user.target
```

---

## 故障排查

### 1. 任务未执行
```bash
# 检查worker是否运行
ps aux | grep celery

# 检查Redis连接
redis-cli ping
```

### 2. 任务失败
查看Celery日志中的错误信息，或使用Flower监控界面。

### 3. 磁盘空间不足
Celery会自动检查磁盘空间并发送告警日志。