import { CircuitStateType, CircuitBreakerConfig, FallbackContext, RequestResult, CircuitStatisticsSnapshot } from './circuit.types'
import { CircuitState } from './CircuitState'
import { FailureDetector } from './FailureDetector'
import { RecoveryTracker } from './RecoveryTracker'
import { CircuitStatistics } from './CircuitStatistics'

/**
 * 熔断器
 * 防止服务雪崩的核心组件
 */
export class CircuitBreaker {
  private serviceName: string
  private config: CircuitBreakerConfig
  private state: CircuitState
  private failureDetector: FailureDetector
  private recoveryTracker: RecoveryTracker
  private statistics: CircuitStatistics
  private openStartTime: number = 0

  constructor(serviceName: string, config: CircuitBreakerConfig) {
    this.serviceName = serviceName
    this.config = config

    // 初始化各个模块
    this.state = new CircuitState()
    this.failureDetector = new FailureDetector(config)
    this.recoveryTracker = new RecoveryTracker(config)
    this.statistics = new CircuitStatistics(config.timeWindow, config.slowCallDurationThreshold)

    console.log(`[CircuitBreaker] [${serviceName}] 熔断器初始化完成`, {
      failureThreshold: config.failureThreshold,
      openDuration: config.openDuration,
      successThreshold: config.successThreshold
    })
  }

  /**
   * 执行请求（核心方法）
   */
  async execute<T>(
    requestFn: () => Promise<T>,
    requestId?: string,
    method?: string,
    url?: string,
    config?: any
  ): Promise<T> {
    const currentState = this.state.getState()

    console.log(`[CircuitBreaker] [${this.serviceName}] [请求进入]`, {
      requestId: requestId || 'unknown',
      method: method || 'GET',
      url: url || '',
      currentState,
      timestamp: new Date().toISOString()
    })

    // 1. 检查熔断器状态
    if (this.state.isOpen()) {
      console.log(`[CircuitBreaker] [${this.serviceName}] [状态检查] 熔断器打开，进入处理流程`)
      return this.handleOpenState(requestId, method, url, config)
    }

    // 2. 执行请求
    const startTime = Date.now()
    try {
      console.log(`[CircuitBreaker] [${this.serviceName}] [开始执行] RequestID: ${requestId}`)
      const result = await requestFn()
      const duration = Date.now() - startTime

      // 记录成功
      this.recordSuccess(duration, requestId)

      console.log(`[CircuitBreaker] [${this.serviceName}] [执行成功]`, {
        requestId,
        duration: `${duration}ms`,
        currentState: this.state.getState()
      })

      return result
    } catch (error: any) {
      const duration = Date.now() - startTime

      // 记录失败
      this.recordFailure(duration, error, requestId)

      console.error(`[CircuitBreaker] [${this.serviceName}] [执行失败]`, {
        requestId,
        duration: `${duration}ms`,
        error: error.message,
        currentState: this.state.getState()
      })

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
    // 检查是否应该进入半打开状态
    const elapsed = Date.now() - this.openStartTime
    const remainingTime = this.config.openDuration - elapsed

    console.log(`[CircuitBreaker] [${this.serviceName}] [打开状态处理]`, {
      requestId,
      elapsed: `${elapsed}ms`,
      openDuration: `${this.config.openDuration}ms`,
      remainingTime: `${remainingTime}ms`,
      shouldTransitionToHalfOpen: elapsed >= this.config.openDuration
    })

    if (elapsed >= this.config.openDuration) {
      console.log(`[CircuitBreaker] [${this.serviceName}] [状态转换] 准备进入半打开状态`)
      this.transitionToHalfOpen()
    } else {
      console.warn(`[CircuitBreaker] [${this.serviceName}] [熔断拒绝] 快速失败`, {
        requestId,
        reason: '熔断器打开',
        remainingTime: `${remainingTime}ms`
      })

      // 执行降级函数
      if (this.config.fallbackFunction) {
        console.log(`[CircuitBreaker] [${this.serviceName}] [降级触发] 准备执行降级函数`)
        return this.executeFallback(requestId, method, url, config)
      }

      const error = new Error(`服务 ${this.serviceName} 当前不可用（熔断器打开）`)
      console.error(`[CircuitBreaker] [${this.serviceName}] [无降级] 抛出错误`, {
        requestId,
        errorMessage: error.message
      })

      throw error
    }

    // 半打开状态：允许请求通过
    console.log(`[CircuitBreaker] [${this.serviceName}] [进入半打开] 允许请求通过`)
    return this.handleHalfOpenState(requestId, method, url, config)
  }

  /**
   * 处理半打开状态
   */
  private async handleHalfOpenState<T>(
    requestId?: string,
    method?: string,
    url?: string,
    config?: any
  ): Promise<T> {
    const currentCalls = this.recoveryTracker.getCurrentCalls()
    const maxCalls = this.config.halfOpenMaxCalls

    console.log(`[CircuitBreaker] [${this.serviceName}] [半打开状态处理]`, {
      requestId,
      currentCalls,
      maxCalls,
      canProceed: currentCalls < maxCalls
    })

    // 检查是否超过半打开状态的最大调用次数
    if (currentCalls >= maxCalls) {
      console.warn(`[CircuitBreaker] [${this.serviceName}] [半打开拒绝] 调用次数已达上限`, {
        requestId,
        currentCalls,
        maxCalls
      })

      // 执行降级函数
      if (this.config.fallbackFunction) {
        console.log(`[CircuitBreaker] [${this.serviceName}] [降级触发] 半打开状态达到上限`)
        return this.executeFallback(requestId, method, url, config)
      }

      throw new Error(`服务 ${this.serviceName} 半打开状态调用次数已达上限`)
    }

    this.recoveryTracker.incrementCalls()
    console.log(`[CircuitBreaker] [${this.serviceName}] [半打开允许] 允许探测请求`, {
      requestId,
      newCallCount: this.recoveryTracker.getCurrentCalls()
    })

    return this.execute<T>(async () => Promise.resolve() as unknown as T, requestId, method, url, config)
  }

  /**
   * 执行降级函数
   */
  private async executeFallback<T>(
    requestId?: string,
    method?: string,
    url?: string,
    config?: any
  ): Promise<T> {
    if (!this.config.fallbackFunction) {
      const error = new Error(`服务 ${this.serviceName} 当前不可用（熔断器打开）`)
      console.error(`[CircuitBreaker] [${this.serviceName}] [降级失败] 无降级函数`, {
        requestId,
        errorMessage: error.message
      })
      throw error
    }

    const startTime = Date.now()

    console.log(`[CircuitBreaker] [${this.serviceName}] [降级开始] 准备执行降级函数`, {
      requestId,
      method,
      url,
      timestamp: new Date().toISOString()
    })

    const statistics = this.statistics.getSnapshot()

    const context: FallbackContext = {
      requestId: requestId || 'unknown',
      method: method || 'GET',
      url: url || '',
      path: config?.url || '',
      params: config?.params,
      data: config?.data,
      headers: config?.headers,
      serviceName: this.serviceName,
      circuitState: this.state.getState(),
      failureCount: statistics.failureCount,
      failureRate: statistics.failureRate,
      slowCallRate: statistics.slowCallRate,
      metadata: config?.metadata
    }

    console.log(`[CircuitBreaker] [${this.serviceName}] [降级上下文]`, {
      requestId,
      serviceName: context.serviceName,
      circuitState: context.circuitState,
      failureCount: context.failureCount,
      failureRate: `${(context.failureRate * 100).toFixed(2)}%`,
      slowCallRate: `${(context.slowCallRate * 100).toFixed(2)}%`
    })

    try {
      const result = await this.config.fallbackFunction(context)
      const duration = Date.now() - startTime

      console.log(`[CircuitBreaker] [${this.serviceName}] [降级成功]`, {
        requestId,
        duration: `${duration}ms`,
        resultType: typeof result
      })

      return result
    } catch (error: any) {
      const duration = Date.now() - startTime

      console.error(`[CircuitBreaker] [${this.serviceName}] [降级失败]`, {
        requestId,
        duration: `${duration}ms`,
        error: error.message,
        stack: error.stack
      })

      throw error
    }
  }

  /**
   * 记录成功
   */
  private recordSuccess(duration: number, requestId?: string): void {
    const isSlowCall = duration >= this.config.slowCallDurationThreshold

    const result: RequestResult = {
      success: true,
      duration,
      isSlowCall
    }

    this.statistics.record(result)

    console.log(`[CircuitBreaker] [${this.serviceName}] [记录成功]`, {
      requestId,
      duration: `${duration}ms`,
      isSlowCall,
      currentState: this.state.getState()
    })

    // 半打开状态：记录成功
    if (this.state.isHalfOpen()) {
      this.recoveryTracker.recordSuccess()

      const successCount = this.recoveryTracker.getCurrentCalls()
      console.log(`[CircuitBreaker] [${this.serviceName}] [半打开成功] 探测成功`, {
        requestId,
        successCount,
        threshold: this.config.successThreshold
      })

      if (this.recoveryTracker.shouldClose()) {
        console.log(`[CircuitBreaker] [${this.serviceName}] [恢复完成] 达到成功阈值，准备关闭熔断器`)
        this.transitionToClosed()
      }
    }
  }

  /**
   * 记录失败
   */
  private recordFailure(duration: number, error: Error, requestId?: string): void {
    const isSlowCall = duration >= this.config.slowCallDurationThreshold

    const result: RequestResult = {
      success: false,
      duration,
      error,
      isSlowCall
    }

    this.statistics.record(result)

    console.error(`[CircuitBreaker] [${this.serviceName}] [记录失败]`, {
      requestId,
      duration: `${duration}ms`,
      isSlowCall,
      errorMessage: error.message,
      currentState: this.state.getState()
    })

    // 半打开状态：立即打开熔断器
    if (this.state.isHalfOpen()) {
      console.error(`[CircuitBreaker] [${this.serviceName}] [半打开失败] 探测失败，立即打开熔断器`, {
        requestId,
        error: error.message
      })
      this.recoveryTracker.recordFailure()
      this.transitionToOpen()
      return
    }

    // 关闭状态：检查是否应该打开熔断器
    if (this.state.isClosed()) {
      const snapshot = this.statistics.getSnapshot()

      console.log(`[CircuitBreaker] [${this.serviceName}] [失败检测] 检查是否应该打开熔断器`, {
        requestId,
        totalCalls: snapshot.totalCalls,
        failedCalls: snapshot.failedCalls,
        failureRate: `${(snapshot.failureRate * 100).toFixed(2)}%`,
        slowCallRate: `${(snapshot.slowCallRate * 100).toFixed(2)}%`
      })

      if (this.failureDetector.shouldOpen(snapshot)) {
        console.warn(`[CircuitBreaker] [${this.serviceName}] [失败检测] 达到阈值，准备打开熔断器`)
        this.transitionToOpen()
      }
    }
  }

  /**
   * 转换到打开状态
   */
  private transitionToOpen(): void {
    const previousState = this.state.getState()

    this.state.setState(CircuitStateType.OPEN)
    this.openStartTime = Date.now()

    const snapshot = this.statistics.getSnapshot()

    console.warn(`[CircuitBreaker] [${this.serviceName}] [状态转换] 熔断器打开`, {
      previousState,
      newState: CircuitStateType.OPEN,
      timestamp: new Date().toISOString(),
      statistics: {
        totalCalls: snapshot.totalCalls,
        failedCalls: snapshot.failedCalls,
        failureRate: `${(snapshot.failureRate * 100).toFixed(2)}%`,
        slowCallRate: `${(snapshot.slowCallRate * 100).toFixed(2)}%`
      },
      openDuration: `${this.config.openDuration}ms`
    })

    this.recoveryTracker.reset()
  }

  /**
   * 转换到半打开状态
   */
  private transitionToHalfOpen(): void {
    const previousState = this.state.getState()

    this.state.setState(CircuitStateType.HALF_OPEN)

    console.log(`[CircuitBreaker] [${this.serviceName}] [状态转换] 熔断器进入半打开状态`, {
      previousState,
      newState: CircuitStateType.HALF_OPEN,
      timestamp: new Date().toISOString(),
      halfOpenMaxCalls: this.config.halfOpenMaxCalls,
      successThreshold: this.config.successThreshold
    })

    this.recoveryTracker.reset()
  }

  /**
   * 转换到关闭状态
   */
  private transitionToClosed(): void {
    const previousState = this.state.getState()

    this.state.setState(CircuitStateType.CLOSED)

    console.log(`[CircuitBreaker] [${this.serviceName}] [状态转换] 熔断器关闭，服务恢复正常`, {
      previousState,
      newState: CircuitStateType.CLOSED,
      timestamp: new Date().toISOString()
    })

    this.recoveryTracker.reset()
    this.statistics.reset()
    this.failureDetector.reset()
  }

  /**
   * 获取状态
   */
  getState(): CircuitStateType {
    return this.state.getState()
  }

  /**
   * 获取配置
   */
  getConfig(): CircuitBreakerConfig {
    return this.config
  }

  /**
   * 获取统计快照
   */
  getStatistics(): CircuitStatisticsSnapshot {
    return this.statistics.getSnapshot()
  }

  /**
   * 重置熔断器
   */
  reset(): void {
    this.state.setState(CircuitStateType.CLOSED)
    this.recoveryTracker.reset()
    this.statistics.reset()
    this.failureDetector.reset()

    console.log(`[CircuitBreaker] [${this.serviceName}] 熔断器已重置`)
  }
}