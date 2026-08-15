import { LogConfig, StorageConfig, PerformanceConfig } from '../types/http.types'

/**
 * 日志级别（重新导出，方便使用）
 */
export { LogLevel } from '../types/http.types'

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

/**
 * 日志配置（重新导出，方便使用）
 */
export type { LogConfig, StorageConfig, PerformanceConfig }