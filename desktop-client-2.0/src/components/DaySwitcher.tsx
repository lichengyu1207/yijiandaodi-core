import { useMemo } from 'react'

interface DaySwitcherProps {
  value: string
  onChange: (day: string) => void
}

const p = (n: number) => String(n).padStart(2, '0')

const fmt = (d: Date) => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`

export default function DaySwitcher({ value, onChange }: DaySwitcherProps) {
  const today = useMemo(() => fmt(new Date()), [])
  const dayOf = (offset: number) => {
    const d = new Date()
    d.setDate(d.getDate() - offset)
    return fmt(d)
  }
  const yesterday = dayOf(1)
  const before = dayOf(2)
  const presetDays = [today, yesterday, before]

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <button
        className={`filter-btn ${value === '' ? 'active' : ''}`}
        onClick={() => onChange('')}
      >全部</button>
      <button
        className={`filter-btn ${value === today ? 'active' : ''}`}
        onClick={() => onChange(today)}
      >今天</button>
      <button
        className={`filter-btn ${value === yesterday ? 'active' : ''}`}
        onClick={() => onChange(yesterday)}
      >昨天</button>
      <button
        className={`filter-btn ${value === before ? 'active' : ''}`}
        onClick={() => onChange(before)}
      >前天</button>
      <input
        type="date"
        max={today}
        value={value !== '' && !presetDays.includes(value) ? value : ''}
        onChange={(e) => onChange(e.target.value || '')}
        style={{
          padding: '4px 8px',
          border: '1px solid var(--border-primary)',
          borderRadius: 6,
          fontSize: 13,
          background: 'var(--bg-secondary)',
          color: 'var(--text-primary)'
        }}
      />
    </div>
  )
}