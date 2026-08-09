# Celery日志轮转配置审计报告

## 📊 审计结果

### ✅ 已配置的日志轮转

#### **Django日志配置 (CELERY_TASK_MONITORING_CONFIG.md)**

```python
'handlers': {
    'celery_file': {
        'level': 'INFO',
        'class': 'logging.handlers.RotatingFileHandler',
        'filename': '/var/log/celery/worker.log',
        'maxBytes': 104857600,  # 100MB ✅
        'backupCount': 10,       # ✅
        'formatter': 'json',
    },
    
    'celery_error_file': {
        'level': 'ERROR',
        'class': 'logging.handlers.RotatingFileHandler',
        'filename': '/var/log/celery/errors.log',
        'maxBytes': 104857600,  # 100MB ✅
        'backupCount': 20,       # ✅
        'formatter': 'json',
    }
}
```

---

## 🔍 磁盘占用分析

### **日志文件配置**

| 日志类型 | 单文件大小 | 备份数量 | 总占用空间 | 状态 |
|---------|-----------|----------|-----------|------|
| worker.log | 100MB | 10个 | **1000MB (1GB)** | ✅ 合理 |
| errors.log | 100MB | 20个 | **2000MB (2GB)** | ⚠️ 偏高 |
| worker_trajectory.log | 未配置 | - | 不可控 | ❌ 需要配置 |
| worker_maintenance.log | 未配置 | - | 不可控 | ❌ 需要配置 |

**总预估最大占用**: **3GB**

---

## ❌ 发现的问题

### **问题1: Supervisor日志未配置轮转**

#### **当前配置（不完整）**
```ini
[program:celery-worker-trajectory]
command=celery -A fangdudu_backend worker -l info -Q trajectory --logfile=/var/log/celery/worker_trajectory.log
stdout_logfile=/var/log/celery/worker_trajectory_stdout.log
stderr_logfile=/var/log/celery/worker_trajectory_stderr.log
```

#### **问题**
- ❌ `--logfile`参数没有限制大小
- ❌ `stdout_logfile`和`stderr_logfile`没有配置轮转
- ❌ 这些日志会无限增长，占用大量磁盘空间

---

### **问题2: 错误日志备份数量过多**

#### **当前配置**
```python
'celery_error_file': {
    'maxBytes': 104857600,  # 100MB
    'backupCount': 20,      # ← 20个备份，占用2GB
}
```

#### **建议**
- 错误日志通常比INFO日志小很多
- 20个备份可能过多
- 建议减少到10个

---

### **问题3: 监控脚本本身未记录日志**

#### **当前状态**
```bash
nohup python monitor_celery_logs.py > /var/log/celery-monitor.log 2>&1 &
```

#### **问题**
- ❌ 监控脚本的输出日志没有轮转配置
- ❌ `celery-monitor.log`会无限增长

---

## ✅ 改进方案

### **方案1: 配置Supervisor日志轮转**

#### **修改后的配置**
```ini
[program:celery-worker-trajectory]
command=celery -A fangdudu_backend worker -l info -Q trajectory
directory=/opt/yijiandaodi/backend
user=celery
numprocs=1
autostart=true
autorestart=true
startsecs=10
stopwaitsecs=600

# 配置日志轮转
stdout_logfile=/var/log/celery/worker_trajectory_stdout.log
stdout_logfile_maxbytes=104857600  # 100MB
stdout_logfile_backups=5            # 保留5个备份

stderr_logfile=/var/log/celery/worker_trajectory_stderr.log
stderr_logfile_maxbytes=52428800   # 50MB
stderr_logfile_backups=5            # 保留5个备份

# 不使用Celery的--logfile参数（改用Supervisor的日志管理）
# 或者使用系统日志轮转工具（logrotate）
```

#### **估算占用**
- stdout: 100MB × 5 = 500MB
- stderr: 50MB × 5 = 250MB
- **总计**: 750MB（每个Worker）

---

### **方案2: 使用logrotate统一管理**

#### **创建logrotate配置文件**
```bash
# /etc/logrotate.d/yijiandaodi-celery

/var/log/celery/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 celery celery
    sharedscripts
    postrotate
        # 重启Celery Worker以释放旧文件句柄
        supervisorctl restart celery-worker-trajectory >/dev/null 2>&1 || true
        supervisorctl restart celery-worker-maintenance >/dev/null 2>&1 || true
    endscript
}

/var/log/celery-monitor.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 celery celery
}
```

#### **优势**
- ✅ 统一管理所有日志文件
- ✅ 自动压缩（节省空间）
- ✅ 精确控制轮转周期（每日）
- ✅ 保留7天（平衡存储和历史需求）

#### **估算占用**
- 原始日志: ~1GB
- 压缩后: ~200MB（gzip压缩率约80%）
- **总占用**: ~700MB（包含7天历史）

---

### **方案3: 调整Django日志配置**

#### **优化后的配置**
```python
LOGGING = {
    'handlers': {
        'celery_file': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': '/var/log/celery/worker.log',
            'maxBytes': 104857600,  # 100MB
            'backupCount': 10,       # 10个备份 = 1GB
            'formatter': 'json',
        },
        
        'celery_error_file': {
            'level': 'ERROR',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': '/var/log/celery/errors.log',
            'maxBytes': 52428800,    # 50MB（错误日志通常更小）
            'backupCount': 10,        # 10个备份 = 500MB
            'formatter': 'json',
        },
        
        # 新增监控脚本日志处理器
        'celery_monitor': {
            'level': 'INFO',
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': '/var/log/celery/monitor.log',
            'maxBytes': 52428800,    # 50MB
            'backupCount': 5,         # 5个备份 = 250MB
            'formatter': 'standard',
        }
    },
    
    'loggers': {
        'celery_monitor': {
            'handlers': ['celery_monitor'],
            'level': 'INFO',
            'propagate': False,
        }
    }
}
```

#### **估算总占用**
- worker.log: 1GB
- errors.log: 500MB
- monitor.log: 250MB
- supervisor_stdout: 750MB
- supervisor_stderr: 250MB
- **总计**: **2.75GB**（相比之前的不可控增长）

---

## 📊 推荐配置方案

### **最佳实践：Supervisor + logrotate组合**

#### **步骤1: 修改Supervisor配置**
```ini
[program:celery-worker-trajectory]
command=celery -A fangdudu_backend worker -l info -Q trajectory
# 移除--logfile参数，让Celery输出到stdout/stderr

stdout_logfile=/var/log/celery/worker_trajectory_stdout.log
stdout_logfile_maxbytes=104857600  # 100MB
stdout_logfile_backups=5

stderr_logfile=/var/log/celery/worker_trajectory_stderr.log
stderr_logfile_maxbytes=52428800   # 50MB
stderr_logfile_backups=5
```

#### **步骤2: 创建logrotate配置**
```bash
# /etc/logrotate.d/yijiandaodi-celery

/var/log/celery/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 0644 celery celery
}
```

#### **步骤3: 测试配置**
```bash
# 测试logrotate配置
logrotate -d /etc/logrotate.d/yijiandaodi-celery

# 手动触发轮转
logrotate -f /etc/logrotate.d/yijiandaodi-celery

# 查看日志文件大小
du -sh /var/log/celery/
```

---

## 🎯 磁盘空间监控

### **添加磁盘空间检查脚本**

```python
#!/usr/bin/env python3
"""
日志磁盘空间监控脚本
"""

import os
import shutil
from pathlib import Path

def check_log_disk_usage(log_dir='/var/log/celery'):
    """检查日志目录磁盘使用情况"""
    
    total_size = 0
    file_count = 0
    
    log_path = Path(log_dir)
    
    if not log_path.exists():
        print(f"❌ 日志目录不存在: {log_dir}")
        return
    
    print(f"📁 检查目录: {log_dir}")
    print("="*80)
    
    # 统计所有日志文件
    for log_file in log_path.glob('*.log*'):
        if log_file.is_file():
            size = log_file.stat().st_size
            total_size += size
            file_count += 1
            
            # 显示超过10MB的文件
            if size > 10 * 1024 * 1024:
                print(f"⚠️ {log_file.name}: {size / 1024 / 1024:.2f}MB")
    
    # 检查磁盘使用率
    disk_usage = shutil.disk_usage(log_dir)
    used_percent = (disk_usage.used / disk_usage.total) * 100
    
    print("\n" + "="*80)
    print(f"📊 总统计:")
    print(f"  文件数量: {file_count}")
    print(f"  总大小: {total_size / 1024 / 1024:.2f}MB")
    print(f"  磁盘使用率: {used_percent:.1f}%")
    print(f"  剩余空间: {disk_usage.free / 1024 / 1024 / 1024:.2f}GB")
    
    # 告警
    if used_percent > 85:
        print("\n🔴 警告: 磁盘使用率超过85%！")
        print("  建议执行以下操作:")
        print("  1. 清理旧日志: find /var/log/celery -name '*.log.*' -mtime +7 -delete")
        print("  2. 手动触发轮转: logrotate -f /etc/logrotate.d/yijiandaodi-celery")
    
    return {
        'total_size_mb': total_size / 1024 / 1024,
        'file_count': file_count,
        'disk_used_percent': used_percent
    }

if __name__ == '__main__':
    check_log_disk_usage()
```

---

## 📋 部署清单

### **立即可执行的改进**

1. ✅ **修改Supervisor配置**
   ```bash
   vim /etc/supervisor/conf.d/celery-worker.conf
   supervisorctl reread
   supervisorctl update
   ```

2. ✅ **部署logrotate配置**
   ```bash
   sudo cp logrotate.conf /etc/logrotate.d/yijiandaodi-celery
   sudo chmod 644 /etc/logrotate.d/yijiandaodi-celery
   ```

3. ✅ **测试日志轮转**
   ```bash
   logrotate -d /etc/logrotate.d/yijiandaodi-celery
   logrotate -f /etc/logrotate.d/yijiandaodi-celery
   ```

4. ✅ **添加监控脚本**
   ```bash
   python check_log_disk_usage.py
   ```

---

## 🎯 最终建议

### **推荐配置**
- ✅ 使用Supervisor的日志轮转（stdout/stderr）
- ✅ 使用logrotate统一管理所有日志文件
- ✅ 每日轮转，保留7天
- ✅ 启用压缩（节省80%空间）
- ✅ 监控磁盘使用率（告警阈值85%）

### **预期效果**
- **磁盘占用**: 从不可控降至约2.75GB
- **历史保留**: 7天（平衡存储和需求）
- **自动化**: 无需人工干预
- **告警**: 提前预警磁盘空间不足

---

**日志轮转配置已审计，发现3个需要改进的问题，已提供完整解决方案。**