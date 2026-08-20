/**
 * 首次启动引导页（SetupWizard）
 * 下载安装包并首次打开后展示，包含三步：
 *  1. 设置账号密码（进入本地数据库）
 *  2. 允许操作权限
 *  3. 允许网络（开启网络访问相关能力）
 * 全部完成后写入本地配置，进入主界面。
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PermissionList, { PERMISSION_GROUPS } from '../components/PermissionList'
import { authService } from '../services/authService'
import './SetupWizard.css'

interface SetupWizardProps {
  /** 完成全部引导后的回调 */
  onComplete?: () => void
  /** 设置账号并自动登录成功后的回调（首次运行场景：让 App 进入已登录状态） */
  onLoginSuccess?: () => void
  /** 本地已存在账号（已登录场景）：跳过「设置账号密码」步骤，直接进入权限/网络引导 */
  hasAccount?: boolean
}

type Step = 'account' | 'permission' | 'network' | 'done'

/** 结构化错误信息：区分输入校验错误与系统错误，给用户可操作的建议 */
interface SetupError {
  /** 标题（如「请检查输入」「操作未完成」） */
  title: string
  /** 主要说明 */
  message: string
  /** 用户可操作的建议 */
  hint?: string
  /** 技术详情（默认折叠，方便用户反馈排查） */
  detail?: string
}

const STEPS_BASE: Array<{ key: Step; label: string }> = [
  { key: 'account', label: '设置账号' },
  { key: 'permission', label: '允许权限' },
  { key: 'network', label: '允许网络' },
]

export default function SetupWizard({ onComplete, onLoginSuccess, hasAccount }: SetupWizardProps) {
  const navigate = useNavigate()
  const api = (window as any).electronAPI

  // 步骤状态
  const [step, setStep] = useState<Step>(hasAccount ? 'permission' : 'account')
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<SetupError | null>(null)

  // 已有账号时跳过「设置账号」步骤
  const STEPS = hasAccount ? STEPS_BASE.slice(1) : STEPS_BASE

  // 账号表单
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')

  // 权限表单
  const [granted, setGranted] = useState<Record<string, boolean>>({})

  // 网络表单
  const [networkEnabled, setNetworkEnabled] = useState(true)
  const [apiMonitorEnabled, setApiMonitorEnabled] = useState(true)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)

  // 加载初始状态（权限配置）
  useEffect(() => {
    console.log('[SetupWizard] 开始加载初始配置')
    if (!api?.getPermissionConfig) {
      console.log('[SetupWizard] 非 Electron 环境，跳过加载，直接进入引导')
      setLoaded(true)
      return
    }
    api
      .getPermissionConfig()
      .then((res: any) => {
        const cfg = res?.data || res
        console.log('[SetupWizard] 加载权限配置成功', { onboarded: cfg?.onboarded, grantedCount: Object.keys(cfg?.granted || {}).length })
        if (cfg?.granted) setGranted(cfg.granted)
        setLoaded(true)
      })
      .catch((err: any) => {
        console.error('[SetupWizard] 加载权限配置失败', err?.message || err)
        setLoaded(true)
      })
  }, [])

  const allowAll = () => {
    const all: Record<string, boolean> = {}
    for (const group of PERMISSION_GROUPS) {
      for (const item of group.items) all[item.key] = true
    }
    console.log('[SetupWizard] 全部允许', { keys: Object.keys(all) })
    setGranted(all)
  }

  const toggle = (key: string, value: boolean) => {
    setGranted((prev) => ({ ...prev, [key]: value }))
  }

  const stepIndex = STEPS.findIndex((s) => s.key === step)

  /** 输入校验错误（用户可自行修正，无需技术详情） */
  const setInputError = (message: string) => {
    setError({ title: '请检查输入', message })
  }

  /** 系统错误（IPC 调用失败等）：给出可操作建议与可折叠的技术详情 */
  const setSystemError = (action: string, fallback: string, e?: any) => {
    const detail = e?.message || e?.error || String(e || '')
    console.error(`[SetupWizard] ${action}失败`, detail)
    setError({
      title: '操作未完成',
      message: detail ? `${fallback}（${detail}）` : fallback,
      hint: '请稍后重试；若持续失败，请在「系统设置 → 操作权限」中检查设置，或查看应用日志后联系技术支持。',
      detail,
    })
  }

  /** 第 1 步：提交账号密码（注册到后端数据库 + 本地记录 + 自动登录） */
  const submitAccount = async () => {
    setError(null)
    // 已存在本地账号（已登录场景）：跳过账号设置，直接进入权限步骤
    if (hasAccount) {
      console.log('[SetupWizard] 检测到已存在账号，跳过「设置账号密码」步骤')
      setStep('permission')
      return
    }
    console.log('[SetupWizard] 提交账号密码', { username: username.trim(), passwordLen: password.length })
    if (username.trim().length < 3) {
      console.warn('[SetupWizard] 校验失败：用户名过短', { username: username.trim() })
      setInputError('账号至少需要 3 个字符，请检查后重新输入。')
      return
    }
    if (!password || password.length < 8) {
      console.warn('[SetupWizard] 校验失败：密码过短', { passwordLen: password.length })
      setInputError('密码至少需要 8 位，请检查后重新输入。')
      return
    }
    if (password !== passwordConfirm) {
      console.warn('[SetupWizard] 校验失败：两次密码不一致')
      setInputError('两次输入的密码不一致，请重新确认。')
      return
    }
    // 非 Electron 环境：仍可注册后端并自动登录（浏览器开发预览场景）
    const hasIpc = !!api?.registerLocalAuth
    setSaving(true)
    try {
      // 1) 本地记录（Electron 场景）：保存进入本地数据库的账号（setupCompleted 暂为 false，全部完成后置位）
      if (hasIpc) {
        try {
          console.log('[SetupWizard] 调用 IPC registerLocalAuth 开始')
          const localRes = await api.registerLocalAuth({ username: username.trim(), password })
          console.log('[SetupWizard] 调用 IPC registerLocalAuth 返回', { success: localRes?.success, error: localRes?.error })
          if (!localRes?.success) {
            console.warn('[SetupWizard] 本地账号保存失败', { error: localRes?.error })
            setSystemError('保存账号', '账号保存失败，未能写入本地数据库。', localRes?.error)
            return
          }
        } catch (e: any) {
          setSystemError('保存账号', '账号保存未完成，可能是应用进程无响应。', e)
          return
        }
      } else {
        console.log('[SetupWizard] 非 Electron 环境，跳过本地账号记录')
      }

      // 2) 注册到后端数据库并自动登录（登录态持久化：refresh token 30 天）
      //    已登录（中断续跑场景）则跳过；已注册（用户名占用）则回退为直接登录
      if (!authService.isAuthenticated()) {
        console.log('[SetupWizard] 调用后端 setupAccount 注册+自动登录 开始')
        try {
          await authService.setupAccount(username.trim(), password)
        } catch (regErr: any) {
          const msg = String(regErr?.message || regErr?.error || '')
          // 用户名已存在 → 说明此前已注册成功但未完成引导，回退直接登录继续
          if (/已注册|已被注册|username.*exist|unique/i.test(msg)) {
            console.log('[SetupWizard] 账号已注册，回退直接登录', { msg })
            await authService.login({ username: username.trim(), password })
          } else {
            throw regErr
          }
        }
        console.log('[SetupWizard] 后端注册+自动登录成功')
        onLoginSuccess?.()
      } else {
        console.log('[SetupWizard] 已处于登录状态，跳过注册（中断续跑）')
        onLoginSuccess?.()
      }

      console.log('[SetupWizard] 账号设置完成，进入权限步骤')
      setStep('permission')
    } catch (e: any) {
      setSystemError('注册账号', '账号注册/登录未完成，请确认后端服务已启动后重试。', e?.message || e)
    } finally {
      setSaving(false)
    }
  }

  /** 第 2 步：提交权限 */
  const submitPermission = async () => {
    setError(null)
    console.log('[SetupWizard] 提交权限配置', { grantedKeys: Object.keys(granted), grantedCount: Object.keys(granted).filter(k => granted[k]).length })
    if (!api?.setPermissionConfig) {
      console.log('[SetupWizard] 非 Electron 环境，跳过权限保存，进入网络步骤')
      setStep('network')
      return
    }
    setSaving(true)
    try {
      console.log('[SetupWizard] 调用 IPC setPermissionConfig 开始')
      const res = await api.setPermissionConfig(granted)
      console.log('[SetupWizard] 调用 IPC setPermissionConfig 返回', { success: res?.success, error: res?.error })
      if (!res?.success) {
        console.warn('[SetupWizard] 权限保存失败', { error: res?.error })
        setSystemError('保存权限', '操作权限保存失败，未能写入本地配置。', res?.error)
        setSaving(false)
        return
      }
      console.log('[SetupWizard] 权限保存成功，进入网络步骤')
      setStep('network')
    } catch (e: any) {
      setSystemError('保存权限', '操作权限保存未完成，可能是应用进程无响应。', e)
    } finally {
      setSaving(false)
    }
  }

  /** 第 3 步：提交网络设置并完成 */
  const submitNetwork = async () => {
    setError(null)
    console.log('[SetupWizard] 提交网络设置', { networkEnabled, apiMonitorEnabled, notificationsEnabled })
    setSaving(true)
    try {
      // 网络允许：开启网络请求监控 + API 调用监控代理 + 系统通知
      if (api?.setApiCallConfig) {
        console.log('[SetupWizard] 调用 IPC setApiCallConfig 开始', { enabled: networkEnabled && apiMonitorEnabled })
        const apiRes = await api.setApiCallConfig({ enabled: networkEnabled && apiMonitorEnabled })
        console.log('[SetupWizard] 调用 IPC setApiCallConfig 返回', { success: apiRes?.success, error: apiRes?.error })
        if (apiRes && !apiRes.success) {
          setSystemError('保存网络设置', 'API 调用监控配置保存失败。', apiRes?.error)
          setSaving(false)
          return
        }
      } else {
        console.log('[SetupWizard] 跳过 setApiCallConfig（API 不可用）')
      }
      if (api?.setPermissionConfig) {
        const patch: Record<string, boolean> = {}
        if (networkEnabled) {
          patch.networkMonitor = true
          if (apiMonitorEnabled) patch.apiCallMonitor = true
          if (notificationsEnabled) patch.notifications = true
        }
        if (Object.keys(patch).length > 0) {
          console.log('[SetupWizard] 调用 IPC setPermissionConfig（网络）开始', { patch })
          const permRes = await api.setPermissionConfig(patch)
          console.log('[SetupWizard] 调用 IPC setPermissionConfig（网络）返回', { success: permRes?.success, error: permRes?.error })
          if (!permRes?.success) {
            setSystemError('保存网络设置', '网络相关权限保存失败。', permRes?.error)
            setSaving(false)
            return
          }
        } else {
          console.log('[SetupWizard] 网络均未启用，跳过权限补写')
        }
      }
      // 完成首次设置引导（本地账号标记完成）
      if (api?.completeLocalSetup) {
        console.log('[SetupWizard] 调用 IPC completeLocalSetup 开始')
        const setupRes = await api.completeLocalSetup()
        console.log('[SetupWizard] 调用 IPC completeLocalSetup 返回', { success: setupRes?.success, error: setupRes?.error })
        if (!setupRes?.success) {
          setSystemError('完成引导', '引导状态标记失败，可点击「完成设置」重试。', setupRes?.error)
          setSaving(false)
          return
        }
      } else {
        console.log('[SetupWizard] 跳过 completeLocalSetup（API 不可用）')
      }
      if (api?.completeOnboarding) {
        console.log('[SetupWizard] 调用 IPC completeOnboarding 开始')
        const onboardRes = await api.completeOnboarding()
        console.log('[SetupWizard] 调用 IPC completeOnboarding 返回', { success: onboardRes?.success, error: onboardRes?.error })
        if (!onboardRes?.success) {
          setSystemError('完成引导', '操作权限引导状态标记失败，可点击「完成设置」重试。', onboardRes?.error)
          setSaving(false)
          return
        }
      } else {
        console.log('[SetupWizard] 跳过 completeOnboarding（API 不可用）')
      }
      console.log('[SetupWizard] 全部网络设置完成，进入完成页')
      setStep('done')
    } catch (e: any) {
      setSystemError('保存网络设置', '保存未完成，可能是应用进程无响应。', e)
      setSaving(false)
    }
  }

  /** 完成 */
  const finish = () => {
    console.log('[SetupWizard] 点击「开始使用」，完成引导')
    onComplete?.()
    navigate('/', { replace: true })
  }

  if (!loaded) {
    return (
      <div className="setup-wizard-page">
        <div className="setup-wizard-card setup-loading">
          <div className="setup-loading-spinner" />
          <p>正在加载初始化配置，请稍候...</p>
          <p className="setup-loading-hint">若长时间未加载完成，请关闭应用后重新打开。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="setup-wizard-page">
      <div className="setup-wizard-card">
        <div className="setup-wizard-header">
          <img src="/logo.png" alt="一鉴到底" className="setup-wizard-logo" />
          <h1>欢迎使用一鉴到底</h1>
          <p>首次使用需要完成以下 3 个简单设置，即可开始使用。</p>
        </div>

        {/* 步骤指示器 */}
        <div className="setup-wizard-steps">
          {STEPS.map((s, i) => (
            <div
              key={s.key}
              className={`setup-step ${i <= stepIndex ? 'active' : ''} ${s.key === step ? 'current' : ''}`}
            >
              <div className="setup-step-dot">{i < stepIndex ? '✓' : i + 1}</div>
              <span className="setup-step-label">{s.label}</span>
            </div>
          ))}
        </div>

        {error && (
          <div className={`setup-wizard-error ${error.title === '请检查输入' ? 'input' : 'system'}`} role="alert">
            <div className="setup-error-title">
              <span className="setup-error-icon">!</span>
              {error.title}
            </div>
            <div className="setup-error-message">{error.message}</div>
            {error.hint && <div className="setup-error-hint">{error.hint}</div>}
            {error.detail && <div className="setup-error-detail">{error.detail}</div>}
          </div>
        )}

        {/* 第 1 步：设置账号密码 */}
        {step === 'account' && (
          <div className="setup-step-body">
            {hasAccount ? (
              <>
                <h2>账号已就绪</h2>
                <p className="setup-desc">
                  检测到本地已存在账号，无需重复设置密码，可直接进行后续的权限与网络设置。
                </p>
              </>
            ) : (
              <>
                <h2>设置账号密码</h2>
                <p className="setup-desc">
                  设置您的账号和密码。确认后会自动创建账号并登录，进入本地的存证、监控与审计数据。
                  请务必牢记，之后可凭该账号直接登录。
                </p>
                <div className="form-group">
                  <label className="form-label">账号（用户名）</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="至少 3 个字符"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">密码</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="至少 8 位"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">确认密码</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="再次输入密码"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') submitAccount() }}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* 第 2 步：允许权限 */}
        {step === 'permission' && (
          <div className="setup-step-body">
            <h2>允许操作权限</h2>
            <p className="setup-desc">
              本应用会在本地进行文件、剪贴板、网络、API 调用等监控，并为治理 Agent 提供自动操作能力。
              请选择授权以下操作（未授权的一律不会执行）：
            </p>
            <PermissionList granted={granted} onChange={toggle} />
          </div>
        )}

        {/* 第 3 步：允许网络 */}
        {step === 'network' && (
          <div className="setup-step-body">
            <h2>允许网络访问</h2>
            <p className="setup-desc">允许本应用进行以下网络相关操作，用于风险识别与告警提醒。</p>

            <label className="setup-check-item">
              <input
                type="checkbox"
                checked={networkEnabled}
                onChange={(e) => setNetworkEnabled(e.target.checked)}
                style={{ width: 16, height: 16 }}
              />
              <span>
                <span className="setup-check-title">网络请求监控</span>
                <span className="setup-check-desc">捕获本机网络请求，识别外联风险。</span>
              </span>
            </label>

            <label className="setup-check-item">
              <input
                type="checkbox"
                checked={apiMonitorEnabled}
                disabled={!networkEnabled}
                onChange={(e) => setApiMonitorEnabled(e.target.checked)}
                style={{ width: 16, height: 16 }}
              />
              <span>
                <span className="setup-check-title">API 调用监控</span>
                <span className="setup-check-desc">通过本地代理捕获 AI 平台 API 调用，识别违规风险并记录存证。</span>
              </span>
            </label>

            <label className="setup-check-item">
              <input
                type="checkbox"
                checked={notificationsEnabled}
                onChange={(e) => setNotificationsEnabled(e.target.checked)}
                style={{ width: 16, height: 16 }}
              />
              <span>
                <span className="setup-check-title">系统通知</span>
                <span className="setup-check-desc">风险告警与状态提醒的系统通知。</span>
              </span>
            </label>
          </div>
        )}

        {/* 完成页 */}
        {step === 'done' && (
          <div className="setup-step-body setup-done">
            <div className="setup-done-icon">✓</div>
            <h2>设置完成</h2>
            <p className="setup-desc">所有设置已保存，开始使用一鉴到底吧！</p>
          </div>
        )}

        <div className="setup-wizard-actions">
          {stepIndex > 0 && step !== 'done' && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setStep(STEPS[stepIndex - 1].key)}
              disabled={saving}
            >
              上一步
            </button>
          )}
          {step === 'account' && (
            <button
              type="button"
              className={`btn btn-primary ${saving ? 'is-saving' : ''}`}
              onClick={submitAccount}
              disabled={saving}
            >
              {saving ? '保存中...' : '下一步'}
            </button>
          )}
          {step === 'permission' && (
            <>
              <button type="button" className="btn btn-secondary" onClick={allowAll} disabled={saving}>
                全部允许
              </button>
              <button
                type="button"
                className={`btn btn-primary ${saving ? 'is-saving' : ''}`}
                onClick={submitPermission}
                disabled={saving}
              >
                {saving ? '保存中...' : '下一步'}
              </button>
            </>
          )}
          {step === 'network' && (
            <button
              type="button"
              className={`btn btn-primary ${saving ? 'is-saving' : ''}`}
              onClick={submitNetwork}
              disabled={saving}
            >
              {saving ? '保存中...' : '完成设置'}
            </button>
          )}
          {step === 'done' && (
            <button type="button" className="btn btn-primary" onClick={finish}>
              开始使用
            </button>
          )}
        </div>

        <div className="setup-wizard-tip">
          提示：所有设置后续可随时在「系统设置」中修改。
        </div>
      </div>
    </div>
  )
}
