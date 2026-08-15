/**
 * 操作权限门控执行模块
 *
 * 从 main.ts 提取：按权限配置启动/停止监控与系统集成（fail-closed）。
 * 通过依赖注入解耦 electron/container，便于在集成测试中真实模拟
 * 「用户修改权限 → 重新加载 → 门控更新」的完整链路。
 *
 * 行为与主进程原 applyPermissionGating 保持一致（幂等）：
 * - 监控按 buildMonitorStartPlan 启动/停止
 * - 开机自启动按 autoStart 权限同步
 */

import { buildMonitorStartPlan, loadPermissionConfig, PermissionConfig } from './permissionConfig'

/** 门控依赖（注入，便于测试） */
export interface PermissionGatingDeps {
  /** 获取 userData 路径（用于重新加载配置） */
  getUserDataPath: () => string
  /** 读取当前开机自启动状态 */
  isAutoStartEnabled: () => boolean
  /** 设置开机自启动 */
  setAutoStartEnabled: (enabled: boolean) => void
  /** 按监控 key 解析其 label 与启动/停止函数 */
  getMonitor: (key: string) => { label: string; start(): void; stop(): void }
  /** API 调用监控是否在设置页启用（双条件之一） */
  isApiCallMonitorEnabled: () => boolean
  logger: {
    info(message: string, meta?: object, extra?: object): void
    debug(message: string, meta?: object, extra?: object): void
    error(message: string, meta?: object, extra?: object): void
  }
}

/** 门控实例 */
export interface PermissionGating {
  /** 当前已启动的监控集合（cleanup 时据此停止） */
  runningMonitors: Set<string>
  /** 当前内存中的权限配置 */
  getConfig(): PermissionConfig
  /** 启动时：从磁盘加载配置到内存 */
  load(): void
  /** 应用门控（幂等）：按当前配置启停监控与自启动 */
  apply(): void
  /** 配置变更回调：重新从磁盘加载配置到内存，再应用门控（保证实时生效） */
  reloadAndApply(): void
}

/** 需要门控的监控 key（与 runningMonitors 记录一致） */
const MONITOR_KEYS = ['file', 'clipboard', 'process', 'network', 'apiCall', 'resource'] as const

export function createPermissionGating(deps: PermissionGatingDeps): PermissionGating {
  let permissionConfig: PermissionConfig = {
    granted: {
      fileMonitor: false,
      clipboardMonitor: false,
      networkMonitor: false,
      apiCallMonitor: false,
      processMonitor: false,
      resourceMonitor: false,
      agentWrite: false,
      autoStart: false,
      tray: true,
      notifications: true,
    },
    onboarded: false,
  }
  const runningMonitors = new Set<string>()

  /** 解析某监控 key 对应的启动/停止函数（复用 buildMonitorStartPlan 的键名映射） */
  function planFor(key: string): { want: boolean; label: string; start: () => void; stop: () => void } {
    const granted = permissionConfig.granted
    const plan = buildMonitorStartPlan(granted)
    const spec = deps.getMonitor(key)
    const wantMap: Record<string, boolean> = {
      file: plan.fileMonitor,
      clipboard: plan.clipboardMonitor,
      process: plan.processMonitor,
      network: plan.networkMonitor,
      // API 调用监控：权限 + 设置页"启用"开关双条件
      apiCall: plan.apiCallMonitor && deps.isApiCallMonitorEnabled(),
      resource: plan.resourceMonitor,
    }
    return { want: wantMap[key], label: spec.label, start: spec.start, stop: spec.stop }
  }

  function apply() {
    const granted = permissionConfig.granted
    const plan = buildMonitorStartPlan(granted)

    deps.logger.info('[权限] 开始应用权限门控', { module: 'PermissionGate' }, {
      granted,
      plan,
      runningMonitors: [...runningMonitors],
    })

    for (const key of MONITOR_KEYS) {
      const { want, label, start, stop } = planFor(key)
      const running = runningMonitors.has(key)
      if (want && !running) {
        try {
          start()
          runningMonitors.add(key)
          deps.logger.info(`[权限] ✅ 已启动 ${label}`, { module: 'PermissionGate' }, { monitor: key, started: true, running: false })
        } catch (error) {
          deps.logger.error(`[权限] ❌ ${label}启动失败`, { module: 'PermissionGate' }, { monitor: key, started: false, error })
        }
      } else if (!want && running) {
        try {
          stop()
          runningMonitors.delete(key)
          deps.logger.info(`[权限] ✅ 已停止 ${label}`, { module: 'PermissionGate' }, { monitor: key, stopped: true, running: true })
        } catch (error) {
          deps.logger.error(`[权限] ❌ ${label}停止失败`, { module: 'PermissionGate' }, { monitor: key, stopped: false, error })
        }
      } else {
        // 无需变化：记录当前状态，便于排查"为什么没启动/没停止"
        deps.logger.debug(`[权限] ⏭ ${label}状态无需变化`, { module: 'PermissionGate' }, {
          monitor: key,
          want,
          running,
        })
      }
    }

    // 开机自启动权限同步
    const currentAutoStart = deps.isAutoStartEnabled()
    if (granted.autoStart && !currentAutoStart) {
      deps.setAutoStartEnabled(true)
      deps.logger.info('[权限] ✅ 已开启开机自启动', { module: 'PermissionGate' })
    } else if (!granted.autoStart && currentAutoStart) {
      deps.setAutoStartEnabled(false)
      deps.logger.info('[权限] ✅ 已关闭开机自启动', { module: 'PermissionGate' })
    } else {
      deps.logger.debug('[权限] ⏭ 开机自启动状态无需变化', { module: 'PermissionGate' }, { wantAutoStart: granted.autoStart, currentAutoStart })
    }
  }

  return {
    runningMonitors,
    getConfig: () => permissionConfig,
    load() {
      permissionConfig = loadPermissionConfig(deps.getUserDataPath())
      deps.logger.info('[系统] 已加载操作权限配置', { module: 'PermissionGate' }, {
        onboarded: permissionConfig.onboarded,
        granted: permissionConfig.granted,
      })
    },
    apply,
    reloadAndApply() {
      try {
        const prev = permissionConfig
        permissionConfig = loadPermissionConfig(deps.getUserDataPath())
        deps.logger.info('[权限] 配置变更回调：重新加载并应用门控', { module: 'PermissionGate' }, {
          prevGranted: prev.granted,
          nextGranted: permissionConfig.granted,
        })
        apply()
      } catch (error) {
        deps.logger.error('[权限] 配置变更后重新加载/应用门控失败', { module: 'PermissionGate' }, { error })
      }
    },
  }
}
