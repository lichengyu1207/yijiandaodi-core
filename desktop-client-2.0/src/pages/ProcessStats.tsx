import { useEffect, useState } from 'react'
import { processApiService } from '../services/processApi'
import type { ProcessStats, ProcessTimeline, ToolStat, TimelineEvent } from '../services/processApi'
import './ProcessStats.css'

function formatDuration(seconds: number): string {
  if (!seconds) return '0 分钟'
  if (seconds < 60) return `${seconds} 秒`
  const mins = Math.floor(seconds / 60)
  if (mins < 60) return `${mins} 分钟`
  const hours = Math.floor(mins / 60)
  const remainMin = mins % 60
  return `${hours} 小时 ${remainMin} 分钟`
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

const OPERATION_LABEL: Record<string, string> = {
  create: '创建',
  modify: '修改',
  rename: '重命名',
  delete: '删除',
}

/** 常见漫剧生产工具 → 图标（未知工具回退通用图标） */
const TOOL_ICON: Record<string, string> = {
  'Unity': '🎮',
  'UnityEditor': '🎮',
  'Unity Hub': '🎮',
  'Blender': '🧊',
  'Maya': '🎭',
  '3ds Max': '🏗️',
  'C4D': '🪐',
  'Cinema 4D': '🪐',
  'Photoshop': '🖌️',
  'Ps': '🖌️',
  'Illustrator': '✒️',
  'AfterEffects': '🎞️',
  'AE': '🎞️',
  'PremierePro': '🎬',
  'Premiere Pro': '🎬',
  'PR': '🎬',
  'DaVinciResolve': '🎥',
  'Audacity': '🎙️',
  'Ableton': '🎹',
  'FL Studio': '🎧',
  'ClipStudio': '✏️',
  'Procreate': '🎨',
  'SubstancePainter': '🧱',
  'ZBrush': '🗿',
  'Houdini': '🌋',
  'Nuke': '🔥',
  'Substance3D': '🧱',
  'Visual Studio Code': '💻',
  'Code': '💻',
  'chrome': '🌐',
  'Chrome': '🌐',
  'Edge': '🌐',
  'explorer': '📁',
  'Explorer': '📁',
}

function toolIcon(name: string): string {
  const hit = TOOL_ICON[name] ?? TOOL_ICON[Object.keys(TOOL_ICON).find((k) => name.includes(k)) ?? '']
  return hit ?? '🧰'
}

const RISK_COLOR: Record<string, string> = {
  safe: '#2ecc71',
  low: '#27ae60',
  medium: '#f39c12',
  high: '#e67e22',
  critical: '#e74c3c',
}

export default function ProcessStats() {
  const [period, setPeriod] = useState<'week' | 'month'>('week')
  const [stats, setStats] = useState<ProcessStats | null>(null)
  const [timeline, setTimeline] = useState<ProcessTimeline | null>(null)
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')

    Promise.all([processApiService.getStats(period), processApiService.getTimeline(period === 'week' ? 7 : 30)])
      .then(([s, t]) => {
        if (cancelled) return
        setStats(s)
        setTimeline(t)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e?.message || '加载失败，请确认已登录')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [period])

  return (
    <div className="process-page">
      <header className="process-header">
        <h1>工具使用统计</h1>
        <p>进程行为监控 · 了解你的漫剧生产工具使用情况</p>
        <div className="period-switch">
          <button className={period === 'week' ? 'active' : ''} onClick={() => setPeriod('week')}>本周</button>
          <button className={period === 'month' ? 'active' : ''} onClick={() => setPeriod('month')}>本月</button>
        </div>
      </header>

      {error && <div className="process-error">{error}</div>}

      {loading && <div className="process-loading">加载中...</div>}

      {!loading && !error && stats && (
        <>
          <section className="summary-card">
            <div className="summary-total">
              <div className="summary-label">累计工具使用时长</div>
              <div className="summary-value">{formatDuration(stats.total_duration_seconds)}</div>
            </div>
            <div className="summary-sub">{stats.tools.length} 个工具被使用</div>
          </section>

          <section className="tools-section">
            <h2>工具使用时长</h2>
            {stats.tools.length === 0 ? (
              <div className="empty-hint">本周期未检测到漫剧工具使用记录</div>
            ) : (
              <div className="tool-grid">
                {stats.tools.map((tool: ToolStat) => (
                  <div className="tool-card" key={tool.tool_name}>
                    <div className="tool-icon">{toolIcon(tool.tool_name)}</div>
                    <div className="tool-name">{tool.tool_name}</div>
                    <div className="tool-duration">{formatDuration(tool.total_duration_seconds)}</div>
                    <div className="tool-count">使用 {tool.usage_count} 次</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="timeline-section">
            <h2>行为存证时间线</h2>
            <p className="timeline-desc">合并进程行为与文件操作，还原完整操作链路</p>
            {!timeline || timeline.events.length === 0 ? (
              <div className="empty-hint">暂无行为记录</div>
            ) : (
              <ul className="timeline-list">
                {timeline.events.map((ev: TimelineEvent, idx: number) => (
                  <li className={`timeline-item type-${ev.type}`} key={idx}>
                    <div className="timeline-dot" />
                    <div className="timeline-body">
                      <div className="timeline-time">{formatTime(ev.time)}</div>
                      {ev.type === 'process' ? (
                        <>
                          <div className="timeline-title">
                            <span className="badge badge-process">工具</span>
                            {ev.tool_name}
                          </div>
                          <div className="timeline-detail">
                            {ev.process_name} · 运行 {formatDuration(ev.duration_seconds || 0)}
                          </div>
                          {ev.related_files && ev.related_files.length > 0 && (
                            <div className="timeline-files">
                              关联文件：{ev.related_files.slice(0, 3).join('、')}
                              {ev.related_files.length > 3 && ` 等 ${ev.related_files.length} 个`}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="timeline-title">
                            <span className="badge badge-file">文件</span>
                            {ev.file_name}
                          </div>
                          <div className="timeline-detail">
                            {OPERATION_LABEL[ev.operation_type || ''] || ev.operation_type} ·{' '}
                            <span style={{ color: RISK_COLOR[ev.risk_level || 'safe'] }}>
                              {ev.risk_level === 'safe' ? '安全' : (ev.risk_level || '')}
                            </span>
                          </div>
                          <div className="timeline-path">{ev.file_path}</div>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}
