import { useState, useEffect } from 'react'
import { authService } from '../services/authService'
import { StrategicMemoryApi, StrategicMemory } from '../services/memoryApi'
import PermissionList from '../components/PermissionList'
import type { PluginInfo, PluginHookHealth, PluginStatsData } from '../types/electron'
import './Settings.css'

interface ServiceStatus {
  running: boolean
  port: number
  uptime: string
  requests: number
}

interface NodeMetrics {
  cpu_usage: number
  memory_usage: number
  gpu_usage: number | null
  disk_available: number
  disk_total: number
}

interface UserInfo {
  id: number
  username: string
  email: string
  role: string
}

// 插件状态中文映射
const PLUGIN_STATUS_LABELS: Record<string, string> = {
  loaded: '已启用',
  disabled: '已停用',
  retired: '已卸载',
  error: '异常',
}

// 决策链路钩子点中文映射
const HOOK_LABELS: Record<string, string> = {
  onPercept: '感知预处理',
  beforePlan: '规划前',
  onRunStart: 'run 开始',
  onRiskAssessed: '风险定级后',
  beforeAlert: '告警前',
  beforeToolCall: '工具执行前',
  afterToolCall: '工具执行后',
  onRunEnd: 'run 结束',
}

export default function Settings() {
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>({
    running: false,
    port: 9092,
    uptime: '0s',
    requests: 0
  })

  const [nodeMetrics, setNodeMetrics] = useState<NodeMetrics>({
    cpu_usage: 0,
    memory_usage: 0,
    gpu_usage: null,
    disk_available: 0,
    disk_total: 0
  })

  const [currentUser, setCurrentUser] = useState<UserInfo | null>(null)

  const [apiConfig, setApiConfig] = useState({
    endpoint: 'http://localhost:9092',
    deepseekKey: ''
  })

  const [llmConfig, setLLMConfig] = useState({
    mode: 'builtin', // builtin, custom, local
    provider: 'deepseek',
    apiKey: '',
    model: 'deepseek-chat',
    apiBase: 'https://api.deepseek.com'
  })

  const [_loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // 策略管理
  const [strategies, setStrategies] = useState<StrategicMemory[]>([])
  const strategicApi = StrategicMemoryApi.getInstance()
  const [strategyLoading, setStrategyLoading] = useState(false)

  // 文件系统监控（第一优先级）
  const [watchPaths, setWatchPaths] = useState<string[]>([])
  const [watchStatus, setWatchStatus] = useState<{ path: string; exists: boolean; watching: boolean }[]>([])
  const [newWatchPath, setNewWatchPath] = useState('')
  const [watchLoading, setWatchLoading] = useState(false)

  // API 调用监控（第二优先级）
  const [apiMonEnabled, setApiMonEnabled] = useState(false)
  const [apiMonPort, setApiMonPort] = useState(8890)
  const [apiMonRunning, setApiMonRunning] = useState(false)
  const [apiMonSaving, setApiMonSaving] = useState(false)
  const [apiMonMsg, setApiMonMsg] = useState<string | null>(null)

  // 治理日志级别（trace 决策路径埋点开关）
  const [govLogLevel, setGovLogLevel] = useState('debug')
  const [govLogSaving, setGovLogSaving] = useState(false)
  const [govLogMsg, setGovLogMsg] = useState<string | null>(null)

  // 操作权限（复用 PermissionList，随时修改并持久化）
  const [permissionGranted, setPermissionGranted] = useState<Record<string, boolean>>({})
  const [permissionLoaded, setPermissionLoaded] = useState(false)
  const [permissionSaving, setPermissionSaving] = useState(false)
  const [permissionMsg, setPermissionMsg] = useState<string | null>(null)

  // 插件管理（Skill 插件生态）
  const [plugins, setPlugins] = useState<PluginInfo[]>([])
  const [pluginHealth, setPluginHealth] = useState<PluginHookHealth[]>([])
  const [pluginLoading, setPluginLoading] = useState(false)
  const [pluginMsg, setPluginMsg] = useState<string | null>(null)
  const [pluginStats, setPluginStats] = useState<PluginStatsData | null>(null)

  useEffect(() => {
    checkServiceStatus()
    fetchNodeMetrics()
    loadStrategies()
    loadWatchPaths()
    loadApiCallConfig()
    loadGovernanceLogLevel()
    loadPermissionConfig()
    loadPlugins()
    loadPluginStats()
    const user = authService.getCurrentUser()
    if (user) {
      setCurrentUser(user)
    }
    const interval = setInterval(checkServiceStatus, 5000)
    const metricsInterval = setInterval(fetchNodeMetrics, 3000)
    return () => {
      clearInterval(interval)
      clearInterval(metricsInterval)
    }
  }, [])
  
  const checkServiceStatus = async () => {
    try {
      const response = await fetch('http://localhost:9092/health', {
        signal: AbortSignal.timeout(2000)
      })
      if (response.ok) {
        setServiceStatus(prev => ({
          ...prev,
          running: true
        }))
        setLoading(false)
        setError(null)
      }
    } catch (err) {
      setServiceStatus(prev => ({
        ...prev,
        running: false
      }))
      setLoading(false)
      setError('无法连接到服务')
    }
  }

  const fetchNodeMetrics = async () => {
    try {
      // 从本地API获取节点指标
      const response = await fetch('http://localhost:9092/api/v1/node/metrics', {
        signal: AbortSignal.timeout(2000)
      })
      if (response.ok) {
        const data = await response.json()
        setNodeMetrics(data)
      } else {
        // 如果API不可用，使用模拟数据
        setNodeMetrics({
          cpu_usage: Math.random() * 100,
          memory_usage: 30 + Math.random() * 50,
          gpu_usage: Math.random() > 0.5 ? Math.random() * 100 : null,
          disk_available: 128.5,
          disk_total: 256
        })
      }
    } catch (error) {
      // 使用模拟数据
      setNodeMetrics({
        cpu_usage: Math.random() * 100,
        memory_usage: 30 + Math.random() * 50,
        gpu_usage: Math.random() > 0.5 ? Math.random() * 100 : null,
        disk_available: 128.5,
        disk_total: 256
      })
    }
  }
  
  const handleStartService = async () => {
    console.log('启动服务...')
    // TODO: 通过 IPC 调用主进程启动服务
  }
  
  const handleStopService = async () => {
    console.log('停止服务...')
    // TODO: 通过 IPC 调用主进程停止服务
  }
  
  // 策略管理函数
  const loadStrategies = async () => {
    try {
      setStrategyLoading(true)
      console.log('[Settings] 加载策略列表...')
      const data = await strategicApi.getStrategies()
      console.log('[Settings] 策略加载成功:', data.length)
      setStrategies(data)
    } catch (error) {
      console.error('[Settings] 加载策略失败:', error)
      setStrategies([])
    } finally {
      setStrategyLoading(false)
    }
  }
  
  const handleActivateStrategy = async (id: number) => {
    try {
      console.log('[Settings] 激活策略:', id)
      await strategicApi.activateStrategy(id)
      console.log('[Settings] 策略激活成功')
      loadStrategies() // 刷新列表
    } catch (error) {
      console.error('[Settings] 激活策略失败:', error)
    }
  }
  
  const handleDeactivateStrategy = async (id: number) => {
    try {
      console.log('[Settings] 停用策略:', id)
      await strategicApi.deactivateStrategy(id)
      console.log('[Settings] 策略停用成功')
      loadStrategies() // 刷新列表
    } catch (error) {
      console.error('[Settings] 停用策略失败:', error)
    }
  }
  
  const getStrategyTypeText = (type: string) => {
    const typeMap: Record<string, string> = {
      'behavior_constraint': '行为约束',
      'risk_threshold': '风险阈值',
      'audit_rule': '审计规则',
      'response_action': '响应动作'
    }
    return typeMap[type] || type
  }

  // 文件系统监控：加载监控目录
  const loadWatchPaths = async () => {
    try {
      const api = (window as any).electronAPI
      if (!api?.getFileWatchConfig) return
      const res = await api.getFileWatchConfig()
      if (res?.success && res.data) {
        setWatchPaths(res.data.watchPaths || [])
        setWatchStatus(res.data.status || [])
      }
    } catch (error) {
      console.error('[Settings] 加载监控目录失败:', error)
    }
  }

  // 文件系统监控：添加监控目录
  const handleAddWatchPath = async () => {
    const p = newWatchPath.trim()
    if (!p) return
    if (watchPaths.includes(p)) {
      setNewWatchPath('')
      return
    }
    const next = [...watchPaths, p]
    setWatchLoading(true)
    try {
      const api = (window as any).electronAPI
      if (api?.setFileWatchPaths) {
        await api.setFileWatchPaths(next)
      }
      setWatchPaths(next)
      setNewWatchPath('')
      await loadWatchPaths()
    } finally {
      setWatchLoading(false)
    }
  }

  // 文件系统监控：移除监控目录
  const handleRemoveWatchPath = async (p: string) => {
    const next = watchPaths.filter(x => x !== p)
    setWatchLoading(true)
    try {
      const api = (window as any).electronAPI
      if (api?.setFileWatchPaths) {
        await api.setFileWatchPaths(next)
      }
      setWatchPaths(next)
      await loadWatchPaths()
    } finally {
      setWatchLoading(false)
    }
  }

  // API 调用监控：加载配置
  const loadApiCallConfig = async () => {
    try {
      const api = (window as any).electronAPI
      if (!api?.getApiCallConfig) return
      const res = await api.getApiCallConfig()
      if (res?.success && res.data) {
        setApiMonEnabled(!!res.data.enabled)
        setApiMonPort(res.data.port || 8890)
      }
      // 状态
      const st = await api.getApiCallStatus()
      if (st?.success && st.data) {
        setApiMonRunning(!!st.data.running)
      }
    } catch (error) {
      console.error('[Settings] 加载 API 调用监控配置失败:', error)
    }
  }

  // API 调用监控：保存配置（含启停代理）
  const handleSaveApiCall = async () => {
    const port = Number(apiMonPort)
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      setApiMonMsg('端口号无效，请输入 1-65535 之间的整数')
      return
    }
    setApiMonSaving(true)
    setApiMonMsg(null)
    try {
      const api = (window as any).electronAPI
      if (!api?.setApiCallConfig) return
      const res = await api.setApiCallConfig({ enabled: apiMonEnabled, port, alertOnSensitive: true })
      if (res?.success) {
        setApiMonPort(port)
        const st = await api.getApiCallStatus()
        if (st?.success && st.data) setApiMonRunning(!!st.data.running)
        setApiMonMsg(apiMonEnabled ? '已启用并应用配置' : '已停用 API 调用监控')
      } else {
        setApiMonMsg(res?.error || '保存失败')
      }
    } catch (error: any) {
      setApiMonMsg(error?.message || '保存失败')
    } finally {
      setApiMonSaving(false)
    }
  }

  // 治理日志：加载当前级别
  const loadGovernanceLogLevel = async () => {
    try {
      const api = (window as any).electronAPI
      if (!api?.getGovernanceLogLevel) return
      const res = await api.getGovernanceLogLevel()
      if (res?.success && res.data?.level) {
        setGovLogLevel(res.data.level)
      }
    } catch (error) {
      console.error('[Settings] 加载治理日志级别失败:', error)
    }
  }

  // 治理日志：保存级别（立即生效并持久化）
  const handleSaveGovLogLevel = async () => {
    setGovLogSaving(true)
    setGovLogMsg(null)
    try {
      const api = (window as any).electronAPI
      if (!api?.setGovernanceLogLevel) {
        setGovLogMsg('当前环境不支持该设置')
        return
      }
      const res = await api.setGovernanceLogLevel(govLogLevel)
      if (res?.success) {
        setGovLogMsg(`已切换为 ${govLogLevel.toUpperCase()} 级别`)
      } else {
        setGovLogMsg(res?.error || '保存失败')
      }
    } catch (error: any) {
      setGovLogMsg(error?.message || '保存失败')
    } finally {
      setGovLogSaving(false)
    }
  }

  // 操作权限：加载当前授权配置
  const loadPermissionConfig = async () => {
    try {
      const api = (window as any).electronAPI
      if (!api?.getPermissionConfig) {
        // 非 Electron 环境：放行，不展示可编辑区块
        setPermissionLoaded(true)
        return
      }
      console.log('[Settings] 加载操作权限配置开始')
      const res = await api.getPermissionConfig()
      const cfg = res?.data || res
      console.log('[Settings] 加载操作权限配置返回', {
        success: res?.success,
        onboarded: cfg?.onboarded,
        grantedCount: cfg?.granted ? Object.keys(cfg.granted).length : 0,
      })
      if (cfg?.granted) {
        setPermissionGranted(cfg.granted)
      }
    } catch (error) {
      console.error('[Settings] 加载操作权限失败:', error)
    } finally {
      setPermissionLoaded(true)
    }
  }

  // 操作权限：保存修改（主进程立即应用门控）
  const handleSavePermission = async () => {
    setPermissionSaving(true)
    setPermissionMsg(null)
    console.log('[Settings] 保存操作权限提交', { granted: permissionGranted })
    try {
      const api = (window as any).electronAPI
      if (!api?.setPermissionConfig) {
        console.warn('[Settings] 保存操作权限跳过（setPermissionConfig 不可用）')
        setPermissionMsg('当前环境不支持该设置')
        return
      }
      const res = await api.setPermissionConfig(permissionGranted)
      console.log('[Settings] 保存操作权限返回', { success: res?.success, error: res?.error })
      if (res?.success) {
        setPermissionMsg('操作权限已保存并立即生效')
      } else {
        setPermissionMsg(res?.error || '保存失败')
      }
    } catch (error: any) {
      console.error('[Settings] 保存操作权限异常', error?.message || error)
      setPermissionMsg(error?.message || '保存失败')
    } finally {
      setPermissionSaving(false)
    }
  }

  // 插件管理：加载插件列表 + 钩子健康状态
  const loadPlugins = async () => {
    setPluginLoading(true)
    try {
      const api = (window as any).electronAPI
      if (!api?.getPlugins) {
        setPlugins([])
        setPluginHealth([])
        return
      }
      const res = await api.getPlugins()
      if (res?.success && res.data) {
        setPlugins(res.data.plugins || [])
        setPluginHealth(res.data.health || [])
      }
    } catch (error: any) {
      console.error('[Settings] 加载插件列表失败:', error)
    } finally {
      setPluginLoading(false)
    }
  }

  // 插件管理：加载插件性能统计（注册表运维 + HooksHost 钩子执行 + 单飞去重 + 自洽性校验）
  const loadPluginStats = async () => {
    try {
      const api = (window as any).electronAPI
      if (!api?.getPluginStats) return
      const res = await api.getPluginStats()
      if (res?.success && res.data) setPluginStats(res.data)
    } catch (error: any) {
      console.error('[Settings] 加载插件性能统计失败:', error)
    }
  }

  // 性能概览：自洽性校验状态徽标（statsCheck 线上自动校验结果；check=null 时不显示）
  const renderStatsCheckBadge = () => {
    const check = pluginStats?.check
    if (!check) return null
    if (check.ok && check.warnings.length === 0) {
      return (
        <span style={{ fontSize: 11, color: '#2EA043', border: '1px solid rgba(46,160,67,0.4)', borderRadius: 4, padding: '0 6px' }}>
          自洽性校验通过
        </span>
      )
    }
    if (!check.ok) {
      return (
        <span style={{ fontSize: 11, color: '#F85149', border: '1px solid rgba(248,81,73,0.4)', borderRadius: 4, padding: '0 6px' }}>
          校验违例 {check.errors.length} 条
        </span>
      )
    }
    return (
      <span style={{ fontSize: 11, color: '#D29922', border: '1px solid rgba(210,153,34,0.4)', borderRadius: 4, padding: '0 6px' }}>
        校验提示 {check.warnings.length} 条
      </span>
    )
  }

  // 插件管理：启用/停用插件（立即生效）
  const handleTogglePlugin = async (id: string, enabled: boolean) => {
    setPluginMsg(null)
    try {
      const api = (window as any).electronAPI
      if (!api?.setPluginEnabled) {
        setPluginMsg('当前环境不支持该设置')
        return
      }
      const res = await api.setPluginEnabled({ id, enabled })
      if (res?.success) {
        setPluginMsg(enabled ? `已启用插件 ${id}` : `已停用插件 ${id}`)
      } else {
        setPluginMsg(res?.error || '操作失败')
      }
      await loadPlugins()
    } catch (error: any) {
      setPluginMsg(error?.message || '操作失败')
    }
  }

  return (
    <div className="settings-page">
      {/* 用户信息 */}
      {currentUser && (
        <section className="settings-section">
          <h2 className="section-title">账户信息</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
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
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{currentUser.username}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{currentUser.email}</div>
              <div className={`tag tag-${currentUser.role === 'super_admin' ? 'error' : currentUser.role === 'admin' ? 'warning' : 'success'}`} style={{ marginTop: 4 }}>
                {currentUser.role === 'super_admin' ? '超级管理员' : currentUser.role === 'admin' ? '管理员' : '用户'}
              </div>
            </div>
          </div>
          <div className="button-group">
            <button className="btn btn-secondary">修改密码</button>
            <button className="btn btn-secondary" onClick={() => authService.logout()}>退出登录</button>
          </div>
        </section>
      )}

      {/* 节点资源监控 */}
      <section className="settings-section">
        <h2 className="section-title">节点资源监控</h2>
        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-value" style={{ color: nodeMetrics.cpu_usage > 80 ? '#F85149' : nodeMetrics.cpu_usage > 50 ? '#D29922' : '#3FB950' }}>
              {nodeMetrics.cpu_usage.toFixed(1)}%
            </div>
            <div className="stat-label">CPU 使用率</div>
          </div>
          <div className="stat-item">
            <div className="stat-value" style={{ color: nodeMetrics.memory_usage > 80 ? '#F85149' : nodeMetrics.memory_usage > 60 ? '#D29922' : '#3FB950' }}>
              {nodeMetrics.memory_usage.toFixed(1)}%
            </div>
            <div className="stat-label">内存使用率</div>
          </div>
          <div className="stat-item">
            <div className="stat-value" style={{ color: '#3FB950' }}>
              {nodeMetrics.gpu_usage !== null ? `${nodeMetrics.gpu_usage.toFixed(1)}%` : 'N/A'}
            </div>
            <div className="stat-label">GPU 使用率</div>
          </div>
          <div className="stat-item">
            <div className="stat-value" style={{ color: '#3FB950' }}>
              {nodeMetrics.disk_available.toFixed(1)} GB
            </div>
            <div className="stat-label">可用磁盘空间</div>
          </div>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>
          总磁盘空间: {nodeMetrics.disk_total.toFixed(1)} GB
        </p>
      </section>

      {/* 服务状态 */}
      <section className="settings-section">
        <div className="section-header">
          <h2 className="section-title">服务状态</h2>
          <span className={`status-badge ${serviceStatus.running ? 'running' : 'stopped'}`}>
            {serviceStatus.running ? '运行中' : '已停止'}
          </span>
        </div>

        {error && (
          <div style={{
            padding: 12,
            background: '#FFF8E1',
            border: '1px solid #FFE082',
            borderRadius: 6,
            marginBottom: 16,
            fontSize: 13
          }}>
            ⚠️ {error} - 后台服务正在启动中，请稍候
          </div>
        )}

        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-value">{serviceStatus.port}</div>
            <div className="stat-label">监听端口</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{serviceStatus.uptime}</div>
            <div className="stat-label">运行时间</div>
          </div>
          <div className="stat-item">
            <div className="stat-value">{serviceStatus.requests}</div>
            <div className="stat-label">处理请求</div>
          </div>
        </div>

        <div className="button-group">
          <button
            className="btn btn-primary"
            onClick={handleStartService}
            disabled={serviceStatus.running}
          >
            启动服务
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleStopService}
            disabled={!serviceStatus.running}
          >
            停止服务
          </button>
        </div>
      </section>

      {/* 文件系统监控（第一优先级） */}
      <section className="settings-section">
        <div className="section-header">
          <h2 className="section-title">文件系统监控</h2>
          <span className="status-badge running">监控运行中</span>
        </div>

        <p className="info-text" style={{ marginBottom: 12 }}>
          监控指定目录下的文件创建、修改、重命名、删除操作，计算并对比文件哈希，
          对代码/可执行文件进行深度校验，高风险操作将触发二次确认。
        </p>

        <div className="form-group">
          <label className="form-label">已监控目录</label>
          {watchPaths.length === 0 ? (
            <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
              暂无监控目录，请添加
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {watchPaths.map((p, i) => {
                const st = watchStatus[i]
                return (
                  <div key={p} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                    background: 'var(--bg-secondary, #f5f7fa)', borderRadius: 6
                  }}>
                    <span style={{ fontSize: 13, flex: 1, wordBreak: 'break-all' }}>{p}</span>
                    {st && (
                      <span className={`status-badge ${st.exists ? (st.watching ? 'running' : 'stopped') : 'stopped'}`}>
                        {!st.exists ? '不存在' : st.watching ? '监听中' : '未监听'}
                      </span>
                    )}
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleRemoveWatchPath(p)}
                      disabled={watchLoading}
                    >
                      移除
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">添加监控目录</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              className="form-input"
              value={newWatchPath}
              onChange={(e) => setNewWatchPath(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddWatchPath() }}
              placeholder="例如 C:\漫剧\素材"
            />
            <button
              className="btn btn-primary"
              onClick={handleAddWatchPath}
              disabled={watchLoading || !newWatchPath.trim()}
            >
              添加
            </button>
          </div>
          <div className="form-hint">
            支持同时监控多个目录（如漫剧素材目录、项目目录）。代码/可执行文件将进入深度校验，高风险操作会弹出二次确认。
          </div>
        </div>
      </section>

      {/* API 调用监控（第二优先级） */}
      <section className="settings-section">
        <div className="section-header">
          <h2 className="section-title">API 调用监控</h2>
          <span className={`status-badge ${apiMonRunning ? 'running' : 'stopped'}`}>
            {apiMonRunning ? '代理运行中' : '代理未运行'}
          </span>
        </div>

        <p className="info-text" style={{ marginBottom: 12 }}>
          通过本地代理捕获本机 AI 平台 API 调用，识别请求内容中的敏感信息与违规风险，
          高风险调用将触发告警并记录存证。请在浏览器/系统代理设置中指向本机端口。
        </p>

        <div className="form-group">
          <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={apiMonEnabled}
              onChange={(e) => setApiMonEnabled(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            启用 API 调用监控
          </label>
          <div className="form-hint">
            启用后将启动本地代理服务器监听指定端口。HTTP 请求会解析内容校验，HTTPS 仅记录连接（不做解密）。
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">代理端口</label>
          <input
            type="number"
            className="form-input"
            value={apiMonPort}
            onChange={(e) => setApiMonPort(Number(e.target.value))}
            min={1}
            max={65535}
            disabled={apiMonRunning}
            style={{ maxWidth: 160 }}
          />
          <div className="form-hint">
            默认 8890。端口修改需先停用代理后保存。
          </div>
        </div>

        {apiMonMsg && (
          <div style={{
            padding: 10,
            background: apiMonMsg.includes('无效') || apiMonMsg.includes('失败') ? '#FFF0F0' : '#F0F7FF',
            border: `1px solid ${apiMonMsg.includes('无效') || apiMonMsg.includes('失败') ? '#FFC2C2' : '#BFD9FF'}`,
            borderRadius: 6,
            marginBottom: 12,
            fontSize: 13
          }}>
            {apiMonMsg}
          </div>
        )}

        <div className="button-group">
          <button
            className="btn btn-primary"
            onClick={handleSaveApiCall}
            disabled={apiMonSaving}
          >
            {apiMonSaving ? '保存中...' : (apiMonEnabled ? '启动代理' : '保存配置')}
          </button>
        </div>
      </section>
      
      {/* 治理日志 */}
      <section className="settings-section">
        <div className="section-header">
          <h2 className="section-title">治理日志</h2>
          <span className={`status-badge ${govLogLevel === 'trace' ? 'running' : 'stopped'}`}>
            {govLogLevel === 'trace' ? 'TRACE 已开启' : govLogLevel.toUpperCase()}
          </span>
        </div>

        <p className="info-text" style={{ marginBottom: 12 }}>
          治理 Agent 决策路径日志级别。TRACE 记录最细粒度的风险判定链路
          （定级 → 路由 → 执行拆分 → 权限闸门 → 续轮裁决），排查复杂场景时开启；
          默认 DEBUG 已含全部治理事件，INFO 仅保留概要。
        </p>

        <div className="form-group">
          <label className="form-label">日志级别</label>
          <select
            className="form-select"
            value={govLogLevel}
            onChange={(e) => setGovLogLevel(e.target.value)}
            style={{ maxWidth: 260 }}
          >
            <option value="trace">TRACE（详细决策路径）</option>
            <option value="debug">DEBUG（默认）</option>
            <option value="info">INFO（仅概要）</option>
          </select>
          <div className="form-hint">
            切换后立即生效并持久化，重启后保持。日志写入 governance-%DATE%.log。
          </div>
        </div>

        {govLogMsg && (
          <div style={{
            padding: 10,
            background: govLogMsg.includes('失败') ? '#FFF0F0' : '#F0F7FF',
            border: `1px solid ${govLogMsg.includes('失败') ? '#FFC2C2' : '#BFD9FF'}`,
            borderRadius: 6,
            marginBottom: 12,
            fontSize: 13
          }}>
            {govLogMsg}
          </div>
        )}

        <div className="button-group">
          <button
            className="btn btn-primary"
            onClick={handleSaveGovLogLevel}
            disabled={govLogSaving}
          >
            {govLogSaving ? '保存中...' : '应用日志级别'}
          </button>
        </div>
      </section>

      {/* 插件管理 */}
      <section className="settings-section">
        <div className="section-header">
          <h2 className="section-title">插件管理</h2>
          <span className={`status-badge ${plugins.length > 0 ? 'running' : 'stopped'}`}>
            {pluginLoading ? '加载中' : `已装 ${plugins.length} 个`}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => { loadPlugins(); loadPluginStats() }}
            disabled={pluginLoading}
          >
            {pluginLoading ? '加载中...' : '刷新'}
          </button>
        </div>

        <p className="info-text" style={{ marginBottom: 12 }}>
          治理 Agent 的可扩展模块。插件通过决策链路钩子（感知预处理 / 规划前 / 风险定级后 /
          告警前 / 工具执行前后 / run 结束）扩展治理能力，可随时启用或停用，无需重启应用。
        </p>

        {pluginStats && (
          <div style={{
            padding: 12,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            marginBottom: 12,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong style={{ fontSize: 13 }}>性能概览（进程内累计）</strong>
                {renderStatsCheckBadge()}
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                {pluginStats.hooks?.lastEmitAt ? `最近 emit ${new Date(pluginStats.hooks.lastEmitAt).toLocaleTimeString()}` : '尚未触发钩子'}
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, fontSize: 12 }}>
              <div>
                <div style={{ color: 'var(--text-tertiary)' }}>emit 总数</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{pluginStats.hooks?.emitTotal ?? 0}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-tertiary)' }}>钩子执行</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{pluginStats.hooks?.hookExecTotal ?? 0}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-tertiary)' }}>平均耗时</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{(pluginStats.hooks?.hookExecAvgMs ?? 0).toFixed(1)}ms</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-tertiary)' }}>最大耗时</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{(pluginStats.hooks?.hookExecMaxMs ?? 0).toFixed(1)}ms</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-tertiary)' }}>超时</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: (pluginStats.hooks?.timeoutCount ?? 0) > 0 ? '#F85149' : 'inherit' }}>
                  {pluginStats.hooks?.timeoutCount ?? 0}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-tertiary)' }}>熔断</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: (pluginStats.hooks?.trippedCount ?? 0) > 0 ? '#F85149' : 'inherit' }}>
                  {pluginStats.hooks?.trippedCount ?? 0}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-tertiary)' }}>跳过</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{pluginStats.hooks?.skippedCount ?? 0}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-tertiary)' }}>短路</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{pluginStats.hooks?.shortCircuitCount ?? 0}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-tertiary)' }}>单飞 首次/复用</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>
                  {pluginStats.runOnce?.firstHit ?? 0}/{pluginStats.runOnce?.reuseHit ?? 0}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-tertiary)' }}>安装/卸载</div>
                <div style={{ fontSize: 18, fontWeight: 600 }}>
                  {pluginStats.registry?.installCount ?? 0}/{pluginStats.registry?.uninstallCount ?? 0}
                </div>
              </div>
            </div>
          </div>
        )}

        {pluginMsg && (
          <div style={{
            padding: 10,
            background: pluginMsg.includes('失败') || pluginMsg.includes('不存在') ? '#FFF0F0' : '#F0F7FF',
            border: `1px solid ${pluginMsg.includes('失败') || pluginMsg.includes('不存在') ? '#FFC2C2' : '#BFD9FF'}`,
            borderRadius: 6,
            marginBottom: 12,
            fontSize: 13
          }}>
            {pluginMsg}
          </div>
        )}

        {plugins.length === 0 && !pluginLoading && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
            暂无已安装插件
          </div>
        )}

        {plugins.map((plugin) => {
          const health = pluginHealth.find((h) => h.pluginId === plugin.id)
          const enabled = plugin.status === 'loaded'
          return (
            <div key={plugin.id} className="strategy-card" style={{ marginBottom: 12 }}>
              <div className="strategy-header">
                <div>
                  <div className="strategy-name">{plugin.id}</div>
                  <div className="strategy-meta">
                    {plugin.version && <span className="strategy-version">v{plugin.version}</span>}
                    {plugin.priority !== undefined && (
                      <span className="strategy-type">优先级 {plugin.priority}</span>
                    )}
                  </div>
                </div>
                <span className={`status-badge ${plugin.status === 'error' || plugin.status === 'disabled' ? 'stopped' : 'running'}`}>
                  {PLUGIN_STATUS_LABELS[plugin.status || ''] || plugin.status || '未知'}
                </span>
              </div>

              {plugin.description && (
                <div className="form-hint" style={{ marginBottom: 8 }}>{plugin.description}</div>
              )}

              {plugin.error && (
                <div style={{
                  padding: 8,
                  background: '#FFF0F0',
                  border: '1px solid #FFC2C2',
                  borderRadius: 6,
                  marginBottom: 8,
                  fontSize: 12,
                  color: '#C62828'
                }}>
                  错误：{plugin.error}
                </div>
              )}

              {health && (
                <div className="strategy-stats" style={{ marginBottom: 8 }}>
                  <div className="stat-item-sm" style={{ flex: 1 }}>
                    <span className="stat-label-sm">钩子点</span>
                    <span className="stat-value-sm">
                      {health.hookPoints.length > 0
                        ? health.hookPoints.map((p) => HOOK_LABELS[p] || p).join('、')
                        : '无'}
                    </span>
                  </div>
                  <div className="stat-item-sm">
                    <span className="stat-label-sm">异常计数</span>
                    <span className="stat-value-sm" style={{ color: health.tripped ? '#F85149' : '#3FB950' }}>
                      {health.errorCount}/{health.threshold}
                    </span>
                  </div>
                </div>
              )}

              {health?.tripped && (
                <div style={{
                  padding: 8,
                  background: '#FFF0F0',
                  border: '1px solid #FFC2C2',
                  borderRadius: 6,
                  marginBottom: 8,
                  fontSize: 12,
                  color: '#C62828'
                }}>
                  该插件钩子已触发熔断（连续异常达到阈值），已自动跳过其钩子执行。
                </div>
              )}

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => handleTogglePlugin(plugin.id, e.target.checked)}
                    style={{ width: 16, height: 16 }}
                  />
                  启用该插件
                </label>
                <div className="form-hint">
                  停用后插件的决策链路钩子不再参与治理流程；事件订阅与注入的工具保留。
                </div>
              </div>
            </div>
          )
        })}
      </section>

      {/* 操作权限 */}
      <section className="settings-section">
        <div className="section-header">
          <h2 className="section-title">操作权限</h2>
          {permissionLoaded && (
            <span className={`status-badge ${permissionSaving ? 'stopped' : 'running'}`}>
              {permissionSaving ? '保存中' : '可编辑'}
            </span>
          )}
        </div>

        <p className="info-text" style={{ marginBottom: 12 }}>
          控制本应用可执行的监控与操作。未授权的一律不会执行（fail-closed），
          修改后立即生效并持久化，重启后保持。
        </p>

        {!permissionLoaded ? (
          <div className="form-hint">正在加载操作权限配置...</div>
        ) : (
          <>
            <PermissionList
              granted={permissionGranted}
              onChange={(key, value) =>
                setPermissionGranted((prev) => ({ ...prev, [key]: value }))
              }
            />

            {permissionMsg && (
              <div style={{
                padding: 10,
                background: permissionMsg.includes('失败') ? '#FFF0F0' : '#F0F7FF',
                border: `1px solid ${permissionMsg.includes('失败') ? '#FFC2C2' : '#BFD9FF'}`,
                borderRadius: 6,
                marginBottom: 12,
                marginTop: 12,
                fontSize: 13
              }}>
                {permissionMsg}
              </div>
            )}

            <div className="button-group" style={{ marginTop: 12 }}>
              <button
                className="btn btn-primary"
                onClick={handleSavePermission}
                disabled={permissionSaving}
              >
                {permissionSaving ? '保存中...' : '保存操作权限'}
              </button>
            </div>
          </>
        )}
      </section>

      {/* 策略管理 */}
      <section className="settings-section">
        <div className="section-header">
          <h2 className="section-title">策略管理</h2>
          <button
            className="btn btn-secondary btn-sm"
            onClick={loadStrategies}
            disabled={strategyLoading}
          >
            {strategyLoading ? '加载中...' : '刷新'}
          </button>
        </div>
        
        {strategies.length === 0 && !strategyLoading && (
          <div style={{
            padding: 24,
            textAlign: 'center',
            color: 'var(--text-tertiary)',
            fontSize: 13
          }}>
            暂无策略数据
          </div>
        )}
        
        {strategies.map(strategy => (
          <div key={strategy.id} className="strategy-card">
            <div className="strategy-header">
              <div>
                <div className="strategy-name">{strategy.strategy_name}</div>
                <div className="strategy-meta">
                  <span className="strategy-type">{getStrategyTypeText(strategy.strategy_type)}</span>
                  <span className="strategy-version">v{strategy.version}</span>
                </div>
              </div>
              <span className={`status-badge ${strategy.is_active ? 'running' : 'stopped'}`}>
                {strategy.is_active ? '已激活' : '已停用'}
              </span>
            </div>
            
            <div className="strategy-stats">
              <div className="stat-item-sm">
                <span className="stat-label-sm">置信度</span>
                <span className="stat-value-sm">{(strategy.confidence * 100).toFixed(1)}%</span>
              </div>
              <div className="stat-item-sm">
                <span className="stat-label-sm">样本数</span>
                <span className="stat-value-sm">{strategy.sample_count}</span>
              </div>
              <div className="stat-item-sm">
                <span className="stat-label-sm">成功率</span>
                <span className="stat-value-sm">{(strategy.success_rate * 100).toFixed(1)}%</span>
              </div>
              <div className="stat-item-sm">
                <span className="stat-label-sm">优先级</span>
                <span className="stat-value-sm">{strategy.priority}</span>
              </div>
            </div>
            
            <div className="strategy-actions">
              {strategy.is_active ? (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleDeactivateStrategy(strategy.id)}
                >
                  停用
                </button>
              ) : (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleActivateStrategy(strategy.id)}
                >
                  激活
                </button>
              )}
              <button className="btn btn-secondary btn-sm">
                详情
              </button>
            </div>
          </div>
        ))}
      </section>
      
      {/* API 配置 */}
      <section className="settings-section">
        <h2 className="section-title">API 配置</h2>
        
        <div className="form-group">
          <label className="form-label">API 端点</label>
          <input 
            type="text"
            className="form-input"
            value={apiConfig.endpoint}
            onChange={(e) => setApiConfig({ ...apiConfig, endpoint: e.target.value })}
          />
        </div>
        
        <div className="form-group">
          <label className="form-label">DeepSeek API 密钥</label>
          <input 
            type="password"
            className="form-input"
            value={apiConfig.deepseekKey}
            onChange={(e) => setApiConfig({ ...apiConfig, deepseekKey: e.target.value })}
            placeholder="sk-xxxxxxxx"
          />
          <div className="form-hint">用于 Grok 智能分析引擎</div>
        </div>
        
        <button className="btn btn-primary">保存配置</button>
      </section>
      
      {/* LLM 智能分析配置 */}
      <section className="settings-section">
        <h2 className="section-title">LLM 智能分析</h2>
        
        <div className="mode-selector">
          <button 
            className={`mode-btn ${llmConfig.mode === 'builtin' ? 'active' : ''}`}
            onClick={() => setLLMConfig({ ...llmConfig, mode: 'builtin' })}
          >
            <div className="mode-icon">📦</div>
            <div className="mode-name">内置模型</div>
            <div className="mode-desc">开箱即用，无需配置</div>
          </button>
          
          <button 
            className={`mode-btn ${llmConfig.mode === 'custom' ? 'active' : ''}`}
            onClick={() => setLLMConfig({ ...llmConfig, mode: 'custom' })}
          >
            <div className="mode-icon">🔑</div>
            <div className="mode-name">自定义模型</div>
            <div className="mode-desc">使用自己的 API Key</div>
          </button>
          
          <button 
            className={`mode-btn ${llmConfig.mode === 'local' ? 'active' : ''}`}
            onClick={() => setLLMConfig({ ...llmConfig, mode: 'local' })}
          >
            <div className="mode-icon">💻</div>
            <div className="mode-name">本地模型</div>
            <div className="mode-desc">完全本地，隐私优先</div>
          </button>
        </div>
        
        {llmConfig.mode === 'builtin' && (
          <div className="config-panel">
            <div className="info-box">
              <span className="info-icon">✓</span>
              <span className="info-text">使用一鉴到底内置的 DeepSeek 模型，无需配置即可使用。</span>
            </div>
            <div className="feature-list">
              <div className="feature-item">✓ 智能风险分析</div>
              <div className="feature-item">✓ 代码安全检测</div>
              <div className="feature-item">✓ 风险解释说明</div>
            </div>
          </div>
        )}
        
        {llmConfig.mode === 'custom' && (
          <div className="config-panel">
            <div className="form-group">
              <label className="form-label">模型提供商</label>
              <select 
                className="form-select"
                value={llmConfig.provider}
                onChange={(e) => setLLMConfig({ ...llmConfig, provider: e.target.value })}
              >
                <option value="deepseek">DeepSeek</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="qwen">阿里云通义千问</option>
                <option value="moonshot">Moonshot (Kimi)</option>
                <option value="zhipu">智谱 AI</option>
              </select>
            </div>
            
            <div className="form-group">
              <label className="form-label">API Key</label>
              <input 
                type="password"
                className="form-input"
                value={llmConfig.apiKey}
                onChange={(e) => setLLMConfig({ ...llmConfig, apiKey: e.target.value })}
                placeholder="输入您的 API Key"
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">模型</label>
              <select 
                className="form-select"
                value={llmConfig.model}
                onChange={(e) => setLLMConfig({ ...llmConfig, model: e.target.value })}
              >
                {llmConfig.provider === 'deepseek' && (
                  <>
                    <option value="deepseek-chat">DeepSeek Chat</option>
                    <option value="deepseek-coder">DeepSeek Coder</option>
                  </>
                )}
                {llmConfig.provider === 'openai' && (
                  <>
                    <option value="gpt-4">GPT-4</option>
                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  </>
                )}
              </select>
            </div>
            
            <div className="form-group">
              <label className="form-label">API Base URL（可选）</label>
              <input 
                type="text"
                className="form-input"
                value={llmConfig.apiBase}
                onChange={(e) => setLLMConfig({ ...llmConfig, apiBase: e.target.value })}
                placeholder="自定义 API 端点"
              />
              <div className="form-hint">留空使用默认端点</div>
            </div>
          </div>
        )}
        
        {llmConfig.mode === 'local' && (
          <div className="config-panel">
            <div className="info-box warning">
              <span className="info-icon">⚠️</span>
              <span className="info-text">需要先安装并启动 Ollama 本地模型服务</span>
            </div>
            
            <div className="form-group">
              <label className="form-label">本地模型</label>
              <select 
                className="form-select"
                value={llmConfig.model}
                onChange={(e) => setLLMConfig({ ...llmConfig, model: e.target.value })}
              >
                <option value="deepseek-coder:6.7b">DeepSeek Coder 6.7B</option>
                <option value="deepseek-coder:1.3b">DeepSeek Coder 1.3B</option>
                <option value="codellama:7b">Code Llama 7B</option>
                <option value="mistral:7b">Mistral 7B</option>
              </select>
            </div>
            
            <div className="feature-list">
              <div className="feature-item">✓ 完全本地运行，数据不上网</div>
              <div className="feature-item">✓ 隐私保护最大化</div>
              <div className="feature-item">⚠️ 需要足够的本地算力</div>
            </div>
            
            <button className="btn btn-secondary" style={{ marginTop: 16 }}>
              检查 Ollama 状态
            </button>
          </div>
        )}
        
        <button className="btn btn-primary" style={{ marginTop: 16 }}>
          保存 LLM 配置
        </button>
      </section>
      
      {/* 数据管理 */}
      <section className="settings-section">
        <h2 className="section-title">数据管理</h2>

        <div className="info-row">
          <span className="info-label">本地存储路径</span>
          <code className="info-value">
            C:\Users\用户名\AppData\Roaming\一鉴到底\data
          </code>
        </div>

        <p className="info-text">
          所有审计数据存储在本地，不上传云端
        </p>

        <div className="button-group">
          <button className="btn btn-secondary">备份数据</button>
          <button className="btn btn-secondary">清除日志</button>
        </div>
      </section>
      
      {/* 法律声明 */}
      <section className="settings-section warning-section">
        <h2 className="section-title" style={{ color: '#F85149' }}>免责声明</h2>
        <p className="warning-text">
          本工具旨在提供辅助性的 AI 行为分析与存证服务。所有分析报告仅供参考，
          不构成最终安全结论。用户应自行判断并承担所有操作决定所带来的风险与责任。
        </p>
        <div className="button-group">
          <button className="btn btn-secondary btn-sm">查看用户协议</button>
          <button className="btn btn-secondary btn-sm">查看隐私政策</button>
        </div>
      </section>
    </div>
  )
}