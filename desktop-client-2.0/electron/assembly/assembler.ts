/**
 * assembly/assembler.ts — 配置驱动装配执行器（方案 A1 · T3）
 *
 * 读取声明式配置，按序完成三件事：
 *  1. services：实例化启用的服务工厂 → 注册到 container（依赖经 ctx.resolve() 解析）
 *  2. monitors：生成启用的监控 runner（供权限门控 getMonitor / cleanup 使用）
 *  3. plugins：安装启用的插件到 PluginRegistry
 *
 * fail-fast：任一服务装配失败即抛错（fail-closed，装配不完整不运行）；日志带 [装配] 前缀。
 * 插件 / 监控单项失败同样抛出，错误信息指明配置项 id/key 与原因，避免静默跳过造成困惑。
 */

import type { AssemblyConfig, AssemblyContext, AssemblyParams, ServiceFactory, MonitorFactory, PluginFactory } from '../config/assemblySchema'
import type { DIContainer } from '../di/container'
import type { GovernanceLoggerLike } from '../events/governanceLogger'
import type { AgentEventBus } from '../events/agentEventBus'
import type { PluginRegistry } from '../agent/pluginRegistry'
import type { ToolRegistry } from '../agent/toolRegistry'
import type { MonitorProviderRegistry } from '../monitoring/monitorProvider'
import { serviceFactories, monitorFactories, pluginFactories } from './factories'

/** 工厂注册表集合（可注入替换/扩展，默认使用 assembly/factories 内置注册表） */
export interface AssemblerFactories {
  services: Record<string, ServiceFactory>
  monitors: Record<string, MonitorFactory>
  plugins: Record<string, PluginFactory>
}

/** 装配器外部依赖（bus / registry 由 bootstrap 创建后注入；factories 可覆盖用于测试/扩展） */
export interface AssemblerDeps {
  container: DIContainer
  logger: GovernanceLoggerLike
  /** 用户数据目录（配置落盘 / 插件需要时使用） */
  getUserDataPath: () => string
  /** 事件总线（插件 subscribe 需要） */
  bus: AgentEventBus
  /** 插件注册表（插件 install 目标） */
  registry: PluginRegistry
  /** 工厂注册表（可选覆盖；测试注入 fake、生产扩展第 7 种监控时并入内置表） */
  factories?: Partial<AssemblerFactories>
}

/** 装配结果摘要：runners 供权限门控与 cleanup 使用（A5：MonitorProvider 注册表） */
export interface AssemblerResult {
  /** 已生成的监控提供者（key → provider；权限门控 / cleanup / 状态查询共用） */
  runners: MonitorProviderRegistry
  /** 已装配并注册到容器服务名（按配置顺序） */
  services: string[]
  /** 已安装插件 id（按配置顺序） */
  plugins: string[]
  /** 工具注册表内工具数（toolRegistry 未装配时为 0） */
  toolCount: number
}

/** 装配失败错误（携带装配项 id/key 便于定位） */
export class AssemblyError extends Error {
  constructor(message: string, readonly item: string, readonly phase: 'service' | 'monitor' | 'plugin') {
    super(message)
    this.name = 'AssemblyError'
  }
}

/**
 * 创建装配器：config（声明式）+ deps（运行时句柄）。
 * 返回 { assemble }，assemble() 执行完整装配并返回摘要。
 */
export function createAssembler(config: AssemblyConfig, deps: AssemblerDeps) {
  const ctx: AssemblyContext = {
    container: deps.container,
    resolve: <T>(name: string) => deps.container.resolve<T>(name),
    logger: deps.logger,
    getUserDataPath: deps.getUserDataPath,
  }
  const { logger } = deps
  // 工厂注册表：优先使用注入覆盖，否则用内置注册表（生产扩展时可在调用方并入内置表）
  const services = deps.factories?.services ?? serviceFactories
  const monitors = deps.factories?.monitors ?? monitorFactories
  const plugins = deps.factories?.plugins ?? pluginFactories

  /** 装配单一服务：实例化 → 注册容器 */
  function assembleService(id: string, params: AssemblyParams): void {
    const factory = services[id]
    if (!factory) {
      throw new AssemblyError(`服务工厂未注册: ${id}`, id, 'service')
    }
    try {
      const instance = factory(ctx, params)
      ctx.container.register(id, instance)
      logger.info('[装配] 服务已注册', { module: 'Assembler', service: id })
    } catch (error) {
      logger.error('[装配] 服务装配失败', { module: 'Assembler', service: id, error })
      throw new AssemblyError(`服务装配失败: ${id}（${error instanceof Error ? error.message : String(error)}）`, id, 'service')
    }
  }

  /** 装配单一监控：生成 provider */
  function assembleMonitor(key: string, params: AssemblyParams, runners: MonitorProviderRegistry): void {
    const factory = monitors[key]
    if (!factory) {
      throw new AssemblyError(`监控工厂未注册: ${key}`, key, 'monitor')
    }
    try {
      runners[key] = factory(ctx, params)
      logger.info('[装配] 监控 runner 已生成', { module: 'Assembler', monitor: key })
    } catch (error) {
      logger.error('[装配] 监控 runner 生成失败', { module: 'Assembler', monitor: key, error })
      throw new AssemblyError(`监控 runner 生成失败: ${key}（${error instanceof Error ? error.message : String(error)}）`, key, 'monitor')
    }
  }

  /** 装配单一插件：构建 → install 到注册表 */
  function assemblePlugin(id: string, params: AssemblyParams): void {
    const factory = plugins[id]
    if (!factory) {
      throw new AssemblyError(`插件工厂未注册: ${id}`, id, 'plugin')
    }
    try {
      const plugin = factory(ctx, params)
      const toolRegistry = ctx.container.has('toolRegistry')
        ? ctx.container.resolve<ToolRegistry>('toolRegistry')
        : undefined
      if (!toolRegistry) {
        throw new Error('toolRegistry 未装配，插件无法注入工具')
      }
      deps.registry.install(plugin, deps.bus, toolRegistry)
      logger.info('[装配] 插件已安装', { module: 'Assembler', plugin: id })
    } catch (error) {
      if (error instanceof AssemblyError) throw error
      logger.error('[装配] 插件安装失败', { module: 'Assembler', plugin: id, error })
      throw new AssemblyError(`插件安装失败: ${id}（${error instanceof Error ? error.message : String(error)}）`, id, 'plugin')
    }
  }

  return {
    /** 执行完整装配，返回摘要（runners 供权限门控 / cleanup 使用） */
    assemble(): AssemblerResult {
      const runners: MonitorProviderRegistry = {}
      const services: string[] = []
      const plugins: string[] = []

      for (const decl of config.services) {
        if (!decl.enabled) continue
        assembleService(decl.id, decl.params)
        services.push(decl.id)
      }

      for (const decl of config.monitors) {
        if (!decl.enabled) continue
        assembleMonitor(decl.key, decl.params, runners)
      }

      for (const decl of config.plugins) {
        if (!decl.enabled) continue
        assemblePlugin(decl.id, decl.params)
        plugins.push(decl.id)
      }

      const toolCount = ctx.container.has('toolRegistry')
        ? ctx.container.resolve<ToolRegistry>('toolRegistry').size
        : 0

      logger.info('[装配] 装配完成', { module: 'Assembler', serviceCount: services.length, monitorCount: Object.keys(runners).length, pluginCount: plugins.length, toolCount })
      return { runners, services, plugins, toolCount }
    },
  }
}
