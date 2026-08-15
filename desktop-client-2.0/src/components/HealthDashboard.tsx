/**
 * 治理健康度仪表盘
 * 通过 Electron IPC 获取实时健康度指标并轮询刷新
 */

import React, { useState, useEffect } from 'react'

interface MetricBlock {
  value: number
  baseline: number
  deviation: number
  status: 'normal' | 'warning' | 'critical'
}

interface HealthMetrics {
  accuracy: MetricBlock
  performance: {
    avgResponseTime: number
    baseline: number
    deviation: number
    status: 'normal' | 'warning' | 'critical'
  }
  falsePositiveRate: MetricBlock
  overallHealth: number
  overallStatus: 'healthy' | 'degraded' | 'critical'
  timestamp: number
}

const STATUS_COLOR: Record<string, string> = {
  healthy: '#3fb950',
  normal: '#3fb950',
  degraded: '#d29922',
  warning: '#d29922',
  critical: '#f85149',
}

const STATUS_TEXT: Record<string, string> = {
  healthy: '健康',
  normal: '正常',
  degraded: '降级',
  warning: '警告',
  critical: '严重',
}

const HealthDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<string>('')

  useEffect(() => {
    let disposed = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const hasElectron = Boolean((window as any).electronAPI?.getHealthMetrics)

    const fetchMetrics = async () => {
      try {
        if (!hasElectron) {
          setError('健康度指标依赖 Electron 主进程，当前运行环境无法获取。请通过桌面端应用访问本页面。')
          setLoading(false)
          return
        }

        const result = await (window as any).electronAPI.getHealthMetrics()
        if (disposed) return

        if (result) {
          setMetrics(result)
          setLastUpdate(new Date(result.timestamp || Date.now()).toLocaleTimeString())
          setError(null)
        } else {
          setError('未获取到健康度数据')
        }
      } catch (err) {
        console.error('[HealthDashboard] 获取健康指标失败:', err)
        if (!disposed) setError('无法加载健康指标')
      } finally {
        if (!disposed) setLoading(false)
      }
    }

    fetchMetrics()
    timer = setInterval(fetchMetrics, 5000)

    return () => {
      disposed = true
      if (timer) clearInterval(timer)
    }
  }, [])

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
        正在加载健康度指标...
      </div>
    )
  }

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-primary)',
    borderRadius: 8,
    padding: 20,
    flex: '1 1 220px',
  }

  const metricValueStyle = (status: string): React.CSSProperties => ({
    fontSize: 32,
    fontWeight: 700,
    color: STATUS_COLOR[status] || 'var(--text-primary)',
  })

  const renderDeviation = (deviation: number, status: string) => (
    <span
      style={{
        fontSize: 12,
        padding: '2px 8px',
        borderRadius: 4,
        background: (STATUS_COLOR[status] || '#333') + '26',
        color: STATUS_COLOR[status] || 'var(--text-secondary)',
      }}
    >
      {status === 'normal' ? '正常' : status === 'warning' ? '警告' : '严重'} · 偏差 {deviation.toFixed(1)}%
    </span>
  )

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>治理健康度仪表盘</h2>
        {lastUpdate && (
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>最近更新: {lastUpdate}</span>
        )}
      </div>

      {error && (
        <div
          style={{
            padding: 14,
            marginBottom: 16,
            background: 'rgba(248, 81, 73, 0.1)',
            border: '1px solid rgba(248, 81, 73, 0.4)',
            borderRadius: 8,
            color: '#f85149',
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {metrics && (
        <>
          {/* 整体状态横幅 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              marginBottom: 20,
              borderRadius: 8,
              background: 'var(--bg-card)',
              border: `1px solid ${STATUS_COLOR[metrics.overallStatus]}`,
            }}
          >
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>系统整体状态</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: STATUS_COLOR[metrics.overallStatus] }}>
                {STATUS_TEXT[metrics.overallStatus] || metrics.overallStatus}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>健康度评分</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)' }}>
                {metrics.overallHealth.toFixed(1)} / 100
              </div>
            </div>
          </div>

          {/* 指标卡片 */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={cardStyle}>
              <h3 style={{ fontSize: 14, margin: '0 0 12px', color: 'var(--text-secondary)' }}>校验准确率</h3>
              <div style={metricValueStyle(metrics.accuracy.status)}>
                {(metrics.accuracy.value * 100).toFixed(1)}%
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '8px 0' }}>
                基线: {(metrics.accuracy.baseline * 100).toFixed(1)}%
              </p>
              {renderDeviation(metrics.accuracy.deviation, metrics.accuracy.status)}
            </div>

            <div style={cardStyle}>
              <h3 style={{ fontSize: 14, margin: '0 0 12px', color: 'var(--text-secondary)' }}>平均响应时间</h3>
              <div style={metricValueStyle(metrics.performance.status)}>
                {metrics.performance.avgResponseTime.toFixed(0)}ms
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '8px 0' }}>
                基线: {metrics.performance.baseline.toFixed(0)}ms
              </p>
              {renderDeviation(metrics.performance.deviation, metrics.performance.status)}
            </div>

            <div style={cardStyle}>
              <h3 style={{ fontSize: 14, margin: '0 0 12px', color: 'var(--text-secondary)' }}>误报率</h3>
              <div style={metricValueStyle(metrics.falsePositiveRate.status)}>
                {(metrics.falsePositiveRate.value * 100).toFixed(1)}%
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '8px 0' }}>
                基线: {(metrics.falsePositiveRate.baseline * 100).toFixed(1)}%
              </p>
              {renderDeviation(metrics.falsePositiveRate.deviation, metrics.falsePositiveRate.status)}
            </div>
          </div>

          {/* 状态图例 */}
          <div style={{ display: 'flex', gap: 16, marginTop: 20, fontSize: 12, color: 'var(--text-tertiary)' }}>
            <span><span style={{ color: '#3fb950' }}>●</span> 正常</span>
            <span><span style={{ color: '#d29922' }}>●</span> 警告</span>
            <span><span style={{ color: '#f85149' }}>●</span> 严重</span>
          </div>
        </>
      )}
    </div>
  )
}

export default HealthDashboard
