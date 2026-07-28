import { useState } from 'react'
import './Auth.css'

type AuthStep = 'login' | 'register' | 'realname' | 'success'
type LoginType = 'password' | 'code' | 'face'

interface User {
  id: string
  phone: string
  name?: string
  is_realname: boolean
  face_registered: boolean
  created_at: string
}

export default function Auth() {
  const [step, setStep] = useState<AuthStep>('login')
  const [loginType, setLoginType] = useState<LoginType>('password')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // 登录/注册表单
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [idCard, setIdCard] = useState('')
  
  // 用户信息
  const [user, setUser] = useState<User | null>(null)
  const [countdown, setCountdown] = useState(0)
  
  // 人脸识别状态
  const [faceCapturing, setFaceCapturing] = useState(false)

  // API 基础地址
  const API_BASE = 'http://localhost:9093'

  // 发送验证码
  const sendCode = async (type: 'login' | 'register' = 'login') => {
    if (!phone.match(/^1[3-9]\d{9}$/)) {
      setError('请输入正确的手机号')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, type })
      })

      const data = await response.json()

      if (data.success) {
        setCountdown(60)
        const timer = setInterval(() => {
          setCountdown(prev => {
            if (prev <= 1) {
              clearInterval(timer)
              return 0
            }
            return prev - 1
          })
        }, 1000)
        
        if (data.dev_code) {
          alert(`验证码: ${data.dev_code}（开发模式）`)
        }
      } else {
        setError(data.error || '发送失败')
      }
    } catch {
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  // 密码登录
  const loginWithPassword = async () => {
    if (!phone.match(/^1[3-9]\d{9}$/)) {
      setError('请输入正确的手机号')
      return
    }

    if (!password || password.length < 8) {
      setError('密码至少8位')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      })

      const data = await response.json()

      if (data.success) {
        setUser({
          id: data.user_id,
          phone: data.phone,
          name: data.name,
          is_realname: data.is_realname,
          face_registered: data.face_registered,
          created_at: data.created_at
        })
        
        if (data.is_realname) {
          setStep('success')
        } else {
          setStep('realname')
        }
      } else {
        setError(data.error || '登录失败')
      }
    } catch {
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  // 验证码登录
  const loginWithCode = async () => {
    if (!phone.match(/^1[3-9]\d{9}$/)) {
      setError('请输入正确的手机号')
      return
    }

    if (!code.match(/^\d{6}$/)) {
      setError('请输入6位验证码')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/login-with-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code })
      })

      const data = await response.json()

      if (data.success) {
        setUser({
          id: data.user_id,
          phone: data.phone,
          name: data.name,
          is_realname: data.is_realname,
          face_registered: false,
          created_at: new Date().toISOString()
        })
        
        if (data.is_realname) {
          setStep('success')
        } else {
          setStep('realname')
        }
      } else {
        setError(data.error || '登录失败')
      }
    } catch {
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  // 人脸识别登录
  const loginWithFace = async () => {
    setFaceCapturing(true)
    setError('')

    // TODO: 调用摄像头进行人脸识别
    // 模拟人脸识别
    setTimeout(() => {
      setFaceCapturing(false)
      setError('人脸识别功能开发中，请使用密码或验证码登录')
    }, 2000)
  }

  // 注册
  const register = async () => {
    if (!phone.match(/^1[3-9]\d{9}$/)) {
      setError('请输入正确的手机号')
      return
    }

    if (!password || password.length < 8) {
      setError('密码至少8位')
      return
    }

    if (!code.match(/^\d{6}$/)) {
      setError('请输入6位验证码')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password, code })
      })

      const data = await response.json()

      if (data.success) {
        setUser({
          id: data.user_id,
          phone: data.phone,
          is_realname: false,
          face_registered: false,
          created_at: new Date().toISOString()
        })
        setStep('realname')
      } else {
        setError(data.error || '注册失败')
      }
    } catch {
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  // 实名认证
  const verifyRealname = async () => {
    if (!name.trim()) {
      setError('请输入真实姓名')
      return
    }

    if (!idCard.match(/^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/)) {
      setError('请输入正确的身份证号')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_BASE}/api/v1/auth/verify-realname`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          user_id: user?.id,
          name, 
          id_card: idCard 
        })
      })

      const data = await response.json()

      if (data.success) {
        setUser(prev => prev ? { ...prev, is_realname: true, name: data.name } : null)
        setStep('success')
      } else {
        setError(data.error || '认证失败')
      }
    } catch {
      setError('网络错误，请重试')
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

      {/* 登录方式切换 */}
      <div className="login-type-tabs">
        <button 
          className={`tab ${loginType === 'password' ? 'active' : ''}`}
          onClick={() => setLoginType('password')}
        >
          密码登录
        </button>
        <button 
          className={`tab ${loginType === 'code' ? 'active' : ''}`}
          onClick={() => setLoginType('code')}
        >
          验证码登录
        </button>
        <button 
          className={`tab ${loginType === 'face' ? 'active' : ''}`}
          onClick={() => setLoginType('face')}
        >
          人脸登录
        </button>
      </div>

      <div className="auth-form">
        {/* 手机号 */}
        <div className="form-group">
          <label>手机号</label>
          <input
            type="tel"
            placeholder="请输入手机号"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            maxLength={11}
          />
        </div>

        {/* 密码登录 */}
        {loginType === 'password' && (
          <div className="form-group">
            <label>密码</label>
            <input
              type="password"
              placeholder="请输入密码"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
        )}

        {/* 验证码登录 */}
        {loginType === 'code' && (
          <div className="form-group">
            <label>验证码</label>
            <div className="code-input">
              <input
                type="text"
                placeholder="请输入验证码"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                maxLength={6}
              />
              <button
                className="send-btn"
                onClick={() => sendCode('login')}
                disabled={countdown > 0 || loading}
              >
                {countdown > 0 ? `${countdown}s` : '获取验证码'}
              </button>
            </div>
          </div>
        )}

        {/* 人脸登录 */}
        {loginType === 'face' && (
          <div className="face-login-area">
            <div className="face-capture" onClick={loginWithFace}>
              {faceCapturing ? (
                <div className="capturing">正在识别...</div>
              ) : (
                <>
                  <div className="face-icon">👤</div>
                  <div className="face-text">点击进行人脸识别</div>
                </>
              )}
            </div>
            <p className="face-hint">需要已注册人脸</p>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        {/* 登录按钮 */}
        <button
          className="submit-btn"
          onClick={() => {
            if (loginType === 'password') loginWithPassword()
            else if (loginType === 'code') loginWithCode()
            else if (loginType === 'face') loginWithFace()
          }}
          disabled={loading || loginType === 'face'}
        >
          {loading ? '登录中...' : '登录'}
        </button>

        <div className="auth-footer">
          <button className="link-btn" onClick={() => setStep('register')}>
            没有账户？立即注册
          </button>
          <p className="privacy-hint">
            登录即表示同意
            <a href="#">《用户协议》</a>和
            <a href="#">《隐私政策》</a>
          </p>
        </div>
      </div>
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

      <div className="auth-form">
        <div className="form-group">
          <label>手机号</label>
          <input
            type="tel"
            placeholder="请输入手机号"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            maxLength={11}
          />
        </div>

        <div className="form-group">
          <label>密码（至少8位）</label>
          <input
            type="password"
            placeholder="请设置密码"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>验证码</label>
          <div className="code-input">
            <input
              type="text"
              placeholder="请输入验证码"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
            />
            <button
              className="send-btn"
              onClick={() => sendCode('register')}
              disabled={countdown > 0 || loading}
            >
              {countdown > 0 ? `${countdown}s` : '获取验证码'}
            </button>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <button
          className="submit-btn"
          onClick={register}
          disabled={loading}
        >
          {loading ? '注册中...' : '注册'}
        </button>

        <div className="auth-footer">
          <button className="link-btn" onClick={() => setStep('login')}>
            已有账户？立即登录
          </button>
        </div>
      </div>
    </div>
  )

  // 渲染实名认证页
  const renderRealname = () => (
    <div className="auth-card">
      <div className="auth-header">
        <div className="step-indicator">
          <div className="step completed">✓ 登录成功</div>
          <div className="step active">实名认证</div>
          <div className="step">完成</div>
        </div>
        <h1>实名认证</h1>
        <p>为保障账户安全，请完成实名认证</p>
      </div>

      <div className="auth-form">
        <div className="form-group">
          <label>真实姓名</label>
          <input
            type="text"
            placeholder="请输入真实姓名"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>身份证号</label>
          <input
            type="text"
            placeholder="请输入身份证号"
            value={idCard}
            onChange={e => setIdCard(e.target.value.toUpperCase())}
            maxLength={18}
          />
        </div>

        <div className="security-notice">
          <div className="notice-icon">🔒</div>
          <div className="notice-content">
            <strong>信息安全保障</strong>
            <p>您的身份信息仅用于实名认证，我们承诺：</p>
            <ul>
              <li>数据本地存储，不上传云端</li>
              <li>仅用于导出存证报告时签名</li>
              <li>符合《个人信息保护法》要求</li>
            </ul>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        <button
          className="submit-btn"
          onClick={verifyRealname}
          disabled={loading}
        >
          {loading ? '认证中...' : '完成认证'}
        </button>

        <button
          className="skip-btn"
          onClick={() => setStep('success')}
        >
          暂不认证，稍后完成
        </button>
      </div>
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
          <span className="label">手机号</span>
          <span className="value">{user?.phone?.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}</span>
        </div>
        {user?.name && (
          <div className="info-row">
            <span className="label">姓名</span>
            <span className="value">{user.name.charAt(0)}**</span>
          </div>
        )}
        <div className="info-row">
          <span className="label">认证状态</span>
          <span className="value verified">
            {user?.is_realname ? '✓ 已实名' : '未实名'}
          </span>
        </div>
      </div>

      <div className="benefits">
        <h3>实名认证用户专属</h3>
        <ul>
          <li>导出司法级存证报告</li>
          <li>高风险操作拦截确认</li>
          <li>完整的审计证据链</li>
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
        {step === 'realname' && renderRealname()}
        {step === 'success' && renderSuccess()}
      </div>

      <div className="auth-brand">
        <h2>一鉴到底</h2>
        <p>AI 操作行为校验工具</p>
        <div className="features">
          <div className="feature">
            <span className="icon">🔒</span>
            <span>数据不出域</span>
          </div>
          <div className="feature">
            <span className="icon">📜</span>
            <span>司法级存证</span>
          </div>
          <div className="feature">
            <span className="icon">🔍</span>
            <span>常态化巡检</span>
          </div>
        </div>
      </div>
    </div>
  )
}