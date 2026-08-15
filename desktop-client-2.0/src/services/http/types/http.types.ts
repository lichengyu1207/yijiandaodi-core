import { AxiosRequestConfig } from 'axios'
import { CircuitBreakerConfig } from '../circuit-breaker/circuit.types'

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
 * 错误类型枚举
 */
export enum ErrorType {
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMIT = 'RATE_LIMIT',
  SERVER_ERROR = 'SERVER_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  REQUEST_ERROR = 'REQUEST_ERROR',
  RESPONSE_ERROR = 'RESPONSE_ERROR',
  CONFIG_ERROR = 'CONFIG_ERROR',
  UNKNOWN = 'UNKNOWN'
}

/**
 * HTTP 客户端配置
 */
export interface HttpClientConfig {
  baseURL: string
  timeout?: number
  defaultHeaders?: Record<string, string>
  logging?: LogConfig
  circuitBreaker?: CircuitBreakerConfig
  // 后续会添加更多配置
  // auth?: TokenManagerConfig
  // errorHandling?: ErrorHandlerConfig
  // retry?: RetryConfig
}

/**
 * HTTP 请求配置
 */
export interface HttpRequestConfig extends AxiosRequestConfig {
  cancelKey?: string
  skipAuth?: boolean
  skipRetry?: boolean
  metadata?: Record<string, any>
}

/**
 * HTTP 响应
 */
export interface HttpResponse<T = any> {
  data: T
  status: number
  statusText: string
  headers: Record<string, string>
  config: HttpRequestConfig
}

/**
 * HTTP 错误
 */
export interface HttpError {
  type: ErrorType
  message: string
  status?: number
  data?: any
  requestId: string
  timestamp: number
  originalError?: Error
  retryable?: boolean
}

/**
 * 日志配置
 */
export interface LogConfig {
  enabled?: boolean
  level?: LogLevel
  logRequestBody?: boolean
  logResponseBody?: boolean
  logHeaders?: boolean
  maxBodyLength?: number
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
 * 请求统计信息
 */
export interface RequestStats {
  totalRequests: number
  successRequests: number
  failedRequests: number
  avgResponseTime: number
  errorRate: number
}