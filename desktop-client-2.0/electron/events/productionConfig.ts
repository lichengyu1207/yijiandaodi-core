/**
 * 治理组件生产配置（一鉴到底 · 治理型 Agent）
 *
 * 集中管理治理事件总线与治理日志的生产环境参数，在 main.ts 中显式应用：
 *  - 日志节流：防止高频感知事件同步写 stdout 阻塞主进程事件循环
 *  - 内存泄漏保护：事件总线 seqByRun 容量上限 + 孤立事件不写 Map（AgentEventBus 内置）
 */

import { LogLevel } from '../services/loggerService'

/** 治理事件总线生产配置 */
export const AGENT_EVENT_BUS_PRODUCTION_CONFIG = {
  /** seq 跳变告警（排查丢事件） */
  enableSeqGuard: true,
  /** 无订阅者告警（排查漏接） */
  enableDropWarning: true,
  /** 感知事件与关键治理流统一 info 级别，方便日常监控 */
  logLevel: LogLevel.INFO,
} as const

/** 治理日志生产配置（含控制台节流） */
export const GOVERNANCE_LOGGER_PRODUCTION_CONFIG = {
  /** DEBUG：所有治理事件（含高频感知埋点）全量落盘 governance-%DATE%.log */
  level: LogLevel.DEBUG,
  /** 控制台节流：1 秒窗口最多输出 50 条，超出的丢弃并输出摘要；文件日志不受影响 */
  consoleThrottle: {
    intervalMs: 1000,
    maxPerInterval: 50,
  },
} as const
