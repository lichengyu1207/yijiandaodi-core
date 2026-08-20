# 海马体记忆系统日志配置指南

## 一、日志配置

### 1.1 Django日志配置（settings.py）

```python
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,

    # 日志格式定义
    'formatters': {
        'verbose': {
            'format': '[{levelname}] {asctime} | {name} | {message}',
            'style': '{',
        },
        'simple': {
            'format': '[{levelname}] {message}',
            'style': '{',
        },
        'performance': {
            'format': '[性能监控] {asctime} | {message}',
            'style': '{',
        },
    },

    # 日志处理器
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        'file': {
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': 'logs/hippocampus.log',
            'maxBytes': 10 * 1024 * 1024,  # 10MB
            'backupCount': 5,
            'formatter': 'verbose',
        },
        'performance_file': {
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': 'logs/performance.log',
            'maxBytes': 10 * 1024 * 1024,  # 10MB
            'backupCount': 5,
            'formatter': 'performance',
        },
    },

    # 日志记录器
    'loggers': {
        # 海马体记忆系统日志
        'auth_app.memory_models': {
            'handlers': ['console', 'file', 'performance_file'],
            'level': 'DEBUG',
            'propagate': False,
        },
        'auth_app.memory_views': {
            'handlers': ['console', 'file', 'performance_file'],
            'level': 'DEBUG',
            'propagate': False,
        },

        # Django默认日志
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': True,
        },
    },
}
```

---

## 二、日志输出示例

### 2.1 ChainIndex获取日志

```log
[DEBUG] 2026-08-10 06:30:15 | auth_app.memory_models | [ChainIndex] 开始获取chain_index | 线程ID: 12345 | 时间戳: 2026-08-10T06:30:15.123456
[INFO] 2026-08-10 06:30:15 | auth_app.memory_models | [ChainIndex] 成功获取chain_index: 42 | 新创建计数器: False | 耗时: 2.34ms | 线程ID: 12345
```

### 2.2 LongTermMemory创建日志

```log
[DEBUG] 2026-08-10 06:30:15 | auth_app.memory_models | [LongTermMemory] 开始创建长期记忆 | Agent: agent_001 | 操作类型: api_call | 时间戳: 2026-08-10T06:30:15.123456
[DEBUG] 2026-08-10 06:30:15 | auth_app.memory_models | [LongTermMemory] 链式连接成功 | chain_index: 42 | prev_hash: a1b2c3d4e5f6...
[INFO] 2026-08-10 06:30:15 | auth_app.memory_models | [LongTermMemory] 成功创建长期记忆 | chain_index: 42 | record_hash: f7e8d9c0b1a2... | Agent: agent_001 | 总耗时: 15.67ms
```

### 2.3 策略缓存日志

```log
[INFO] 2026-08-10 06:30:15 | auth_app.memory_views | [策略缓存] 缓存未命中，开始查询数据库 | 时间戳: 2026-08-10T06:30:15.123456
[INFO] 2026-08-10 06:30:15 | auth_app.memory_views | [策略缓存] 数据库查询成功 | 策略数量: 10 | 耗时: 25.43ms | 已缓存5分钟
[DEBUG] 2026-08-10 06:30:20 | auth_app.memory_views | [策略缓存] 缓存命中 | 策略数量: 10 | 耗时: 0.12ms | 缓存时间: 2026-08-10T06:30:15.123456
```

### 2.4 错误日志

```log
[ERROR] 2026-08-10 06:30:15 | auth_app.memory_models | [ChainIndex] 获取chain_index失败 | 错误: database is locked | 耗时: 150.23ms
[ERROR] 2026-08-10 06:30:15 | auth_app.memory_models | [LongTermMemory] 创建失败 | Agent: agent_001 | 错误: database is locked | 耗时: 200.45ms
```

---

## 三、日志分析方法

### 3.1 性能监控

**查找慢操作**：
```bash
# 查找耗时超过100ms的操作
grep "耗时: [1-9][0-9][0-9]\." logs/performance.log

# 查找耗时超过1秒的操作
grep "耗时: [0-9]\{4,\}\." logs/performance.log
```

**统计平均耗时**：
```bash
# 统计chain_index获取的平均耗时
grep "\[ChainIndex\] 成功获取" logs/performance.log | \
  awk -F '耗时: ' '{print $2}' | \
  awk -F 'ms' '{sum+=$1; count++} END {print "平均耗时:", sum/count, "ms"}'
```

### 3.2 并发问题排查

**查找并发冲突**：
```bash
# 查找database is locked错误
grep "database is locked" logs/hippocampus.log

# 查找同一时间戳的多条日志
grep "2026-08-10 06:30:15" logs/hippocampus.log | grep "ChainIndex"
```

**查找chain_index重复**：
```bash
# 查找重复的chain_index
grep "chain_index:" logs/hippocampus.log | \
  awk -F 'chain_index: ' '{print $2}' | \
  awk '{print $1}' | \
  sort | uniq -c | awk '$1 > 1 {print}'
```

### 3.3 缓存效果分析

**统计缓存命中率**：
```bash
# 统计缓存命中次数
grep "缓存命中" logs/hippocampus.log | wc -l

# 统计缓存未命中次数
grep "缓存未命中" logs/hippocampus.log | wc -l

# 计算缓存命中率
echo "缓存命中率: $(echo "scale=2; $(grep '缓存命中' logs/hippocampus.log | wc -l) * 100 / $(grep '缓存' logs/hippocampus.log | wc -l)" | bc)%"
```

---

## 四、日志级别说明

| 级别 | 用途 | 示例 |
|------|------|------|
| **DEBUG** | 详细调试信息 | 开始获取chain_index、链式连接成功 |
| **INFO** | 重要操作信息 | 成功创建长期记忆、缓存命中/未命中 |
| **WARNING** | 警告信息 | 缓存即将过期、内存使用率高 |
| **ERROR** | 错误信息 | database is locked、chain_index获取失败 |

---

## 五、性能指标

### 5.1 正常性能指标

| 操作 | 正常耗时 | 警告阈值 | 错误阈值 |
|------|----------|----------|----------|
| ChainIndex获取 | < 5ms | > 10ms | > 50ms |
| LongTermMemory创建 | < 20ms | > 50ms | > 200ms |
| 策略缓存命中 | < 1ms | > 5ms | > 10ms |
| 策略数据库查询 | < 30ms | > 100ms | > 500ms |

### 5.2 并发性能指标

| 并发数 | 正常QPS | 警告QPS | 错误QPS |
|--------|---------|---------|---------|
| 单线程 | > 500次/秒 | < 300次/秒 | < 100次/秒 |
| 10线程 | > 500次/秒 | < 300次/秒 | < 100次/秒 |
| 100线程 | > 400次/秒 | < 200次/秒 | < 50次/秒 |

---

## 六、常见问题排查

### 6.1 性能突然下降

**排查步骤**：
1. 检查耗时日志，找出慢操作
2. 检查是否有database is locked错误
3. 检查缓存命中率是否降低
4. 检查数据库索引是否失效

**解决方案**：
- 增加数据库连接池大小
- 优化查询语句
- 增加缓存时间
- 重建索引

### 6.2 chain_index重复

**排查步骤**：
1. 检查是否有并发写入
2. 检查ChainIndexCounter计数器是否正确
3. 检查数据库事务是否正常

**解决方案**：
- 确保事务正确使用
- 检查计数器表的唯一性
- 考虑使用Redis计数器

### 6.3 缓存失效

**排查步骤**：
1. 检查缓存清除日志
2. 检查策略激活/停用日志
3. 检查缓存服务是否正常

**解决方案**：
- 减少缓存清除频率
- 使用更稳定的缓存服务（如Redis）
- 增加缓存预热机制

---

## 七、日志监控工具

### 7.1 实时监控

```bash
# 实时查看性能日志
tail -f logs/performance.log

# 实时查看错误日志
tail -f logs/hippocampus.log | grep ERROR

# 实时监控耗时
tail -f logs/performance.log | grep "耗时"
```

### 7.2 日志分析工具

推荐工具：
- **ELK Stack**：Elasticsearch + Logstash + Kibana
- **Grafana Loki**：轻量级日志聚合
- **Sentry**：错误追踪平台

---

## 八、最佳实践

### 8.1 日志记录原则

1. **关键操作必须记录**：chain_index获取、长期记忆创建、缓存操作
2. **性能数据必须记录**：耗时、并发数、缓存命中率
3. **错误必须详细记录**：错误类型、堆栈信息、上下文数据
4. **避免过度记录**：高频操作使用DEBUG级别

### 8.2 日志格式规范

```
[模块名] 操作描述 | 关键参数1: 值1 | 关键参数2: 值2 | 耗时: XX.XXms
```

### 8.3 日志级别使用

- **DEBUG**：开发环境、排查问题时使用
- **INFO**：生产环境默认级别
- **WARNING**：异常但不需要立即处理的情况
- **ERROR**：需要立即处理的错误

---

## 总结

通过详细的日志记录，可以：
1. **实时监控系统性能**
2. **快速定位性能瓶颈**
3. **排查并发写入问题**
4. **分析缓存效果**

建议在生产环境中配置日志文件轮转和日志分析工具，确保系统稳定运行。