import { useState, useEffect } from 'react'
import './Login.css'

type Step = 'login' | 'realname' | 'dashboard'

interface User {
  id: string
  phone: string
  name?: string
  is_realname: boolean
}

interface APIKey {
  key_id: string
  api_key: string
  scopes: string[]
  created_at: string
  expires_at?: string
  is_active: boolean
}

export default function Login() {
  const [step, setStep] = useState<Step>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // 登录表单
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [countdown, setCountdown] = useState(0)
  
  // 实名认证
  const [name, setName] = useState('')
  const [idCard, setIdCard] = useState('')
  
  // 用户和 Key
  const [user, setUser] = useState<User | null>(null)
  const [apiKeys, setApiKeys] = useState<APIKey[]>([])
  const [showKey, setShowKey] = useState<string | null>(null)
  const [showRealnameModal, setShowRealnameModal] = useState(false)

  // API 地址
  const AUTH_API = 'http://localhost:9093'
  const SANDBOX_API = 'http://localhost:9092'

  // 检查登录状态
  useEffect(() => {
    const savedUser = localStorage.getItem('yjd_user')
    if (savedUser) {
      setUser(JSON.parse(savedUser))
      setStep('dashboard')
      fetchAPIKeys()
    }
  }, [])

  // 发送验证码
  const sendCode = async () => {
    if (!phone.match(/^1[3-9]\d{9}$/)) {
      setError('请输入正确的手机号')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${AUTH_API}/api/v1/auth/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
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
    } catch (e) {
      setError('网络错误')
    } finally {
      setLoading(false)
    }
  }

  // 验证登录
  const verifyLogin = async () => {
    if (!code.match(/^\d{6}$/)) {
      setError('请输入6位验证码')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${AUTH_API}/api/v1/auth/verify-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code })
      })

      const data = await response.json()

      if (data.success) {
        const userData = {
          id: data.user_id,
          phone: data.phone,
          is_realname: data.is_realname || false
        }
        
        setUser(userData)
        localStorage.setItem('yjd_user', JSON.stringify(userData))
        
        if (data.is_realname) {
          setStep('dashboard')
        } else {
          setStep('realname')
        }
      } else {
        setError(data.error || '验证失败')
      }
    } catch (e) {
      setError('网络错误')
    } finally {
      setLoading(false)
    }
  }

  // 实名认证
  const verifyRealname = async () => {
    if (!name.trim() || !idCard.match(/^\d{17}[\dXx]$/)) {
      setError('请填写正确的姓名和身份证号')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${AUTH_API}/api/v1/auth/verify-realname`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user?.id, name, id_card: idCard })
      })

      const data = await response.json()

      if (data.success) {
        const updatedUser = { ...user, is_realname: true, name: data.name }
        setUser(updatedUser)
        localStorage.setItem('yjd_user', JSON.stringify(updatedUser))
        setShowRealnameModal(false)
        setStep('dashboard')
      } else {
        setError(data.error || '认证失败')
      }
    } catch (e) {
      setError('网络错误')
    } finally {
      setLoading(false)
    }
  }

  // 获取 API Keys
  const fetchAPIKeys = async () => {
    try {
      const response = await fetch(`${SANDBOX_API}/api/v1/keys/list`)
      const data = await response.json()
      
      if (data.success) {
        setApiKeys(data.keys)
      }
    } catch (e) {
      console.error('获取 Key 失败')
    }
  }

  // 生成新 Key
  const generateKey = async (requireRealname: boolean = false) => {
    if (requireRealname && !user?.is_realname) {
      setShowRealnameModal(true)
      return
    }

    setLoading(true)
    
    try {
      const response = await fetch(`${SANDBOX_API}/api/v1/keys/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_id: user?.id,
          scopes: ['sandbox:read', 'sandbox:write'],
          expires_days: 30
        })
      })

      const data = await response.json()

      if (data.success) {
        fetchAPIKeys()
        setShowKey(data.api_key)
      } else {
        setError(data.error || '生成失败')
      }
    } catch (e) {
      setError('网络错误')
    } finally {
      setLoading(false)
    }
  }

  // 复制 Key
  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key)
    alert('已复制到剪贴板')
  }

  // 退出登录
  const logout = () => {
    localStorage.removeItem('yjd_user')
    setUser(null)
    setStep('login')
    setApiKeys([])
  }

  // 渲染登录
  const renderLogin = () => (
    <div className="login-card">
      <div className="login-header">
        <img src="/logo.png" alt="一鉴到底" className="logo" />
        <h1>登录 / 注册</h1>
        <p>获取您的 API Key 以使用桌面端</p>
      </div>

      <div className="login-form">
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
          <label>验证码</label>
          <div className="code-row">
            <input
              type="text"
              placeholder="6位验证码"
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
            />
            <button onClick={sendCode} disabled={countdown > 0 || loading}>
              {countdown > 0 ? `${countdown}s` : '获取'}
            </button>
          </div>
        </div>

        {error && <div className="error">{error}</div>}

        <button className="submit-btn" onClick={verifyLogin} disabled={loading}>
          {loading ? '登录中...' : '登录 / 注册'}
        </button>

        <p className="hint">新用户自动注册，登录后获取 API Key</p>
      </div>
    </div>
  )

  // 渲染实名认证
  const renderRealname = () => (
    <div className="login-card">
      <div className="login-header">
        <h1>实名认证</h1>
        <p>实名用户可使用更多高级功能</p>
      </div>

      <div className="login-form">
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
          🔒 数据本地存储，仅用于报告签名
        </div>

        {error && <div className="error">{error}</div>}

        <button className="submit-btn" onClick={verifyRealname} disabled={loading}>
          {loading ? '认证中...' : '完成认证'}
        </button>

        <button className="skip-btn" onClick={() => setStep('dashboard')}>
          暂不认证
        </button>
      </div>
    </div>
  )

  // 渲染控制台
  const renderDashboard = () => (
    <div className="login-card dashboard">
      <div className="dash-header">
        <div className="user-info">
          <span className="phone">{user?.phone?.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}</span>
          {user?.is_realname ? (
            <span className="badge verified">✓ 已实名</span>
          ) : (
            <button className="badge unverified" onClick={() => setShowRealnameModal(true)}>
              未实名 → 认证
            </button>
          )}
        </div>
        <button className="logout-btn" onClick={logout}>退出</button>
      </div>

      <h2>API Key 管理</h2>

      <div className="key-list">
        {apiKeys.length === 0 ? (
          <div className="empty">
            <p>您还没有 API Key</p>
            <p className="sub">生成 Key 后可用于桌面端激活</p>
          </div>
        ) : (
          apiKeys.map(key => (
            <div key={key.key_id} className="key-item">
              <div className="key-info">
                <span className="key-id">{key.key_id}</span>
                <span className="key-status">{key.is_active ? '有效' : '已禁用'}</span>
              </div>
              <div className="key-value">
                <code>
                  {showKey === key.api_key 
                    ? key.api_key 
                    : `${key.api_key.slice(0, 10)}...${key.api_key.slice(-10)}`
                }
                </code>
                <div className="key-actions">
                  <button onClick={() => setShowKey(showKey === key.api_key ? null : key.api_key)}>
                    {showKey === key.api_key ? '隐藏' : '显示'}
                  </button>
                  <button onClick={() => copyKey(key.api_key)}>复制</button>
                </div>
              </div>
              <div className="key-meta">
                <span>创建: {new Date(key.created_at).toLocaleDateString()}</span>
                {key.expires_at && <span>过期: {new Date(key.expires_at).toLocaleDateString()}</span>}
              </div>
            </div>
          ))
        )}
      </div>

      <button className="generate-btn" onClick={() => generateKey()} disabled={loading}>
        {loading ? '生成中...' : '+ 生成新 Key'}
      </button>

      {/* 实名专属功能 */}
      <div className="premium-features">
        <h3>
          {user?.is_realname ? '✓ 实名专属功能' : '🔒 实名专属功能'}
        </h3>
        
        <div className="features-grid">
          <div className={`feature-item ${user?.is_realname ? 'enabled' : 'disabled'}`}>
            <span className="icon">📜</span>
            <span className="text">导出司法级存证报告</span>
            {!user?.is_realname && <span className="lock">需实名</span>}
          </div>
          
          <div className={`feature-item ${user?.is_realname ? 'enabled' : 'disabled'}`}>
            <span className="icon">🔍</span>
            <span className="text">高风险操作实时拦截</span>
            {!user?.is_realname && <span className="lock">需实名</span>}
          </div>
          
          <div className={`feature-item ${user?.is_realname ? 'enabled' : 'disabled'}`}>
            <span className="icon">🔐</span>
            <span className="text">完整审计证据链</span>
            {!user?.is_realname && <span className="lock">需实名</span>}
          </div>
          
          <div className={`feature-item ${user?.is_realname ? 'enabled' : 'disabled'}`}>
            <span className="icon">⚖️</span>
            <span className="text">法律纠纷证据支持</span>
            {!user?.is_realname && <span className="lock">需实名</span>}
          </div>
        </div>

        {!user?.is_realname && (
          <button className="realname-btn" onClick={() => setShowRealnameModal(true)}>
            立即实名认证，解锁全部功能
          </button>
        )}
      </div>

      <div className="usage-guide">
        <h3>使用方法</h3>
        <ol>
          <li>复制 API Key</li>
          <li>下载并安装桌面端</li>
          <li>在设置页面粘贴 Key 激活</li>
        </ol>
        <a href="/download" className="download-link">下载桌面端 →</a>
      </div>
    </div>
  )

  // 实名认证弹窗
  const renderRealnameModal = () => (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>实名认证</h2>
        <p>认证后可使用全部高级功能</p>
        
        <div className="modal-form">
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
            🔒 数据本地存储，仅用于报告签名
          </div>

          {error && <div className="error">{error}</div>}

          <div className="modal-actions">
            <button className="cancel-btn" onClick={() => setShowRealnameModal(false)}>
              取消
            </button>
            <button className="submit-btn" onClick={verifyRealname} disabled={loading}>
              {loading ? '认证中...' : '完成认证'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="login-page">
      <div className="login-container">
        {step === 'login' && renderLogin()}
        {step === 'realname' && renderRealname()}
        {step === 'dashboard' && renderDashboard()}
      </div>

      <div className="login-brand">
        <h2>一鉴到底</h2>
        <p>AI 操作行为校验工具</p>
        <div className="features">
          <div className="feature">🔒 数据不出域</div>
          <div className="feature">📜 司法级存证</div>
          <div className="feature">🔍 常态化巡检</div>
        </div>
      </div>

      <footer className="login-footer">
        <p>© 2026 一鉴到底 版权所有 · 公司地址：湖南省湘潭市</p>
        <div className="icp-info">
          <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">湘ICP备2025151710号-3</a>
          <span className="divider">|</span>
          <a href="https://beian.mps.gov.cn/#/query/webSearch?code=43030402000431" target="_blank" rel="noreferrer">湘公网安备43030402000431号</a>
        </div>
      </footer>

      {showRealnameModal && renderRealnameModal()}
    </div>
  )
}