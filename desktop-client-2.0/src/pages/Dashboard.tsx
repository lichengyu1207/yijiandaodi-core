import { useState, useEffect, useMemo } from 'react'
import { authService } from '../services/authService'
import { ShortTermMemoryApi, ShortTermMemory } from '../services/memoryApi'
import MemoryStatCard from '../components/MemoryStatCard'
import RiskDistributionChart from '../components/RiskDistributionChart'

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

interface UserInfo {
  id: number
  username: string
  email: string
  role: string
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
  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null)

  // ===== 新增：短期记忆状态 =====
  const [memories, setMemories] = useState<ShortTermMemory[]>([]);
  const [memorySyncStatus, setMemorySyncStatus] = useState({
    isSyncing: false,
    lastSyncTime: new Date()
  });

  // 获取当前用户信息
  useEffect(() => {
    const user = authService.getCurrentUser()
    if (user) {
      setCurrentUser(user)
    }
  }, [])

  // ===== 新增：初始化短期记忆API（5秒轮询同步） =====
  useEffect(() => {
    const shortTermApi = ShortTermMemoryApi.getInstance();

    // ===== 阶段0: 初始化准备 =====
    const phase0Start = performance.now();
    console.log('\n[Dashboard轮询] ════════════════════════════════════');
    console.log(`[Dashboard轮询] 初始化短期记忆API: ${new Date().toLocaleTimeString()}`);
    console.log('[Dashboard轮询] 轮询间隔: 5秒');
    console.log('[Dashboard轮询] 监控模式: 三阶段耗时分析');
    const phase0End = performance.now();
    console.log(`[Dashboard轮询] 初始化耗时: ${(phase0End - phase0Start).toFixed(2)}ms`);
    console.log('[Dashboard轮询] ════════════════════════════════════\n');

    let syncCount = 0;

    // 开始5秒轮询同步
    shortTermApi.startSync((syncedMemories) => {
      syncCount++;
      const cycleStart = performance.now();

      console.log(`\n[Dashboard轮询] ════════════════════════════════════`);
      console.log(`[Dashboard轮询] 开始第${syncCount}次轮询: ${new Date().toLocaleTimeString()}`);

      // ===== 阶段1: 数据分析 =====
      const phase1Start = performance.now();
      console.log(`[Dashboard轮询] 阶段1(数据分析)开始...`);

      const prevLength = memories.length;
      const added = syncedMemories.length - prevLength;
      const isIncreasing = added > 0;
      const isDecreasing = added < 0;

      const newStats = {
        total: syncedMemories.length,
        low: syncedMemories.filter(m => m.risk_level === 'low').length,
        medium: syncedMemories.filter(m => m.risk_level === 'medium').length,
        high: syncedMemories.filter(m => m.risk_level === 'high').length,
        critical: syncedMemories.filter(m => m.risk_level === 'critical').length,
      };

      const phase1End = performance.now();
      const phase1Duration = (phase1End - phase1Start).toFixed(2);

      console.log(`[Dashboard轮询] 阶段1(数据分析)耗时: ${phase1Duration}ms`);
      console.log(`[Dashboard轮询] 数据量变化: 前次${prevLength}条 → 本次${syncedMemories.length}条`);

      if (isIncreasing) {
        console.log(`[Dashboard轮询] 数据趋势: 新增${added}条记录 ↑`);
      } else if (isDecreasing) {
        console.log(`[Dashboard轮询] 数据趋势: 减少${Math.abs(added)}条记录 ↓`);
      } else {
        console.log(`[Dashboard轮询] 数据趋势: 无变化 -`);
      }

      console.log(`[Dashboard轮询] 风险分布: 低${newStats.low} 中${newStats.medium} 高${newStats.high} 严重${newStats.critical}`);

      // ===== 阶段2: 状态更新 =====
      const phase2Start = performance.now();
      console.log(`[Dashboard轮询] 阶段2(状态更新)开始...`);

      const updateStart = performance.now();
      setMemories(syncedMemories);
      const updateEnd = performance.now();
      const updateDuration = (updateEnd - updateStart).toFixed(2);

      const statusStart = performance.now();
      setMemorySyncStatus({
        isSyncing: false,
        lastSyncTime: new Date()
      });
      const statusEnd = performance.now();
      const statusDuration = (statusEnd - statusStart).toFixed(2);

      const phase2End = performance.now();
      const phase2Duration = (phase2End - phase2Start).toFixed(2);

      console.log(`[Dashboard轮询] 阶段2(状态更新)耗时: ${phase2Duration}ms`);
      console.log(`[Dashboard轮询]   - 数据更新: ${updateDuration}ms`);
      console.log(`[Dashboard轮询]   - 状态更新: ${statusDuration}ms`);

      // ===== 总耗时统计 =====
      const cycleEnd = performance.now();
      const cycleDuration = (cycleEnd - cycleStart).toFixed(2);

      console.log(`[Dashboard轮询] ✓ 轮询回调总耗时: ${cycleDuration}ms`);
      console.log(`[Dashboard轮询]   - 数据分析: ${phase1Duration}ms (${((parseFloat(phase1Duration) / parseFloat(cycleDuration)) * 100).toFixed(1)}%)`);
      console.log(`[Dashboard轮询]   - 状态更新: ${phase2Duration}ms (${((parseFloat(phase2Duration) / parseFloat(cycleDuration)) * 100).toFixed(1)}%)`);
      console.log(`[Dashboard轮询] ════════════════════════════════════\n`);
    });

    // 清理函数：停止轮询
    return () => {
      const cleanupStart = performance.now();
      console.log('\n[Dashboard轮询] ════════════════════════════════════');
      console.log('[Dashboard轮询] 停止短期记忆轮询');
      console.log('[Dashboard轮询] 原因: 组件卸载');
      console.log(`[Dashboard轮询] 总轮询次数: ${syncCount}`);
      console.log(`[Dashboard轮询] 时间: ${new Date().toLocaleTimeString()}`);
      shortTermApi.stopSync();
      const cleanupEnd = performance.now();
      console.log(`[Dashboard轮询] 清理耗时: ${(cleanupEnd - cleanupStart).toFixed(2)}ms`);
      console.log('[Dashboard轮询] ════════════════════════════════════\n');
    };
  }, [])

  // ===== 新增：计算短期记忆统计数据 =====
  const memoryStats = useMemo(() => {
    return {
      total: memories.length,
      low: memories.filter(m => m.risk_level === 'low').length,
      medium: memories.filter(m => m.risk_level === 'medium').length,
      high: memories.filter(m => m.risk_level === 'high').length,
      critical: memories.filter(m => m.risk_level === 'critical').length,
    };
  }, [memories]);
  
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
      {/* 用户信息卡片 */}
      {currentUser && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: 20,
                fontWeight: 'bold'
              }}>
                {currentUser.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{currentUser.username}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{currentUser.email}</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className={`tag tag-${currentUser.role === 'super_admin' ? 'error' : currentUser.role === 'admin' ? 'warning' : 'success'}`}>
                {currentUser.role === 'super_admin' ? '超级管理员' : currentUser.role === 'admin' ? '管理员' : currentUser.role === 'editor' ? '编辑者' : '用户'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6 }}>
                数据与网站实时同步
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* 新增：短期记忆统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <MemoryStatCard
          value={memoryStats.total}
          label="短期记忆"
          syncStatus={memorySyncStatus}
          onClick={() => console.log('点击短期记忆统计卡片')}
        />
        <MemoryStatCard
          value={memoryStats.low}
          label="低风险"
          color="low"
          onClick={() => console.log('点击低风险统计卡片')}
        />
        <MemoryStatCard
          value={memoryStats.medium}
          label="中风险"
          color="medium"
          onClick={() => console.log('点击中风险统计卡片')}
        />
        <MemoryStatCard
          value={memoryStats.high + memoryStats.critical}
          label="高风险"
          color="high"
          onClick={() => console.log('点击高风险统计卡片')}
        />
      </div>

      {/* 新增：风险分布图 */}
      {memoryStats.total > 0 && (
        <RiskDistributionChart stats={memoryStats} />
      )}
      
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