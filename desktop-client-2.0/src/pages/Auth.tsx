import { useState } from 'react'
import './Auth.css'
import { authService } from '../services/authService'
import { parseError, showError } from '../utils/errorHandler'

type AuthStep = 'login' | 'register' | 'success'

interface UserInfo {
  id: number
  username: string
  email: string
  role: string
}

interface AuthProps {
  onLoginSuccess?: () => void
}

export default function Auth({ onLoginSuccess }: AuthProps) {
  const [step, setStep] = useState<AuthStep>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 登录表单
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)

  // 注册表单
  const [regUsername, setRegUsername] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('')
  const [privacyAgreed, setPrivacyAgreed] = useState(false)

  // 用户信息
  const [user, setUser] = useState<UserInfo | null>(null)

  // 登录处理
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const result = await authService.login({
        username: username,
        password: password
      })

      if (result.success && result.data) {
        setUser(result.data.user)

        // 保存"记住我"
        if (rememberMe) {
          localStorage.setItem('remember_username', username)
        }

        // 设置同步Token
        try {
          const token = authService.getToken()
          if (token) {
            await window.electronAPI.setSyncToken(token)
            console.log('[Auth] 同步Token已设置')
          }
        } catch (error) {
          console.error('[Auth] 设置同步Token失败:', error)
        }

        // 登录成功回调
        if (onLoginSuccess) {
          onLoginSuccess()
        }

        // 登录成功
        setStep('success')
      } else {
        const errorInfo = parseError({ response: { data: result } })
        setError(errorInfo.message)
      }
    } catch (error: any) {
      const errorInfo = parseError(error)
      setError(errorInfo.message)
      showError(error)
    } finally {
      setLoading(false)
    }
  }

  // 注册处理
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()

    // 表单验证
    if (!regUsername || regUsername.length < 3) {
      setError('用户名至少3个字符')
      return
    }

    if (!regEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setError('请输入正确的邮箱地址')
      return
    }

    if (!regPassword || regPassword.length < 8) {
      setError('密码至少8位')
      return
    }

    if (regPassword !== regPasswordConfirm) {
      setError('两次密码不一致')
      return
    }

    if (!privacyAgreed) {
      setError('请阅读并同意隐私政策和用户协议')
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await authService.register({
        username: regUsername,
        email: regEmail,
        password: regPassword,
        privacy_agreed: privacyAgreed
      })

      if (result.success && result.data) {
        setUser(result.data.user)
        setStep('success')
      } else {
        const errorInfo = parseError({ response: { data: result } })
        setError(errorInfo.message)
      }
    } catch (error: any) {
      const errorInfo = parseError(error)
      setError(errorInfo.message)
      showError(error)
    } finally {
      setLoading(false)
    }
  }

  // 渲染登录页
  const renderLogin = () => (
    <div className="auth-card">
      <div className="auth-header">
        <img src="/logo.png" alt="一鉴到底" className="auth-logo" />
        <h1>欢迎回来</h1>
        <p>登录您的账户以继续</p>
      </div>

      <form className="auth-form" onSubmit={handleLogin}>
        <div className="form-group">
          <label>用户名/邮箱</label>
          <input
            type="text"
            placeholder="请输入用户名或邮箱"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>密码</label>
          <input
            type="password"
            placeholder="请输入密码"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
        </div>

        <div className="form-options">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={e => setRememberMe(e.target.checked)}
            />
            记住用户名
          </label>
          <a href="#" className="forgot-link">忘记密码？</a>
        </div>

        {error && <div className="error-message">{error}</div>}

        <button
          type="submit"
          className="submit-btn"
          disabled={loading}
        >
          {loading ? '登录中...' : '登录'}
        </button>

        <div className="auth-footer">
          <button type="button" className="link-btn" onClick={() => setStep('register')}>
            没有账户？立即注册
          </button>
          <p className="privacy-hint">
            登录即表示同意
            <a href="https://yijiandaodi.com/legal/PRIVACY_POLICY.md" target="_blank">《用户协议》</a>和
            <a href="https://yijiandaodi.com/legal/USER_AGREEMENT.md" target="_blank">《隐私政策》</a>
          </p>
        </div>
      </form>
    </div>
  )

  // 渲染注册页
  const renderRegister = () => (
    <div className="auth-card">
      <div className="auth-header">
        <img src="/logo.png" alt="一鉴到底" className="auth-logo" />
        <h1>创建账户</h1>
        <p>注册新账户</p>
      </div>

      <form className="auth-form" onSubmit={handleRegister}>
        <div className="form-group">
          <label>用户名（至少3个字符）</label>
          <input
            type="text"
            placeholder="请输入用户名"
            value={regUsername}
            onChange={e => setRegUsername(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>邮箱</label>
          <input
            type="email"
            placeholder="请输入邮箱地址"
            value={regEmail}
            onChange={e => setRegEmail(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>密码（至少8位）</label>
          <input
            type="password"
            placeholder="请设置密码"
            value={regPassword}
            onChange={e => setRegPassword(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label>确认密码</label>
          <input
            type="password"
            placeholder="请再次输入密码"
            value={regPasswordConfirm}
            onChange={e => setRegPasswordConfirm(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={privacyAgreed}
              onChange={e => setPrivacyAgreed(e.target.checked)}
              required
            />
            我已阅读并同意
            <a href="https://yijiandaodi.com/legal/USER_AGREEMENT.md" target="_blank">《用户协议》</a>和
            <a href="https://yijiandaodi.com/legal/PRIVACY_POLICY.md" target="_blank">《隐私政策》</a>
          </label>
        </div>

        {error && <div className="error-message">{error}</div>}

        <button
          type="submit"
          className="submit-btn"
          disabled={loading}
        >
          {loading ? '注册中...' : '注册'}
        </button>

        <div className="auth-footer">
          <button type="button" className="link-btn" onClick={() => setStep('login')}>
            已有账户？立即登录
          </button>
        </div>
      </form>
    </div>
  )

  // 渲染成功页
  const renderSuccess = () => (
    <div className="auth-card success-card">
      <div className="success-icon">✓</div>
      <h1>认证完成</h1>
      <p>您的账户已登录成功</p>

      <div className="user-info">
        <div className="info-row">
          <span className="label">用户名</span>
          <span className="value">{user?.username}</span>
        </div>
        <div className="info-row">
          <span className="label">邮箱</span>
          <span className="value">{user?.email?.replace(/(.{2}).*(@.*)/, '$1***$2')}</span>
        </div>
        <div className="info-row">
          <span className="label">角色</span>
          <span className="value">{user?.role || 'user'}</span>
        </div>
      </div>

      <div className="benefits">
        <h3>登录成功后可以</h3>
        <ul>
          <li>使用AI安全检测功能</li>
          <li>管理您的项目和文件</li>
          <li>查看审计报告和数据</li>
          <li>享受多端数据同步</li>
        </ul>
      </div>

      <button
        className="submit-btn"
        onClick={() => window.location.href = '/'}
      >
        开始使用
      </button>
    </div>
  )

  return (
    <div className="auth-page">
      <div className="auth-container">
        {step === 'login' && renderLogin()}
        {step === 'register' && renderRegister()}
        {step === 'success' && renderSuccess()}
      </div>

      <div className="auth-brand">
        <h2>一鉴到底</h2>
        <p>AI创作保护平台</p>
        <div className="features">
          <div className="feature">
            <span className="icon">🔒</span>
            <span>数据不出境</span>
          </div>
          <div className="feature">
            <span className="icon">📜</span>
            <span>司法级存证</span>
          </div>
          <div className="feature">
            <span className="icon">🔍</span>
            <span>AI智能检测</span>
          </div>
          <div className="feature">
            <span className="icon">🔄</span>
            <span>多端同步</span>
          </div>
        </div>
      </div>
    </div>
  )
}