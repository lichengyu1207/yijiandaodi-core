/**
 * agent/planner.ts — M5a 规划层：Planner 接口 + RulePlanner（LLMPlanner 预留）
 *
 * 来源：Claude queryLoop 的"规划"环节 + Grok 工具分发前"模型产出 AgentAction"。
 * 桌面端无本地 LLM，规划不依赖模型——用可插拔 Planner 解耦：
 *  - RulePlanner（默认）：风险事件 → 规则路由 → 拆解子任务（走哪个官/哪条路径）→ AgentAction[]
 *  - LLMPlanner（预留）：调后端 AgentChatView 做真实规划，接口不变
 *
 * 分级路由（对齐 AGENT_FUSION_MODULE_DESIGN.md §3 M5 接线）：
 *  - info    → 只发事件，不规划执行（或仅 context 采集）
 *  - warning → verify.run（单官校验，只读并发）+ 上下文存证（evidence.commit）
 *  - critical→ verify.flow（四官全流程）+ evidence.commit + risk.mark
 *
 * 详见 docs/AGENT_FUSION_MODULE_DESIGN.md §3 M5a
 */

import type { AgentEventEnvelope, RiskEventData } from '../events/agentEventBus'
import type { GovernanceLoggerLike } from '../events/governanceLogger'
import { DEFAULT_BACKOFF } from './retryWithBackoff'

// ============================================================================
// 类型定义
// ============================================================================

/** 感知流白名单（单一事实来源：RulePlanner 只路由感知流，不路由 tool/assistant 等治理流） */
export const PERCEPTION_STREAMS = ['file', 'process', 'network', 'clipboard', 'api_call', 'resource'] as const

/** 事件流名称的收敛类型：感知流 */
export type PerceptionStream = (typeof PERCEPTION_STREAMS)[number]

/** 规划产出：一个待执行的工具动作（对齐 Claude tool_use / Grok client_function） */
export interface AgentAction {
  /** 工具名（注册在 ToolRegistry 中） */
  tool: string
  /** 工具入参 */
  input: Record<string, unknown>
  /** 只读（并发安全，可批量并行）；非只读（写操作）串行执行 */
  readonly: boolean
  /** 子代理：auditor/verifier/archiver/judge（落在事件信封与五元组存证链） */
  agentId?: string
  /** 关联治理 run */
  runId: string
  /** 语义标签（排查用） */
  reason: string
}

/** 规划器接口：事件/风险 → AgentAction[]（可插拔：RulePlanner / LLMPlanner） */
export interface Planner {
  plan(event: AgentEventEnvelope, risk?: RiskEventData): Promise<AgentAction[]>
}

/** 规则路由配置（可注入，便于测试与定制） */
export interface RulePlannerConfig {
  /** 路径→文件操作映射（file 流） */
  fileOperationForPath?: (path: string) => 'create' | 'modify' | 'delete' | 'rename' | 'unknown'
  /** 路径→目标主体（文件对象） */
  fileObjectForPath?: (path: string) => string
  /** 五元组存证写入的超时配置（对齐 Grok retry.rs；网络型工具内建重试，此处仅随上下文传递） */
  backoff?: typeof DEFAULT_BACKOFF
}

// ============================================================================
// 工具函数
// ============================================================================

/** 判断事件流是否为感知流（仅感知流可触发规划） */
export function isPerceptionStream(stream: string): stream is PerceptionStream {
  return (PERCEPTION_STREAMS as readonly string[]).includes(stream)
}

// ============================================================================
// RulePlanner — 默认规则路由规划器
// ============================================================================

/**
 * 规则规划器：按事件流 + severity 路由到治理动作。
 * 无模型依赖，确定性、可测试；LLMPlanner 可在后续以相同接口替换。
 */
export class RulePlanner implements Planner {
  private log: GovernanceLoggerLike
  private config: Required<RulePlannerConfig>

  constructor(opts?: { logger?: GovernanceLoggerLike; config?: RulePlannerConfig }) {
    this.log = opts?.logger ?? {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
      trace: () => {},
    }
    this.config = {
      fileOperationForPath: opts?.config?.fileOperationForPath ?? (() => 'unknown'),
      fileObjectForPath: opts?.config?.fileObjectForPath ?? ((p: string) => p),
      backoff: opts?.config?.backoff ?? DEFAULT_BACKOFF,
    }
  }

  /** 规划入口：感知事件 → AgentAction[]（info 无动作；warning/critical 按流路由） */
  async plan(event: AgentEventEnvelope, risk?: RiskEventData): Promise<AgentAction[]> {
    const startedAt = performance.now()
    const { stream, runId } = event

    // 只路由感知流（治理流由主循环内部消费）
    if (!isPerceptionStream(stream)) return []

    const data = (event.data ?? {}) as RiskEventData
    const severity = data.severity ?? risk?.severity ?? 'info'

    // info：规划入口（性能排查关键节点 —— 记录到达，与出口 planMs 配对定位规划耗时）
    this.log.info('[规划] 事件到达，开始路由', { module: 'RulePlanner', function: 'plan' }, {
      runId,
      seq: event.seq,
      stream,
      severity,
      riskScore: data.riskScore ?? risk?.riskScore,
    })

    // trace：风险定级决策（原始载荷级别 + 回退级别 → 最终定级 + 路由去向）
    this.log.trace('[规划] 事件路由决策', { module: 'RulePlanner', function: 'plan' }, {
      runId,
      seq: event.seq,
      stream,
      eventSeverity: data.severity,
      riskSeverity: risk?.severity,
      riskScore: data.riskScore,
      resolvedSeverity: severity,
      route: severity === 'info' ? '仅登记（不规划执行）' : '规划执行',
    })

    if (severity === 'info') {
      this.log.debug('[规划] info 事件仅登记，不触发执行', { module: 'RulePlanner' }, { runId, stream })
      return []
    }

    const actions: AgentAction[] = []
    const source = stream === 'api_call' ? 'api_call' : (stream as PerceptionStream)

    // ---- 按流路由：file / process / network / clipboard / api_call / resource ----
    switch (source) {
      case 'file': {
        const file = data.file ?? {}
        const filePath = file.path ?? ''
        const op = this.config.fileOperationForPath(filePath)
        this.log.trace('[规划] file 分支决策', { module: 'RulePlanner', function: 'plan' }, {
          runId, filePath, op, riskScore: data.riskScore, severity,
        })
        actions.push(
          {
            tool: 'verify.run',
            input: { article_id: Number(filePath.split('/').pop()?.replace(/\D/g, '') || '0') || 0, agent_code: 'auditor' },
            readonly: true,
            runId,
            reason: `${op} 操作校验（auditor）`,
          },
          {
            tool: 'verify.flow',
            input: {
              session_id: `run_${runId}_file`,
              content: `${op} 文件 ${filePath || '未知'}，风险评分 ${data.riskScore ?? 0}`,
              operations: [{ type: 'file', operation: op, path: filePath, ts: event.ts }],
            },
            readonly: true,
            runId,
            reason: '四官全流程校验',
          },
        )
        break
      }

      case 'process': {
        const proc = data.process ?? {}
        actions.push({
          tool: 'verify.flow',
          input: {
            session_id: proc.sessionId ?? `run_${runId}_process`,
            content: `AI Agent 进程 ${proc.tool ?? '未知'} 已启动（session=${proc.sessionId ?? '未知'}）`,
            operations: [{ type: 'process', tool: proc.tool, sessionId: proc.sessionId, ts: event.ts }],
          },
          readonly: true,
          runId,
          reason: '四官全流程校验（进程）',
        })
        break
      }

      case 'network': {
        const apiCall = data.apiCall ?? {}
        this.log.trace('[规划] network 分支决策', { module: 'RulePlanner', function: 'plan' }, {
          runId, url: apiCall.url, method: apiCall.method, target: apiCall.target, riskScore: data.riskScore, severity,
        })
        actions.push({
          tool: 'verify.flow',
          input: {
            session_id: `run_${runId}_network`,
            content: `AI API 请求 ${apiCall.method ?? 'tcp'} ${apiCall.url ?? '未知'}（target=${apiCall.target ?? '未知'}）`,
            operations: [{ type: 'network', url: apiCall.url, method: apiCall.method, ts: event.ts }],
          },
          readonly: true,
          runId,
          reason: '四官全流程校验（网络）',
        })
        break
      }

      case 'clipboard': {
        this.log.trace('[规划] clipboard 分支决策', { module: 'RulePlanner', function: 'plan' }, {
          runId, riskScore: data.riskScore, severity,
        })
        actions.push({
          tool: 'verify.flow',
          input: {
            session_id: `run_${runId}_clipboard`,
            content: `剪贴板风险检测，评分 ${data.riskScore ?? 0}`,
            operations: [{ type: 'clipboard', riskScore: data.riskScore, ts: event.ts }],
          },
          readonly: true,
          runId,
          reason: '四官全流程校验（剪贴板）',
        })
        break
      }

      case 'api_call': {
        const apiCall = data.apiCall ?? {}
        this.log.trace('[规划] api_call 分支决策', { module: 'RulePlanner', function: 'plan' }, {
          runId, url: apiCall.url, method: apiCall.method, riskScore: data.riskScore, severity,
        })
        actions.push(
          {
            tool: 'verify.run',
            input: { article_id: 0, agent_code: 'auditor' },
            readonly: true,
            runId,
            reason: 'API 调用审计（auditor）',
          },
          {
            tool: 'verify.flow',
            input: {
              session_id: `run_${runId}_api_call`,
              content: `API 调用 ${apiCall.method ?? '未知'} ${apiCall.url ?? '未知'}，评分 ${data.riskScore ?? 0}`,
              operations: [{ type: 'api_call', url: apiCall.url, method: apiCall.method, ts: event.ts }],
            },
            readonly: true,
            runId,
            reason: '四官全流程校验（API 调用）',
          },
        )
        break
      }

      case 'resource': {
        // 资源告警不额外标记（避免与下方公共 critical 块重复）；severity 分级在公共块统一处理
        this.log.trace('[规划] resource 分支决策', { module: 'RulePlanner', function: 'plan' }, {
          runId, message: data.resource?.message, riskScore: data.riskScore, severity,
        })
        break
      }
    }

    // ---- 通用：存证 + 风险标记（write 类动作，需权限钩子）----
    const evidenceInput = this.buildEvidenceInput(runId, source, data)
    if (evidenceInput) {
      actions.push({
        tool: 'evidence.commit',
        input: evidenceInput,
        readonly: false,
        runId,
        reason: '五元组存证',
      })
    }
    if (severity === 'critical') {
      actions.push({
        tool: 'risk.mark',
        input: { path: this.riskMarkTarget(source, data), level: 'critical', reason: `${source} 关键风险（${this.riskDesc(data)}）` },
        readonly: false,
        runId,
        reason: '关键风险标记',
      })
    }

    // trace：动作集构成决策（evidence 是否生成 + critical 是否追加 risk.mark + 完整动作清单）
    this.log.trace('[规划] 动作集构成决策', { module: 'RulePlanner', function: 'plan' }, {
      runId,
      stream: source,
      severity,
      hasEvidence: evidenceInput !== null,
      evidenceAction: evidenceInput?.action ?? null,
      markCritical: severity === 'critical',
      actions: actions.map((a) => ({ tool: a.tool, readonly: a.readonly, agentId: a.agentId, reason: a.reason })),
    })

    this.log.info('[规划] 规则路由完成', { module: 'RulePlanner', function: 'plan' }, {
      runId,
      stream: source,
      severity,
      planMs: Math.round(performance.now() - startedAt),
      actionCount: actions.length,
      actions: actions.map((a) => ({ tool: a.tool, readonly: a.readonly, agentId: a.agentId })),
    })
    return actions
  }

  // ==================== 内部 ====================

  /** 构建五元组存证入参（部分流不存证，避免冗余写入） */
  private buildEvidenceInput(runId: string, source: PerceptionStream, data: RiskEventData): Record<string, unknown> | null {
    const common = { sessionId: `run_${runId}` }
    switch (source) {
      case 'file': {
        const file = data.file ?? {}
        return {
          action: 'file_verify',
          subject: 'governance_agent',
          object: file.path ?? '',
          result: `verify(${data.severity ?? 'unknown'})`,
          context: { riskScore: data.riskScore, operation: file.operation, hashBefore: file.hashBefore, hashAfter: file.hashAfter },
          ...common,
        }
      }
      case 'process': {
        const proc = data.process ?? {}
        return {
          action: 'process_verify',
          subject: 'governance_agent',
          object: proc.tool ?? '',
          result: `verify(${data.severity ?? 'unknown'})`,
          context: { sessionId: proc.sessionId, relatedFiles: proc.relatedFiles },
          sessionId: proc.sessionId ?? common.sessionId,
        }
      }
      case 'network':
      case 'api_call': {
        const apiCall = data.apiCall ?? {}
        return {
          action: 'api_call_verify',
          subject: 'governance_agent',
          object: apiCall.url ?? '',
          result: `verify(${data.severity ?? 'unknown'})`,
          context: { method: apiCall.method, target: apiCall.target, riskScore: data.riskScore },
          ...common,
        }
      }
      default:
        return null
    }
  }

  /** 风险标记目标：优先文件路径，否则按流给语义化目标 */
  private riskMarkTarget(source: PerceptionStream, data: RiskEventData): string {
    if (source === 'file') return data.file?.path ?? 'file:unknown'
    if (source === 'api_call') return data.apiCall?.url ?? 'api_call:unknown'
    if (source === 'process') return data.process?.tool ?? 'process:unknown'
    return `${source}:unknown`
  }

  private riskDesc(data: RiskEventData): string {
    return data.file?.path ?? data.apiCall?.url ?? data.process?.tool ?? data.resource?.message ?? ''
  }
}
