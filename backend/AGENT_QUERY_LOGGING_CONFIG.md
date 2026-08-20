# Agent查询日志性能优化配置指南

## 概述

为了平衡性能监控需求和系统性能，Agent查询日志实现了智能过滤机制：
- **开发环境**：默认记录所有查询
- **生产环境**：只记录慢查询和错误

## 配置方式

### 1. Django settings.py配置

已自动配置，根据DEBUG设置自动调整日志级别：

```python
# 开发环境 (DEBUG=True)
'auth_app.agent_identity_models': {
    'level': 'DEBUG',  # 记录所有日志
}

# 生产环境 (DEBUG=False)
'auth_app.agent_identity_models': {
    'level': 'WARNING',  # 只记录警告和错误
}
```

### 2. 环境变量配置

#### 2.1 启用详细日志模式

生产环境需要调试时，可以临时启用：

```bash
# 启用详细日志（记录所有查询）
export AGENT_ENABLE_DETAILED_LOGS=true

# 或在 .env 文件中
AGENT_ENABLE_DETAILED_LOGS=true
```

#### 2.2 调整性能阈值

控制慢查询判定标准（默认50ms）：

```bash
# 只记录超过100ms的查询
export AGENT_QUERY_LOG_THRESHOLD_MS=100

# 或在 .env 文件中
AGENT_QUERY_LOG_THRESHOLD_MS=100
```

## 日志过滤规则

查询日志仅在以下情况记录：

### ✅ 会记录日志的情况

1. **启用详细日志模式** (`AGENT_ENABLE_DETAILED_LOGS=true`)
   - 记录所有查询，包括快速查询

2. **慢查询** (耗时超过阈值)
   - 默认阈值：50ms
   - 可通过 `AGENT_QUERY_LOG_THRESHOLD_MS` 调整

3. **查询错误**
   - 所有错误都会记录（logger.error）

4. **API Key验证失败**
   - 使用logger.warning记录

### ❌ 不会记录日志的情况

- 生产环境（`DEBUG=False`）
- 快速查询（耗时低于阈值）
- 未启用详细日志模式

## 日志输出示例

### 慢查询日志（超过50ms）

```
2026-08-09 21:29:32 - auth_app.agent_identity_models - INFO -
[Agent查询] 按类型查询活跃Agent | 类型: cursor | 使用索引: idx_agent_type_trust_active | 结果数: 3 | 耗时: 51.23ms
```

### API Key验证失败

```
2026-08-09 21:29:32 - auth_app.agent_identity_models - WARNING -
[API Key验证] 验证失败 | Agent ID: agent_20260809_abc123 | 原因: 哈希不匹配 | 耗时: 0.03ms
```

### 查询错误

```
2026-08-09 21:29:32 - auth_app.agent_identity_models - ERROR -
[Agent查询失败] 按类型查询活跃Agent | 类型: cursor | 耗时: 5.67ms | 错误: DatabaseError...
```

## 性能影响分析

### 传统方式（每次都记录）

```python
# 每次查询都执行logger.info
logger.info(f"查询耗时: {elapsed_time}ms")
```

**问题**：
- 字符串格式化开销
- 日志I/O写入开销
- 高频查询场景下严重影响性能

### 优化方式（条件判断）

```python
# 仅在满足条件时才格式化和记录
if AGENT_ENABLE_DETAILED_LOGS or elapsed_time > AGENT_QUERY_LOG_THRESHOLD_MS:
    logger.info(f"查询耗时: {elapsed_time}ms")
```

**优势**：
- 避免不必要的字符串格式化
- 减少I/O操作
- 生产环境零性能损耗

## 生产环境最佳实践

### 1. 正常生产环境

```bash
# .env 文件
DEBUG=False
AGENT_QUERY_LOG_THRESHOLD_MS=100  # 只记录超过100ms的慢查询
```

**效果**：只记录慢查询和错误，性能影响可忽略

### 2. 性能调试模式

```bash
# .env 文件
DEBUG=False
AGENT_ENABLE_DETAILED_LOGS=true  # 临时启用详细日志
AGENT_QUERY_LOG_THRESHOLD_MS=50
```

**效果**：记录所有查询，用于性能分析（不建议长期使用）

### 3. 紧急问题排查

```bash
# 环境变量（重启后生效）
export AGENT_ENABLE_DETAILED_LOGS=true
export AGENT_QUERY_LOG_THRESHOLD_MS=0  # 记录所有查询
```

**效果**：完整日志记录，用于问题排查

## 监控建议

### 日志文件位置

- **安全审计日志**：`logs/security_audit.log`
- **控制台输出**：stderr/stdout

### 推荐监控指标

1. **慢查询数量**：统计超过阈值的查询
2. **错误率**：查询失败次数
3. **API Key验证失败率**：潜在安全威胁指标

### 集成监控系统

建议将日志接入ELK、Prometheus等监控系统：

```yaml
# Prometheus 示例配置
- pattern: '耗时: (\d+\.\d+)ms'
  name: agent_query_duration_ms
  value: $1
```

## 配置验证

运行测试脚本验证配置：

```bash
# 测试默认配置（生产环境）
python test_agent_query_logging.py

# 测试详细日志模式
AGENT_ENABLE_DETAILED_LOGS=true python test_agent_query_logging.py

# 测试慢查询阈值
AGENT_QUERY_LOG_THRESHOLD_MS=1 python test_agent_query_logging.py
```

## 总结

| 环境 | 配置 | 日志级别 | 性能影响 |
|------|------|----------|----------|
| 开发 | DEBUG=True | DEBUG | 可接受 |
| 生产（正常） | 阈值=100ms | WARNING | 几乎为零 |
| 生产（调试） | 详细日志=true | DEBUG | 有一定影响 |

**建议**：生产环境保持默认配置，仅在需要调试时临时启用详细日志。