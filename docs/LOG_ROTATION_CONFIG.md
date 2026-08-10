# 日志文件轮转配置说明

## 一、配置概览

### 1.1 日志文件列表

| 日志文件 | 文件大小限制 | 备份文件数量 | 总大小 | 说明 |
|---------|-------------|-------------|--------|------|
| `security_audit.log` | 50MB | 180个 | ~9GB | 安全审计日志（满足6个月留存要求） |
| `hippocampus.log` | 10MB | 10个 | ~100MB | 海马体记忆系统主日志 |
| `performance.log` | 5MB | 20个 | ~100MB | 性能监控日志 |
| `tracing.log` | 10MB | 5个 | ~50MB | 请求追踪日志 |

---

## 二、轮转策略详解

### 2.1 RotatingFileHandler工作原理

**配置示例**：
```python
'hippocampus_file': {
    'level': 'DEBUG',
    'class': 'logging.handlers.RotatingFileHandler',
    'filename': BASE_DIR / 'logs' / 'hippocampus.log',
    'maxBytes': 10 * 1024 * 1024,  # 10MB
    'backupCount': 10,
    'encoding': 'utf-8',
}
```

**轮转过程**：
```
hippocampus.log (当前日志文件，达到10MB时)
    ↓
hippocampus.log.1 (重命名)
    ↓
hippocampus.log.2 (重命名)
    ↓
...
    ↓
hippocampus.log.10 (最旧的备份文件，达到backupCount时删除)
```

**时间线**：
```
时间点1: hippocampus.log 达到10MB
时间点2: hippocampus.log → hippocampus.log.1
时间点3: 创建新的 hippocampus.log
时间点4: hippocampus.log 再次达到10MB
时间点5: hippocampus.log.1 → hippocampus.log.2
时间点6: hippocampus.log → hippocampus.log.1
...
时间点N: 当超过10个备份时，删除最旧的文件
```

---

## 三、详细配置说明

### 3.1 安全审计日志（security_audit.log）

**配置参数**：
```python
'maxBytes': 50 * 1024 * 1024,  # 50MB
'backupCount': 180,  # 180个备份文件
```

**设计理由**：
- **网络安全法第21条**：日志留存不少于6个月
- 180天 × 50MB/天 = 9GB（满足合规要求）
- 50MB文件大小：避免单个文件过大，便于分析

**适用场景**：
- 用户登录/登出
- 权限变更
- 敏感操作
- 安全事件

---

### 3.2 海马体记忆系统日志（hippocampus.log）

**配置参数**：
```python
'maxBytes': 10 * 1024 * 1024,  # 10MB
'backupCount': 10,  # 10个备份文件
```

**设计理由**：
- 10MB文件大小：高频写入场景下的合理大小
- 10个备份文件：总共约100MB，足够追溯历史问题
- 平衡磁盘空间和历史数据需求

**适用场景**：
- ChainIndex获取（并发控制）
- LongTermMemory创建（链式存证）
- 策略缓存命中/未命中
- 性能耗时记录

---

### 3.3 性能监控日志（performance.log）

**配置参数**：
```python
'maxBytes': 5 * 1024 * 1024,  # 5MB
'backupCount': 20,  # 20个备份文件
```

**设计理由**：
- 5MB文件大小：性能日志频率高，小文件便于快速轮转
- 20个备份文件：总共约100MB，足够分析近期性能问题
- 单独文件：便于性能分析工具处理

**适用场景**：
- 操作耗时（chain_index获取、长期记忆创建）
- 缓存命中统计
- 并发写入监控
- 性能异常告警

---

### 3.4 请求追踪日志（tracing.log）

**配置参数**：
```python
'maxBytes': 10 * 1024 * 1024,  # 10MB
'backupCount': 5,  # 5个备份文件
```

**设计理由**：
- 10MB文件大小：中等大小，包含详细的请求信息
- 5个备份文件：总共约50MB，足够短期问题排查

**适用场景**：
- 请求ID追踪
- 跨服务调用链
- 租户隔离验证

---

## 四、磁盘空间规划

### 4.1 总磁盘占用

| 日志类型 | 单个文件 | 备份文件 | 总大小 |
|---------|---------|---------|--------|
| 安全审计日志 | 50MB | 180个 | 9GB |
| 海马体日志 | 10MB | 10个 | 100MB |
| 性能监控日志 | 5MB | 20个 | 100MB |
| 请求追踪日志 | 10MB | 5个 | 50MB |
| **总计** | - | - | **~9.25GB** |

---

### 4.2 磁盘空间建议

**最小配置**：10GB可用磁盘空间
**推荐配置**：20GB可用磁盘空间（预留50%缓冲）

**监控建议**：
```bash
# 监控日志目录大小
du -sh logs/

# 监控单个日志文件
du -sh logs/hippocampus.log*

# 监控磁盘剩余空间
df -h .
```

---

## 五、日志清理策略

### 5.1 自动清理机制

**Django自动清理**：
- RotatingFileHandler自动删除超过backupCount的旧文件
- 无需手动干预

**清理时机**：
- 当日志文件超过maxBytes时触发轮转
- 轮转时自动删除最旧的备份文件

---

### 5.2 手动清理（紧急情况）

**清理命令**：
```bash
# 进入日志目录
cd backend/logs

# 删除超过30天的备份文件
find . -name "*.log.*" -mtime +30 -delete

# 删除所有备份文件（谨慎使用）
rm -f *.log.*

# 清空当前日志文件（谨慎使用）
truncate -s 0 hippocampus.log
```

---

## 六、日志级别动态调整

### 6.1 生产环境配置

**推荐配置**：
```python
'auth_app.memory_models': {
    'level': 'INFO',  # 只记录重要信息
    'propagate': False,
},
'auth_app.memory_views': {
    'level': 'INFO',  # 只记录重要信息
    'propagate': False,
},
```

**日志输出**：
- ✅ INFO级别：成功创建长期记忆、缓存命中、错误
- ❌ DEBUG级别：开始创建、链式连接详情

---

### 6.2 开发环境配置

**推荐配置**：
```python
'auth_app.memory_models': {
    'level': 'DEBUG',  # 记录所有详细信息
    'propagate': False,
},
'auth_app.memory_views': {
    'level': 'DEBUG',  # 记录所有详细信息
    'propagate': False,
},
```

**日志输出**：
- ✅ DEBUG级别：所有详细日志
- ✅ INFO级别：重要操作信息

---

### 6.3 临时调整（问题排查）

**方法1：修改settings.py**
```python
# 临时调整日志级别
'auth_app.memory_models': {
    'level': 'DEBUG',  # 临时开启DEBUG
    ...
},
```

**方法2：运行时动态调整**
```python
import logging
logging.getLogger('auth_app.memory_models').setLevel(logging.DEBUG)
```

**注意**：排查完成后记得调整回INFO级别

---

## 七、监控告警

### 7.1 日志文件大小监控

**监控脚本**：
```bash
#!/bin/bash
# check_log_size.sh

LOG_DIR="logs"
MAX_SIZE_GB=10

# 检查日志目录总大小
total_size=$(du -sg $LOG_DIR | awk '{print $1}')

if [ "$total_size" -gt "$MAX_SIZE_GB" ]; then
    echo "警告：日志目录大小超过 ${MAX_SIZE_GB}GB，当前大小：${total_size}GB"
    # 发送告警通知（如邮件、钉钉、企业微信）
fi
```

**定时任务**：
```bash
# 每小时检查一次
0 * * * * /path/to/check_log_size.sh
```

---

### 7.2 日志错误监控

**监控脚本**：
```bash
#!/bin/bash
# check_log_errors.sh

LOG_FILE="logs/hippocampus.log"

# 检查最近的ERROR日志
error_count=$(grep -c "ERROR" $LOG_FILE)

if [ "$error_count" -gt 10 ]; then
    echo "警告：发现 $error_count 个错误日志"
    # 发送告警通知
fi
```

---

## 八、最佳实践

### 8.1 日志配置原则

1. **按需求配置大小**：
   - 安全审计日志：50MB（满足合规要求）
   - 性能日志：5MB（高频写入，小文件便于轮转）

2. **合理设置备份数量**：
   - 安全审计：180个（6个月留存）
   - 性能日志：20个（短期分析）

3. **分离不同类型的日志**：
   - 主日志：hippocampus.log
   - 性能日志：performance.log（单独文件）

---

### 8.2 磁盘空间管理

1. **预留50%缓冲空间**：
   - 10GB日志数据 → 需要20GB磁盘空间

2. **定期检查日志大小**：
   - 使用监控脚本自动告警

3. **紧急清理策略**：
   - 删除超过30天的备份文件
   - 保留当前日志文件

---

### 8.3 日志分析优化

1. **使用日志分析工具**：
   - ELK Stack（Elasticsearch + Logstash + Kibana）
   - Grafana Loki（轻量级）

2. **日志格式统一**：
   - 使用JSON格式便于解析
   - 包含时间戳、日志级别、模块名

3. **关键指标监控**：
   - 耗时监控（超过100ms自动告警）
   - 错误率监控（错误数量超过阈值自动告警）

---

## 九、故障排查

### 9.1 日志文件不轮转

**可能原因**：
- 权限不足（无法创建新文件）
- 磁盘空间不足
- 进程占用日志文件

**解决方法**：
```bash
# 检查权限
ls -l logs/

# 检查磁盘空间
df -h .

# 检查文件占用
lsof logs/hippocampus.log

# 重新启动应用
python manage.py runserver
```

---

### 9.2 日志文件过大

**可能原因**：
- maxBytes配置过大
- backupCount配置过大
- 日志级别过于详细

**解决方法**：
```python
# 调整日志配置
'maxBytes': 5 * 1024 * 1024,  # 减小到5MB
'backupCount': 5,  # 减少到5个备份
'level': 'INFO',  # 提高日志级别
```

---

## 十、总结

通过合理的日志轮转配置，可以：
1. ✅ **防止日志文件无限增长**
2. ✅ **满足合规要求**（安全审计日志留存6个月）
3. **优化磁盘空间使用**（总共约9.25GB）
4. **便于日志分析和故障排查**

配置文件位置：[settings.py:242-351](file:///c:/MsSafeData/Desktop/yijiandaodi/backend/fangdudu_backend/settings.py#L242-L351)