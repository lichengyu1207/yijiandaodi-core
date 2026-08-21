/**
 * GovernanceLogger - 治理事件专用日志
 *
 * 集成到现有 winston 日志体系（与 LoggerService 共用同一 userData/logs 目录）：
 *  - 独立文件 governance-%DATE%.log（DailyRotateFile 轮转）
 *  - 级别默认 DEBUG：确保所有治理事件埋点（含 classifyLevel 归为 debug 的感知事件）都落盘可查
 *  - 测试环境（vitest）仅控制台输出，不污染磁盘
 */

import { app } from 'electron'
import * as path from 'path'
import * as fs from 'fs'
import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import { LogLevel, LogContext, formatConsoleLine } from '../services/loggerService'

/** 是否为测试环境（vitest 设置 NODE_ENV=test 且注入 VITEST 变量） */
const IS_TEST = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true'

/** 治理日志配置 */
export interface GovernanceLoggerConfig {
  level?: LogLevel
  enableConsole?: boolean
  enableFile?: boolean
  logDirectory?: string
  maxFileSize?: string
  maxFiles?: number
  datePattern?: string
  /**
   * 控制台节流（防止高频事件同步写 stdout 阻塞主进程）：
   * - false：关闭节流，全量输出
   * - { intervalMs, maxPerInterval }：时间窗口内最多输出 maxPerInterval 条，超出的丢弃并输出摘要
   * - 默认：{ intervalMs: 1000, maxPerInterval: 50 }
   * 注意：节流只影响控制台，文件日志始终全量落盘。
   */
  consoleThrottle?: false | { intervalMs?: number; maxPerInterval?: number }
}

/** 治理日志方法签名（与 LoggerService.error/warn/info/debug 一致：message, context, metadata） */
export type GovernanceLogMethod = (message: string, context?: LogContext, metadata?: any) => void

/** 治理日志接口（兼容 LoggerService 三参调用；trace 为最细粒度的决策路径埋点，默认不输出） */
export interface GovernanceLoggerLike {
  error: GovernanceLogMethod
  warn: GovernanceLogMethod
  info: GovernanceLogMethod
  debug: GovernanceLogMethod
  trace: GovernanceLogMethod
}

/**
 * 治理日志自定义级别：trace 最细（默认 DEBUG 不落 trace，需显式将 level 设为 TRACE 开启）。
 * 数值沿用 winston npm 语义（越小越严重）：error<warn<info<debug<trace。
 */
const GOVERNANCE_LEVELS: winston.config.AbstractConfigSetLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4,
}

/** 控制台节流配置 */
interface ConsoleThrottleConfig {
  intervalMs: number
  maxPerInterval: number
}

/** 默认控制台节流配置：1 秒窗口最多输出 50 条，超出丢弃并记摘要 */
const DEFAULT_CONSOLE_THROTTLE: ConsoleThrottleConfig = { intervalMs: 1000, maxPerInterval: 50 }

/**
 * 安全写入 stdout：忽略管道断裂（EPIPE / ERR_STREAM_DESTROYED），避免主进程崩溃。
 * 在 win-unpacked 目录直接运行或宿主管道提前关闭时，写已断开的 stdout 会抛 EPIPE。
 */
function safeStdoutWrite(line: string): void {
  try {
    if (process.stdout.writable) process.stdout.write(line)
  } catch {
    // 忽略：stdout 管道已断开或流已销毁
  }
}

/**
 * 带节流的控制台传输。
 * 高频日志（感知事件全量 info 后）同步写 stdout 会阻塞主进程事件循环，
 * 这里按时间窗口限流：窗口内最多输出 maxPerInterval 条，超出的丢弃并累计摘要，窗口切换时输出一次。
 * 文件传输不受影响（始终全量落盘）。
 */
class ThrottledConsoleTransport extends winston.Transport {
  private config: ConsoleThrottleConfig
  private windowStart = 0
  private countInWindow = 0
  private droppedInWindow = 0
  private lastDroppedMessage = ''

  constructor(config: ConsoleThrottleConfig, opts?: winston.Transport.TransportStreamOptions) {
    super(opts)
    this.config = config
  }

  log(info: winston.Logform.TransformableInfo, callback: () => void): void {
    const now = Date.now()

    // 窗口滚动
    if (now - this.windowStart >= this.config.intervalMs) {
      this.emitWindowSummary()
      this.windowStart = now
      this.countInWindow = 0
      this.droppedInWindow = 0
    }

    if (this.countInWindow < this.config.maxPerInterval) {
      this.countInWindow++
      safeStdoutWrite(formatConsoleLine(info) + '\n')
    } else {
      this.droppedInWindow++
      this.lastDroppedMessage = formatConsoleLine(info)
    }

    callback()
  }

  /** 输出上一个窗口被节流丢弃的摘要（避免静默丢日志，同时不刷屏） */
  private emitWindowSummary(): void {
    if (this.droppedInWindow > 0) {
      safeStdoutWrite(
        `... 上 1s 内另有 ${this.droppedInWindow} 条治理日志被节流（最新: ${this.lastDroppedMessage}）\n`
      )
    }
  }

  close(): void {
    this.emitWindowSummary()
    super.close()
  }
}

/**
 * GovernanceLogger - 治理事件独立落盘日志
 * 同一 winston 体系（DailyRotateFile），独立 governance-%DATE%.log 文件，级别 DEBUG。
 */
export class GovernanceLogger implements GovernanceLoggerLike {
  private logger: winston.Logger
  private config: Required<GovernanceLoggerConfig>
  private consoleThrottle: ConsoleThrottleConfig | null
  private fileTransport?: DailyRotateFile

  constructor(config?: GovernanceLoggerConfig) {
    this.config = {
      level: config?.level ?? LogLevel.DEBUG,
      enableConsole: config?.enableConsole ?? true,
      // 测试环境默认不写文件，避免污染磁盘；生产默认写独立文件
      enableFile: config?.enableFile ?? !IS_TEST,
      logDirectory: config?.logDirectory || this.getDefaultLogDirectory(),
      maxFileSize: config?.maxFileSize || '20m',
      maxFiles: config?.maxFiles || 14,
      datePattern: config?.datePattern || 'YYYY-MM-DD',
    }
    // consoleThrottle：false=关闭节流；未配置=默认节流；配置对象=自定义节流
    this.consoleThrottle =
      config?.consoleThrottle === false
        ? null
        : {
            intervalMs: config?.consoleThrottle?.intervalMs ?? DEFAULT_CONSOLE_THROTTLE.intervalMs,
            maxPerInterval: config?.consoleThrottle?.maxPerInterval ?? DEFAULT_CONSOLE_THROTTLE.maxPerInterval,
          }

    this.ensureLogDirectory()
    this.logger = this.createLogger()
  }

  /** 默认日志目录：与 LoggerService 共用 userData/logs */
  private getDefaultLogDirectory(): string {
    const userDataPath = app.getPath('userData')
    return path.join(userDataPath, 'logs')
  }

  /** 确保日志目录存在 */
  private ensureLogDirectory(): void {
    if (this.config.enableFile && !fs.existsSync(this.config.logDirectory)) {
      fs.mkdirSync(this.config.logDirectory, { recursive: true })
    }
  }

  /** 创建 Winston Logger（复用现有体系：控制台 + DailyRotateFile 文件） */
  private createLogger(): winston.Logger {
    const transports: winston.transport[] = []

    // 控制台传输（默认带节流，防止高频同步写 stdout 阻塞主进程）
    if (this.config.enableConsole) {
      if (this.consoleThrottle) {
        transports.push(
          new ThrottledConsoleTransport(this.consoleThrottle, {
            format: winston.format.combine(
              winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' })
            )
          })
        )
      } else {
        transports.push(
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
              winston.format.printf((info) => formatConsoleLine(info))
            )
          })
        )
      }
    }

    // 独立文件传输：governance-%DATE%.log（保留引用以便运行时切换级别）
    if (this.config.enableFile) {
      const fileTransport = new DailyRotateFile({
        filename: path.join(this.config.logDirectory, 'governance-%DATE%.log'),
        datePattern: this.config.datePattern,
        zippedArchive: true,
        maxSize: this.config.maxFileSize,
        maxFiles: this.config.maxFiles,
        level: this.config.level,
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.json()
        )
      })
      this.fileTransport = fileTransport
      transports.push(fileTransport)
    }

    return winston.createLogger({
      level: this.config.level,
      levels: GOVERNANCE_LEVELS,
      defaultMeta: { service: 'yijiandaodi', scope: 'governance' },
      transports,
    })
  }

  public error(message: string, context?: LogContext, metadata?: any): void {
    this.logger.error(message, { context, metadata })
  }

  public warn(message: string, context?: LogContext, metadata?: any): void {
    this.logger.warn(message, { context, metadata })
  }

  public info(message: string, context?: LogContext, metadata?: any): void {
    this.logger.info(message, { context, metadata })
  }

  public debug(message: string, context?: LogContext, metadata?: any): void {
    this.logger.debug(message, { context, metadata })
  }

  public trace(message: string, context?: LogContext, metadata?: any): void {
    this.logger.trace(message, { context, metadata })
  }

  /** 运行时切换日志级别（TRACE 开启决策路径埋点；默认 DEBUG 不落 trace） */
  public setLevel(level: LogLevel): void {
    this.config.level = level
    // 同时更新 logger 主级别与文件传输级别（无显式级别的控制台传输继承 logger 级别）
    this.logger.level = level
    if (this.fileTransport) this.fileTransport.level = level
  }

  /** 当前日志级别 */
  public getLevel(): LogLevel {
    return this.config.level
  }

  /** 治理日志落盘目录（供 perfLogAnalyzer 等外部工具定位日志文件） */
  public getLogDirectory(): string {
    return this.config.logDirectory
  }
}

// ============================================================================
// 默认实例
// ============================================================================

/** 全局治理事件日志单例 */
export const governanceLogger = new GovernanceLogger()

/** 创建独立治理日志实例（隔离测试 / 多模块场景） */
export function createGovernanceLogger(config?: GovernanceLoggerConfig): GovernanceLogger {
  return new GovernanceLogger(config)
}

// ============================================================================
// 级别持久化（设置页可随时切换；与各监控器一致，落 userData/data/*.json）
// ============================================================================

/** 默认治理日志级别 */
export const DEFAULT_GOVERNANCE_LOG_LEVEL = LogLevel.DEBUG

/** 治理日志级别持久化文件路径 */
export function getGovernanceLogConfigPath(): string {
  return path.join(app.getPath('userData'), 'data', 'governanceLogConfig.json')
}

/** 持久化到配置文件的完整状态：全局默认级别 + 按模块覆盖（P0 统一控制面） */
export interface GovernanceLogLevelState {
  level: LogLevel
  overrides: Record<string, LogLevel>
}

/** 校验日志级别值（非法 → undefined） */
function asValidLogLevel(value: unknown): LogLevel | undefined {
  return typeof value === 'string' && Object.values(LogLevel).includes(value as LogLevel)
    ? (value as LogLevel)
    : undefined
}

/** 读取持久化的治理日志级别状态（全局级别 + 按模块覆盖；缺失 / 非法 → 默认 DEBUG / 空覆盖） */
export function loadGovernanceLogLevelState(): GovernanceLogLevelState {
  try {
    const raw = JSON.parse(fs.readFileSync(getGovernanceLogConfigPath(), 'utf-8'))
    const level = asValidLogLevel(raw?.level) ?? DEFAULT_GOVERNANCE_LOG_LEVEL
    const overrides: Record<string, LogLevel> = {}
    if (raw?.overrides && typeof raw.overrides === 'object') {
      for (const [moduleId, lv] of Object.entries(raw.overrides)) {
        const valid = asValidLogLevel(lv)
        if (valid) overrides[moduleId] = valid
      }
    }
    return { level, overrides }
  } catch {
    // 文件缺失或解析失败 → 使用默认状态
  }
  return { level: DEFAULT_GOVERNANCE_LOG_LEVEL, overrides: {} }
}

/** 持久化治理日志级别状态（保留既有 overrides，避免覆盖丢失） */
export function saveGovernanceLogLevelState(state: GovernanceLogLevelState): void {
  const filePath = getGovernanceLogConfigPath()
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify({ level: state.level, overrides: state.overrides ?? {} }, null, 2))
}

/** 读取持久化的治理日志级别（缺失 / 非法 → 默认 DEBUG） */
export function loadGovernanceLogLevel(): LogLevel {
  return loadGovernanceLogLevelState().level
}

/** 持久化治理日志级别（保留既有 overrides） */
export function saveGovernanceLogLevel(level: LogLevel): void {
  saveGovernanceLogLevelState({ level, overrides: loadGovernanceLogLevelState().overrides })
}
