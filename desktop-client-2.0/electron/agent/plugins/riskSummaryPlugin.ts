/**
 * agent/plugins/riskSummaryPlugin.ts — 示例 Skill 插件（OpenClaw 插件化落地示例）
 *
 * 演示阶段 D（Skill 插件化）：把"风险概览"能力封装成插件，订阅感知流 + 注入只读工具，
 * 无需修改主进程核心逻辑即可扩展治理能力。
 *
 * 关键机制（对齐 OpenClaw `plugins/runtime.ts`）：
 *  - subscribe(bus)：订阅感知流（file/process/network/clipboard/api_call/resource），
 *    对 warning/critical 风险事件做单飞去重登记（runOncePerAgentRun 防事件风暴）
 *  - registerTools(registry)：注入只读工具 `risk.summary`，返回近期风险统计
 *  - 生命周期：install 时激活、uninstall 时清理退订与缓存
 *
 * 详见 docs/AGENT_FUSION_MODULE_DESIGN.md §3 M7 / §5 阶段 D
 */

import type { AgentEventBus, AgentEventEnvelope, RiskEventData } from '../../events/agentEventBus'
import type { GovernanceLoggerLike } from '../../events/governanceLogger'
import type { RiskAssessment } from '../hooks/types'
import { ToolRegistry } from '../toolRegistry'
import { runOncePerAgentRun } from '../pluginRegistry'
import type { GovTool } from '../types'

/** 感知流白名单（对齐 MonitorEventAdapter 映射） */
const PERCEPTION_STREAMS = ['file', 'process', 'network', 'clipboard', 'api_call', 'resource'] as const

/** 风险统计条目 */
export interface RiskSummaryEntry {
  source: string
  severity: 'warning' | 'critical'
  path?: string
  tool?: string
  apiUrl?: string
  /** 治理决策视图（source=governance）附加字段：引擎定级结果 */
  hasVerifyFlow?: boolean
  hasVerify?: boolean
  anyFailed?: boolean
  ts: number
  runId: string
  seq: number
}

/** 插件配置 */
export interface RiskSummaryPluginConfig {
  /** 保留的最近风险条目上限（默认 200） */
  maxEntries?: number
  /** 仅统计 >= 该等级的严重度（默认 warning） */
  minSeverity?: 'warning' | 'critical'
}

/** 默认配置 */
const DEFAULT_CONFIG: Required<RiskSummaryPluginConfig> = {
  maxEntries: 200,
  minSeverity: 'warning',
}

const silentLogger: GovernanceLoggerLike = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  trace: () => {},
}

/** 构建风险概览 Skill 插件 */
export function createRiskSummaryPlugin(opts?: {
  logger?: GovernanceLoggerLike
  config?: RiskSummaryPluginConfig
}) {
  const logger = opts?.logger ?? silentLogger
  const config = { ...DEFAULT_CONFIG, ...(opts?.config ?? {}) }
  /** 按事件顺序登记的风险条目 */
  const entries: RiskSummaryEntry[] = []
  let active = false

  /** 从风险事件载荷提取摘要字段（按 source 分支） */
  function extract(data: RiskEventData): Pick<RiskSummaryEntry, 'path' | 'tool' | 'apiUrl'> {
    switch (data.source) {
      case 'file':
        return { path: data.file?.path, tool: undefined, apiUrl: undefined }
      case 'process':
        return { path: undefined, tool: data.process?.tool, apiUrl: undefined }
      case 'api_call':
        return { path: undefined, tool: undefined, apiUrl: data.apiCall?.url }
      default:
        return { path: undefined, tool: undefined, apiUrl: undefined }
    }
  }

  /** 登记一条风险（按 seq 单调追加 + 有界裁剪） */
  function record(env: AgentEventEnvelope, data: RiskEventData): void {
    const detail = extract(data)
    entries.push({
      source: data.source,
      severity: data.severity as 'warning' | 'critical',
      path: detail.path,
      tool: detail.tool,
      apiUrl: detail.apiUrl,
      ts: env.ts,
      runId: env.runId,
      seq: env.seq,
    })
    if (entries.length > config.maxEntries) {
      entries.splice(0, entries.length - config.maxEntries)
    }
  }

  /** 登记治理决策视图（来自 onRiskAssessed 钩子，source=governance；调用前已过滤 info） */
  function recordGovernance(assessment: RiskAssessment): void {
    entries.push({
      source: 'governance',
      severity: assessment.severity as 'warning' | 'critical',
      hasVerifyFlow: assessment.hasVerifyFlow,
      hasVerify: assessment.hasVerify,
      anyFailed: assessment.anyFailed,
      ts: Date.now(),
      runId: assessment.runId,
      seq: 0,
    })
    if (entries.length > config.maxEntries) {
      entries.splice(0, entries.length - config.maxEntries)
    }
    logger.trace('[插件] 治理决策已登记', { module: 'PluginRegistry', pluginId: 'risk-summary' }, {
      runId: assessment.runId,
      stream: assessment.stream,
      severity: assessment.severity,
      hasVerifyFlow: assessment.hasVerifyFlow,
      anyFailed: assessment.anyFailed,
    })
  }

  return {
    id: 'risk-summary',
    version: '1.0.0',
    description: '风险概览 Skill：订阅感知流，统计近期 warning/critical 风险事件，并提供 risk.summary 只读工具',

    /** 订阅感知流：对风险事件做单飞去重登记（防事件风暴重复入账） */
    subscribe(bus: AgentEventBus): Array<() => void> {
      active = true
      return PERCEPTION_STREAMS.map((stream) =>
        bus.subscribe(stream, (env) => {
          const data = env.data as RiskEventData | undefined
          if (!data || !data.source || data.source !== stream) return
          // 仅登记达到最低严重度的风险
          if (data.severity !== 'warning' && data.severity !== 'critical') return
          if (config.minSeverity === 'critical' && data.severity !== 'critical') return

          // 单飞去重：同一 runId 同 stream 的风险只登记一次（事件风暴去重）
          const key = `${env.runId}:${stream}:risk-summary`
          runOncePerAgentRun(key, async () => {
            record(env, data)
            logger.trace('[插件] 风险事件登记', { module: 'PluginRegistry', pluginId: 'risk-summary' }, {
              runId: env.runId,
              seq: env.seq,
              stream,
              severity: data.severity,
              riskScore: data.riskScore,
            })
            return true
          }, logger).catch(() => {})
        }),
      )
    },

    /** 决策链路钩子（P1 新契约）：观察引擎定级结果，登记治理决策视图（source=governance） */
    hooks: {
      onRiskAssessed(assessment: RiskAssessment): void {
        // 与感知流路径过滤一致：仅观察 warning/critical 的治理决策
        if (assessment.severity === 'info') return
        if (config.minSeverity === 'critical' && assessment.severity !== 'critical') return
        recordGovernance(assessment)
      },
    },

    /** 注入只读工具：risk.summary（返回近期风险统计） */
    registerTools(registry: ToolRegistry): void {
      const tool: GovTool = {
        name: 'risk.summary',
        description: '返回近期风险事件概览（感知视图按流分组统计 + 治理决策视图 source=governance + 最近风险列表）。只读工具，不产生任何修改。',
        inputSchema: {
          type: 'object',
          properties: {
            severity: {
              type: 'string',
              enum: ['warning', 'critical', 'all'],
              description: '按严重度过滤（默认 all）',
            },
            source: {
              type: 'string',
              description: '按来源过滤（file/process/network/clipboard/api_call/resource/governance）',
            },
          },
        },
        isReadOnly: () => true,
        isConcurrencySafe: () => true,
        async run(input: { severity?: 'warning' | 'critical' | 'all'; source?: string }) {
          if (!active) {
            return {
              output: { active: false, entries: 0 },
              content: 'risk-summary 插件未激活，无风险统计',
            }
          }
          const severityFilter = input.severity ?? 'all'
          const sourceFilter = input.source
          const filtered = entries.filter((e) => {
            if (severityFilter !== 'all' && e.severity !== severityFilter) return false
            if (sourceFilter && e.source !== sourceFilter) return false
            return true
          })
          // 按流分组统计
          const bySource: Record<string, number> = {}
          const bySeverity: Record<string, number> = {}
          for (const e of filtered) {
            bySource[e.source] = (bySource[e.source] ?? 0) + 1
            bySeverity[e.severity] = (bySeverity[e.severity] ?? 0) + 1
          }
          const recent = filtered.slice(-20).reverse()
          return {
            output: { active: true, total: filtered.length, bySource, bySeverity, recent },
            content: `近期风险事件 ${filtered.length} 条（${Object.entries(bySource).map(([s, c]) => `${s}:${c}`).join(', ') || '无'}）`,
          }
        },
      }
      registry.register(tool)
      logger.info('[插件] risk.summary 工具已注入', { module: 'PluginRegistry', pluginId: 'risk-summary' })
    },

    /** 卸载钩子：清空缓存 */
    onUninstall(): void {
      active = false
      entries.length = 0
      logger.info('[插件] risk-summary 已卸载（缓存已清空）', { module: 'PluginRegistry', pluginId: 'risk-summary' })
    },
  }
}
