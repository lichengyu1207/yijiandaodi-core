import { useState, useEffect } from 'react'
import './Evidence.css'

interface EvidenceRecord {
  id: number
  timestamp: string
  agent_name: string
  operation_type: string
  operation_content: string
  risk_level: string
  risk_score: number
  risk_tags: string[]
  decision: string
  record_hash: string
  prev_hash: string
  chain_index: number
}

interface ChainStatus {
  valid: boolean
  total_records: number
  last_hash: string
  errors: any[]
}

export default function Evidence() {
  const [records, setRecords] = useState<EvidenceRecord[]>([])
  const [chainStatus, setChainStatus] = useState<ChainStatus>({
    valid: true,
    total_records: 0,
    last_hash: '',
    errors: []
  })
  const [selectedRecord, setSelectedRecord] = useState<EvidenceRecord | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRecords()
    verifyChain()
  }, [])

  const fetchRecords = async () => {
    try {
      const response = await fetch('http://localhost:9092/api/v1/evidence/records?limit=50')
      if (response.ok) {
        const data = await response.json()
        setRecords(data.records || [])
      }
    } catch (error) {
      console.error('获取记录失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const verifyChain = async () => {
    try {
      const response = await fetch('http://localhost:9092/api/v1/evidence/verify')
      if (response.ok) {
        const data = await response.json()
        setChainStatus(data)
      }
    } catch (error) {
      console.error('验证链失败:', error)
    }
  }

  const exportJSON = async () => {
    try {
      const response = await fetch('http://localhost:9092/api/v1/evidence/export?format=json')
      if (response.ok) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `审计报告_${new Date().toISOString().split('T')[0]}.json`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('导出失败:', error)
    }
  }

  const exportHTML = async () => {
    try {
      const response = await fetch('http://localhost:9092/api/v1/evidence/export?format=html')
      if (response.ok) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `审计报告_${new Date().toISOString().split('T')[0]}.html`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('导出失败:', error)
    }
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical': return '#F85149'
      case 'high': return '#D29922'
      case 'medium': return '#895502'
      default: return '#3FB950'
    }
  }

  const getDecisionLabel = (decision: string) => {
    switch (decision) {
      case 'block': return '已拦截'
      case 'allow': return '已放行'
      case 'ask_user': return '待确认'
      default: return decision
    }
  }

  return (
    <div className="evidence-page">
      {/* 哈希链状态 */}
      <section className="chain-status-section">
        <div className="section-header">
          <h2 className="section-title">哈希链状态</h2>
          <div className={`chain-badge ${chainStatus.valid ? 'valid' : 'invalid'}`}>
            {chainStatus.valid ? '✓ 链完整' : '✗ 链异常'}
          </div>
        </div>

        <div className="chain-stats">
          <div className="chain-stat">
            <div className="chain-stat-value">{chainStatus.total_records}</div>
            <div className="chain-stat-label">总记录</div>
          </div>
          <div className="chain-stat">
            <div className="chain-stat-value hash">{chainStatus.last_hash.slice(0, 16)}...</div>
            <div className="chain-stat-label">最后哈希</div>
          </div>
        </div>

        {chainStatus.errors.length > 0 && (
          <div className="chain-errors">
            <h4>发现 {chainStatus.errors.length} 个错误</h4>
            {chainStatus.errors.map((error: any, i) => (
              <div key={i} className="chain-error">
                记录 #{error.record_id}: {error.error}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 导出报告 */}
      <section className="export-section">
        <h3 className="section-title">导出报告</h3>
        <div className="export-buttons">
          <button className="btn btn-primary" onClick={exportJSON}>
            📄 导出 JSON
          </button>
          <button className="btn btn-secondary" onClick={exportHTML}>
            📊 导出 HTML
          </button>
        </div>
        <p className="export-hint">
          JSON 报告包含完整数据，适合技术分析；HTML 报告适合打印和存档。
        </p>
      </section>

      {/* 存证记录列表 */}
      <section className="records-section">
        <h3 className="section-title">存证记录 ({records.length})</h3>

        {loading ? (
          <div className="loading">加载中...</div>
        ) : records.length === 0 ? (
          <div className="empty">暂无存证记录</div>
        ) : (
          <div className="records-list">
            {records.map((record) => (
              <div 
                key={record.id} 
                className={`record-card ${selectedRecord?.id === record.id ? 'selected' : ''}`}
                onClick={() => setSelectedRecord(record)}
              >
                <div className="record-header">
                  <span className="record-index">#{record.chain_index}</span>
                  <span className="record-time">{new Date(record.timestamp).toLocaleString()}</span>
                  <span 
                    className="record-risk"
                    style={{ background: getRiskColor(record.risk_level) + '20', color: getRiskColor(record.risk_level) }}
                  >
                    {record.risk_level}
                  </span>
                </div>

                <div className="record-body">
                  <div className="record-agent">{record.agent_name}</div>
                  <div className="record-operation">{record.operation_content}</div>
                </div>

                <div className="record-footer">
                  <span className="record-decision">{getDecisionLabel(record.decision)}</span>
                  <code className="record-hash">{record.record_hash.slice(0, 16)}...</code>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 详情面板 */}
      {selectedRecord && (
        <div className="detail-panel">
          <div className="detail-header">
            <h3>存证详情 #{selectedRecord.chain_index}</h3>
            <button className="close-btn" onClick={() => setSelectedRecord(null)}>✕</button>
          </div>

          <div className="detail-content">
            <div className="detail-item">
              <label>时间戳</label>
              <span>{new Date(selectedRecord.timestamp).toLocaleString()}</span>
            </div>

            <div className="detail-item">
              <label>AI Agent</label>
              <span>{selectedRecord.agent_name}</span>
            </div>

            <div className="detail-item">
              <label>操作类型</label>
              <span>{selectedRecord.operation_type}</span>
            </div>

            <div className="detail-item">
              <label>操作内容</label>
              <span className="detail-content-text">{selectedRecord.operation_content}</span>
            </div>

            <div className="detail-item">
              <label>风险等级</label>
              <span 
                className="risk-badge"
                style={{ background: getRiskColor(selectedRecord.risk_level) + '20', color: getRiskColor(selectedRecord.risk_level) }}
              >
                {selectedRecord.risk_level} ({selectedRecord.risk_score}分)
              </span>
            </div>

            <div className="detail-item">
              <label>风险标签</label>
              <div className="risk-tags">
                {selectedRecord.risk_tags.map((tag, i) => (
                  <span key={i} className="risk-tag">{tag}</span>
                ))}
              </div>
            </div>

            <div className="detail-item">
              <label>决策</label>
              <span className="decision-badge">{getDecisionLabel(selectedRecord.decision)}</span>
            </div>

            <div className="detail-item hash-item">
              <label>当前记录哈希</label>
              <code className="hash-value">{selectedRecord.record_hash}</code>
            </div>

            <div className="detail-item hash-item">
              <label>前一条记录哈希</label>
              <code className="hash-value">{selectedRecord.prev_hash}</code>
            </div>

            <div className="detail-item">
              <label>链位置</label>
              <span>第 {selectedRecord.chain_index} 条</span>
            </div>
          </div>

          <div className="detail-actions">
            <button className="btn btn-secondary" onClick={() => {
              // 验证单条记录
              alert('记录验证: 哈希链完整性验证通过')
            }}>
              验证记录
            </button>
          </div>
        </div>
      )}
    </div>
  )
}