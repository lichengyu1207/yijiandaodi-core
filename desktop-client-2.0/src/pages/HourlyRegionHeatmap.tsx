/**
 * 每小时区域监控热力图（P2 统计二期，§3.2.3）
 *
 * 对接后端：GET /api/stats/hourly
 * - 小时 × 区域 调用量热力图（含零值桶）
 * - 3σ 异常红色高亮
 * - 点击单元格 → 精确小时 Top 10 调用明细
 */
import { useState, useEffect, useMemo } from 'react'
import DateRangePicker, { DateRangeValue } from '../components/DateRangePicker'
import {
  statsService,
  HourlyCell,
  HourlyTopCall,
  HourlyRegionResponse,
} from '../services/statsService'

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const REGION_LABEL: Record<string, string> = {
  cn: '中国大陆',
  us: '北美',
  eu: '欧洲',
  all: '其他/全局',
}

/** 热力图配色：按 calls/maxCalls 渐变（冷 → 热），异常点叠加红色描边 */
function heatColor(ratio: number): string {
  // ratio ∈ [0,1]；低流量淡蓝，高流量深橙
  const r = Math.round(240 * ratio)
  const g = Math.round(150 - 120 * ratio)
  const b = Math.round(60)
  return `rgb(${r},${g},${b})`
}

export default function HourlyRegionHeatmap() {
  const [range, setRange] = useState<DateRangeValue>(() => {
    const today = new Date()
    return { label: '近7天', start_date: fmt(new Date(today.getTime() - 6 * 864e5)), end_date: fmt(today) }
  })
  const [region, setRegion] = useState('all')
  const [hours, setHours] = useState<string[]>([])
  const [regions, setRegions] = useState<string[]>([])
  const [matrix, setMatrix] = useState<HourlyCell[]>([])
  const [summary, setSummary] = useState<HourlyRegionResponse['data']['summary'] | null>(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<{ hour: string; region: string } | null>(null)
  const [topCalls, setTopCalls] = useState<HourlyTopCall[]>([])
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    statsService
      .getHourly({ start_date: range.start_date, end_date: range.end_date, region: region === 'all' ? '' : region })
      .then((res) => {
        if (cancelled) return
        const data = res?.data
        setHours(data?.hours ?? [])
        setRegions(data?.regions ?? [])
        setMatrix(data?.matrix ?? [])
        setSummary(data?.summary ?? null)
      })
      .catch(() => {
        if (cancelled) return
        setHours([])
        setRegions([])
        setMatrix([])
        setSummary(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [range.start_date, range.end_date, region])

  // 按 hour 构建矩阵（行=区域，列=小时），便于渲染
  const cellMap = useMemo(() => {
    const m = new Map<string, HourlyCell>()
    for (const c of matrix) m.set(`${c.hour}|${c.region}`, c)
    return m
  }, [matrix])

  const maxCalls = useMemo(() => Math.max(...matrix.map((c) => c.calls), 1), [matrix])

  const loadTopCalls = (hour: string, reg: string) => {
    setSelected({ hour, region: reg })
    setDetailLoading(true)
    statsService
      .getHourly({ hour, region: reg === 'all' ? '' : reg })
      .then((res) => setTopCalls(res?.data?.top_calls ?? []))
      .catch(() => setTopCalls([]))
      .finally(() => setDetailLoading(false))
  }

  // 小时轴分组：按日期分组便于展示（每小时一格，宽可滚动）
  const dateGroups = useMemo(() => {
    const groups: { date: string; hours: string[] }[] = []
    for (const h of hours) {
      const date = h.slice(0, 10)
      const last = groups[groups.length - 1]
      if (last && last.date === date) last.hours.push(h)
      else groups.push({ date, hours: [h] })
    }
    return groups
  }, [hours])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 头部：标题 + 时间范围 + 区域过滤 */}
      <div className="card" style={{ padding: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div className="card-title" style={{ margin: 0 }}>区域实时监控热力图</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
            按小时 × 区域观察 API 调用分布 · 红色标记 3σ 异常流量
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            style={{
              padding: '5px 10px', borderRadius: 6, fontSize: 12,
              border: '1px solid var(--border-primary)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
            }}
          >
            <option value="all">全部区域</option>
            <option value="cn">中国大陆</option>
            <option value="us">北美</option>
            <option value="eu">欧洲</option>
          </select>
          <DateRangePicker value={range} onChange={setRange} />
        </div>
      </div>

      {/* 概要统计 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--text-primary)' }}>{summary?.total_calls ?? 0}</div>
          <div className="stat-label">总调用次数</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: summary && summary.total_errors > 0 ? 'var(--status-error)' : 'var(--status-success)' }}>
            {summary?.total_errors ?? 0}
          </div>
          <div className="stat-label">错误请求</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--brand-primary)' }}>{summary?.avg_latency ?? 0}ms</div>
          <div className="stat-label">平均延迟</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--status-warning)' }}>¥{summary?.cost.toFixed(4) ?? '0.0000'}</div>
          <div className="stat-label">总费用</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: summary && summary.anomaly_count > 0 ? 'var(--status-error)' : 'var(--text-primary)' }}>
            {summary?.anomaly_count ?? 0}
          </div>
          <div className="stat-label">异常小时格</div>
        </div>
      </div>

      {/* 热力图 */}
      <div className="card" style={{ padding: 20 }}>
        <div className="card-header" style={{ padding: 0, border: 'none' }}>
          <div className="card-title">调用量热力图（{range.label}）</div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span><span style={{ color: 'var(--status-error)', fontWeight: 700 }}>▢</span> 异常</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              低
              <span style={{ display: 'inline-block', width: 64, height: 10, borderRadius: 5, background: 'linear-gradient(90deg, rgb(20,90,60), rgb(240,120,60))' }} />
              高
            </span>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-tertiary)' }}>加载中...</div>
        ) : hours.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-tertiary)' }}>
            时间范围内暂无调用数据
          </div>
        ) : (
          <div style={{ marginTop: 12, overflowX: 'auto' }}>
            <div style={{ minWidth: 'max-content' }}>
              {/* 小时轴表头 */}
              <div style={{ display: 'flex', marginBottom: 6 }}>
                <div style={{ width: 64, flexShrink: 0 }} />
                <div style={{ display: 'flex' }}>
                  {dateGroups.map((g) => (
                    <div key={g.date} style={{ display: 'flex', flexDirection: 'column', marginRight: 2 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', marginBottom: 2, whiteSpace: 'nowrap' }}>
                        {g.date.slice(5).replace('-', '/')}
                      </div>
                      <div style={{ display: 'flex', gap: 2 }}>
                        {g.hours.map((h) => (
                          <div key={h} style={{ width: 18, fontSize: 9, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                            {Number(h.slice(11, 13))}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 每区域一行 */}
              {regions.map((reg) => (
                <div key={reg} style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ width: 64, flexShrink: 0, fontSize: 12, color: 'var(--text-secondary)' }}>
                    {REGION_LABEL[reg] ?? reg}
                  </div>
                  <div style={{ display: 'flex', gap: 2 }}>
                    {hours.map((h) => {
                      const cell = cellMap.get(`${h}|${reg}`)
                      const calls = cell?.calls ?? 0
                      const ratio = calls / maxCalls
                      return (
                        <button
                          key={h}
                          title={`${h} ${REGION_LABEL[reg] ?? reg} · ${calls} 次调用${cell?.anomaly ? ' · ⚠️异常' : ''}`}
                          onClick={() => loadTopCalls(h, reg)}
                          style={{
                            width: 18, height: 22, borderRadius: 3, border: 'none', cursor: 'pointer', padding: 0,
                            background: calls === 0 ? 'var(--bg-tertiary)' : heatColor(ratio),
                            boxShadow: cell?.anomaly ? 'inset 0 0 0 2px var(--status-error)' : 'none',
                            opacity: calls === 0 ? 0.6 : 1,
                          }}
                        />
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 精确小时 Top 10 明细弹层 */}
      {selected && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="card-title" style={{ margin: 0 }}>
                {selected.hour.replace('T', ' ')}({REGION_LABEL[selected.region] ?? selected.region}) Top 10 调用
              </div>
              <button
                onClick={() => setSelected(null)}
                style={{
                  padding: '4px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                  border: '1px solid var(--border-primary)', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)',
                }}
              >
                关闭
              </button>
            </div>
            {detailLoading ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-tertiary)', fontSize: 13 }}>加载中...</div>
            ) : topCalls.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-tertiary)', fontSize: 13 }}>该小时无调用记录</div>
            ) : (
              <div style={{ marginTop: 12, border: '1px solid var(--border-primary)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.7fr 0.8fr 0.8fr 0.9fr 0.8fr', background: 'var(--bg-tertiary)', padding: '8px 12px', fontSize: 12, color: 'var(--text-tertiary)' }}>
                  <div>端点</div>
                  <div>方法</div>
                  <div style={{ textAlign: 'right' }}>状态码</div>
                  <div style={{ textAlign: 'right' }}>延迟(ms)</div>
                  <div>区域</div>
                  <div style={{ textAlign: 'right' }}>时间</div>
                </div>
                {topCalls.map((it, i) => (
                  <div key={it.id} style={{
                    display: 'grid', gridTemplateColumns: '1.6fr 0.7fr 0.8fr 0.8fr 0.9fr 0.8fr',
                    padding: '8px 12px', fontSize: 13, color: 'var(--text-primary)',
                    borderTop: i > 0 ? '1px solid var(--border-secondary)' : 'none',
                  }}>
                    <div style={{ color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.endpoint}</div>
                    <div>{it.method}</div>
                    <div style={{ textAlign: 'right', color: it.status_code >= 400 ? 'var(--status-error)' : 'var(--status-success)' }}>{it.status_code}</div>
                    <div style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{it.response_time_ms}</div>
                    <div style={{ fontSize: 12 }}>{REGION_LABEL[it.region] ?? it.region}</div>
                    <div style={{ textAlign: 'right', color: 'var(--text-secondary)', fontSize: 12 }}>{new Date(it.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
