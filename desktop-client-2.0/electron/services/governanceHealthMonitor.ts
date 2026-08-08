/**
 * 治理健康度监控器 - MVP 版本
 * 功能：采集和评估系统治理健康度
 */

import type { MemoryMonitorService } from '../services/memoryMonitor'
import type { CPUMonitor } from '../services/cpuMonitor'

/**
 * 健康度指标
 */
export interface HealthMetrics {
  accuracy: {
    value: number
    baseline: number
    deviation: number
    status: 'normal' | 'warning' | 'critical'
  }
  performance: {
    avgResponseTime: number
    baseline: number
    deviation: number
    status: 'normal' | 'warning' | 'critical'
  }
  falsePositiveRate: {
    value: number
    baseline: number
    deviation: number
    status: 'normal' | 'warning' | 'critical'
  }
  overallHealth: number
  overallStatus: 'healthy' | 'degraded' | 'critical'
  timestamp: number
}

/**
 * 治理健康度监控器
 */
export class GovernanceHealthMonitor {
  private memoryMonitor?: MemoryMonitorService
  private cpuMonitor?: CPUMonitor
  
  // 基线值（基于技术迭代文档中的技术指标）
  private readonly baselines = {
    accuracy: 0.912,        // 91.2% 召回率
    responseTime: 180,      // 0.18秒 = 180ms
    falsePositiveRate: 0.06 // 6%
  }

  // 历史记录
  private metricsHistory: HealthMetrics[] = []
  private readonly maxHistorySize = 1000

  /**
   * 构造函数
   */
  constructor(
    memoryMonitor?: MemoryMonitorService,
    cpuMonitor?: CPUMonitor
  ) {
    this.memoryMonitor = memoryMonitor
    this.cpuMonitor = cpuMonitor
  }

  /**
   * 设置监控器
   */
  setMonitors(memoryMonitor: MemoryMonitorService, cpuMonitor: CPUMonitor): void {
    this.memoryMonitor = memoryMonitor
    this.cpuMonitor = cpuMonitor
  }

  /**
   * 采集健康度指标
   */
  collectMetrics(): HealthMetrics {
    // 1. 准确率指标（使用系统资源状态作为代理指标）
    const accuracy = this.collectAccuracyMetrics()
    
    // 2. 性能指标
    const performance = this.collectPerformanceMetrics()
    
    // 3. 误报率指标（模拟数据）
    const falsePositiveRate = this.collectFalsePositiveMetrics()
    
    // 4. 计算整体健康度
    const overallHealth = this.calculateOverallHealth(
      accuracy,
      performance,
      falsePositiveRate
    )
    
    // 5. 确定整体状态
    const overallStatus = this.determineOverallStatus(overallHealth)

    const metrics: HealthMetrics = {
      accuracy,
      performance,
      falsePositiveRate,
      overallHealth,
      overallStatus,
      timestamp: Date.now()
    }

    // 6. 保存到历史记录
    this.metricsHistory.push(metrics)
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift()
    }

    return metrics
  }

  /**
   * 采集准确率指标
   */
  private collectAccuracyMetrics(): HealthMetrics['accuracy'] {
    // MVP: 使用内存状态作为健康度代理
    let proxyAccuracy = this.baselines.accuracy
    
    if (this.memoryMonitor) {
      try {
        const memReport = this.memoryMonitor.generateReport()
        
        // 如果系统资源紧张，认为准确率可能下降
        // 内存风险分数越高，准确率代理值越低
        const memoryRiskFactor = memReport.current.risk_score / 200
        proxyAccuracy = this.baselines.accuracy - memoryRiskFactor * 0.1
      } catch (error) {
        console.warn('[GovernanceHealthMonitor] 获取内存监控数据失败:', error)
      }
    } else {
      // 如果没有内存监控，添加轻微随机波动模拟
      proxyAccuracy = this.baselines.accuracy + (Math.random() * 0.02 - 0.01)
    }
    
    const value = Math.max(0, Math.min(1, proxyAccuracy))
    const deviation = value - this.baselines.accuracy
    
    return {
      value,
      baseline: this.baselines.accuracy,
      deviation,
      status: this.getStatus(Math.abs(deviation), 0.05, 0.1)
    }
  }

  /**
   * 采集性能指标
   */
  private collectPerformanceMetrics(): HealthMetrics['performance'] {
    let avgResponseTime = this.baselines.responseTime
    
    if (this.cpuMonitor) {
      try {
        const cpuStats = this.cpuMonitor.getRealtimeStats()
        
        // 使用CPU使用率作为响应时间的代理
        // CPU使用率越高，响应时间越长
        avgResponseTime = this.baselines.responseTime + cpuStats.current.total * 2
      } catch (error) {
        console.warn('[GovernanceHealthMonitor] 获取CPU监控数据失败:', error)
      }
    } else {
      // 如果没有CPU监控，添加轻微随机波动模拟
      avgResponseTime = this.baselines.responseTime + (Math.random() * 40 - 20)
    }
    
    const deviation = avgResponseTime - this.baselines.responseTime
    
    return {
      avgResponseTime,
      baseline: this.baselines.responseTime,
      deviation,
      status: this.getStatus(Math.abs(deviation), 50, 100)
    }
  }

  /**
   * 采集误报率指标
   */
  private collectFalsePositiveMetrics(): HealthMetrics['falsePositiveRate'] {
    // MVP: 使用固定值加轻微波动模拟
    const value = this.baselines.falsePositiveRate + (Math.random() * 0.02 - 0.01)
    const deviation = value - this.baselines.falsePositiveRate
    
    return {
      value: Math.max(0, value),
      baseline: this.baselines.falsePositiveRate,
      deviation,
      status: this.getStatus(Math.abs(deviation), 0.02, 0.05)
    }
  }

  /**
   * 计算整体健康度
   */
  private calculateOverallHealth(
    accuracy: HealthMetrics['accuracy'],
    performance: HealthMetrics['performance'],
    falsePositiveRate: HealthMetrics['falsePositiveRate']
  ): number {
    // 加权平均
    const weights = {
      accuracy: 0.5,
      performance: 0.3,
      falsePositiveRate: 0.2
    }

    // 准确率分数 (0-100)
    const accuracyScore = accuracy.value * 100
    
    // 性能分数 (0-100，响应时间越低越好)
    const performanceScore = Math.max(0, 100 - (performance.avgResponseTime / 10))
    
    // 误报率分数 (0-100，误报率越低越好)
    const fpsScore = Math.max(0, 100 - (falsePositiveRate.value * 1000))

    return (
      accuracyScore * weights.accuracy +
      performanceScore * weights.performance +
      fpsScore * weights.falsePositiveRate
    )
  }

  /**
   * 确定整体状态
   */
  private determineOverallStatus(health: number): HealthMetrics['overallStatus'] {
    if (health >= 85) return 'healthy'
    if (health >= 60) return 'degraded'
    return 'critical'
  }

  /**
   * 获取状态
   */
  private getStatus(
    deviation: number,
    warningThreshold: number,
    criticalThreshold: number
  ): 'normal' | 'warning' | 'critical' {
    if (deviation >= criticalThreshold) return 'critical'
    if (deviation >= warningThreshold) return 'warning'
    return 'normal'
  }

  /**
   * 获取历史指标
   */
  getMetricsHistory(limit: number = 10): HealthMetrics[] {
    return this.metricsHistory.slice(-limit)
  }

  /**
   * 获取趋势
   */
  getTrend(metric: 'accuracy' | 'performance' | 'overallHealth', minutes: number = 10): Array<{ time: number; value: number }> {
    const cutoff = Date.now() - minutes * 60 * 1000
    const recent = this.metricsHistory.filter(m => m.timestamp > cutoff)
    
    return recent.map(m => ({
      time: m.timestamp,
      value: metric === 'overallHealth' ? m.overallHealth :
             metric === 'accuracy' ? m.accuracy.value * 100 :
             m.performance.avgResponseTime
    }))
  }

  /**
   * 导出健康度报告
   */
  exportReport(): {
    current: HealthMetrics
    history: HealthMetrics[]
    summary: {
      avgHealth: number
      minHealth: number
      maxHealth: number
      criticalEvents: number
    }
  } {
    const healthScores = this.metricsHistory.map(m => m.overallHealth)
    
    return {
      current: this.metricsHistory[this.metricsHistory.length - 1] || this.collectMetrics(),
      history: this.metricsHistory,
      summary: {
        avgHealth: healthScores.length > 0 ? 
          healthScores.reduce((a, b) => a + b, 0) / healthScores.length : 0,
        minHealth: healthScores.length > 0 ? Math.min(...healthScores) : 0,
        maxHealth: healthScores.length > 0 ? Math.max(...healthScores) : 0,
        criticalEvents: this.metricsHistory.filter(m => m.overallStatus === 'critical').length
      }
    }
  }

  /**
   * 清空历史记录
   */
  clearHistory(): void {
    this.metricsHistory = []
  }
}