/**
 * LoggerService - 统一日志管理服务
 * 基于 Winston 实现的日志系统
 */

import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'

// ==================== 类型定义 ====================

/**
 * 日志级别枚举
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug'
}

/**
 * 日志上下文接口
 */
export interface LogContext {
  module?: string
  function?: string
  userId?: string
  traceId?: string
  [key: string]: any
}

/**
 * 日志条目接口
 */
export interface LogEntry {
  timestamp: string
  level: string
  message: string
  context?: LogContext
  metadata?: any
}

/**
 * 日志查询选项
 */
export interface LogQueryOptions {
  level?: LogLevel | LogLevel[]
  startTime?: Date
  endTime?: Date
  module?: string
  keyword?: string
  limit?: number
  offset?: number
}

/**
 * 日志导出选项
 */
export interface LogExportOptions extends LogQueryOptions {
  format: 'json' | 'text' | 'csv'
  outputPath: string
}

/**
 * 日志配置接口
 */
export interface LoggerConfig {
  level?: LogLevel
  enableConsole?: boolean
  enableFile?: boolean
  logDirectory?: string
  maxFileSize?: string
  maxFiles?: number
  datePattern?: string
}

// ==================== LoggerService 类 ====================

/**
 * LoggerService - 统一日志管理服务
 */
export class LoggerService {
  private logger: winston.Logger
  private config: Required<LoggerConfig>
  private logDirectory: string
  private static instance: LoggerService

  /**
   * 获取 LoggerService 单例实例
   */
  public static getInstance(config?: LoggerConfig): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService(config)
    }
    return LoggerService.instance
  }

  /**
   * 私有构造函数，实现单例模式
   */
  private constructor(config?: LoggerConfig) {
    // 默认配置
    this.config = {
      level: config?.level || LogLevel.INFO,
      enableConsole: config?.enableConsole ?? true,
      enableFile: config?.enableFile ?? true,
      logDirectory: config?.logDirectory || this.getDefaultLogDirectory(),
      maxFileSize: config?.maxFileSize || '20m',
      maxFiles: config?.maxFiles || 14,
      datePattern: config?.datePattern || 'YYYY-MM-DD'
    }

    // 确保日志目录存在
    this.logDirectory = this.config.logDirectory
    this.ensureLogDirectory()

    // 创建 Winston Logger
    this.logger = this.createLogger()
  }

  /**
   * 获取默认日志目录
   */
  private getDefaultLogDirectory(): string {
    const userDataPath = app.getPath('userData')
    return path.join(userDataPath, 'logs')
  }

  /**
   * 确保日志目录存在
   */
  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDirectory)) {
      fs.mkdirSync(this.logDirectory, { recursive: true })
    }
  }

  /**
   * 创建 Winston Logger 实例
   */
  private createLogger(): winston.Logger {
    const transports: winston.transport[] = []

    // 控制台传输
    if (this.config.enableConsole) {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.printf(({ timestamp, level, message, context }) => {
              const contextStr = context ? ` [${JSON.stringify(context)}]` : ''
              return `${timestamp} [${level}]: ${message}${contextStr}`
            })
          )
        })
      )
    }

    // 文件传输（按日期轮转）
    if (this.config.enableFile) {
      transports.push(
        new DailyRotateFile({
          filename: path.join(this.logDirectory, 'application-%DATE%.log'),
          datePattern: this.config.datePattern,
          zippedArchive: true,
          maxSize: this.config.maxFileSize,
          maxFiles: this.config.maxFiles,
          format: winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.json()
          )
        })
      )

      // 错误日志单独文件
      transports.push(
        new DailyRotateFile({
          filename: path.join(this.logDirectory, 'error-%DATE%.log'),
          datePattern: this.config.datePattern,
          zippedArchive: true,
          maxSize: this.config.maxFileSize,
          maxFiles: this.config.maxFiles,
          level: 'error',
          format: winston.format.combine(
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.json()
          )
        })
      )
    }

    // 创建 logger
    return winston.createLogger({
      level: this.config.level,
      defaultMeta: { service: 'yijiandaodi' },
      transports
    })
  }

  /**
   * 记录 ERROR 级别日志
   */
  public error(message: string, context?: LogContext, metadata?: any): void {
    this.logger.error(message, { context, metadata })
  }

  /**
   * 记录 WARN 级别日志
   */
  public warn(message: string, context?: LogContext, metadata?: any): void {
    this.logger.warn(message, { context, metadata })
  }

  /**
   * 记录 INFO 级别日志
   */
  public info(message: string, context?: LogContext, metadata?: any): void {
    this.logger.info(message, { context, metadata })
  }

  /**
   * 记录 DEBUG 级别日志
   */
  public debug(message: string, context?: LogContext, metadata?: any): void {
    this.logger.debug(message, { context, metadata })
  }

  /**
   * 设置日志级别
   */
  public setLevel(level: LogLevel): void {
    this.config.level = level
    this.logger.setLevel(level)
  }

  /**
   * 获取当前日志级别
   */
  public getLevel(): LogLevel {
    return this.config.level
  }

  /**
   * 查询日志
   */
  public async queryLogs(options: LogQueryOptions): Promise<LogEntry[]> {
    const {
      level,
      startTime,
      endTime,
      module,
      keyword,
      limit = 100,
      offset = 0
    } = options

    const logs: LogEntry[] = []
    const logFiles = await this.getLogFiles()

    for (const logFile of logFiles) {
      const fileLogs = await this.parseLogFile(logFile)
      logs.push(...fileLogs)
    }

    // 过滤日志
    let filteredLogs = logs.filter(log => {
      // 日志级别过滤
      if (level) {
        const levels = Array.isArray(level) ? level : [level]
        if (!levels.includes(log.level as LogLevel)) {
          return false
        }
      }

      // 时间范围过滤
      if (startTime || endTime) {
        const logTime = new Date(log.timestamp)
        if (startTime && logTime < startTime) return false
        if (endTime && logTime > endTime) return false
      }

      // 模块过滤
      if (module && log.context?.module !== module) {
        return false
      }

      // 关键字过滤
      if (keyword && !log.message.includes(keyword)) {
        return false
      }

      return true
    })

    // 排序（按时间倒序）
    filteredLogs.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )

    // 分页
    return filteredLogs.slice(offset, offset + limit)
  }

  /**
   * 导出日志
   */
  public async exportLogs(options: LogExportOptions): Promise<void> {
    const logs = await this.queryLogs(options)

    let content = ''
    switch (options.format) {
      case 'json':
        content = JSON.stringify(logs, null, 2)
        break
      case 'text':
        content = logs.map(log =>
          `${log.timestamp} [${log.level.toUpperCase()}] ${log.message}${
            log.context ? ` ${JSON.stringify(log.context)}` : ''
          }`
        ).join('\n')
        break
      case 'csv':
        const headers = 'timestamp,level,message,context'
        const rows = logs.map(log =>
          `"${log.timestamp}","${log.level}","${log.message}","${log.context ? JSON.stringify(log.context) : ''}"`
        )
        content = [headers, ...rows].join('\n')
        break
    }

    await fs.promises.writeFile(options.outputPath, content, 'utf-8')
  }

  /**
   * 获取日志文件列表
   */
  private async getLogFiles(): Promise<string[]> {
    const files = await fs.promises.readdir(this.logDirectory)
    return files
      .filter(file => file.endsWith('.log') && !file.includes('error'))
      .map(file => path.join(this.logDirectory, file))
  }

  /**
   * 解析日志文件
   */
  private async parseLogFile(filePath: string): Promise<LogEntry[]> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8')
      const lines = content.split('\n').filter(line => line.trim())

      return lines.map(line => {
        try {
          return JSON.parse(line) as LogEntry
        } catch {
          // 如果不是 JSON 格式，尝试解析为文本格式
          const match = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \[(\w+)\]: (.+)$/)
          if (match) {
            return {
              timestamp: match[1],
              level: match[2].toLowerCase(),
              message: match[3]
            }
          }
          return {
            timestamp: new Date().toISOString(),
            level: 'info',
            message: line
          }
        }
      })
    } catch (error) {
      return []
    }
  }

  /**
   * 清理旧日志文件
   */
  public async clearOldLogs(daysToKeep: number = 30): Promise<void> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

    const logFiles = await fs.promises.readdir(this.logDirectory)

    for (const file of logFiles) {
      const filePath = path.join(this.logDirectory, file)
      const stats = await fs.promises.stat(filePath)

      if (stats.birthtime < cutoffDate) {
        await fs.promises.unlink(filePath)
        this.info(`已清理旧日志文件: ${file}`, { module: 'LoggerService' })
      }
    }
  }

  /**
   * 获取日志统计信息
   */
  public async getLogStats(): Promise<{
    totalFiles: number
    totalSize: number
    oldestLog?: Date
    newestLog?: Date
  }> {
    const logFiles = await fs.promises.readdir(this.logDirectory)

    let totalSize = 0
    let oldestLog: Date | undefined
    let newestLog: Date | undefined

    for (const file of logFiles) {
      const filePath = path.join(this.logDirectory, file)
      const stats = await fs.promises.stat(filePath)
      totalSize += stats.size

      if (!oldestLog || stats.birthtime < oldestLog) {
        oldestLog = stats.birthtime
      }
      if (!newestLog || stats.mtime > newestLog) {
        newestLog = stats.mtime
      }
    }

    return {
      totalFiles: logFiles.length,
      totalSize,
      oldestLog,
      newestLog
    }
  }

  /**
   * 关闭日志服务
   */
  public close(): void {
    this.logger.close()
  }
}

// ==================== 导出默认实例 ====================

/**
 * 默认 LoggerService 实例
 */
export const logger = LoggerService.getInstance()

/**
 * 创建带上下文的 Logger
 */
export function createContextLogger(context: LogContext): {
  error: (message: string, metadata?: any) => void
  warn: (message: string, metadata?: any) => void
  info: (message: string, metadata?: any) => void
  debug: (message: string, metadata?: any) => void
} {
  return {
    error: (message: string, metadata?: any) => logger.error(message, context, metadata),
    warn: (message: string, metadata?: any) => logger.warn(message, context, metadata),
    info: (message: string, metadata?: any) => logger.info(message, context, metadata),
    debug: (message: string, metadata?: any) => logger.debug(message, context, metadata)
  }
}