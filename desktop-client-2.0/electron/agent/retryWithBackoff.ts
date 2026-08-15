/**
 * agent/retryWithBackoff.ts — M3 指数退避重试
 *
 * 来源：Grok `retry.rs`（直接移植，纯函数，与 Rust 一一对应）。
 * calculateDelay(config, attempt) = min(base * 2^(attempt-1), maxDelayMs)，
 * 上限保护防止 2^n 溢出；executeWithBackoff 在 maxRetries 次失败后上抛最后一次错误。
 * 详见 docs/AGENT_FUSION_MODULE_DESIGN.md §0.2 / M3
 */

/** 重试配置（对齐 Grok BackoffConfig serde 字段） */
export interface BackoffConfig {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
}

/** 默认配置（对齐 Grok BackoffConfig::default） */
export const DEFAULT_BACKOFF: BackoffConfig = {
  maxRetries: 10,
  baseDelayMs: 1000,
  maxDelayMs: 30_000,
}

/**
 * 计算第 attempt 次重试前的等待毫秒数（对齐 Grok calculate_delay）。
 * attempt 从 1 开始：第 1 次失败 → base，第 2 次 → base*2，…封顶 maxDelayMs。
 */
export function calculateDelay(config: BackoffConfig, attempt: number): number {
  const exponent = Math.max(attempt - 1, 0)
  // 指数可能溢出（attempt 大时），先对指数做上限保护，再取 min 封顶
  const safeExponent = Math.min(exponent, 30)
  return Math.min(config.baseDelayMs * 2 ** safeExponent, config.maxDelayMs)
}

/**
 * 带指数退避重试地执行异步函数（对齐 Grok execute_with_backoff）。
 * - execute：被重试的异步函数，成功即返回结果；
 * - onRetry：每次重试前回调 (attempt, maxRetries, delayMs)，可空；
 * - 达到 maxRetries 次失败后，上抛最后一次错误。
 */
export async function executeWithBackoff<T, E = unknown>(
  config: BackoffConfig,
  execute: () => Promise<T>,
  onRetry?: (attempt: number, maxRetries: number, delayMs: number) => void | Promise<void>,
): Promise<T> {
  let attempt = 0
  let lastError: unknown

  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempt += 1
    try {
      const output = await execute()
      return output
    } catch (error) {
      const delayMs = calculateDelay(config, attempt)
      lastError = error

      if (attempt >= config.maxRetries) {
        break
      }

      if (onRetry) {
        await onRetry(attempt, config.maxRetries, delayMs)
      }
      await sleep(delayMs)
    }
  }

  throw lastError as E
}

/** 毫秒级睡眠（测试中可注入时钟/缩短延迟以加速） */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
