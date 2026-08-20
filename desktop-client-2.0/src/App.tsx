import { BrowserRouter, Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'
import Dashboard from './pages/Dashboard'
import Evidence from './pages/Evidence'
import Auth from './pages/Auth'
import RealNameAuth from './pages/RealNameAuth'
import Settings from './pages/Settings'
import SyncSettings from './pages/SyncSettings'
import ProcessStats from './pages/ProcessStats'
import TrendAnalysis from './pages/TrendAnalysis'
import HourlyRegionHeatmap from './pages/HourlyRegionHeatmap'
import Billing from './pages/Billing'
import Onboarding from './pages/Onboarding'
import SetupWizard from './pages/SetupWizard'
// import { HealthDashboard } from './components/HealthDashboard'
import HealthDashboard from './components/HealthDashboard'
import DesktopPet from './components/DesktopPet'
import { authService } from './services/authService'
import { strategyService } from './services/strategyService'
import { apiConfig } from './config/apiConfig'
import { apiKeyService, type QuotaAlertConfig } from './services/apiKeyService'
import { themeService } from './services/themeService'
import { applyProfileTheme } from './services/profileService'
import './index.css'

const NAV_ITEMS = [
  { path: '/', label: '实时审计', icon: 'audit' },
  { path: '/evidence', label: '存证中心', icon: 'evidence' },
  { path: '/health', label: '健康度', icon: 'health' },
  { path: '/trend', label: '消费趋势', icon: 'trend' },
  { path: '/hourly', label: '区域监控', icon: 'hourly' },
  { path: '/billing', label: '月度账单', icon: 'billing' },
  { path: '/process', label: '工具统计', icon: 'process' },
  { path: '/sync', label: '云端同步', icon: 'sync' },
  { path: '/auth', label: '实名认证', icon: 'auth' },
  { path: '/settings', label: '系统设置', icon: 'settings' },
]

/** 等待 Django 后端就绪（自动拉起后需数秒启动）。返回是否就绪。 */
async function waitForBackend(maxAttempts = 25, intervalMs = 1000): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch('http://localhost:8000/api/health/', { signal: AbortSignal.timeout(2000) })
      if (res.ok) return true
    } catch {
      // 后端尚未就绪，继续轮询
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return false
}

function Sidebar() {
  const [serviceStatus, setServiceStatus] = useState<'running' | 'stopped'>('running')
  
  useEffect(() => {
    // 检查服务状态
    const checkStatus = async () => {
      try {
        const response = await fetch('http://localhost:9092/health', { signal: AbortSignal.timeout(2000) })
        setServiceStatus(response.ok ? 'running' : 'stopped')
      } catch {
        setServiceStatus('stopped')
      }
    }
    
    checkStatus()
    const interval = setInterval(checkStatus, 5000)
    return () => clearInterval(interval)
  }, [])
  
  return (
    <aside className="app-sider" style={{ width: 220 }}>
      <div className="sider-header">
        <img 
          src="/logo.png" 
          alt="一鉴到底" 
          style={{
            width: 32,
            height: 32,
            borderRadius: 6,
            objectFit: 'cover'
          }}
        />
        <span className="sider-title">一鉴到底</span>
      </div>
      
      {/* 服务状态 */}
      <div style={{ padding: '12px 16px' }}>
        <div className={`service-status ${serviceStatus}`}>
          <div className="status-indicator" />
          <div>
            <div style={{ fontSize: 12, fontWeight: 500 }}>
              API 服务{serviceStatus === 'running' ? '运行中' : '已停止'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
              localhost:9092
            </div>
          </div>
        </div>
      </div>
      
      <nav className="sider-nav">
        <div className="nav-section">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">
                {item.icon === 'audit' && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                )}
                {item.icon === 'evidence' && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14,2 14,8 20,8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10,9 9,9 8,9" />
                  </svg>
                )}
                {item.icon === 'auth' && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                )}
                {item.icon === 'settings' && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                )}
                {item.icon === 'sync' && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                    <path d="M21 3v5h-5" />
                    <path d="M3 12a9 9 0 1 1 9 9c-2.52 0-4.93-1-6.74-2.74L3 16" />
                    <path d="M3 21v-5h5" />
                  </svg>
                )}
                {item.icon === 'health' && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                )}
                {item.icon === 'trend' && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                )}
                {item.icon === 'hourly' && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                )}
              </span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
      
      {/* 产品定位 */}
      <div style={{
        padding: 16,
        borderTop: '1px solid var(--border-primary)',
        marginTop: 'auto',
        fontSize: 11,
        color: 'var(--text-tertiary)'
      }}>
        <div style={{ marginBottom: 4, fontWeight: 500 }}>AI 行为校验工具</div>
        <div>本地运行 · 数据安全</div>
      </div>
    </aside>
  )
}

/** 消费额度状态（对齐后端 GET /api/deepseek/quota 返回结构） */
interface QuotaStatus {
  globalUsed: number
  globalQuota: number
  circuitOpen: boolean
  circuitOpenedAt: number | null
  failureRate: number
  warnThreshold: number
  criticalThreshold: number
  status?: string
}

type QuotaLevel = 'none' | 'warn' | 'critical'

/** 声音提示（WebAudio 短促提示音，无外部资源依赖） */
function playAlertSound() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.4)
    osc.onended = () => ctx.close()
  } catch {
    // 声音播放失败静默降级
  }
}

/** 消费预警：仅在级别升级时触发一次（桌面弹窗 + 声音，按配置联动），避免刷屏 */
function notifyQuota(level: Exclude<QuotaLevel, 'none'>, pct: number, config?: QuotaAlertConfig | null) {
  const notify = config?.notify ?? ['desktop']
  // 预警开关关闭：不再推送
  if (config && !config.enabled) return

  const title = level === 'critical'
    ? `消费额度已达临界（${pct}%）`
    : `消费额度预警（${pct}%）`
  const body = level === 'critical'
    ? '平台共享额度即将用尽，建议立即在「系统设置 → API 密钥」绑定自有 Key 或暂停分析任务。'
    : '平台共享额度消耗较快，请注意控制调用量。'

  if (notify.includes('sound')) playAlertSound()

  if (!notify.includes('desktop')) return
  if (typeof Notification === 'undefined') return
  if (Notification.permission === 'granted') {
    new Notification(title, { body })
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((p) => {
      if (p === 'granted') new Notification(title, { body })
    })
  }
}

function Header({ username, onLogout }: { username?: string; onLogout: () => void }) {
  const location = useLocation()
  const [quota, setQuota] = useState<QuotaStatus | null>(null)
  // 用 ref 记录上次通知级别，避免轮询闭包读到过期 state
  const lastNotifiedLevel = useRef<QuotaLevel>('none')
  // 消费预警配置（开关 / 通知方式）：首次轮询时拉取一次，用于联动推送
  const quotaAlertConfig = useRef<QuotaAlertConfig | null>(null)

  const getPageTitle = () => {
    const item = NAV_ITEMS.find(n => n.path === location.pathname)
    return item?.label || '一鉴到底'
  }

  // 消费额度轮询（登录后 Header 渲染即生效）：30s 拉取一次
  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      if (!quotaAlertConfig.current) {
        quotaAlertConfig.current = await apiKeyService.getQuotaAlertConfig()
      }
      const q = await apiKeyService.getQuotaStatus()
      if (cancelled || !q) return
      setQuota(q)
      const usage = q.globalQuota > 0 ? q.globalUsed / q.globalQuota : 0
      const pct = Math.min(100, Math.round(usage * 100))
      const level: QuotaLevel =
        q.circuitOpen || usage >= q.criticalThreshold
          ? 'critical'
          : usage >= q.warnThreshold
            ? 'warn'
            : 'none'
      if (level !== 'none' && level !== lastNotifiedLevel.current) {
        lastNotifiedLevel.current = level
        notifyQuota(level, pct, quotaAlertConfig.current)
      } else if (level === 'none') {
        lastNotifiedLevel.current = 'none'
      }
    }
    poll()
    const interval = setInterval(poll, 30000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  // 进度条颜色 + 徽标文案（绿/黄/红三色预警；无每日上限时仅展示调用计数）
  const renderQuota = () => {
    if (!quota) return null
    const hasLimit = quota.globalQuota > 0
    const usage = hasLimit ? quota.globalUsed / quota.globalQuota : 0
    const pct = hasLimit ? Math.min(100, Math.round(usage * 100)) : 0
    const level: QuotaLevel =
      quota.circuitOpen || (hasLimit && usage >= quota.criticalThreshold)
        ? 'critical'
        : hasLimit && usage >= quota.warnThreshold
          ? 'warn'
          : 'none'
    const color = level === 'critical' ? '#F85149' : level === 'warn' ? '#D29922' : '#3FB950'
    const badgeText = quota.circuitOpen
      ? '已熔断'
      : level === 'critical'
        ? '临界'
        : level === 'warn'
          ? '预警'
          : '正常'
    const label = hasLimit
      ? `额度 ${quota.globalUsed}/${quota.globalQuota}`
      : `今日调用 ${quota.globalUsed} 次`
    const warnPct = Math.round(quota.warnThreshold * 100)
    const criticalPct = Math.round(quota.criticalThreshold * 100)
    return (
      <div className="quota-bar">
        <span className="quota-label">{label}</span>
        {hasLimit && (
          <div className="quota-track">
            <div className="quota-fill" style={{ width: `${pct}%`, background: color }} />
          </div>
        )}
        <span className={`quota-badge ${level === 'none' ? 'ok' : level}`}>{badgeText}</span>
        {/* 悬浮详情：使用率 / 阈值 / 熔断 / 失败率 */}
        <div className="quota-tip">
          <div className="quota-tip-title">
            {hasLimit ? `平台共享额度 ${pct}%` : `今日调用 ${quota.globalUsed} 次`}
          </div>
          <div className="quota-tip-row">
            <span>已使用</span>
            <b>{hasLimit ? `${quota.globalUsed}/${quota.globalQuota}（${pct}%）` : `${quota.globalUsed} 次`}</b>
          </div>
          {hasLimit && (
            <>
              <div className="quota-tip-row">
                <span>预警阈值</span>
                <b>{warnPct}%</b>
              </div>
              <div className="quota-tip-row">
                <span>临界阈值</span>
                <b>{criticalPct}%</b>
              </div>
            </>
          )}
          {hasLimit && (
            <div className="quota-tip-row">
              <span>当前状态</span>
              <b style={{ color }}>{quota.circuitOpen ? '已熔断' : badgeText}</b>
            </div>
          )}
          {quota.failureRate > 0 && (
            <div className="quota-tip-row">
              <span>失败率</span>
              <b>{Math.round(quota.failureRate * 100)}%</b>
            </div>
          )}
          {quota.circuitOpen && (
            <div className="quota-tip-alert">⚠ 服务已熔断，暂不可用</div>
          )}
        </div>
      </div>
    )
  }

  return (
    <header className="app-header" style={{ height: 48 }}>
      <h1 className="header-title">{getPageTitle()}</h1>
      <div className="header-actions">
        {renderQuota()}
        {username && <span style={{ marginRight: 12, fontSize: 12 }}>{username}</span>}
        <button 
          onClick={onLogout}
          style={{
            fontSize: 12,
            color: 'var(--text-secondary)',
            background: 'none',
            border: 'none',
            cursor: 'pointer'
          }}
        >
          退出
        </button>
      </div>
    </header>
  )
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState<any>(null)
  // 操作权限引导状态：true=已授权/无需引导，false=未授权需引导，null=加载中
  const [onboarded, setOnboarded] = useState<boolean | null>(null)
  // 首次启动引导状态：true=已完成，false=未完成，null=加载中
  const [setupCompleted, setSetupCompleted] = useState<boolean | null>(null)
  // 首次运行（未登录 + 后端无用户 + 本地未设置账号）→ 先进入「设置账号」引导，再登录注册
  const [firstRun, setFirstRun] = useState<boolean>(false)
  // 桌宠角色信息（来自主进程 companion 系统，与桌面悬浮窗保持一致）
  const [petCharacter, setPetCharacter] = useState<any>(null)

  // 挂载时初始化主题与自定义背景（从 localStorage 恢复）
  useEffect(() => {
    themeService.init()
  }, [])

  // 获取桌宠角色信息：优先走 get-pet-stats，失败则监听 onPetCharacter
  useEffect(() => {
    if (!isAuthenticated) return
    const api = (window as any).electronAPI
    if (!api) return
    // 1) 拉取最新角色画像（设置页「治理桌宠」面板同源）
    if (api.getPetStats) {
      api
        .getPetStats()
        .then((res: any) => {
          const character = res?.character || res?.data?.character
          if (character) setPetCharacter(character)
        })
        .catch(() => {
          // 忽略：静默降级，等待 push 推送
        })
    }
    // 2) 主进程主动推送角色变化
    if (api.onPetCharacter) {
      api.onPetCharacter((character: any) => {
        if (character) setPetCharacter(character)
      })
    }
  }, [isAuthenticated])

  // 登录后检查操作权限引导状态（首次启动引导「账号设置」在登录前完成，已登录即视为就绪）
  useEffect(() => {
    if (!isAuthenticated) return
    const api = (window as any).electronAPI
    if (!api?.getPermissionConfig) {
      // 非 Electron 环境（浏览器开发预览）跳过引导
      setOnboarded(true)
      setSetupCompleted(true)
      return
    }
    // 已登录 = 后端账号已就绪，无需本地「设置账号密码」引导（首次运行先设密码再登录）。
    // 首次运行（firstRun）引导进行中时除外：账号/权限/网络三步需在 SetupWizard 内完成，
    // 完成后由 onComplete 统一置位，避免被提前重定向到旧的 /onboarding 引导页。
    if (!firstRun) {
      setSetupCompleted(true)
    }
    // 操作权限引导状态
    api
      .getPermissionConfig()
      .then((res: any) => {
        const cfg = res?.data || res
        setOnboarded(cfg?.onboarded === true)
      })
      .catch(() => {
        setOnboarded(true)
      })
  }, [isAuthenticated, firstRun])

  // 联动：登录后配置 Electron 进程监控的后端上报（携带 token）
  useEffect(() => {
    if (!isAuthenticated) return
    const api = (window as any).electronAPI
    if (!api?.setProcessBackend) return
    api.setProcessBackend({
      enabled: true,
      baseUrl: apiConfig.getBaseURL(),
      token: authService.getToken() || undefined,
    }).then((res: any) => {
      console.log('[App] 已配置进程监控后端上报', res)
    }).catch((e: any) => {
      console.warn('[App] 配置进程监控后端上报失败', e)
    })
  }, [isAuthenticated])

  // P1-4 个性化数据同步：登录后从后端拉取主题/背景覆盖本地（重新登录不丢失）
  useEffect(() => {
    if (!isAuthenticated) return
    applyProfileTheme().catch(() => {
      // 拉取失败静默：保持本地主题
    })
  }, [isAuthenticated])

  useEffect(() => {
    const checkAuth = async () => {
      console.log('[App] checkAuth 开始检查认证状态', {
        isAuthenticated: authService.isAuthenticated(),
        hasToken: Boolean(authService.getToken()),
      })

      // 0) 从主进程备份恢复登录态（localStorage 因异常退出丢失时免重新登录）。
      //    仅当 localStorage 无 auth_token 时才恢复；有则跳过，保持 localStorage 优先。
      const restored = await authService.restoreFromMain()
      if (restored) {
        console.log('[App] checkAuth 已从主进程备份恢复登录态', { user: authService.getCurrentUser() })
      }

      // 0.5) 等待后端就绪（主进程自动拉起 Django 后需数秒启动；未就绪则无法校验/登录）
      const backendReady = await waitForBackend()
      console.log('[App] checkAuth 后端就绪状态:', { backendReady })
      if (!backendReady) {
        console.warn('[App] checkAuth 后端未就绪，本次不校验登录态')
        setIsAuthenticated(false)
        setFirstRun(false)
        setLoading(false)
        return
      }

      try {
        // 检查是否已登录
        if (authService.isAuthenticated()) {
          // 验证Token是否有效
          console.log('[App] checkAuth 检测到已登录，开始校验 Token')
          const isValid = await authService.validateToken()
          console.log('[App] checkAuth validateToken 结果:', { isValid })

          if (isValid) {
            // Token有效，自动登录成功（登录态持久化：重启免登录）
            console.log('[App] checkAuth Token 有效，自动登录成功', { user: authService.getCurrentUser() })
            setIsAuthenticated(true)
            setCurrentUser(authService.getCurrentUser())
            // 已登录即有后端账号，免引导
            setSetupCompleted(true)
            // 同步 token 到主进程（存证联动 / evidence / report 共用认证）
            ;(window as any).electronAPI?.setSyncToken?.(authService.getToken())

            // ✅ 初始化策略服务（海马体记忆系统）
            console.log('[App] 初始化海马体记忆系统...')
            await strategyService.initialize()
          } else {
            // Token无效，尝试刷新（refresh token 30 天长期有效）
            // 使用单飞刷新：并发组件（策略初始化/额度轮询/记忆同步等）同时触发刷新时，
            // 只发起一次 POST /refresh，避免轮换后旧 token 被拉黑 → 401 → 误清登录态
            console.log('[App] checkAuth Token 无效，尝试刷新')
            const refreshed = await authService.refreshTokenGuarded()
            console.log('[App] checkAuth refreshToken 结果:', { refreshed })
            if (refreshed) {
              console.log('[App] checkAuth 刷新成功，自动登录', { user: authService.getCurrentUser() })
              setIsAuthenticated(true)
              setCurrentUser(authService.getCurrentUser())
              // 刷新成功即有后端账号，免引导
              setSetupCompleted(true)
              // 同步轮换后的新 token 到主进程（存证联动共用认证）
              ;(window as any).electronAPI?.setSyncToken?.(authService.getToken())

              // ✅ 初始化策略服务（海马体记忆系统）
              console.log('[App] 初始化海马体记忆系统...')
              await strategyService.initialize()
            } else {
              console.warn('[App] checkAuth 刷新失败，退出登录状态')
              setIsAuthenticated(false)
            }
          }
        } else {
          console.log('[App] checkAuth 未登录，保持未认证状态')
        }

        // 未登录时判断是否为「首次运行」：后端无用户 且 本地未设置账号 → 进入设置账号引导
        if (!authService.isAuthenticated()) {
          let localSetupDone = false
          const api = (window as any).electronAPI
          if (api?.getLocalAuthStatus) {
            try {
              const res = await api.getLocalAuthStatus()
              const data = res?.data || res
              localSetupDone = data?.setupCompleted === true
            } catch {
              localSetupDone = false
            }
          }
          const setupStatus = await authService.getBackendSetupStatus()
          const backendHasUsers = setupStatus?.has_users === true
          const isFirstRun = !localSetupDone && !backendHasUsers
          console.log('[App] checkAuth 首次运行判断:', { localSetupDone, backendHasUsers, isFirstRun })
          setFirstRun(isFirstRun)
          setSetupCompleted(!isFirstRun)
        }
      } catch (error) {
        console.error('[App] checkAuth 认证检查失败:', error)
        setIsAuthenticated(false)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  // 登出处理
  const handleLogout = async () => {
    try {
      await authService.logout()
    } catch (error) {
      console.error('登出失败:', error)
    } finally {
      setIsAuthenticated(false)
      setCurrentUser(null)
    }
  }

  // 加载中显示
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        fontSize: 16,
        color: '#666'
      }}>
        正在加载...
      </div>
    )
  }

  return (
    <BrowserRouter>
      <div className="app-layout">
        {isAuthenticated && <Sidebar />}
        <div className="app-main">
          {isAuthenticated && (
            <Header 
              username={currentUser?.username}
              onLogout={handleLogout}
            />
          )}
          <main className="app-content">
            <Routes>
              {isAuthenticated ? (
                setupCompleted !== true ? (
                  // 未完成首次启动引导（含加载中）：锁定在引导页（账号 → 权限 → 网络）
                  <>
                    <Route
                      path="/setup"
                      element={
                        <SetupWizard
                          onComplete={() => {
                            // SetupWizard 已完成权限引导并调用 completeOnboarding，
                            // 需同步置位 onboarded，避免完成后被重定向到旧的 /onboarding 页
                            setSetupCompleted(true)
                            setOnboarded(true)
                          }}
                          onLoginSuccess={() => {
                            setIsAuthenticated(true)
                            setCurrentUser(authService.getCurrentUser())
                          }}
                        />
                      }
                    />
                    <Route path="*" element={<Navigate to="/setup" replace />} />
                  </>
                ) : onboarded === false ? (
                  // 未完成操作权限引导：锁定在引导页
                  <>
                    <Route path="/onboarding" element={<Onboarding onComplete={() => setOnboarded(true)} />} />
                    <Route path="*" element={<Navigate to="/onboarding" replace />} />
                  </>
                ) : (
                  <>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/evidence" element={<Evidence />} />
                    <Route path="/health" element={<HealthDashboard />} />
                    <Route path="/trend" element={<TrendAnalysis />} />
                    <Route path="/hourly" element={<HourlyRegionHeatmap />} />
                    <Route path="/billing" element={<Billing />} />
                    <Route path="/process" element={<ProcessStats />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/sync" element={<SyncSettings />} />
                    <Route path="/auth" element={<RealNameAuth />} />
                  </>
                )
              ) : firstRun ? (
                // 首次运行：未登录 + 后端无用户 → 先「设置账号」再自动登录（设置账号在登录注册之前）
                <>
                  <Route
                    path="/setup"
                    element={
                      <SetupWizard
                        onComplete={() => {
                          setSetupCompleted(true)
                          setOnboarded(true)
                        }}
                        onLoginSuccess={() => {
                          setIsAuthenticated(true)
                          setCurrentUser(authService.getCurrentUser())
                        }}
                      />
                    }
                  />
                  <Route path="*" element={<Navigate to="/setup" replace />} />
                </>
              ) : (
                <>
                  <Route path="/auth" element={<Auth onLoginSuccess={() => {
                    setIsAuthenticated(true)
                    setCurrentUser(authService.getCurrentUser())
                  }} />} />
                  <Route path="*" element={<Navigate to="/auth" replace />} />
                </>
              )}
            </Routes>
          </main>
        </div>
        {isAuthenticated && <DesktopPet character={petCharacter} />}
      </div>
    </BrowserRouter>
  )
}