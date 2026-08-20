import { useEffect, useState } from 'react';

export interface DateRangeValue {
  label: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
}

interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (v: DateRangeValue) => void;
}

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const PRESETS = [
  { key: 'today', label: '今天' },
  { key: '7d', label: '近7天' },
  { key: '14d', label: '近14天' },
  { key: '30d', label: '近30天' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: 'quarter', label: '本季度' },
  { key: 'year', label: '本年' },
  { key: 'custom', label: '自定义' },
] as const;

function resolvePreset(key: string): { start_date: string; end_date: string } {
  const today = new Date();
  switch (key) {
    case 'today':
      return { start_date: fmt(today), end_date: fmt(today) };
    case '7d':
      return { start_date: fmt(new Date(today.getTime() - 6 * 864e5)), end_date: fmt(today) };
    case '14d':
      return { start_date: fmt(new Date(today.getTime() - 13 * 864e5)), end_date: fmt(today) };
    case '30d':
      return { start_date: fmt(new Date(today.getTime() - 29 * 864e5)), end_date: fmt(today) };
    case 'week': {
      const day = today.getDay() || 7; // 周一=1
      const monday = new Date(today);
      monday.setDate(today.getDate() - day + 1);
      return { start_date: fmt(monday), end_date: fmt(today) };
    }
    case 'month':
      return { start_date: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), end_date: fmt(today) };
    case 'quarter': {
      const qStart = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
      return { start_date: fmt(qStart), end_date: fmt(today) };
    }
    case 'year':
      return { start_date: fmt(new Date(today.getFullYear(), 0, 1)), end_date: fmt(today) };
    default:
      return { start_date: fmt(today), end_date: fmt(today) };
  }
}

/** 统一时间范围筛选组件（P1-1）：预设 + 自定义日期区间 */
const DateRangePicker: React.FC<DateRangePickerProps> = ({ value, onChange }) => {
  const [customStart, setCustomStart] = useState(value.start_date);
  const [customEnd, setCustomEnd] = useState(value.end_date);

  useEffect(() => {
    setCustomStart(value.start_date);
    setCustomEnd(value.end_date);
  }, [value.start_date, value.end_date]);

  const activePreset = PRESETS.find((p) => {
    if (p.key === 'custom') {
      return !PRESETS.some((q) => q.key !== 'custom' && resolvePreset(q.key).start_date === value.start_date && resolvePreset(q.key).end_date === value.end_date);
    }
    const r = resolvePreset(p.key);
    return r.start_date === value.start_date && r.end_date === value.end_date;
  });

  const handlePreset = (key: string) => {
    if (key === 'custom') {
      onChange({ label: '自定义', start_date: customStart, end_date: customEnd });
      return;
    }
    const r = resolvePreset(key);
    onChange({ label: PRESETS.find((p) => p.key === key)!.label, start_date: r.start_date, end_date: r.end_date });
  };

  const isCustom = activePreset?.key === 'custom';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {PRESETS.map((p) => {
        const active = activePreset?.key === p.key;
        return (
          <button
            key={p.key}
            onClick={() => handlePreset(p.key)}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              border: active ? 'none' : '1px solid #E5E6EB',
              background: active ? '#165DFF' : '#FFF',
              color: active ? '#FFF' : '#4E5969',
              fontSize: 12,
              fontWeight: active ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            {p.label}
          </button>
        );
      })}
      {isCustom && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="date"
            value={customStart}
            max={customEnd || undefined}
            onChange={(e) => setCustomStart(e.target.value)}
            style={{
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid #E5E6EB',
              fontSize: 12,
              color: '#4E5969',
            }}
          />
          <span style={{ fontSize: 12, color: '#86909C' }}>至</span>
          <input
            type="date"
            value={customEnd}
            min={customStart || undefined}
            onChange={(e) => setCustomEnd(e.target.value)}
            style={{
              padding: '4px 8px',
              borderRadius: 6,
              border: '1px solid #E5E6EB',
              fontSize: 12,
              color: '#4E5969',
            }}
          />
          <button
            onClick={() => onChange({ label: '自定义', start_date: customStart, end_date: customEnd })}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              border: 'none',
              background: '#165DFF',
              color: '#FFF',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            应用
          </button>
        </div>
      )}
    </div>
  );
};

export default DateRangePicker;
