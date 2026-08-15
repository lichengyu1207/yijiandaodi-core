/**
 * 日志节流工具
 * 
 * 功能：
 * - 控制高频日志输出频率
 * - 避免日志刷屏
 * - 减少性能开销
 * 
 * 使用场景：
 * - 文件变动事件（高频）
 * - 哈希计算日志（高频）
 * - 其他高频操作
 * 
 * 作者：一鉴到底团队
 * 创建时间：2026-08-12
 */

/**
 * 节流配置
 */
interface ThrottleConfig {
  interval: number      // 节流间隔（毫秒）
  maxBufferSize: number // 最大缓冲大小（超过则强制输出）
  enableStats: boolean  // 是否启用统计
}

/**
 * 日志统计信息
 */
interface LogStats {
  totalCalls: number      // 总调用次数
  throttledCalls: number  // 被节流的次数
  actualOutputs: number   // 实际输出次数
  lastOutputTime: number  // 最后输出时间
}

/**
 * 节流日志记录器
 * 
 * 功能：
 * - 对相同key的日志进行节流
 * - 每个key在指定间隔内只输出一次
 * - 支持统计信息
 */
export class ThrottledLogger {
  private static lastLogTime: Map<string, number> = new Map()
  private static logBuffers: Map<string, string[]> = new Map()
  private static stats: Map<string, LogStats> = new Map()
  
  // 默认配置
  private static defaultConfig: ThrottleConfig = {
    interval: 1000,        // 1秒节流
    maxBufferSize: 100,    // 最大100条缓冲
    enableStats: true      // 启用统计
  }
  
  /**
   * 记录节流日志
   * 
   * @param key 日志键（用于节流标识）
   * @param message 日志消息
   * @param args 额外参数
   * @param config 节流配置
   */
  static log(
    key: string, 
    message: string, 
    args?: any[],
    config?: Partial<ThrottleConfig>
  ): void {
    const finalConfig = { ...this.defaultConfig, ...config }
    const now = Date.now()
    const lastTime = this.lastLogTime.get(key) || 0
    
    // 更新统计信息
    if (finalConfig.enableStats) {
      this.updateStats(key, 'totalCalls')
    }
    
    // 检查是否需要节流
    if (now - lastTime < finalConfig.interval) {
      // 节流：添加到缓冲区
      this.addToBuffer(key, message, args, finalConfig)
      
      if (finalConfig.enableStats) {
        this.updateStats(key, 'throttledCalls')
      }
      return
    }
    
    // 输出日志
    this.flushBuffer(key)
    this.outputLog(key, message, args, now, finalConfig)
  }
  
  /**
   * 强制输出（不受节流限制）
   * 用于关键错误和警告
   */
  static force(message: string, args?: any[]): void {
    console.log(message, ...(args || []))
  }
  
  /**
   * 强制输出警告（不受节流限制）
   */
  static forceWarn(message: string, args?: any[]): void {
    console.warn(message, ...(args || []))
  }
  
  /**
   * 强制输出错误（不受节流限制）
   */
  static forceError(message: string, args?: any[]): void {
    console.error(message, ...(args || []))
  }
  
  /**
   * 添加到缓冲区
   */
  private static addToBuffer(
    key: string, 
    message: string, 
    args?: any[],
    config: ThrottleConfig
  ): void {
    if (!this.logBuffers.has(key)) {
      this.logBuffers.set(key, [])
    }
    
    const buffer = this.logBuffers.get(key)!
    buffer.push(this.formatLogEntry(message, args))
    
    // 检查是否超过缓冲区大小
    if (buffer.length >= config.maxBufferSize) {
      this.flushBuffer(key)
    }
  }
  
  /**
   * 刷新缓冲区
   */
  private static flushBuffer(key: string): void {
    const buffer = this.logBuffers.get(key)
    
    if (buffer && buffer.length > 0) {
      const summary = `... 还有 ${buffer.length} 条同类日志被节流`
      console.log(`[${key}] ${summary}`)
      this.logBuffers.set(key, [])
    }
  }
  
  /**
   * 输出日志
   */
  private static outputLog(
    key: string,
    message: string,
    args?: any[],
    time: number,
    config: ThrottleConfig
  ): void {
    this.lastLogTime.set(key, time)
    
    console.log(message, ...(args || []))
    
    if (config.enableStats) {
      this.updateStats(key, 'actualOutputs')
      this.updateStats(key, 'lastOutputTime', time)
    }
  }
  
  /**
   * 格式化日志条目
   */
  private static formatLogEntry(message: string, args?: any[]): string {
    if (args && args.length > 0) {
      return `${message} ${args.map(a => 
        typeof a === 'object' ? JSON.stringify(a) : String(a)
      ).join(' ')}`
    }
    return message
  }
  
  /**
   * 更新统计信息
   */
  private static updateStats(
    key: string, 
    field: keyof LogStats, 
    value?: number
  ): void {
    if (!this.stats.has(key)) {
      this.stats.set(key, {
        totalCalls: 0,
        throttledCalls: 0,
        actualOutputs: 0,
        lastOutputTime: 0
      })
    }
    
    const stats = this.stats.get(key)!
    
    if (typeof value === 'number') {
      (stats as any)[field] = value
    } else {
      (stats as any)[field]++
    }
  }
  
  /**
   * 获取统计信息
   */
  static getStats(key?: string): Map<string, LogStats> | LogStats | undefined {
    if (key) {
      return this.stats.get(key)
    }
    return this.stats
  }
  
  /**
   * 重置统计信息
   */
  static resetStats(key?: string): void {
    if (key) {
      this.stats.delete(key)
      this.lastLogTime.delete(key)
      this.logBuffers.delete(key)
    } else {
      this.stats.clear()
      this.lastLogTime.clear()
      this.logBuffers.clear()
    }
  }
  
  /**
   * 打印统计报告
   */
  static report(): void {
    console.log('\n========== 日志节流统计报告 ==========')
    
    if (this.stats.size === 0) {
      console.log('暂无统计数据')
      return
    }
    
    for (const [key, stats] of this.stats) {
      const throttleRate = stats.totalCalls > 0 
        ? ((stats.throttledCalls / stats.totalCalls) * 100).toFixed(2)
        : '0.00'
      
      console.log(`\n[${key}]`)
      console.log(`  总调用次数: ${stats.totalCalls}`)
      console.log(`  被节流次数: ${stats.throttledCalls}`)
      console.log(`  实际输出次数: ${stats.actualOutputs}`)
      console.log(`  节流率: ${throttleRate}%`)
      console.log(`  最后输出: ${new Date(stats.lastOutputTime).toISOString()}`)
    }
    
    console.log('\n=====================================\n')
  }
}

/**
 * 预定义的日志键（用于 FileWatcher）
 */
export enum LogKey {
  FILE_CREATE = 'file-create',
  FILE_MODIFY = 'file-modify',
  FILE_DELETE = 'file-delete',
  HASH_CALCULATION = 'hash-calc',
  VERIFICATION = 'verification',
  CIRCUIT_BREAKER = 'circuit-breaker'
}

/**
 * 便捷方法：文件创建日志
 */
export function logFileCreate(filePath: string, stats: any, config: any): void {
  ThrottledLogger.log(
    LogKey.FILE_CREATE,
    `[File-Watcher] [节流] 文件创建: ${filePath}`,
    [{ size: stats.size, config: config.watch_name }]
  )
}

/**
 * 便捷方法：文件修改日志
 */
export function logFileModify(filePath: string, stats: any, config: any): void {
  ThrottledLogger.log(
    LogKey.FILE_MODIFY,
    `[File-Watcher] [节流] 文件修改: ${filePath}`,
    [{ size: stats.size, config: config.watch_name }]
  )
}

/**
 * 便捷方法：哈希计算日志
 */
export function logHashCalculation(filePath: string, duration: number): void {
  ThrottledLogger.log(
    LogKey.HASH_CALCULATION,
    `[File-Watcher] [节流] 哈希计算: ${filePath}`,
    [{ duration: `${duration}ms` }]
  )
}

/**
 * 便捷方法：错误日志（不受节流限制）
 */
export function logError(message: string, error: Error): void {
  ThrottledLogger.forceError(message, [error.message, error.stack])
}

/**
 * 便捷方法：警告日志（不受节流限制）
 */
export function logWarning(message: string, args?: any[]): void {
  ThrottledLogger.forceWarn(message, args)
}