/**
 * agent/hooks/types.ts — 插件钩子点契约（P1 契约落地）
 *
 * 三种合并策略（对话定稿规格）：
 *  - short-circuit（短路）—— onPercept / beforeAlert：
 *      任一插件返回 null → 立即终止：不再调用后续插件 + 不进入引擎主链路；
 *      插件抛异常 → 视同【放行】（记录异常 + errorCount++ 后继续，fail-open）
 *  - pipeline（叠加）—— beforePlan / beforeToolCall / afterToolCall：
 *      前一个插件的返回值 = 后一个插件的入参；返回 void → 保持原值继续传；
 *      插件抛异常 → 跳过该插件，用【上一个成功插件的返回值】继续（管道永不中断）
 *  - observe（只读并行）—— onRunStart / onRiskAssessed / onRunEnd：
 *      fire-and-forget 异步派发，主链路零阻塞；
 *      内部 Promise.allSettled + 每钩子超时；异常只记日志不外抛
 *
 * 设计约束：
 *  - 治理引擎 / ToolBridge 不感知插件，只依赖 PluginHooksHost.emit(name, data)
 *  - 载荷为独立定义的契约类型，避免与引擎内部类型耦合、避免循环依赖
 *  - 通用规则：执行顺序 priority 降序、同 priority 按安装序；
 *    errorCount ≥ circuitBreakerThreshold → 自动 disable（熔断）
 */

import type {
  AgentEventEnvelope,
  RiskEventData,
  ToolCallRequestData,
  ToolCallResultData,
} from '../../events/agentEventBus'
import type { AgentAction } from '../planner'

// ============================================================================
// 钩子点与合并策略
// ============================================================================

/** 8 个决策链路钩子点（引擎主循环 + ToolBridge 中的挂点） */
export type PluginHookPoint =
  | 'onPercept' // short-circuit：感知事件预处理（可改写 / 丢弃）
  | 'beforePlan' // pipeline：规划前（可改写决策输入 / 追加建议动作）
  | 'onRunStart' // observe：本轮 run 开始
  | 'onRiskAssessed' // observe：风险定级后（只读观察）
  | 'beforeAlert' // short-circuit：告警发送前（可改写 / 抑制）
  | 'beforeToolCall' // pipeline：工具校验+权限通过后、执行前（AOP）
  | 'afterToolCall' // pipeline：工具执行完成后、结果发布前（AOP）
  | 'onRunEnd' // observe：本轮 run 结束

/** 三种合并策略 */
export type HookMerge = 'short-circuit' | 'pipeline' | 'observe'

/** 各钩子点的合并策略（定稿） */
export const HOOK_MERGE: Record<PluginHookPoint, HookMerge> = {
  onPercept: 'short-circuit',
  beforeAlert: 'short-circuit',
  beforePlan: 'pipeline',
  beforeToolCall: 'pipeline',
  afterToolCall: 'pipeline',
  onRunStart: 'observe',
  onRiskAssessed: 'observe',
  onRunEnd: 'observe',
}

// ============================================================================
// 钩子载荷（独立契约，与引擎内部类型解耦）
// ============================================================================

/** onPercept 载荷：感知事件信封（插件可改写载荷或返回 null 丢弃） */
export type PerceptData = AgentEventEnvelope

/** beforePlan 载荷：决策输入（规划前可改写；插件可追加建议动作） */
export interface DecisionInput {
  envelope: AgentEventEnvelope
  riskData: RiskEventData
  /** 已规划动作（外部注入 preplanned 时携带）；插件可追加建议动作 */
  preplanned?: AgentAction[]
}

/** onRunStart 载荷 */
export interface RunStartData {
  runId: string
  stream: string
  seq: number
}

/** onRiskAssessed 载荷（定级后只读观察） */
export interface RiskAssessment {
  runId: string
  stream: string
  severity: 'info' | 'warning' | 'critical'
  hasVerifyFlow: boolean
  hasVerify: boolean
  anyFailed: boolean
}

/** beforeAlert 载荷：告警（插件可改写载荷或返回 null 抑制） */
export interface AlertPayload {
  level: 'warning' | 'critical'
  title: string
  description: string
  runId: string
  stream: string
}

/** beforeToolCall 载荷：工具调用请求（schema + 双层闸门通过后、执行前） */
export type ToolCallRequestPayload = ToolCallRequestData

/** afterToolCall 载荷：工具调用结果（执行完成后、截断/发布前） */
export type ToolCallResultPayload = ToolCallResultData

/** onRunEnd 载荷 */
export interface RunEndData {
  runId: string
  stream: string
  seq: number
  actions: number
  succeeded: number
  failed: number
  followUp: boolean
}

/** 钩子点 → 载荷类型映射 */
export interface HookDataMap {
  onPercept: PerceptData
  beforePlan: DecisionInput
  onRunStart: RunStartData
  onRiskAssessed: RiskAssessment
  beforeAlert: AlertPayload
  beforeToolCall: ToolCallRequestPayload
  afterToolCall: ToolCallResultPayload
  onRunEnd: RunEndData
}

/** 按钩子点取载荷类型 */
export type HookData<K extends PluginHookPoint> = HookDataMap[K]

/**
 * 各钩子点 handler 的返回类型（由合并策略决定）：
 *  - short-circuit：返回载荷或 null（null = 丢弃/抑制）
 *  - pipeline：返回改写后载荷或 void（void = 保持原值）
 *  - observe：无返回
 */
export type HookReturn<K extends PluginHookPoint> = K extends 'onPercept' | 'beforeAlert'
  ? HookData<K> | null
  : K extends 'beforePlan' | 'beforeToolCall' | 'afterToolCall'
    ? HookData<K> | void
    : void

/** 插件侧钩子 handler 签名 */
export type HookHandler<K extends PluginHookPoint> = (
  data: HookData<K>,
) => HookReturn<K> | Promise<HookReturn<K>>

/** 插件声明的决策链路钩子（可全部可选；mapped type 由 HookPoint 驱动） */
export type PluginHooks = {
  [K in PluginHookPoint]?: HookHandler<K>
}

// ============================================================================
// 钩子宿主（引擎只依赖此接口，与插件系统解耦）
// ============================================================================

/** emit 结果：引擎可据此感知短路是否发生 / 拿到 pipeline 改写后的最终载荷 */
export interface HookEmitResult<K extends PluginHookPoint = PluginHookPoint> {
  /** short-circuit 钩子是否被触发短路（丢弃/抑制）；pipeline/observe 恒为 false */
  shortCircuited: boolean
  /** 最终载荷：pipeline 改写后的值；short-circuit 放行或 observe 为原值；短路丢弃/抑制时为 null */
  data: HookData<K> | null
}

/** 钩子宿主：治理引擎 / ToolBridge 只依赖此接口 */
export interface PluginHooksHost {
  /** 触发一个钩子点：按合并策略遍历所有插件的同名钩子 */
  emit<K extends PluginHookPoint>(point: K, data: HookData<K>): Promise<HookEmitResult<K>>
}

// ============================================================================
// 性能统计（插件注册表性能监控：高并发表现观测）
// ============================================================================

/**
 * HooksHost 性能统计快照（`HooksHost.stats()` 返回）。
 *
 * 【产生方】HooksHost 内部埋点：每次 emit / 钩子执行 / 超时 / 熔断 / 跳过 / 短路时累加。
 * 【消费方】主进程 IPC `get-plugin-stats` 汇总给前端，设置页「性能概览」展示；
 *          后续可接入 perfLogAnalyzer 生成治理性能报告。
 * 【口径约定】
 *  - 计数器均为进程内累计值，观察窗口内可用 `resetStats()` 清零后重测；
 *  - 钩子执行耗时按“正常完成”计入（`hookExecMs`），超时/异常不计入耗时但计入 `timeoutCount`；
 *  - `hookExecAvgMs` 为派生值（`hookExecMs / hookExecTotal`），仅在 `stats()` 取快照时计算，避免每次累加做除法；
 *  - `emitByPoint` 与 `emitTotal` 满足：Σ emitByPoint = emitTotal（无丢钩子，可作自洽校验）。
 * 【测试参考】runtime.perf.test.ts 的 6 个压测场景以此快照断言计数自洽。
 */
export interface HookHostStats {
  /** emit 调用总次数（全钩子点累计） */
  emitTotal: number
  /** 各钩子点 emit 次数；Σ(值) === emitTotal，用于并发丢钩子自洽校验 */
  emitByPoint: Partial<Record<PluginHookPoint, number>>
  /** 钩子实际执行总次数（含 observe 异步派发；disabled/熔断跳过的不计入） */
  hookExecTotal: number
  /** 钩子执行累计耗时（ms；仅正常完成计入，超时/异常不计入） */
  hookExecMs: number
  /** 钩子执行平均耗时（ms；派生 = hookExecMs / hookExecTotal，stats() 时计算） */
  hookExecAvgMs: number
  /** 单次钩子执行最大耗时（ms；观测慢钩子） */
  hookExecMaxMs: number
  /** 钩子执行超时次数（每钩子超时上限 HOOK_DEFAULTS.timeoutMs） */
  timeoutCount: number
  /** 熔断触发次数（errorCount 连续达 circuitBreakerThreshold → 该插件钩子被跳过） */
  trippedCount: number
  /** 因 disabled / 熔断被跳过的钩子执行次数（emit 到但未真正执行） */
  skippedCount: number
  /** 短路触发次数（short-circuit 丢弃/抑制：onPercept / beforeAlert 返回 null） */
  shortCircuitCount: number
  /** 最近一次 emit 的时间戳（ms；0 = 尚未触发任何钩子） */
  lastEmitAt: number
}

// ============================================================================
// 运行时默认配置（可被 PluginRegistry 覆盖）
// ============================================================================

/** 钩子运行时默认配置 */
export const HOOK_DEFAULTS = {
  /** 每个插件钩子的执行超时上限（ms）；超时按异常处理（隔离 + errorCount++） */
  timeoutMs: 200,
  /** 熔断阈值：errorCount 连续达到该值 → 自动 disable（标 error） */
  circuitBreakerThreshold: 3,
  /** 插件级执行优先级：越大越先执行；同 priority 按安装先后（FIFO） */
  priority: 0,
} as const
