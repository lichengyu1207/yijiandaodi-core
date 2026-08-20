/**
 * mcp/mcpAuth.ts — MCP Server 鉴权（方案 C · C3）
 *
 * 双通道凭证（任一通过即放行）：
 *  - API Key：首次启动生成并持久化到 userData/data/mcpServer.json（外部 agent / dsh 使用）
 *  - JWT：调用桌面端后端 GET /api/auth/verify/ 校验（桌面端登录态用户使用）
 *
 * fail-closed：凭证缺失 / 两通道都失败 → 拒绝（ok=false）。
 */

import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'
import type { GovernanceLoggerLike } from '../events/governanceLogger'
import { backendBaseUrl } from '../agent/tools/backendConfig'
import type { McpAuthResult, McpAuthenticator } from './mcpServerService'

/** 持久化配置形态 */
export interface McpApiKeyConfig {
  apiKey: string | null
}

/** 配置落盘路径 */
export function getMcpConfigPath(userData: string): string {
  return path.join(userData, 'data', 'mcpServer.json')
}

/** 读取持久化配置（缺失 / 解析失败 → 未配置） */
export function loadMcpApiKeyConfig(userData: string): McpApiKeyConfig {
  try {
    const raw = JSON.parse(fs.readFileSync(getMcpConfigPath(userData), 'utf-8'))
    return { apiKey: typeof raw?.apiKey === 'string' && raw.apiKey ? raw.apiKey : null }
  } catch {
    return { apiKey: null }
  }
}

/** 持久化配置（目录不存在时自动创建） */
export function saveMcpApiKeyConfig(userData: string, cfg: McpApiKeyConfig): void {
  const p = getMcpConfigPath(userData)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(cfg, null, 2), 'utf-8')
}

/** 生成新的 API Key（32 字节随机 → mcp_ 前缀十六进制） */
export function generateMcpApiKey(): string {
  return `mcp_${crypto.randomBytes(32).toString('hex')}`
}

/** 确保 API Key 存在：缺失则生成并持久化，返回当前 Key */
export function ensureMcpApiKey(userData: string): string {
  const existing = loadMcpApiKeyConfig(userData).apiKey
  if (existing) return existing
  const key = generateMcpApiKey()
  saveMcpApiKeyConfig(userData, { apiKey: key })
  return key
}

/** 轮换 API Key（设置页「重新生成」用），返回新 Key */
export function rotateMcpApiKey(userData: string): string {
  const key = generateMcpApiKey()
  saveMcpApiKeyConfig(userData, { apiKey: key })
  return key
}

/** 鉴权器构造选项 */
export interface McpAuthenticatorOptions {
  logger: GovernanceLoggerLike
  /** 读取持久化 API Key（未配置返回 null） */
  getApiKey: () => string | null
  /** 校验 JWT（可选；后端不可用时返回 false 视为无效） */
  verifyJwt?: (token: string) => Promise<boolean>
}

/**
 * 构造默认鉴权器：先比对 API Key，再尝试 JWT 校验（双通道）。
 * fail-closed：均失败返回 { ok: false }。
 *
 * 每个核心分支均打 logger.info（[MCP] 前缀），便于排查 Token 401：
 *  ① 入口（是否带凭证）
 *  ② API Key 通道（未配置 / 匹配 / 不匹配）
 *  ③ JWT 通道（是否配置校验器 / 校验结果）
 *  ④ 最终放行 / 拒绝
 */
export function createMcpAuthenticator(opts: McpAuthenticatorOptions): McpAuthenticator {
  const { logger } = opts
  return async (token: string): Promise<McpAuthResult> => {
    const tokenPrefix = token ? `${token.slice(0, 8)}...` : null
    // ① 入口
    if (!token) {
      logger.info('[MCP] 鉴权：未携带凭证，拒绝', { module: 'McpServer' }, { hasToken: false })
      return { ok: false, error: '缺少凭证' }
    }
    logger.info('[MCP] 鉴权：收到凭证', { module: 'McpServer' }, { hasToken: true, tokenPrefix })

    // ② 通道 1：本地 API Key
    const apiKey = opts.getApiKey()
    if (!apiKey) {
      logger.info('[MCP] 鉴权：未配置 API Key，跳过本地通道', { module: 'McpServer' }, { tokenPrefix })
    } else if (token === apiKey) {
      logger.info('[MCP] 鉴权通过：API Key 匹配', { module: 'McpServer' }, { identity: 'api-key' })
      return { ok: true, identity: 'api-key' }
    } else {
      logger.info('[MCP] 鉴权：API Key 不匹配，尝试 JWT 通道', { module: 'McpServer' }, { tokenPrefix })
    }

    // ③ 通道 2：桌面端 JWT（后端校验）
    if (!opts.verifyJwt) {
      logger.info('[MCP] 鉴权：未配置 JWT 校验器，跳过 JWT 通道', { module: 'McpServer' }, { tokenPrefix })
    } else {
      logger.info('[MCP] 鉴权：调用后端 JWT 校验', { module: 'McpServer' }, { tokenPrefix })
      try {
        const valid = await opts.verifyJwt(token)
        if (valid) {
          logger.info('[MCP] 鉴权通过：JWT 有效', { module: 'McpServer' }, { identity: 'jwt' })
          return { ok: true, identity: 'jwt' }
        }
        logger.info('[MCP] 鉴权：JWT 校验未通过', { module: 'McpServer' }, { tokenPrefix, valid })
      } catch (error) {
        logger.warn('[MCP] JWT 校验异常，按无效处理', { module: 'McpServer' }, { error: error instanceof Error ? error.message : String(error) })
      }
    }

    // ④ 双通道均失败 → 拒绝（fail-closed）
    logger.info('[MCP] 鉴权拒绝：双通道均未通过', { module: 'McpServer' }, { tokenPrefix })
    return { ok: false, error: '凭证无效' }
  }
}

/**
 * 默认 JWT 校验器：调用桌面端后端 GET /api/auth/verify/（Bearer token）。
 * logger 可选：未传入时静默（便于无日志环境 / 单测复用）。
 * 核心分支均打日志（[MCP] 前缀），重点暴露后端返回 401（Token 无效/过期）的分支：
 *  ① 请求发出（URL / token 前缀 / 超时）
 *  ② 收到响应（status / ok）
 *  ③ 401 分支（Token 失效的直接原因）
 *  ④ 非 2xx 分支（后端异常）
 *  ⑤ 响应体 valid 字段判定
 *  ⑥ 请求异常（网络/超时）
 */
export function createBackendJwtVerifier(logger?: GovernanceLoggerLike): (token: string) => Promise<boolean> {
  const log: GovernanceLoggerLike = logger ?? {
    trace: () => {},
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  }
  return async (token: string): Promise<boolean> => {
    const url = `${backendBaseUrl()}/api/auth/verify/`
    const tokenPrefix = token ? `${token.slice(0, 8)}...` : null
    const timeoutMs = 5000
    // ① 请求发出
    log.info('[MCP] JWT 校验：请求后端', { module: 'McpServer' }, { url, tokenPrefix, timeoutMs })
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      })
      // ② 收到响应
      log.info('[MCP] JWT 校验：收到响应', { module: 'McpServer' }, { status: res.status, ok: res.ok })
      // ③ 401 分支：Token 无效/过期/被拉黑/密钥变更 —— Token 401 排查的核心分支
      if (res.status === 401) {
        log.info('[MCP] JWT 校验 401：Token 无效或已过期，后端拒绝放行', { module: 'McpServer' }, { status: 401, tokenPrefix })
        return false
      }
      // ④ 其他非 2xx 分支：后端 5xx / 网关错误等，非 Token 本身问题
      if (!res.ok) {
        log.info('[MCP] JWT 校验：后端异常未放行', { module: 'McpServer' }, { status: res.status, tokenPrefix })
        return false
      }
      // ⑤ 响应体判定
      const json = (await res.json()) as { valid?: boolean }
      log.info('[MCP] JWT 校验：后端判定结果', { module: 'McpServer' }, { valid: json.valid, tokenPrefix })
      return json.valid === true
    } catch (error) {
      // ⑥ 请求异常（网络/超时）
      log.error('[MCP] JWT 校验：请求异常，按无效处理', { module: 'McpServer' }, {
        error: error instanceof Error ? error.message : String(error),
        tokenPrefix,
      })
      return false
    }
  }
}
