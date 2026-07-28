import { useState, useEffect } from 'react'

interface AuditRecord {
  id: number
  timestamp: string
  agent: string
  operation: string
  context: string
  risk_level: 'low' | 'medium' | 'high' | 'critical'
  risk_score: number
  should_block: boolean
  explanation: string
  audit_hash: string
}

const RISK_STATUS = {
  low: 'success',
  medium: 'warning',
  high: 'error',
  critical: 'error'
} as const

const RISK_LABELS = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
  critical: '严重'
}

export default function Dashboard() {
  const [records, setRecords] = useState<AuditRecord[]>([])
  const [stats, setStats] = useState({ total: 0, success: 0, warning: 0, error: 0 })
  const [filter, setFilter] = useState<'all' | 'success' | 'warning' | 'error'>('all')
  const [selectedRecord, setSelectedRecord] = useState<AuditRecord | null>(null)
  
  // 从本地IPC或沙箱API获取记录
  useEffect(() => {
    const fetchRecords = async () => {
      try {
        // 优先从本地IPC获取操作记录
        if (window.electronAPI?.getOperations) {
          try {
            const localOperations = await window.electronAPI.getOperations()

            if (localOperations && localOperations.length > 0) {
              console.log('[Dashboard] 从本地获取到操作记录:', localOperations.length)

              const mappedRecords = localOperations.map((op: any) => ({
                id: op.id || op.timestamp,
                timestamp: op.timestamp,
                agent: op.agent || op.source || '本地监控',
                operation: op.content || op.title || '',
                context: op.context || '',
                risk_level: op.risk_level || (op.status === 'flagged' ? 'high' : 'low'),
                risk_score: op.risk_score || (op.status === 'flagged' ? 80 : 10),
                should_block: op.should_block || false,
                explanation: op.explanation || '',
                audit_hash: op.audit_hash || ''
              }))

              setRecords(mappedRecords)

              const total = mappedRecords.length
              const success = mappedRecords.filter((r: AuditRecord) => r.risk_level === 'low').length
              const warning = mappedRecords.filter((r: AuditRecord) => r.risk_level === 'medium').length
              const error = mappedRecords.filter((r: AuditRecord) => ['high', 'critical'].includes(r.risk_level)).length

              setStats({ total, success, warning, error })
              return  // 成功从本地获取，直接返回
            }
          } catch (localError) {
            console.warn('[Dashboard] 从本地获取记录失败:', localError)
          }
        }

        // 如果本地获取失败，尝试从沙箱API获取
        const sandboxResponse = await fetch('http://localhost:9092/api/v1/sandbox/logs?limit=50', {
          signal: AbortSignal.timeout(2000)
        })

        if (sandboxResponse.ok) {
          const data = await sandboxResponse.json()

          if (data.success && data.logs) {
            const mappedRecords = data.logs.map((log: any) => {
              // 安全解析 analysis_result
              let explanation = ''
              try {
                if (log.analysis_result) {
                  if (typeof log.analysis_result === 'string') {
                    const parsed = JSON.parse(log.analysis_result)
                    explanation = parsed.recommendation || ''
                  } else if (typeof log.analysis_result === 'object') {
                    explanation = log.analysis_result.recommendation || ''
                  }
                }
              } catch (e) {
                console.warn('解析 analysis_result 失败:', e)
              }

              return {
                id: log.id,
                timestamp: log.timestamp,
                agent: log.agent_name || 'Unknown',
                operation: log.operation_content || '',
                context: log.context || '',
                risk_level: log.risk_level || 'low',
                risk_score: log.risk_level === 'critical' ? 100 : log.risk_level === 'high' ? 80 : log.risk_level === 'medium' ? 50 : 10,
                should_block: log.decision === 'block',
                explanation: explanation,
                audit_hash: log.audit_hash || ''
              }
            })

            setRecords(mappedRecords)

            const total = mappedRecords.length
            const success = mappedRecords.filter((r: AuditRecord) => r.risk_level === 'low').length
            const warning = mappedRecords.filter((r: AuditRecord) => r.risk_level === 'medium').length
            const error = mappedRecords.filter((r: AuditRecord) => ['high', 'critical'].includes(r.risk_level)).length

            setStats({ total, success, warning, error })
          }
        }
      } catch (error) {
        console.error('获取记录失败:', error)
      }
    }

    fetchRecords()

    // 每 3 秒刷新一次
    const interval = setInterval(fetchRecords, 3000)
    return () => clearInterval(interval)
  }, [])
  
  const filteredRecords = records.filter(record => {
    if (filter === 'all') return true
    if (filter === 'success') return record.risk_level === 'low'
    if (filter === 'warning') return record.risk_level === 'medium'
    if (filter === 'error') return ['high', 'critical'].includes(record.risk_level)
    return true
  })
  
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 24 }}>
      {/* 统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--text-primary)' }}>{stats.total}</div>
          <div className="stat-label">今日审计总数</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--status-success)' }}>{stats.success}</div>
          <div className="stat-label">正常操作</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--status-warning)' }}>{stats.warning}</div>
          <div className="stat-label">风险操作</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--status-error)' }}>{stats.error}</div>
          <div className="stat-label">已阻断</div>
        </div>
      </div>
      
      {/* 筛选和审计流 */}
      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="card-header">
          <div className="card-title">实时审计流</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>全部</button>
            <button className={`filter-btn ${filter === 'success' ? 'active' : ''}`} onClick={() => setFilter('success')}>正常</button>
            <button className={`filter-btn ${filter === 'warning' ? 'active' : ''}`} onClick={() => setFilter('warning')}>风险</button>
            <button className={`filter-btn ${filter === 'error' ? 'active' : ''}`} onClick={() => setFilter('error')}>已阻断</button>
          </div>
        </div>
        
        <div className="audit-stream" style={{ flex: 1, overflow: 'auto' }}>
          {filteredRecords.length === 0 ? (
            <div style={{ 
              textAlign: 'center', 
              padding: 48, 
              color: 'var(--text-tertiary)' 
            }}>
              暂无审计记录
            </div>
          ) : (
            filteredRecords.map(record => (
              <div 
                key={record.id}
                className={`audit-item ${RISK_STATUS[record.risk_level]}`}
                onClick={() => setSelectedRecord(record)}
                style={{ cursor: 'pointer' }}
              >
                <div className="audit-header">
                  <span className="audit-agent">{record.agent}</span>
                  <span className="audit-time">{formatTime(record.timestamp)}</span>
                </div>
                <div className="audit-operation">{record.operation}</div>
                <div className="audit-footer">
                  <span className={`tag tag-${RISK_STATUS[record.risk_level]}`}>
                    {RISK_LABELS[record.risk_level]}
                  </span>
                  <span style={{ color: 'var(--text-tertiary)' }}>
                    {record.should_block ? '已拦截' : '已放行'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
      {/* 详情面板 */}
      {selectedRecord && (
        <div style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: 400,
          height: '100vh',
          background: 'var(--bg-secondary)',
          borderLeft: '1px solid var(--border-primary)',
          padding: 24,
          zIndex: 1000,
          overflow: 'auto',
          boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.1)'
        }}>
          {/* 头部 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>审计详情</h3>
            <button 
              onClick={() => setSelectedRecord(null)}
              style={{ 
                border: '1px solid var(--border-primary)', 
                background: 'var(--bg-tertiary)',
                cursor: 'pointer',
                fontSize: 14,
                color: 'var(--text-secondary)',
                padding: '4px 12px',
                borderRadius: 4
              }}
            >
              关闭
            </button>
          </div>
          
          {/* 基本信息 */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>AI Agent</div>
            <div style={{ fontWeight: 500, fontSize: 15 }}>{selectedRecord.agent}</div>
          </div>
          
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>操作内容</div>
            <div style={{ 
              fontSize: 14, 
              color: 'var(--text-primary)',
              background: 'var(--bg-tertiary)',
              padding: 12,
              borderRadius: 6,
              lineHeight: 1.5
            }}>{selectedRecord.operation}</div>
          </div>
          
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>上下文</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{selectedRecord.context || '无'}</div>
          </div>
          
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>风险等级</div>
            <span className={`tag tag-${RISK_STATUS[selectedRecord.risk_level]}`}>
              {RISK_LABELS[selectedRecord.risk_level]} ({selectedRecord.risk_score}分)
            </span>
          </div>
          
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>分析结果</div>
            <div style={{ 
              background: 'var(--bg-tertiary)', 
              padding: 12, 
              borderRadius: 6,
              fontSize: 13,
              lineHeight: 1.6,
              color: 'var(--text-primary)'
            }}>
              {selectedRecord.explanation || '无分析结果'}
            </div>
          </div>
          
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>审计哈希</div>
            <code style={{ 
              fontSize: 12, 
              color: 'var(--primary-color)',
              background: 'var(--bg-tertiary)',
              padding: '4px 8px',
              borderRadius: 4
            }}>
              {selectedRecord.audit_hash}
            </code>
          </div>
          
          {/* 操作按钮 */}
          <div style={{ 
            borderTop: '1px solid var(--border-primary)', 
            paddingTop: 20,
            marginTop: 20 
          }}>
            {/* 导出按钮 */}
            <button 
              className="btn btn-secondary"
              style={{ width: '100%', marginBottom: 12 }}
              onClick={() => {
                // 导出报告
                const report = {
                  审计ID: selectedRecord.id,
                  时间: selectedRecord.timestamp,
                  Agent: selectedRecord.agent,
                  操作: selectedRecord.operation,
                  上下文: selectedRecord.context,
                  风险等级: RISK_LABELS[selectedRecord.risk_level],
                  风险分数: selectedRecord.risk_score,
                  分析结果: selectedRecord.explanation,
                  审计哈希: selectedRecord.audit_hash,
                  决策: selectedRecord.should_block ? '已拦截' : '已放行'
                }
                
                const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `审计报告_${selectedRecord.id}_${selectedRecord.audit_hash}.json`
                a.click()
                URL.revokeObjectURL(url)
              }}
            >
              📄 导出报告 (JSON)
            </button>
            
            {/* 确认/放行按钮 */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                className="btn btn-secondary"
                style={{ flex: 1 }}
                onClick={() => {
                  // 取消操作
                  console.log('取消:', selectedRecord.id)
                  setSelectedRecord(null)
                }}
              >
                取消
              </button>
              <button 
                className="btn btn-primary"
                style={{ flex: 1 }}
                onClick={async () => {
                  // 确认操作 - 调用 API
                  try {
                    const response = await fetch(`http://localhost:9092/api/v1/sandbox/logs/${selectedRecord.id}/confirm`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ response: 'confirmed' })
                    })
                    
                    const data = await response.json()
                    
                    if (data.success) {
                      alert('已确认该审计记录')
                      setSelectedRecord(null)
                      // 刷新列表
                      window.location.reload()
                    } else {
                      alert('确认失败: ' + data.error)
                    }
                  } catch (error) {
                    console.error('确认失败:', error)
                    alert('确认失败，请检查服务是否运行')
                  }
                }}
              >
                确认
              </button>
            </div>
            
            {/* 拦截/放行按钮 */}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button 
                className="btn btn-secondary"
                style={{ flex: 1, background: '#F85149', color: 'white', border: 'none' }}
                onClick={async () => {
                  // 拦截操作 - 调用 API
                  try {
                    const response = await fetch(`http://localhost:9092/api/v1/sandbox/logs/${selectedRecord.id}/intercept`, {
                      method: 'POST'
                    })
                    
                    const data = await response.json()
                    
                    if (data.success) {
                      alert('已拦截该操作')
                      setSelectedRecord(null)
                      window.location.reload()
                    } else {
                      alert('拦截失败: ' + data.error)
                    }
                  } catch (error) {
                    console.error('拦截失败:', error)
                    alert('拦截失败，请检查服务是否运行')
                  }
                }}
              >
                🚫 拦截
              </button>
              <button 
                className="btn btn-secondary"
                style={{ flex: 1, background: '#3FB950', color: 'white', border: 'none' }}
                onClick={async () => {
                  // 放行操作 - 调用 API
                  try {
                    const response = await fetch(`http://localhost:9092/api/v1/sandbox/logs/${selectedRecord.id}/allow`, {
                      method: 'POST'
                    })
                    
                    const data = await response.json()
                    
                    if (data.success) {
                      alert('已放行该操作')
                      setSelectedRecord(null)
                      window.location.reload()
                    } else {
                      alert('放行失败: ' + data.error)
                    }
                  } catch (error) {
                    console.error('放行失败:', error)
                    alert('放行失败，请检查服务是否运行')
                  }
                }}
              >
                ✓ 放行
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}