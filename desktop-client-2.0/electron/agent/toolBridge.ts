/**
 * agent/toolBridge.ts — M2 执行分发桥
 *
 * 来源：Grok `ToolBridge`（唯一分发入口 call / try_parse / tool_definitions，
 * 双通道结果 output + prompt_text）。
 *
 * 职责：唯一执行入口。call(name, params, toolCallId) 完成"查找 → 校验 → 权限 →
 * 执行 → 产出双通道结果"；执行全程向事件总线 `tool` 流发布
 * ToolCallRequestData / ToolCallResultData（id 三端贯通）。
 * 详见 docs/AGENT_FUSION_MODULE_DESIGN.md §0.2 / M2
 */

import type {
  AgentEventBus,
  ToolCallRequestData,
  ToolCallResultData,
  ToolProgressData,
} from '../events/agentEventBus'
import type { GovernanceLoggerLike } from '../events/governanceLogger'
import type { PluginHooksHost } from './hooks/types'
import { ToolRegistry } from './toolRegistry'
import { GovTool, ToolContext, ToolError, ToolParseResult, ToolProgress, ToolResult } from './types'

/** ToolBridge 构造选项 */
export interface ToolBridgeOptions {
  /** 进度回调兜底（ToolContext.onProgress 优先） */
  onProgress?: (p: { tool: string; detail: string }) => void
  /** 可选事件总线：执行全程向 `tool` 流发布请求/结果（复用 AgentEventBus 类型，id 三端贯通） */
  bus?: AgentEventBus
  /** 可选治理日志（trace 级执行路径埋点） */
  logger?: GovernanceLoggerLike
  /** 插件钩子宿主（可选）：beforeToolCall / afterToolCall AOP 挂点；缺省时零开销 */
  hooks?: PluginHooksHost
}

/** 执行分发桥：唯一工具执行入口 */
export class ToolBridge {
  private registry: ToolRegistry
  private opts: Required<Pick<ToolBridgeOptions, 'onProgress'>> & ToolBridgeOptions
  private log: GovernanceLoggerLike

  constructor(registry: ToolRegistry, opts: ToolBridgeOptions = {}) {
    this.registry = registry
    this.opts = {
      onProgress: opts.onProgress ?? (() => {}),
      ...opts,
    }
    this.log = opts.logger ?? {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
      trace: () => {},
    }
  }

  /**
   * 执行工具调用（对齐 Grok bridge.call(client_function_name, client_params, tool_call_id)）。
   * @param ctx 执行上下文（runId / agentId / canUseTool 权限钩子）；写操作（非只读）必须提供
   * canUseTool，否则 fail-closed 拒绝（安全第一）。
   */
  async call(
    name: string,
    params: unknown,
    toolCallId: string,
    ctx?: Partial<ToolContext>,
  ): Promise<ToolResult> {
    const startedAt = performance.now()
    const tool = this.registry.get(name)
    if (!tool) {
      throw new ToolError('tool_not_found', `未注册的工具: ${name}`, { name })
    }

    const input = (params ?? {}) as Record<string, unknown>
    const fullCtx: ToolContext = {
      runId: ctx?.runId ?? `tool_${toolCallId}`,
      agentId: ctx?.agentId,
      canUseTool: ctx?.canUseTool,
      onProgress: ctx?.onProgress ?? this.opts.onProgress,
    }

    // ---- 发布请求事件（Claude tool_use 块 / Grok call 入参） ----
    const requestData: ToolCallRequestData = {
      type: 'tool_use',
      id: toolCallId,
      name,
      input,
      agentId: fullCtx.agentId,
      readonly: tool.isConcurrencySafe?.(input) ? undefined : !tool.isReadOnly!(input),
      permission: tool.isReadOnly!(input) ? 'allow' : 'ask',
    }
    await this.publishRequest(requestData, fullCtx.runId)

    // trace：工具调用入场（注册命中 + 请求已发布 + 读写/并发安全标记）
    this.log.trace('[桥] 工具调用入场', { module: 'ToolBridge', function: 'call' }, {
      name,
      toolCallId,
      runId: fullCtx.runId,
      agentId: fullCtx.agentId,
      readonly: tool.isReadOnly!(input),
      concurrencySafe: tool.isConcurrencySafe?.(input) ?? true,
    })

    // info：工具调用（性能排查关键节点 —— 记录入口，与出口 callMs 配对定位调用耗时）
    this.log.info('[桥] 工具调用', { module: 'ToolBridge', function: 'call' }, {
      name,
      toolCallId,
      runId: fullCtx.runId,
      agentId: fullCtx.agentId,
      readonly: tool.isReadOnly!(input),
      concurrencySafe: tool.isConcurrencySafe?.(input) ?? true,
    })

    // ---- 1. schema 校验（tryParse，只校验不执行） ----
    const parse = this.tryParse(name, params)
    if (!parse.ok) {
      throw new ToolError('invalid_params', `工具 ${name} 参数校验失败: ${parse.error}`, {
        name,
        error: parse.error,
      })
    }

    // ---- 2. 双层闸门 · 第一层：validateInput 语义校验（fail-closed） ----
    if (tool.validateInput) {
      const validation = tool.validateInput(input)
      this.log.trace('[桥] validateInput 校验', { module: 'ToolBridge', function: 'call' }, {
        name,
        runId: fullCtx.runId,
        ok: validation.ok,
        error: validation.error,
      })
      if (!validation.ok) {
        throw new ToolError('invalid_params', `工具 ${name} 输入校验未通过: ${validation.error}`, {
          name,
          error: validation.error,
        })
      }
    }

    // ---- 3. 双层闸门 · 第二层：checkPermissions 工具级权限 ----
    if (tool.checkPermissions) {
      const permission = await tool.checkPermissions(input, fullCtx)
      this.log.trace('[桥] checkPermissions 裁决', { module: 'ToolBridge', function: 'call' }, {
        name,
        runId: fullCtx.runId,
        allowed: permission.allowed,
        reason: permission.reason,
      })
      if (!permission.allowed) {
        throw new ToolError('permission_denied', `工具 ${name} 权限未通过: ${permission.reason ?? '工具级拒绝'}`, {
          name,
          reason: permission.reason,
        })
      }
    }

    // ---- 4. 全局权限闸门：所有写操作（非只读）必经 canUseTool ----
    const isReadOnly = tool.isReadOnly!(input)
    if (!isReadOnly) {
      if (!fullCtx.canUseTool) {
        throw new ToolError(
          'permission_denied',
          `写操作工具 ${name} 缺少 canUseTool 权限钩子，已拒绝（fail-closed）`,
          { name },
        )
      }
      const allowed = await fullCtx.canUseTool(name, input)
      this.log.trace('[桥] 权限闸门决策', { module: 'ToolBridge', function: 'call' }, {
        name,
        runId: fullCtx.runId,
        isReadOnly,
        allowed,
      })
      if (!allowed) {
        throw new ToolError('permission_denied', `工具 ${name} 被权限钩子拒绝`, { name, input })
      }
    }

    // ---- 5. AOP · beforeToolCall（pipeline）：双层闸门通过后、执行前；插件可改写 input ----
    let effectiveInput = input
    if (this.opts.hooks) {
      // info：AOP 入口（执行前请求快照 —— 排查执行流程：确认进入 AOP 时的原始入参）
      this.log.info('[桥] AOP·beforeToolCall 入口', { module: 'ToolBridge', function: 'call' }, {
        name,
        toolCallId,
        runId: fullCtx.runId,
        agentId: fullCtx.agentId,
        readonly: isReadOnly,
        permission: requestData.permission,
        inputKeys: Object.keys(input),
        input: summarize(input),
      })
      const beforeStart = performance.now()
      const before = await this.opts.hooks.emit('beforeToolCall', requestData)
      const beforeMs = Math.round(performance.now() - beforeStart)
      if (before?.data?.input) {
        const diff = diffInput(input, before.data.input)
        effectiveInput = before.data.input
        this.log.info('[桥] AOP·beforeToolCall 完成：input 被插件改写', { module: 'ToolBridge', function: 'call' }, {
          name,
          toolCallId,
          runId: fullCtx.runId,
          aopMs: beforeMs,
          added: diff.added,
          removed: diff.removed,
          changed: diff.changed,
          inputKeys: Object.keys(effectiveInput),
          input: summarize(effectiveInput),
        })
      } else {
        this.log.info('[桥] AOP·beforeToolCall 完成：input 未被改写，原样执行', { module: 'ToolBridge', function: 'call' }, {
          name,
          toolCallId,
          runId: fullCtx.runId,
          aopMs: beforeMs,
        })
      }
    }

    // ---- 6. 执行：优先流式 [Progress*, Terminal]，否则阻塞 run ----
    let result: ToolResult
    try {
      if (tool.stream) {
        result = await this.executeStreaming(tool, effectiveInput, fullCtx, requestData)
      } else {
        result = await tool.run(effectiveInput, fullCtx)
      }
    } catch (error) {
      const toolError = new ToolError('execution_error', `工具 ${name} 执行失败: ${errorMessage(error)}`, {
        name,
        error: errorMessage(error),
      })
      // 失败路径也必须记录完成日志（isError=true）+ 发布 tool_result（is_error=true），
      // 否则 tool 流订阅者（主进程 perfLogAnalyzer 自动分析）感知不到失败轮次，报告里会缺失错误详情
      this.log.info('[桥] 工具调用完成', { module: 'ToolBridge', function: 'call' }, {
        name,
        toolCallId,
        runId: fullCtx.runId,
        agentId: fullCtx.agentId,
        callMs: Math.round(performance.now() - startedAt),
        isError: true,
        error: toolError.message,
      })
      try {
        await this.publishResult(
          requestData,
          { output: undefined, content: toolError.message, is_error: true },
          fullCtx.runId,
        )
      } catch {
        // 结果事件发布失败不掩盖原始错误
      }
      throw toolError
    }

    // ---- 6. 输出上限治理（对齐 Grok DEFAULT_TOOL_OUTPUT_BYTES） ----
    const truncated = this.truncateResult(result, tool.maxResultSizeChars!)

    // trace：执行完成（成败标记 + 是否触发截断）
    this.log.trace('[桥] 工具执行完成', { module: 'ToolBridge', function: 'call' }, {
      name,
      toolCallId,
      runId: fullCtx.runId,
      isError: result.is_error ?? false,
      truncated: result.content !== truncated.content,
    })

    // info：工具调用完成（性能排查关键节点 —— callMs 含校验/权限/执行全链路耗时）
    this.log.info('[桥] 工具调用完成', { module: 'ToolBridge', function: 'call' }, {
      name,
      toolCallId,
      runId: fullCtx.runId,
      agentId: fullCtx.agentId,
      callMs: Math.round(performance.now() - startedAt),
      isError: result.is_error ?? false,
      truncated: result.content !== truncated.content,
    })

    // ---- 7. AOP · afterToolCall（pipeline）：执行完成后、截断结果发布前；插件可改写结果 ----
    let finalResult = truncated
    if (this.opts.hooks) {
      // info：AOP 入口（执行后结果快照 —— 排查执行流程：确认进入 AOP 时的原始截断结果）
      this.log.info('[桥] AOP·afterToolCall 入口', { module: 'ToolBridge', function: 'call' }, {
        name,
        toolCallId,
        runId: fullCtx.runId,
        agentId: fullCtx.agentId,
        isError: truncated.is_error ?? false,
        contentChars: truncated.content.length,
        content: summarize(truncated.content, 200),
        output: summarize(truncated.output, 200),
      })
      const afterStart = performance.now()
      const after = await this.opts.hooks.emit('afterToolCall', {
        type: 'tool_result',
        tool_use_id: toolCallId,
        content: truncated.content,
        output: truncated.output,
        effective_tool_name: name,
        is_error: truncated.is_error,
      })
      const afterMs = Math.round(performance.now() - afterStart)
      if (after?.data) {
        finalResult = {
          content: after.data.content,
          output: after.data.output,
          is_error: after.data.is_error,
        }
        this.log.info('[桥] AOP·afterToolCall 完成：结果被插件改写', { module: 'ToolBridge', function: 'call' }, {
          name,
          toolCallId,
          runId: fullCtx.runId,
          aopMs: afterMs,
          contentChanged: truncated.content !== finalResult.content,
          contentCharsBefore: truncated.content.length,
          contentCharsAfter: finalResult.content.length,
          isErrorBefore: truncated.is_error ?? false,
          isErrorAfter: finalResult.is_error ?? false,
          content: summarize(finalResult.content, 200),
          output: summarize(finalResult.output, 200),
        })
      } else {
        this.log.info('[桥] AOP·afterToolCall 完成：结果未被改写，原样发布', { module: 'ToolBridge', function: 'call' }, {
          name,
          toolCallId,
          runId: fullCtx.runId,
          aopMs: afterMs,
        })
      }
    }

    // ---- 8. 发布结果事件（Claude tool_result 块 / Grok ToolBridgeResult） ----
    await this.publishResult(requestData, finalResult, fullCtx.runId)
    return finalResult
  }

  /**
   * 只校验不执行（对齐 Grok try_parse）。
   * 按工具的 inputSchema（JSON Schema 子集）做结构校验。
   */
  tryParse(name: string, params: unknown): ToolParseResult {
    const tool = this.registry.get(name)
    if (!tool) {
      return { ok: false, error: `未注册的工具: ${name}` }
    }
    const schema = tool.inputSchema
    if (!schema) return { ok: true }
    return validateBySchema(schema, params)
  }

  /** 暴露 schema 清单（透传注册表 tool_definitions） */
  toolDefinitions(): ReturnType<ToolRegistry['toolDefinitions']> {
    return this.registry.toolDefinitions()
  }

  // ==================== 内部 ====================

  /** 发布 ToolCallRequestData 到 `tool` 流（可选的 bus 注入，便于测试） */
  private async publishRequest(data: ToolCallRequestData, runId: string): Promise<void> {
    if (this.opts.bus) {
      await this.opts.bus.publish('tool', data, { runId, agentId: data.agentId })
    }
  }

  /** 发布 ToolCallResultData 到 `tool` 流 */
  private async publishResult(data: ToolCallRequestData, result: ToolResult, runId: string): Promise<void> {
    if (!this.opts.bus) return
    const resultData: ToolCallResultData = {
      type: 'tool_result',
      tool_use_id: data.id,
      content: result.content,
      output: result.output,
      effective_tool_name: data.name,
      is_error: result.is_error,
    }
    await this.opts.bus.publish('tool', resultData, { runId, agentId: data.agentId })
  }

  /** 发布 ToolProgressData 到 `tool` 流（Grok ToolStream 的 Progress 帧，id 与 request 贯通） */
  private async publishProgress(data: ToolCallRequestData, p: ToolProgress, runId: string): Promise<void> {
    if (!this.opts.bus) return
    const progressData: ToolProgressData = {
      type: 'tool_progress',
      tool_use_id: data.id,
      name: data.name,
      step: p.step,
      progress: p.progress,
      detail: p.detail,
      agentId: data.agentId,
    }
    await this.opts.bus.publish('tool', progressData, { runId, agentId: data.agentId })
  }

  /**
   * 流式执行：驱动工具实现的 AsyncGenerator（对齐 Grok ToolStream `[Progress(_)*, Terminal]`）。
   * 每次 yield 的 ToolProgress 依次：回调 ctx.onProgress + 发布 `tool_progress` 到总线；
   * 生成器 return 的 ToolResult 即终态。
   */
  private async executeStreaming(
    tool: GovTool,
    input: unknown,
    ctx: ToolContext,
    requestData: ToolCallRequestData,
  ): Promise<ToolResult> {
    const iter = tool.stream!(input, ctx)
    let terminal: ToolResult = { output: undefined, content: '' }
    while (true) {
      const step = await iter.next()
      if (step.done) {
        terminal = (step.value as ToolResult | undefined) ?? terminal
        break
      }
      const progress = step.value as ToolProgress
      ctx.onProgress?.(progress)
      await this.publishProgress(requestData, progress, ctx.runId)
    }
    return terminal
  }

  /** 超限截断：content 与字符串型 output 都截到 maxResultSizeChars，并附加截断标记 */
  private truncateResult(result: ToolResult, maxChars: number): ToolResult {
    const content = truncateString(result.content, maxChars)
    const output =
      typeof result.output === 'string'
        ? truncateString(result.output, maxChars)
        : result.output
    return { ...result, content, output }
  }
}

// ============================================================================
// JSON Schema 子集校验器（供 tryParse 使用，支持常用关键字）
// ============================================================================

const JSON_TYPES = ['string', 'number', 'integer', 'boolean', 'array', 'object', 'null'] as const

/** 按 JSON Schema 子集（type / required / properties / items）校验值 */
function validateBySchema(schema: Record<string, unknown>, value: unknown): ToolParseResult {
  // ---- type 校验 ----
  if (schema.type !== undefined) {
    if (typeof schema.type !== 'string' || !JSON_TYPES.includes(schema.type as any)) {
      return { ok: false, error: `非法 schema type: ${String(schema.type)}` }
    }
    const typeErr = checkType(schema.type as string, value)
    if (typeErr) return { ok: false, error: typeErr }
  }

  // ---- object：required / properties ----
  if (schema.type === 'object' && schema.properties && isObject(value)) {
    const props = schema.properties as Record<string, Record<string, unknown>>
    const required = Array.isArray(schema.required)
      ? (schema.required as string[])
      : []

    for (const key of required) {
      if (!(key in (value as Record<string, unknown>))) {
        return { ok: false, error: `缺少必填字段: ${key}` }
      }
    }

    for (const key of Object.keys(props)) {
      if (!(key in (value as Record<string, unknown>))) continue
      const propSchema = props[key]
      if (!propSchema || propSchema.type === undefined) continue
      if (propSchema.type === 'object' && propSchema.properties) {
        const nested = validateBySchema(propSchema, (value as Record<string, unknown>)[key])
        if (!nested.ok) return { ok: false, error: `字段 ${key} 校验失败: ${nested.error}` }
      } else {
        const typeErr = checkType(propSchema.type as string, (value as Record<string, unknown>)[key])
        if (typeErr) return { ok: false, error: `字段 ${key} ${typeErr}` }
      }
    }
  }

  // ---- array：items 类型校验 ----
  if (schema.type === 'array' && schema.items && Array.isArray(value)) {
    const itemSchema = schema.items as Record<string, unknown>
    if (itemSchema.type !== undefined) {
      for (let i = 0; i < value.length; i++) {
        const typeErr = checkType(itemSchema.type as string, value[i])
        if (typeErr) return { ok: false, error: `数组第 ${i} 项 ${typeErr}` }
      }
    }
  }

  return { ok: true }
}

/** 检查单个值的类型（'integer' 视为 number 且为整数） */
function checkType(type: string, value: unknown): string | null {
  const isOk = (() => {
    switch (type) {
      case 'string':
        return typeof value === 'string'
      case 'number':
        return typeof value === 'number' && !Number.isNaN(value)
      case 'integer':
        return typeof value === 'number' && Number.isInteger(value)
      case 'boolean':
        return typeof value === 'boolean'
      case 'array':
        return Array.isArray(value)
      case 'object':
        return isObject(value)
      case 'null':
        return value === null
      default:
        return true
    }
  })()
  return isOk ? null : `类型应为 ${type}，实际为 ${value === null ? 'null' : typeof value}`
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 字符串按字符截断（中英文混排安全，避免切坏代理字符/emoji） */
function truncateString(str: string, maxChars: number): string {
  if (str.length <= maxChars) return str
  const cut = Array.from(str).slice(0, maxChars).join('')
  return `${cut}…[已截断 ${str.length - maxChars} 字符]`
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** 值的安全序列化摘要（长内容按字符截断，避免详细日志造成日志爆炸） */
function summarize(value: unknown, maxChars = 400): string {
  let text: string
  try {
    text = typeof value === 'string' ? value : JSON.stringify(value)
  } catch {
    text = String(value)
  }
  if (text === undefined) return 'undefined'
  return text.length <= maxChars ? text : `${text.slice(0, maxChars)}…[已截断 ${text.length - maxChars} 字符]`
}

/** 对比两个输入对象的字段差异（AOP 改写排查用） */
function diffInput(prev: Record<string, unknown>, next: Record<string, unknown>) {
  const prevKeys = new Set(Object.keys(prev))
  const nextKeys = new Set(Object.keys(next))
  return {
    added: [...nextKeys].filter((k) => !prevKeys.has(k)),
    removed: [...prevKeys].filter((k) => !nextKeys.has(k)),
    changed: [...nextKeys].filter((k) => prevKeys.has(k) && prev[k] !== next[k]),
  }
}
