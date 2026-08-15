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
  shouldOpen(statistics: {
    totalCalls: number
    failureCount: number
    failureRate: number
    slowCallRate: number
  }): boolean {
    // 检查最小调用次数
    if (statistics.totalCalls < this.config.minimumNumberOfCalls) {
      return false
    }

    // 检查失败次数阈值
    if (statistics.failureCount >= this.config.failureThreshold) {
      console.log(`[FailureDetector] 失败次数达到阈值: ${statistics.failureCount}/${this.config.failureThreshold}`)
      return true
    }

    // 检查失败率阈值
    if (statistics.failureRate >= this.config.failureRateThreshold) {
      console.log(`[FailureDetector] 失败率达到阈值: ${(statistics.failureRate * 100).toFixed(2)}%/${(this.config.failureRateThreshold * 100).toFixed(2)}%`)
      return true
    }

    // 检查慢调用率阈值
    if (statistics.slowCallRate >= this.config.slowCallRateThreshold) {
      console.log(`[FailureDetector] 慢调用率达到阈值: ${(statistics.slowCallRate * 100).toFixed(2)}%/${(this.config.slowCallRateThreshold * 100).toFixed(2)}%`)
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