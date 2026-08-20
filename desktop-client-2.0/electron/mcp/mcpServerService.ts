/**
 * mcp/mcpServerService.ts — MCP Server 服务（方案 C · C1）
 *
 * 职责：把治理引擎关键能力通过 MCP（Model Context Protocol）暴露给外部 agent（如 dsh）。
 *  - 传输：Streamable HTTP（stateless 模式，标准 MCP client 可直接连接）
 *  - 鉴权：fail-closed——每个请求都必须在 HTTP 层通过 authenticate 校验，无有效凭证一律 401
 *  - 工具映射：ToolRegistry.toolDefinitions() → MCP tools/list；tools/call 走 ToolBridge（复用
 *    双层闸门 / 权限钩子 / AOP / 事件总线，与治理引擎同一条执行链路）
 *  - 审计：所有调用接入 GovernanceLogger（谁在何时调用了哪些治理能力）
 *
 * 单例服务：工厂装配后由 main.ts 启停；toolRegistry/toolBridge 惰性解析（bootstrap 组装完成后才可用）。
 */

import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Server as McpProtocolServer } from '@modelcontextprotocol/sdk/server/index.js'
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { GovernanceLoggerLike } from '../events/governanceLogger'
import type { ToolRegistry } from '../agent/toolRegistry'
import type { ToolBridge } from '../agent/toolBridge'
import { ToolError, ToolResult } from '../agent/types'

/** 默认监听端口（外部 agent / dsh 可据此配置固定地址） */
export const DEFAULT_MCP_PORT = 39876

/** 默认监听地址：仅本机可访问（MCP 是对本机治理能力的受控暴露，不对外网） */
export const DEFAULT_MCP_HOST = '127.0.0.1'

/** 鉴权结果（fail-closed：ok=false 一律拒绝） */
export interface McpAuthResult {
  ok: boolean
  /** 通过鉴权后的身份标识（如 'api-key' / 'jwt' / 用户名），供审计日志区分调用来源 */
  identity?: string
  error?: string
}

/** 鉴权器：由调用方注入（默认 createMcpAuthenticator：API Key + JWT 双通道） */
export type McpAuthenticator = (token: string) => Promise<McpAuthResult>

/** McpServerService 构造选项 */
export interface McpServerServiceOptions {
  /** 治理日志（审计接入，注入共享实例保证动态级别切换生效） */
  logger: GovernanceLoggerLike
  /** 监听地址（默认 127.0.0.1） */
  host?: string
  /** 监听端口（默认 39876；测试可传 0 用随机端口） */
  port?: number
  /** 鉴权器（fail-closed：不通过则 401） */
  authenticate: McpAuthenticator
  /** 惰性解析工具注册表（bootstrap 组装完成前不可用） */
  getToolRegistry: () => ToolRegistry
  /** 惰性解析执行分发桥（工具调用唯一入口） */
  getToolBridge: () => ToolBridge
  /** 写操作权限钩子（非只读工具必经；缺省则 fail-closed 拒绝写操作） */
  canUseTool?: (tool: string, input: unknown) => Promise<boolean>
}

/** MCP 工具定义（SDK ToolSchema 要求的形态） */
interface McpToolShape {
  name: string
  description?: string
  inputSchema: { type: 'object'; properties?: Record<string, unknown>; required?: string[] }
  annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean }
}

/** 将 ToolBridge 结果映射为 MCP CallToolResult 的 content 块 */
function toMcpResult(result: ToolResult): { content: { type: 'text'; text: string }[]; structuredContent?: { output: unknown }; isError?: boolean } {
  const out: { content: { type: 'text'; text: string }[]; structuredContent?: { output: unknown }; isError?: boolean } = {
    content: [{ type: 'text', text: result.content }],
  }
  if (result.output !== undefined) out.structuredContent = { output: result.output }
  if (result.is_error) out.isError = true
  return out
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** 从请求头提取凭证：Authorization: Bearer <token> 或 X-API-Key: <token> */
function extractToken(req: IncomingMessage): string | null {
  const auth = req.headers.authorization
  if (typeof auth === 'string' && /^Bearer\s+/i.test(auth)) {
    return auth.replace(/^Bearer\s+/i, '').trim()
  }
  const apiKey = req.headers['x-api-key']
  if (typeof apiKey === 'string' && apiKey.length > 0) return apiKey
  return null
}

/**
 * MCP Server 服务：HTTP 监听 + Streamable HTTP 传输 + 鉴权边界 + 工具映射。
 * stateless 模式：每个请求独立创建 transport + protocol server（标准 MCP client 兼容）。
 */
export class McpServerService {
  private opts: McpServerServiceOptions
  private httpServer: ReturnType<typeof createServer> | undefined
  private running = false
  private boundPort: number | undefined

  constructor(opts: McpServerServiceOptions) {
    this.opts = {
      host: DEFAULT_MCP_HOST,
      port: DEFAULT_MCP_PORT,
      ...opts,
    }
  }

  /** 服务是否在运行 */
  isRunning(): boolean {
    return this.running
  }

  /** 实际监听端口（未启动返回 undefined） */
  getPort(): number | undefined {
    return this.boundPort
  }

  /** MCP 端点地址（供外部 agent / 设置页展示） */
  getUrl(): string | undefined {
    if (!this.boundPort) return undefined
    return `http://${this.opts.host}:${this.boundPort}/mcp`
  }

  /** 运行时注入写操作权限钩子（bootstrap 组装后调用，与治理引擎同一权限策略） */
  setCanUseTool(hook: (tool: string, input: unknown) => Promise<boolean>): void {
    this.opts.canUseTool = hook
  }

  /** 启动 HTTP 服务并监听（幂等） */
  async start(): Promise<void> {
    if (this.running) return
    const { host, port } = this.opts
    this.httpServer = createServer((req, res) => {
      this.handleRequest(req, res).catch((error) => {
        this.opts.logger.error('[MCP] 请求处理未捕获异常', { module: 'McpServer' }, { error: errorMessage(error) })
        if (!res.headersSent) this.writeJson(res, 500, { error: 'Internal Server Error' })
      })
    })

    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => reject(error)
      const server = this.httpServer!
      server.once('error', onError)
      server.listen(port, host, () => {
        server.removeListener('error', onError)
        resolve()
      })
    })

    const address = this.httpServer.address()
    this.boundPort = typeof address === 'object' && address ? address.port : port
    this.running = true
    this.opts.logger.info('[MCP] Server 已启动', { module: 'McpServer' }, { url: this.getUrl(), host, port: this.boundPort })
  }

  /** 停止服务（幂等；强制关闭残留连接） */
  async stop(): Promise<void> {
    const server = this.httpServer
    if (!server) return
    this.httpServer = undefined
    this.running = false
    this.boundPort = undefined
    await new Promise<void>((resolve) => {
      server.close(() => resolve())
      // 关闭 keep-alive 残留连接，确保 stop 及时返回（Node 18+）
      server.closeAllConnections?.()
    })
    this.opts.logger.info('[MCP] Server 已停止', { module: 'McpServer' })
  }

  // ==================== 内部 ====================

  /** HTTP 入口：路径路由 → 鉴权（fail-closed）→ 转交 MCP 协议处理 */
  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // 健康检查（无需鉴权，供 dsh / 运维探测）
    if (req.method === 'GET' && (req.url === '/mcp/health' || req.url === '/health')) {
      this.writeJson(res, 200, { status: 'ok', service: 'yijiandaodi-governance-mcp' })
      return
    }

    // 仅 /mcp 路径放行（其余 404）
    if (req.url !== '/mcp') {
      this.writeJson(res, 404, { error: 'Not Found' })
      return
    }
    if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'DELETE') {
      this.writeJson(res, 405, { error: 'Method Not Allowed', allow: 'GET, POST, DELETE' })
      return
    }

    // ---- 鉴权边界（fail-closed）：无凭证 / 凭证无效 → 401，不进入 MCP 逻辑 ----
    const token = extractToken(req)
    if (!token) {
      this.opts.logger.warn('[MCP] 缺少凭证，已拒绝', { module: 'McpServer' }, { method: req.method })
      this.writeJson(res, 401, { error: 'Unauthorized: missing credentials' })
      return
    }
    const auth = await this.opts.authenticate(token)
    if (!auth.ok) {
      this.opts.logger.warn('[MCP] 凭证无效，已拒绝', { module: 'McpServer' }, { method: req.method, reason: auth.error })
      this.writeJson(res, 401, { error: 'Unauthorized' })
      return
    }
    const identity = auth.identity ?? 'unknown'

    // ---- 进入 MCP 协议处理（stateless：每请求独立 transport + protocol server）----
    // enableJsonResponse：治理工具为请求/响应型，POST 直接返回 JSON（无状态场景推荐，避免 SSE 流式开销）
    const protocol = this.createProtocolServer(identity)
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
    try {
      await protocol.connect(transport)
      await transport.handleRequest(req, res)
    } catch (error) {
      this.opts.logger.error('[MCP] 协议处理失败', { module: 'McpServer' }, { identity, error: errorMessage(error) })
      if (!res.headersSent) this.writeJson(res, 500, { error: 'Internal Server Error' })
    } finally {
      try {
        await transport.close()
      } catch {
        // 清理失败忽略
      }
      try {
        await protocol.close()
      } catch {
        // 清理失败忽略
      }
    }
  }

  /** 构建独立 MCP 协议 Server（tools/list + tools/call，每次请求复用同一套处理器） */
  private createProtocolServer(identity: string): McpProtocolServer {
    const { logger, getToolRegistry, getToolBridge, canUseTool } = this.opts
    const server = new McpProtocolServer(
      { name: 'yijiandaodi-governance', version: '1.0.0' },
      {
        capabilities: { tools: {} },
        instructions:
          '一鉴到底治理引擎 MCP 服务：暴露本地治理能力（verify / evidence / risk / report / file / backend）。' +
          '写操作工具（非只读）受桌面端权限门控，未授权时会被拒绝（fail-closed）。',
      },
    )

    // ---- tools/list：ToolRegistry 全量映射为 MCP tools ----
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      const defs = getToolRegistry().toolDefinitions()
      logger.debug('[MCP] tools/list', { module: 'McpServer' }, { identity, toolCount: defs.length })
      return { tools: defs.map((def) => this.toMcpTool(def)) }
    })

    // ---- tools/call：走 ToolBridge（同一执行链路，含双层闸门 / 权限钩子 / AOP / 事件总线）----
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params
      const toolCallId = `mcp_${identity}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      const input = (args ?? {}) as Record<string, unknown>
      logger.info('[MCP] 工具调用', { module: 'McpServer' }, {
        identity,
        tool: name,
        toolCallId,
        argsKeys: Object.keys(input),
      })
      try {
        const result = await getToolBridge().call(name, input, toolCallId, {
          agentId: 'mcp',
          canUseTool,
        })
        const mcpResult = toMcpResult(result)
        logger.info('[MCP] 工具调用完成', { module: 'McpServer' }, {
          identity,
          tool: name,
          toolCallId,
          isError: mcpResult.isError ?? false,
        })
        return mcpResult
      } catch (error) {
        // 业务级拒绝（权限 / 参数 / 执行失败）→ 作为 MCP 错误结果返回（isError）
        if (error instanceof ToolError) {
          logger.warn('[MCP] 工具调用被拒', { module: 'McpServer' }, {
            identity,
            tool: name,
            toolCallId,
            code: error.code,
            reason: error.message,
          })
          return { content: [{ type: 'text', text: error.message }], isError: true }
        }
        logger.error('[MCP] 工具调用异常', { module: 'McpServer' }, { identity, tool: name, toolCallId, error: errorMessage(error) })
        throw error
      }
    })

    return server
  }

  /** ToolRegistry 定义 → MCP Tool（含只读/破坏性 hints，供 client 决定是否确认） */
  private toMcpTool(def: { name: string; description: string; inputSchema?: unknown }): McpToolShape {
    const raw = def.inputSchema
    const inputSchema: McpToolShape['inputSchema'] =
      raw && typeof raw === 'object' && (raw as Record<string, unknown>).type === 'object'
        ? (raw as McpToolShape['inputSchema'])
        : { type: 'object', properties: {} }

    const tool = this.opts.getToolRegistry().get(def.name)
    const annotations: McpToolShape['annotations'] = tool
      ? {
          readOnlyHint: tool.isReadOnly?.({}) ?? false,
          destructiveHint: tool.isDestructive?.({}) ?? false,
        }
      : undefined

    return {
      name: def.name,
      description: def.description,
      inputSchema,
      ...(annotations ? { annotations } : {}),
    }
  }

  private writeJson(res: ServerResponse, status: number, body: unknown): void {
    if (res.headersSent) return
    const payload = JSON.stringify(body)
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    })
    res.end(payload)
  }
}
