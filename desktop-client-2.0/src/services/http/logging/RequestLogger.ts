import { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios'
import { LogFormatter } from './LogFormatter'
import { LogStorage } from './LogStorage'
import {
  RequestLog,
  ResponseLog,
  ErrorLog,
  RequestMetadata
} from './logging.types'
import { LogConfig, LogLevel } from '../types/http.types'

/**
 * 请求日志记录器
 */
export class RequestLogger {
  private formatter: LogFormatter
  private storage: LogStorage
  private config: LogConfig

  constructor(config?: Partial<LogConfig>) {
    this.config = {
      enabled: true,
      level: LogLevel.INFO,
      logRequestBody: true,
      logResponseBody: true,
      logHeaders: false,
      maxBodyLength: 1000,
      storage: {
        enabled: true,
        maxSize: 1000,
        persistToLocalStorage: false
      },
      performance: {
        warnThreshold: 3000,
        errorThreshold: 10000
      },
      ...config
    }

    this.formatter = new LogFormatter(this.config)
    this.storage = new LogStorage(this.config.storage!)

    console.log(`[RequestLogger] 初始化完成，日志级别: ${this.config.level}`)
  }

  /**
   * 记录请求开始
   */
  logRequest(config: AxiosRequestConfig): void {
    if (!this.config.enabled) return

    const requestId = this.generateRequestId(config)
    const startTime = Date.now()

    // 创建请求元数据
    const metadata: RequestMetadata = {
      requestId,
      startTime,
      method: config.method?.toUpperCase() || 'GET',
      url: this.getFullUrl(config),
      baseURL: config.baseURL,
      path: config.url || '',
      params: this.config.logRequestBody ? this.sanitizeData(config.params) : undefined,
      data: this.config.logRequestBody ? this.sanitizeData(config.data) : undefined,
      headers: this.config.logHeaders ? this.sanitizeHeaders(config.headers) : undefined,
      timestamp: new Date().toISOString()
    }

    // 存储请求元数据（用于后续计算耗时）
    config.metadata = metadata

    // 记录请求日志
    const logEntry: RequestLog = {
      type: 'request',
      ...metadata
    }

    // 格式化并输出日志
    const formattedLog = this.formatter.formatRequest(logEntry)
    this.log(formattedLog, LogLevel.DEBUG)

    // 存储日志
    if (this.config.storage!.enabled) {
      this.storage.store(logEntry)
    }
  }

  /**
   * 记录响应成功
   */
  logResponse(response: AxiosResponse): void {
    if (!this.config.enabled) return

    const metadata = response.config.metadata as RequestMetadata
    if (!metadata) return

    const endTime = Date.now()
    const duration = endTime - metadata.startTime
    const responseSize = this.calculateResponseSize(response)

    // 创建响应日志
    const logEntry: ResponseLog = {
      type: 'response',
      requestId: metadata.requestId,
      method: metadata.method,
      url: metadata.url,
      status: response.status,
      statusText: response.statusText,
      duration,
      responseSize,
      data: this.config.logResponseBody ? this.sanitizeData(response.data) : undefined,
      headers: this.config.logHeaders ? this.sanitizeHeaders(response.headers) : undefined,
      timestamp: new Date().toISOString()
    }

    // 性能警告
    const logLevel = this.getLogLevelByDuration(duration)

    // 格式化并输出日志
    const formattedLog = this.formatter.formatResponse(logEntry)
    this.log(formattedLog, logLevel)

    // 存储日志
    if (this.config.storage!.enabled) {
      this.storage.store(logEntry)
    }
  }

  /**
   * 记录请求错误
   */
  logError(error: AxiosError): void {
    if (!this.config.enabled) return

    const metadata = error.config?.metadata as RequestMetadata
    if (!metadata) return

    const endTime = Date.now()
    const duration = endTime - metadata.startTime

    // 创建错误日志
    const logEntry: ErrorLog = {
      type: 'error',
      requestId: metadata.requestId,
      method: metadata.method,
      url: metadata.url,
      duration,
      errorCode: error.code,
      errorMessage: error.message,
      errorStack: error.stack,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      timestamp: new Date().toISOString()
    }

    // 格式化并输出日志
    const formattedLog = this.formatter.formatError(logEntry)
    this.log(formattedLog, LogLevel.ERROR)

    // 存储日志
    if (this.config.storage!.enabled) {
      this.storage.store(logEntry)
    }
  }

  /**
   * 根据耗时确定日志级别
   */
  private getLogLevelByDuration(duration: number): LogLevel {
    if (duration >= this.config.performance!.errorThreshold) {
      return LogLevel.ERROR
    }
    if (duration >= this.config.performance!.warnThreshold) {
      return LogLevel.WARN
    }
    return LogLevel.INFO
  }

  /**
   * 输出日志
   */
  private log(message: string, level: LogLevel): void {
    if (level < this.config.level!) return

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(message)
        break
      case LogLevel.INFO:
        console.log(message)
        break
      case LogLevel.WARN:
        console.warn(message)
        break
      case LogLevel.ERROR:
        console.error(message)
        break
    }
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(config: AxiosRequestConfig): string {
    const existingId = config.headers?.['X-Request-ID'] as string
    if (existingId) return existingId

    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * 获取完整URL
   */
  private getFullUrl(config: AxiosRequestConfig): string {
    const baseURL = config.baseURL || ''
    const url = config.url || ''

    if (url.startsWith('http')) {
      return url
    }

    return `${baseURL}${url}`
  }

  /**
   * 数据脱敏
   */
  private sanitizeData(data: any): any {
    if (!data) return data

    // 如果是字符串，截断长度
    if (typeof data === 'string') {
      return data.length > this.config.maxBodyLength!
        ? `${data.substring(0, this.config.maxBodyLength!)}... [截断，总长度: ${data.length}]`
        : data
    }

    // 如果是对象，序列化后处理
    try {
      const jsonString = JSON.stringify(data)
      if (jsonString.length > this.config.maxBodyLength!) {
        return {
          _truncated: true,
          _length: jsonString.length,
          _preview: '数据过长，已截断'
        }
      }
      return data
    } catch {
      return '[无法序列化的数据]'
    }
  }

  /**
   * Headers脱敏（隐藏敏感信息）
   */
  private sanitizeHeaders(headers: any): any {
    if (!headers) return headers

    const sanitized = { ...headers }
    const sensitiveKeys = ['authorization', 'token', 'password', 'apikey', 'api-key']

    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]'
      }
    }

    return sanitized
  }

  /**
   * 计算响应大小
   */
  private calculateResponseSize(response: AxiosResponse): number {
    try {
      const contentLength = response.headers?.['content-length']
      if (contentLength) {
        return parseInt(contentLength, 10)
      }

      // 如果没有content-length，估算大小
      const data = response.data
      if (typeof data === 'string') {
        return data.length
      }

      if (typeof data === 'object') {
        return JSON.stringify(data).length
      }

      return 0
    } catch {
      return 0
    }
  }

  /**
   * 获取存储的日志
   */
  getStoredLogs(filter?: {
    requestId?: string
    method?: string
    status?: number
    minDuration?: number
    startTime?: Date
    endTime?: Date
  }): Array<RequestLog | ResponseLog | ErrorLog> {
    return this.storage.query(filter)
  }

  /**
   * 清除存储的日志
   */
  clearLogs(): void {
    this.storage.clear()
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
    return this.storage.getStatistics()
  }
}