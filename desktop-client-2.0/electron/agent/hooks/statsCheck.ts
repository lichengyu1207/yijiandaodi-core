/**
 * agent/hooks/statsCheck.ts — HookHostStats 自洽性校验（设计文档 §7 落地）
 *
 * 把 docs/HOOK_HOST_STATS_DESIGN.md §7 的 5 条不变量写成可执行断言，供压测与线上诊断复用：
 *  R1. Σ emitByPoint === emitTotal（无丢 emit）
 *  R2. hookExecTotal / skippedCount 非负，且在（可选）注册上界 emitTotal × maxHooksPerPoint 内
 *  R3. hookExecAvgMs = hookExecMs / hookExecTotal（派生一致性；hookExecTotal=0 时 avg 应为 0）
 *  R4. hookExecMaxMs ≥ hookExecAvgMs
 *  R5. 正常负载下 timeoutCount / trippedCount 应为 0（默认软警告；strict 模式升级为硬错误）
 *
 * 用法：
 *   const r = checkHookHostStats(stats, { maxHooksPerPoint: 10, strict: true })
 *   assertHookHostStats(stats, { maxHooksPerPoint: 10 })   // 违规即抛错（R5 默认仅警告）
 */

import type { HookHostStats } from './types'

export interface HookHostStatsCheckOptions {
  /** 任一钩子点最多注册的钩子数（R2 上界校验；缺省跳过上界校验） */
  maxHooksPerPoint?: number
  /** true：R5（超时/熔断 > 0）视为错误；false（默认）：仅记警告 */
  strict?: boolean
}

export interface HookHostStatsCheckResult {
  ok: boolean
  /** 违反的硬不变量（R1-R4 + strict 下的 R5） */
  errors: string[]
  /** 软提示（非 strict 下的 R5） */
  warnings: string[]
}

/** 逐条校验 5 条自洽性规则，返回错误/警告列表（不抛错） */
export function checkHookHostStats(
  stats: HookHostStats,
  opts?: HookHostStatsCheckOptions,
): HookHostStatsCheckResult {
  const errors: string[] = []
  const warnings: string[] = []
  const { maxHooksPerPoint, strict } = opts ?? {}

  // ---- R1：Σ emitByPoint === emitTotal（无丢 emit） ----
  const emitSum = Object.values(stats.emitByPoint).reduce((a, b) => a + b, 0)
  if (emitSum !== stats.emitTotal) {
    errors.push(`R1 违例：Σ emitByPoint=${emitSum} !== emitTotal=${stats.emitTotal}`)
  }

  // ---- R2：hookExecTotal / skippedCount 非负 +（可选）注册上界 ----
  if (stats.hookExecTotal < 0 || stats.skippedCount < 0) {
    errors.push(
      `R2 违例：hookExecTotal=${stats.hookExecTotal} / skippedCount=${stats.skippedCount} 不允许为负`,
    )
  }
  if (maxHooksPerPoint !== undefined) {
    const cap = stats.emitTotal * maxHooksPerPoint
    if (stats.hookExecTotal > cap) {
      errors.push(`R2 违例：hookExecTotal=${stats.hookExecTotal} > emitTotal×maxHooks=${cap}`)
    }
    if (stats.skippedCount > cap) {
      errors.push(`R2 违例：skippedCount=${stats.skippedCount} > emitTotal×maxHooks=${cap}`)
    }
  }

  // ---- R3：avg 派生一致性（hookExecTotal=0 时 avg 应为 0） ----
  const expectedAvg = stats.hookExecTotal > 0 ? stats.hookExecMs / stats.hookExecTotal : 0
  if (Math.abs(stats.hookExecAvgMs - expectedAvg) > 1e-9) {
    errors.push(
      `R3 违例：hookExecAvgMs=${stats.hookExecAvgMs} !== hookExecMs/hookExecTotal=${expectedAvg}`,
    )
  }

  // ---- R4：max ≥ avg ----
  if (stats.hookExecMaxMs < stats.hookExecAvgMs) {
    errors.push(`R4 违例：hookExecMaxMs=${stats.hookExecMaxMs} < hookExecAvgMs=${stats.hookExecAvgMs}`)
  }

  // ---- R5：正常负载下不应有超时/熔断 ----
  if (stats.timeoutCount > 0 || stats.trippedCount > 0) {
    const msg = `R5 提示：timeoutCount=${stats.timeoutCount} / trippedCount=${stats.trippedCount} > 0（非正常负载）`
    if (strict) errors.push(msg)
    else warnings.push(msg)
  }

  return { ok: errors.length === 0, errors, warnings }
}

/** 断言版本：硬不变量（R1-R4 + strict 下 R5）任一违例即抛错 */
export function assertHookHostStats(
  stats: HookHostStats,
  opts?: HookHostStatsCheckOptions,
): void {
  const result = checkHookHostStats(stats, opts)
  if (!result.ok) {
    throw new Error(`HookHostStats 自洽性校验失败:\n${result.errors.map((e) => ` - ${e}`).join('\n')}`)
  }
}
