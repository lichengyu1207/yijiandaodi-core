import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'

export type PerfAnalyzerLogMethod = (
  message: string,
  context?: Record<string, unknown>,
  metadata?: unknown,
) => void

export interface PerfAnalyzerLogger {
  trace: PerfAnalyzerLogMethod
  debug: PerfAnalyzerLogMethod
}

let perfAnalyzerLogger: PerfAnalyzerLogger | undefined

export function setPerfAnalyzerLogger(logger?: PerfAnalyzerLogger): void {
  perfAnalyzerLogger = logger
}

export interface ParsedLogLine {
  ts: string
  level: string
  message: string
  ctx: Record<string, unknown>
  meta: Record<string, unknown>
}

export interface StageSample {
  step: string
  progress: number
  elapsedMs: number
  gapMs: number
}

export interface BridgeSample {
  tool: string
  callMs: number
  isError: boolean
  error?: string
}

export interface ErrorSample {
  tool?: string
  code?: string
  error: string
  denied?: boolean
}

export interface PerfRecord {
  runId: string
  startTs: string
  severity?: string
  planMs?: number
  actionCount?: number
  tools: Record<string, number>
  bridge: BridgeSample[]
  flow: {
    backendMs?: number
    totalMs?: number
    attempts?: number
    stages: StageSample[]
  }
  exec?: { readonlyMs?: number; writeMs?: number; execMs?: number; succeeded?: number; failed?: number }
  errors: ErrorSample[]
}

export interface MetricSummary {
  count: number
  min: number
  avg: number
  p50: number
  p95: number
  p99: number
  max: number
}

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
    byStage: Record<string, MetricSummary>
    stageGapMs: MetricSummary | null
    errors: { count: number; byTool: Record<string, number> }
    failedRuns: number
  }
  slowest: PerfRecord[]
  failures: PerfRecord[]
}

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
    // non-JSON, fall through to plain-text parsing
  }

  const m = raw.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \[(\w+)\s*\] (.+)$/)
  if (m) {
    const [, ts, level, rest] = m
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

function logErrorSource(rec: PerfRecord, source: string, sample: ErrorSample): void {
  perfAnalyzerLogger?.trace(
    '[perfAnalyzer] 错误样本来源',
    { module: 'PerfLogAnalyzer', function: 'applyLine' },
    { runId: rec.runId, source, key: errorKey(sample), sample },
  )
}

export function errorKey(e: ErrorSample): string {
  return `${e.tool ?? ''}|${e.denied === true ? 'denied' : 'plain'}|${e.error}`
}

function pushError(rec: PerfRecord, sample: ErrorSample): void {
  const key = errorKey(sample)
  const existing = rec.errors.find((e) => errorKey(e) === key)
  if (existing) {
    let merged = false
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

function fmt(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms.toFixed(1)}ms`
}

function renderMetricSection(title: string, unit: string, m: MetricSummary | null): string[] {
  if (!m) return [`─ ${title}  （无样本）`]
  return [
    `─ ${title}  `,
    `  样本=${m.count}  平均=${fmt(m.avg)}  P50=${fmt(m.p50)}  P95=${fmt(m.p95)}  P99=${fmt(m.p99)}  最大=${fmt(m.max)}`,
  ]
}

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

export async function parseLogFile(filePath: string): Promise<ParsedLogLine[]> {
  const lines: ParsedLogLine[] = []
  for await (const raw of readLogLines(filePath)) {
    const parsed = parseLine(raw)
    if (parsed) lines.push(parsed)
  }
  return lines
}

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

const isCliEntry =
  typeof require !== 'undefined' &&
  require.main === module &&
  typeof process !== 'undefined' &&
  !(process.versions as NodeJS.ProcessVersions).electron &&
  process.argv[1] !== undefined &&
  /perf[-_.]?analyzer(\.c?js)?$/i.test(path.basename(process.argv[1]))

if (isCliEntry) {
  main().then(
    (code) => process.exit(code),
    (err: unknown) => {
      process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`)
      process.exit(1)
    },
  )
}