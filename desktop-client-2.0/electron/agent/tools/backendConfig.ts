/**
 * agent/tools/backendConfig.ts — 内置工具共享后端配置与 HTTP 封装
 *
 * 供 verify / evidence / report / backend 四类网络型工具共用：
 *  - baseUrl / token / logger / retry 注入式配置（main process 无 localStorage，由
 *    GovernanceEngine 启动时 setBackendClientConfig 注入）；
 *  - authHeaders / backendRequest / parseBackendData 统一封装饰 JS 与 401 头。
 *
 * 详见 docs/AGENT_FUSION_MODULE_DESIGN.md §0.4 / M4
 */

import { BackoffConfig } from '../retryWithBackoff'
import { executeWithBackoff } from '../retryWithBackoff'
import { ToolError } from '../types'
import { GovernanceLoggerLike } from '../../events/governanceLogger'

export interface BackendClientConfig {
  baseUrl?: string
  token?: string
  logger?: GovernanceLoggerLike
  retry?: Partial<BackoffConfig>
}

let _baseUrl = 'http://localhost:8000'
let _token = ''
let _logger: GovernanceLoggerLike | undefined
let _retry: BackoffConfig = { maxRetries: 3, baseDelayMs: 2000, maxDelayMs: 10_000 }

/** 注入后端配置（GovernanceEngine 启动时调用；重复调用合并覆盖） */
export function setBackendClientConfig(config: BackendClientConfig): void {
  if (config.baseUrl !== undefined) _baseUrl = config.baseUrl.replace(/\/+$/, '')
  if (config.token !== undefined) _token = config.token
  if (config.logger !== undefined) _logger = config.logger
  if (config.retry !== undefined) _retry = { ..._retry, ...config.retry }
}

/** 重置为默认（测试用） */
export function resetBackendClientConfig(): void {
  _baseUrl = 'http://localhost:8000'
  _token = ''
  _logger = undefined
  _retry = { maxRetries: 3, baseDelayMs: 2000, maxDelayMs: 10_000 }
}

export function backendBaseUrl(): string {
  return _baseUrl
}

export function backendRetry(): BackoffConfig {
  return _retry
}

/** 构造请求头（无 token 时不带 Authorization） */
export function backendAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (_token) headers['Authorization'] = `Bearer ${_token}`
  return headers
}

/** 后端日志（module 固定 tools/backend，便于治理日志过滤） */
export function backendLog(
  method: 'trace' | 'debug' | 'info' | 'warn' | 'error',
  message: string,
  meta?: Record<string, unknown>,
): void {
  _logger?.[method](message, { module: 'tools/backend' }, meta)
}

/** 统一的带超时后端请求 */
export async function backendRequest(
  method: 'GET' | 'POST',
  urlPath: string,
  body?: unknown,
  timeoutMs = 15_000,
): Promise<Response> {
  return fetch(`${_baseUrl}${urlPath}`, {
    method,
    headers: backendAuthHeaders(),
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  })
}

/** 解析后端响应：非 2xx 抛 ToolError；2xx 统一提取 data 字段（兼容 {success,data} 与直接 {…} 两种风格） */
export async function parseBackendData(response: Response, toolName: string): Promise<unknown> {
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`${toolName} 返回 ${response.status}: ${body || response.statusText}`)
  }
  const json = (await response.json()) as Record<string, unknown>
  return (json.data !== undefined ? json.data : json) ?? json
}

/**
 * 网络型工具统一入口：指数退避重试 + 失败包装为 ToolError('execution_error')。
 * 所有后端调用失败的最后一次错误在此上抛，供 ToolBridge/规划层/存证层机器判断。
 */
export async function callBackendWithRetry<T>(
  toolName: string,
  execute: () => Promise<T>,
  onRetry?: (attempt: number, maxRetries: number, delayMs: number) => void,
): Promise<T> {
  try {
    return await executeWithBackoff(backendRetry(), execute, onRetry)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new ToolError('execution_error', `${toolName} 后端调用失败: ${msg}`, {
      tool: toolName,
      error: msg,
    })
  }
}
