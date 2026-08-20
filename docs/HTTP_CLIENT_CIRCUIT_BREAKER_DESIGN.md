# HTTP 熔断器机制设计

## 设计目标

实现一个完整的熔断器（Circuit Breaker）机制，用于：
- 防止服务雪崩效应
- 快速失败，避免资源浪费
- 提供服务降级能力
- 自动恢复服务状态
- 与重试机制协同工作

---

## 1. 熔断器原理

### 状态机模型

```
┌─────────┐
│  CLOSED │ ←─── 成功 ───┐
│ (关闭)  │              │
└────┬────┘              │
     │                   │
     │ 失败次数 ≥ 阈值    │
     ↓                   │
┌─────────┐              │
│  OPEN   │              │
│ (打开)  │              │
└────┬────┘              │
     │                   │
     │ 等待超时          │
     ↓                   │
┌─────────┐              │
│HALF-OPEN│              │
│(半打开) │ ─────────────┘
└─────────┘
```

### 三种状态说明

| 状态 | 说明 | 行为 |
|------|------|------|
| **CLOSED（关闭）** | 正常状态 | 所有请求正常执行 |
| **OPEN（打开）** | 熔断状态 | 所有请求直接失败（快速失败） |
| **HALF-OPEN（半打开）** | 探测状态 | 允许少量请求通过，测试服务是否恢复 |

---

## 2. 模块结构

```
src/services/http/
├── circuit-breaker/
│   ├── CircuitBreaker.ts       # 核心熔断器
│   ├── CircuitState.ts         # 状态管理
│   ├── FailureDetector.ts      # 失败检测
│   ├── RecoveryTracker.ts      # 恢复追踪
│   ├── CircuitStatistics.ts    # 统计信息
│   └── circuit.types.ts        # 类型定义
```

---

## 3. 核心熔断器实现

### CircuitBreaker.ts

```typescript
import { CircuitState, CircuitStateType } from './CircuitState'
import { FailureDetector } from './FailureDetector'
import { RecoveryTracker } from './RecoveryTracker'
import { CircuitStatistics } from './CircuitStatistics'
import { CircuitBreakerConfig, CircuitBreakerStatus, RequestResult } from './circuit.types'

/**
 * 熔断器核心类
 */
export class CircuitBreaker {
  private state: CircuitState
  private failureDetector: FailureDetector
  private recoveryTracker: RecoveryTracker
  private statistics: CircuitStatistics
  private config: CircuitBreakerConfig
  private serviceName: string
  private lastStateChangeTime: number

  constructor(serviceName: string, config?: Partial<CircuitBreakerConfig>) {
    this.serviceName = serviceName
    this.config = {
      // 失败阈值配置
      failureThreshold: 5,           // 失败次数阈值
      failureRateThreshold: 0.5,     // 失败率阈值（50%）
      minimumNumberOfCalls: 10,      // 最小调用次数（计算失败率）

      // 时间窗口配置
      timeWindow: 60000,             // 统计时间窗口（60秒）

      // 熔断配置
      openDuration: 30000,           // 熔断持续时间（30秒）
      halfOpenMaxCalls: 3,           // 半打开状态最大调用次数

      // 恢复配置
      successThreshold: 3,           // 恢复成功阈值
      slowCallDurationThreshold: 5000, // 慢调用阈值（5秒）
      slowCallRateThreshold: 0.8,    // 慢调用率阈值（80%）

      // 降级配置
      fallbackFunction: undefined,

      ...config
    }

    this.state = new CircuitState()
    this.failureDetector = new FailureDetector(this.config)
    this.recoveryTracker = new RecoveryTracker(this.config)
    this.statistics = new CircuitStatistics(this.config.timeWindow!)

    this.lastStateChangeTime = Date.now()

    console.log(`[CircuitBreaker] [${serviceName}] 初始化完成，配置:`, {
      failureThreshold: this.config.failureThreshold,
      openDuration: this.config.openDuration,
      timeWindow: this.config.timeWindow
    })
  }

  /**
   * 执行请求（带熔断保护）
   */
  async execute<T>(
    requestFn: () => Promise<T>,
    requestId?: string
  ): Promise<T> {
    const currentState = this.state.getState()

    // 状态检查
    this.checkStateTransition()

    switch (currentState) {
      case CircuitStateType.OPEN:
        return this.handleOpenState(requestId)

      case CircuitStateType.HALF_OPEN:
        return this.handleHalfOpenState(requestFn, requestId)

      case CircuitStateType.CLOSED:
      default:
        return this.handleClosedState(requestFn, requestId)
    }
  }

  /**
   * 处理关闭状态（正常状态）
   */
  private async handleClosedState<T>(
    requestFn: () => Promise<T>,
    requestId?: string
  ): Promise<T> {
    const startTime = Date.now()

    try {
      const result = await requestFn()
      const duration = Date.now() - startTime

      // 记录成功
      this.recordSuccess(duration, requestId)

      return result

    } catch (error: any) {
      const duration = Date.now() - startTime

      // 记录失败
      this.recordFailure(error, duration, requestId)

      // 检查是否需要熔断
      if (this.shouldOpenCircuit()) {
        this.transitionToOpen(error)
      }

      throw error
    }
  }

  /**
   * 处理打开状态（熔断状态）
   */
  private async handleOpenState<T>(
    requestId?: string,
    method?: string,
    url?: string,
    config?: any
  ): Promise<T> {
    console.warn(`[CircuitBreaker] [${this.serviceName}] 熔断器打开，快速失败 - RequestID: ${requestId}`)

    // 执行降级函数（带上下文）
    if (this.config.fallbackFunction) {
      console.log(`[CircuitBreaker] [${this.serviceName}] 执行降级函数`)

      // 构建降级上下文
      const context: FallbackContext = {
        requestId: requestId || 'unknown',
        method: method || 'GET',
        url: url || '',
        path: config?.url || '',
        params: config?.params,
        data: config?.data,
        headers: config?.headers,
        serviceName: this.serviceName,
        circuitState: CircuitStateType.OPEN,
        failureCount: this.statistics.getSnapshot().failureCount,
        failureRate: this.statistics.getSnapshot().failureRate,
        slowCallRate: this.statistics.getSnapshot().slowCallRate,
        metadata: config?.metadata
      }

      return this.config.fallbackFunction(context)
    }

    // 抛出熔断异常
    throw new Error(`服务 ${this.serviceName} 当前不可用（熔断器打开）`)
  }

  /**
   * 处理半打开状态（探测状态）
   */
  private async handleHalfOpenState<T>(
    requestFn: () => Promise<T>,
    requestId?: string
  ): Promise<T> {
    const currentCalls = this.recoveryTracker.getCurrentCalls()

    // 检查是否超过半打开状态的最大调用次数
    if (currentCalls >= this.config.halfOpenMaxCalls!) {
      console.warn(`[CircuitBreaker] [${this.serviceName}] 半打开状态调用次数已达上限`)
      return this.handleOpenState(requestId)
    }

    // 增加调用计数
    this.recoveryTracker.incrementCalls()

    const startTime = Date.now()

    try {
      const result = await requestFn()
      const duration = Date.now() - startTime

      // 记录成功
      this.recordSuccess(duration, requestId)
      this.recoveryTracker.recordSuccess()

      // 检查是否可以恢复
      if (this.shouldCloseCircuit()) {
        this.transitionToClosed()
      }

      return result

    } catch (error: any) {
      const duration = Date.now() - startTime

      // 记录失败
      this.recordFailure(error, duration, requestId)
      this.recoveryTracker.recordFailure()

      // 立即回到打开状态
      this.transitionToOpen(error)

      throw error
    }
  }

  /**
   * 检查状态转换
   */
  private checkStateTransition(): void {
    const currentState = this.state.getState()

    // 如果是打开状态，检查是否应该进入半打开状态
    if (currentState === CircuitStateType.OPEN) {
      const timeSinceOpen = Date.now() - this.lastStateChangeTime

      if (timeSinceOpen >= this.config.openDuration!) {
        this.transitionToHalfOpen()
      }
    }
  }

  /**
   * 判断是否应该熔断
   */
  private shouldOpenCircuit(): boolean {
    return this.failureDetector.shouldOpen(this.statistics)
  }

  /**
   * 判断是否应该恢复
   */
  private shouldCloseCircuit(): boolean {
    return this.recoveryTracker.shouldClose()
  }

  /**
   * 记录成功
   */
  private recordSuccess(duration: number, requestId?: string): void {
    const isSlowCall = duration >= this.config.slowCallDurationThreshold!

    this.statistics.recordSuccess(duration, isSlowCall)

    console.log(`[CircuitBreaker] [${this.serviceName}] 记录成功 - RequestID: ${requestId}, 耗时: ${duration}ms`)
  }

  /**
   * 记录失败
   */
  private recordFailure(error: Error, duration: number, requestId?: string): void {
    this.statistics.recordFailure(error, duration)

    console.warn(`[CircuitBreaker] [${this.serviceName}] 记录失败 - RequestID: ${requestId}, 错误: ${error.message}`)
  }

  /**
   * 转换到打开状态
   */
  private transitionToOpen(error?: Error): void {
    const previousState = this.state.getState()

    this.state.setState(CircuitStateType.OPEN)
    this.lastStateChangeTime = Date.now()
    this.recoveryTracker.reset()

    console.error(`[CircuitBreaker] [${this.serviceName}] 熔断器打开 - 原因: ${error?.message || '未知'}`)

    this.logStateChange(previousState, CircuitStateType.OPEN)
  }

  /**
   * 转换到半打开状态
   */
  private transitionToHalfOpen(): void {
    const previousState = this.state.getState()

    this.state.setState(CircuitStateType.HALF_OPEN)
    this.lastStateChangeTime = Date.now()
    this.recoveryTracker.reset()

    console.log(`[CircuitBreaker] [${this.serviceName}] 熔断器进入半打开状态，开始探测`)

    this.logStateChange(previousState, CircuitStateType.HALF_OPEN)
  }

  /**
   * 转换到关闭状态
   */
  private transitionToClosed(): void {
    const previousState = this.state.getState()

    this.state.setState(CircuitStateType.CLOSED)
    this.lastStateChangeTime = Date.now()
    this.failureDetector.reset()
    this.recoveryTracker.reset()

    console.log(`[CircuitBreaker] [${this.serviceName}] 熔断器关闭，服务恢复正常`)

    this.logStateChange(previousState, CircuitStateType.CLOSED)
  }

  /**
   * 记录状态变化
   */
  private logStateChange(from: CircuitStateType, to: CircuitStateType): void {
    console.log(`[CircuitBreaker] [${this.serviceName}] 状态变化: ${from} → ${to}`)
  }

  /**
   * 获取当前状态
   */
  getStatus(): CircuitBreakerStatus {
    return {
      serviceName: this.serviceName,
      state: this.state.getState(),
      lastStateChangeTime: this.lastStateChangeTime,
      statistics: this.statistics.getSnapshot(),
      config: this.config
    }
  }

  /**
   * 强制打开熔断器
   */
  forceOpen(): void {
    this.transitionToOpen(new Error('手动熔断'))
    console.warn(`[CircuitBreaker] [${this.serviceName}] 强制打开熔断器`)
  }

  /**
   * 强制关闭熔断器
   */
  forceClose(): void {
    this.transitionToClosed()
    console.log(`[CircuitBreaker] [${this.serviceName}] 强制关闭熔断器`)
  }

  /**
   * 重置熔断器
   */
  reset(): void {
    this.state.setState(CircuitStateType.CLOSED)
    this.failureDetector.reset()
    this.recoveryTracker.reset()
    this.statistics.reset()
    this.lastStateChangeTime = Date.now()

    console.log(`[CircuitBreaker] [${this.serviceName}] 熔断器已重置`)
  }
}
```

---

## 4. 状态管理

### CircuitState.ts

```typescript
/**
 * 熔断器状态枚举
 */
export enum CircuitStateType {
  CLOSED = 'CLOSED',           // 关闭（正常）
  OPEN = 'OPEN',               // 打开（熔断）
  HALF_OPEN = 'HALF_OPEN'      // 半打开（探测）
}

/**
 * 熔断器状态管理
 */
export class CircuitState {
  private state: CircuitStateType = CircuitStateType.CLOSED

  /**
   * 获取当前状态
   */
  getState(): CircuitStateType {
    return this.state
  }

  /**
   * 设置状态
   */
  setState(state: CircuitStateType): void {
    this.state = state
  }

  /**
   * 判断是否允许请求
   */
  allowRequest(): boolean {
    return this.state !== CircuitStateType.OPEN
  }

  /**
   * 判断是否是打开状态
   */
  isOpen(): boolean {
    return this.state === CircuitStateType.OPEN
  }

  /**
   * 判断是否是半打开状态
   */
  isHalfOpen(): boolean {
    return this.state === CircuitStateType.HALF_OPEN
  }

  /**
   * 判断是否是关闭状态
   */
  isClosed(): boolean {
    return this.state === CircuitStateType.CLOSED
  }
}
```

---

## 5. 失败检测器

### FailureDetector.ts

```typescript
import { CircuitStatistics } from './CircuitStatistics'
import { CircuitBreakerConfig } from './circuit.types'

/**
 * 失败检测器
 * 判断是否应该触发熔断
 */
export class FailureDetector {
  private config: CircuitBreakerConfig

  constructor(config: CircuitBreakerConfig) {
    this.config = config
  }

  /**
   * 判断是否应该打开熔断器
   */
  shouldOpen(statistics: CircuitStatistics): boolean {
    const snapshot = statistics.getSnapshot()

    // 检查最小调用次数
    if (snapshot.totalCalls < this.config.minimumNumberOfCalls!) {
      return false
    }

    // 检查失败次数阈值
    if (snapshot.failureCount >= this.config.failureThreshold!) {
      console.log(`[FailureDetector] 失败次数达到阈值: ${snapshot.failureCount}/${this.config.failureThreshold}`)
      return true
    }

    // 检查失败率阈值
    if (snapshot.failureRate >= this.config.failureRateThreshold!) {
      console.log(`[FailureDetector] 失败率达到阈值: ${(snapshot.failureRate * 100).toFixed(2)}%/${(this.config.failureRateThreshold! * 100).toFixed(2)}%`)
      return true
    }

    // 检查慢调用率阈值
    if (snapshot.slowCallRate >= this.config.slowCallRateThreshold!) {
      console.log(`[FailureDetector] 慢调用率达到阈值: ${(snapshot.slowCallRate * 100).toFixed(2)}%/${(this.config.slowCallRateThreshold! * 100).toFixed(2)}%`)
      return true
    }

    return false
  }

  /**
   * 重置检测器
   */
  reset(): void {
    console.log(`[FailureDetector] 检测器已重置`)
  }
}
```

---

## 6. 恢复追踪器

### RecoveryTracker.ts

```typescript
import { CircuitBreakerConfig } from './circuit.types'

/**
 * 恢复追踪器
 * 追踪半打开状态下的恢复情况
 */
export class RecoveryTracker {
  private config: CircuitBreakerConfig
  private currentCalls: number = 0
  private successCount: number = 0
  private failureCount: number = 0

  constructor(config: CircuitBreakerConfig) {
    this.config = config
  }

  /**
   * 增加调用计数
   */
  incrementCalls(): void {
    this.currentCalls++
  }

  /**
   * 获取当前调用次数
   */
  getCurrentCalls(): number {
    return this.currentCalls
  }

  /**
   * 记录成功
   */
  recordSuccess(): void {
    this.successCount++
    console.log(`[RecoveryTracker] 探测成功，累计: ${this.successCount}/${this.config.successThreshold}`)
  }

  /**
   * 记录失败
   */
  recordFailure(): void {
    this.failureCount++
    console.warn(`[RecoveryTracker] 探测失败，失败次数: ${this.failureCount}`)
  }

  /**
   * 判断是否应该关闭熔断器（恢复正常）
   */
  shouldClose(): boolean {
    return this.successCount >= this.config.successThreshold!
  }

  /**
   * 重置追踪器
   */
  reset(): void {
    this.currentCalls = 0
    this.successCount = 0
    this.failureCount = 0
  }
}
```

---

## 7. 统计信息

### CircuitStatistics.ts

```typescript
import { CircuitStatisticsSnapshot } from './circuit.types'

/**
 * 熔断器统计信息
 * 使用滑动窗口统计
 */
export class CircuitStatistics {
  private timeWindow: number
  private requests: Array<{
    timestamp: number
    success: boolean
    duration: number
    isSlowCall: boolean
    error?: Error
  }> = []

  constructor(timeWindow: number) {
    this.timeWindow = timeWindow
  }

  /**
   * 记录成功请求
   */
  recordSuccess(duration: number, isSlowCall: boolean): void {
    this.requests.push({
      timestamp: Date.now(),
      success: true,
      duration,
      isSlowCall
    })

    this.cleanup()
  }

  /**
   * 记录失败请求
   */
  recordFailure(error: Error, duration: number): void {
    this.requests.push({
      timestamp: Date.now(),
      success: false,
      duration,
      isSlowCall: false,
      error
    })

    this.cleanup()
  }

  /**
   * 清理过期的记录
   */
  private cleanup(): void {
    const cutoffTime = Date.now() - this.timeWindow
    this.requests = this.requests.filter(r => r.timestamp > cutoffTime)
  }

  /**
   * 获取统计快照
   */
  getSnapshot(): CircuitStatisticsSnapshot {
    const totalCalls = this.requests.length
    const successfulCalls = this.requests.filter(r => r.success).length
    const failedCalls = totalCalls - successfulCalls
    const slowCalls = this.requests.filter(r => r.isSlowCall).length

    const totalDuration = this.requests.reduce((sum, r) => sum + r.duration, 0)
    const avgDuration = totalCalls > 0 ? totalDuration / totalCalls : 0

    const failureRate = totalCalls > 0 ? failedCalls / totalCalls : 0
    const slowCallRate = totalCalls > 0 ? slowCalls / totalCalls : 0

    return {
      totalCalls,
      successfulCalls,
      failedCalls,
      failureCount: failedCalls,
      failureRate,
      slowCalls,
      slowCallRate,
      avgDuration,
      timeWindow: this.timeWindow
    }
  }

  /**
   * 重置统计
   */
  reset(): void {
    this.requests = []
  }
}
```

---

## 8. 类型定义

### circuit.types.ts

```typescript
import { CircuitStateType } from './CircuitState'

/**
 * 熔断器配置
 */
export interface CircuitBreakerConfig {
  // 失败阈值配置
  failureThreshold: number           // 失败次数阈值
  failureRateThreshold: number       // 失败率阈值（0-1）
  minimumNumberOfCalls: number       // 最小调用次数（计算失败率）

  // 时间窗口配置
  timeWindow: number                 // 统计时间窗口（毫秒）

  // 熔断配置
  openDuration: number               // 熔断持续时间（毫秒）
  halfOpenMaxCalls: number           // 半打开状态最大调用次数

  // 恢复配置
  successThreshold: number           // 恢复成功阈值
  slowCallDurationThreshold: number  // 慢调用阈值（毫秒）
  slowCallRateThreshold: number      // 慢调用率阈值（0-1）

  // 降级配置（改进版）
  fallbackFunction?: (context: FallbackContext) => Promise<any>
}

/**
 * 降级上下文
 */
export interface FallbackContext {
  // 请求信息
  requestId: string                  // 请求ID
  method: string                     // 请求方法（GET/POST/PUT/DELETE等）
  url: string                        // 完整URL
  path: string                       // 请求路径
  params?: any                       // 请求参数
  data?: any                         // 请求体数据
  headers?: any                      // 请求头

  // 熔断信息
  serviceName: string                // 服务名称
  circuitState: CircuitStateType     // 熔断器状态
  failureCount: number               // 失败次数
  failureRate: number                // 失败率（0-1）
  slowCallRate: number               // 慢调用率（0-1）

  // 自定义错误码（可选）
  errorCode?: string                 // 自定义错误码
  errorMessage?: string              // 自定义错误消息

  // 其他元数据
  metadata?: Record<string, any>     // 请求元数据
}

/**
 * 熔断器状态
 */
export interface CircuitBreakerStatus {
  serviceName: string
  state: CircuitStateType
  lastStateChangeTime: number
  statistics: CircuitStatisticsSnapshot
  config: CircuitBreakerConfig
}

/**
 * 统计快照
 */
export interface CircuitStatisticsSnapshot {
  totalCalls: number
  successfulCalls: number
  failedCalls: number
  failureCount: number
  failureRate: number
  slowCalls: number
  slowCallRate: number
  avgDuration: number
  timeWindow: number
}

/**
 * 请求结果
 */
export interface RequestResult {
  success: boolean
  duration: number
  error?: Error
  isSlowCall?: boolean
}
```

---

## 9. 集成到 HttpClient

### HttpClient.ts（部分）

```typescript
import { CircuitBreaker } from './circuit-breaker/CircuitBreaker'

export class HttpClient {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map()
  private config: HttpClientConfig

  constructor(config: HttpClientConfig) {
    this.config = config

    // 初始化熔断器（如果配置了）
    if (config.circuitBreaker?.enabled) {
      // 为每个服务创建熔断器
      // 可以根据需要动态创建
    }

    console.log(`[HttpClient] 熔断器已初始化`)
  }

  /**
   * 获取或创建熔断器
   */
  private getCircuitBreaker(serviceName: string): CircuitBreaker {
    if (!this.circuitBreakers.has(serviceName)) {
      const circuitBreaker = new CircuitBreaker(serviceName, this.config.circuitBreaker)
      this.circuitBreakers.set(serviceName, circuitBreaker)
    }

    return this.circuitBreakers.get(serviceName)!
  }

  /**
   * 发起请求（带熔断保护）
   */
  private async request<T>(
    method: string,
    url: string,
    data?: any,
    config?: HttpRequestConfig
  ): Promise<HttpResponse<T>> {
    // 获取服务名称（用于熔断器）
    const serviceName = this.extractServiceName(url)

    // 如果启用了熔断器，使用熔断器包装请求
    if (this.config.circuitBreaker?.enabled) {
      const circuitBreaker = this.getCircuitBreaker(serviceName)
      const requestId = this.generateRequestId()

      return circuitBreaker.execute(
        () => this.executeRequest<T>(method, url, data, config, requestId),
        requestId
      )
    }

    // 否则直接执行请求
    return this.executeRequest<T>(method, url, data, config)
  }

  /**
   * 提取服务名称
   */
  private extractServiceName(url: string): string {
    // 从URL中提取服务名称
    // 例如: http://api.example.com/users -> api.example.com
    try {
      const parsedUrl = new URL(url, this.config.baseURL)
      return parsedUrl.hostname
    } catch {
      return 'default'
    }
  }

  /**
   * 获取所有熔断器状态
   */
  getCircuitBreakersStatus(): Map<string, CircuitBreakerStatus> {
    const status = new Map<string, CircuitBreakerStatus>()

    this.circuitBreakers.forEach((breaker, serviceName) => {
      status.set(serviceName, breaker.getStatus())
    })

    return status
  }

  /**
   * 重置所有熔断器
   */
  resetAllCircuitBreakers(): void {
    this.circuitBreakers.forEach((breaker) => {
      breaker.reset()
    })

    console.log(`[HttpClient] 所有熔断器已重置`)
  }
}
```

---

## 10. 降级函数上下文设计（改进版）

### 设计背景

原有的降级函数设计存在以下局限性：
1. ❌ 无参数，无法知道请求的上下文信息
2. ❌ 无法根据不同请求返回不同的降级数据
3. ❌ 无法区分请求类型（GET/POST等）
4. ❌ 无法传递自定义错误码或错误信息
5. ❌ 缺少熔断原因的详细信息

### 改进后的设计

#### FallbackContext 接口

```typescript
/**
 * 降级上下文
 */
export interface FallbackContext {
  // ===== 请求信息 =====
  requestId: string              // 请求ID，用于追踪
  method: string                 // 请求方法（GET/POST/PUT/DELETE等）
  url: string                    // 完整URL
  path: string                   // 请求路径
  params?: any                   // URL查询参数
  data?: any                     // 请求体数据
  headers?: any                  // 请求头

  // ===== 熔断信息 =====
  serviceName: string            // 服务名称
  circuitState: CircuitStateType // 熔断器状态（OPEN/HALF_OPEN）
  failureCount: number           // 失败次数
  failureRate: number            // 失败率（0-1）
  slowCallRate: number           // 慢调用率（0-1）

  // ===== 自定义错误码（可选） =====
  errorCode?: string             // 自定义错误码
  errorMessage?: string          // 自定义错误消息

  // ===== 其他元数据 =====
  metadata?: Record<string, any> // 请求元数据
}
```

#### 改进后的优势

| 优势 | 说明 | 示例 |
|------|------|------|
| **细粒度降级** | 根据请求路径/方法返回不同数据 | 用户服务 vs 订单服务 |
| **智能决策** | 根据熔断原因做决策 | 高失败率 vs 高延迟 |
| **关键请求保护** | 关键请求不降级 | X-Critical-Request |
| **监控集成** | 记录详细的降级日志 | 发送告警、记录指标 |
| **自定义错误码** | 支持业务自定义错误码 | USER_SERVICE_UNAVAILABLE |

### 典型使用场景

#### 场景1：根据请求路径返回不同的降级数据

```typescript
fallbackFunction: async (context) => {
  switch (context.path) {
    case '/api/v1/users':
      return {
        data: [],
        total: 0,
        message: '用户服务暂时不可用',
        errorCode: 'USER_SERVICE_UNAVAILABLE',
        requestId: context.requestId
      }

    case '/api/v1/orders':
      return {
        data: [],
        total: 0,
        message: '订单服务暂时不可用',
        errorCode: 'ORDER_SERVICE_UNAVAILABLE',
        requestId: context.requestId
      }

    default:
      return {
        data: null,
        message: '服务暂时不可用，请稍后重试',
        errorCode: 'SERVICE_UNAVAILABLE',
        requestId: context.requestId
      }
  }
}
```

#### 场景2：根据请求方法返回不同的降级数据

```typescript
fallbackFunction: async (context) => {
  // GET请求返回空数据（允许降级）
  if (context.method === 'GET') {
    return {
      data: [],
      message: '服务暂时不可用',
      errorCode: 'SERVICE_DEGRADED'
    }
  }

  // POST/PUT/DELETE请求返回失败（不允许降级）
  return {
    success: false,
    message: '服务暂时不可用，请稍后重试',
    errorCode: 'OPERATION_FAILED'
  }
}
```

#### 场景3：根据熔断原因返回不同的错误码

```typescript
fallbackFunction: async (context) => {
  let errorCode = 'SERVICE_UNAVAILABLE'

  // 根据失败率判断
  if (context.failureRate >= 0.8) {
    errorCode = 'SERVICE_HIGH_FAILURE_RATE'
  }
  // 根据慢调用率判断
  else if (context.slowCallRate >= 0.8) {
    errorCode = 'SERVICE_HIGH_LATENCY'
  }

  return {
    success: false,
    errorCode,
    errorMessage: `服务 ${context.serviceName} 暂时不可用`,
    requestId: context.requestId,
    serviceName: context.serviceName,
    failureRate: context.failureRate,
    slowCallRate: context.slowCallRate
  }
}
```

#### 场景4：关键请求保护

```typescript
fallbackFunction: async (context) => {
  // 检查是否是关键请求
  const isCritical = context.headers?.['X-Critical-Request'] === 'true'

  if (isCritical) {
    // 关键请求不降级，直接抛出错误
    throw new Error(`关键请求失败，无法降级 - RequestID: ${context.requestId}`)
  }

  // 普通请求返回降级数据
  return {
    degraded: true,
    message: '服务降级',
    errorCode: 'SERVICE_DEGRADED',
    fallbackData: {},
    requestId: context.requestId
  }
}
```

#### 场景5：监控集成

```typescript
fallbackFunction: async (context) => {
  // 记录详细的降级日志
  console.error(`[Fallback] 服务降级触发`, {
    requestId: context.requestId,
    serviceName: context.serviceName,
    path: context.path,
    method: context.method,
    failureRate: context.failureRate,
    slowCallRate: context.slowCallRate,
    timestamp: new Date().toISOString()
  })

  // 发送告警（异步，不阻塞）
  sendAlert({
    type: 'CIRCUIT_BREAKER_OPEN',
    serviceName: context.serviceName,
    requestId: context.requestId,
    failureRate: context.failureRate
  }).catch(err => console.error('发送告警失败:', err))

  // 返回降级数据
  return {
    degraded: true,
    message: '服务暂时不可用',
    errorCode: 'SERVICE_DEGRADED',
    requestId: context.requestId,
    timestamp: new Date().toISOString()
  }
}
```

### 降级函数最佳实践

1. **快速返回**：降级函数应该尽快返回，避免复杂的逻辑
2. **异步操作**：如果有异步操作（如发送告警），使用 `.catch()` 处理错误，不阻塞返回
3. **统一格式**：降级数据应该保持统一的响应格式
4. **包含请求ID**：始终在响应中包含 requestId，便于追踪
5. **合理错误码**：使用有意义、易理解的错误码
6. **记录日志**：记录详细的降级日志，便于排查问题

---

## 11. 使用示例

### 基础配置

```typescript
// 创建 HTTP 客户端（启用熔断器）
const httpClient = new HttpClient({
  baseURL: 'http://localhost:9092',
  circuitBreaker: {
    enabled: true,
    failureThreshold: 5,           // 5次失败后熔断
    failureRateThreshold: 0.5,     // 或失败率超过50%
    minimumNumberOfCalls: 10,      // 最少10次调用
    timeWindow: 60000,             // 60秒统计窗口
    openDuration: 30000,           // 熔断30秒
    halfOpenMaxCalls: 3,           // 半打开状态最多3次探测
    successThreshold: 3,           // 连续成功3次后恢复
    slowCallDurationThreshold: 5000, // 5秒以上算慢调用
    slowCallRateThreshold: 0.8,    // 慢调用率超过80%触发熔断

    // 改进后的降级函数（带上下文）
    fallbackFunction: async (context) => {
      // 1. 根据不同的请求路径返回不同的降级数据
      switch (context.path) {
        case '/api/v1/users':
          return {
            data: [],
            total: 0,
            message: '用户服务暂时不可用',
            errorCode: 'USER_SERVICE_UNAVAILABLE',
            requestId: context.requestId
          }

        case '/api/v1/orders':
          return {
            data: [],
            total: 0,
            message: '订单服务暂时不可用',
            errorCode: 'ORDER_SERVICE_UNAVAILABLE',
            requestId: context.requestId
          }

        default:
          return {
            data: null,
            message: '服务暂时不可用，请稍后重试',
            errorCode: 'SERVICE_UNAVAILABLE',
            requestId: context.requestId
          }
      }
    }
  }
})

// 更多的降级策略示例

// 示例1：根据请求方法返回不同的降级数据
const fallbackByMethod = async (context) => {
  // GET请求返回空数据
  if (context.method === 'GET') {
    return {
      data: [],
      message: '服务暂时不可用',
      errorCode: 'SERVICE_DEGRADED'
    }
  }

  // POST/PUT/DELETE请求返回失败
  return {
    success: false,
    message: '服务暂时不可用，请稍后重试',
    errorCode: 'OPERATION_FAILED'
  }
}

// 示例2：根据熔断原因返回不同的错误码
const fallbackByReason = async (context) => {
  let errorCode = 'SERVICE_UNAVAILABLE'

  if (context.failureRate >= 0.8) {
    errorCode = 'SERVICE_HIGH_FAILURE_RATE'
  } else if (context.slowCallRate >= 0.8) {
    errorCode = 'SERVICE_HIGH_LATENCY'
  }

  return {
    success: false,
    errorCode,
    errorMessage: `服务 ${context.serviceName} 暂时不可用`,
    requestId: context.requestId,
    serviceName: context.serviceName,
    failureRate: context.failureRate,
    slowCallRate: context.slowCallRate
  }
}

// 示例3：检查是否是关键请求
const fallbackWithCriticalCheck = async (context) => {
  const isCritical = context.headers?.['X-Critical-Request'] === 'true'

  if (isCritical) {
    // 关键请求不降级，直接抛出错误
    throw new Error(`关键请求失败，无法降级 - RequestID: ${context.requestId}`)
  }

  // 普通请求返回降级数据
  return {
    degraded: true,
    message: '服务降级',
    errorCode: 'SERVICE_DEGRADED',
    fallbackData: {},
    requestId: context.requestId
  }
}

// 示例4：记录详细日志并返回降级数据
const fallbackWithLogging = async (context) => {
  // 记录详细的降级日志
  console.error(`[Fallback] 服务降级触发`, {
    requestId: context.requestId,
    serviceName: context.serviceName,
    path: context.path,
    method: context.method,
    failureRate: context.failureRate,
    slowCallRate: context.slowCallRate,
    timestamp: new Date().toISOString()
  })

  // 发送告警（异步，不阻塞）
  sendAlert({
    type: 'CIRCUIT_BREAKER_OPEN',
    serviceName: context.serviceName,
    requestId: context.requestId,
    failureRate: context.failureRate
  }).catch(err => console.error('发送告警失败:', err))

  // 返回降级数据
  return {
    degraded: true,
    message: '服务暂时不可用',
    errorCode: 'SERVICE_DEGRADED',
    requestId: context.requestId,
    timestamp: new Date().toISOString()
  }
}
```

### 熔断器工作流程

```
1. 正常状态 (CLOSED)
   ↓ 连续失败5次 或 失败率>50%
   
2. 熔断状态 (OPEN) - 持续30秒
   ↓ 所有请求快速失败
   
3. 探测状态 (HALF-OPEN) - 最多3次探测
   ↓ 成功3次 → CLOSED
   ↓ 失败1次 → OPEN
```

### 查看熔断器状态

```typescript
// 获取所有熔断器状态
const status = httpClient.getCircuitBreakersStatus()

status.forEach((breakerStatus, serviceName) => {
  console.log(`服务: ${serviceName}`)
  console.log(`状态: ${breakerStatus.state}`)
  console.log(`失败率: ${(breakerStatus.statistics.failureRate * 100).toFixed(2)}%`)
  console.log(`总调用: ${breakerStatus.statistics.totalCalls}`)
})
```

### 手动控制熔断器

```typescript
const circuitBreaker = httpClient.getCircuitBreaker('api.example.com')

// 强制打开熔断器
circuitBreaker.forceOpen()

// 强制关闭熔断器
circuitBreaker.forceClose()

// 重置熔断器
circuitBreaker.reset()
```

---

## 11. 监控和告警

### 日志输出示例

```
[CircuitBreaker] [api.example.com] 熔断器打开 - 原因: 失败次数达到阈值: 5/5
[CircuitBreaker] [api.example.com] 熔断器进入半打开状态，开始探测
[CircuitBreaker] [api.example.com] 探测成功，累计: 1/3
[CircuitBreaker] [api.example.com] 探测成功，累计: 2/3
[CircuitBreaker] [api.example.com] 探测成功，累计: 3/3
[CircuitBreaker] [api.example.com] 熔断器关闭，服务恢复正常
```

### 统计报告

```typescript
// 生成熔断器报告
const generateCircuitBreakerReport = (httpClient: HttpClient) => {
  const status = httpClient.getCircuitBreakersStatus()
  
  status.forEach((breakerStatus, serviceName) => {
    console.log(`
=== ${serviceName} 熔断器状态 ===
状态: ${breakerStatus.state}
失败率: ${(breakerStatus.statistics.failureRate * 100).toFixed(2)}%
总调用: ${breakerStatus.statistics.totalCalls}
成功: ${breakerStatus.statistics.successfulCalls}
失败: ${breakerStatus.statistics.failedCalls}
慢调用: ${breakerStatus.statistics.slowCalls}
平均耗时: ${breakerStatus.statistics.avgDuration.toFixed(0)}ms
    `)
  })
}
```

---

## 12. 与重试机制协同

### 熔断器优先级高于重试

```typescript
// 请求执行顺序：
// 1. 熔断器检查（如果打开，快速失败）
// 2. 执行请求
// 3. 如果失败，重试机制介入
// 4. 如果重试失败，熔断器记录失败
// 5. 如果失败次数达到阈值，熔断器打开

async execute<T>(requestFn: () => Promise<T>): Promise<T> {
  // 1. 熔断器检查
  if (this.circuitBreaker.isOpen()) {
    throw new Error('熔断器打开')
  }

  // 2. 执行请求（带重试）
  try {
    return await this.retryPolicy.executeWithRetry(
      requestFn,
      this.requestId
    )
  } catch (error) {
    // 3. 记录失败
    this.circuitBreaker.recordFailure(error)
    throw error
  }
}
```

---

## 总结

这个熔断器机制提供了：

1. **完整的熔断状态机**：CLOSED、OPEN、HALF-OPEN 三种状态
2. **多维度失败判断**：失败次数、失败率、慢调用率
3. **自动恢复机制**：半打开状态探测，自动恢复服务
4. **降级支持**：提供降级函数，保证服务可用性
5. **滑动窗口统计**：时间窗口内的精确统计
6. **详细日志记录**：状态变化、成功失败都有日志
7. **灵活配置**：所有参数都可配置
8. **监控集成**：提供完整的统计和状态信息
9. **与重试协同**：熔断优先于重试，防止无效重试

熔断器是保障微服务稳定性的关键组件，可以有效防止雪崩效应，保护系统整体可用性。