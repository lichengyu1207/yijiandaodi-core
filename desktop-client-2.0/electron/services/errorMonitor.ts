/**
 * ErrorMonitor - 错误监控系统
 *
 * 功能：
 * - Sentry SDK 集成
 * - 全局错误边界（主进程 + 渲染进程）
 * - 未捕获异常处理
 * - Promise 拒绝处理
 * - 错误上下文收集
 * - 错误自动上报
 * - 错误恢复策略
 * - 用户友好错误提示
 */

import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { captureException, captureMessage, init, Scope, withScope, addBreadcrumb } from '@sentry/electron'
import { ElectronMainOptions } from '@sentry/electron/main'
import type { Breadcrumb, BreadcrumbHint, CaptureContext } from '@sentry/types'

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 错误级别
 */
export type ErrorLevel = 'fatal' | 'error' | 'warning' | 'info' | 'debug'

/**
 * 错误类型
 */
export type ErrorType =
  | 'uncaught_exception'
  | 'unhandled_rejection'
  | 'renderer_error'
  | 'api_error'
  | 'network_error'
  | 'file_error'
  | 'validation_error'
  | 'business_error'

/**
 * 错误上下文信息
 */
export interface ErrorContext {
  /** 错误类型 */
  type: ErrorType
  /** 错误级别 */
  level: ErrorLevel
  /** 错误来源（主进程/渲染进程） */
  process: 'main' | 'renderer'
  /** 时间戳 */
  timestamp: number
  /** 用户 ID（如果有） */
  userId?: string
  /** 设备信息 */
  device?: {
    platform: string
    arch: string
    version: string
  }
  /** 应用信息 */
  app?: {
    version: string
    name: string
    environment: 'development' | 'production'
  }
  /** 自定义标签 */
  tags?: Record<string, string>
  /** 自定义数据 */
  extra?: Record<string, any>
  /** 堆栈信息 */
  stack?: string
  /** 错误消息 */
  message: string
  /** 原始错误 */
  originalError?: Error | unknown
}

/**
 * 错误恢复策略
 */
export type RecoveryStrategy =
  | 'ignore'          // 忽略错误
  | 'log'             // 仅记录日志
  | 'report'          // 上报错误
  | 'notify'          // 通知用户
  | 'restart'         // 重启应用
  | 'restart_window'  // 重启窗口
  | 'fallback'        // 使用降级方案

/**
 * 错误恢复配置
 */
export interface RecoveryConfig {
  /** 策略类型 */
  strategy: RecoveryStrategy
  /** 最大重试次数 */
  maxRetries?: number
  /** 重试延迟（毫秒） */
  retryDelay?: number
  /** 降级处理函数 */
  fallback?: () => void
  /** 自定义错误消息 */
  customMessage?: string
}

/**
 * 错误上报配置
 */
export interface ReportingConfig {
  /** 是否启用上报 */
  enabled: boolean
  /** 采样率（0-1） */
  sampleRate: number
  /** 上报前的过滤函数 */
  beforeSend?: (error: ErrorContext) => boolean
  /** 需要忽略的错误模式 */
  ignorePatterns?: (string | RegExp)[]
  /** 环境标识 */
  environment: 'development' | 'production' | 'test'
  /** 用户信息 */
  user?: {
    id?: string
    email?: string
    username?: string
  }
}

/**
 * 错误监控配置
 */
export interface ErrorMonitorConfig {
  /** Sentry DSN */
  dsn?: string
  /** 应用名称 */
  appName: string
  /** 应用版本 */
  appVersion: string
  /** 是否开发模式 */
  isDevelopment: boolean
  /** 错误上报配置 */
  reporting: ReportingConfig
  /** 是否显示用户友好提示 */
  showUserFriendlyMessages: boolean
  /** 是否启用面包屑追踪 */
  enableBreadcrumbs: boolean
  /** 面包屑最大数量 */
  maxBreadcrumbs: number
  /** 错误恢复策略映射 */
  recoveryStrategies?: Partial<Record<ErrorType, RecoveryConfig>>
}

/**
 * 错误事件
 */
export interface ErrorEvent {
  /** 错误 ID */
  id: string
  /** 错误上下文 */
  context: ErrorContext
  /** 是否已上报 */
  reported: boolean
  /** 是否已恢复 */
  recovered: boolean
  /** 处理结果 */
  result?: {
    strategy: RecoveryStrategy
    success: boolean
    message?: string
  }
}

/**
 * 错误统计
 */
export interface ErrorStats {
  /** 总错误数 */
  total: number
  /** 按类型统计 */
  byType: Record<ErrorType, number>
  /** 按级别统计 */
  byLevel: Record<ErrorLevel, number>
  /** 最近错误 */
  recentErrors: ErrorEvent[]
  /** 上报成功率 */
  reportSuccessRate: number
}

// ============================================================================
// 默认配置
// ============================================================================

const DEFAULT_CONFIG: Partial<ErrorMonitorConfig> = {
  isDevelopment: !app.isPackaged,
  reporting: {
    enabled: true,
    sampleRate: 1.0,
    environment: app.isPackaged ? 'production' : 'development',
    ignorePatterns: [
      'Network request failed',
      'Failed to fetch',
      'ResizeObserver',
      'Non-Error promise rejection captured'
    ]
  },
  showUserFriendlyMessages: true,
  enableBreadcrumbs: true,
  maxBreadcrumbs: 100,
  recoveryStrategies: {
    uncaught_exception: { strategy: 'restart', maxRetries: 1 },
    unhandled_rejection: { strategy: 'report', maxRetries: 2 },
    renderer_error: { strategy: 'restart_window', maxRetries: 3, retryDelay: 1000 },
    api_error: { strategy: 'fallback', maxRetries: 3, retryDelay: 2000 },
    network_error: { strategy: 'fallback', maxRetries: 5, retryDelay: 3000 },
    file_error: { strategy: 'notify', maxRetries: 2 },
    validation_error: { strategy: 'log', maxRetries: 0 },
    business_error: { strategy: 'notify', maxRetries: 1 }
  }
}

// ============================================================================
// ErrorMonitor 类
// ============================================================================

/**
 * 错误监控服务
 */
export class ErrorMonitor {
  private config: ErrorMonitorConfig
  private errorHistory: ErrorEvent[] = []
  private stats: ErrorStats = {
    total: 0,
    byType: {} as any,
    byLevel: {} as any,
    recentErrors: [],
    reportSuccessRate: 1.0
  }
  private isInitialized = false
  private mainWindow: BrowserWindow | null = null
  private retryCount = new Map<string, number>()

  constructor(config: ErrorMonitorConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config } as ErrorMonitorConfig
    this.initializeStats()
  }

  /**
   * 初始化错误监控
   */
  initialize(): void {
    if (this.isInitialized) {
      console.warn('[ErrorMonitor] 已经初始化')
      return
    }

    console.log('[ErrorMonitor] 初始化错误监控系统...')

    // 1. 初始化 Sentry
    this.initializeSentry()

    // 2. 注册全局错误处理器
    this.registerGlobalHandlers()

    // 3. 注册 IPC 处理器（用于渲染进程）
    this.registerIPCHandlers()

    this.isInitialized = true
    console.log('[ErrorMonitor] ✅ 错误监控系统初始化完成')
  }

  /**
   * 设置主窗口引用（用于错误恢复）
   */
  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window
  }

  /**
   * 手动上报错误
   */
  reportError(error: Error | string, context?: Partial<ErrorContext>): string {
    const errorId = this.generateErrorId()
    const errorContext = this.buildErrorContext(error, context)

    const event: ErrorEvent = {
      id: errorId,
      context: errorContext,
      reported: false,
      recovered: false
    }

    this.addToHistory(event)
    this.processError(event)

    return errorId
  }

  /**
   * 添加面包屑（用于错误追踪）
   */
  addBreadcrumb(breadcrumb: Omit<Breadcrumb, 'timestamp'>): void {
    if (!this.config.enableBreadcrumbs) return

    addBreadcrumb({
      ...breadcrumb,
      timestamp: Date.now() / 1000
    })
  }

  /**
   * 设置用户上下文
   */
  setUser(user: { id?: string; email?: string; username?: string }): void {
    withScope((scope: Scope) => {
      scope.setUser({
        id: user.id,
        email: user.email,
        username: user.username
      })
    })
  }

  /**
   * 设置自定义标签
   */
  setTag(key: string, value: string): void {
    withScope((scope: Scope) => {
      scope.setTag(key, value)
    })
  }

  /**
   * 设置额外数据
   */
  setExtra(key: string, value: any): void {
    withScope((scope: Scope) => {
      scope.setExtra(key, value)
    })
  }

  /**
   * 获取错误统计
   */
  getStats(): ErrorStats {
    return { ...this.stats }
  }

  /**
   * 获取错误历史
   */
  getErrorHistory(limit?: number): ErrorEvent[] {
    return limit ? this.errorHistory.slice(-limit) : [...this.errorHistory]
  }

  /**
   * 清空错误历史
   */
  clearHistory(): void {
    this.errorHistory = []
    this.initializeStats()
  }

  // ============================================================================
  // 私有方法
  // ============================================================================

  /**
   * 初始化 Sentry SDK
   */
  private initializeSentry(): void {
    if (!this.config.dsn) {
      console.warn('[ErrorMonitor] 未配置 Sentry DSN，错误上报功能已禁用')
      return
    }

    const sentryOptions: ElectronMainOptions = {
      dsn: this.config.dsn,
      environment: this.config.reporting.environment,
      release: `${this.config.appName}@${this.config.appVersion}`,
      sampleRate: this.config.reporting.sampleRate,
      maxBreadcrumbs: this.config.maxBreadcrumbs,

      // 主进程集成
      integrations: [
        // Sentry 会自动添加 Electron 相关集成
      ],

      // 上报前过滤
      beforeSend: (event, hint) => {
        // 检查是否应该忽略此错误
        if (this.shouldIgnoreError(event)) {
          return null
        }

        // 添加自定义上下文
        event.tags = {
          ...event.tags,
          app_name: this.config.appName,
          app_version: this.config.appVersion,
          process_type: 'main'
        }

        return event
      },

      // 面包屑过滤
      beforeBreadcrumb: (breadcrumb: Breadcrumb, hint?: BreadcrumbHint) => {
        // 过滤掉敏感信息
        if (breadcrumb.category === 'http') {
          // 移除请求体中的敏感数据
          if (breadcrumb.data) {
            breadcrumb.data = {
              ...breadcrumb.data,
              body: '[REDACTED]'
            }
          }
        }
        return breadcrumb
      }
    }

    try {
      init(sentryOptions)
      console.log('[ErrorMonitor] ✅ Sentry SDK 初始化成功')
    } catch (error) {
      console.error('[ErrorMonitor] ❌ Sentry SDK 初始化失败:', error)
    }
  }

  /**
   * 注册全局错误处理器
   */
  private registerGlobalHandlers(): void {
    // 1. 未捕获异常
    process.on('uncaughtException', (error: Error) => {
      this.handleUncaughtException(error)
    })

    // 2. 未处理的 Promise 拒绝
    process.on('unhandledRejection', (reason: unknown, promise: Promise<any>) => {
      this.handleUnhandledRejection(reason)
    })

    // 3. 多次监听器警告（可选）
    process.on('warning', (warning: Error) => {
      this.handleWarning(warning)
    })

    console.log('[ErrorMonitor] ✅ 全局错误处理器已注册')
  }

  /**
   * 注册 IPC 处理器（用于渲染进程）
   */
  private registerIPCHandlers(): void {
    // 渲染进程错误上报
    ipcMain.handle('error-monitor:report', async (event, error, context) => {
      const errorId = this.reportError(error, {
        ...context,
        process: 'renderer'
      })
      return { success: true, errorId }
    })

    // 渲染进程面包屑上报
    ipcMain.handle('error-monitor:breadcrumb', async (event, breadcrumb) => {
      this.addBreadcrumb(breadcrumb)
      return { success: true }
    })

    // 渲染进程请求错误统计
    ipcMain.handle('error-monitor:stats', async () => {
      return this.getStats()
    })

    console.log('[ErrorMonitor] ✅ IPC 处理器已注册')
  }

  /**
   * 处理未捕获异常
   */
  private handleUncaughtException(error: Error): void {
    console.error('[ErrorMonitor] 未捕获异常:', error)

    const errorId = this.reportError(error, {
      type: 'uncaught_exception',
      level: 'fatal',
      process: 'main',
      message: error.message,
      stack: error.stack
    })

    // 执行恢复策略
    this.executeRecoveryStrategy(errorId, 'uncaught_exception')

    // 显示用户友好提示
    if (this.config.showUserFriendlyMessages) {
      this.showUserFriendlyError(error)
    }
  }

  /**
   * 处理未处理的 Promise 拒绝
   */
  private handleUnhandledRejection(reason: unknown): void {
    console.error('[ErrorMonitor] 未处理的 Promise 拒绝:', reason)

    const error = reason instanceof Error ? reason : new Error(String(reason))

    const errorId = this.reportError(error, {
      type: 'unhandled_rejection',
      level: 'error',
      process: 'main',
      message: error.message,
      stack: error.stack
    })

    // 执行恢复策略
    this.executeRecoveryStrategy(errorId, 'unhandled_rejection')
  }

  /**
   * 处理警告
   */
  private handleWarning(warning: Error): void {
    this.addBreadcrumb({
      level: 'warning',
      category: 'process',
      message: warning.message,
      data: { stack: warning.stack }
    })
  }

  /**
   * 构建错误上下文
   */
  private buildErrorContext(error: Error | string, context?: Partial<ErrorContext>): ErrorContext {
    const errorObj = typeof error === 'string' ? new Error(error) : error

    return {
      type: context?.type || 'uncaught_exception',
      level: context?.level || 'error',
      process: context?.process || 'main',
      timestamp: Date.now(),
      message: errorObj.message,
      stack: errorObj.stack,
      device: {
        platform: process.platform,
        arch: process.arch,
        version: process.version
      },
      app: {
        version: this.config.appVersion,
        name: this.config.appName,
        environment: this.config.isDevelopment ? 'development' : 'production'
      },
      tags: context?.tags || {},
      extra: context?.extra || {},
      originalError: errorObj,
      ...context
    }
  }

  /**
   * 处理错误事件
   */
  private processError(event: ErrorEvent): void {
    // 更新统计
    this.updateStats(event)

    // 判断是否需要上报
    if (this.shouldReport(event)) {
      this.reportToSentry(event)
      event.reported = true
    }

    // 添加到历史
    this.addToHistory(event)
  }

  /**
   * 上报到 Sentry
   */
  private reportToSentry(event: ErrorEvent): void {
    if (!this.config.dsn || !this.config.reporting.enabled) {
      return
    }

    try {
      const { context } = event
      const error = context.originalError instanceof Error
        ? context.originalError
        : new Error(context.message)

      // 使用 Sentry 的 captureException
      captureException(error, {
        level: context.level,
        tags: {
          error_type: context.type,
          process_type: context.process,
          ...context.tags
        },
        extra: context.extra,
        user: this.config.reporting.user
      })

      console.log(`[ErrorMonitor] 已上报错误: ${event.id}`)
    } catch (err) {
      console.error('[ErrorMonitor] 上报错误失败:', err)
    }
  }

  /**
   * 执行恢复策略
   */
  private executeRecoveryStrategy(errorId: string, errorType: ErrorType): void {
    const config = this.config.recoveryStrategies?.[errorType]
    if (!config) {
      console.log(`[ErrorMonitor] 未配置恢复策略: ${errorType}`)
      return
    }

    const { strategy, maxRetries = 0, retryDelay = 1000, fallback, customMessage } = config

    // 检查重试次数
    const currentRetries = this.retryCount.get(errorId) || 0
    if (maxRetries > 0 && currentRetries >= maxRetries) {
      console.log(`[ErrorMonitor] 已达最大重试次数: ${errorId}`)
      return
    }

    console.log(`[ErrorMonitor] 执行恢复策略: ${strategy}`)

    // 更新重试计数
    this.retryCount.set(errorId, currentRetries + 1)

    switch (strategy) {
      case 'ignore':
        // 忽略错误
        break

      case 'log':
        // 仅记录日志（已在前面完成）
        break

      case 'report':
        // 已上报
        break

      case 'notify':
        // 通知用户
        this.notifyUser(customMessage || '应用遇到错误，请检查日志')
        break

      case 'restart_window':
        // 重启窗口
        setTimeout(() => {
          this.restartMainWindow()
        }, retryDelay)
        break

      case 'restart':
        // 重启应用
        setTimeout(() => {
          app.relaunch()
          app.quit()
        }, retryDelay)
        break

      case 'fallback':
        // 执行降级方案
        if (fallback) {
          setTimeout(() => {
            fallback()
          }, retryDelay)
        }
        break
    }
  }

  /**
   * 显示用户友好错误提示
   */
  private showUserFriendlyError(error: Error): void {
    const message = this.getUserFriendlyMessage(error)

    dialog.showErrorBox(
      message.title,
      message.content
    )
  }

  /**
   * 获取用户友好的错误消息
   */
  private getUserFriendlyMessage(error: Error): { title: string; content: string } {
    // 根据错误类型返回不同的提示
    if (error.message.includes('ENOENT')) {
      return {
        title: '文件未找到',
        content: '应用所需的文件不存在，请尝试重新安装。'
      }
    }

    if (error.message.includes('EACCES')) {
      return {
        title: '权限不足',
        content: '应用缺少必要的权限，请检查文件访问权限。'
      }
    }

    if (error.message.includes('Network') || error.message.includes('fetch')) {
      return {
        title: '网络错误',
        content: '网络连接失败，请检查网络设置后重试。'
      }
    }

    // 默认提示
    return {
      title: '应用遇到错误',
      content: `应用遇到了一个错误：${error.message}\n\n错误已记录，如问题持续请联系支持。`
    }
  }

  /**
   * 通知用户
   */
  private notifyUser(message: string): void {
    dialog.showMessageBox(this.mainWindow!, {
      type: 'error',
      title: '错误提示',
      message: message,
      buttons: ['确定']
    }).catch(() => {
      // 忽略对话框错误
    })
  }

  /**
   * 重启主窗口
   */
  private restartMainWindow(): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      console.log('[ErrorMonitor] 主窗口不存在，无法重启')
      return
    }

    try {
      // 重新加载页面
      this.mainWindow.reload()
      console.log('[ErrorMonitor] ✅ 主窗口已重启')
    } catch (error) {
      console.error('[ErrorMonitor] ❌ 主窗口重启失败:', error)
    }
  }

  /**
   * 判断是否应该忽略错误
   */
  private shouldIgnoreError(event: any): boolean {
    if (!this.config.reporting.ignorePatterns) return false

    const message = event.message || event.exception?.values?.[0]?.value || ''
    return this.config.reporting.ignorePatterns.some(pattern => {
      if (typeof pattern === 'string') {
        return message.includes(pattern)
      }
      return pattern.test(message)
    })
  }

  /**
   * 判断是否应该上报
   */
  private shouldReport(event: ErrorEvent): boolean {
    if (!this.config.reporting.enabled) return false

    // 检查采样率
    if (Math.random() > this.config.reporting.sampleRate) {
      return false
    }

    // 使用自定义过滤函数
    if (this.config.reporting.beforeSend) {
      return this.config.reporting.beforeSend(event.context)
    }

    return true
  }

  /**
   * 生成错误 ID
   */
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 添加到历史记录
   */
  private addToHistory(event: ErrorEvent): void {
    this.errorHistory.push(event)

    // 限制历史记录大小
    if (this.errorHistory.length > 1000) {
      this.errorHistory = this.errorHistory.slice(-500)
    }
  }

  /**
   * 更新统计信息
   */
  private updateStats(event: ErrorEvent): void {
    const { type, level } = event.context

    this.stats.total++

    // 按类型统计
    this.stats.byType[type] = (this.stats.byType[type] || 0) + 1

    // 按级别统计
    this.stats.byLevel[level] = (this.stats.byLevel[level] || 0) + 1

    // 最近错误（保留 50 条）
    this.stats.recentErrors = this.errorHistory.slice(-50)
  }

  /**
   * 初始化统计信息
   */
  private initializeStats(): void {
    this.stats = {
      total: 0,
      byType: {
        uncaught_exception: 0,
        unhandled_rejection: 0,
        renderer_error: 0,
        api_error: 0,
        network_error: 0,
        file_error: 0,
        validation_error: 0,
        business_error: 0
      },
      byLevel: {
        fatal: 0,
        error: 0,
        warning: 0,
        info: 0,
        debug: 0
      },
      recentErrors: [],
      reportSuccessRate: 1.0
    }
  }
}

// ============================================================================
// 创建默认实例的工厂函数
// ============================================================================

/**
 * 创建 ErrorMonitor 实例
 */
export function createErrorMonitor(config: Partial<ErrorMonitorConfig>): ErrorMonitor {
  const fullConfig: ErrorMonitorConfig = {
    appName: config.appName || 'yijiandaodi-desktop',
    appVersion: config.appVersion || app.getVersion(),
    isDevelopment: config.isDevelopment ?? !app.isPackaged,
    dsn: config.dsn || process.env.SENTRY_DSN,
    reporting: {
      ...DEFAULT_CONFIG.reporting!,
      ...config.reporting
    },
    showUserFriendlyMessages: config.showUserFriendlyMessages ?? true,
    enableBreadcrumbs: config.enableBreadcrumbs ?? true,
    maxBreadcrumbs: config.maxBreadcrumbs || 100,
    recoveryStrategies: {
      ...DEFAULT_CONFIG.recoveryStrategies,
      ...config.recoveryStrategies
    }
  }

  return new ErrorMonitor(fullConfig)
}