import { useState, useEffect, useRef } from 'react'
import { authService } from '../services/authService'
import { apiKeyService, UserKeyStatus, type QuotaAlertConfig } from '../services/apiKeyService'
import { StrategicMemoryApi, StrategicMemory } from '../services/memoryApi'
import { themeService } from '../services/themeService'
import { pushThemeToProfile } from '../services/profileService'
import {
  THEME_NAMES,
  THEME_LABELS,
  COLOR_PRESETS,
  GRADIENT_PRESETS,
  TEXTURE_PRESETS,
  type ThemeName,
  type CustomBg,
  type CustomBgType,
} from '../styles/themes'
import PermissionList from '../components/PermissionList'
import { openInBrowser, OFFICIAL_SITE_ENTRIES } from '../services/openInBrowser'
import type { PluginInfo, PluginHookHealth, PluginStatsData, PetStatsData, MarketPlugin } from '../types/electron'
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

// 桌宠物种中文映射
const PET_SPECIES_LABELS: Record<string, string> = {
  guardian: '守护者',
  fox: '灵狐',
  owl: '夜枭',
  dragon: '盘龙',
  cat: '灵猫',
}

// 桌宠稀有度中文映射
const PET_RARITY_LABELS: Record<string, string> = {
  common: '普通',
  uncommon: '精良',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说',
}

// 桌宠属性中文映射（附说明，语义绑定治理能力）
const PET_STAT_LABELS: Record<string, string> = {
  VIGILANCE: '警觉',
  WISDOM: '智慧',
  PATIENCE: '耐心',
  EXECUTION: '执行',
  CHAOS: '混沌',
}

// 桌宠属性配色
const PET_STAT_COLORS: Record<string, string> = {
  VIGILANCE: '#58D68D',
  WISDOM: '#5DADE2',
  PATIENCE: '#F7DC6F',
  EXECUTION: '#AF7AC5',
  CHAOS: '#F1948A',
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

  // 检查更新状态：idle | checking | available | up-to-date | downloaded | error
  const [updateState, setUpdateState] = useState<'idle' | 'checking' | 'available' | 'up-to-date' | 'downloaded' | 'error'>('idle')
  const [updateMsg, setUpdateMsg] = useState('')

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

  // 插件市场（M3 插件源打通：浏览 / 安装 / 卸载 / 目录扫描）
  const [marketPlugins, setMarketPlugins] = useState<MarketPlugin[]>([])
  const [marketDir, setMarketDir] = useState('')
  const [marketLoading, setMarketLoading] = useState(false)
  const [marketMsg, setMarketMsg] = useState<string | null>(null)
  const [marketAction, setMarketAction] = useState<string | null>(null)

  // 治理桌宠（角色 + 属性面板）
  const [petStats, setPetStats] = useState<PetStatsData | null>(null)
  const [petStatsLoading, setPetStatsLoading] = useState(false)

  // 用户自有 API 密钥（P1 消费控制：自带 Key 免平台配额）
  const [userKeyStatus, setUserKeyStatus] = useState<UserKeyStatus | null>(null)
  const [newUserKey, setNewUserKey] = useState('')
  const [userKeySaving, setUserKeySaving] = useState(false)
  const [userKeyMsg, setUserKeyMsg] = useState<string | null>(null)

  // 消费额度预警配置（P1 消费控制：开关 / 阈值 / 通知方式）
  const [quotaAlert, setQuotaAlert] = useState<QuotaAlertConfig | null>(null)
  const [quotaAlertSaving, setQuotaAlertSaving] = useState(false)
  const [quotaAlertMsg, setQuotaAlertMsg] = useState<string | null>(null)
  // P1 账号互通：官网跳转
  const [webJumping, setWebJumping] = useState<string | null>(null)
  const [webJumpMsg, setWebJumpMsg] = useState<string | null>(null)

  // 外观（P1 界面定制：主题切换 + 自定义背景）
  const [theme, setTheme] = useState<ThemeName>(() => themeService.getTheme())
  const [customBg, setCustomBg] = useState<CustomBg>(() => themeService.getCustomBg())
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    loadMarketPlugins()
    loadPetStats()
    loadUserKeyStatus()
    loadQuotaAlertConfig()
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

  // 订阅自动更新事件（主进程推送给渲染进程）
  useEffect(() => {
    const electron = window.electronAPI
    if (!electron?.onUpdateEvent) return
    const off = electron.onUpdateEvent((type: string, payload?: any) => {
      if (type === 'updater:checking') {
        setUpdateState('checking')
        setUpdateMsg('正在检查更新...')
      } else if (type === 'updater:available') {
        setUpdateState('available')
        setUpdateMsg(payload?.version ? `发现新版本 v${payload.version}，正在后台下载...` : '发现新版本，正在后台下载...')
      } else if (type === 'updater:not-available') {
        setUpdateState('up-to-date')
        setUpdateMsg('已是最新版本')
      } else if (type === 'updater:downloaded') {
        setUpdateState('downloaded')
        setUpdateMsg(payload?.version ? `新版本 v${payload.version} 已下载完成，可在官方入口处重启安装` : '新版本已下载完成')
      } else if (type === 'updater:error') {
        setUpdateState('error')
        setUpdateMsg(payload?.message || '检查更新失败')
      }
    })
    return off
  }, [])

  // 手动触发检查更新
  const handleCheckUpdate = async () => {
    const electron = window.electronAPI
    if (!electron?.checkForUpdates) {
      setUpdateState('error')
      setUpdateMsg('当前为开发环境，自动更新不可用')
      return
    }
    setUpdateState('checking')
    setUpdateMsg('正在检查更新...')
    try {
      const res = await electron.checkForUpdates()
      if (res && res.success === false) {
        setUpdateState('error')
        setUpdateMsg(res.error || '检查更新失败')
      }
    } catch (e: any) {
      setUpdateState('error')
      setUpdateMsg(e?.message || '检查更新失败')
    }
  }
  
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

  // 插件市场（M3）：浏览市场目录插件
  const loadMarketPlugins = async () => {
    setMarketLoading(true)
    try {
      const api = (window as any).electronAPI
      if (!api?.listMarketPlugins) return
      const res = await api.listMarketPlugins()
      if (res?.success) {
        setMarketPlugins(res.data.plugins || [])
        setMarketDir(res.data.marketDir || '')
      }
    } catch (error: any) {
      console.error('[Settings] 加载插件市场失败:', error)
    } finally {
      setMarketLoading(false)
    }
  }

  // 插件市场（M3）：扫描插件目录并注册（"放入插件目录的插件可被识别并启用"）
  const handleScanInstalled = async () => {
    setMarketMsg(null)
    setMarketAction('scan')
    try {
      const api = (window as any).electronAPI
      if (!api?.scanInstalledPlugins) {
        setMarketMsg('当前环境不支持该操作')
        return
      }
      const res = await api.scanInstalledPlugins()
      if (res?.success) {
        setMarketMsg(`已扫描插件目录，识别 ${res.data.plugins.length} 个插件，新加载 ${(res.data.loaded || []).length} 个`)
      } else {
        setMarketMsg(res?.error || '扫描失败')
      }
      await Promise.all([loadPlugins(), loadMarketPlugins()])
    } catch (error: any) {
      setMarketMsg(error?.message || '扫描失败')
    } finally {
      setMarketAction(null)
    }
  }

  // 插件市场（M3）：从市场安装插件
  const handleInstallMarket = async (pkgId: string) => {
    setMarketMsg(null)
    setMarketAction(pkgId)
    try {
      const api = (window as any).electronAPI
      if (!api?.installMarketPlugin) {
        setMarketMsg('当前环境不支持该操作')
        return
      }
      const res = await api.installMarketPlugin(pkgId)
      if (res?.success) {
        setMarketMsg(`插件「${res.data.name || pkgId}」安装成功`)
      } else {
        setMarketMsg(res?.error || '安装失败')
      }
      await Promise.all([loadPlugins(), loadMarketPlugins()])
    } catch (error: any) {
      setMarketMsg(error?.message || '安装失败')
    } finally {
      setMarketAction(null)
    }
  }

  // 插件市场（M3）：卸载插件（目录删除 + 从注册表移除）
  const handleUninstallMarket = async (pkgId: string) => {
    setMarketMsg(null)
    setMarketAction(pkgId)
    try {
      const api = (window as any).electronAPI
      if (!api?.uninstallPlugin) {
        setMarketMsg('当前环境不支持该操作')
        return
      }
      const res = await api.uninstallPlugin(pkgId)
      if (res?.success) {
        setMarketMsg(`插件「${pkgId}」已卸载`)
      } else {
        setMarketMsg(res?.error || '卸载失败')
      }
      await Promise.all([loadPlugins(), loadMarketPlugins()])
    } catch (error: any) {
      setMarketMsg(error?.message || '卸载失败')
    } finally {
      setMarketAction(null)
    }
  }

  // 治理桌宠：加载角色 + 治理画像（get-pet-stats 通道）
  const loadPetStats = async () => {
    setPetStatsLoading(true)
    try {
      const api = (window as any).electronAPI
      if (!api?.getPetStats) return
      const res = await api.getPetStats()
      if (res?.success && res.data) setPetStats(res.data)
    } catch (error: any) {
      console.error('[Settings] 加载治理桌宠角色失败:', error)
    } finally {
      setPetStatsLoading(false)
    }
  }

  // 用户自有 API Key：加载状态（掩码 + 余额 + 今日用量）
  const loadUserKeyStatus = async () => {
    try {
      const st = await apiKeyService.getStatus()
      setUserKeyStatus(st)
    } catch (error: any) {
      console.error('[Settings] 加载 API Key 状态失败:', error)
      setUserKeyStatus(null)
    }
  }

  // 用户自有 API Key：保存（提交后自动验证，验证通过才存储）
  const handleSaveUserKey = async () => {
    const key = newUserKey.trim()
    if (!key) {
      setUserKeyMsg('请输入 API Key')
      return
    }
    setUserKeySaving(true)
    setUserKeyMsg(null)
    try {
      await apiKeyService.setKey(key)
      setUserKeyMsg('API Key 已保存并通过验证，后续调用优先使用自有 Key，不消耗平台共享额度')
      setNewUserKey('')
      await loadUserKeyStatus()
    } catch (error: any) {
      setUserKeyMsg(error?.message || '保存 API Key 失败')
    } finally {
      setUserKeySaving(false)
    }
  }

  // 用户自有 API Key：删除（回退到平台共享额度）
  const handleDeleteUserKey = async () => {
    setUserKeySaving(true)
    setUserKeyMsg(null)
    try {
      await apiKeyService.deleteKey()
      setUserKeyMsg('已删除自有 Key，将回退到平台共享额度')
      await loadUserKeyStatus()
    } catch (error: any) {
      setUserKeyMsg(error?.message || '删除 API Key 失败')
    } finally {
      setUserKeySaving(false)
    }
  }

  // 消费额度预警：加载配置（开关 / 阈值 / 通知方式）
  const loadQuotaAlertConfig = async () => {
    try {
      const cfg = await apiKeyService.getQuotaAlertConfig()
      setQuotaAlert(cfg)
    } catch (error: any) {
      console.error('[Settings] 加载消费预警配置失败:', error)
      setQuotaAlert(null)
    }
  }

  // 消费额度预警：切换通知方式（多选）
  const toggleQuotaAlertNotify = (item: string) => {
    setQuotaAlert((prev) => {
      if (!prev) return prev
      const has = prev.notify.includes(item)
      return {
        ...prev,
        notify: has ? prev.notify.filter((n) => n !== item) : [...prev.notify, item],
      }
    })
  }

  // 消费额度预警：保存配置
  const handleSaveQuotaAlert = async () => {
    if (!quotaAlert) return
    setQuotaAlertSaving(true)
    setQuotaAlertMsg(null)
    try {
      const saved = await apiKeyService.saveQuotaAlertConfig({
        enabled: quotaAlert.enabled,
        warn_threshold: Number(quotaAlert.warn_threshold),
        critical_threshold: Number(quotaAlert.critical_threshold),
        notify: quotaAlert.notify,
      })
      setQuotaAlert(saved)
      setQuotaAlertMsg('消费预警配置已保存，顶部额度条与通知推送将按新配置生效')
    } catch (error: any) {
      setQuotaAlertMsg(error?.message || '保存消费预警配置失败')
    } finally {
      setQuotaAlertSaving(false)
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

  // 外观：切换预设主题（立即生效并持久化）
  const handleThemeChange = (t: ThemeName) => {
    setTheme(t)
    themeService.setTheme(t)
    // P1-4 个性化数据跨端持久化：主题同步到后端
    pushThemeToProfile().catch(() => {
      // 同步失败静默，本地已生效
    })
  }

  // 外观：设置自定义背景（立即生效并持久化）
  const handleSetBg = (bg: CustomBg) => {
    setCustomBg(bg)
    themeService.setCustomBg(bg)
    // P1-4 个性化数据跨端持久化：背景同步到后端
    pushThemeToProfile().catch(() => {
      // 同步失败静默，本地已生效
    })
  }

  // 外观：上传背景图片（转 dataURL 持久化到 localStorage）
  const handleBgImage = (file: File | undefined) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        handleSetBg({ type: 'image', value: reader.result })
      }
    }
    reader.readAsDataURL(file)
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

      {/* 外观（P1 界面定制：主题切换 + 自定义背景） */}
      <section className="settings-section">
        <h2 className="section-title">外观</h2>

        {/* 主题切换 */}
        <div style={{ marginBottom: 20 }}>
          <label className="form-label">主题</label>
          <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
            {THEME_NAMES.map((t) => (
              <button
                key={t}
                className="btn"
                onClick={() => handleThemeChange(t)}
                style={
                  t === theme
                    ? { background: 'var(--brand-primary)', color: '#fff', borderColor: 'var(--brand-primary)' }
                    : undefined
                }
              >
                {THEME_LABELS[t]}
              </button>
            ))}
          </div>
          <div className="form-hint" style={{ marginTop: 6 }}>主题即时生效并自动保存，下次启动自动恢复。</div>
        </div>

        {/* 自定义背景 */}
        <div>
          <label className="form-label">自定义背景</label>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {(['none', 'image', 'color', 'gradient', 'texture'] as CustomBgType[]).map((ty) => (
              <button
                key={ty}
                className="btn btn-secondary"
                onClick={() => {
                  if (ty === 'image') {
                    fileInputRef.current?.click()
                  } else if (ty === 'none') {
                    handleSetBg({ type: 'none', value: '' })
                  } else if (ty === 'color') {
                    handleSetBg({ type: 'color', value: COLOR_PRESETS[0] })
                  } else if (ty === 'gradient') {
                    handleSetBg({ type: 'gradient', value: GRADIENT_PRESETS[0].css })
                  } else {
                    handleSetBg({ type: 'texture', value: TEXTURE_PRESETS[0].key })
                  }
                }}
                style={
                  customBg.type === ty
                    ? { background: 'var(--brand-primary)', color: '#fff', borderColor: 'var(--brand-primary)' }
                    : undefined
                }
              >
                {ty === 'none' ? '无' : ty === 'image' ? '图片' : ty === 'color' ? '纯色' : ty === 'gradient' ? '渐变' : '纹理'}
              </button>
            ))}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => handleBgImage(e.target.files?.[0])}
            />
          </div>

          {/* 纯色预设 */}
          {customBg.type === 'color' && (
            <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              {COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  onClick={() => handleSetBg({ type: 'color', value: c })}
                  title={c}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: c,
                    border:
                      customBg.value === c
                        ? '2px solid var(--brand-primary)'
                        : '1px solid var(--border-primary)',
                  }}
                />
              ))}
            </div>
          )}

          {/* 渐变预设 */}
          {customBg.type === 'gradient' && (
            <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              {GRADIENT_PRESETS.map((g) => (
                <button
                  key={g.name}
                  onClick={() => handleSetBg({ type: 'gradient', value: g.css })}
                  title={g.name}
                  style={{
                    width: 64,
                    height: 40,
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: g.css,
                    border:
                      customBg.value === g.css
                        ? '2px solid var(--brand-primary)'
                        : '1px solid var(--border-primary)',
                  }}
                />
              ))}
            </div>
          )}

          {/* 纹理预设 */}
          {customBg.type === 'texture' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              {TEXTURE_PRESETS.map((t) => (
                <button
                  key={t.key}
                  className="btn btn-secondary"
                  onClick={() => handleSetBg({ type: 'texture', value: t.key })}
                  style={
                    customBg.value === t.key
                      ? { background: 'var(--brand-primary)', color: '#fff', borderColor: 'var(--brand-primary)' }
                      : undefined
                  }
                >
                  {t.name}
                </button>
              ))}
            </div>
          )}

          {/* 图片预览 */}
          {customBg.type === 'image' && customBg.value && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>当前背景</div>
              <img
                src={customBg.value}
                alt="背景预览"
                style={{
                  width: 240,
                  height: 120,
                  objectFit: 'cover',
                  borderRadius: 8,
                  border: '1px solid var(--border-primary)',
                }}
              />
            </div>
          )}

          <div className="form-hint" style={{ marginTop: 8 }}>
            背景显示在内容区底层，侧边栏与卡片保持原配色；图片仅保存在本机 localStorage。
          </div>
        </div>
      </section>

      {/* API 密钥（P1 消费控制：自带 Key 免平台配额） */}
      <section className="settings-section">
        <div className="section-header">
          <h2 className="section-title">API 密钥</h2>
          <span className={`status-badge ${userKeyStatus?.hasKey ? 'running' : 'stopped'}`}>
            {userKeyStatus?.hasKey ? '已绑定自有 Key' : '使用平台共享额度'}
          </span>
        </div>

        <p className="info-text" style={{ marginBottom: 12 }}>
          填写你自己的 DeepSeek API Key 后，分析调用将优先使用自有 Key，不消耗平台共享额度。
          密钥经加密存储，任何接口均不回显明文。
        </p>

        {userKeyStatus?.hasKey && (
          <div className="form-group">
            <label className="form-label">当前已绑定的 Key</label>
            <div style={{
              padding: '10px 12px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}>
              <strong style={{ fontFamily: 'monospace' }}>{userKeyStatus.masked}</strong>
              {userKeyStatus.balance && (
                <span className="tag tag-success">余额 {userKeyStatus.balance}</span>
              )}
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                今日调用 {userKeyStatus.todayUsed} 次
              </span>
              {userKeyStatus.lastVerifiedOk ? (
                <span className="tag tag-success">已验证</span>
              ) : (
                <span className="tag tag-warning">待验证</span>
              )}
              {userKeyStatus.name && (
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{userKeyStatus.name}</span>
              )}
            </div>
            <div className="form-hint">
              {userKeyStatus.lastVerifiedAt
                ? `最近验证：${new Date(userKeyStatus.lastVerifiedAt).toLocaleString()}`
                : '保存时已自动验证密钥有效性'}
            </div>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">填入 / 更换 API Key</label>
          <input
            type="password"
            className="form-input"
            value={newUserKey}
            onChange={(e) => setNewUserKey(e.target.value)}
            placeholder="sk-xxxxxxxx"
            autoComplete="off"
            spellCheck={false}
          />
          <div className="form-hint">
            保存前会调用 DeepSeek 官方余额接口验证；验证失败（余额为零 / 过期 / 密钥错误）将拒绝保存。
          </div>
        </div>

        {userKeyMsg && (
          <div
            className={userKeyMsg.includes('失败') || userKeyMsg.includes('无效') || userKeyMsg.includes('请输入') ? 'notice-error' : 'notice-info'}
            style={{ padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 13 }}
          >
            {userKeyMsg}
          </div>
        )}

        <div className="button-group">
          <button
            className="btn btn-primary"
            onClick={handleSaveUserKey}
            disabled={userKeySaving || !newUserKey.trim()}
          >
            {userKeySaving ? '验证并保存中...' : '验证并保存'}
          </button>
          {userKeyStatus?.hasKey && (
            <button
              className="btn btn-secondary"
              onClick={handleDeleteUserKey}
              disabled={userKeySaving}
            >
              删除自有 Key
            </button>
          )}
        </div>
      </section>

      {/* 消费预警（P1 消费控制：开关 / 阈值 / 通知方式） */}
      <section className="settings-section">
        <div className="section-header">
          <h2 className="section-title">消费预警</h2>
          <span className={`status-badge ${quotaAlert?.enabled ? 'running' : 'stopped'}`}>
            {quotaAlert?.enabled ? '预警已开启' : '预警已关闭'}
          </span>
        </div>

        <p className="info-text" style={{ marginBottom: 12 }}>
          平台共享额度使用率达到阈值时，顶部额度条变色并在升级瞬间推送预警（桌面弹窗 / 声音 / 邮件）。
          关闭开关后不再推送。
        </p>

        {quotaAlert && (
          <>
            <div className="form-group">
              <label className="form-label">预警开关</label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={quotaAlert.enabled}
                  onChange={(e) => setQuotaAlert({ ...quotaAlert, enabled: e.target.checked })}
                />
                <span style={{ fontSize: 13 }}>启用消费额度预警推送</span>
              </label>
            </div>

            <div className="form-group" style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <label className="form-label">预警阈值（%）</label>
                <input
                  type="number"
                  className="form-input"
                  min={1}
                  max={99}
                  value={quotaAlert.warn_threshold}
                  onChange={(e) =>
                    setQuotaAlert({ ...quotaAlert, warn_threshold: Number(e.target.value) })
                  }
                />
                <div className="form-hint">达到该使用率时额度条变黄并推送预警。</div>
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <label className="form-label">临界阈值（%）</label>
                <input
                  type="number"
                  className="form-input"
                  min={1}
                  max={100}
                  value={quotaAlert.critical_threshold}
                  onChange={(e) =>
                    setQuotaAlert({ ...quotaAlert, critical_threshold: Number(e.target.value) })
                  }
                />
                <div className="form-hint">达到该使用率时额度条变红并推送临界告警。</div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">通知方式</label>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {[
                  { key: 'desktop', label: '桌面弹窗' },
                  { key: 'sound', label: '声音提示' },
                  { key: 'email', label: '邮件' },
                ].map((item) => (
                  <label
                    key={item.key}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                  >
                    <input
                      type="checkbox"
                      checked={quotaAlert.notify.includes(item.key)}
                      onChange={() => toggleQuotaAlertNotify(item.key)}
                    />
                    <span style={{ fontSize: 13 }}>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {quotaAlertMsg && (
              <div
                className={quotaAlertMsg.includes('失败') ? 'notice-error' : 'notice-info'}
                style={{ padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 13 }}
              >
                {quotaAlertMsg}
              </div>
            )}

            <div className="button-group">
              <button
                className="btn btn-primary"
                onClick={handleSaveQuotaAlert}
                disabled={quotaAlertSaving}
              >
                {quotaAlertSaving ? '保存中...' : '保存预警配置'}
              </button>
            </div>
          </>
        )}

        {!quotaAlert && (
          <div className="notice-warn" style={{ padding: 10, borderRadius: 6, fontSize: 13 }}>
            无法加载消费预警配置，请确认后端服务与登录状态。
          </div>
        )}
      </section>

      {/* 官网入口（P1 账号互通一期：桌面端→官网跳转 + 登录态同步） */}
      <section className="settings-section">
        <div className="section-header">
          <h2 className="section-title">官网入口</h2>
          <span className="status-badge running">账号互通</span>
        </div>

        <p className="info-text" style={{ marginBottom: 12 }}>
          从桌面端直达官网对应页面。已登录时自动携带一次性临时 token（5 分钟、用后即销毁），
          打开官网后免登录；未登录则直接打开官网。
        </p>

        <div className="official-entry-grid">
          {OFFICIAL_SITE_ENTRIES.map((entry) => (
            <button
              key={entry.key}
              className="official-entry-card"
              disabled={webJumping === entry.key}
              onClick={async () => {
                setWebJumpMsg(null)
                setWebJumping(entry.key)
                const res = await openInBrowser(entry.path, true)
                setWebJumping(null)
                if (!res.success) {
                  setWebJumpMsg(`打开「${entry.label}」失败：${res.error || '未知错误'}`)
                }
              }}
            >
              <div className="official-entry-label">
                {webJumping === entry.key ? '打开中...' : entry.label}
              </div>
              <div className="official-entry-desc">{entry.desc}</div>
            </button>
          ))}
        </div>

        {webJumpMsg && (
          <div className="notice-error" style={{ padding: 10, borderRadius: 6, marginTop: 12, fontSize: 13 }}>
            {webJumpMsg}
          </div>
        )}
      </section>

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
          <div
            className="notice-warn"
            style={{ padding: 12, borderRadius: 6, marginBottom: 16, fontSize: 13 }}
          >
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
          <div
            className={apiMonMsg.includes('无效') || apiMonMsg.includes('失败') ? 'notice-error' : 'notice-info'}
            style={{ padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 13 }}
          >
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
          <div
            className={govLogMsg.includes('失败') ? 'notice-error' : 'notice-info'}
            style={{ padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 13 }}
          >
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

      {/* 治理桌宠：角色 + 属性面板（get-pet-stats 通道） */}
      <section className="settings-section">
        <div className="section-header">
          <h2 className="section-title">治理桌宠</h2>
          <span className={`status-badge ${petStats ? 'running' : 'stopped'}`}>
            {petStatsLoading ? '加载中' : petStats ? `已孵化 ${petStats.character.name}` : '未初始化'}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={loadPetStats}
            disabled={petStatsLoading}
            aria-label="刷新桌宠"
          >
            {petStatsLoading ? '加载中...' : '刷新'}
          </button>
        </div>

        <p className="info-text" style={{ marginBottom: 12 }}>
          治理桌宠是 Agent 执行 / 安全告警 / AI 治理定级的人格化呈现。角色由本机指纹确定性生成，
          属性（警觉/智慧/耐心/执行/混沌）绑定真实治理数据，治理表现越好角色越「成长」。
        </p>

        {petStats && (
          <div style={{
            padding: 12,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 8,
          }}>
            {/* 角色头部 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                fontWeight: 'bold',
                color: '#fff',
                flexShrink: 0,
              }}>
                {petStats.character.name.charAt(0)}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong style={{ fontSize: 16 }}>{petStats.character.name}</strong>
                  <span style={{ color: '#D4AF37', fontSize: 13 }}>{petStats.character.rarityStars}</span>
                  <span className={`tag tag-${petStats.character.rarity === 'legendary' ? 'error' : petStats.character.rarity === 'epic' || petStats.character.rarity === 'rare' ? 'warning' : 'success'}`}>
                    {PET_RARITY_LABELS[petStats.character.rarity] || petStats.character.rarity}
                  </span>
                  {petStats.character.shiny && (
                    <span className="tag tag-warning">✨ 闪光</span>
                  )}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                  {PET_SPECIES_LABELS[petStats.character.species] || petStats.character.species}
                </div>
              </div>
            </div>

            {/* 属性面板 */}
            <div style={{ fontSize: 12, marginBottom: 12 }}>
              {Object.entries(petStats.character.stats || {}).map(([key, value]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ width: 48, color: 'var(--text-secondary)', flexShrink: 0 }}>
                    {PET_STAT_LABELS[key] || key}
                  </span>
                  <div style={{
                    flex: 1,
                    height: 8,
                    borderRadius: 4,
                    background: 'var(--bg-input, rgba(128,128,128,0.15))',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${Math.min(100, Math.max(0, value))}%`,
                      height: '100%',
                      borderRadius: 4,
                      background: PET_STAT_COLORS[key] || '#58D68D',
                      transition: 'width 0.4s ease',
                    }} />
                  </div>
                  <span style={{ width: 32, textAlign: 'right', fontWeight: 600 }}>{value}</span>
                </div>
              ))}
            </div>

            {/* 治理画像快照 */}
            <div style={{
              borderTop: '1px solid var(--border)',
              paddingTop: 10,
              fontSize: 12,
              color: 'var(--text-secondary)',
            }}>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
                治理画像（属性绑定来源）
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {[
                  ['治理轮次', petStats.profile.runs],
                  ['成功动作', petStats.profile.succeeded],
                  ['失败动作', petStats.profile.failed],
                  ['告警', petStats.profile.alerts],
                  ['工具调用', petStats.profile.tools],
                  ['权限拒绝', petStats.profile.denied],
                  ['四官复核', petStats.profile.verifyFlows],
                ].map(([label, value]) => (
                  <span key={label as string} style={{
                    padding: '2px 8px',
                    background: 'var(--bg-input, rgba(128,128,128,0.15))',
                    borderRadius: 4,
                  }}>
                    {label} <strong style={{ color: 'var(--text-primary)' }}>{value}</strong>
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {!petStats && !petStatsLoading && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
            暂无桌宠数据
          </div>
        )}
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
          <div
            className={pluginMsg.includes('失败') || pluginMsg.includes('不存在') ? 'notice-error' : 'notice-info'}
            style={{ padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 13 }}
          >
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
                <div className="notice-error" style={{ padding: 8, borderRadius: 6, marginBottom: 8, fontSize: 12 }}>
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
                <div className="notice-error" style={{ padding: 8, borderRadius: 6, marginBottom: 8, fontSize: 12 }}>
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

      {/* 插件市场（M3 插件源打通） */}
      <section className="settings-section">
        <div className="section-header">
          <h2 className="section-title">插件市场</h2>
          <span className={`status-badge ${marketPlugins.length > 0 ? 'running' : 'stopped'}`}>
            {marketLoading ? '加载中' : `市场 ${marketPlugins.length} 个`}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={loadMarketPlugins}
            disabled={marketLoading}
          >
            {marketLoading ? '加载中...' : '刷新市场'}
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleScanInstalled}
            disabled={marketAction === 'scan'}
          >
            {marketAction === 'scan' ? '扫描中...' : '扫描插件目录'}
          </button>
        </div>

        <p className="info-text" style={{ marginBottom: 12 }}>
          支持从插件目录加载社区插件（openclaw.plugin.json 清单 → 治理插件）。
          市场插件放入 <code style={{ color: 'var(--text-secondary)' }}>{marketDir || 'plugins-market'}</code> 后即可浏览安装；
          直接放入插件目录的插件经「扫描插件目录」识别后即可启用。
        </p>

        {marketMsg && (
          <div
            className={marketMsg.includes('失败') || marketMsg.includes('不存在') || marketMsg.includes('不支持') ? 'notice-error' : 'notice-info'}
            style={{ padding: 10, borderRadius: 6, marginBottom: 12, fontSize: 13 }}
          >
            {marketMsg}
          </div>
        )}

        {marketPlugins.length === 0 && !marketLoading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
            市场目录暂无插件，请将插件包放入市场目录后点击「刷新市场」
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {marketPlugins.map((mp) => {
              const installed = plugins.some((p) => p.id === mp.id)
              const busy = marketAction === mp.id
              return (
                <div key={mp.id} className="strategy-card">
                  <div className="strategy-header">
                    <div>
                      <div className="strategy-name">{mp.name || mp.id}</div>
                      <div className="strategy-meta">
                        {mp.version && <span className="strategy-version">v{mp.version}</span>}
                        {mp.author && <span className="strategy-type">作者 {mp.author}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className={`status-badge ${installed ? 'running' : 'stopped'}`}>
                        {installed ? '已安装' : '未安装'}
                      </span>
                      {installed ? (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleUninstallMarket(mp.id)}
                          disabled={busy}
                        >
                          {busy ? '处理中...' : '卸载'}
                        </button>
                      ) : (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleInstallMarket(mp.id)}
                          disabled={busy}
                        >
                          {busy ? '安装中...' : '安装'}
                        </button>
                      )}
                    </div>
                  </div>
                  {mp.description && (
                    <div className="form-hint" style={{ marginBottom: 0 }}>{mp.description}</div>
                  )}
                </div>
              )
            })}
          </div>
        )}
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
              <div
                className={permissionMsg.includes('失败') ? 'notice-error' : 'notice-info'}
                style={{ padding: 10, borderRadius: 6, marginBottom: 12, marginTop: 12, fontSize: 13 }}
              >
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
      
      {/* 检查更新 */}
      <section className="settings-section">
        <h2 className="section-title">检查更新</h2>
        <div className="info-row">
          <span className="info-label">当前版本</span>
          <code className="info-value">v2.0.0</code>
        </div>
        <p className="info-text" style={{
          marginBottom: 0,
          minHeight: 20,
          color: updateState === 'error' ? '#F85149' : updateState === 'downloaded' ? '#3FB950' : 'var(--text-secondary)'
        }}>
          {updateState === 'idle'
            ? '检查是否有新版本可用，新版本会在后台下载后提示重启安装'
            : updateMsg || ''}
        </p>
        <div className="button-group" style={{ marginTop: 12 }}>
          <button
            className="btn btn-primary"
            onClick={handleCheckUpdate}
            disabled={updateState === 'checking'}
          >
            {updateState === 'checking' ? '检查中...' : '检查更新'}
          </button>
          {updateState === 'downloaded' && (
            <button
              className="btn btn-secondary"
              onClick={() => window.electronAPI?.quitAndInstallUpdate()}
            >
              立即重启安装
            </button>
          )}
        </div>
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