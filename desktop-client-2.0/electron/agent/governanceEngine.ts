/**
 * agent/governanceEngine.ts — M5b 决策层主循环（Claude queryLoop 三件套的轻量版）
 *
 * 职责：订阅感知流（file/process/network/clipboard/api_call/resource）→ 规划 → 执行 → 验证。
 * 三件套（对齐 queryLoop）：
 *  ① plan()    事件/风险 → AgentAction[]（RulePlanner 规则路由；可插拔 LLMPlanner）
 *  ② run()     ToolBridge.call(...) 执行；readonly 批量并行 / 非 readonly 串行
 *  ③ followUp() 结果验证 → 是否续轮（存证/裁决/告警）
 *
 * 关键设计（对齐 AGENT_FUSION_MODULE_DESIGN.md §3 M5 / §6 风险与边界）：
 *  - 单飞去重：同一 runId 同一轮 plan 只执行一次（对齐 OpenClaw runOncePerAgentRun）
 *  - 隔离处理：每个事件独立 runId（createRunId），异常不阻塞总线其他订阅者
 *  - 权限安全：write 类动作经 ToolBridge.canUseTool（四官裁决 + 二次确认），fail-closed
 *  - 后端降级：verify/evidence 网络型工具内建 retryWithBackoff；最终失败降级本地存证 + 告警
 *
 * 详见 docs/AGENT_FUSION_MODULE_DESIGN.md §3 M5b / §4 数据流
 */

import type { AgentEventBus, AgentEventEnvelope, RiskEventData } from '../events/agentEventBus'
import type { GovernanceLoggerLike } from '../events/governanceLogger'
import type { PluginHooksHost, AlertPayload } from './hooks/types'
import { ToolBridge } from './toolBridge'
import { Planner } from './planner'
import { ToolError } from './types'

/** 治理引擎构造依赖 */
export interface GovernanceEngineDeps {
  bus: AgentEventBus
  bridge: ToolBridge
  planner: Planner
  logger?: GovernanceLoggerLike
}

/** 单轮 plan 的执行结果（供 followUp / 排查） */
export interface RunOutcome {
  runId: string
  eventSeq: number
  stream: string
  actions: number
  succeeded: number
  failed: number
  followUp: boolean
}

/** 用户裁决回调（critical 场景的二次确认入口；对接 showRiskConfirmDialog） */
export type DecisionCallback = (req: {
  tool: string
  input: Record<string, unknown>
  riskLevel: 'warning' | 'critical'
  reason: string
}) => Promise<boolean>

/** 告警回调（最终处置：smartAlerter / Notification；由 main.ts 注入） */
export type AlertCallback = (alert: {
  level: 'warning' | 'critical'
  title: string
  description: string
  runId: string
  stream: string
}) => void

/** 治理引擎配置 */
export interface GovernanceEngineConfig {
  /** 只读动作的最大并发数（默认 3） */
  maxConcurrentReadonly?: number
  /** 用户裁决钩子（默认放行 write，便于测试；生产由 main.ts 注入四官+二次确认） */
  decision?: DecisionCallback
  /** 告警钩子（默认空实现；生产由 main.ts 注入 smartAlerter / Notification） */
  alert?: AlertCallback
  /** 是否对 info 事件也执行 followUp（默认 false：仅登记，不执行） */
  followUpOnInfo?: boolean
  /** 插件钩子宿主（可选）：8 个决策链路挂点；缺省时所有 emit 短路为空，零开销 */
  hooks?: PluginHooksHost
}

/**
 * 治理引擎：事件驱动的规划-执行-验证闭环。
 * start() 订阅感知流；每个事件独立 runId、单飞去重，隔离处理。
 */
export class GovernanceEngine {
  private deps: GovernanceEngineDeps
  private log: GovernanceLoggerLike
  private config: Required<Omit<GovernanceEngineConfig, 'decision' | 'alert' | 'hooks'>> & {
    decision: DecisionCallback
    alert: AlertCallback
    hooks?: PluginHooksHost
  }

  /** 已订阅的感知流 */
  private static readonly PERCEPTION_STREAMS = [
    'file',
    'process',
    'network',
    'clipboard',
    'api_call',
    'resource',
  ] as const

  private unsubscribers: Array<() => void> = []
  private started = false

  /** 已处理事件键（runId:seq），单飞去重防护；容量上限防无界增长 */
  private processedKeys = new Set<string>()
  private static readonly MAX_PROCESSED_KEYS = 10_000

  constructor(deps: GovernanceEngineDeps, config: GovernanceEngineConfig = {}) {
    this.deps = deps
    this.log = deps.logger ?? {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
      trace: () => {},
    }
    this.config = {
      maxConcurrentReadonly: config.maxConcurrentReadonly ?? 3,
      decision: config.decision ?? (async () => true),
      alert: config.alert ?? (() => {}),
      followUpOnInfo: config.followUpOnInfo ?? false,
      hooks: config.hooks,
    }
  }

  get isStarted(): boolean {
    return this.started
  }

  /** 订阅感知流（幂等；重复调用先 stop 再重新订阅） */
  start(): void {
    if (this.started) return
    for (const stream of GovernanceEngine.PERCEPTION_STREAMS) {
      const unsubscribe = this.deps.bus.subscribe(stream, (env) => this.handleEvent(env))
      this.unsubscribers.push(unsubscribe)
    }
    this.started = true
    this.log.info('[治理引擎] 已订阅感知流', { module: 'GovernanceEngine', function: 'start' }, {
      streams: [...GovernanceEngine.PERCEPTION_STREAMS],
    })
  }

  /** 停止订阅（幂等；清理生命周期事件） */
  stop(): void {
    if (!this.started) return
    for (const unsubscribe of this.unsubscribers) unsubscribe()
    this.unsubscribers = []
    this.started = false
    this.log.info('[治理引擎] 已停止订阅感知流', { module: 'GovernanceEngine', function: 'stop' })
  }

  /**
   * 执行一轮计划（供外部/测试直接调用；也可被 handleEvent 复用）。
   * @param envelope 事件信封（含感知载荷）
   * @param preplanned 可选：已规划好的动作（测试注入）；缺省走 planner.plan
   * @returns 本轮执行结果
   */
  async executeRun(
    envelope: AgentEventEnvelope,
    preplanned?: import('./planner').AgentAction[],
  ): Promise<RunOutcome> {
    const runId = envelope.runId
    const outcome: RunOutcome = {
      runId,
      eventSeq: envelope.seq,
      stream: envelope.stream,
      actions: 0,
      succeeded: 0,
      failed: 0,
      followUp: false,
    }

    // ---- 钩子：onRunStart（observe，fire-and-forget 不阻塞）----
    this.config.hooks?.emit('onRunStart', {
      runId,
      stream: envelope.stream,
      seq: envelope.seq,
    })

    // ① plan：事件/风险 → AgentAction[]
    const riskData = (envelope.data ?? {}) as RiskEventData
    let actions = preplanned

    // ---- 钩子：beforePlan（pipeline）—— 插件可改写事件/风险数据或追加建议动作 ----
    let effEnvelope = envelope
    let effRiskData = riskData
    if (this.config.hooks) {
      const planned = await this.config.hooks.emit('beforePlan', { envelope, riskData, preplanned })
      if (planned.data) {
        effEnvelope = planned.data.envelope
        effRiskData = planned.data.riskData
        actions = planned.data.preplanned
      }
    }
    if (!actions) {
      actions = await this.deps.planner.plan(effEnvelope, effRiskData)
    }
    if (!actions || actions.length === 0) {
      return outcome
    }

    // 拆分为只读（并发）与写（串行）两组（对齐 Claude toolOrchestration 分区）
    const readonlyActions = actions.filter((a) => a.readonly)
    const writeActions = actions.filter((a) => !a.readonly)
    outcome.actions = actions.length

    // trace：执行集拆分决策（完整动作清单 + 只读/写分组，便于回溯执行路径）
    this.log.trace('[治理引擎] 执行集拆分决策', { module: 'GovernanceEngine', function: 'executeRun' }, {
      runId,
      stream: envelope.stream,
      severity: riskData.severity ?? 'info',
      actions: actions.map((a) => ({ tool: a.tool, readonly: a.readonly, agentId: a.agentId, reason: a.reason })),
      readonly: readonlyActions.map((a) => a.tool),
      write: writeActions.map((a) => a.tool),
    })

    this.log.info('[治理引擎] 规划完成，开始执行', { module: 'GovernanceEngine', function: 'executeRun' }, {
      runId,
      stream: envelope.stream,
      total: actions.length,
      readonly: readonlyActions.length,
      write: writeActions.length,
    })

    // ② run：只读并行（限流），写操作串行（均过权限闸门）
    // 两组同时启动（保持原有并发语义），分别计时以便定位性能瓶颈在只读还是写链路
    const execStarted = performance.now()
    const readonlyStart = performance.now()
    const readonlyPromise = this.runBatch(runId, readonlyActions)
    const writeStart = performance.now()
    const writePromise = this.runSerial(runId, writeActions)
    const [readonlyResults, writeResults] = await Promise.all([readonlyPromise, writePromise])
    const readonlyMs = Math.round(performance.now() - readonlyStart)
    const writeMs = Math.round(performance.now() - writeStart)
    const execMs = Math.round(performance.now() - execStarted)

    for (const r of [...readonlyResults, ...writeResults]) {
      if (r.ok) outcome.succeeded++
      else outcome.failed++
    }

    // ③ followUp：结果验证 → 续轮（critical 场景自动触发一次深度校验）
    const verdict = await this.followUp(runId, envelope, actions, readonlyResults, writeResults)
    outcome.followUp = verdict

    this.log.info('[治理引擎] 本轮执行完成', { module: 'GovernanceEngine', function: 'executeRun' }, {
      runId,
      stream: envelope.stream,
      ...outcome,
      readonlyMs,
      writeMs,
      execMs,
    })

    // ---- 钩子：onRunEnd（observe，fire-and-forget 不阻塞）----
    this.config.hooks?.emit('onRunEnd', {
      runId,
      stream: envelope.stream,
      seq: envelope.seq,
      ...outcome,
    })
    return outcome
  }

  /** 事件处理器：单飞去重（runId:seq）+ 隔离处理，异常不阻断总线 */
  private async handleEvent(envelope: AgentEventEnvelope): Promise<void> {
    // ---- 单飞去重：同一 runId 同一轮（seq）只处理一次，防事件风暴重复触发多轮治理 ----
    const key = `${envelope.runId}:${envelope.seq}`
    if (this.processedKeys.has(key)) {
      this.log.debug('[治理引擎] 事件已处理，跳过（单飞去重）', { module: 'GovernanceEngine', function: 'handleEvent' }, {
        runId: envelope.runId,
        seq: envelope.seq,
      })
      return
    }
    // 容量保护：防无界增长（内存泄漏）
    if (this.processedKeys.size >= GovernanceEngine.MAX_PROCESSED_KEYS) {
      const oldest = this.processedKeys.keys().next().value as string
      this.processedKeys.delete(oldest)
    }

    // ---- 钩子：onPercept（short-circuit）—— 插件可丢弃事件；丢弃后不进单飞记账 ----
    if (this.config.hooks) {
      const percept = await this.config.hooks.emit('onPercept', envelope)
      if (percept.data === null) {
        this.log.trace('[治理引擎] 事件被插件丢弃（onPercept 短路）', { module: 'GovernanceEngine', function: 'handleEvent' }, {
          runId: envelope.runId,
          stream: envelope.stream,
          seq: envelope.seq,
        })
        return
      }
    }
    this.processedKeys.add(key)

    this.log.trace('[治理引擎] 事件受理，进入治理循环', { module: 'GovernanceEngine', function: 'handleEvent' }, {
      runId: envelope.runId,
      seq: envelope.seq,
      stream: envelope.stream,
      severity: (envelope.data as RiskEventData | undefined)?.severity ?? 'info',
    })

    try {
      await this.executeRun(envelope)
    } catch (error) {
      this.log.error('[治理引擎] 事件处理失败', { module: 'GovernanceEngine', function: 'handleEvent' }, {
        runId: envelope.runId,
        stream: envelope.stream,
        seq: envelope.seq,
        error: error instanceof Error ? error.message : error,
      })
    }
  }

  /** 批量执行只读动作（限流并发） */
  private async runBatch(runId: string, actions: import('./planner').AgentAction[]) {
    const max = Math.max(1, this.config.maxConcurrentReadonly)
    const results: Array<{ ok: boolean; action: import('./planner').AgentAction }> = []
    let index = 0
    const worker = async () => {
      while (index < actions.length) {
        const action = actions[index++]
        results.push(await this.runOne(runId, action))
      }
    }
    const workers = Array.from({ length: Math.min(max, actions.length || 1) }, () => worker())
    await Promise.all(workers)
    return results
  }

  /** 串行执行写动作（写类工具强制走权限钩子） */
  private async runSerial(runId: string, actions: import('./planner').AgentAction[]) {
    const results: Array<{ ok: boolean; action: import('./planner').AgentAction }> = []
    for (const action of actions) {
      results.push(await this.runOne(runId, action))
    }
    return results
  }

  /** 执行单个动作：写动作的 canUseTool 由 decision 钩子提供（ToolBridge 是唯一权限闸门） */
  private async runOne(runId: string, action: import('./planner').AgentAction) {
    const riskLevel = action.reason?.includes('关键') ? 'critical' : 'warning'
    try {
      await this.deps.bridge.call(action.tool, action.input, `act_${runId}_${action.tool}`, {
        runId,
        agentId: action.agentId,
        // 写类工具（非只读）经 bridge 调 canUseTool → decision（四官裁决 + 用户二次确认）
        canUseTool: async (tool, input) => {
          const allowed = await this.config.decision({
            tool,
            input: (input ?? {}) as Record<string, unknown>,
            riskLevel,
            reason: action.reason,
          })
          this.log.trace('[治理引擎] 权限闸门决策', { module: 'GovernanceEngine', function: 'runOne' }, {
            runId,
            tool,
            readonly: action.readonly,
            riskLevel,
            reason: action.reason,
            allowed,
          })
          return allowed
        },
      })
      this.log.trace('[治理引擎] 动作执行完成', { module: 'GovernanceEngine', function: 'runOne' }, {
        runId,
        tool: action.tool,
        readonly: action.readonly,
        agentId: action.agentId,
      })
      return { ok: true, action }
    } catch (error) {
      const denied = error instanceof ToolError && error.code === 'permission_denied'
      this.log[denied ? 'warn' : 'error'](
        denied ? '[治理引擎] 写动作被权限闸门拒绝' : '[治理引擎] 动作执行失败',
        { module: 'GovernanceEngine', function: 'runOne' },
        {
          runId,
          tool: action.tool,
          denied,
          code: error instanceof ToolError ? error.code : undefined,
          error: error instanceof Error ? error.message : error,
        },
      )
      return { ok: false, action }
    }
  }

  /** 结果验证与续轮决策（对齐 queryLoop 第三件套的轻量版） */
  private async followUp(
    runId: string,
    envelope: AgentEventEnvelope,
    actions: import('./planner').AgentAction[],
    readonlyResults: Array<{ ok: boolean; action: import('./planner').AgentAction }>,
    writeResults: Array<{ ok: boolean; action: import('./planner').AgentAction }>,
  ): Promise<boolean> {
    const riskData = (envelope.data ?? {}) as RiskEventData
    const severity = riskData.severity ?? 'info'

    // info：默认不续轮（仅登记）；配置 followUpOnInfo 时才触发验证
    if (severity === 'info' && !this.config.followUpOnInfo) return false

    const hasVerifyFlow = actions.some((a) => a.tool === 'verify.flow')
    const hasVerify = actions.some((a) => a.tool === 'verify.run')
    const anyFailed = [...readonlyResults, ...writeResults].some((r) => !r.ok)

    // ---- 钩子：onRiskAssessed（observe，fire-and-forget）—— 定级完成后只读观察 ----
    this.config.hooks?.emit('onRiskAssessed', {
      runId,
      stream: envelope.stream,
      severity,
      hasVerifyFlow,
      hasVerify,
      anyFailed,
    })

    // trace：续轮裁决决策（critical 缺 verify.flow → 续轮补校验；有失败 → 告警；否则收尾）
    this.log.trace('[治理引擎] 续轮裁决', { module: 'GovernanceEngine', function: 'followUp' }, {
      runId,
      stream: envelope.stream,
      severity,
      hasVerifyFlow,
      hasVerify,
      anyFailed,
      followUpOnInfo: this.config.followUpOnInfo,
      verdict:
        severity === 'critical' && !hasVerifyFlow ? 'critical_补校验（告警 + 续轮）' : anyFailed ? '动作失败（告警）' : '无需续轮',
    })

    // 失败 → 告警（不静默失败，对齐 §6 后端可用性降级；beforeAlert 可抑制/改写）
    if (anyFailed) {
      await this.maybeAlert({
        level: severity === 'critical' ? 'critical' : 'warning',
        title: '治理动作执行失败',
        description: `事件 ${envelope.stream} 的部分治理动作失败，请检查后端可用性与权限配置。`,
        runId,
        stream: envelope.stream,
      })
    }

    // critical 事件且本轮未含 verify.flow → 需要续轮（补一次四官全流程）
    if (severity === 'critical' && !hasVerifyFlow) {
      this.log.info('[治理引擎] critical 事件需续轮校验', { module: 'GovernanceEngine', function: 'followUp' }, {
        runId,
        stream: envelope.stream,
        hasVerify,
      })
      // 触发续轮（后续扩展：向总线发布一条内部 planning 事件，本版本直接告警提示）
      await this.maybeAlert({
        level: 'critical',
        title: '需要四官复核',
        description: `检测到 critical 风险（${envelope.stream}），建议人工复核或触发 verify.flow 全流程。`,
        runId,
        stream: envelope.stream,
      })
      return true
    }

    return false
  }

  /** 告警发送（beforeAlert 钩子可抑制/改写；无钩子宿主时直接发送，零开销） */
  private async maybeAlert(payload: AlertPayload): Promise<void> {
    if (!this.config.hooks) {
      this.config.alert(payload)
      return
    }
    const result = await this.config.hooks.emit('beforeAlert', payload)
    if (result.data === null) {
      this.log.trace('[治理引擎] 告警被插件抑制（beforeAlert 短路）', { module: 'GovernanceEngine', function: 'maybeAlert' }, {
        runId: payload.runId,
        stream: payload.stream,
        level: payload.level,
      })
      return
    }
    this.config.alert(result.data ?? payload)
  }
}
