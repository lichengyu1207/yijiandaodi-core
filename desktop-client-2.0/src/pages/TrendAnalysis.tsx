/**
 * 消费趋势仪表盘（P2 分析一期）
 *
 * 对接后端：
 * - GET /api/usage/trend-analysis（总体趋势 / 成本分解 / Top10 昂贵调用 / 优化建议）
 * - GET /api/stats/trend（分位 + 3σ 异常点）
 *
 * 覆盖需求 §5.2.1：帮助用户理解"钱花在哪里"，找出可优化点。
 */
import { useState, useEffect } from 'react'
import DateRangePicker, { DateRangeValue } from '../components/DateRangePicker'
import {
  statsService,
  TrendAnalysisPoint,
  CostBreakdownItem,
  TopExpensiveItem,
  SuggestionItem,
} from '../services/statsService'

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const SUCCESS_TYPE = {
  info: { color: 'var(--brand-primary)', label: '提示', icon: 'ℹ️' },
  cost: { color: 'var(--status-warning)', label: '成本', icon: '💰' },
  warning: { color: 'var(--status-warning)', label: '警告', icon: '⚠️' },
  error: { color: 'var(--status-error)', label: '异常', icon: '🚨' },
} as const

/** 轻量 SVG 折线图：费用随时间变化 + 3σ 异常点标红 */
function TrendLineChart({ points }: { points: TrendAnalysisPoint[] }) {
  const W = 760
  const H = 220
  const PAD = { l: 56, r: 16, t: 18, b: 32 }

  const maxCost = Math.max(...points.map((p) => p.cost), 1e-6)
  const innerW = W - PAD.l - PAD.r
  const innerH = H - PAD.t - PAD.b

  const x = (i: number) => (points.length <= 1 ? PAD.l + innerW / 2 : PAD.l + (i / (points.length - 1)) * innerW)
  const y = (v: number) => PAD.t + innerH - (v / maxCost) * innerH

  const linePoints = points.map((p, i) => `${x(i)},${y(p.cost)}`).join(' ')

  // Y 轴网格线（0 / 25% / 50% / 75% / 100%）
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((r) => ({
    y: PAD.t + innerH - r * innerH,
    label: maxCost * r,
  }))

  // X 轴标签：取首/中/尾（点少时全部展示）
  const labelIdx = points.length <= 6 ? points.map((_, i) => i) : [0, Math.floor((points.length - 1) / 2), points.length - 1]

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', maxWidth: 760 }}>
      {gridLines.map((g, i) => (
        <g key={i}>
          <line x1={PAD.l} y1={g.y} x2={W - PAD.r} y2={g.y} stroke="var(--border-secondary)" strokeDasharray="4 4" strokeWidth="1" />
          <text x={PAD.l - 6} y={g.y + 4} textAnchor="end" fontSize="11" fill="var(--text-tertiary)">
            {g.label >= 1 ? `¥${g.label.toFixed(0)}` : `¥${g.label.toFixed(3)}`}
          </text>
        </g>
      ))}

      {/* 折线 */}
      <polyline points={linePoints} fill="none" stroke="var(--brand-primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

      {/* 数据点：异常点标红放大 */}
      {points.map((p, i) => (
        <circle
          key={p.date}
          cx={x(i)}
          cy={y(p.cost)}
          r={p.anomaly ? 5 : 2.5}
          fill={p.anomaly ? 'var(--status-error)' : 'var(--brand-primary)'}
          stroke="var(--bg-secondary)"
          strokeWidth="1"
        >
          <title>{`${p.date} 费用 ¥${p.cost} · ${p.calls}次调用${p.anomaly ? ' · ⚠️异常峰值' : ''}`}</title>
        </circle>
      ))}

      {/* X 轴日期标签 */}
      {labelIdx.map((i) => (
        <text key={i} x={x(i)} y={H - 10} textAnchor="middle" fontSize="10" fill="var(--text-tertiary)">
          {points[i].date.slice(5)}
        </text>
      ))}
    </svg>
  )
}

/** 成本分解横向条形图（按模型 / 按场景） */
function BreakdownBars({ title, items, labelKey }: { title: string; items: CostBreakdownItem[]; labelKey: 'model' | 'scenario' }) {
  if (items.length === 0) {
    return (
      <div style={{ flex: 1, minWidth: 260 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>{title}</div>
        <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-tertiary)', fontSize: 13 }}>暂无数据</div>
      </div>
    )
  }
  return (
    <div style={{ flex: 1, minWidth: 260 }}>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>{title}</div>
      {items.map((it) => (
        <div key={labelKey} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <span style={{ width: 96, fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {(it as any)[labelKey] || '未知'}
          </span>
          <div style={{ flex: 1, height: 10, borderRadius: 5, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.max(it.share, 2)}%`,
                height: '100%',
                borderRadius: 5,
                background: it.share >= 60 ? 'var(--status-warning)' : 'var(--brand-primary)',
              }}
            />
          </div>
          <span style={{ width: 90, fontSize: 12, textAlign: 'right', color: 'var(--text-primary)' }}>
            ¥{it.cost.toFixed(4)} · {it.share}%
          </span>
        </div>
      ))}
    </div>
  )
}

const SUGGESTION_STYLE: Record<SuggestionItem['type'], { border: string; bg: string }> = {
  info: { border: 'var(--border-primary)', bg: 'var(--bg-secondary)' },
  cost: { border: 'var(--status-warning)', bg: 'color-mix(in srgb, var(--status-warning) 8%, transparent)' },
  warning: { border: 'var(--status-warning)', bg: 'color-mix(in srgb, var(--status-warning) 8%, transparent)' },
  error: { border: 'var(--status-error)', bg: 'color-mix(in srgb, var(--status-error) 8%, transparent)' },
}

export default function TrendAnalysis() {
  const [range, setRange] = useState<DateRangeValue>(() => {
    const today = new Date()
    return { label: '近30天', start_date: fmt(new Date(today.getTime() - 29 * 864e5)), end_date: fmt(today) }
  })
  const [trend, setTrend] = useState<TrendAnalysisPoint[]>([])
  const [summary, setSummary] = useState<{
    total_cost: number
    total_calls: number
    total_tokens: number
    avg_cost_per_call: number
    error_rate: number
    period_days: number
  } | null>(null)
  const [byModel, setByModel] = useState<CostBreakdownItem[]>([])
  const [byScenario, setByScenario] = useState<CostBreakdownItem[]>([])
  const [topExpensive, setTopExpensive] = useState<TopExpensiveItem[]>([])
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    statsService
      .getTrendAnalysis({ start_date: range.start_date, end_date: range.end_date })
      .then((res) => {
        if (cancelled) return
        const data = res?.data
        setSummary(data?.summary ?? null)
        setTrend(data?.trend ?? [])
        setByModel(data?.cost_breakdown?.by_model ?? [])
        setByScenario(data?.cost_breakdown?.by_scenario ?? [])
        setTopExpensive(data?.top_expensive ?? [])
        setSuggestions(data?.suggestions ?? [])
      })
      .catch(() => {
        if (cancelled) return
        setSummary(null)
        setTrend([])
        setByModel([])
        setByScenario([])
        setTopExpensive([])
        setSuggestions([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [range.start_date, range.end_date])

  const isEmpty = !loading && !summary

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 头部：标题 + 时间范围 */}
      <div className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="card-title" style={{ margin: 0 }}>消费趋势分析</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
            洞察 AI 调用成本构成 · 标记异常峰值 · 生成优化建议
          </div>
        </div>
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-tertiary)' }}>加载中...</div>
      ) : isEmpty ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-tertiary)' }}>
          暂无 API 调用数据，发起调用后将在此展示消费趋势分析
        </div>
      ) : (
        <>
          {/* 概要统计卡片 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--text-primary)' }}>¥{summary?.total_cost.toFixed(4)}</div>
              <div className="stat-label">总费用（元）</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--text-primary)' }}>{summary?.total_calls}</div>
              <div className="stat-label">调用次数</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--brand-primary)' }}>{summary?.total_tokens.toLocaleString()}</div>
              <div className="stat-label">总 Tokens</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--status-warning)' }}>¥{summary?.avg_cost_per_call.toFixed(6)}</div>
              <div className="stat-label">单次均费</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: summary && summary.error_rate > 5 ? 'var(--status-error)' : 'var(--status-success)' }}>
                {summary?.error_rate}%
              </div>
              <div className="stat-label">错误率</div>
            </div>
          </div>

          {/* 消费趋势折线图 */}
          <div className="card" style={{ padding: 20 }}>
            <div className="card-header" style={{ padding: 0, border: 'none' }}>
              <div className="card-title">消费趋势（{range.label}）</div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                <span style={{ color: 'var(--status-error)' }}>●</span> 异常峰值（均值 + 3σ）
              </div>
            </div>
            {trend.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-tertiary)', fontSize: 13 }}>
                时间范围内没有产生调用的日期
              </div>
            ) : (
              <TrendLineChart points={trend} />
            )}
          </div>

          {/* 成本分解：按模型 / 按场景 */}
          <div className="card" style={{ padding: 20, display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            <div style={{ width: '100%', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>成本分解</div>
            <BreakdownBars title="按模型" items={byModel} labelKey="model" />
            <BreakdownBars title="按场景" items={byScenario} labelKey="scenario" />
          </div>

          {/* Top 10 昂贵调用 */}
          <div className="card" style={{ padding: 20 }}>
            <div className="card-title" style={{ margin: 0 }}>Top 10 昂贵调用</div>
            {topExpensive.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-tertiary)', fontSize: 13 }}>暂无数据</div>
            ) : (
              <div style={{ marginTop: 12, border: '1px solid var(--border-primary)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 0.9fr 1fr 0.8fr', background: 'var(--bg-tertiary)', padding: '8px 12px', fontSize: 12, color: 'var(--text-tertiary)' }}>
                  <div>调用ID</div>
                  <div>模型</div>
                  <div>场景</div>
                  <div style={{ textAlign: 'right' }}>Tokens</div>
                  <div style={{ textAlign: 'right' }}>时间</div>
                  <div style={{ textAlign: 'right' }}>费用</div>
                </div>
                {topExpensive.map((it, i) => (
                  <div key={it.run_id} style={{
                    display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 0.9fr 1fr 0.8fr',
                    padding: '8px 12px', fontSize: 13, color: 'var(--text-primary)',
                    borderTop: i > 0 ? '1px solid var(--border-secondary)' : 'none',
                  }}>
                    <div style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.run_id}</div>
                    <div>{it.model || '—'}</div>
                    <div>{it.scenario || '—'}</div>
                    <div style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{it.tokens.toLocaleString()}</div>
                    <div style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: 12 }}>
                      {new Date(it.time).toLocaleDateString('zh-CN')}
                    </div>
                    <div style={{ textAlign: 'right', fontWeight: 600, color: 'var(--status-warning)' }}>¥{it.cost.toFixed(4)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 优化建议 */}
          <div className="card" style={{ padding: 20 }}>
            <div className="card-title" style={{ margin: 0 }}>优化建议</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12, marginTop: 12 }}>
              {suggestions.length === 0 ? (
                <div style={{ color: 'var(--text-tertiary)', fontSize: 13 }}>暂无建议</div>
              ) : (
                suggestions.map((s, i) => {
                  const style = SUGGESTION_STYLE[s.type]
                  const meta = SUCCESS_TYPE[s.type]
                  return (
                    <div key={i} style={{
                      border: `1px solid ${style.border}`,
                      background: style.bg,
                      borderRadius: 8,
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
                        <span>{meta.icon}</span>
                        <span>{s.title}</span>
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{s.detail}</div>
                      {s.action && (
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>跳转：{s.action}</div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
