import { useEffect, useState } from 'react'
import { authService } from '../services/authService'

interface RegUser {
  id: number
  username: string
  email: string
  role: string
  is_active: boolean
  date_joined: string
  last_login: string
  is_staff?: boolean
  is_superuser?: boolean
}

/** 邮箱脱敏（隐私最小化）：保留首字符与域名，中间打码 */
function maskEmail(email: string | null | undefined): string {
  if (!email) return '-'
  const at = email.indexOf('@')
  if (at <= 1) return '***' + email.slice(at)
  return email.slice(0, 1) + '***' + email.slice(at)
}

const ROLE_LABEL: Record<string, string> = {
  super_admin: '超级管理员',
  admin: '管理员',
  editor: '编辑',
  viewer: '访客',
}

function fmtDate(v?: string | null): string {
  if (!v) return '-'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return v
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function UserRegistrations() {
  const [users, setUsers] = useState<RegUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!authService.isAdmin()) {
      setLoading(false)
      setError('当前账号无管理员权限，无法查看用户注册记录。')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const list = await authService.listUsers()
        if (!cancelled) setUsers(list as RegUser[])
      } catch (e: any) {
        if (!cancelled) setError(e?.message || '获取用户注册记录失败')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="page-container">
      <h2>用户注册记录</h2>
      <p className="page-subtitle">
        本地实例全部注册账号（仅管理员可见，邮箱已脱敏）。登录与操作行为可在「系统设置 → 操作日志」进一步追踪。
      </p>

      {loading && <div className="page-empty">加载中...</div>}
      {!loading && error && <div className="page-empty">{error}</div>}

      {!loading && !error && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: 'var(--text-tertiary)' }}>
              <th style={th}>ID</th>
              <th style={th}>用户名</th>
              <th style={th}>邮箱</th>
              <th style={th}>角色</th>
              <th style={th}>状态</th>
              <th style={th}>注册时间</th>
              <th style={th}>最后登录</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={{ borderTop: '1px solid var(--border-primary)' }}>
                <td style={td}>{u.id}</td>
                <td style={td}>{u.username}</td>
                <td style={td}>{maskEmail(u.email)}</td>
                <td style={td}>{ROLE_LABEL[u.role] ?? u.role}</td>
                <td style={td}>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 12,
                      background: u.is_active ? 'rgba(52,199,89,0.15)' : 'rgba(255,59,48,0.15)',
                      color: u.is_active ? '#2e7d32' : '#c62828',
                    }}
                  >
                    {u.is_active ? '正常' : '已禁用'}
                  </span>
                </td>
                <td style={td}>{fmtDate(u.date_joined)}</td>
                <td style={td}>{fmtDate(u.last_login)}</td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={7} style={{ ...td, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                  暂无注册用户
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )
}

const th: React.CSSProperties = { padding: '8px 10px', fontWeight: 500 }
const td: React.CSSProperties = { padding: '8px 10px' }