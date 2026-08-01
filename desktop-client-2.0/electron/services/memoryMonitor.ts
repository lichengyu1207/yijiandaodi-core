/**
 * 内存监控服务
 * 提供实时内存追踪、泄漏检测、趋势分析和告警功能
 */

import { EventEmitter } from 'events'
import v8 from 'v8'

// ==================== 类型定义 ====================

/**
 * 内存使用数据
 */
export interface MemoryUsage {
  /** 时间戳 */
  timestamp: string
  /** 堆内存使用情况 */
  heap: {
    /** 已使用的堆内存 (bytes) */
    used: number
    /** 总堆内存 (bytes) */
    total: number
    /** 执行新对象分配前的堆内存限制 (bytes) */
    limit: number
    /** 使用率百分比 */
    usagePercent: number
  }
  /** RSS (Resident Set Size) - 进程占用的物理内存 */
  rss: number
  /** 外部内存 - C++ 对象绑定的内存 */
  external: number
  /** ArrayBuffer 和 Node.js 缓冲区使用的内存 */
  arrayBuffers: number
}

/**
 * V8 堆统计信息
 */
export interface HeapStatistics {
  /** 时间戳 */
  timestamp: string
  /** 堆空间统计 */
  spaces: {
    /** 空间名称 */
    name: string
    /** 空间大小 (bytes) */
    size: number
    /** 已使用大小 (bytes) */
    usedSize: number
    /** 可用大小 (bytes) */
    availableSize: number
    /** 物理大小 (bytes) */
    physicalSize: number
  }[]
  /** 总堆大小 */
  totalHeapSize: number
  /** 总堆可执行大小 */
  totalHeapSizeExecutable: number
  /** 已使用的堆大小 */
  usedHeapSize: number
  /** 堆大小限制 */
  heapSizeLimit: number
  /** 分配的内存大小 */
  mallocedMemory: number
  /** 峰值分配内存 */
  peakMallocedMemory: number
  /** GC 吞吐量 */
  gcPauseRate: number
  /** GC 总时间 */
  totalGcTime: number
}

/**
 * 内存快照
 */
export interface MemorySnapshot {
  /** 快照 ID */
  id: string
  /** 快照时间 */
  timestamp: string
  /** 内存使用数据 */
  memory: MemoryUsage
  /** 堆统计信息 */
  heapStats: HeapStatistics
  /** 标签 */
  label?: string
}

/**
 * 内存趋势数据点
 */
export interface MemoryTrendPoint {
  timestamp: string
  heapUsed: number
  heapTotal: number
  rss: number
  external: number
}

/**
 * 内存趋势分析结果
 */
export interface MemoryTrendAnalysis {
  /** 分析时间段 */
  period: {
    start: string
    end: string
  }
  /** 数据点数量 */
  dataPoints: number
  /** 趋势方向 */
  trend: 'increasing' | 'stable' | 'decreasing'
  /** 平均堆内存使用 */
  avgHeapUsed: number
  /** 最大堆内存使用 */
  maxHeapUsed: number
  /** 最小堆内存使用 */
  minHeapUsed: number
  /** 平均 RSS */
  avgRSS: number
  /** 内存增长率 (bytes/分钟) */
  growthRate: number
  /** 是否存在泄漏风险 */
  leakRisk: boolean
  /** 风险说明 */
  riskDetails?: string
}

/**
 * 内存告警级别
 */
export type AlertLevel = 'info' | 'warning' | 'critical'

/**
 * 内存告警
 */
export interface MemoryAlert {
  /** 告警 ID */
  id: string
  /** 告警时间 */
  timestamp: string
  /** 告警级别 */
  level: AlertLevel
  /** 告警消息 */
  message: string
  /** 当前内存使用 */
  currentUsage: MemoryUsage
  /** 阈值配置 */
  threshold: number
  /** 使用率 */
  usagePercent: number
  /** 是否已处理 */
  handled: boolean
}

/**
 * 内存监控配置
 */
export interface MemoryMonitorConfig {
  /** 监控间隔 (毫秒), 默认 5000ms */
  interval?: number
  /** 堆内存警告阈值 (百分比), 默认 70% */
  warningThreshold?: number
  /** 堆内存严重阈值 (百分比), 默认 85% */
  criticalThreshold?: number
  /** 趋势分析时间窗口 (毫秒), 默认 10分钟 */
  trendWindow?: number
  /** 最大快照数量 */
  maxSnapshots?: number
  /** 最大趋势数据点数量 */
  maxTrendPoints?: number
  /** 是否启用自动 GC */
  enableAutoGC?: boolean
  /** 自动 GC 触发阈值 (百分比), 默认 90% */
  autoGCThreshold?: number
  /** 是否启用泄漏检测 */
  enableLeakDetection?: boolean
}

/**
 * 内存监控状态
 */
export interface MemoryMonitorStatus {
  /** 是否正在监控 */
  isMonitoring: boolean
  /** 监控开始时间 */
  startTime?: string
  /** 监控持续时间 (毫秒) */
  duration?: number
  /** 采集次数 */
  samplesCollected: number
  /** 告警次数 */
  alertsTriggered: number
  /** 最后一次采集时间 */
  lastSampleTime?: string
  /** 最后一次内存使用 */
  lastMemoryUsage?: MemoryUsage
  /** 配置信息 */
  config: MemoryMonitorConfig
}

/**
 * 内存报告
 */
export interface MemoryReport {
  /** 报告生成时间 */
  generatedAt: string
  /** 监控时长 (毫秒) */
  monitoringDuration: number
  /** 当前内存使用 */
  currentUsage: MemoryUsage
  /** 趋势分析 */
  trendAnalysis: MemoryTrendAnalysis
  /** 最近告警 */
  recentAlerts: MemoryAlert[]
  /** 快照数量 */
  snapshotCount: number
  /** 建议 */
  recommendations: string[]
}

// ==================== 主类 ====================

/**
 * 内存监控服务
 */
export class MemoryMonitorService extends EventEmitter {
  private config: Required<MemoryMonitorConfig>
  private intervalId: NodeJS.Timeout | null = null
  private startTime: number = 0
  private samplesCollected: number = 0
  private alertsTriggered: number = 0
  private snapshots: MemorySnapshot[] = []
  private trendData: MemoryTrendPoint[] = []
  private alerts: MemoryAlert[] = []
  private isRunning: boolean = false

  // 默认配置
  private static readonly DEFAULT_CONFIG: Required<MemoryMonitorConfig> = {
    interval: 5000,
    warningThreshold: 70,
    criticalThreshold: 85,
    trendWindow: 600000, // 10分钟
    maxSnapshots: 50,
    maxTrendPoints: 1000,
    enableAutoGC: false,
    autoGCThreshold: 90,
    enableLeakDetection: true
  }

  constructor(config: MemoryMonitorConfig = {}) {
    super()
    this.config = { ...MemoryMonitorService.DEFAULT_CONFIG, ...config }
  }

  /**
   * 开始监控
   */
  start(): void {
    if (this.isRunning) {
      console.log('[MemoryMonitor] 监控已在运行中')
      return
    }

    this.isRunning = true
    this.startTime = Date.now()
    this.samplesCollected = 0
    this.alertsTriggered = 0

    console.log('[MemoryMonitor] 🚀 开始内存监控')
    console.log(`[MemoryMonitor] 监控间隔: ${this.config.interval}ms`)
    console.log(`[MemoryMonitor] 告警阈值: 警告 ${this.config.warningThreshold}%, 严重 ${this.config.criticalThreshold}%`)

    // 立即采集一次
    this.collect()

    // 定时采集
    this.intervalId = setInterval(() => {
      this.collect()
    }, this.config.interval)

    this.emit('started', { startTime: new Date().toISOString() })
  }

  /**
   * 停止监控
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('[MemoryMonitor] 监控未在运行')
      return
    }

    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    this.isRunning = false
    const duration = Date.now() - this.startTime

    console.log('[MemoryMonitor] 🛑 停止内存监控')
    console.log(`[MemoryMonitor] 监控时长: ${Math.round(duration / 1000)}秒`)
    console.log(`[MemoryMonitor] 采集次数: ${this.samplesCollected}`)
    console.log(`[MemoryMonitor] 告警次数: ${this.alertsTriggered}`)

    this.emit('stopped', { duration, samplesCollected: this.samplesCollected })
  }

  /**
   * 获取当前内存使用情况
   */
  getCurrentUsage(): MemoryUsage {
    const memUsage = process.memoryUsage()
    const heapStats = v8.getHeapStatistics()

    const usagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100

    return {
      timestamp: new Date().toISOString(),
      heap: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        limit: heapStats.heap_size_limit,
        usagePercent: Math.round(usagePercent * 100) / 100
      },
      rss: memUsage.rss,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers
    }
  }

  /**
   * 获取堆统计信息
   */
  getHeapStatistics(): HeapStatistics {
    const heapStats = v8.getHeapStatistics()
    const heapSpaces = v8.getHeapSpaceStatistics()

    return {
      timestamp: new Date().toISOString(),
      spaces: heapSpaces.map(space => ({
        name: space.space_name,
        size: space.space_size,
        usedSize: space.space_used_size,
        availableSize: space.space_available_size,
        physicalSize: space.physical_space_size
      })),
      totalHeapSize: heapStats.total_heap_size,
      totalHeapSizeExecutable: heapStats.total_heap_size_executable,
      usedHeapSize: heapStats.used_heap_size,
      heapSizeLimit: heapStats.heap_size_limit,
      mallocedMemory: heapStats.malloced_memory,
      peakMallocedMemory: heapStats.peak_malloced_memory,
      gcPauseRate: 0, // V8 12+ 不再提供此字段
      totalGcTime: 0 // V8 12+ 不再提供此字段
    }
  }

  /**
   * 创建内存快照
   */
  createSnapshot(label?: string): MemorySnapshot {
    const snapshot: MemorySnapshot = {
      id: `snapshot-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      timestamp: new Date().toISOString(),
      memory: this.getCurrentUsage(),
      heapStats: this.getHeapStatistics(),
      label
    }

    // 添加到快照列表
    this.snapshots.push(snapshot)

    // 限制快照数量
    if (this.snapshots.length > this.config.maxSnapshots) {
      this.snapshots = this.snapshots.slice(-this.config.maxSnapshots)
    }

    console.log(`[MemoryMonitor] 📸 创建内存快照: ${snapshot.id}`)
    if (label) {
      console.log(`[MemoryMonitor] 标签: ${label}`)
    }

    this.emit('snapshot', snapshot)
    return snapshot
  }

  /**
   * 获取所有快照
   */
  getSnapshots(): MemorySnapshot[] {
    return [...this.snapshots]
  }

  /**
   * 清空快照
   */
  clearSnapshots(): void {
    const count = this.snapshots.length
    this.snapshots = []
    console.log(`[MemoryMonitor] 已清空 ${count} 个快照`)
  }

  /**
   * 分析内存趋势
   */
  analyzeTrend(): MemoryTrendAnalysis {
    const now = Date.now()
    const windowStart = now - this.config.trendWindow

    // 过滤时间窗口内的数据
    const relevantData = this.trendData.filter(point =>
      new Date(point.timestamp).getTime() >= windowStart
    )

    if (relevantData.length < 2) {
      return {
        period: {
          start: relevantData[0]?.timestamp || new Date().toISOString(),
          end: new Date().toISOString()
        },
        dataPoints: relevantData.length,
        trend: 'stable',
        avgHeapUsed: 0,
        maxHeapUsed: 0,
        minHeapUsed: 0,
        avgRSS: 0,
        growthRate: 0,
        leakRisk: false
      }
    }

    // 计算统计数据
    const heapUsedValues = relevantData.map(d => d.heapUsed)
    const rssValues = relevantData.map(d => d.rss)

    const avgHeapUsed = this.average(heapUsedValues)
    const maxHeapUsed = Math.max(...heapUsedValues)
    const minHeapUsed = Math.min(...heapUsedValues)
    const avgRSS = this.average(rssValues)

    // 计算增长率 (bytes/分钟)
    const timeDiff = (new Date(relevantData[relevantData.length - 1].timestamp).getTime() -
                      new Date(relevantData[0].timestamp).getTime()) / 60000 // 分钟
    const heapGrowth = (relevantData[relevantData.length - 1].heapUsed - relevantData[0].heapUsed) / timeDiff

    // 判断趋势
    let trend: 'increasing' | 'stable' | 'decreasing' = 'stable'
    const growthRateMBPerMin = Math.abs(heapGrowth) / (1024 * 1024)

    if (heapGrowth > 1024 * 1024 && growthRateMBPerMin > 1) { // 每分钟增长超过 1MB
      trend = 'increasing'
    } else if (heapGrowth < -1024 * 1024 && growthRateMBPerMin > 1) {
      trend = 'decreasing'
    }

    // 检测泄漏风险
    let leakRisk = false
    let riskDetails: string | undefined

    if (this.config.enableLeakDetection) {
      // 检查持续增长
      if (trend === 'increasing' && growthRateMBPerMin > 2) {
        leakRisk = true
        riskDetails = `内存持续增长，增长率 ${growthRateMBPerMin.toFixed(2)} MB/分钟`
      }

      // 检查内存波动是否异常
      const variance = this.variance(heapUsedValues)
      const stdDev = Math.sqrt(variance)
      const avgMB = avgHeapUsed / (1024 * 1024)

      if (stdDev / avgHeapUsed > 0.3 && avgMB > 100) { // 波动超过30%且平均使用超过100MB
        leakRisk = true
        riskDetails = riskDetails
          ? `${riskDetails}；内存波动异常 (${((stdDev / avgHeapUsed) * 100).toFixed(1)}%)`
          : `内存波动异常 (${((stdDev / avgHeapUsed) * 100).toFixed(1)}%)`
      }
    }

    return {
      period: {
        start: relevantData[0].timestamp,
        end: relevantData[relevantData.length - 1].timestamp
      },
      dataPoints: relevantData.length,
      trend,
      avgHeapUsed,
      maxHeapUsed,
      minHeapUsed,
      avgRSS,
      growthRate: heapGrowth,
      leakRisk,
      riskDetails
    }
  }

  /**
   * 获取最近的告警
   */
  getAlerts(limit: number = 10): MemoryAlert[] {
    return this.alerts.slice(-limit)
  }

  /**
   * 清空告警
   */
  clearAlerts(): void {
    const count = this.alerts.length
    this.alerts = []
    console.log(`[MemoryMonitor] 已清空 ${count} 个告警`)
  }

  /**
   * 触发垃圾回收
   */
  forceGC(): void {
    if (global.gc) {
      console.log('[MemoryMonitor] 🗑️  触发垃圾回收')
      const before = this.getCurrentUsage()

      global.gc()

      const after = this.getCurrentUsage()
      const freed = before.heap.used - after.heap.used

      console.log(`[MemoryMonitor] GC 前堆内存: ${this.formatBytes(before.heap.used)}`)
      console.log(`[MemoryMonitor] GC 后堆内存: ${this.formatBytes(after.heap.used)}`)
      console.log(`[MemoryMonitor] 释放内存: ${this.formatBytes(freed)}`)

      this.emit('gc', { before, after, freed })
    } else {
      console.warn('[MemoryMonitor] ❌ GC 未启用。请使用 --expose-gc 参数启动应用')
    }
  }

  /**
   * 生成内存报告
   */
  generateReport(): MemoryReport {
    const currentUsage = this.getCurrentUsage()
    const trendAnalysis = this.analyzeTrend()
    const recentAlerts = this.getAlerts(5)

    // 生成建议
    const recommendations: string[] = []

    if (currentUsage.heap.usagePercent > this.config.warningThreshold) {
      recommendations.push('内存使用率较高，建议检查是否存在内存泄漏')
    }

    if (trendAnalysis.leakRisk) {
      recommendations.push(`检测到内存泄漏风险: ${trendAnalysis.riskDetails}`)
    }

    if (trendAnalysis.trend === 'increasing') {
      recommendations.push('内存呈增长趋势，建议定期监控或重启应用')
    }

    if (this.alerts.length > 10) {
      recommendations.push('告警次数较多，建议优化内存使用策略')
    }

    if (recommendations.length === 0) {
      recommendations.push('内存使用正常，继续保持监控')
    }

    return {
      generatedAt: new Date().toISOString(),
      monitoringDuration: this.isRunning ? Date.now() - this.startTime : 0,
      currentUsage,
      trendAnalysis,
      recentAlerts,
      snapshotCount: this.snapshots.length,
      recommendations
    }
  }

  /**
   * 获取监控状态
   */
  getStatus(): MemoryMonitorStatus {
    return {
      isMonitoring: this.isRunning,
      startTime: this.isRunning ? new Date(this.startTime).toISOString() : undefined,
      duration: this.isRunning ? Date.now() - this.startTime : undefined,
      samplesCollected: this.samplesCollected,
      alertsTriggered: this.alertsTriggered,
      lastSampleTime: this.trendData.length > 0
        ? this.trendData[this.trendData.length - 1].timestamp
        : undefined,
      lastMemoryUsage: this.trendData.length > 0
        ? this.getCurrentUsage()
        : undefined,
      config: this.config
    }
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<MemoryMonitorConfig>): void {
    this.config = { ...this.config, ...newConfig }
    console.log('[MemoryMonitor] 配置已更新:', newConfig)

    // 如果正在运行，重启监控以应用新间隔
    if (this.isRunning && newConfig.interval) {
      console.log('[MemoryMonitor] 重启监控以应用新间隔')
      this.stop()
      this.start()
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 采集内存数据
   */
  private collect(): void {
    const usage = this.getCurrentUsage()
    const heapStats = this.getHeapStatistics()

    // 记录趋势数据
    const trendPoint: MemoryTrendPoint = {
      timestamp: usage.timestamp,
      heapUsed: usage.heap.used,
      heapTotal: usage.heap.total,
      rss: usage.rss,
      external: usage.external
    }

    this.trendData.push(trendPoint)

    // 限制趋势数据点数量
    if (this.trendData.length > this.config.maxTrendPoints) {
      this.trendData = this.trendData.slice(-this.config.maxTrendPoints)
    }

    this.samplesCollected++

    // 检查告警
    this.checkAlerts(usage)

    // 自动 GC
    if (this.config.enableAutoGC && usage.heap.usagePercent >= this.config.autoGCThreshold) {
      console.log(`[MemoryMonitor] ⚠️ 内存使用率达到 ${usage.heap.usagePercent}%，触发自动 GC`)
      this.forceGC()
    }

    // 发出采集事件
    this.emit('sample', { usage, heapStats })
  }

  /**
   * 检查并触发告警
   */
  private checkAlerts(usage: MemoryUsage): void {
    const { usagePercent } = usage.heap

    let level: AlertLevel | null = null
    let message = ''

    if (usagePercent >= this.config.criticalThreshold) {
      level = 'critical'
      message = `内存使用严重: ${usagePercent.toFixed(1)}%`
    } else if (usagePercent >= this.config.warningThreshold) {
      level = 'warning'
      message = `内存使用警告: ${usagePercent.toFixed(1)}%`
    }

    if (level) {
      const alert: MemoryAlert = {
        id: `alert-${Date.now()}`,
        timestamp: new Date().toISOString(),
        level,
        message,
        currentUsage: usage,
        threshold: level === 'critical'
          ? this.config.criticalThreshold
          : this.config.warningThreshold,
        usagePercent,
        handled: false
      }

      this.alerts.push(alert)
      this.alertsTriggered++

      // 限制告警数量
      if (this.alerts.length > 100) {
        this.alerts = this.alerts.slice(-100)
      }

      // 控制台输出
      const icon = level === 'critical' ? '🔴' : '🟡'
      console.log(`[MemoryMonitor] ${icon} ${message}`)
      console.log(`[MemoryMonitor] 堆内存: ${this.formatBytes(usage.heap.used)} / ${this.formatBytes(usage.heap.total)}`)
      console.log(`[MemoryMonitor] RSS: ${this.formatBytes(usage.rss)}`)

      // 发出告警事件
      this.emit('alert', alert)
    }
  }

  /**
   * 计算平均值
   */
  private average(values: number[]): number {
    if (values.length === 0) return 0
    return values.reduce((sum, val) => sum + val, 0) / values.length
  }

  /**
   * 计算方差
   */
  private variance(values: number[]): number {
    if (values.length === 0) return 0
    const avg = this.average(values)
    return this.average(values.map(val => Math.pow(val - avg, 2)))
  }

  /**
   * 格式化字节数
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }
}

// ==================== 导出 ====================

export default MemoryMonitorService