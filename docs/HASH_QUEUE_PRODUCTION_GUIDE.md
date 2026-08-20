# HashQueue 队列限流、重试和降级机制 - 生产应用指南

## 概述

HashQueue 已正式集成到 FileWatchService.ts 的生产代码中，为文件哈希计算提供完整的限流、重试和降级能力。

## 生产配置

### 默认配置（生产环境）

```typescript
this.hashQueue = new HashQueue({
  maxConcurrent: 20,      // 最大20个并发哈希计算
  maxQueueDepth: 100,     // 最大100个队列深度
  maxRetries: 3,          // 最大3次重试
  retryDelay: 1000,       // 重试延迟1秒
  enableFallback: true    // 启用降级策略
})
```

### 配置说明

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `maxConcurrent` | 20 | 最大并发哈希计算数量，防止CPU过载 |
| `maxQueueDepth` | 100 | 最大队列深度，防止内存溢出 |
| `maxRetries` | 3 | 队列满时的最大重试次数 |
| `retryDelay` | 1000ms | 重试间隔时间 |
| `enableFallback` | true | 是否启用降级策略 |

## 工作流程

### 1. 正常流程

```
文件变动 → 触发监控 → calculateFileHash()
           ↓
     HashQueue.add()
           ↓
     [入队成功] → 队列处理 → 哈希计算 → 返回结果
```

### 2. 队列满时流程

```
文件变动 → 触发监控 → calculateFileHash()
           ↓
     HashQueue.add()
           ↓
     [队列已满] → 拒绝入队
           ↓
     [自动重试] (最多3次，间隔1秒)
           ↓
     ├─ 成功 → 队列处理 → 哈希计算
     └─ 失败 → 降级策略
```

## 降级策略

### 1. LOG_AND_SKIP (默认策略)

**行为**：记录警告日志，返回空哈希

**日志输出**：
```
[HashQueue] [降级开始] 文件: example.txt
[HashQueue] [降级策略] 当前策略: log_and_skip
[HashQueue] [降级原因] 队列已满 (100/100)，拒绝新任务
[HashQueue] [降级执行] 开始执行策略: log_and_skip
[HashQueue] [降级跳过] 已跳过文件哈希计算
[HashQueue] [降级完成] LOG_AND_SKIP: 记录日志并返回空哈希
```

**适用场景**：允许部分文件跳过哈希计算，保证系统可用性

### 2. RETURN_EMPTY

**行为**：直接返回空哈希（64个0）

**返回值**：`0000000000000000000000000000000000000000000000000000000000000000`

**适用场景**：需要明确标识哈希计算失败的文件

### 3. RETURN_TIMESTAMP

**行为**：生成基于时间戳的伪哈希（确保64位长度）

**返回值示例**：`0000019ff4f260216bac57bc5fc30c02e2662127c0b90d5e2ae877b87715f985`

**适用场景**：需要唯一标识但不需要真实哈希的场景

### 4. THROW_ERROR

**行为**：抛出原始错误，中断流程

**错误信息**：`队列已满 (100/100)，拒绝新任务: /path/to/file`

**适用场景**：需要严格保证哈希计算成功的场景

## 详细日志输出

### 任务提交日志

```
[HashQueue] [提交] 文件: test.txt, 当前队列状态: { 队列: 5/100, 运行: 15/20 }
[HashQueue] [尝试入队] 文件: test.txt, 第1次尝试
```

### 队列拒绝日志

```
[HashQueue] [拒绝入队] test.txt
[HashQueue] [拒绝原因] 队列深度已达上限 100/100
[HashQueue] [拒绝详情] 运行中任务: 20/20
```

### 重试机制日志

```
[HashQueue] [队列满] test.txt 被拒绝
[HashQueue] [队列状态] 队列深度: 100/100, 运行任务: 20/20
[HashQueue] [重试] 1/3: test.txt
[HashQueue] [等待] 开始等待 1000ms...
[HashQueue] [等待完成] 已等待 1002ms, 队列状态: { 队列: 98, 运行: 18 }
```

### 任务处理日志

```
[HashQueue] [开始处理] test.txt
[HashQueue] [处理状态] 运行中: 16/20, 剩余队列: 85
[HashQueue] [处理成功] test.txt, 耗时: 245ms
[HashQueue] [哈希结果] a1b2c3d4e5f6...
[HashQueue] [任务结束] test.txt, 当前运行: 15/20
[HashQueue] [继续处理] 队列中还有 85 个任务待处理
```

### 队列状态监控日志

```
[HashQueue] [队列暂停] 达到最大并发数 20/20, 等待任务完成
[HashQueue] [队列空闲] 队列为空，无任务待处理
```

## 生产应用位置

### FileWatchService.ts 中的集成点

**1. 构造函数初始化（第360-366行）**

```typescript
// 初始化哈希计算队列（增强配置）
this.hashQueue = new HashQueue({
  maxConcurrent: 20,
  maxQueueDepth: 100,
  maxRetries: 3,
  retryDelay: 1000,
  enableFallback: true
})
```

**2. 哈希计算入口（第710-713行）**

```typescript
private async calculateFileHash(filePath: string): Promise<string> {
  // 通过队列添加哈希计算任务
  return this.hashQueue.add(filePath, this.calculateFileHashInternal.bind(this))
}
```

**3. 实际哈希计算（第718-753行）**

```typescript
private async calculateFileHashInternal(filePath: string): Promise<string> {
  // 实际的哈希计算逻辑（使用1MB缓冲区优化）
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = fs.createReadStream(filePath, {
      highWaterMark: 1024 * 1024  // 1MB缓冲区
    })
    // ... 流式计算哈希
  })
}
```

**4. 文件处理流程**

- `handleFileCreate` (第527行)：文件创建时计算哈希
- `handleFileModify` (第589行)：文件修改时计算哈希

## 监控和排查

### 日志排查流程

1. **查找队列满日志**：搜索 `[拒绝入队]` 或 `[队列满]`
2. **查看重试情况**：搜索 `[重试]` 查看重试次数
3. **检查降级触发**：搜索 `[降级开始]` 查看降级详情
4. **监控队列状态**：搜索 `[队列状态]` 查看队列深度变化

### 性能监控指标

- **队列深度**：监控 `队列: X/100` 避免频繁满载
- **并发数**：监控 `运行: X/20` 避免CPU过载
- **处理耗时**：监控 `耗时: Xms` 识别慢文件
- **重试频率**：统计 `[重试]` 日志评估队列压力

## 最佳实践

### 1. 配置调优

**高负载场景**：
```typescript
{
  maxConcurrent: 30,    // 增加并发
  maxQueueDepth: 200,   // 增加队列深度
  maxRetries: 5         // 增加重试次数
}
```

**低配置环境**：
```typescript
{
  maxConcurrent: 10,    // 降低并发
  maxQueueDepth: 50,    // 降低队列深度
  maxRetries: 2         // 降低重试次数
}
```

### 2. 降级策略选择

- **开发环境**：`THROW_ERROR`（快速失败）
- **测试环境**：`LOG_AND_SKIP`（观察行为）
- **生产环境**：`LOG_AND_SKIP`（保证可用性）

### 3. 错误处理

```typescript
try {
  const hash = await this.calculateFileHash(filePath)
  if (hash === '0000000000000000000000000000000000000000000000000000000000000000') {
    console.warn('文件哈希计算被降级，使用备用方案')
    // 执行备用方案
  }
} catch (error) {
  console.error('哈希计算失败:', error)
  // 错误处理
}
```

## 测试覆盖

### 单元测试文件

- `HashQueueRetry.test.ts`：重试机制和降级策略测试
- `QueueFullSimulation.test.ts`：队列满场景模拟测试
- `FileWatcherHash.test.ts`：哈希计算性能测试

### 测试覆盖范围

✅ 队列满时自动重试
✅ 达到最大重试次数后停止
✅ 四种降级策略的正确性
✅ 配置参数验证
✅ 队列满场景模拟
✅ 详细日志输出验证

## 版本信息

- **实现版本**：v2.0
- **创建时间**：2026-08-12
- **作者**：一鉴到底团队
- **文档版本**：1.0

## 相关文档

- [文件系统监控架构设计](./FILE_SYSTEM_WATCHER_ARCHITECTURE.md)
- [ShortTermMemoryApi 监控日志同步实施报告](./SHORT_TERM_MEMORY_API_MONITORING_SYNC_REPORT.md)