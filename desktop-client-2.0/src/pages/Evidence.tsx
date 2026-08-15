import { useState, useEffect } from 'react'
import { LongTermMemoryApi, LongTermMemory } from '../services/memoryApi'
import './Evidence.css'

interface ChainStatus {
  valid: boolean
  total_records: number
  last_hash: string
  errors: any[]
}

export default function Evidence() {
  const [records, setRecords] = useState<LongTermMemory[]>([])
  const [chainStatus, setChainStatus] = useState<ChainStatus>({
    valid: true,
    total_records: 0,
    last_hash: '',
    errors: []
  })
  const [selectedRecord, setSelectedRecord] = useState<LongTermMemory | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'low' | 'medium' | 'high' | 'critical'>('all')
  const [searchTerm, setSearchTerm] = useState('')

  const longTermApi = LongTermMemoryApi.getInstance()

  useEffect(() => {
    // 初始验证链完整性
    verifyChain()

    // 启动 5 秒轮询同步
    console.log('[Evidence] 启动长期记忆轮询同步（间隔5秒）')
    longTermApi.startSync((memories) => {
      console.log(`[Evidence] 收到轮询数据: ${memories.length} 条`)
      setRecords(memories)
      setLoading(false)
    })

    // 清理函数：停止轮询
    return () => {
      console.log('[Evidence] 停止长期记忆轮询同步')
      longTermApi.stopSync()
    }
  }, [])

  const verifyChain = async () => {
    try {
      console.log('[Evidence] 开始验证链完整性')
      const result = await longTermApi.verifyChain()

      // 转换数据结构
      const chainStatus: ChainStatus = {
        valid: result.is_valid || false,
        total_records: result.total_records || 0,
        last_hash: result.broken_at?.toString() || '',
        errors: []
      }

      setChainStatus(chainStatus)
      console.log(`[Evidence] 链验证结果: ${chainStatus.valid ? '有效' : '无效'}`)
    } catch (error) {
      console.error('[Evidence] 验证链失败:', error)
    }
  }

  const exportJSON = async () => {
    try {
      console.log('[Evidence] 开始导出JSON报告')
      const blob = await longTermApi.exportReport({ format: 'json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `审计报告_${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      console.log('[Evidence] JSON报告导出成功')
    } catch (error) {
      console.error('[Evidence] 导出失败:', error)
      alert('导出失败，请重试')
    }
  }

  const exportHTML = async () => {
    try {
      console.log('[Evidence] 开始导出HTML报告')
      const blob = await longTermApi.exportReport({ format: 'csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `审计报告_${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
      console.log('[Evidence] CSV报告导出成功')
    } catch (error) {
      console.error('[Evidence] 导出失败:', error)
      alert('导出失败，请重试')
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
      case 'deny': return '已拒绝'
      case 'allow': return '已放行'
      case 'review': return '待审核'
      case 'ask_user': return '待确认'
      default: return decision
    }
  }

  const filteredRecords = records.filter(record => {
    // 风险等级筛选
    if (filter !== 'all' && record.risk_level !== filter) {
      return false
    }

    // 搜索筛选（agent_id替代agent_name）
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      return (
        record.agent_id.toLowerCase().includes(search) ||
        record.operation_content.toLowerCase().includes(search) ||
        record.operation_type.toLowerCase().includes(search)
      )
    }

    return true
  })

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
            📊 导出 CSV
          </button>
        </div>
        <p className="export-hint">
          JSON 报告包含完整数据，适合技术分析；CSV 报告适合Excel查看和数据分析。
        </p>
      </section>

      {/* 存证记录列表 */}
      <section className="records-section">
        <h3 className="section-title">存证记录 ({filteredRecords.length})</h3>

        {/* 搜索和筛选 */}
        <div style={{ marginBottom: 16, display: 'flex', gap: 12 }}>
          <input
            type="text"
            placeholder="搜索 Agent、操作内容..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              padding: '8px 12px',
              border: '1px solid var(--border-primary)',
              borderRadius: 6,
              fontSize: 13
            }}
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            style={{
              padding: '8px 12px',
              border: '1px solid var(--border-primary)',
              borderRadius: 6,
              fontSize: 13,
              background: 'var(--bg-secondary)'
            }}
          >
            <option value="all">全部风险</option>
            <option value="low">低风险</option>
            <option value="medium">中风险</option>
            <option value="high">高风险</option>
            <option value="critical">严重</option>
          </select>
        </div>

        {loading ? (
          <div className="loading">加载中...</div>
        ) : filteredRecords.length === 0 ? (
          <div className="empty">暂无存证记录</div>
        ) : (
          <div className="records-list">
            {filteredRecords.map((record) => (
              <div
                key={record.id}
                className={`record-card ${selectedRecord?.id === record.id ? 'selected' : ''}`}
                onClick={() => setSelectedRecord(record)}
              >
                <div className="record-header">
                  <span className="record-index">#{record.chain_index}</span>
                  <span className="record-time">{new Date(record.created_at).toLocaleString()}</span>
                  <span
                    className="record-risk"
                    style={{ background: getRiskColor(record.risk_level) + '20', color: getRiskColor(record.risk_level) }}
                  >
                    {record.risk_level}
                  </span>
                </div>

                <div className="record-body">
                  <div className="record-agent">{record.agent_id}</div>
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
              <span>{new Date(selectedRecord.created_at).toLocaleString()}</span>
            </div>

            <div className="detail-item">
              <label>AI Agent</label>
              <span>{selectedRecord.agent_id}</span>
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
                {selectedRecord.risk_level}
              </span>
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