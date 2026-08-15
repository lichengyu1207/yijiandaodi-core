import { RequestLog, ResponseLog, ErrorLog } from './logging.types'
import { LogConfig } from '../types/http.types'

/**
 * 日志格式化器
 */
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
    if (this.config.performance) {
      if (log.duration >= this.config.performance.errorThreshold) {
        parts.push('\n  ⚠️  性能警告: 请求耗时过长!')
      } else if (log.duration >= this.config.performance.warnThreshold) {
        parts.push('\n  ⚡ 性能提示: 请求耗时较长')
      }
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

    // 添加错误堆栈（仅DEBUG级别）
    if (log.errorStack && this.config.level === 0) { // LogLevel.DEBUG = 0
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