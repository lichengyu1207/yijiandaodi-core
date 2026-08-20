/**
 * monitoring/monitorProvider.ts — 监控器家族统一接缝（方案 A5）
 *
 * 在已落地的 MONITOR_RUNNERS 基础上抽象出的监控提供者契约：
 *  - 身份：key（稳定短 key，对齐 permissionConfig.MONITOR_KEYS）+ label
 *  - 生命周期：start / stop（幂等）
 *  - 状态：isRunning 当前是否运行中
 *
 * 消费方（权限门控 getMonitor / cleanup / 设置页状态）只依赖本接口，
 * 底层实现可整体替换：真实监控器 / 桩 / 远程监控均可作为 MonitorProvider 接入。
 * 本模块为纯类型 + 无副作用构造器，不产生运行时依赖，可被 factories / assembler / 单测共同引用。
 */

/** 监控提供者接缝：统一的生命周期契约（可替换实现） */
export interface MonitorProvider {
  /** 稳定短 key（对齐 permissionConfig.MONITOR_KEYS） */
  readonly key: string
  /** 人类可读名称（日志 / 设置页展示） */
  readonly label: string
  /** 启动监控（幂等；成功后将运行状态置为 true） */
  start(): void
  /** 停止监控（幂等；成功后将运行状态置为 false） */
  stop(): void
  /** 当前是否运行中 */
  isRunning(): boolean
}

/** 监控提供者注册表：key → 提供者（单一来源，供门控 / 清理 / 状态查询共用） */
export type MonitorProviderRegistry = Record<string, MonitorProvider>

/**
 * 基于任意 start/stop 逻辑构建可替换的 MonitorProvider（自动跟踪运行状态）。
 * 运行状态跟踪采用 fail-safe：仅当 start()/stop() 不抛异常时才切换运行标记。
 */
export function createMonitorProvider(
  key: string,
  label: string,
  start: () => void,
  stop: () => void,
): MonitorProvider {
  let running = false
  return {
    key,
    label,
    start: () => {
      start()
      running = true
    },
    stop: () => {
      stop()
      running = false
    },
    isRunning: () => running,
  }
}
