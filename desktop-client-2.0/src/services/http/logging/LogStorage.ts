import { RequestLog, ResponseLog, ErrorLog, StorageConfig } from './logging.types'

/**
 * 日志存储器
 */
export class LogStorage {
  private logs: Array<RequestLog | ResponseLog | ErrorLog> = []
  private config: StorageConfig

  constructor(config: StorageConfig) {
    this.config = config

    // 如果配置了持久化，从localStorage加载
    if (config.persistToLocalStorage) {
      this.loadFromLocalStorage()
    }
  }

  /**
   * 存储日志
   */
  store(log: RequestLog | ResponseLog | ErrorLog): void {
    this.logs.push(log)

    // 限制日志数量
    if (this.logs.length > this.config.maxSize) {
      this.logs.shift()
    }

    // 如果配置了持久化，保存到localStorage
    if (this.config.persistToLocalStorage) {
      this.saveToLocalStorage()
    }
  }

  /**
   * 查询日志
   */
  query(filter?: {
    requestId?: string
    method?: string
    status?: number
    minDuration?: number
    startTime?: Date
    endTime?: Date
  }): Array<RequestLog | ResponseLog | ErrorLog> {
    let results = [...this.logs]

    // 应用过滤器
    if (filter) {
      if (filter.requestId) {
        results = results.filter(log => log.requestId === filter.requestId)
      }

      if (filter.method) {
        results = results.filter(log => log.method === filter.method)
      }

      if (filter.status) {
        results = results.filter(log =>
          log.type === 'response' && log.status === filter.status
        )
      }

      if (filter.minDuration) {
        results = results.filter(log =>
          (log.type === 'response' || log.type === 'error') &&
          log.duration !== undefined &&
          log.duration >= filter.minDuration!
        )
      }

      if (filter.startTime) {
        results = results.filter(log =>
          new Date(log.timestamp) >= filter.startTime!
        )
      }

      if (filter.endTime) {
        results = results.filter(log =>
          new Date(log.timestamp) <= filter.endTime!
        )
      }
    }

    return results
  }

  /**
   * 清除日志
   */
  clear(): void {
    this.logs = []

    if (this.config.persistToLocalStorage) {
      localStorage.removeItem('http_request_logs')
    }
  }

  /**
   * 获取统计信息
   */
  getStatistics(): {
    totalRequests: number
    successRequests: number
    failedRequests: number
    avgDuration: number
    maxDuration: number
    minDuration: number
    avgResponseSize: number
  } {
    const requests = this.logs.filter(log => log.type === 'request')
    const responses = this.logs.filter(log => log.type === 'response') as ResponseLog[]
    const errors = this.logs.filter(log => log.type === 'error') as ErrorLog[]

    const durations = [...responses, ...errors]
      .map(log => log.duration || 0)
      .filter(d => d > 0)

    const responseSizes = responses
      .map(log => log.responseSize || 0)
      .filter(s => s > 0)

    return {
      totalRequests: requests.length,
      successRequests: responses.length,
      failedRequests: errors.length,
      avgDuration: durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0,
      maxDuration: durations.length > 0 ? Math.max(...durations) : 0,
      minDuration: durations.length > 0 ? Math.min(...durations) : 0,
      avgResponseSize: responseSizes.length > 0
        ? responseSizes.reduce((a, b) => a + b, 0) / responseSizes.length
        : 0
    }
  }

  /**
   * 从localStorage加载日志
   */
  private loadFromLocalStorage(): void {
    try {
      const stored = localStorage.getItem('http_request_logs')
      if (stored) {
        this.logs = JSON.parse(stored)
      }
    } catch (error) {
      console.error('[LogStorage] 加载日志失败:', error)
    }
  }

  /**
   * 保存日志到localStorage
   */
  private saveToLocalStorage(): void {
    try {
      localStorage.setItem('http_request_logs', JSON.stringify(this.logs))
    } catch (error) {
      console.error('[LogStorage] 保存日志失败:', error)
    }
  }
}