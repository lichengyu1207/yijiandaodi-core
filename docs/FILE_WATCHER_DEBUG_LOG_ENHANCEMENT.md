# FileWatcher 调试日志增强报告

## 📋 概述

本次增强为 FileWatcher.ts 的关键调用处添加了详细的调试日志，方便排查运行时问题。

---

## ✅ 已增强的日志位置

### 1. **构造函数（初始化阶段）**

**位置**: 第360-394行

**增强内容**:
```typescript
// 初始化开始时间
const initStartTime = Date.now()
console.log('[File-Watcher] ========== 开始初始化文件监控器 ==========')

// 基本信息
console.log(`[File-Watcher] 基础URL: ${baseUrl}`)
console.log(`[File-Watcher] 认证令牌: ${authToken ? '已提供' : '未提供'}`)

// HTTP 客户端实例
console.log('[File-Watcher] HTTP 客户端实例已获取')

// 熔断器状态检查
const circuitBreakerStatus = this.apiClient.getCircuitBreakerStatus()
if (circuitBreakerStatus) {
  console.log(`[File-Watcher] 熔断器状态: ${circuitBreakerStatus.state}`)
  console.log(`[File-Watcher] 熔断器配置:`, {
    failureThreshold: circuitBreakerStatus.config?.failureThreshold || 5,
    openDuration: `${circuitBreakerStatus.config?.openDuration || 30000}ms`,
    enabled: circuitBreakerStatus.config?.enabled !== false
  })
}

// 初始化完成
console.log(`[File-Watcher] ========== 文件监控器初始化完成 ========== 耗时: ${Date.now() - initStartTime}ms`)
```

**新增日志点**:
- ✅ 初始化开始/结束标记
- ✅ 基础URL和认证令牌状态
- ✅ HTTP 客户端实例获取确认
- ✅ 熔断器状态检查
- ✅ 熔断器配置详情
- ✅ 初始化耗时统计

---

### 2. **startWatch 方法（启动监控）**

**位置**: 第406-516行

**增强内容**:
```typescript
// 配置信息
console.log(`[File-Watcher] ========== 开始启动监控 ==========`)
console.log(`[File-Watcher] 配置信息:`)
console.log(`  - 配置名称: ${config.watch_name}`)
console.log(`  - 配置ID: ${config.id}`)
console.log(`  - 监控路径: ${config.watch_path}`)
console.log(`  - 文件扩展名: [${config.file_extensions?.join(', ') || '所有'}]`)
console.log(`  - 排除模式: [${config.exclude_patterns?.join(', ') || '无'}]`)
console.log(`  - 监控创建: ${config.watch_create ? '是' : '否'}`)
console.log(`  - 监控修改: ${config.watch_modify ? '是' : '否'}`)
console.log(`  - 监控删除: ${config.watch_delete ? '是' : '否'}`)
console.log(`  - 自动校验: ${config.auto_verify ? '是' : '否'}`)
console.log(`  - 风险阈值: ${config.risk_threshold || '未设置'}`)

// 熔断器状态检查
const circuitBreakerStatus = this.apiClient.getCircuitBreakerStatus()
if (circuitBreakerStatus) {
  console.log(`[File-Watcher] 熔断器状态检查:`)
  console.log(`  - 当前状态: ${circuitBreakerStatus.state}`)
  console.log(`  - 总调用次数: ${circuitBreakerStatus.statistics?.totalCalls || 0}`)
  console.log(`  - 失败次数: ${circuitBreakerStatus.statistics?.failedCalls || 0}`)
  console.log(`  - 失败率: ${circuitBreakerStatus.statistics?.failureRate ? (circuitBreakerStatus.statistics.failureRate * 100).toFixed(2) : 0}%`)
  
  if (circuitBreakerStatus.state === 'OPEN') {
    console.warn(`[File-Watcher] [警告] 熔断器已打开，后端服务可能不可用`)
    console.warn(`[File-Watcher] [警告] 文件监控将继续，但无法上传操作日志和触发校验`)
  }
}

// 排除模式解析
console.log(`[File-Watcher] 解析排除模式...`)
console.log(`[File-Watcher] 排除模式已解析:`, ignored)

// chokidar 创建
console.log(`[File-Watcher] 创建 chokidar 监听器...`)
console.log(`[File-Watcher] chokidar 监听器已创建 耗时: ${Date.now() - watcherCreateTime}ms`)

// 事件监听器注册
console.log(`[File-Watcher] 已注册文件创建事件监听器`)
console.log(`[File-Watcher] 已注册文件修改事件监听器`)
console.log(`[File-Watcher] 已注册文件删除事件监听器`)

// 完成
console.log(`[File-Watcher] ========== 监控启动成功 ========== 总耗时: ${Date.now() - startTime}ms`)
console.log(`[File-Watcher] 当前活动监控数: ${this.watchers.size}`)
```

**新增日志点**:
- ✅ 配置信息详情（10个配置项）
- ✅ 熔断器状态检查（包含统计信息）
- ✅ 熔断器打开警告
- ✅ 排除模式解析结果
- ✅ chokidar 创建耗时
- ✅ 事件监听器注册确认
- ✅ 启动成功/失败标记
- ✅ 当前活动监控数统计

---

### 3. **triggerVerification 方法（触发校验）**

**位置**: 第855-958行

**增强内容**:
```typescript
// 熔断器状态检查（请求前）
const circuitBreakerStatus = this.apiClient.getCircuitBreakerStatus()
if (circuitBreakerStatus) {
  console.log(`[File-Watcher] [Verify] 熔断器状态: ${circuitBreakerStatus.state}`)
  if (circuitBreakerStatus.state === 'OPEN') {
    console.warn(`[File-Watcher] [Verify] [警告] 熔断器已打开，校验请求将触发降级`)
  }
}

// 响应详情
console.log(`[File-Watcher] [Verify] 后端响应时间: ${responseTime}ms`)
console.log(`[File-Watcher] [Verify] 响应状态码: ${response.status}`)
console.log(`[File-Watcher] [Verify] 响应状态文本: ${response.statusText}`)

// 降级响应检测
if (response.data.degraded) {
  console.warn(`[File-Watcher] [Verify] [降级] 收到降级响应`)
  console.warn(`[File-Watcher] [Verify] [降级] 消息: ${response.data.message}`)
  console.warn(`[File-Watcher] [Verify] [降级] 错误码: ${response.data.errorCode}`)
  console.log(`[File-Watcher] ========== 文件校验完成（降级） ========== 总耗时: ${Date.now() - startTime}ms`)
  return
}

// 熔断器状态变化检测
const newCircuitBreakerStatus = this.apiClient.getCircuitBreakerStatus()
if (newCircuitBreakerStatus) {
  console.log(`[File-Watcher] [Verify] 熔断器状态（请求后）: ${newCircuitBreakerStatus.state}`)
  if (newCircuitBreakerStatus.state !== circuitBreakerStatus?.state) {
    console.log(`[File-Watcher] [Verify] [状态变化] 熔断器状态已从 ${circuitBreakerStatus?.state} 变为 ${newCircuitBreakerStatus.state}`)
  }
}

// 错误详情增强
console.error(`[File-Watcher] [Verify-Error] 错误类型: ${error.constructor.name}`)
console.error(`[File-Watcher] [Verify-Error] 错误消息: ${error.message}`)
console.error(`[File-Watcher] [Verify-Error] 错误堆栈:`, error.stack)

// 降级错误检测
if (error.response?.data?.degraded) {
  console.warn(`[File-Watcher] [Verify-Error] [降级] 收到降级响应`)
  console.warn(`[File-Watcher] [Verify-Error] [降级] 消息: ${error.response.data.message}`)
  return
}

// 熔断器状态检查（错误后）
console.error(`[File-Watcher] [Verify-Error] 熔断器状态: ${newCircuitBreakerStatus.state}`)
console.error(`[File-Watcher] [Verify-Error] 失败次数: ${newCircuitBreakerStatus.statistics?.failedCalls || 0}`)
console.error(`[File-Watcher] [Verify-Error] 失败率: ${newCircuitBreakerStatus.statistics?.failureRate ? (newCircuitBreakerStatus.statistics.failureRate * 100).toFixed(2) : 0}%`)
```

**新增日志点**:
- ✅ 请求前熔断器状态检查
- ✅ 熔断器打开警告
- ✅ 响应状态码和状态文本
- ✅ 降级响应检测和处理
- ✅ 请求后熔断器状态检查
- ✅ 熔断器状态变化检测
- ✅ 错误类型、消息和堆栈
- ✅ 降级错误检测
- ✅ 错误后熔断器状态检查
- ✅ 失败次数和失败率统计

---

## 📊 日志输出示例

### 1. 初始化阶段

```
[File-Watcher] ========== 开始初始化文件监控器 ==========
[File-Watcher] 基础URL: http://localhost:9092
[File-Watcher] 认证令牌: 已提供
[File-Watcher] HTTP 客户端实例已获取
[File-Watcher] 熔断器状态: CLOSED
[File-Watcher] 熔断器配置: {
  failureThreshold: 5,
  openDuration: '30000ms',
  enabled: true
}
[HashQueue] 初始化完成 { maxConcurrent: 20, maxQueueDepth: 100, maxRetries: 3, ... }
[File-Watcher] 哈希计算队列已初始化
[File-Watcher] ========== 文件监控器初始化完成 ========== 耗时: 15ms
```

### 2. 启动监控阶段

```
[File-Watcher] ========== 开始启动监控 ==========
[File-Watcher] 配置信息:
  - 配置名称: 测试监控
  - 配置ID: 1
  - 监控路径: /path/to/watch
  - 文件扩展名: [js, ts, json]
  - 排除模式: [node_modules, .git]
  - 监控创建: 是
  - 监控修改: 是
  - 监控删除: 是
  - 自动校验: 是
  - 风险阈值: high
[File-Watcher] 熔断器状态检查:
  - 当前状态: CLOSED
  - 总调用次数: 0
  - 失败次数: 0
  - 失败率: 0.00%
[File-Watcher] 解析排除模式...
[File-Watcher] 排除模式已解析: ['**/node_modules/**', '**/.git/**']
[File-Watcher] 创建 chokidar 监听器...
[File-Watcher] chokidar 监听器已创建 耗时: 25ms
[File-Watcher] 已注册文件创建事件监听器
[File-Watcher] 已注册文件修改事件监听器
[File-Watcher] 已注册文件删除事件监听器
[File-Watcher] ========== 监控启动成功 ========== 总耗时: 30ms
[File-Watcher] 当前活动监控数: 1
```

### 3. 文件校验阶段

```
[File-Watcher] ========== 开始触发文件校验 ==========
[File-Watcher] [Verify] 文件路径: /path/to/file.js
[File-Watcher] [Verify] 文件哈希: abc123def456...
[File-Watcher] [Verify] 配置ID: 1
[File-Watcher] [Verify] 风险阈值: high
[File-Watcher] [Verify] 熔断器状态: CLOSED
[File-Watcher] [Verify] 发送校验请求到后端...
[File-Watcher] [Verify] 后端响应时间: 245ms
[File-Watcher] [Verify] 响应状态码: 200
[File-Watcher] [Verify] 响应状态文本: OK
[File-Watcher] [Verify] 校验结果:
  - 风险等级: low
  - 风险分数: 15
  - 风险标签: []
  - 检查结果:
    - 身份官: 通过
    - 风险官: 通过
    - 验证官: 通过
    - 决策官: 通过
[File-Watcher] [Verify] 熔断器状态（请求后）: CLOSED
[File-Watcher] [Verify] 检查是否超过风险阈值...
[File-Watcher] [Verify] 当前风险: low, 阈值: high, 结果: 未超过阈值
[File-Watcher] ========== 文件校验完成 ========== 总耗时: 260ms
```

### 4. 降级响应示例

```
[File-Watcher] [Verify] 熔断器状态: OPEN
[File-Watcher] [Verify] [警告] 熔断器已打开，校验请求将触发降级
[File-Watcher] [Verify] 发送校验请求到后端...
[File-Watcher] [Verify] 后端响应时间: 5ms
[File-Watcher] [Verify] 响应状态码: 503
[File-Watcher] [Verify] 响应状态文本: Service Unavailable
[File-Watcher] [Verify] [降级] 收到降级响应
[File-Watcher] [Verify] [降级] 消息: 验证服务暂时不可用
[File-Watcher] [Verify] [降级] 错误码: VERIFY_SERVICE_UNAVAILABLE
[File-Watcher] ========== 文件校验完成（降级） ========== 总耗时: 10ms
```

### 5. 错误处理示例

```
[File-Watcher] ========== 文件校验失败 ========== 耗时: 5005ms
[File-Watcher] [Verify-Error] 错误类型: Error
[File-Watcher] [Verify-Error] 错误消息: Network Error
[File-Watcher] [Verify-Error] 错误堆栈: Error: Network Error
    at http.<anonymous> (...)
    at ...
[File-Watcher] [Verify-Error] 熔断器状态: OPEN
[File-Watcher] [Verify-Error] 失败次数: 5
[File-Watcher] [Verify-Error] 失败率: 50.00%
```

---

## 🎯 增强收益

### 1. **问题定位更快速**
- ✅ 所有操作都有开始/结束标记
- ✅ 每个步骤都有详细的日志输出
- ✅ 错误堆栈信息完整

### 2. **状态监控更全面**
- ✅ 熔断器状态实时监控
- ✅ 失败次数和失败率统计
- ✅ 状态变化自动检测

### 3. **降级处理更清晰**
- ✅ 降级响应自动识别
- ✅ 降级原因详细说明
- ✅ 降级错误码记录

### 4. **性能分析更准确**
- ✅ 所有操作都有耗时统计
- ✅ HTTP 响应时间单独记录
- ✅ 初始化和创建时间明确

---

## 📚 相关文档

- [HTTP_CLIENT_LOGGING_POINTS.md](file:///c:/MsSafeData/Desktop/yijiandaodi/docs/HTTP_CLIENT_LOGGING_POINTS.md) - HTTP 客户端日志埋点文档
- [HTTP_CLIENT_INTEGRATION_REPORT.md](file:///c:/MsSafeData/Desktop/yijiandaodi/docs/HTTP_CLIENT_INTEGRATION_REPORT.md) - HTTP 客户端集成报告

---

## ✅ 总结

通过本次增强，FileWatcher.ts 现在具备了完整的调试日志体系，包括：

1. **初始化阶段**：熔断器状态、配置详情
2. **启动监控阶段**：配置信息、熔断器检查、事件监听器注册
3. **文件处理阶段**：步骤详情、耗时统计（已有）
4. **文件校验阶段**：熔断器状态检查、响应详情、降级检测、错误详情

所有关键调用点都已添加详细的调试日志，方便排查运行时问题！🎉