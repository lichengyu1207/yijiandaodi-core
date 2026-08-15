/**
 * perfLogAnalyzer.ts — 治理日志性能分析器（统一日志分析工具）
 *
 * 解析 governance-%DATE%.log（JSON Lines，winston 文件格式）中的流式执行链路关键节点
 * 日志（RulePlanner 规划 / ToolBridge 调用 / 四官判定 / 治理引擎执行），按 runId 聚合，
 * 生成性能报告（min/avg/p50/p95/p99/max 耗时统计 + 最慢轮次 TopN）。
 *
 * 支持两类日志来源（与 loggerService.parseLogFile 同一兼容策略）：
 *  1. JSON Lines：`{"timestamp","level","message","context","metadata",...}`（机器可解析，首选）
 *  2. 控制台文本：`YYYY-MM-DD HH:mm:ss [INFO ] 消息 module=x function=y key=value`
 *
 * 纯 Node 实现（不依赖 electron），既可作为模块被主进程调用，也可作 CLI 独立运行：
 *   npx esbuild electron/agent/perfLogAnalyzer.ts --bundle --platform=node --format=cjs \
 *     --outfile=perf-analyzer.cjs
 *   node perf-analyzer.cjs <日志文件或目录> [--format text|json] [--limit N] [--output <path>]
 */

import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'

// ============================================================================
// 可注入日志器（纯 Node 实现，不依赖 electron；主进程注入 governanceLoggerInstance，
// 不注入则静默。用于排查去重键生成/合并是否正确）
// ============================================================================

/** 分析器日志方法签名（与 GovernanceLogger 兼容：message, context, metadata） */
export type PerfAnalyzerLogMethod = (
  message: string,
  context?: Record<string, unknown>,
  metadata?: unknown,
) => void

/** 分析器日志器接口（只需 trace/debug：去重链路属最细粒度埋点） */
export interface PerfAnalyzerLogger {
  trace: PerfAnalyzerLogMethod
  debug: PerfAnalyzerLogMethod
}

let perfAnalyzerLogger: PerfAnalyzerLogger | undefined

/** 注入分析器日志器（主进程在治理日志器就绪后调用；传 undefined 可恢复静默） */
export function setPerfAnalyzerLogger(logger?: PerfAnalyzerLogger): void {
  perfAnalyzerLogger = logger
}

// ============================================================================
// 类型定义
// ============================================================================

/** 解析后的单条日志 */
export interface ParsedLogLine {
  ts: string
  level: string
  message: string
  ctx: Record<string, unknown>
  meta: Record<string, unknown>
}

/** 单阶段（四官之一）判定样本 */
export interface StageSample {
  step: string
  progress: number
  elapsedMs: number
  gapMs: number
}

/** 单次桥调用样本（任意工具） */
export interface BridgeSample {
  tool: string
  callMs: number
  isError: boolean
  /** 失败时的错误消息（isError=true 时由 `[桥] 工具调用完成` 的 error 元数据捕获） */
  error?: string
}

/** 单次失败动作样本（来自治理引擎动作执行失败 / 权限拒绝 / 桥调用失败） */
export interface ErrorSample {
  tool?: string
  code?: string
  error: string
  denied?: boolean
}

/** 单轮（runId）聚合出的性能数据 */
export interface PerfRecord {
  runId: string
  startTs: string
  severity?: string
  planMs?: number
  actionCount?: number
  /** tool → 该轮最近一次调用耗时 */
  tools: Record<string, number>
  bridge: BridgeSample[]
  /** verify.flow 四官判定：后端段总耗时 + 逐官阶段帧 */
  flow: {
    backendMs?: number
    totalMs?: number
    attempts?: number
    stages: StageSample[]
  }
  /** 治理引擎本轮执行耗时 */
  exec?: { readonlyMs?: number; writeMs?: number; execMs?: number; succeeded?: number; failed?: number }
  /** 本轮失败动作样本（动作执行失败 / 权限拒绝 / 桥调用失败），按出现顺序去重 */
  errors: ErrorSample[]
}

/** 数值指标的分布统计 */
export interface MetricSummary {
  count: number
  min: number
  avg: number
  p50: number
  p95: number
  p99: number
  max: number
}

/** 性能报告 */
export interface PerfReport {
  files: string[]
  span: { from: string; to: string }
  runs: PerfRecord[]
  summary: {
    planMs: MetricSummary | null
    callMs: MetricSummary | null
    flowBackendMs: MetricSummary | null
    flowTotalMs: MetricSummary | null
    execMs: MetricSummary | null
    readonlyMs: MetricSummary | null
    writeMs: MetricSummary | null
    /** 四官各阶段 elapsedMs 分布（key=step） */
    byStage: Record<string, MetricSummary>
    /** 阶段帧间隔 gapMs 分布（>0 说明本地阶段管线存在卡顿） */
    stageGapMs: MetricSummary | null
    /** 失败统计：总数 + 按工具分布 */
    errors: { count: number; byTool: Record<string, number> }
    /** 含失败动作的轮次数 */
    failedRuns: number
  }
  /** 最慢轮次 TopN（按 execMs/totalMs 排序） */
  slowest: PerfRecord[]
  /** 含失败动作的轮次（按出现时间升序，含错误详情） */
  failures: PerfRecord[]
}

// ============================================================================
// 关键节点日志消息（与各埋点处 message 保持一致）
// ============================================================================

const MSG = {
  planEntry: '[规划] 事件到达，开始路由',
  planDone: '[规划] 规则路由完成',
  bridgeCall: '[桥] 工具调用',
  bridgeDone: '[桥] 工具调用完成',
  stage: 'verify.flow 阶段判定',
  flowDone: 'verify.flow 流式完成',
  engineDone: '[治理引擎] 本轮执行完成',
  actionFailed: '[治理引擎] 动作执行失败',
  actionDenied: '[治理引擎] 写动作被权限闸门拒绝',
} as const

// ============================================================================
// 解析
// ============================================================================

/** 解析文本中的每行（JSON Lines 优先，控制台文本兜底），自动跳过空行/无关行 */
export function parseLogLines(content: string): ParsedLogLine[] {
  const lines: ParsedLogLine[] = []
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const parsed = parseLine(line)
    if (parsed) lines.push(parsed)
  }
  return lines
}

function parseLine(raw: string): ParsedLogLine | null {
  // 1) JSON Lines（winston 文件日志）
  try {
    const obj: unknown = JSON.parse(raw)
    if (obj && typeof obj === 'object') {
      const record = obj as Record<string, unknown>
      if (typeof record.message === 'string') {
        return {
          ts: String(record.timestamp ?? ''),
          level: String(record.level ?? 'info'),
          message: record.message,
          ctx: toRecord(record.context),
          meta: toRecord(record.metadata),
        }
      }
    }
  } catch {
    // 非 JSON，落到文本解析
  }

  // 2) 控制台文本：`YYYY-MM-DD HH:mm:ss [INFO ] 消息 module=x function=y key=value`
  // 消息可能包含空格（如 `[规划] 规则路由完成`），第一个 module= 之前全部为消息
  const m = raw.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \[(\w+)\s*\] (.+)$/)
  if (m) {
    const [, ts, level, rest] = m
    // 分离消息部分（第一个 key=value 之前）与键值对部分
    const kvStart = rest.search(/\s\w+=/)
    let message: string
    let kvStr: string
    if (kvStart >= 0) {
      message = rest.slice(0, kvStart).trim()
      kvStr = rest.slice(kvStart + 1)
    } else {
      message = rest.trim()
      kvStr = ''
    }
    const ctx: Record<string, unknown> = {}
    const meta: Record<string, unknown> = {}
    for (const kv of kvStr.split(' ')) {
      const eq = kv.indexOf('=')
      if (eq <= 0) continue
      const key = kv.slice(0, eq)
      const value = parseKvValue(kv.slice(eq + 1))
      if (key === 'module' || key === 'function') ctx[key] = value
      else meta[key] = value
    }
    return { ts, level: level.toLowerCase(), message, ctx, meta }
  }
  return null
}

function toRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

function parseKvValue(s: string): unknown {
  if (s.startsWith('{') || s.startsWith('[')) {
    try {
      return JSON.parse(s)
    } catch {
      return s
    }
  }
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s)
  if (s === 'true') return true
  if (s === 'false') return false
  return s
}

// ============================================================================
// 分析：按 runId 聚合关键节点，产出耗时指标
// ============================================================================

/** 解析日志行 → 性能报告（不落盘，供模块内聚测试/流式聚合复用） */
export function analyzeGovernanceLog(lines: ParsedLogLine[], files: string[] = [], limit = 5): PerfReport {
  const byRun = new Map<string, PerfRecord>()
  for (const line of lines) {
    const runId = resolveRunId(line)
    if (!runId) continue
    let rec = byRun.get(runId)
    if (!rec) {
      rec = {
        runId,
        startTs: line.ts,
        tools: {},
        bridge: [],
        flow: { stages: [] },
        errors: [],
      }
      byRun.set(runId, rec)
    }
    applyLine(rec, line)
  }
  const runs = [...byRun.values()].sort((a, b) => (a.startTs < b.startTs ? -1 : a.startTs > b.startTs ? 1 : 0))
  return buildReport(runs, files, limit)
}

/** 统一 runId 解析：规划/桥/引擎日志带 runId；verify 的 backendLog 仅带 session_id（run_<id>_network） */
function resolveRunId(line: ParsedLogLine): string | undefined {
  const runId = line.meta.runId
  if (typeof runId === 'string' && runId) return runId
  const sessionId = line.meta.session_id
  if (typeof sessionId === 'string') {
    const m = /^run_(.+)_network$/.exec(sessionId)
    if (m) return m[1]
  }
  return undefined
}

function applyLine(rec: PerfRecord, line: ParsedLogLine): void {
  const msg = line.message
  if (msg.includes(MSG.planEntry)) {
    if (!rec.startTs) rec.startTs = line.ts
    rec.severity = toStr(line.meta.severity) || rec.severity
  } else if (msg.includes(MSG.planDone)) {
    rec.planMs = toNum(line.meta.planMs)
    rec.actionCount = toNum(line.meta.actionCount)
  } else if (msg.includes(MSG.bridgeDone)) {
    const tool = toStr(line.meta.name)
    const callMs = toNum(line.meta.callMs)
    if (tool && callMs !== undefined) {
      rec.tools[tool] = callMs
      const isError = line.meta.isError === true
      rec.bridge.push({ tool, callMs, isError, error: isError ? (toStr(line.meta.error) ?? '未知错误') : undefined })
      // 桥调用失败同样记入错误样本（与引擎动作执行失败去重）
      if (isError) {
        const sample: ErrorSample = { tool, error: toStr(line.meta.error) ?? '未知错误' }
        logErrorSource(rec, MSG.bridgeDone, sample)
        pushError(rec, sample)
      }
    }
  } else if (msg.includes(MSG.stage)) {
    const step = /\[([^\]]+)\]/.exec(msg)?.[1] ?? ''
    rec.flow.stages.push({
      step,
      progress: toNum(line.meta.progress) ?? 0,
      elapsedMs: toNum(line.meta.elapsedMs) ?? 0,
      gapMs: toNum(line.meta.gapMs) ?? 0,
    })
  } else if (msg.includes(MSG.flowDone)) {
    rec.flow.backendMs = toNum(line.meta.backendMs)
    rec.flow.totalMs = toNum(line.meta.totalMs)
    rec.flow.attempts = toNum(line.meta.attempts)
  } else if (msg.includes(MSG.engineDone)) {
    rec.exec = {
      readonlyMs: toNum(line.meta.readonlyMs),
      writeMs: toNum(line.meta.writeMs),
      execMs: toNum(line.meta.execMs),
      succeeded: toNum(line.meta.succeeded),
      failed: toNum(line.meta.failed),
    }
  } else if (msg.includes(MSG.actionFailed)) {
    const sample: ErrorSample = {
      tool: toStr(line.meta.tool),
      code: toStr(line.meta.code),
      error: toStr(line.meta.error) ?? '未知错误',
      denied: false,
    }
    logErrorSource(rec, MSG.actionFailed, sample)
    pushError(rec, sample)
  } else if (msg.includes(MSG.actionDenied)) {
    const sample: ErrorSample = {
      tool: toStr(line.meta.tool),
      code: toStr(line.meta.code) ?? 'permission_denied',
      error: toStr(line.meta.error) ?? '权限闸门拒绝',
      denied: true,
    }
    logErrorSource(rec, MSG.actionDenied, sample)
    pushError(rec, sample)
  }
}

/** 记录错误样本来源与生成的去重键（排查实际运行时的 key 生成链路） */
function logErrorSource(rec: PerfRecord, source: string, sample: ErrorSample): void {
  perfAnalyzerLogger?.trace(
    '[perfAnalyzer] 错误样本来源',
    { module: 'PerfLogAnalyzer', function: 'applyLine' },
    { runId: rec.runId, source, key: errorKey(sample), sample },
  )
}

/** 错误去重键：tool + denied 归一化（undefined/false → plain，true → denied）+ error。
 *  denied=true 的拒绝条目永不与普通失败合并；桥/引擎记录同一次失败（denied 均为 false/undefined）仍可合并。 */
export function errorKey(e: ErrorSample): string {
  return `${e.tool ?? ''}|${e.denied === true ? 'denied' : 'plain'}|${e.error}`
}

/** 按去重键追加错误样本（桥调用失败与引擎动作失败可能重复记录同一次失败），重复时合并补齐缺失字段 */
function pushError(rec: PerfRecord, sample: ErrorSample): void {
  const key = errorKey(sample)
  const existing = rec.errors.find((e) => errorKey(e) === key)
  if (existing) {
    let merged = false
    // 同一次失败可能先由桥日志（无 code）记录、再由引擎日志（有 code/denied）记录，补齐缺失字段
    if (!existing.code && sample.code) {
      existing.code = sample.code
      merged = true
      perfAnalyzerLogger?.trace(
        '[perfAnalyzer] 去重合并：补齐 code',
        { module: 'PerfLogAnalyzer', function: 'pushError' },
        { runId: rec.runId, key, filled: { code: sample.code }, incoming: sample, kept: existing },
      )
    }
    if (existing.denied === undefined && sample.denied !== undefined) {
      existing.denied = sample.denied
      merged = true
      perfAnalyzerLogger?.trace(
        '[perfAnalyzer] 去重合并：补齐 denied',
        { module: 'PerfLogAnalyzer', function: 'pushError' },
        { runId: rec.runId, key, filled: { denied: sample.denied }, incoming: sample, kept: existing },
      )
    }
    if (!merged) {
      perfAnalyzerLogger?.debug(
        '[perfAnalyzer] 去重命中：重复样本无字段可补，直接忽略',
        { module: 'PerfLogAnalyzer', function: 'pushError' },
        { runId: rec.runId, key, incoming: sample, kept: existing },
      )
    }
    return
  }
  rec.errors.push(sample)
  perfAnalyzerLogger?.trace(
    '[perfAnalyzer] 新增错误样本',
    { module: 'PerfLogAnalyzer', function: 'pushError' },
    { runId: rec.runId, key, sample },
  )
}

function toStr(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined
}

function toNum(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

/** 数值分布统计 */
export function summarize(values: number[]): MetricSummary | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const percentile = (q: number): number => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((q / 100) * sorted.length) - 1))]
  const sum = sorted.reduce((a, b) => a + b, 0)
  return {
    count: sorted.length,
    min: sorted[0],
    avg: sum / sorted.length,
    p50: percentile(50),
    p95: percentile(95),
    p99: percentile(99),
    max: sorted[sorted.length - 1],
  }
}

/** 慢轮排序分数：优先引擎执行耗时，其次 verify.flow 总耗时，再退到规划耗时 */
function runScore(r: PerfRecord): number {
  return r.exec?.execMs ?? r.flow.totalMs ?? r.planMs ?? 0
}

function buildReport(runs: PerfRecord[], files: string[], limit: number): PerfReport {
  const nums = (list: Array<number | undefined>): number[] => list.filter((v): v is number => v !== undefined)
  const byStage: Record<string, number[]> = {}
  const stageGaps: number[] = []
  for (const r of runs) {
    for (const s of r.flow.stages) {
      ;(byStage[s.step] ??= []).push(s.elapsedMs)
      stageGaps.push(s.gapMs)
    }
  }
  const stageSummary: Record<string, MetricSummary> = {}
  for (const [step, list] of Object.entries(byStage)) stageSummary[step] = summarize(list)!

  const slowest = [...runs].sort((a, b) => runScore(b) - runScore(a)).slice(0, limit)

  // 失败统计：errors 总数 + 按工具分布 + 含失败动作的轮次（按时间升序，含错误详情）
  const errorByTool: Record<string, number> = {}
  let errorCount = 0
  for (const r of runs) {
    for (const e of r.errors) {
      errorCount++
      const tool = e.tool ?? 'unknown'
      errorByTool[tool] = (errorByTool[tool] ?? 0) + 1
    }
  }
  const failures = runs
    .filter((r) => r.errors.length > 0 || (r.exec?.failed ?? 0) > 0)
    .sort((a, b) => (a.startTs < b.startTs ? -1 : a.startTs > b.startTs ? 1 : 0))

  return {
    files,
    span: { from: runs[0]?.startTs ?? '', to: runs[runs.length - 1]?.startTs ?? '' },
    runs,
    summary: {
      planMs: summarize(nums(runs.map((r) => r.planMs))),
      callMs: summarize(nums(runs.flatMap((r) => Object.values(r.tools)))),
      flowBackendMs: summarize(nums(runs.map((r) => r.flow.backendMs))),
      flowTotalMs: summarize(nums(runs.map((r) => r.flow.totalMs))),
      execMs: summarize(nums(runs.map((r) => r.exec?.execMs))),
      readonlyMs: summarize(nums(runs.map((r) => r.exec?.readonlyMs))),
      writeMs: summarize(nums(runs.map((r) => r.exec?.writeMs))),
      byStage: stageSummary,
      stageGapMs: summarize(stageGaps),
      errors: { count: errorCount, byTool: errorByTool },
      failedRuns: failures.length,
    },
    slowest,
    failures,
  }
}

// ============================================================================
// 报告渲染
// ============================================================================

function fmt(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms.toFixed(1)}ms`
}

/** 渲染单个指标区块：`名称  样本  平均  P50  P95  P99  最大` */
function renderMetricSection(title: string, unit: string, m: MetricSummary | null): string[] {
  if (!m) return [`─ ${title}  （无样本）`]
  return [
    `─ ${title}  `,
    `  样本=${m.count}  平均=${fmt(m.avg)}  P50=${fmt(m.p50)}  P95=${fmt(m.p95)}  P99=${fmt(m.p99)}  最大=${fmt(m.max)}`,
  ]
}

/** 渲染性能报告（text 人读 / json 机器读） */
export function renderReport(report: PerfReport, format: 'text' | 'json' = 'text'): string {
  if (format === 'json') return JSON.stringify(report, null, 2)

  const s = report.summary
  const lines: string[] = []
  lines.push('═══════════════ 治理流式链路性能报告 ═══════════════')
  lines.push(`来源文件: ${report.files.join(', ') || '(内存数据)'}`)
  lines.push(`分析范围: ${report.span.from || '?'} ~ ${report.span.to || '?'}`)
  lines.push(`有效执行轮次: ${report.runs.length}`)
  lines.push('')
  lines.push(...renderMetricSection('规划耗时 planMs', 'ms', s.planMs))
  lines.push('')
  lines.push(...renderMetricSection('桥调用耗时 callMs', 'ms', s.callMs))
  lines.push('')
  lines.push('─ 四官判定（verify.flow）')
  lines.push(...renderMetricSection('  后端全流程 backendMs', 'ms', s.flowBackendMs))
  lines.push(...renderMetricSection('  流式总耗时 totalMs', 'ms', s.flowTotalMs))
  lines.push(`  阶段帧间隔 gapMs（>0 说明本地阶段管线卡顿）: ${s.stageGapMs ? `样本=${s.stageGapMs.count} 平均=${fmt(s.stageGapMs.avg)} 最大=${fmt(s.stageGapMs.max)}` : '无样本'}`)
  const stageSteps = Object.keys(s.byStage)
  if (stageSteps.length > 0) {
    lines.push('  逐阶段 elapsedMs:')
    for (const step of ['request', 'auditor', 'verifier', 'archiver', 'judge', 'result']) {
      const m = s.byStage[step]
      if (m) lines.push(`    ${step.padEnd(9)} 样本=${m.count}  平均=${fmt(m.avg)}  P95=${fmt(m.p95)}  最大=${fmt(m.max)}`)
    }
  }
  lines.push('')
  lines.push('─ 治理引擎执行')
  lines.push(...renderMetricSection('  执行总耗时 execMs', 'ms', s.execMs))
  lines.push(...renderMetricSection('  只读批耗时 readonlyMs', 'ms', s.readonlyMs))
  lines.push(...renderMetricSection('  写批耗时 writeMs', 'ms', s.writeMs))
  lines.push('')
  lines.push('─ 失败/错误统计')
  lines.push(`  失败动作总数: ${s.errors.count}`)
  if (s.errors.count > 0) {
    const byTool = Object.entries(s.errors.byTool)
      .map(([t, c]) => `${t}=${c}`)
      .join('  ')
    lines.push(`  按工具分布: ${byTool}`)
  }
  lines.push(`  含失败动作轮次: ${s.failedRuns}`)
  lines.push('')
  lines.push(`─ 最慢 ${report.slowest.length} 轮（按 execMs/totalMs 排序，✗ 表示含失败动作）`)
  if (report.slowest.length === 0) {
    lines.push('  （无）')
  }
  for (const r of report.slowest) {
    const failed = r.errors.length > 0 || (r.exec?.failed ?? 0) > 0
    lines.push(
      `${failed ? '  ✗' : '    '} ${r.startTs}  runId=${r.runId}` +
        (r.severity ? ` severity=${r.severity}` : '') +
        ` planMs=${r.planMs ?? '-'}` +
        ` backendMs=${r.flow.backendMs ?? '-'}` +
        ` totalMs=${r.flow.totalMs ?? '-'}` +
        (r.flow.attempts && r.flow.attempts > 1 ? ` attempts=${r.flow.attempts}` : '') +
        ` execMs=${r.exec?.execMs ?? '-'}` +
        (failed ? ` failed=${(r.errors.length || r.exec?.failed) ?? 0}` : '')
    )
  }
  lines.push('')
  lines.push(`─ 失败轮次详情（${report.failures.length} 轮，含错误详情）`)
  if (report.failures.length === 0) {
    lines.push('  （无）')
  }
  for (const r of report.failures) {
    lines.push(
      `  ${r.startTs}  runId=${r.runId}` +
        (r.severity ? ` severity=${r.severity}` : '') +
        ` execMs=${r.exec?.execMs ?? '-'}` +
        ` succeeded=${r.exec?.succeeded ?? '-'}` +
        ` failed=${r.exec?.failed ?? r.errors.length}`
    )
    for (const e of r.errors) {
      lines.push(
        `    ✗ tool=${e.tool ?? '-'}` +
          (e.code ? ` code=${e.code}` : '') +
          (e.denied ? ' denied=true' : '')
      )
      lines.push(`      ${e.error}`)
    }
  }
  return lines.join('\n')
}

// ============================================================================
// 文件读取（流式，适配大日志文件）+ 顶层 API
// ============================================================================

/** 逐行流式读取日志文件（异步，不整文件载入内存） */
async function* readLogLines(filePath: string): AsyncGenerator<string> {
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  })
  for await (const line of rl) {
    const trimmed = line.trim()
    if (trimmed) yield trimmed
  }
  rl.close()
}

/** 解析单个日志文件的日志行（流式） */
export async function parseLogFile(filePath: string): Promise<ParsedLogLine[]> {
  const lines: ParsedLogLine[] = []
  for await (const raw of readLogLines(filePath)) {
    const parsed = parseLine(raw)
    if (parsed) lines.push(parsed)
  }
  return lines
}

/** 解析日志目录下所有 governance-*.log */
export async function resolveGovernanceLogFiles(input: string): Promise<string[]> {
  const stat = await fs.promises.stat(input).catch(() => null)
  if (!stat) throw new Error(`日志路径不存在: ${input}`)
  if (stat.isFile()) return [input]
  const names = await fs.promises.readdir(input)
  return names
    .filter((n) => /^governance-.*\.log$/.test(n))
    .sort()
    .map((n) => path.join(input, n))
}

/** 顶层 API：解析文件/目录 → 性能报告 */
export async function analyzeLogs(
  input: string,
  opts: { limit?: number } = {},
): Promise<PerfReport> {
  const files = await resolveGovernanceLogFiles(input)
  if (files.length === 0) throw new Error(`未找到治理日志文件: ${input}`)
  const all: ParsedLogLine[] = []
  for (const f of files) {
    for await (const raw of readLogLines(f)) {
      const parsed = parseLine(raw)
      if (parsed) all.push(parsed)
    }
  }
  return analyzeGovernanceLog(all, files, opts.limit ?? 5)
}

// ============================================================================
// CLI 入口：node perf-analyzer.cjs <文件|目录> [--format text|json] [--limit N] [--output <path>]
// ============================================================================

export interface CliOptions {
  input: string
  format: 'text' | 'json'
  limit: number
  output?: string
}

function parseCliArgs(argv: string[]): CliOptions {
  const args = [...argv]
  const positional: string[] = []
  const flags: Record<string, string> = {}
  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      flags[key] = args[i + 1] ?? ''
      i++
    } else {
      positional.push(a)
    }
  }
  if (positional.length === 0) throw new Error('缺少日志文件/目录参数')
  const format = flags.format === 'json' ? 'json' : 'text'
  const limit = Number(flags.limit) > 0 ? Number(flags.limit) : 5
  return { input: positional[0], format, limit, output: flags.output || undefined }
}

/** CLI 入口：返回退出码 */
export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const cli = parseCliArgs(argv)
  const report = await analyzeLogs(cli.input, { limit: cli.limit })
  const out = renderReport(report, cli.format)
  if (cli.output) {
    await fs.promises.writeFile(cli.output, out, 'utf-8')
    process.stdout.write(`性能报告已写入: ${cli.output}\n`)
  } else {
    process.stdout.write(out + '\n')
  }
  return 0
}

// 直接作为 CLI 运行（node perf-analyzer.cjs <文件|目录> ...）时自启动；
// 被模块 import / 测试环境（vitest ESM）不触发。
if (typeof require !== 'undefined' && require.main === module) {
  main().then(
    (code) => process.exit(code),
    (err: unknown) => {
      process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
      process.exit(1)
    },
  )
}
