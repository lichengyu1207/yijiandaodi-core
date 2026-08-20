# HTTP 日志拦截器设计补充

## 设计目标

在 HTTP 客户端基础上增加一个完整的请求日志拦截器，用于：
- 记录所有HTTP请求的详细信息
- 计算请求耗时和响应大小
- 支持不同的日志级别
- 提供请求追踪能力
- 方便调试和性能监控

---

## 1. 日志拦截器模块结构

```
src/services/http/
├── logging/
│   ├── RequestLogger.ts          # 核心日志记录器
│   ├── LogFormatter.ts           # 日志格式化器
│   ├── LogStorage.ts             # 日志存储器
│   └── logging.types.ts          # 日志类型定义
```

---

## 2. 核心日志记录器

### RequestLogger.ts

```typescript
import { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios'
import { LogFormatter } from './LogFormatter'
import { LogStorage } from './LogStorage'
import {
  RequestLog,
  ResponseLog,
  ErrorLog,
  LogConfig,
  LogLevel,
  RequestMetadata
} from './logging.types'

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
      logHeaders: false, // 默认不记录headers（可能包含敏感信息）
      maxBodyLength: 1000, // 最大记录的body长度
      storage: {
        enabled: true,
        maxSize: 1000, // 最大存储1000条日志
        persistToLocalStorage: false
      },
      performance: {
        warnThreshold: 3000, // 3秒以上警告
        errorThreshold: 10000 // 10秒以上错误
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
    if (level < this.config.level) return

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
          _preview: JSON.parse(jsonString.substring(0, this.config.maxBodyLength!) + '...')
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
```

---

## 3. 日志格式化器

### LogFormatter.ts

```typescript
import { RequestLog, ResponseLog, ErrorLog, LogConfig } from './logging.types'

export class LogFormatter {
  private config: LogConfig

  constructor(config: LogConfig) {
    this.config = config
  }

  /**
   * 格式化请求日志
   */
  formatRequest(log: RequestLog): string {
    const parts = [
      '🚀 [REQUEST]',
      `[${log.requestId}]`,
      `${log.method}`,
      log.url
    ]

    // 添加参数信息
    if (log.params) {
      parts.push(`\n  Params: ${JSON.stringify(log.params)}`)
    }

    // 添加请求体信息
    if (log.data) {
      parts.push(`\n  Data: ${JSON.stringify(log.data)}`)
    }

    // 添加时间戳
    parts.push(`\n  Time: ${log.timestamp}`)

    return parts.join(' ')
  }

  /**
   * 格式化响应日志
   */
  formatResponse(log: ResponseLog): string {
    const parts = [
      '✅ [RESPONSE]',
      `[${log.requestId}]`,
      `${log.method}`,
      log.url,
      `- Status: ${log.status}`,
      `- Duration: ${this.formatDuration(log.duration)}`,
      `- Size: ${this.formatSize(log.responseSize)}`
    ]

    // 添加响应体信息
    if (log.data) {
      parts.push(`\n  Response: ${JSON.stringify(log.data)}`)
    }

    // 添加时间戳
    parts.push(`\n  Time: ${log.timestamp}`)

    // 添加性能警告
    if (log.duration >= this.config.performance!.errorThreshold) {
      parts.push('\n  ⚠️  性能警告: 请求耗时过长!')
    } else if (log.duration >= this.config.performance!.warnThreshold) {
      parts.push('\n  ⚡ 性能提示: 请求耗时较长')
    }

    return parts.join(' ')
  }

  /**
   * 格式化错误日志
   */
  formatError(log: ErrorLog): string {
    const parts = [
      '❌ [ERROR]',
      `[${log.requestId}]`,
      `${log.method}`,
      log.url,
      `- Error: ${log.errorMessage}`
    ]

    // 添加错误代码
    if (log.errorCode) {
      parts.push(`- Code: ${log.errorCode}`)
    }

    // 添加状态码
    if (log.status) {
      parts.push(`- Status: ${log.status}`)
    }

    // 添加耗时
    parts.push(`- Duration: ${this.formatDuration(log.duration)}`)

    // 添加时间戳
    parts.push(`\n  Time: ${log.timestamp}`)

    // 添加错误堆栈
    if (log.errorStack) {
      parts.push(`\n  Stack: ${log.errorStack}`)
    }

    return parts.join(' ')
  }

  /**
   * 格式化耗时
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(2)}s`
    } else {
      return `${Math.floor(ms / 60000)}m ${((ms % 60000) / 1000).toFixed(0)}s`
    }
  }

  /**
   * 格式化大小
   */
  private formatSize(bytes: number): string {
    if (bytes === 0) return '0B'

    const units = ['B', 'KB', 'MB', 'GB']
    const k = 1024
    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return `${(bytes / Math.pow(k, i)).toFixed(2)}${units[i]}`
  }
}
```

---

## 4. 日志存储器

### LogStorage.ts

```typescript
import { RequestLog, ResponseLog, ErrorLog, StorageConfig } from './logging.types'

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
    if (this.logs.length > this.config.maxSize!) {
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
          log.duration !== undefined && log.duration >= filter.minDuration!
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
      avgDuration: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      maxDuration: durations.length > 0 ? Math.max(...durations) : 0,
      minDuration: durations.length > 0 ? Math.min(...durations) : 0,
      avgResponseSize: responseSizes.length > 0 ? responseSizes.reduce((a, b) => a + b, 0) / responseSizes.length : 0
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
```

---

## 5. 日志类型定义

### logging.types.ts

```typescript
/**
 * 日志级别
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

/**
 * 日志配置
 */
export interface LogConfig {
  enabled: boolean
  level: LogLevel
  logRequestBody: boolean
  logResponseBody: boolean
  logHeaders: boolean
  maxBodyLength: number
  storage?: StorageConfig
  performance?: PerformanceConfig
}

/**
 * 存储配置
 */
export interface StorageConfig {
  enabled: boolean
  maxSize: number
  persistToLocalStorage: boolean
}

/**
 * 性能配置
 */
export interface PerformanceConfig {
  warnThreshold: number  // 毫秒
  errorThreshold: number // 毫秒
}

/**
 * 请求元数据
 */
export interface RequestMetadata {
  requestId: string
  startTime: number
  method: string
  url: string
  baseURL?: string
  path: string
  params?: any
  data?: any
  headers?: any
  timestamp: string
}

/**
 * 请求日志
 */
export interface RequestLog extends RequestMetadata {
  type: 'request'
}

/**
 * 响应日志
 */
export interface ResponseLog {
  type: 'response'
  requestId: string
  method: string
  url: string
  status: number
  statusText: string
  duration: number
  responseSize: number
  data?: any
  headers?: any
  timestamp: string
}

/**
 * 错误日志
 */
export interface ErrorLog {
  type: 'error'
  requestId: string
  method: string
  url: string
  duration: number
  errorCode?: string
  errorMessage: string
  errorStack?: string
  status?: number
  statusText?: string
  data?: any
  timestamp: string
}
```

---

## 6. 集成到拦截器

### 修改后的 requestInterceptor.ts

```typescript
import { AxiosInstance } from 'axios'
import { TokenManager } from '../auth/TokenManager'
import { RequestLogger } from '../logging/RequestLogger'
import { HttpClientConfig } from '../types/http.types'

export function setupRequestInterceptors(
  client: AxiosInstance,
  tokenManager: TokenManager,
  requestLogger: RequestLogger,
  config: HttpClientConfig
): void {
  client.interceptors.request.use(
    async (axiosConfig) => {
      const requestId = axiosConfig.headers?.['X-Request-ID'] as string

      // 记录请求日志
      requestLogger.logRequest(axiosConfig)

      // 添加认证 Token（如果需要）
      if (!axiosConfig.skipAuth) {
        const token = await tokenManager.ensureValidToken()
        if (token) {
          axiosConfig.headers.Authorization = `Bearer ${token}`
        }
      }

      // 添加时间戳（防止缓存）
      if (axiosConfig.method === 'get') {
        axiosConfig.params = {
          ...axiosConfig.params,
          _t: Date.now()
        }
      }

      return axiosConfig
    },
    (error) => {
      console.error(`[RequestInterceptor] 请求拦截器错误:`, error)
      return Promise.reject(error)
    }
  )
}
```

### 修改后的 responseInterceptor.ts

```typescript
import { AxiosInstance } from 'axios'
import { TokenManager } from '../auth/TokenManager'
import { ErrorHandler } from '../error/ErrorHandler'
import { RequestLogger } from '../logging/RequestLogger'
import { HttpClientConfig } from '../types/http.types'

export function setupResponseInterceptors(
  client: AxiosInstance,
  tokenManager: TokenManager,
  errorHandler: ErrorHandler,
  requestLogger: RequestLogger,
  config: HttpClientConfig
): void {
  client.interceptors.response.use(
    (response) => {
      // 记录响应日志
      requestLogger.logResponse(response)

      return response
    },
    async (error) => {
      const requestId = error.config?.headers?.['X-Request-ID'] as string

      // 记录错误日志
      requestLogger.logError(error)

      // 处理 401 认证失败
      if (error.response?.status === 401) {
        console.warn(`[ResponseInterceptor] [${requestId}] 认证失败，清除 Token`)
        tokenManager.clearToken()
      }

      // 统一错误处理
      const httpError = errorHandler.handle(error, requestId)

      return Promise.reject(httpError)
    }
  )
}
```

---

## 7. 更新 HttpClient 类

### 修改后的 HttpClient.ts（部分）

```typescript
export class HttpClient {
  private client: AxiosInstance
  private tokenManager: TokenManager
  private errorHandler: ErrorHandler
  private retryPolicy: RetryPolicy
  private cancelManager: RequestCancelManager
  private requestLogger: RequestLogger  // 新增
  private config: HttpClientConfig

  constructor(config: HttpClientConfig) {
    this.config = config
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        ...config.defaultHeaders
      }
    })

    this.tokenManager = new TokenManager(config.auth)
    this.errorHandler = new ErrorHandler(config.errorHandling)
    this.retryPolicy = new RetryPolicy(config.retry)
    this.cancelManager = new RequestCancelManager()
    this.requestLogger = new RequestLogger(config.logging)  // 新增

    // 设置拦截器
    this.setupInterceptors()

    console.log(`[HttpClient] 初始化完成，baseURL: ${config.baseURL}`)
  }

  /**
   * 设置拦截器
   */
  private setupInterceptors(): void {
    // 请求拦截器：添加 Token、请求 ID、日志
    setupRequestInterceptors(this.client, this.tokenManager, this.requestLogger, this.config)

    // 响应拦截器：统一错误处理、Token 刷新、日志
    setupResponseInterceptors(this.client, this.tokenManager, this.errorHandler, this.requestLogger, this.config)
  }

  /**
   * 获取请求日志
   */
  getRequestLogs(filter?: {
    requestId?: string
    method?: string
    status?: number
    minDuration?: number
    startTime?: Date
    endTime?: Date
  }): Array<RequestLog | ResponseLog | ErrorLog> {
    return this.requestLogger.getStoredLogs(filter)
  }

  /**
   * 获取请求统计
   */
  getRequestStatistics(): {
    totalRequests: number
    successRequests: number
    failedRequests: number
    avgDuration: number
    maxDuration: number
    minDuration: number
    avgResponseSize: number
  } {
    return this.requestLogger.getStatistics()
  }

  /**
   * 清除请求日志
   */
  clearRequestLogs(): void {
    this.requestLogger.clearLogs()
  }
}
```

---

## 使用示例

```typescript
// 创建 HTTP 客户端（启用详细日志）
const httpClient = new HttpClient({
  baseURL: 'http://localhost:9092',
  timeout: 30000,
  logging: {
    enabled: true,
    level: LogLevel.INFO,
    logRequestBody: true,
    logResponseBody: true,
    logHeaders: false,
    maxBodyLength: 500,
    storage: {
      enabled: true,
      maxSize: 500,
      persistToLocalStorage: true
    },
    performance: {
      warnThreshold: 2000,
      errorThreshold: 5000
    }
  }
})

// 发起请求（自动记录日志）
const response = await httpClient.get('/api/v1/users')

// 查看日志
const logs = httpClient.getRequestLogs()
console.log('请求日志:', logs)

// 查看统计
const stats = httpClient.getRequestStatistics()
console.log('请求统计:', stats)

// 查找特定请求的日志
const userRequestLogs = httpClient.getRequestLogs({
  method: 'GET',
  minDuration: 1000  // 查找耗时超过1秒的请求
})
```

---

## 日志输出示例

### 请求日志
```
🚀 [REQUEST] [req_1691234567890_abc123] GET http://localhost:9092/api/v1/users
  Params: {"page": 1, "limit": 10}
  Time: 2026-08-12T08:15:30.123Z
```

### 响应日志（正常）
```
✅ [RESPONSE] [req_1691234567890_abc123] GET http://localhost:9092/api/v1/users - Status: 200 - Duration: 245ms - Size: 4.23KB
  Response: {"data": [...], "total": 100}
  Time: 2026-08-12T08:15:30.368Z
```

### 响应日志（性能警告）
```
✅ [RESPONSE] [req_1691234567890_def456] GET http://localhost:9092/api/v1/large-data - Status: 200 - Duration: 3.45s - Size: 1.2MB
  Response: {"data": [...], "truncated": true}
  Time: 2026-08-12T08:15:33.890Z
  ⚡ 性能提示: 请求耗时较长
```

### 错误日志
```
❌ [ERROR] [req_1691234567890_ghi789] POST http://localhost:9092/api/v1/upload - Error: Network Error - Code: ERR_NETWORK - Duration: 5002ms
  Time: 2026-08-12T08:15:35.892Z
  Stack: Error: Network Error
    at createError (http://localhost:9092/static/js/bundle.js:...)
```

---

## 总结

这个日志拦截器提供了：

1. **详细的请求记录**：方法、URL、参数、请求体
2. **完整的响应记录**：状态码、耗时、响应大小、响应体
3. **错误追踪**：错误代码、错误消息、错误堆栈
4. **性能监控**：自动标记慢请求，提供性能阈值配置
5. **数据脱敏**：自动隐藏敏感header信息，截断过大的body
6. **日志存储**：支持内存存储和localStorage持久化
7. **统计分析**：提供请求统计功能，方便监控和优化
8. **灵活配置**：支持多种配置选项，适应不同场景需求

日志拦截器已完全集成到 HTTP 客户端中，无需额外代码即可自动记录所有请求。