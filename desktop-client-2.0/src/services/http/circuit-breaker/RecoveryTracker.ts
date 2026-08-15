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
    return this.successCount >= this.config.successThreshold
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