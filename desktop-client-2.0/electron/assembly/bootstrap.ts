/**
 * assembly/bootstrap.ts — 治理型 Agent 栈组装（方案 A1 · T4）
 *
 * 把 main.ts 中「治理栈」的运行时特殊接线集中到一处：
 *  - 内置工具注册（file/verify/evidence/report/risk/backend 六组）
 *  - 后端客户端 / evidence 本地降级 / risk 标签 的模块级副作用配置
 *  - ToolBridge（共享 HooksHost）、RulePlanner、GovernanceEngine 组装
 *
 * UI 生命周期回调（权限门控 / 系统通知 / 二次确认弹窗）经 opts 注入，本模块不依赖具体窗口实现。
 * 可枚举的服务 / 监控 / 插件由 assembler 配置驱动装配，本模块只处理无法配置化的运行时接线。
 */

import * as path from 'path'
import type { App } from 'electron'
import type { DIContainer } from '../di/container'
import type { GovernanceLoggerLike } from '../events/governanceLogger'
import type { AgentEventBus } from '../events/agentEventBus'
import type { PermissionConfig } from '../permissions/permissionConfig'
import type { HighRiskConfirmation } from '../monitoring'
import type { StorageService } from '../services'
import type { SmartAlerter } from '../monitoring/smartAlerter'
import type { McpServerService } from '../mcp/mcpServerService'
import {
  ToolRegistry,
  ToolBridge,
  RulePlanner,
  GovernanceEngine,
  PluginRegistry,
  createFileTools,
  createVerifyTools,
  createEvidenceTools,
  createReportTools,
  createRiskTools,
  createBackendTools,
  setBackendClientConfig,
  setEvidenceConfig,
  setRiskConfig,
} from '../agent'

/** 治理栈组装的外部依赖（UI 回调与运行时句柄，由 main.ts 提供） */
export interface GovernanceStackOpts {
  logger: GovernanceLoggerLike
  bus: AgentEventBus
  container: DIContainer
  /** 主进程 app（risk 标签文件路径等） */
  app: App
  /** 插件注册表（调用方已创建；hooks 由 toolBridge / 引擎共享） */
  pluginRegistry: PluginRegistry
  storageService: StorageService
  /** 写操作权限门控（fail-closed） */
  getPermissionConfig: () => PermissionConfig
  /** 系统通知（治理告警） */
  notify: (title: string, body: string) => void
  /** 写操作二次确认弹窗（高风险 / 未知语义工具） */
  showRiskConfirmDialog: (info: HighRiskConfirmation) => Promise<boolean>
}

/** 治理栈装配产物 */
export interface GovernanceStack {
  toolRegistry: ToolRegistry
  toolBridge: ToolBridge
  planner: RulePlanner
  governanceEngine: GovernanceEngine
}

/**
 * 共享写操作权限策略（fail-closed）：GovernanceEngine 决策 + MCP canUseTool 共用同一套策略。
 *  - 未授权 agentWrite → 拒绝
 *  - evidence.commit / risk.mark 存证类自动放行
 *  - 其余写操作 → 高风险二次确认弹窗（critical 标为 critical，其余按 high）
 */
function createAgentWriteHook(opts: GovernanceStackOpts, logger: GovernanceLoggerLike) {
  return async (
    tool: string,
    input: unknown,
    meta: { riskLevel?: 'warning' | 'critical'; reason?: string } = {},
  ): Promise<boolean> => {
    if (!opts.getPermissionConfig().granted.agentWrite) {
      logger.warn('[权限] 治理 Agent 写操作未授权，已拒绝', { module: 'PermissionGate' }, { tool, riskLevel: meta.riskLevel, reason: meta.reason })
      return false
    }
    if (tool === 'evidence.commit' || tool === 'risk.mark') return true
    const inputRecord = (input ?? {}) as Record<string, unknown>
    return opts.showRiskConfirmDialog({
      filePath: String(inputRecord.path ?? inputRecord.object ?? inputRecord.tool ?? 'unknown'),
      fileName: String(inputRecord.object ?? inputRecord.tool ?? '未知工具'),
      fileKind: 'normal',
      hash: '',
      previousHash: '',
      hashChanged: false,
      operationType: 'agent_write',
      riskLevel: meta.riskLevel === 'critical' ? 'critical' : 'high',
      riskTags: [String(tool)],
      message: `治理引擎请求执行 ${tool}${meta.reason ? `：${meta.reason}` : ''}`,
    })
  }
}

/** 组装治理型 Agent 栈（toolRegistry 由装配器创建，此处补充内置工具并完成接线） */
export function createGovernanceStack(opts: GovernanceStackOpts): GovernanceStack {
  const { logger, container } = opts
  // A4：告警器从容器 resolve 共享单例（不再直接 import）
  const smartAlerter = container.resolve<SmartAlerter>('smartAlerter')

  // 1) 工具注册表（由装配器创建并注册容器）：补充注册全部内置治理工具
  const toolRegistry = container.resolve<ToolRegistry>('toolRegistry')
  for (const tool of [
    ...createFileTools(),
    ...createVerifyTools(),
    ...createEvidenceTools(),
    ...createReportTools(),
    ...createRiskTools(),
    ...createBackendTools(),
  ]) {
    toolRegistry.register(tool)
  }

  // 2) 模块级副作用配置：后端真实配置 / evidence 本地降级 / risk 标签持久化
  setBackendClientConfig({
    baseUrl: 'http://localhost:8000',
    logger,
    retry: { maxRetries: 2, baseDelayMs: 1000, maxDelayMs: 5000 },
  })
  setEvidenceConfig({
    localFallback: async (content, metadata) => {
      const action = String((metadata as { action?: unknown } | null)?.action ?? 'evidence')
      return opts.storageService.saveOperation({
        id: `evidence-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: 'governance_evidence',
        title: `五元组存证 ${action}`,
        content,
        source: 'governance_agent',
        status: 'recorded',
        risk_level: 'info',
        risk_score: 0,
        should_block: false,
        context: JSON.stringify(metadata),
        explanation: '后端不可用时的本地存证降级',
      })
    },
  })
  const riskTagsFile = path.join(opts.app.getPath('userData'), 'governance', 'risk-tags.json')
  setRiskConfig({
    filePath: riskTagsFile,
    notify: (tag) => {
      try {
        container.resolve<{ send: (channel: string, ...args: unknown[]) => void }>('mainWindow').send('governance-risk-marked', tag)
      } catch {
        // 主窗口未就绪时忽略（风险标记已落盘）
      }
    },
  })

  // 3) 规划层 + 执行分发桥（共享 HooksHost，插件 AOP 挂点接入 ToolBridge）
  const planner = new RulePlanner({ logger })
  const toolBridge = new ToolBridge(toolRegistry, {
    bus: opts.bus,
    logger,
    onProgress: (p) => logger.info('[工具] 进度', { module: 'ToolBridge' }, p),
    hooks: opts.pluginRegistry.hooks,
  })

  // 4) 治理引擎（决策 + 告警接线）
  // 写操作权限策略与 MCP Server 共用（createAgentWriteHook），保证引擎与外部调用一致（fail-closed）
  const agentWriteHook = createAgentWriteHook(opts, logger)
  const governanceEngine = new GovernanceEngine(
    { bus: opts.bus, bridge: toolBridge, planner, logger },
    {
      maxConcurrentReadonly: 3,
      hooks: opts.pluginRegistry.hooks,
      decision: async ({ tool, input, riskLevel, reason }) =>
        agentWriteHook(tool, input, { riskLevel, reason }),
      alert: ({ level, title, description, runId, stream }) => {
        const alertResult = smartAlerter.handleAlert({
          riskLevel: level,
          riskType: 'governance',
          message: description,
        })
        if (alertResult.shouldNotify) {
          opts.notify(title, description.slice(0, 80))
        }
        logger.warn('[治理Agent] 治理告警', { module: 'GovernanceEngine' }, { level, title, description, runId, stream })
      },
    },
  )
  governanceEngine.start()

  // 注册容器（cleanup / IPC 使用）
  container.register('toolBridge', toolBridge)
  container.register('governanceEngine', governanceEngine)

  // MCP Server（方案 C）：注入与治理引擎同一套写操作权限策略（fail-closed）
  if (container.has('mcpServer')) {
    container.resolve<McpServerService>('mcpServer').setCanUseTool(agentWriteHook)
    logger.info('[治理Agent] MCP Server 已接入写操作权限策略', { module: 'McpServer' })
  }

  logger.info('[治理Agent] 治理栈已组装', { module: 'GovernanceEngine' }, {
    toolCount: toolRegistry.size,
    riskTagsFile,
    hooks: opts.pluginRegistry.hooks ? 'plugin-hooks-host' : 'none',
  })

  return { toolRegistry, toolBridge, planner, governanceEngine }
}
