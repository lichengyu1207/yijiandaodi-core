# 性能日志添加完成总结

## 实施时间
2026-08-10

---

## ✅ 已添加的日志

### 1. ChainIndexCounter日志

**文件**：[memory_models.py:39-81](file:///c:/MsSafeData/Desktop/yijiandaodi/backend/auth_app/memory_models.py#L39-L81)

**日志内容**：
- 开始获取chain_index的时间戳和线程ID
- 成功获取的chain_index值
- 是否是新创建的计数器
- 耗时（毫秒）
- 错误信息和耗时

**日志示例**：
```log
[DEBUG] [ChainIndex] 开始获取chain_index | 线程ID: 12345 | 时间戳: 2026-08-10T06:30:15.123456
[INFO] [ChainIndex] 成功获取chain_index: 42 | 新创建计数器: False | 耗时: 2.34ms | 线程ID: 12345
[ERROR] [ChainIndex] 获取chain_index失败 | 错误: database is locked | 耗时: 150.23ms
```

---

### 2. LongTermMemory创建日志

**文件**：[memory_models.py:345-411](file:///c:/MsSafeData/Desktop/yijiandaodi/backend/auth_app/memory_models.py#L345-L411)

**日志内容**：
- 开始创建长期记忆（Agent ID、操作类型、时间戳）
- chain_index生成成功
- 链式连接成功（prev_hash）
- 成功创建（chain_index、record_hash、总耗时）
- 错误信息和耗时

**日志示例**：
```log
[DEBUG] [LongTermMemory] 开始创建长期记忆 | Agent: agent_001 | 操作类型: api_call | 时间戳: 2026-08-10T06:30:15.123456
[DEBUG] [LongTermMemory] 链式连接成功 | chain_index: 42 | prev_hash: a1b2c3d4e5f6...
[INFO] [LongTermMemory] 成功创建长期记忆 | chain_index: 42 | record_hash: f7e8d9c0b1a2... | Agent: agent_001 | 总耗时: 15.67ms
[ERROR] [LongTermMemory] 创建失败 | Agent: agent_001 | 错误: database is locked | 耗时: 200.45ms
```

---

### 3. 策略缓存日志

**文件**：[memory_views.py:267-330](file:///c:/MsSafeData/Desktop/yijiandaodi/backend/auth_app/memory_views.py#L267-L330)

**日志内容**：
- 缓存命中（策略数量、耗时、缓存时间）
- 缓存未命中（开始查询数据库）
- 数据库查询成功（策略数量、耗时、已缓存）
- 缓存清除（策略ID、操作者、策略名称）

**日志示例**：
```log
[INFO] [策略缓存] 缓存未命中，开始查询数据库 | 时间戳: 2026-08-10T06:30:15.123456
[INFO] [策略缓存] 数据库查询成功 | 策略数量: 10 | 耗时: 25.43ms | 已缓存5分钟
[DEBUG] [策略缓存] 缓存命中 | 策略数量: 10 | 耗时: 0.12ms | 缓存时间: 2026-08-10T06:30:15.123456
[INFO] [策略激活] 策略 rule_001 | 操作者: admin | 策略名称: 敏感文件检测 | 已清除缓存
```

---

## 📊 日志分析价值

### 1. 性能监控

**可以监控的指标**：
- chain_index获取的平均耗时
- 长期记忆创建的总耗时
- 缓存命中率
- 数据库查询耗时

**分析方法**：
```bash
# 查找耗时超过100ms的操作
grep "耗时: [1-9][0-9][0-9]\." logs/performance.log

# 统计平均耗时
grep "\[ChainIndex\] 成功获取" logs/performance.log | \
  awk -F '耗时: ' '{print $2}' | \
  awk -F 'ms' '{sum+=$1; count++} END {print "平均耗时:", sum/count, "ms"}'
```

---

### 2. 并发问题排查

**可以排查的问题**：
- database is locked错误
- chain_index重复
- 事务冲突
- 并发写入失败

**分析方法**：
```bash
# 查找database is locked错误
grep "database is locked" logs/hippocampus.log

# 查找chain_index重复
grep "chain_index:" logs/hippocampus.log | \
  awk -F 'chain_index: ' '{print $2}' | \
  awk '{print $1}' | \
  sort | uniq -c | awk '$1 > 1 {print}'
```

---

### 3. 缓存效果分析

**可以分析的数据**：
- 缓存命中率
- 缓存清除频率
- 数据库查询频率
- 缓存性能提升效果

**分析方法**：
```bash
# 计算缓存命中率
echo "缓存命中率: $(echo "scale=2; $(grep '缓存命中' logs/hippocampus.log | wc -l) * 100 / $(grep '缓存' logs/hippocampus.log | wc -l)" | bc)%"
```

---

## 📁 文件清单

### 修改文件
- [memory_models.py](file:///c:/MsSafeData/Desktop/yijiandaodi/backend/auth_app/memory_models.py) - 添加详细日志
- [memory_views.py](file:///c:/MsSafeData/Desktop/yijiandaodi/backend/auth_app/memory_views.py) - 添加缓存日志

### 新增文件
- [LOGGING_GUIDE.md](file:///c:/MsSafeData/Desktop/yijiandaodi/docs/LOGGING_GUIDE.md) - 日志配置指南

---

## 🎯 使用建议

### 1. 开发环境

**建议日志级别**：DEBUG

**配置方法**：
```python
# settings.py
LOGGING = {
    'loggers': {
        'auth_app.memory_models': {
            'level': 'DEBUG',
        },
        'auth_app.memory_views': {
            'level': 'DEBUG',
        },
    },
}
```

---

### 2. 生产环境

**建议日志级别**：INFO

**配置方法**：
```python
# settings.py
LOGGING = {
    'loggers': {
        'auth_app.memory_models': {
            'level': 'INFO',
        },
        'auth_app.memory_views': {
            'level': 'INFO',
        },
    },
}
```

---

### 3. 问题排查

**建议**：临时调整到DEBUG级别

**配置方法**：
```python
# settings.py
LOGGING = {
    'loggers': {
        'auth_app.memory_models': {
            'level': 'DEBUG',
        },
        'auth_app.memory_views': {
            'level': 'DEBUG',
        },
    },
}
```

**注意**：排查完成后，记得调整回INFO级别

---

## 💡 关键改进

### 1. 完整的耗时监控

- **chain_index获取**：记录原子操作的耗时
- **长期记忆创建**：记录总耗时（包括chain_index、哈希计算、数据库保存）
- **策略缓存**：记录缓存命中/未命中的耗时

---

### 2. 详细的上下文信息

- **Agent ID**：方便追踪特定Agent的操作
- **chain_index**：监控链式存储的完整性
- **线程ID**：排查并发问题
- **时间戳**：精确定位问题发生时间

---

### 3. 错误追踪

- **错误类型**：database is locked、chain_index获取失败等
- **错误上下文**：记录发生错误时的参数和耗时
- **堆栈信息**：自动记录完整的堆栈信息

---

## 📈 性能指标基准

| 操作 | 正常耗时 | 警告阈值 | 错误阈值 |
|------|----------|----------|----------|
| ChainIndex获取 | < 5ms | > 10ms | > 50ms |
| LongTermMemory创建 | < 20ms | > 50ms | > 200ms |
| 策略缓存命中 | < 1ms | > 5ms | > 10ms |
| 策略数据库查询 | < 30ms | > 100ms | > 500ms |

---

## 下一步行动

### ✅ 已完成
1. ChainIndexCounter日志添加
2. LongTermMemory创建日志添加
3. 策略缓存日志添加
4. 日志配置指南编写

### 📋 待完成
1. 配置日志文件轮转（settings.py）
2. 部署日志分析工具（如ELK Stack）
3. 配置日志告警规则
4. 编写日志分析脚本

---

## 总结

通过添加详细的性能日志，现在可以：
1. ✅ **实时监控系统性能**
2. ✅ **快速定位性能瓶颈**
3. ✅ **排查并发写入问题**
4. ✅ **分析缓存效果**

所有关键操作都有详细的日志记录，方便后续排查高频写入时的潜在问题。