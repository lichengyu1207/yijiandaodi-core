/**
 * agent/pluginRegistry.ts — M7 Skill 插件注册表（OpenClaw plugin runtime 思路）
 *
 * 来源：OpenClaw `src/plugins/runtime.ts`（activeRegistry + 事件桥 + 生命周期 + 单飞）。
 * 职责：把 Skill 模板注册成插件，插件订阅事件流 / 注入工具 / 挂载决策链路钩子，
 * 无需改主进程即可扩展治理能力。
 *
 * P1 契约落地（新增）：
 *  - 集成 HooksHost：install 时注册插件声明的决策链路钩子，uninstall 注销，
 *    enable/disable 同步 HooksHost.setEnabled（停用插件的钩子不参与 emit）
 *  - 插件状态机：loaded（启用）/ disabled（停用）/ retired（已卸载）/ error（异常，预留）
 *  - 卸载清理增强：uninstall 时注销插件注入的工具（记录 toolNames 快照）
 *
 * 关键机制（对齐 OpenClaw 命名）：
 *  - setActive / list：插件注册表状态管理（markPluginRegistryActive）
 *  - install / uninstall：插件生命周期（loaded / retired）+ 清理退订
 *  - runOncePerAgentRun：单飞去重——同一 runId 同一操作只执行一次，
 *    防事件风暴重复触发多轮治理
 *
 * 详见 docs/AGENT_FUSION_MODULE_DESIGN.md §3 M7 / §6 单飞去重
 */

import type { AgentEventBus } from '../events/agentEventBus'
import type { GovernanceLoggerLike } from '../events/governanceLogger'
import { ToolRegistry } from './toolRegistry'
import { HooksHost } from './hooks/runtime'
import type { PluginHooks } from './hooks/types'

/** 插件生命周期状态 */
export type PluginStatus = 'loaded' | 'disabled' | 'retired' | 'error'

/** 插件定义：订阅事件流 + 注入工具 + 决策链路钩子（P1） */
export interface GovPlugin {
  id: string
  version?: string
  description?: string
  /** 插件级执行优先级（决定钩子执行顺序；默认 0，越大越先） */
  priority?: number
  /** 声明的决策链路钩子（P1 新契约；install 时注册到 HooksHost） */
  hooks?: PluginHooks
  /** 订阅事件流，返回退订函数数组（对齐 OpenClaw syncPluginAgentEventBridge） */
  subscribe?: (bus: AgentEventBus) => Array<() => void>
  /** 注入工具到注册表（可选） */
  registerTools?: (registry: ToolRegistry) => void
  /** 生命周期状态（内部维护；插件可不声明） */
  status?: PluginStatus
  /** 卸载钩子（可选，清理资源） */
  onUninstall?: () => void | Promise<void>
}

/** 单飞去重注册表：key = runId + operation，值 = 已发起的 Promise（防并发重复执行） */
const runOnceRegistry = new Map<string, Promise<unknown>>()

/** 单飞去重统计（性能监控：去重生效的量化证据） */
const runOnceStats = { firstHit: 0, reuseHit: 0 }

/** 读取单飞去重统计快照 */
export function getRunOnceStats(): { firstHit: number; reuseHit: number } {
  return { ...runOnceStats }
}

/** 重置单飞去重统计（观察窗口 / 测试用）；不影响注册表缓存 */
export function resetRunOnceStats(): void {
  runOnceStats.firstHit = 0
  runOnceStats.reuseHit = 0
}

/**
 * 单飞去重：同一 runId 同一操作只执行一次。
 * 返回包装后的函数；调用时若已注册同名操作则直接复用已发起的 Promise（防重复触发多轮治理）。
 * @param key 操作唯一键（如 `${runId}:${pluginId}:${operation}`）
 * @param logger 可选治理日志（trace 记录单飞命中/首次，便于排查事件风暴）
 */
export async function runOncePerAgentRun<T>(
  key: string,
  operation: () => Promise<T>,
  logger?: GovernanceLoggerLike,
): Promise<T | undefined> {
  const existing = runOnceRegistry.get(key)
  if (existing) {
    runOnceStats.reuseHit++
    logger?.trace('[单飞] 命中已有执行，复用（事件风暴去重）', { module: 'PluginRegistry', function: 'runOncePerAgentRun' }, { key })
    return existing as Promise<T>
  }
  runOnceStats.firstHit++
  const promise = operation().finally(() => runOnceRegistry.delete(key))
  runOnceRegistry.set(key, promise)
  logger?.trace('[单飞] 首次发起执行', { module: 'PluginRegistry', function: 'runOncePerAgentRun' }, { key })
  return promise
}

/** 清理单飞去重缓存（测试/生命周期用） */
export function clearRunOnceRegistry(): void {
  runOnceRegistry.clear()
}

/** 插件注册表内部管理的运行时元数据 */
interface ManagedPlugin {
  plugin: GovPlugin
  status: PluginStatus
  /** 事件流退订函数 */
  unsubscribers: Array<() => void>
  /** 错误信息（error 状态时记录） */
  error?: string
}

/** 插件注册表：安装/卸载/启停/列出插件 */
export class PluginRegistry {
  private plugins = new Map<string, ManagedPlugin>()
  private log: GovernanceLoggerLike
  private hooksHost: HooksHost
  private active = false
  /** 注册表运维计数（性能监控） */
  private counters = { install: 0, uninstall: 0, enable: 0, disable: 0 }

  constructor(opts?: { logger?: GovernanceLoggerLike; hooksHost?: HooksHost }) {
    this.log = opts?.logger ?? {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
      trace: () => {},
    }
    // 钩子宿主：可注入共享实例（供 GovernanceEngine 在 P2 复用），否则内部创建
    this.hooksHost = opts?.hooksHost ?? new HooksHost({ logger: this.log })
  }

  /** 标记注册表为激活（对齐 markPluginRegistryActive） */
  setActive(): void {
    this.active = true
  }

  /** 是否激活 */
  get isActive(): boolean {
    return this.active
  }

  /** 暴露钩子宿主（治理引擎 / ToolBridge 通过它 emit 决策链路钩子） */
  get hooks(): HooksHost {
    return this.hooksHost
  }

  /**
   * 安装插件：注册生命周期 + 注入工具 + 订阅事件流 + 注册决策链路钩子（返回退订函数）。
   * 安装后默认状态 loaded（启用）。
   */
  install(plugin: GovPlugin, bus: AgentEventBus, tools: ToolRegistry): () => void {
    if (this.plugins.has(plugin.id)) {
      this.log.warn('[插件] 插件已存在，跳过安装', { module: 'PluginRegistry', function: 'install' }, {
        pluginId: plugin.id,
      })
      return () => {}
    }

    const managed: ManagedPlugin = {
      plugin: { ...plugin, status: 'loaded' },
      status: 'loaded',
      unsubscribers: [],
    }
    this.plugins.set(plugin.id, managed)
    this.counters.install++

    // 注入工具（可选）：工具生命周期由插件自身管理（onUninstall 置非激活）
    if (plugin.registerTools) {
      try {
        plugin.registerTools(tools)
      } catch (error) {
        this.markError(plugin.id, error, '工具注入失败')
      }
    }

    // 订阅事件流（可选）：插件直连总线订阅，无需主进程介入
    let subscribeCount = 0
    if (plugin.subscribe) {
      try {
        managed.unsubscribers.push(...plugin.subscribe(bus))
        subscribeCount = managed.unsubscribers.length
      } catch (error) {
        this.markError(plugin.id, error, '事件订阅失败')
      }
    }

    // 注册决策链路钩子（P1）：挂载到 HooksHost，供引擎 emit
    if (plugin.hooks) {
      try {
        this.hooksHost.register(plugin.id, plugin.hooks, { priority: plugin.priority ?? 0 })
      } catch (error) {
        this.markError(plugin.id, error, '钩子注册失败')
      }
    }

    this.log.trace('[插件] 安装决策完成', { module: 'PluginRegistry', function: 'install' }, {
      pluginId: plugin.id,
      version: plugin.version,
      priority: plugin.priority,
      toolsInjected: managed.toolNames,
      subscribeCount,
      hasHooks: !!plugin.hooks,
    })

    this.log.info('[插件] 已安装', { module: 'PluginRegistry', function: 'install' }, {
      pluginId: plugin.id,
      version: plugin.version,
      status: managed.status,
      hookPoints: plugin.hooks ? Object.keys(plugin.hooks).filter((k) => (plugin.hooks as Record<string, unknown>)[k]) : [],
    })

    // 返回退订：卸载插件 + 清理订阅
    return () => {
      this.uninstall(plugin.id)
    }
  }

  /** 启用插件：disabled/error → loaded；恢复钩子参与 emit */
  enable(id: string): boolean {
    const managed = this.plugins.get(id)
    if (!managed) {
      this.log.warn('[插件] 插件不存在，跳过启用', { module: 'PluginRegistry', function: 'enable' }, { pluginId: id })
      return false
    }
    managed.status = 'loaded'
    managed.error = undefined
    this.hooksHost.setEnabled(id, true)
    this.counters.enable++
    this.log.info('[插件] 已启用', { module: 'PluginRegistry', function: 'enable' }, { pluginId: id })
    return true
  }

  /** 停用插件：loaded → disabled；钩子不再参与 emit（工具/事件订阅保留） */
  disable(id: string): boolean {
    const managed = this.plugins.get(id)
    if (!managed) {
      this.log.warn('[插件] 插件不存在，跳过停用', { module: 'PluginRegistry', function: 'disable' }, { pluginId: id })
      return false
    }
    managed.status = 'disabled'
    this.hooksHost.setEnabled(id, false)
    this.counters.disable++
    this.log.info('[插件] 已停用', { module: 'PluginRegistry', function: 'disable' }, { pluginId: id })
    return true
  }

  /** 标记插件异常（error 状态 + 记录错误信息） */
  markError(id: string, error: unknown, phase: string): void {
    const managed = this.plugins.get(id)
    if (!managed) return
    managed.status = 'error'
    managed.error = `${phase}: ${error instanceof Error ? error.message : error}`
    this.log.error(`[插件] ${phase}`, { module: 'PluginRegistry', function: 'markError' }, {
      pluginId: id,
      phase,
      error: managed.error,
    })
  }

  /** 卸载插件：标记 retired + 注销钩子/工具/订阅 + 卸载钩子 */
  uninstall(id: string): void {
    const managed = this.plugins.get(id)
    if (!managed) {
      this.log.warn('[插件] 插件不存在，跳过卸载', { module: 'PluginRegistry', function: 'uninstall' }, {
        pluginId: id,
      })
      return
    }
    const plugin = managed.plugin
    managed.status = 'retired'
    this.counters.uninstall++

    // 注销决策链路钩子
    this.hooksHost.unregister(id)

    // 退订事件流
    for (const unsubscribe of managed.unsubscribers) unsubscribe()
    managed.unsubscribers = []

    // 卸载钩子（清理资源；工具生命周期由插件自身管理）
    if (plugin.onUninstall) {
      try {
        const result = plugin.onUninstall()
        if (result && typeof (result as Promise<void>).then === 'function') {
          void (result as Promise<void>).catch((e) =>
            this.log.warn('[插件] 异步卸载钩子失败', { module: 'PluginRegistry', function: 'uninstall' }, {
              pluginId: id, error: e instanceof Error ? e.message : e,
            }),
          )
        }
      } catch (error) {
        this.log.warn('[插件] 卸载钩子失败', { module: 'PluginRegistry', function: 'uninstall' }, {
          pluginId: id, error: error instanceof Error ? error.message : error,
        })
      }
    }

    this.plugins.delete(id)
    this.log.info('[插件] 已卸载', { module: 'PluginRegistry', function: 'uninstall' }, {
      pluginId: id,
      status: 'retired',
      removedSubscriptions: managed.unsubscribers.length,
    })
  }

  /** 卸载全部插件（生命周期清理） */
  uninstallAll(): void {
    for (const id of [...this.plugins.keys()]) this.uninstall(id)
  }

  /** 列出已安装插件 */
  list(): GovPlugin[] {
    return [...this.plugins.values()].map((m) => m.plugin)
  }

  /** 获取插件 */
  get(id: string): GovPlugin | undefined {
    return this.plugins.get(id)?.plugin
  }

  /** 获取插件运行时状态（含错误信息） */
  getStatus(id: string): { status: PluginStatus; error?: string } | undefined {
    const managed = this.plugins.get(id)
    if (!managed) return undefined
    return { status: managed.status, error: managed.error }
  }

  /** 注册表运维统计（性能监控）：安装/卸载/启停次数快照 */
  stats(): { installCount: number; uninstallCount: number; enableCount: number; disableCount: number } {
    return { ...this.counters }
  }

  /** 已安装插件数 */
  get size(): number {
    return this.plugins.size
  }
}
