/**
 * ErrorMonitor - 错误监控系统（简化版）
 * 
 * 注意：Sentry 需要在生产环境中配置
 */

// import * as Sentry from '@sentry/electron'

// 简化的类型定义
export type ErrorLevel = 'fatal' | 'error' | 'warning' | 'info' | 'debug'
export type ErrorType = 'uncaught_exception' | 'unhandled_rejection' | 'renderer_error' | 'api_error'

export interface ErrorContext {
  type: ErrorType
  level: ErrorLevel
  process: 'main' | 'renderer'
  timestamp: number
  message: string
}

export interface ErrorMonitorConfig {
  dsn?: string
  appName: string
  appVersion: string
  isDevelopment: boolean
}

/**
 * 错误监控器类（简化版）
 */
export class ErrorMonitor {
  private config: ErrorMonitorConfig
  private isInitialized = false

  constructor(config: ErrorMonitorConfig) {
    this.config = config
  }

  /**
   * 初始化错误监控
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      // TODO: 配置 Sentry
      // if (this.config.dsn) {
      //   Sentry.init({
      //     dsn: this.config.dsn,
      //     environment: this.config.isDevelopment ? 'development' : 'production'
      //   })
      // }

      // 设置全局错误处理
      this.setupGlobalHandlers()

      this.isInitialized = true
      console.log('[ErrorMonitor] 错误监控系统已初始化')
    } catch (error) {
      console.error('[ErrorMonitor] 初始化失败:', error)
    }
  }

  /**
   * 设置全局错误处理
   */
  private setupGlobalHandlers(): void {
    // 主进程未捕获异常
    process.on('uncaughtException', (error) => {
      console.error('[ErrorMonitor] 未捕获异常:', error)
      this.handleError({
        type: 'uncaught_exception',
        level: 'fatal',
        process: 'main',
        timestamp: Date.now(),
        message: error.message
      })
    })

    // 未处理的 Promise 拒绝
    process.on('unhandledRejection', (reason) => {
      console.error('[ErrorMonitor] 未处理的 Promise 拒绝:', reason)
      this.handleError({
        type: 'unhandled_rejection',
        level: 'error',
        process: 'main',
        timestamp: Date.now(),
        message: String(reason)
      })
    })
  }

  /**
   * 处理错误
   */
  private handleError(error: ErrorContext): void {
    // 记录到本地日志
    console.error('[ErrorMonitor] 错误详情:', error)
  }

  /**
   * 手动上报错误
   */
  reportError(error: Error, context?: Record<string, any>): void {
    this.handleError({
      type: 'api_error',
      level: 'error',
      process: 'main',
      timestamp: Date.now(),
      message: error.message
    })
  }
}

export default ErrorMonitor