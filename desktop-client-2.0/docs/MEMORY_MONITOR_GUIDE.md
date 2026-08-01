# 内存监控服务文档

## 📋 概述

`MemoryMonitorService` 是一个完整的内存监控解决方案，专为 Electron 应用设计，提供实时内存追踪、泄漏检测、趋势分析和告警功能。

## ✨ 核心功能

### 1. 实时内存使用追踪

- **堆内存监控**：追踪 heap used、heap total、heap limit
- **RSS 监控**：进程占用的物理内存
- **外部内存**：C++ 对象绑定的内存
- **ArrayBuffers**：ArrayBuffer 和 Node.js 缓冲区使用情况

### 2. 内存泄漏检测

- 持续增长检测：监控内存增长率
- 波动异常检测：识别不稳定的内存使用模式
- 自动风险评估：生成泄漏风险报告

### 3. 内存快照和趋势分析

- 手动/自动创建内存快照
- 时间窗口内的趋势分析
- 增长率计算（bytes/分钟）
- 趋势方向判断（增加/稳定/减少）

### 4. 内存超过阈值自动告警

- 警告级别告警（默认 70%）
- 严重级别告警（默认 85%）
- 告警历史记录
- 事件驱动的告警通知

### 5. 主动垃圾回收触发

- 手动触发 GC
- 自动 GC（可配置阈值）
- GC 效果统计

## 🚀 快速开始

### 基础使用

```typescript
import { MemoryMonitorService } from './services/memoryMonitor'

// 创建监控实例
const monitor = new MemoryMonitorService()

// 启动监控
monitor.start()

// 获取当前内存使用
const usage = monitor.getCurrentUsage()
console.log(`堆内存使用率: ${usage.heap.usagePercent}%`)

// 停止监控
monitor.stop()
```

### 自定义配置

```typescript
const monitor = new MemoryMonitorService({
  interval: 5000,              // 监控间隔：5秒
  warningThreshold: 75,        // 警告阈值：75%
  criticalThreshold: 90,       // 严重阈值：90%
  trendWindow: 600000,         // 趋势分析窗口：10分钟
  enableAutoGC: true,          // 启用自动 GC
  autoGCThreshold: 92,         // 自动 GC 阈值：92%
  enableLeakDetection: true    // 启用泄漏检测
})

monitor.start()
```

## 📊 API 文档

### 类：MemoryMonitorService

#### 构造函数

```typescript
constructor(config?: MemoryMonitorConfig)
```

#### 主要方法

##### start(): void

启动内存监控。

```typescript
monitor.start()
```

##### stop(): void

停止内存监控。

```typescript
monitor.stop()
```

##### getCurrentUsage(): MemoryUsage

获取当前内存使用情况。

```typescript
const usage = monitor.getCurrentUsage()
// 返回：{ timestamp, heap: { used, total, limit, usagePercent }, rss, external, arrayBuffers }
```

##### getHeapStatistics(): HeapStatistics

获取 V8 堆统计信息。

```typescript
const stats = monitor.getHeapStatistics()
// 返回：详细的堆空间统计信息
```

##### createSnapshot(label?: string): MemorySnapshot

创建内存快照。

```typescript
const snapshot = monitor.createSnapshot('登录后')
// 返回：{ id, timestamp, memory, heapStats, label }
```

##### getSnapshots(): MemorySnapshot[]

获取所有快照。

```typescript
const snapshots = monitor.getSnapshots()
```

##### clearSnapshots(): void

清空所有快照。

```typescript
monitor.clearSnapshots()
```

##### analyzeTrend(): MemoryTrendAnalysis

分析内存趋势。

```typescript
const trend = monitor.analyzeTrend()
// 返回：{ period, dataPoints, trend, avgHeapUsed, growthRate, leakRisk, ... }
```

##### getAlerts(limit?: number): MemoryAlert[]

获取告警列表。

```typescript
const alerts = monitor.getAlerts(10) // 最近 10 条告警
```

##### clearAlerts(): void

清空所有告警。

```typescript
monitor.clearAlerts()
```

##### forceGC(): void

触发垃圾回收。

```typescript
monitor.forceGC() // 需要 --expose-gc 参数
```

##### generateReport(): MemoryReport

生成内存报告。

```typescript
const report = monitor.generateReport()
// 返回：完整的内存分析报告，包含建议
```

##### getStatus(): MemoryMonitorStatus

获取监控状态。

```typescript
const status = monitor.getStatus()
// 返回：{ isMonitoring, startTime, duration, samplesCollected, ... }
```

##### updateConfig(newConfig: Partial<MemoryMonitorConfig>): void

更新配置。

```typescript
monitor.updateConfig({
  warningThreshold: 80,
  criticalThreshold: 90
})
```

### 事件系统

MemoryMonitorService 继承自 EventEmitter，提供以下事件：

#### 'started'

监控启动时触发。

```typescript
monitor.on('started', (data) => {
  console.log('监控启动:', data.startTime)
})
```

#### 'stopped'

监控停止时触发。

```typescript
monitor.on('stopped', (data) => {
  console.log('监控停止:', data.duration)
})
```

#### 'sample'

每次采集时触发。

```typescript
monitor.on('sample', (data) => {
  console.log('采样:', data.usage.heap.usagePercent)
})
```

#### 'alert'

触发告警时触发。

```typescript
monitor.on('alert', (alert) => {
  console.log(`告警 [${alert.level}]: ${alert.message}`)
})
```

#### 'snapshot'

创建快照时触发。

```typescript
monitor.on('snapshot', (snapshot) => {
  console.log('快照创建:', snapshot.id)
})
```

#### 'gc'

垃圾回收完成时触发。

```typescript
monitor.on('gc', (data) => {
  console.log(`GC 释放: ${data.freed} bytes`)
})
```

## 🔧 配置选项

### MemoryMonitorConfig

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `interval` | number | 5000 | 监控间隔（毫秒） |
| `warningThreshold` | number | 70 | 堆内存警告阈值（百分比） |
| `criticalThreshold` | number | 85 | 堆内存严重阈值（百分比） |
| `trendWindow` | number | 600000 | 趋势分析时间窗口（毫秒） |
| `maxSnapshots` | number | 50 | 最大快照数量 |
| `maxTrendPoints` | number | 1000 | 最大趋势数据点数量 |
| `enableAutoGC` | boolean | false | 是否启用自动 GC |
| `autoGCThreshold` | number | 90 | 自动 GC 触发阈值（百分比） |
| `enableLeakDetection` | boolean | true | 是否启用泄漏检测 |

## 📦 类型定义

### MemoryUsage

```typescript
interface MemoryUsage {
  timestamp: string
  heap: {
    used: number
    total: number
    limit: number
    usagePercent: number
  }
  rss: number
  external: number
  arrayBuffers: number
}
```

### MemoryAlert

```typescript
interface MemoryAlert {
  id: string
  timestamp: string
  level: 'info' | 'warning' | 'critical'
  message: string
  currentUsage: MemoryUsage
  threshold: number
  usagePercent: number
  handled: boolean
}
```

### MemoryReport

```typescript
interface MemoryReport {
  generatedAt: string
  monitoringDuration: number
  currentUsage: MemoryUsage
  trendAnalysis: MemoryTrendAnalysis
  recentAlerts: MemoryAlert[]
  snapshotCount: number
  recommendations: string[]
}
```

## 💡 使用场景

### 1. Electron 主进程集成

```typescript
// main.ts
import { app } from 'electron'
import { MemoryMonitorService } from './services/memoryMonitor'

let monitor: MemoryMonitorService

app.whenReady().then(() => {
  monitor = new MemoryMonitorService({
    interval: 10000,
    warningThreshold: 75,
    criticalThreshold: 85
  })

  monitor.on('alert', (alert) => {
    // 发送告警到渲染进程
    mainWindow?.webContents.send('memory-alert', alert)
  })

  monitor.start()
})

app.on('before-quit', () => {
  monitor?.stop()
})
```

### 2. IPC 通信

```typescript
// handlers.ts
import { ipcMain } from 'electron'

ipcMain.handle('memory:get-current', () => {
  return monitor.getCurrentUsage()
})

ipcMain.handle('memory:get-report', () => {
  return monitor.generateReport()
})

ipcMain.handle('memory:force-gc', () => {
  monitor.forceGC()
  return { success: true }
})
```

### 3. 性能测试

```typescript
describe('Feature', () => {
  let monitor: MemoryMonitorService

  beforeEach(() => {
    monitor = new MemoryMonitorService({ interval: 100 })
    monitor.start()
  })

  afterEach(() => {
    monitor.stop()
  })

  it('should not leak memory', () => {
    const before = monitor.getCurrentUsage()

    // 执行测试代码
    performOperation()

    const after = monitor.getCurrentUsage()
    const growthMB = (after.heap.used - before.heap.used) / (1024 * 1024)

    expect(growthMB).toBeLessThan(10)
  })
})
```

## 🎯 最佳实践

### 1. 生产环境配置

```typescript
const monitor = new MemoryMonitorService({
  interval: 10000,           // 10秒，减少性能影响
  warningThreshold: 75,      // 适中阈值
  criticalThreshold: 85,
  enableAutoGC: false,       // 生产环境谨慎使用自动 GC
  enableLeakDetection: true  // 保持泄漏检测开启
})
```

### 2. 开发环境配置

```typescript
const monitor = new MemoryMonitorService({
  interval: 2000,           // 2秒，更频繁的监控
  warningThreshold: 60,     // 更低的阈值，及早发现问题
  criticalThreshold: 80,
  enableAutoGC: true,       // 开发环境可以启用
  enableLeakDetection: true
})
```

### 3. 定期生成报告

```typescript
setInterval(() => {
  const report = monitor.generateReport()

  if (report.trendAnalysis.leakRisk) {
    // 发送通知或记录日志
    logger.warn('内存泄漏风险', report.trendAnalysis.riskDetails)
  }
}, 300000) // 每 5 分钟
```

### 4. 关键操作前后创建快照

```typescript
function performHeavyOperation() {
  monitor.createSnapshot('操作前')

  try {
    // 执行重操作
    doHeavyWork()
  } finally {
    monitor.createSnapshot('操作后')
  }
}
```

## 🔍 故障排查

### GC 未启用

如果看到警告 "GC 未启用"，需要在启动应用时添加 `--expose-gc` 参数：

```bash
electron . --expose-gc
```

或在代码中：

```typescript
// 如果启用了 GC
if (global.gc) {
  monitor.forceGC()
}
```

### 内存使用率持续增长

1. 检查是否有未清理的事件监听器
2. 检查是否有未清理的定时器
3. 检查是否有循环引用
4. 使用 Chrome DevTools 进行堆快照分析

### 性能影响

如果监控对性能影响较大：

1. 增加 `interval` 值
2. 减少 `maxTrendPoints` 数量
3. 禁用泄漏检测（不推荐）

## 📈 性能指标

### 内存开销

- 监控服务本身：< 1MB
- 每个快照：约 1-2KB
- 每个趋势数据点：约 50 bytes

### CPU 开销

- 采集操作：< 1ms
- 趋势分析：< 5ms
- 报告生成：< 10ms

## 🔗 相关资源

- [Node.js process.memoryUsage() 文档](https://nodejs.org/api/process.html#process_process_memoryusage)
- [V8 堆统计 API](https://nodejs.org/api/v8.html)
- [Electron 性能优化](https://www.electronjs.org/docs/latest/tutorial/performance)

## 📝 更新日志

### v1.0.0 (2026-08-01)

- ✅ 实现实时内存追踪
- ✅ 添加内存泄漏检测
- ✅ 实现快照和趋势分析
- ✅ 添加阈值告警系统
- ✅ 支持主动垃圾回收
- ✅ 完整的 TypeScript 类型定义
- ✅ 完整的单元测试覆盖

## 👥 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License