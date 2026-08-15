import { useState, useEffect } from 'react'
import { authService } from '../services/authService'
import { apiConfig } from '../config/apiConfig'
import './RealNameAuth.css'

interface RealNameStatus {
  success: boolean
  user_id?: number
  phone?: string
  name?: string
  is_realname?: boolean
  face_registered?: boolean
  created_at?: string
  message?: string
}

export default function RealNameAuth() {
  const [status, setStatus] = useState<RealNameStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [idCard, setIdCard] = useState('')

  const baseURL = apiConfig.getBaseURL()

  const authHeaders = () => {
    const token = authService.getToken()
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }
  }

  const loadStatus = async () => {
    try {
      const res = await fetch(`${baseURL}/api/auth/realname/status/`, {
        method: 'GET',
        headers: authHeaders(),
      })
      const data: RealNameStatus = await res.json()
      setStatus(data)
    } catch (err) {
      console.error('[实名认证] 查询状态失败:', err)
      setError('无法加载实名认证状态')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStatus()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // 前端校验
    if (!name || name.trim().length < 2) {
      setError('请输入正确的姓名（至少2个字符）')
      return
    }
    const idCardPattern = /^[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/
    if (!idCardPattern.test(idCard)) {
      setError('请输入正确的身份证号')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`${baseURL}/api/auth/realname/verify/`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ name: name.trim(), id_card: idCard }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setError(data.error || '实名认证失败，请重试')
      } else {
        setStatus({ success: true, is_realname: true, name: data.name, message: data.message })
      }
    } catch (err) {
      console.error('[实名认证] 提交失败:', err)
      setError('网络错误，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  const maskName = (n?: string) => {
    if (!n) return ''
    if (n.length <= 1) return n
    return n[0] + '*'.repeat(Math.max(n.length - 1, 1))
  }

  const maskIdCard = () => {
    // 后端仅加密存储身份证后4位，状态接口不返回，统一展示为脱敏占位
    return '已加密存储'
  }

  if (loading) {
    return (
      <div className="realname-page">
        <div className="realname-loading">正在加载认证状态...</div>
      </div>
    )
  }

  const isVerified = Boolean(status?.is_realname)

  return (
    <div className="realname-page">
      <div className="realname-card">
        <div className="realname-header">
          <h2>实名认证</h2>
          <p>为保障您的账户安全与审计可信度，请完成实名认证</p>
        </div>

        {error && <div className="realname-error">{error}</div>}

        {isVerified ? (
          <div className="realname-verified">
            <div className="verified-icon">✓</div>
            <h3>认证已完成</h3>
            <p className="verified-hint">您的账户已完成实名认证</p>
            <div className="verified-info">
              <div className="info-row">
                <span className="info-label">真实姓名</span>
                <span className="info-value">{maskName(status?.name)}</span>
              </div>
              <div className="info-row">
                <span className="info-label">认证状态</span>
                <span className="info-value verified-text">已认证</span>
              </div>
              <div className="info-row">
                <span className="info-label">证件信息</span>
                <span className="info-value">{maskIdCard()}</span>
              </div>
              {status?.created_at && (
                <div className="info-row">
                  <span className="info-label">认证时间</span>
                  <span className="info-value">{new Date(status.created_at).toLocaleDateString()}</span>
                </div>
              )}
            </div>
            <div className="verified-note">
              实名信息仅用于安全验证，身份证号仅加密存储后4位，请放心。
            </div>
          </div>
        ) : (
          <form className="realname-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>真实姓名</label>
              <input
                type="text"
                placeholder="请输入与证件一致的姓名"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>身份证号</label>
              <input
                type="text"
                placeholder="请输入18位身份证号"
                value={idCard}
                onChange={(e) => setIdCard(e.target.value)}
                maxLength={18}
              />
            </div>

            <div className="realname-security">
              <span className="shield">🔒</span>
              <span>身份证号仅加密存储后4位，用于安全校验，不会泄露完整信息。</span>
            </div>

            <button type="submit" className="submit-btn" disabled={submitting}>
              {submitting ? '提交中...' : '提交认证'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
