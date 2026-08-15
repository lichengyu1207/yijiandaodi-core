import { CircuitStatisticsSnapshot, RequestResult } from './circuit.types'

/**
 * 统计条目
 */
interface StatisticEntry {
  timestamp: number
  success: boolean
  duration: number
  isSlowCall: boolean
}

/**
 * 熔断器统计信息
 * 使用滑动窗口统计请求结果
 */
export class CircuitStatistics {
  private timeWindow: number
  private entries: StatisticEntry[] = []
  private slowCallDurationThreshold: number

  constructor(timeWindow: number, slowCallDurationThreshold: number) {
    this.timeWindow = timeWindow
    this.slowCallDurationThreshold = slowCallDurationThreshold
  }

  /**
   * 记录请求结果
   */
  record(result: RequestResult): void {
    this.entries.push({
      timestamp: Date.now(),
      success: result.success,
      duration: result.duration,
      isSlowCall: result.isSlowCall || result.duration >= this.slowCallDurationThreshold
    })

    // 清理过期数据
    this.cleanup()
  }

  /**
   * 清理过期数据
   */
  private cleanup(): void {
    const cutoff = Date.now() - this.timeWindow
    this.entries = this.entries.filter(entry => entry.timestamp >= cutoff)
  }

  /**
   * 获取统计快照
   */
  getSnapshot(): CircuitStatisticsSnapshot {
    this.cleanup()

    const totalCalls = this.entries.length
    const successfulCalls = this.entries.filter(e => e.success).length
    const failedCalls = totalCalls - successfulCalls
    const slowCalls = this.entries.filter(e => e.isSlowCall).length

    return {
      totalCalls,
      successfulCalls,
      failedCalls,
      failureCount: failedCalls,
      failureRate: totalCalls > 0 ? failedCalls / totalCalls : 0,
      slowCalls,
      slowCallRate: totalCalls > 0 ? slowCalls / totalCalls : 0,
      avgDuration: totalCalls > 0
        ? this.entries.reduce((sum, e) => sum + e.duration, 0) / totalCalls
        : 0,
      timeWindow: this.timeWindow
    }
  }

  /**
   * 重置统计
   */
  reset(): void {
    this.entries = []
    console.log(`[CircuitStatistics] 统计已重置`)
  }
}