/**
 * agent/types.ts — 治理型 Agent 执行层统一类型
 *
 * 融合三份源码的接口契约：
 *  - Claude Code Tool（鸭子类型对象 + TOOL_DEFAULTS 兜底语义）
 *  - Grok FinalizedToolset / ToolBridgeResult（output 干净 JSON + prompt_text 喂规划层）
 *
 * 详见 docs/AGENT_FUSION_MODULE_DESIGN.md §0.1 / §0.2 / M1
 */

/** 工具错误码（对齐 Grok ToolError 枚举的语义） */
export type ToolErrorCode =
  | 'tool_not_found'
  | 'permission_denied'
  | 'invalid_params'
  | 'execution_error'
  | 'result_too_large'

/** 工具执行错误（携带可机器判断的 errorCode，供规划层/存证层消费） */
export class ToolError extends Error {
  code: ToolErrorCode
  /** 附加结构化信息（如校验失败明细、触发权限钩子的调用上下文） */
  detail?: unknown

  constructor(code: ToolErrorCode, message: string, detail?: unknown) {
    super(message)
    this.name = 'ToolError'
    this.code = code
    this.detail = detail
  }
}

/**
 * 统一工具定义（Claude 风格，含 Grok 分发所需字段）。
 * 以对象字面量实现，注册时可省略默认字段，由 TOOL_DEFAULTS 兜底。
 */
export interface GovTool<Input = Record<string, unknown>, Output = unknown> {
  /** 工具唯一名（对齐 Grok client_function_name / Claude tool.name） */
  name: string
  /** 暴露给规划层/模型的说明 */
  description: string
  /** JSON Schema（对齐 Grok ToolDefinition，用于 tryParse 校验与模型声明） */
  inputSchema?: Record<string, unknown>
  /** 是否并发安全（只读工具可批量并行，默认 false） */
  isConcurrencySafe?(input?: Input): boolean
  /** 是否只读（只读工具不触发权限确认，默认 false） */
  isReadOnly?(input?: Input): boolean
  /** 是否破坏性操作（删除/覆盖/发送等不可逆，默认 false） */
  isDestructive?(input?: Input): boolean
  /** 输出上限（字符），超出截断，默认 40_000（对齐 Grok DEFAULT_TOOL_OUTPUT_BYTES） */
  maxResultSizeChars?: number
  /**
   * 双层闸门 · 第一层：执行前语义校验（对齐 Cloud Code Tool.validateInput）。
   * 在 schema 校验（tryParse）之后、权限判定之前执行；不通过则 fail-closed 拒绝（invalid_params）。
   */
  validateInput?(input: Input): ToolValidationResult
  /**
   * 双层闸门 · 第二层：工具级权限判定（对齐 Cloud Code Tool.checkPermissions）。
   * 在全局 canUseTool 之前执行，可针对具体输入做精细裁决（如目标路径/URL 黑白名单）。
   * 拒绝则抛 permission_denied；通过后仍需走全局 canUseTool（写操作）。
   */
  checkPermissions?(input: Input, ctx: ToolContext): Promise<ToolPermissionResult> | ToolPermissionResult
  /**
   * 流式执行（可选）：对齐 Grok ToolStream `[Progress(_)*, Terminal(ToolResult)]`。
   * 异步生成器多次 yield ToolProgress 进度事件，末尾 return 终态 ToolResult。
   * 未实现则走 run() 阻塞执行（单次终态，无进度）。
   */
  stream?(input: Input, ctx: ToolContext): AsyncGenerator<ToolProgress, ToolResult<Output>, void>
  /** 工具实现：输入 + 上下文 → 双通道结果 */
  run(input: Input, ctx: ToolContext): Promise<ToolResult<Output>>
}

/** 工具执行上下文（对齐 Claude ToolUseContext 的轻量版） */
export interface ToolContext {
  /** 一次治理 run（跨多轮），贯穿事件信封 / 存证链 */
  runId: string
  /** 子代理：auditor/verifier/archiver/judge */
  agentId?: string
  /** 权限钩子：所有写操作（非只读）执行前必经；内部对接四官裁决 + 二次确认 */
  canUseTool?: (tool: string, input: unknown) => Promise<boolean>
  /** 进度回调（对齐 Claude onProgress / Grok ToolStream Progress 帧） */
  onProgress?: (p: ToolProgress) => void
}

/** 工具执行结果：双通道（对齐 Grok ToolBridgeResult） */
export interface ToolResult<Output = unknown> {
  /** 干净 JSON（对齐 Grok output，供验证/存证，不携带 prompt 噪声） */
  output: Output
  /** 喂规划层/模型的提示文本（对齐 Grok prompt_text） */
  content: string
  /** 是否失败（失败时 content 为错误说明） */
  is_error?: boolean
}

/** 工具调用参数分发的参数校验结构（tryParse 失败明细） */
export interface ToolParseResult {
  ok: boolean
  error?: string
}

/** 双层闸门 · 第一层：validateInput 校验结果（fail-closed，不通过则不执行） */
export interface ToolValidationResult {
  ok: boolean
  error?: string
}

/** 双层闸门 · 第二层：checkPermissions 权限判定结果 */
export interface ToolPermissionResult {
  allowed: boolean
  /** 拒绝原因（供权限钩子/存证消费） */
  reason?: string
}

/** 流式进度事件 = Grok ToolStream 的 Progress 帧（terminal 由终态 ToolResult 表达） */
export interface ToolProgress {
  /** 进度帧标识（便于与终态区分） */
  type?: 'progress'
  tool: string
  detail: string
  /** 阶段名（可选）：如 定级 / 路由 / 校验 / 存证 */
  step?: string
  /** 进度 0-100（可选） */
  progress?: number
}
