/**
 * config/assemblySchema.ts — 配置驱动装配的类型定义（方案 A1 · T1）
 *
 * 两层模型：
 *  - 配置层（本文件类型 + assemblyConfig 默认值）：声明式配置，启用哪些服务/监控/插件 + 参数
 *  - 注册表层（assembly/factories.ts）：代码注册"怎么创建实例"，依赖经 ctx.resolve() 解析
 *
 * 目标：新增第 7 种监控 / 服务 / 插件时，只需在配置声明 + 工厂表注册一行，不改 main.ts 装配代码。
 *
 * 纯类型文件（仅含类型与 schema 版本常量），不产生运行时依赖，可被 factories / assembler / 单测共同引用。
 */

import type { DIContainer } from '../di/container'
import type { GovPlugin } from '../agent/pluginRegistry'
import type { GovernanceLoggerLike } from '../events/governanceLogger'
import type { MonitorProvider } from '../monitoring/monitorProvider'

/** 当前装配配置 schema 版本（便于将来演进时做兼容迁移） */
export const ASSEMBLY_SCHEMA_VERSION = 1

/** 工厂参数：由对应工厂约定具体字段（如监控阈值），配置层原样透传 */
export type AssemblyParams = Record<string, unknown>

/**
 * 服务声明：可被容器装配的服务。
 * 对应 factories.ts 的 serviceFactories 键；装配器实例化后注册到 container。
 */
export interface ServiceDeclaration {
  /** 容器注册名（唯一） */
  id: string
  /** 是否启用（false 则不实例化、不注册） */
  enabled: boolean
  /** 工厂参数透传（阈值等），字段由对应工厂约定 */
  params: AssemblyParams
}

/**
 * 监控声明：映射到 MONITOR_RUNNERS 的短 key。
 * key 使用 string 而非字面量联合——A1 目标是支持"第 7 种监控"无需改 main.ts 装配代码。
 */
export interface MonitorDeclaration {
  /** 监控短 key（file/clipboard/process/network/apiCall/resource/...） */
  key: string
  /** 是否启用（权限门控之外的另一层开关；最终启停仍由权限门控决定） */
  enabled: boolean
  /** 工厂参数透传（如监控阈值） */
  params: AssemblyParams
}

/**
 * 插件声明：映射到 factories.ts 的 pluginFactories 键。
 * 装配器安装时把 bus/toolRegistry/hooks 通过 ctx 注入工厂，配置层只声明 id 与静态参数。
 */
export interface PluginDeclaration {
  /** 插件 id（governance-pet / risk-summary / ...） */
  id: string
  /** 是否启用 */
  enabled: boolean
  /** 工厂静态参数透传 */
  params: AssemblyParams
}

/** 装配配置：服务 + 监控 + 插件 三张声明清单 */
export interface AssemblyConfig {
  /** schema 版本（当前 ASSEMBLY_SCHEMA_VERSION） */
  version: number
  /** 服务声明清单（按序实例化，依赖经容器解析） */
  services: ServiceDeclaration[]
  /** 监控声明清单（装配器据此生成 MONITOR_RUNNERS） */
  monitors: MonitorDeclaration[]
  /** 插件声明清单（装配器据此依次 install 到 PluginRegistry） */
  plugins: PluginDeclaration[]
}

/**
 * 装配上下文：装配器与工厂共享的运行时句柄。
 * 工厂通过 ctx.resolve() 获取依赖（消除直接 import 单例），通过 logger 记录装配日志。
 */
export interface AssemblyContext {
  /** 依赖注入容器 */
  container: DIContainer
  /** 解析依赖（委托 container.resolve） */
  resolve: <T>(name: string) => T
  /** 装配日志器（对齐 GovernanceLoggerLike 接口，注入共享实例保证动态级别切换生效） */
  logger: GovernanceLoggerLike
  /** 用户数据目录（配置落盘 / 插件需要时使用） */
  getUserDataPath: () => string
}

/** 服务工厂：根据 ctx 解析依赖 + params，返回可注册到容器的实例 */
export type ServiceFactory = (ctx: AssemblyContext, params: AssemblyParams) => unknown

/** 监控工厂：根据 ctx 解析依赖 + params，返回可启停的监控提供者（A5 接缝：MonitorProvider） */
export type MonitorFactory = (ctx: AssemblyContext, params: AssemblyParams) => MonitorProvider

/** 插件工厂：根据 ctx + params 构建 GovPlugin（bus/toolRegistry 经 ctx 解析后注入） */
export type PluginFactory = (ctx: AssemblyContext, params: AssemblyParams) => GovPlugin
