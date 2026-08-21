import { useState, useEffect, useMemo } from 'react'
import { LongTermMemoryApi, LongTermMemory } from '../services/memoryApi'

const RISK_COLORS: Record<string, string> = {
  critical: '#F85149',
  high: '#D29922',
  medium: '#895502',
  low: '#3FB950'
}

const RISK_LABELS: Record<string, string> = {
  critical: '严重',
  high: '高风险',
  medium: '中风险',
  low: '低风险'
}

const DECISION_LABELS: Record<string, string> = {
  allow: '已放行',
  block: '已拦截',
  deny: '已拒绝',
  review: '待审核',
  ask_user: '待确认'
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function toDayKey(iso: string): string {
  return iso.slice(0, 10)
}

function riskBorder(level: string): React.CSSProperties {
  const c = RISK_COLORS[level] || '#8b949e'
  return { background: c + '20', color: c }
}

export default function Diary() {
  const [records, setRecords] = useState<LongTermMemory[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  const longTermApi = LongTermMemoryApi.getInstance()

  const load = async () => {
    setLoading(true)
    try {
      const memories = await longTermApi.getMemories({ limit: 500 })
      setRecords(memories)
    } catch (error) {
      console.error('[Diary] 加载日记失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const groups = useMemo(() => {
    const filtered = searchTerm
      ? records.filter((r) =>
          (r.agent_id + ' ' + r.operation_type + ' ' + r.operation_content)
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
        )
      : records

    const map = new Map<string, LongTermMemory[]>()
    for (const r of filtered) {
      const key = toDayKey(r.created_at)
      const arr = map.get(key)
      if (arr) arr.push(r)
      else map.set(key, [r])
    }

    return Array.from(map.entries())
      .map(([date, items]) => {
        const typeCount: Record<string, number> = {}
        const riskCount: Record<string, number> = {}
        for (const it of items) {
          typeCount[it.operation_type] = (typeCount[it.operation_type] || 0) + 1
          riskCount[it.risk_level] = (riskCount[it.risk_level] || 0) + 1
        }
        return { date, items: items.sort((a, b) => b.created_at.localeCompare(a.created_at)), typeCount, riskCount }
      })
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [records, searchTerm])

  const totals = useMemo(() => {
    const tc: Record<string, number> = {}
    const rc: Record<string, number> = {}
    for (const g of groups) {
      for (const k of Object.keys(g.typeCount)) tc[k] = (tc[k] || 0) + g.typeCount[k]
      for (const k of Object.keys(g.riskCount)) rc[k] = (rc[k] || 0) + g.riskCount[k]
    }
    return { total: records.length, typeCount: tc, riskCount: rc, days: groups.length }
  }, [groups, records.length])

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>AI 行为日记</h1>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4 }}>
            按天回顾 AI 做了什么，为自己未来回看积累轨迹
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            type="text"
            placeholder="搜索日期、Agent、操作..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: 220,
              padding: '8px 12px',
              border: '1px solid var(--border-primary)',
              borderRadius: 6,
              fontSize: 13,
              background: 'var(--bg-secondary)'
            }}
          />
          <button
            onClick={load}
            style={{
              padding: '8px 14px',
              border: '1px solid var(--border-primary)',
              borderRadius: 6,
              fontSize: 13,
              background: 'var(--bg-secondary)',
              cursor: 'pointer'
            }}
          >
            刷新
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <StatCard label="累计记录" value={totals.total.toString()} />
        <StatCard label="记录天数" value={totals.days.toString()} />
        <StatCard
          label="累计操作类型"
          value={Object.keys(totals.typeCount).length.toString()}
          sub={Object.entries(totals.typeCount).slice(0, 3).map(([k, v]) => `${k}·${v}`).join('  ')}
        />
        <StatCard
          label="异常关注"
          value={((totals.riskCount.high || 0) + (totals.riskCount.critical || 0)).toString()}
          sub={`高/严重共 ${(totals.riskCount.high || 0) + (totals.riskCount.critical || 0)} 条`}
          tone="warn"
        />
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>正在翻阅日记...</div>
      ) : groups.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
          还没有记录，AI 开始活动后会在这里按天沉淀下来
        </div>
      ) : (
        groups.map((day) => (
          <section
            key={day.date}
            style={{
              border: '1px solid var(--border-primary)',
              borderRadius: 10,
              padding: 16,
              marginBottom: 14,
              background: 'var(--bg-primary)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontSize: 16, fontWeight: 600 }}>{day.date}</span>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {WEEKDAYS[new Date(day.date + 'T00:00:00').getDay()]} · {day.items.length} 条
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {Object.entries(day.riskCount).map(([k, v]) => (
                  <Chip key={k} style={riskBorder(k)}>{RISK_LABELS[k]||k} {v}</Chip>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0 12px' }}>
              {Object.entries(day.typeCount).map(([k, v]) => (
                <Chip key={k} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                  {k} · {v}
                </Chip>
              ))}
            </div>

            <div>
              {day.items.map((r) => (
                <div
                  key={r.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '8px 10px',
                    borderRadius: 6,
                    borderBottom: '1px solid var(--border-primary)'
                  }}
                >
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)', minWidth: 58 }}>
                    {r.created_at.slice(11, 16)}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)', minWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.agent_id}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      padding: '2px 8px',
                      borderRadius: 4,
                      color: 'var(--primary-color)',
                      background: 'var(--bg-tertiary)',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {r.operation_type}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      fontSize: 13,
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {r.operation_content}
                  </span>
                  <span style={riskBorder(r.risk_level)}>
                    {RISK_LABELS[r.risk_level] || r.risk_level}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    {DECISION_LABELS[r.decision] || r.decision}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}

function StatCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'warn' }) {
  return (
    <div style={{ border: '1px solid var(--border-primary)', borderRadius: 10, padding: 14, background: 'var(--bg-primary)' }}>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{label}</div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 700,
          marginTop: 4,
          color: tone === 'warn' ? RISK_COLORS.high : 'var(--text-primary)'
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {sub}
        </div>
      )}
    </div>
  )
}

function Chip({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 999, ...style }}>{children}</span>
  )
}