/**
 * assembly/factories.ts — 配置驱动装配的代码注册表层（方案 A1 · T2）
 *
 * 两层模型的注册表层：把 main.ts 中硬编码的「怎么创建实例」集中到三个注册表：
 *  - serviceFactories：服务工厂（装配器实例化后注册到 container）
 *  - monitorFactories：监控 runner 工厂（装配器据此生成 MONITOR_RUNNERS）
 *  - pluginFactories：插件工厂（装配器据此依次 install 到 PluginRegistry）
 *
 * 依赖统一经 ctx.resolve() 从容器解析（消除直接 import 单例的技术债）；
 * 参数经 ctx.params 透传（阈值等，字段由各工厂约定，默认值兜底）。
 */

import type {
  AssemblyContext,
  AssemblyParams,
  ServiceFactory,
  MonitorFactory,
  PluginFactory,
} from '../config/assemblySchema'
import type { GovernanceLoggerLike } from '../events/governanceLogger'
import type { MonitorProvider } from '../monitoring/monitorProvider'
import { createMonitorProvider } from '../monitoring/monitorProvider'
import { initSecurityKnowledgeBase, SecurityKnowledgeBase } from '../securityKnowledgeBase'
import {
  FileMonitor,
  ClipboardMonitor,
  ProcessMonitor,
  NetworkMonitor,
  ApiCallMonitor,
} from '../monitoring'
import { BehaviorRiskScorer } from '../monitoring/behaviorRiskScorer'
import { StorageService, TrayService, ApiService, BackendService } from '../services'
import { MemoryMonitorService } from '../services/memoryMonitor'
import { CPUMonitor } from '../services/cpuMonitor'
import { GovernanceHealthMonitor } from '../services/governanceHealthMonitor'
import { ToolRegistry } from '../agent/toolRegistry'
import type { ToolBridge } from '../agent/toolBridge'
import { createRiskSummaryPlugin } from '../agent/plugins/riskSummaryPlugin'
import { createPetPlugin, PetDriver } from '../agent/plugins/petPlugin'
import {
  McpServerService,
  createMcpAuthenticator,
  createBackendJwtVerifier,
  loadMcpApiKeyConfig,
  DEFAULT_MCP_HOST,
  DEFAULT_MCP_PORT,
} from '../mcp'

/** 从 params 读取 number 参数（非法/缺失时回退默认值） */
function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** 从 params 读取 string 参数（非法/缺失时回退默认值） */
function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

// ============================================================
// 服务工厂注册表
// ============================================================
export const serviceFactories: Record<string, ServiceFactory> = {
  securityKB: () => initSecurityKnowledgeBase(),

  fileMonitor: (ctx) => {
    const monitor = new FileMonitor()
    monitor.setSecurityKnowledgeBase(ctx.resolve<SecurityKnowledgeBase>('securityKB'))
    return monitor
  },

  clipboardMonitor: (ctx) => {
    const monitor = new ClipboardMonitor()
    monitor.setSecurityKnowledgeBase(ctx.resolve<SecurityKnowledgeBase>('securityKB'))
    return monitor
  },

  storageService: () => new StorageService(),
  trayService: () => new TrayService(),
  apiService: () => new ApiService(),
  backendService: () => new BackendService(),

  memoryMonitor: (_ctx, params) =>
    new MemoryMonitorService({
      interval: asNumber(params.interval, 10000),
      warningThreshold: asNumber(params.warningThreshold, 70),
      criticalThreshold: asNumber(params.criticalThreshold, 85),
    }),

  cpuMonitor: (_ctx, params) =>
    new CPUMonitor({
      interval: asNumber(params.interval, 5000),
      warningThreshold: asNumber(params.warningThreshold, 80),
      criticalThreshold: asNumber(params.criticalThreshold, 95),
      historyRetentionTime: asNumber(params.historyRetentionTime, 60000),
    }),

  healthMonitor: (ctx) =>
    new GovernanceHealthMonitor(
      ctx.resolve<MemoryMonitorService>('memoryMonitor'),
      ctx.resolve<CPUMonitor>('cpuMonitor'),
    ),

  behaviorRiskScorer: () => new BehaviorRiskScorer(),

  processMonitor: (ctx) => {
    const monitor = new ProcessMonitor()
    // 工具会话结束联动：用会话时间窗查询文件监控关联其操作过的文件（依赖经容器解析）
    monitor.setRelatedFilesResolver((sessionStart, sessionEnd) =>
      ctx.resolve<FileMonitor>('fileMonitor').getRelatedFilePaths(sessionStart, sessionEnd),
    )
    return monitor
  },

  networkMonitor: () => new NetworkMonitor(),
  apiCallMonitor: () => new ApiCallMonitor(),
  toolRegistry: () => new ToolRegistry(),

  // MCP Server（方案 C）：把治理能力暴露给外部 agent（dsh）
  //  - 鉴权：API Key（首次启动持久化到 userData/data/mcpServer.json）+ 桌面端 JWT 双通道，fail-closed
  //  - 工具执行惰性解析 toolRegistry/toolBridge（bootstrap 组装完成后才可用，start 时才调用）
  mcpServer: (ctx, params) =>
    new McpServerService({
      logger: ctx.logger,
      host: asString(params.host, DEFAULT_MCP_HOST),
      port: asNumber(params.port, DEFAULT_MCP_PORT),
      authenticate: createMcpAuthenticator({
        logger: ctx.logger,
        getApiKey: () => loadMcpApiKeyConfig(ctx.getUserDataPath()).apiKey,
        verifyJwt: createBackendJwtVerifier(ctx.logger),
      }),
      getToolRegistry: () => ctx.resolve<ToolRegistry>('toolRegistry'),
      getToolBridge: () => ctx.resolve<ToolBridge>('toolBridge'),
    }),
}

// ============================================================
// 监控 runner 工厂注册表（key → 可启停 runner；对齐 main.ts MONITOR_RUNNERS）
// ============================================================

/**
 * 构建带详细日志的监控提供者（A5：MonitorProvider）：resolve → 调用 → 结果 三段日志，失败带异常堆栈。
 * 所有 start/stop 都经过统一包装：调用前有开始标记、成功有确认、失败有堆栈且向上抛出；
 * 运行状态经 createMonitorProvider 自动跟踪（start 成功→isRunning=true，stop 成功→false）。
 */
export function createMonitorRunner<T>(
  key: string,
  label: string,
  logger: GovernanceLoggerLike,
  resolve: () => T,
  doStart: (instance: T) => void,
  doStop: (instance: T) => void,
): MonitorProvider {
  const invoke = (action: 'start' | 'stop', fn: (instance: T) => void) => {
    logger.debug(`[监控] ${label}${action}开始`, { module: 'MonitorRegistry', monitor: key, action })
    try {
      const instance = resolve()
      logger.debug(`[监控] ${label} 依赖解析成功`, { module: 'MonitorRegistry', monitor: key, action, resolved: true })
      fn(instance)
      logger.info(`[监控] ${label}${action === 'start' ? '已启动' : '已停止'}`, { module: 'MonitorRegistry', monitor: key, action, success: true })
    } catch (error) {
      logger.error(`[监控] ${label}${action === 'start' ? '启动' : '停止'}失败`, { module: 'MonitorRegistry', monitor: key, action, success: false, error })
      throw error
    }
  }
  return createMonitorProvider(key, label, () => invoke('start', doStart), () => invoke('stop', doStop))
}

/** 监控工厂：key → 生成可启停的监控提供者（依赖经 ctx 解析） */
export const monitorFactories: Record<string, MonitorFactory> = {
  file: (ctx) =>
    createMonitorRunner('file', '文件系统监控', ctx.logger, () => ctx.resolve<FileMonitor>('fileMonitor'), (m) => m.start(), (m) => m.stop()),
  clipboard: (ctx) =>
    createMonitorRunner('clipboard', '剪贴板监控', ctx.logger, () => ctx.resolve<ClipboardMonitor>('clipboardMonitor'), (m) => m.start(), (m) => m.stop()),
  process: (ctx) =>
    createMonitorRunner('process', '进程监控', ctx.logger, () => ctx.resolve<ProcessMonitor>('processMonitor'), (m) => m.start(), (m) => m.stop()),
  network: (ctx) =>
    createMonitorRunner('network', '网络请求监控', ctx.logger, () => ctx.resolve<NetworkMonitor>('networkMonitor'), (m) => m.start(), (m) => m.stop()),
  apiCall: (ctx) =>
    createMonitorRunner('apiCall', 'API 调用监控', ctx.logger, () => ctx.resolve<ApiCallMonitor>('apiCallMonitor'), (m) => m.start(), (m) => m.stop()),
  resource: (ctx) =>
    createMonitorProvider(
      'resource',
      '资源监控（内存/CPU）',
      () => {
        ctx.resolve<MemoryMonitorService>('memoryMonitor').start()
        ctx.resolve<CPUMonitor>('cpuMonitor').start()
      },
      () => {
        ctx.resolve<MemoryMonitorService>('memoryMonitor').stop()
        ctx.resolve<CPUMonitor>('cpuMonitor').stop()
      },
    ),
}

// ============================================================
// 插件工厂注册表（id → GovPlugin；bus/toolRegistry 由装配器经 ctx 提供）
// ============================================================
export const pluginFactories: Record<string, PluginFactory> = {
  'risk-summary': (ctx) => createRiskSummaryPlugin({ logger: ctx.logger }),

  'governance-pet': (ctx) =>
    createPetPlugin(ctx.resolve<PetDriver>('petDriver'), { logger: ctx.logger }),
}
