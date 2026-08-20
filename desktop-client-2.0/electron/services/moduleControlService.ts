/**
 * services/moduleControlService.ts — 内部诊断通道（统一控制面 · 能力透明架构）
 *
 * 职责：聚合桌面端本地能力单元 + 云端能力单元的运行状态（state/health/version/心跳），
 * 提供统一日志级别控制（全局 + 按模块覆盖）与消费预算闸门实时额度查询。
 *
 * 定位：**内部运维/诊断通道**，仅供日志、调试、故障排查使用；
 * 不面向用户展示，无品牌名、无模块管理面板。能力单元标识（moduleId）只出现在内部 context 字段。
 *
 * 降级原则：云端接口未实现 / 后端未就绪时不阻塞，回退 unknown 占位；
 * 本地能力单元状态始终可用（本地先聚合，云端失败仅影响云端部分）。
 *
 * 详见 docs/P0-UNIFIED-CONTROL-PLANE-API.md
 */

import axios from 'axios'
import type { GovernanceLoggerLike, GovernanceLogLevelState } from '../events/governanceLogger'
import { loadGovernanceLogLevelState, saveGovernanceLogLevelState } from '../events/governanceLogger'
import type { GovernanceLogger } from '../events/governanceLogger'
import { LogLevel } from './loggerService'
import type { AgentEventBus } from '../events/agentEventBus'
import type { PluginRegistry } from '../agent/pluginRegistry'
import type { McpServerService } from '../mcp/mcpServerService'
import type { ApiCallMonitor } from '../monitoring'
import type { MemoryMonitorService } from './memoryMonitor'
import type { CPUMonitor } from './cpuMonitor'
import type { BackendService } from './backendService'
import type { ApiService } from './apiService'

// ============================================================================
// 统一模块状态数据结构（与 docs/P0-UNIFIED-CONTROL-PLANE-API.md §2 对齐）
// ============================================================================

export type ModuleKind = 'desktop' | 'cloud' | 'plugin'
export type ModuleState = 'running' | 'stopped' | 'starting' | 'error' | 'unknown'
export type ModuleHealth = 'healthy' | 'degraded' | 'unhealthy' | 'unknown'

export interface ModuleStatus {
  moduleId: string
  name: string
  kind: ModuleKind
  state: ModuleState
  health: ModuleHealth
  version: string
  lastHeartbeat: number | null
  uptimeSec: number | null
  metrics: Record<string, number | string>
  detail?: string
}

export interface ModuleSummary {
  total: number
  healthy: number
  degraded: number
  unhealthy: number
  unknown: number
  allHealthy: boolean
  lastUpdated: number
}

export interface DeepSeekQuotaStatus {
  globalUsed: number
  globalQuota: number
  userUsed: number
  userQuota: number
  circuitOpen: boolean
  circuitOpenedAt: number | null
  failureRate: number
  warnThreshold: number
  criticalThreshold: number
}

/** 服务依赖：依赖经容器 resolve 惰性解析（对齐 A4：消费方经容器获取，不直接 import 单例） */
export interface ModuleControlDeps {
  logger: GovernanceLoggerLike
  governanceLogger: GovernanceLogger
  resolve: <T>(name: string) => T | undefined
  /** 云端（Django 后端）地址，默认 http://127.0.0.1:8000 */
  cloudBaseUrl?: string
}

/** 云端拉取超时（ms） */
const CLOUD_FETCH_TIMEOUT = 3000

/** 云端能力单元定义（未实现/不可达时回退占位，保持诊断通道结构完整；无品牌名） */
const CLOUD_MODULES: Array<{ moduleId: string; name: string }> = [
  { moduleId: 'cloud.api', name: '云端后端' },
  { moduleId: 'cloud.celery', name: '异步任务' },
  { moduleId: 'cloud.redis', name: '缓存服务' },
  { moduleId: 'cloud.db', name: '数据存储' },
  { moduleId: 'cloud.budget-gate', name: '消费预算闸门' },
  { moduleId: 'cloud.inference-engine', name: '推理引擎（预留）' },
  { moduleId: 'cloud.compute-cluster', name: '推理集群（预留）' },
]

/** 汇总统计 */
export function computeModuleSummary(modules: ModuleStatus[]): ModuleSummary {
  let healthy = 0
  let degraded = 0
  let unhealthy = 0
  let unknown = 0
  for (const m of modules) {
    if (m.health === 'healthy') healthy++
    else if (m.health === 'degraded') degraded++
    else if (m.health === 'unhealthy') unhealthy++
    else unknown++
  }
  return {
    total: modules.length,
    healthy,
    degraded,
    unhealthy,
    unknown,
    allHealthy: healthy === modules.length,
    lastUpdated: Date.now(),
  }
}

export class ModuleControlService {
  private readonly logger: GovernanceLoggerLike
  private readonly governanceLogger: GovernanceLogger
  private readonly resolve: <T>(name: string) => T | undefined
  private readonly cloudBaseUrl: string

  constructor(deps: ModuleControlDeps) {
    this.logger = deps.logger
    this.governanceLogger = deps.governanceLogger
    this.resolve = deps.resolve
    this.cloudBaseUrl = deps.cloudBaseUrl ?? 'http://127.0.0.1:8000'
  }

  // ========================================================================
  // 状态聚合
  // ========================================================================

  /** 聚合本地 + 云端全部模块状态（云端失败降级为 unknown 占位，不阻断） */
  async getStatus(): Promise<{ summary: ModuleSummary; modules: ModuleStatus[] }> {
    const start = Date.now()
    const local = await this.collectLocalModuleStatuses()
    const cloud = await this.fetchCloudModuleStatuses()
    const modules = [...local, ...cloud]
    const summary = computeModuleSummary(modules)
    this.logger.info('[控制面] 模块状态聚合完成', { module: 'ModuleControlService', function: 'getStatus' }, {
      elapsedMs: Date.now() - start,
      local: local.length,
      cloud: cloud.length,
      total: summary.total,
      healthy: summary.healthy,
      unhealthy: summary.unhealthy,
      unknown: summary.unknown,
    })
    return { summary, modules }
  }

  /** 本地模块状态（desktop.*，共 7 个；依赖未装配时按 unknown 占位） */
  private async collectLocalModuleStatuses(): Promise<ModuleStatus[]> {
    const now = Date.now()
    const modules: ModuleStatus[] = []

    // desktop.agent：智能体引擎（事件总线 + 治理引擎 + 插件生态，吸收插件化能力）
    const bus = this.resolve<AgentEventBus>('agentEventBus')
    const pluginRegistry = this.resolve<PluginRegistry>('pluginRegistry')
    const busStats = bus?.getStats?.() ?? { published: 0, dropped: 0, activeStreams: 0 }
    modules.push({
      moduleId: 'desktop.agent',
      name: '智能体引擎（插件生态）',
      kind: 'desktop',
      state: 'running',
      health: 'healthy',
      version: '',
      lastHeartbeat: now,
      uptimeSec: null,
      metrics: {
        events: busStats.published,
        dropped: busStats.dropped,
        activeStreams: busStats.activeStreams,
        plugins: pluginRegistry?.list().length ?? 0,
      },
    })

    // desktop.mcp：MCP 服务（未装配 = unknown）
    const mcp = this.resolve<McpServerService>('mcpServer')
    const mcpRunning = mcp?.isRunning?.() ?? false
    modules.push({
      moduleId: 'desktop.mcp',
      name: 'MCP 服务',
      kind: 'desktop',
      state: mcp ? (mcpRunning ? 'running' : 'stopped') : 'unknown',
      health: mcp ? (mcpRunning ? 'healthy' : 'unknown') : 'unknown',
      version: '',
      lastHeartbeat: now,
      uptimeSec: null,
      metrics: { url: mcp?.getUrl?.() ?? '', running: mcpRunning ? 1 : 0 },
      detail: !mcp ? 'MCP 服务未装配（未在装配配置中启用）' : undefined,
    })

    // desktop.sandbox：沙箱执行器（Python 沙箱 API 进程；未装配 = unknown）
    const sandbox = this.resolve<ApiService>('apiService')
    const sandboxRunning = sandbox?.isRunning?.() ?? false
    modules.push({
      moduleId: 'desktop.sandbox',
      name: '沙箱执行器',
      kind: 'desktop',
      state: sandbox ? (sandboxRunning ? 'running' : 'stopped') : 'unknown',
      health: sandbox ? (sandboxRunning ? 'healthy' : 'unknown') : 'unknown',
      version: '',
      lastHeartbeat: now,
      uptimeSec: null,
      metrics: { running: sandboxRunning ? 1 : 0 },
      detail: !sandbox ? '沙箱执行器未装配' : undefined,
    })

    // desktop.api-proxy：API 调用监控代理
    const apiCall = this.resolve<ApiCallMonitor>('apiCallMonitor')
    const apiStatus = apiCall?.getStatus?.()
    const apiRunning = apiStatus?.running ?? false
    modules.push({
      moduleId: 'desktop.api-proxy',
      name: 'API 调用监控代理',
      kind: 'desktop',
      state: apiCall ? (apiRunning ? 'running' : 'stopped') : 'unknown',
      health: apiCall ? 'healthy' : 'unknown',
      version: '',
      lastHeartbeat: now,
      uptimeSec: null,
      metrics: {
        enabled: apiStatus?.enabled ? 1 : 0,
        port: apiStatus?.port ?? 0,
        captured: apiStatus?.recordCount ?? 0,
      },
      detail: !apiCall ? 'API 调用监控未装配' : undefined,
    })

    // desktop.monitor.cpu / desktop.monitor.memory：资源监控（独立上报运行态）
    const cpu = this.resolve<CPUMonitor>('cpuMonitor')
    const cpuRunning = cpu?.isRunning?.() ?? false
    modules.push({
      moduleId: 'desktop.monitor.cpu',
      name: 'CPU 监控器',
      kind: 'desktop',
      state: cpu ? (cpuRunning ? 'running' : 'stopped') : 'unknown',
      health: cpu ? 'healthy' : 'unknown',
      version: '',
      lastHeartbeat: now,
      uptimeSec: null,
      metrics: { running: cpuRunning ? 1 : 0 },
      detail: !cpu ? 'CPU 监控器未装配' : undefined,
    })

    const memory = this.resolve<MemoryMonitorService>('memoryMonitor')
    const memoryRunning = memory?.getStatus?.().isMonitoring ?? false
    modules.push({
      moduleId: 'desktop.monitor.memory',
      name: '内存监控器',
      kind: 'desktop',
      state: memory ? (memoryRunning ? 'running' : 'stopped') : 'unknown',
      health: memory ? 'healthy' : 'unknown',
      version: '',
      lastHeartbeat: now,
      uptimeSec: null,
      metrics: { running: memoryRunning ? 1 : 0 },
      detail: !memory ? '内存监控器未装配' : undefined,
    })

    // desktop.backend：内置 Django 后端（在线检测）
    const backend = this.resolve<BackendService>('backendService')
    let backendOnline = false
    let backendDetail: string | undefined
    if (backend) {
      try {
        backendOnline = await backend.isBackendOnline()
      } catch (error) {
        backendDetail = error instanceof Error ? error.message : String(error)
      }
    } else {
      backendDetail = '后端服务未装配'
    }
    modules.push({
      moduleId: 'desktop.backend',
      name: '内置 Django 后端',
      kind: 'desktop',
      state: backend ? (backendOnline ? 'running' : 'stopped') : 'unknown',
      health: backend ? (backendOnline ? 'healthy' : 'unhealthy') : 'unknown',
      version: '',
      lastHeartbeat: now,
      uptimeSec: null,
      metrics: { online: backendOnline ? 1 : 0, port: 8000 },
      detail: backendDetail,
    })

    return modules
  }

  /** 云端模块状态：拉取 GET /api/modules/status；失败回退 unknown 占位 */
  private async fetchCloudModuleStatuses(): Promise<ModuleStatus[]> {
    try {
      const res = await axios.get(`${this.cloudBaseUrl}/api/modules/status`, { timeout: CLOUD_FETCH_TIMEOUT })
      const modules = res.data?.modules
      if (Array.isArray(modules)) {
        this.logger.debug('[控制面] 云端模块状态拉取成功', { module: 'ModuleControlService', function: 'fetchCloudModuleStatuses' }, {
          count: modules.length,
        })
        return modules as ModuleStatus[]
      }
      this.logger.warn('[控制面] 云端模块状态响应缺少 modules 字段，回退 unknown', { module: 'ModuleControlService', function: 'fetchCloudModuleStatuses' }, {
        hasData: !!res.data,
      })
    } catch (error) {
      this.logger.warn('[控制面] 云端模块状态拉取失败，回退 unknown（不影响本地模块）', { module: 'ModuleControlService', function: 'fetchCloudModuleStatuses' }, {
        error: error instanceof Error ? error.message : String(error),
      })
    }
    const now = Date.now()
    return CLOUD_MODULES.map((def) => ({
      moduleId: def.moduleId,
      name: def.name,
      kind: 'cloud' as const,
      state: 'unknown' as const,
      health: 'unknown' as const,
      version: '',
      lastHeartbeat: now,
      uptimeSec: null,
      metrics: {},
    }))
  }

  // ========================================================================
  // 日志级别控制（全局 + 按模块覆盖）
  // ========================================================================

  /** 当前日志级别状态：运行中全局级别（实时）+ 持久化的按模块覆盖 */
  getLogLevel(): GovernanceLogLevelState {
    const persisted = loadGovernanceLogLevelState()
    return { level: this.governanceLogger.getLevel(), overrides: persisted.overrides }
  }

  /**
   * 设置日志级别：
   *  - moduleId 为空 → 全局默认（立即切换 GovernanceLogger 运行级别 + 持久化）
   *  - moduleId 指定 → 写入按模块覆盖（持久化；模块级过滤由各模块后续接入时消费）
   */
  setLogLevel(level: LogLevel, moduleId?: string): GovernanceLogLevelState {
    const persisted = loadGovernanceLogLevelState()
    if (moduleId) {
      persisted.overrides = { ...persisted.overrides, [moduleId]: level }
      this.logger.info('[控制面] 设置模块日志级别覆盖', { module: 'ModuleControlService', function: 'setLogLevel' }, { moduleId, level })
    } else {
      persisted.level = level
      this.governanceLogger.setLevel(level)
      this.logger.info('[控制面] 设置全局日志级别', { module: 'ModuleControlService', function: 'setLogLevel' }, { level })
    }
    saveGovernanceLogLevelState(persisted)
    return this.getLogLevel()
  }

  // ========================================================================
  // DeepSeek 预算闸门实时额度
  // ========================================================================

  /** 查询预算闸门实时额度（云端 GET /api/deepseek/quota；失败返回 error，不抛） */
  async getDeepSeekQuota(): Promise<{ ok: boolean; quota?: DeepSeekQuotaStatus; error?: string }> {
    try {
      const res = await axios.get(`${this.cloudBaseUrl}/api/deepseek/quota`, { timeout: CLOUD_FETCH_TIMEOUT })
      const quota = res.data?.quota as DeepSeekQuotaStatus | undefined
      if (!quota) {
        return { ok: false, error: '云端响应缺少 quota 字段' }
      }
      return { ok: true, quota }
    } catch (error) {
      this.logger.warn('[控制面] DeepSeek 额度查询失败', { module: 'ModuleControlService', function: 'getDeepSeekQuota' }, {
        error: error instanceof Error ? error.message : String(error),
      })
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  }
}
