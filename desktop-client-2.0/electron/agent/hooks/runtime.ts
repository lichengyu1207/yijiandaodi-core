/**
 * agent/hooks/runtime.ts — HooksHost 核心运行时（P1 契约落地）
 *
 * 实现 PluginHooksHost 接口，按三种合并策略遍历插件钩子（定稿规格）：
 *  - short-circuit（短路）—— onPercept / beforeAlert：
 *      任一插件返回 null → 立即短路（丢弃/抑制），不再调用后续插件；
 *      插件抛异常 → 视同【放行】（记 errorCount++ 后继续，fail-open）
 *  - pipeline（叠加）—— beforePlan / beforeToolCall / afterToolCall：
 *      前一个插件的返回值 = 后一个插件的入参；返回 void → 保持原值继续传；
 *      插件抛异常 → 跳过该插件，用【上一个成功插件的返回值】继续（管道永不中断）
 *  - observe（只读并行）—— onRunStart / onRiskAssessed / onRunEnd：
 *      fire-and-forget 异步派发，主链路零阻塞；异常/超时只记日志不外抛
 *
 * 通用规则：
 *  - 执行顺序：priority 降序，同 priority 按安装先后（FIFO，seq 递增）
 *  - 异常隔离：单插件异常不阻断其他插件与主链路
 *  - 熔断：errorCount ≥ circuitBreakerThreshold → 跳过该插件所有钩子（reset 恢复）
 *  - 超时：每钩子默认 timeoutMs，超时按异常处理
 */

import type { GovernanceLoggerLike } from '../../events/governanceLogger'
import { checkHookHostStats } from './statsCheck'
import {
  HOOK_DEFAULTS,
  HOOK_MERGE,
  HookData,
  HookEmitResult,
  HookHandler,
  PluginHookPoint,
  PluginHooks,
  PluginHooksHost,
  HookReturn,
  HookHostStats,
} from './types'

// ============================================================================
// 类型定义
// ============================================================================

/** 已注册的钩子（含排序/熔断状态） */
interface RegisteredHook<K extends PluginHookPoint = PluginHookPoint> {
  pluginId: string
  point: K
  handler: HookHandler<K>
  /** 执行优先级：越大越先；同 priority 按 seq（安装先后） */
  priority: number
  /** 安装序号：同 priority 内 FIFO */
  seq: number
  /** 连续异常计数（熔断判定） */
  errorCount: number
  /** 单个钩子的超时上限（ms），缺省用全局 timeoutMs */
  timeoutMs?: number
  /** 是否启用（PluginRegistry disable 时置 false，emit 跳过） */
  enabled: boolean
}

/** HooksHost 构造选项 */
export interface HooksHostOptions {
  logger?: GovernanceLoggerLike
  /** 每个插件钩子的执行超时上限（默认 HOOK_DEFAULTS.timeoutMs） */
  timeoutMs?: number
  /** 熔断阈值（默认 HOOK_DEFAULTS.circuitBreakerThreshold） */
  circuitBreakerThreshold?: number
}

/** 插件钩子健康状态（供 health() 查询 / 插件中心展示） */
export interface PluginHookHealth {
  pluginId: string
  /** 该插件注册的钩子点数 */
  hookPoints: PluginHookPoint[]
  /** 是否启用（disabled 时 emit 跳过） */
  enabled: boolean
  /** 熔断是否已触发（errorCount >= threshold） */
  tripped: boolean
  errorCount: number
  threshold: number
}

// ============================================================================
// HooksHost — 钩子分发运行时
// ============================================================================

/**
 * 钩子宿主：持有各插件注册的钩子，emit() 按合并策略分发。
 * 治理引擎 / ToolBridge 只依赖 PluginHooksHost 接口，不感知插件系统。
 */
export class HooksHost implements PluginHooksHost {
  private registry = new Map<PluginHookPoint, RegisteredHook[]>()
  private log: GovernanceLoggerLike
  private timeoutMs: number
  private threshold: number
  private seqCounter = 0
  /** 性能计数（emit/执行/超时/熔断/跳过/短路）；与 stats() 方法区分，避免实例字段遮蔽原型方法 */
  private statsData: HookHostStats = {
    emitTotal: 0,
    emitByPoint: {},
    hookExecTotal: 0,
    hookExecMs: 0,
    hookExecAvgMs: 0,
    hookExecMaxMs: 0,
    timeoutCount: 0,
    trippedCount: 0,
    skippedCount: 0,
    shortCircuitCount: 0,
    lastEmitAt: 0,
  }

  constructor(opts?: HooksHostOptions) {
    this.log = opts?.logger ?? {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
      trace: () => {},
    }
    this.timeoutMs = opts?.timeoutMs ?? HOOK_DEFAULTS.timeoutMs
    this.threshold = opts?.circuitBreakerThreshold ?? HOOK_DEFAULTS.circuitBreakerThreshold
  }

  /**
   * 注册一个插件的全部钩子（插件安装时调用）。
   * 同 pluginId 重复注册会先移除旧钩子（幂等）。
   */
  register(pluginId: string, hooks: PluginHooks, opts?: { priority?: number; timeoutMs?: number }): void {
    this.unregister(pluginId)
    const priority = opts?.priority ?? HOOK_DEFAULTS.priority
    const seq = this.seqCounter++
    const entries = Object.entries(hooks) as Array<[PluginHookPoint, HookHandler<PluginHookPoint> | undefined]>
    for (const [point, handler] of entries) {
      if (!handler) continue
      if (!(point in HOOK_MERGE)) {
        this.log.warn('[钩子] 未知钩子点，跳过注册', { module: 'HooksHost', function: 'register' }, {
          pluginId,
          point,
        })
        continue
      }
      const hook: RegisteredHook = { pluginId, point, handler, priority, seq, errorCount: 0, timeoutMs: opts?.timeoutMs, enabled: true }
      this.insertSorted(point, hook)
      this.log.trace('[钩子] 钩子已注册', { module: 'HooksHost', function: 'register' }, {
        pluginId,
        point,
        priority,
        seq,
      })
    }
    this.log.info('[钩子] 插件钩子注册完成', { module: 'HooksHost', function: 'register' }, {
      pluginId,
      hookPoints: entries.filter(([, h]) => h).map(([p]) => p),
      priority,
    })
  }

  /** 注销一个插件的全部钩子（插件卸载时调用） */
  unregister(pluginId: string): void {
    let removed = 0
    for (const [point, hooks] of this.registry) {
      const before = hooks.length
      this.registry.set(
        point,
        hooks.filter((h) => h.pluginId !== pluginId),
      )
      removed += before - this.registry.get(point)!.length
    }
    if (removed > 0) {
      this.log.trace('[钩子] 钩子已注销', { module: 'HooksHost', function: 'unregister' }, { pluginId, removed })
    }
  }

  /** 重置某个插件的异常计数（解除熔断，用于手动重试/恢复） */
  reset(pluginId: string): void {
    let count = 0
    for (const hooks of this.registry.values()) {
      for (const h of hooks) {
        if (h.pluginId === pluginId) {
          h.errorCount = 0
          count++
        }
      }
    }
    if (count > 0) {
      this.log.info('[钩子] 插件异常计数已重置（解除熔断）', { module: 'HooksHost', function: 'reset' }, {
        pluginId,
        resetHooks: count,
      })
    }
  }

  /** 启用/停用某个插件的全部钩子（PluginRegistry disable/enable 时调用） */
  setEnabled(pluginId: string, enabled: boolean): void {
    let count = 0
    for (const hooks of this.registry.values()) {
      for (const h of hooks) {
        if (h.pluginId === pluginId) {
          h.enabled = enabled
          count++
        }
      }
    }
    this.log.info(enabled ? '[钩子] 插件钩子已启用' : '[钩子] 插件钩子已停用', {
      module: 'HooksHost', function: 'setEnabled',
    }, { pluginId, affectedHooks: count })
  }

  /** 查询插件钩子健康状态（可指定插件；缺省返回全部） */
  health(pluginId?: string): PluginHookHealth[] {
    const byPlugin = new Map<string, PluginHookHealth>()
    for (const [point, hooks] of this.registry) {
      for (const h of hooks) {
        if (pluginId && h.pluginId !== pluginId) continue
        const entry = byPlugin.get(h.pluginId) ?? {
          pluginId: h.pluginId,
          hookPoints: [],
          enabled: h.enabled,
          tripped: false,
          errorCount: 0,
          threshold: this.threshold,
        }
        entry.hookPoints.push(point)
        entry.errorCount = Math.max(entry.errorCount, h.errorCount)
        entry.enabled = h.enabled
        entry.tripped = entry.errorCount >= this.threshold
        byPlugin.set(h.pluginId, entry)
      }
    }
    return [...byPlugin.values()]
  }

  /** 当前注册钩子最多的钩子点的钩子数（供 statsCheck R2 上界校验） */
  maxHooksPerPoint(): number {
    let max = 0
    for (const hooks of this.registry.values()) {
      if (hooks.length > max) max = hooks.length
    }
    return max
  }

  /** 性能统计快照（插件注册表性能监控：emit/执行/超时/熔断/跳过/短路） */
  stats(): HookHostStats {
    const s = this.statsData
    const snapshot: HookHostStats = {
      ...s,
      emitByPoint: { ...s.emitByPoint },
      hookExecAvgMs: s.hookExecTotal > 0 ? s.hookExecMs / s.hookExecTotal : 0,
    }
    // debug：取快照时的原始计数值与分点明细（线上排查数据异常的关键入口；本地开发开 debug 可过滤）
    this.log.debug('[钩子] 取性能统计快照', { module: 'HooksHost', function: 'stats' }, {
      emitTotal: snapshot.emitTotal,
      emitByPoint: snapshot.emitByPoint,
      hookExecTotal: snapshot.hookExecTotal,
      hookExecMs: snapshot.hookExecMs,
      hookExecAvgMs: snapshot.hookExecAvgMs,
      hookExecMaxMs: snapshot.hookExecMaxMs,
      timeoutCount: snapshot.timeoutCount,
      trippedCount: snapshot.trippedCount,
      skippedCount: snapshot.skippedCount,
      shortCircuitCount: snapshot.shortCircuitCount,
      lastEmitAt: snapshot.lastEmitAt,
      maxHooksPerPoint: this.maxHooksPerPoint(),
    })
    // 线上自动校验：每次取快照即跑 statsCheck（R1-R4 硬违例记 error、R5 软提示记 warn；
    // 不抛错，避免校验异常影响主链路 / IPC 上报）
    this.validateSnapshot(snapshot)
    return snapshot
  }

  /** 对快照跑 statsCheck 自洽性校验并记日志（stats() 内部自动调用） */
  private validateSnapshot(snapshot: HookHostStats): void {
    const r = checkHookHostStats(snapshot, { maxHooksPerPoint: this.maxHooksPerPoint() })
    if (r.ok && r.warnings.length === 0) {
      // debug：校验通过（与 error/warn 形成完整链路，确认校验已执行）
      this.log.debug('[钩子] 性能统计自洽性校验通过（线上自动校验）', { module: 'HooksHost', function: 'stats' }, {
        emitTotal: snapshot.emitTotal,
        hookExecTotal: snapshot.hookExecTotal,
      })
      return
    }
    for (const rule of r.errors) {
      this.log.error('[钩子] 性能统计自洽性校验失败（线上自动校验）', { module: 'HooksHost', function: 'stats' }, {
        rule,
        emitTotal: snapshot.emitTotal,
        hookExecTotal: snapshot.hookExecTotal,
      })
    }
    for (const rule of r.warnings) {
      this.log.warn('[钩子] 性能统计自洽性提示（线上自动校验）', { module: 'HooksHost', function: 'stats' }, {
        rule,
        emitTotal: snapshot.emitTotal,
        hookExecTotal: snapshot.hookExecTotal,
      })
    }
  }

  /** 重置性能统计（观察窗口 / 测试用）；不影响钩子注册与熔断状态 */
  resetStats(): void {
    const before = { ...this.statsData, emitByPoint: { ...this.statsData.emitByPoint } }
    this.statsData = {
      emitTotal: 0,
      emitByPoint: {},
      hookExecTotal: 0,
      hookExecMs: 0,
      hookExecAvgMs: 0,
      hookExecMaxMs: 0,
      timeoutCount: 0,
      trippedCount: 0,
      skippedCount: 0,
      shortCircuitCount: 0,
      lastEmitAt: 0,
    }
    // debug：重置发生时的历史快照（排查误触发重置导致数据归零的根因）
    this.log.debug('[钩子] 性能统计已重置', { module: 'HooksHost', function: 'resetStats' }, {
      beforeEmitTotal: before.emitTotal,
      beforeEmitByPoint: before.emitByPoint,
      beforeHookExecTotal: before.hookExecTotal,
      beforeTimeoutCount: before.timeoutCount,
      beforeTrippedCount: before.trippedCount,
      beforeSkippedCount: before.skippedCount,
    })
  }

  /**
   * 触发一个钩子点：按合并策略遍历所有插件的同名钩子。
   * 任一插件被熔断（tripped）则直接跳过其钩子。
   */
  async emit<K extends PluginHookPoint>(point: K, data: HookData<K>): Promise<HookEmitResult<K>> {
    const merge = HOOK_MERGE[point]
    const hooks = this.registry.get(point) ?? []
    // 过滤：已停用（disabled）或已熔断（tripped）的插件钩子不参与
    const active = hooks.filter((h) => h.enabled && h.errorCount < this.threshold)

    // ---- 性能计数：emit 到达 / 因 disabled|熔断被跳过的钩子 ----
    this.statsData.emitTotal++
    this.statsData.emitByPoint[point] = (this.statsData.emitByPoint[point] ?? 0) + 1
    this.statsData.skippedCount += hooks.length - active.length
    this.statsData.lastEmitAt = Date.now()

    // trace：钩子触发入口（性能排查关键节点 —— 记录到达 + 参与插件清单）
    this.log.trace('[钩子] 触发', { module: 'HooksHost', function: 'emit' }, {
      point,
      merge,
      totalHooks: hooks.length,
      activeHooks: active.length,
      skippedHooks: hooks.length - active.length,
      plugins: active.map((h) => `${h.pluginId}#${h.priority}`),
    })

    switch (merge) {
      case 'short-circuit':
        return this.emitShortCircuit(point, active as RegisteredHook<K>[], data)
      case 'pipeline':
        return this.emitPipeline(point, active as RegisteredHook<K>[], data)
      case 'observe':
        return this.emitObserve(point, active as RegisteredHook<K>[], data)
    }
  }

  // ==================== 三种合并策略 ====================

  /** short-circuit：任一插件返回 null → 短路（丢弃/抑制）；异常视同放行 */
  private async emitShortCircuit<K extends PluginHookPoint>(
    point: K,
    hooks: RegisteredHook<K>[],
    initial: HookData<K>,
  ): Promise<HookEmitResult<K>> {
    let current: HookData<K> | null = initial
    for (const hook of hooks) {
      try {
        const r = await this.runWithTimeout(point, hook, current as HookData<K>)
        if (r === null) {
          this.statsData.shortCircuitCount++
          this.log.info('[钩子] 短路触发（丢弃/抑制）', { module: 'HooksHost', function: 'emit' }, {
            point,
            pluginId: hook.pluginId,
          })
          return { shortCircuited: true, data: null }
        }
        current = r
      } catch (error) {
        // 异常视同【放行】：记录后继续后续插件（fail-open，治理场景宁可多处理不可漏监控）
        this.bumpError(point, hook, error)
      }
    }
    return { shortCircuited: false, data: current }
  }

  /** pipeline：返回值 = 下一插件入参；void 保持；异常跳过（用上一步值继续） */
  private async emitPipeline<K extends PluginHookPoint>(
    point: K,
    hooks: RegisteredHook<K>[],
    initial: HookData<K>,
  ): Promise<HookEmitResult<K>> {
    let current: HookData<K> = initial
    for (const hook of hooks) {
      try {
        const r = await this.runWithTimeout(point, hook, current)
        if (r !== undefined) current = r
      } catch (error) {
        // 跳过该插件：保留【上一个成功插件的返回值】，管道永不中断
        this.bumpError(point, hook, error)
      }
    }
    return { shortCircuited: false, data: current }
  }

  /** observe：fire-and-forget 异步派发，主链路零阻塞 */
  private async emitObserve<K extends PluginHookPoint>(
    point: K,
    hooks: RegisteredHook<K>[],
    data: HookData<K>,
  ): Promise<HookEmitResult<K>> {
    for (const hook of hooks) {
      this.dispatchAsync(point, hook, data)
    }
    return { shortCircuited: false, data }
  }

  // ==================== 内部工具 ====================

  /** 按 priority 降序、同 priority 按 seq 升序插入（注册时维护有序，emit 免排序） */
  private insertSorted<K extends PluginHookPoint>(point: PluginHookPoint, hook: RegisteredHook<K>): void {
    const list = this.registry.get(point) ?? []
    let index = list.length
    for (let i = 0; i < list.length; i++) {
      if (list[i].priority < hook.priority || (list[i].priority === hook.priority && list[i].seq > hook.seq)) {
        index = i
        break
      }
    }
    list.splice(index, 0, hook as RegisteredHook)
    this.registry.set(point, list)
  }

  /** 执行单个钩子并附加超时（超时按异常处理） */
  private async runWithTimeout<K extends PluginHookPoint>(
    point: K,
    hook: RegisteredHook<K>,
    data: HookData<K>,
  ): Promise<HookReturn<K>> {
    const timeoutMs = hook.timeoutMs ?? this.timeoutMs
    let timer: NodeJS.Timeout | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        this.statsData.timeoutCount++
        reject(new Error(`[钩子] ${hook.pluginId} ${point} 执行超时 ${timeoutMs}ms`))
      }, timeoutMs)
    })
    // ---- 性能计数：钩子执行（正常完成计入耗时；超时/异常不计耗时，只计超时数）----
    const started = performance.now()
    this.statsData.hookExecTotal++
    try {
      const result = await Promise.race([hook.handler(data), timeout])
      const ms = performance.now() - started
      this.statsData.hookExecMs += ms
      if (ms > this.statsData.hookExecMaxMs) this.statsData.hookExecMaxMs = ms
      return result
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  /** observe 钩子异步派发：内部吞异常，只记日志 + 计错 */
  private dispatchAsync<K extends PluginHookPoint>(
    point: K,
    hook: RegisteredHook<K>,
    data: HookData<K>,
  ): void {
    void this.runWithTimeout(point, hook, data)
      .catch((error) => this.bumpError(point, hook, error))
  }

  /** 异常计数 + 熔断检查（统一入口） */
  private bumpError(point: PluginHookPoint, hook: RegisteredHook, error: unknown): void {
    hook.errorCount++
    const tripped = hook.errorCount >= this.threshold
    if (tripped) this.statsData.trippedCount++
    this.log.warn(tripped ? '[钩子] 插件触发熔断' : '[钩子] 钩子执行异常', { module: 'HooksHost', function: 'bumpError' }, {
      point,
      pluginId: hook.pluginId,
      errorCount: hook.errorCount,
      threshold: this.threshold,
      tripped,
      error: error instanceof Error ? error.message : error,
    })
  }
}
