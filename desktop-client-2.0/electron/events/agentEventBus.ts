/**
 * AgentEventBus - 治理型 Agent 事件总线
 *
 * 消息结构兼容三套契约（见 docs/AGENT_FUSION_ARCHITECTURE.md 第四节）：
 *  1. OpenClaw 事件信封：{ runId, seq, stream, ts, data }
 *  2. Claude Code 消息块：tool_use / tool_result（同一个调用 ID 三端贯通）
 *  3. Grok 工具分发：call(name, params, tool_call_id)
 *
 * 内置详细日志埋点，覆盖"发布 → 分发 → 消费"全链路，方便排查事件流转问题。
 */

import { LogLevel } from '../services/loggerService'
import { governanceLogger, GovernanceLoggerLike } from './governanceLogger'
import type { EventStore, EventReplayOptions } from './eventStore'

// ============================================================================
// 类型定义（对齐 AGENT_FUSION_ARCHITECTURE.md 4.1 - 4.4）
// ============================================================================

/** 事件流名称：治理流 + 感知流 */
export type AgentEventStream =
  | 'lifecycle'
  | 'tool'
  | 'assistant'
  | 'usage'
  | 'error'
  | 'approval'
  | 'plan'
  | 'thinking'
  | 'file'
  | 'process'
  | 'network'
  | 'clipboard'
  | 'api_call'
  | 'resource'
  | (string & {})

/** 事件信封（取 OpenClaw） */
export interface AgentEventEnvelope {
  /** 一次治理 run（跨多轮），用于关联一组事件 */
  runId: string
  /** run 内单调递增，seqByRun 保证有序 */
  seq: number
  stream: AgentEventStream
  ts: number
  /** 按 stream 区分的载荷 */
  data: unknown
  sessionId?: string
  /** 子代理：审计官/验证官/存证官/裁决官 */
  agentId?: string
  lifecycleGeneration?: string
}

/** 工具调用请求载荷 = Grok call 入参 + Claude tool_use 块 */
export interface ToolCallRequestData {
  type: 'tool_use'
  /** 贯通键 == Grok tool_call_id == Claude tool_use.id */
  id: string
  /** Grok client_function_name */
  name: string
  /** Grok client_params */
  input: Record<string, unknown>
  parentId?: string
  agentId?: string
  /** true=并发安全（只读，可批量并行）；false=串行（写操作） */
  readonly?: boolean
  permission?: 'allow' | 'ask' | 'deny'
}

/** 工具调用结果载荷 = Grok ToolRunResult + Claude tool_result 块 */
export interface ToolCallResultData {
  type: 'tool_result'
  tool_use_id: string
  /** Grok prompt_text：喂回模型的提示文本 */
  content: string
  /** Grok ToolRunResult.output：干净 JSON，不携带改动 */
  output: unknown
  effective_tool_name?: string
  is_error?: boolean
  /** 重试信息（对齐 Grok retry.rs BackoffConfig） */
  attempt?: number
  backoff?: { max_retries: number; base_delay_ms: number; max_delay_ms: number }
}

/** 工具流式进度事件载荷 = Grok ToolStream 的 Progress 帧（终态仍由 tool_result 表达） */
export interface ToolProgressData {
  type: 'tool_progress'
  /** 贯通键 == tool_use.id */
  tool_use_id: string
  name: string
  /** 阶段名（可选）：如 定级 / 路由 / 校验 / 存证 */
  step?: string
  /** 进度 0-100（可选） */
  progress?: number
  /** 进度详情文本 */
  detail: string
  agentId?: string
}

/** assistant 流：模型输出的消息（含 tool_use 块） */
export interface AssistantData {
  role: 'assistant'
  content: Array<
    | { type: 'text'; text: string }
    | ToolCallRequestData
    | { type: 'thinking'; thinking: string }
  >
}

/** assistant 流：工具结果回填（Claude 协议中 tool_result 在 user 侧） */
export interface UserToolResultData {
  role: 'user'
  content: Array<{
    type: 'tool_result'
    tool_use_id: string
    content: string
    is_error?: boolean
  }>
}

/** 感知事件载荷：各监控器上报，作为决策层的触发输入 */
export interface RiskEventData {
  source: 'file' | 'process' | 'network' | 'clipboard' | 'api_call' | 'resource'
  severity: 'info' | 'warning' | 'critical'
  riskScore?: number
  file?: {
    path: string
    operation: 'create' | 'modify' | 'delete' | 'rename'
    hashBefore?: string
    hashAfter?: string
  }
  process?: { tool: string; sessionId: string; relatedFiles?: string[] }
  apiCall?: { url: string; method: string; target: string }
  /** 天然对齐五元组存证 */
  evidence?: {
    operation: string
    result: string
    confirmation: string
    timestamp: number
    prevFingerprint: string
  }
}

/** 事件总线可承载的载荷联合 */
export type AgentEventData =
  | ToolCallRequestData
  | ToolCallResultData
  | ToolProgressData
  | AssistantData
  | UserToolResultData
  | RiskEventData
  | Record<string, unknown>

/** 事件订阅回调 */
export type EventHandler = (event: AgentEventEnvelope) => void | Promise<void>

/** 事件总线配置 */
export interface AgentEventBusConfig {
  /** 是否开启 seq 跳变告警（排查丢事件） */
  enableSeqGuard?: boolean
  /** 是否在无订阅者时告警（排查漏接） */
  enableDropWarning?: boolean
  /** 日志级别过滤，默认 info（debug 用于高频细节） */
  logLevel?: LogLevel
  /** 治理日志实例，默认使用 governanceLogger（独立落盘 governance-%DATE%.log） */
  logger?: GovernanceLoggerLike
  /** 可选事件存储（A3）：配置后 publish 事件异步落盘，可通过 replay() 重放；缺省无持久化 */
  store?: EventStore
}

// ============================================================================
// AgentEventBus 实现
// ============================================================================

/**
 * 事件总线：发布 / 订阅 / 退订，内置 seqByRun 保序与详细日志埋点。
 * 设计上不持有完整消息数组，只承载事件流；主循环按需投影回 Claude 消息数组。
 */
export class AgentEventBus {
  /** 每个 run 内已发布的 seq（保证单 run 内有序） */
  private seqByRun = new Map<string, number>()
  /** stream -> 订阅者集合 */
  private listeners = new Map<string, Set<EventHandler>>()
  /** 发布 / 丢弃计数（排查用） */
  private publishedCount = 0
  private droppedCount = 0
  /** 孤立事件（未携带 runId 的 publish）的全局递增 seq，避免污染 seqByRun */
  private anonymousSeq = 0
  /** seqByRun 容量上限，防止 Map 无界增长导致内存泄漏 */
  private static readonly MAX_RUN_ENTRIES = 10_000
  private log: GovernanceLoggerLike
  private config: Required<Omit<AgentEventBusConfig, 'logger' | 'store'>> & {
    logger: GovernanceLoggerLike
    store?: EventStore
  }

  constructor(config: AgentEventBusConfig = {}) {
    this.config = {
      enableSeqGuard: config.enableSeqGuard ?? true,
      enableDropWarning: config.enableDropWarning ?? true,
      logLevel: config.logLevel ?? LogLevel.INFO,
      logger: config.logger ?? governanceLogger,
      store: config.store,
    }
    this.log = this.config.logger
    this.log.info('[事件总线] 初始化', { module: 'AgentEventBus' }, {
      enableSeqGuard: this.config.enableSeqGuard,
      enableDropWarning: this.config.enableDropWarning,
      logLevel: this.config.logLevel,
      store: this.config.store?.name ?? 'none',
    })
  }

  // ==================== 发布 ====================

  /**
   * 发布事件。分配 runId 内自增 seq，同步派发所有订阅者。
   * 返回事件信封，便于调用方（如主循环）投影回消息数组。
   */
  public async publish(
    stream: AgentEventStream,
    data: AgentEventData,
    meta?: { runId?: string; agentId?: string; sessionId?: string },
  ): Promise<AgentEventEnvelope> {
    const runId = meta?.runId ?? this.createRunId()
    // 孤立事件（未携带 runId）不写入 seqByRun，避免 Map 无界增长（内存泄漏）
    const seq = meta?.runId ? this.nextSeq(runId) : ++this.anonymousSeq

    const envelope: AgentEventEnvelope = {
      runId,
      seq,
      stream,
      ts: Date.now(),
      data,
      agentId: meta?.agentId,
      sessionId: meta?.sessionId,
    }

    // ---- 埋点：事件发布 ----
    const subscriberCount = this.getSubscriberCount(stream)
    const level = this.classifyLevel(stream)
    this.log[level](
      `[事件总线] 发布 ${stream}#${seq}`,
      { module: 'AgentEventBus', function: 'publish' },
      {
        runId,
        stream,
        seq,
        subscriberCount,
        dataKind: this.describeData(data),
      },
    )

    // ---- A3 持久化：异步落盘（不阻塞分发；失败记录不抛） ----
    if (this.config.store) {
      // ---- 埋点：落盘提交（进 store 写队列） ----
      this.log.debug(
        `[事件总线] 事件 ${stream}#${seq} 提交落盘`,
        { module: 'AgentEventBus', function: 'publish' },
        { runId, stream, seq, store: this.config.store.name },
      )
      void this.config.store.append(envelope).catch((error) => {
        this.log.error(
          '[事件总线] 事件落盘失败',
          { module: 'AgentEventBus', function: 'publish' },
          { runId, stream, seq, error: error instanceof Error ? error.message : error },
        )
      })
    }

    // ---- 埋点：无订阅者告警（排查漏接） ----
    if (subscriberCount === 0) {
      if (this.config.enableDropWarning) {
        this.log.warn(
          `[事件总线] 事件 ${stream}#${seq} 无订阅者，可能漏接`,
          { module: 'AgentEventBus', function: 'publish' },
          { runId, stream, seq, droppedCount: ++this.droppedCount },
        )
      }
      return envelope
    }

    this.publishedCount++
    await this.dispatch(envelope, subscriberCount)
    return envelope
  }

  /** 分发事件到所有订阅者：逐个执行，单点异常不阻断其他订阅者 */
  private async dispatch(envelope: AgentEventEnvelope, subscriberCount: number): Promise<void> {
    const handlers = this.listeners.get(envelope.stream)
    if (!handlers || handlers.size === 0) return

    let index = 0
    for (const handler of handlers) {
      index++
      const start = Date.now()
      // ---- 埋点：分发开始 ----
      this.log.debug(
        `[事件总线] 分发 → ${envelope.stream}#${envelope.seq} 订阅者 ${index}/${subscriberCount}`,
        { module: 'AgentEventBus', function: 'dispatch' },
        { runId: envelope.runId, stream: envelope.stream, seq: envelope.seq, index },
      )
      try {
        await handler(envelope)
        // ---- 埋点：分发成功 ----
        this.log.debug(
          `[事件总线] 分发完成 ← ${envelope.stream}#${envelope.seq} 订阅者 ${index}（${Date.now() - start}ms）`,
          { module: 'AgentEventBus', function: 'dispatch' },
          { runId: envelope.runId, stream: envelope.stream, seq: envelope.seq, index, costMs: Date.now() - start },
        )
      } catch (error) {
        // ---- 埋点：分发异常（不阻断其他订阅者） ----
        this.log.error(
          `[事件总线] 订阅者 ${index} 处理 ${envelope.stream}#${envelope.seq} 异常`,
          { module: 'AgentEventBus', function: 'dispatch' },
          {
            runId: envelope.runId,
            stream: envelope.stream,
            seq: envelope.seq,
            index,
            error: error instanceof Error ? error.message : error,
          },
        )
      }
    }
  }

  // ==================== 订阅 ====================

  /** 订阅指定事件流，返回退订函数 */
  public subscribe(stream: AgentEventStream, handler: EventHandler): () => void {
    let set = this.listeners.get(stream)
    if (!set) {
      set = new Set()
      this.listeners.set(stream, set)
    }
    set.add(handler)

    // ---- 埋点：订阅注册 ----
    this.log.info(
      `[事件总线] 订阅 ${stream}（当前 ${set.size} 个订阅者）`,
      { module: 'AgentEventBus', function: 'subscribe' },
      { stream, subscriberCount: set.size },
    )

    return () => this.unsubscribe(stream, handler)
  }

  /** 退订指定事件流上的处理器，返回是否成功退订 */
  public unsubscribe(stream: AgentEventStream, handler: EventHandler): boolean {
    const set = this.listeners.get(stream)
    if (!set) return false
    const removed = set.delete(handler)
    if (set.size === 0) {
      this.listeners.delete(stream)
    }

    // ---- 埋点：退订 ----
    this.log.info(
      `[事件总线] 退订 ${stream}（当前 ${set.size} 个订阅者）`,
      { module: 'AgentEventBus', function: 'unsubscribe' },
      { stream, subscriberCount: set.size, removed },
    )
    return removed
  }

  // ==================== 查询 ====================

  /** 获取某事件流的订阅者数量（排查漏接） */
  public getSubscriberCount(stream: AgentEventStream): number {
    return this.listeners.get(stream)?.size ?? 0
  }

  /** 获取已订阅的全部事件流（排查用） */
  public getSubscribedStreams(): AgentEventStream[] {
    return [...this.listeners.keys()]
  }

  /** 获取某 run 当前已发布的 seq（排查序号） */
  public getRunSeq(runId: string): number {
    return this.seqByRun.get(runId) ?? 0
  }

  /** 发布 / 丢弃统计（排查用） */
  public getStats(): { published: number; dropped: number; activeStreams: number } {
    return {
      published: this.publishedCount,
      dropped: this.droppedCount,
      activeStreams: this.listeners.size,
    }
  }

  /**
   * A3 重放：从事件存储流式读取已落盘事件并重新分发（保留原始 seq，不重新分配）。
   * 未配置 store 时直接返回 0（无持久化，重放空操作）。
   * 重放时恢复 run 内 seq 水位，保证重放后继续 publish 的 seq 连续。
   * 可选按 stream / runId 过滤；返回实际重放的订阅事件数。
   */
  public async replay(options?: EventReplayOptions): Promise<number> {
    const store = this.config.store
    if (!store) {
      this.log.info('[事件总线] 重放跳过：未配置事件存储', { module: 'AgentEventBus', function: 'replay' }, {})
      return 0
    }

    // ---- 埋点：重放开始（含过滤条件，便于对账） ----
    this.log.info('[事件总线] 重放开始', { module: 'AgentEventBus', function: 'replay' }, {
      stream: options?.stream ?? '*',
      runId: options?.runId ?? '*',
      store: store.name,
    })

    let replayed = 0
    let skipped = 0
    const skipReasons = new Map<string, number>()
    const bumpSkip = (reason: string): void => {
      skipped++
      skipReasons.set(reason, (skipReasons.get(reason) ?? 0) + 1)
    }
    for await (const envelope of store.readAll()) {
      if (options?.stream && envelope.stream !== options.stream) {
        // ---- 埋点：重放跳过（流不匹配） ----
        this.log.debug(
          `[事件总线] 重放跳过 ${envelope.stream}#${envelope.seq}：流不匹配`,
          { module: 'AgentEventBus', function: 'replay' },
          { runId: envelope.runId, stream: envelope.stream, seq: envelope.seq, expectedStream: options.stream },
        )
        bumpSkip('streamMismatch')
        continue
      }
      if (options?.runId && envelope.runId !== options.runId) {
        // ---- 埋点：重放跳过（run 不匹配） ----
        this.log.debug(
          `[事件总线] 重放跳过 ${envelope.stream}#${envelope.seq}：run 不匹配`,
          { module: 'AgentEventBus', function: 'replay' },
          { runId: envelope.runId, stream: envelope.stream, seq: envelope.seq, expectedRunId: options.runId },
        )
        bumpSkip('runIdMismatch')
        continue
      }
      // 恢复 run 内 seq 水位（取已见最大 seq），重放后继续发布 seq 连续
      const current = this.seqByRun.get(envelope.runId) ?? 0
      if (envelope.seq > current) {
        this.seqByRun.set(envelope.runId, envelope.seq)
        // ---- 埋点：seq 水位恢复 ----
        this.log.debug(
          `[事件总线] 重放恢复 ${envelope.runId} seq 水位 ${current} → ${envelope.seq}`,
          { module: 'AgentEventBus', function: 'replay' },
          { runId: envelope.runId, from: current, to: envelope.seq },
        )
      }
      const handlers = this.listeners.get(envelope.stream)
      if (!handlers || handlers.size === 0) {
        // ---- 埋点：重放跳过（无订阅者） ----
        this.log.debug(
          `[事件总线] 重放跳过 ${envelope.stream}#${envelope.seq}：无订阅者`,
          { module: 'AgentEventBus', function: 'replay' },
          { runId: envelope.runId, stream: envelope.stream, seq: envelope.seq },
        )
        bumpSkip('noSubscriber')
        continue
      }
      // ---- 埋点：重放分发 ----
      this.log.debug(
        `[事件总线] 重放分发 ${envelope.stream}#${envelope.seq}（${handlers.size} 订阅者）`,
        { module: 'AgentEventBus', function: 'replay' },
        { runId: envelope.runId, stream: envelope.stream, seq: envelope.seq, subscriberCount: handlers.size },
      )
      await this.dispatch(envelope, handlers.size)
      replayed++
    }

    this.log.info('[事件总线] 重放完成', { module: 'AgentEventBus', function: 'replay' }, {
      stream: options?.stream ?? '*',
      runId: options?.runId ?? '*',
      store: store.name,
      replayed,
      skipped,
      skipBreakdown: Object.fromEntries(skipReasons),
    })
    return replayed
  }

  // ==================== 内部工具 ====================

  /** 生成新的 runId */
  public createRunId(): string {
    return `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  }

  /** 在 runId 内取下一个自增 seq，检测到跳变时告警（排查丢事件） */
  private nextSeq(runId: string): number {
    // ---- 埋点：seqByRun 容量保护（防内存泄漏） ----
    if (this.seqByRun.size >= AgentEventBus.MAX_RUN_ENTRIES) {
      // 淘汰最旧的 run（Map 按插入顺序迭代，首个即最旧）
      const oldestRunId = this.seqByRun.keys().next().value
      this.seqByRun.delete(oldestRunId)
      this.log.warn(
        `[事件总线] seqByRun 达上限 ${AgentEventBus.MAX_RUN_ENTRIES}，淘汰最旧 run ${oldestRunId}`,
        { module: 'AgentEventBus', function: 'nextSeq' },
        { runId, evictedRunId: oldestRunId, mapSize: this.seqByRun.size },
      )
    }

    const current = this.seqByRun.get(runId) ?? 0
    const next = current + 1
    this.seqByRun.set(runId, next)

    // ---- 埋点：seq 连续性校验 ----
    if (this.config.enableSeqGuard && current > 0 && next !== current + 1) {
      this.log.warn(
        `[事件总线] ${runId} seq 跳变：${current} → ${next}，可能丢事件`,
        { module: 'AgentEventBus', function: 'nextSeq' },
        { runId, from: current, to: next },
      )
    }
    return next
  }

  /** 根据流类型决定日志级别：感知事件与关键治理流统一 info，内部流转用 debug */
  private classifyLevel(stream: AgentEventStream): LogLevel {
    // 感知事件（各监控器上报）与关键治理流统一 info，方便日常监控
    if (
      stream === 'file' ||
      stream === 'process' ||
      stream === 'network' ||
      stream === 'clipboard' ||
      stream === 'api_call' ||
      stream === 'resource' ||
      stream === 'tool' ||
      stream === 'assistant' ||
      stream === 'approval' ||
      stream === 'error'
    ) {
      return LogLevel.INFO
    }
    // 内部流转（lifecycle/usage/plan/thinking 等）用 debug
    return LogLevel.DEBUG
  }

  /** 生成载荷摘要（避免把完整 payload 刷进日志，同时保留排查线索） */
  private describeData(data: AgentEventData): string {
    if (data && typeof data === 'object') {
      const d = data as Record<string, unknown>
      if (d.type === 'tool_use') return `tool_use(${String(d.name)})`
      if (d.type === 'tool_result') return `tool_result(${String(d.tool_use_id)})`
      if (d.type === 'text') return 'text'
      if (d.type === 'thinking') return 'thinking'
      if (d.source) return `risk(${String(d.source)})`
      return `${Object.keys(d).slice(0, 3).join(',')}...`
    }
    return typeof data
  }
}

// ============================================================================
// 默认单例（与项目其他模块保持一致：smartAlerter / autoDetector 均为单例导出）
// ============================================================================

/** 全局唯一事件总线实例 */
export const agentEventBus = new AgentEventBus()

/** 创建独立事件总线实例（隔离测试 / 多 Agent 场景） */
export function createAgentEventBus(config?: AgentEventBusConfig): AgentEventBus {
  return new AgentEventBus(config)
}
