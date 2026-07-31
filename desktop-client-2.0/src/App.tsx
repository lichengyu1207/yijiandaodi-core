import { BrowserRouter, Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Dashboard from './pages/Dashboard'
import Evidence from './pages/Evidence'
import Auth from './pages/Auth'
import Settings from './pages/Settings'
import SyncSettings from './pages/SyncSettings'
import DesktopPet from './components/DesktopPet'
import { authService } from './services/authService'
import './index.css'

const NAV_ITEMS = [
  { path: '/', label: '实时审计', icon: 'audit' },
  { path: '/evidence', label: '存证中心', icon: 'evidence' },
  { path: '/auth', label: '实名认证', icon: 'auth' },
  { path: '/settings', label: '系统设置', icon: 'settings' },
  { path: '/sync', label: '云端同步', icon: 'sync' },
]

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

function Header({ username, onLogout }: { username?: string; onLogout: () => void }) {
  const location = useLocation()
  
  const getPageTitle = () => {
    const item = NAV_ITEMS.find(n => n.path === location.pathname)
    return item?.label || '一鉴到底'
  }
  
  return (
    <header className="app-header" style={{ height: 48 }}>
      <h1 className="header-title">{getPageTitle()}</h1>
      <div className="header-actions">
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

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // 检查是否已登录
        if (authService.isAuthenticated()) {
          // 验证Token是否有效
          const isValid = await authService.validateToken()
          
          if (isValid) {
            // Token有效，自动登录成功
            setIsAuthenticated(true)
            setCurrentUser(authService.getCurrentUser())
          } else {
            // Token无效，尝试刷新
            const refreshed = await authService.refreshToken()
            if (refreshed) {
              setIsAuthenticated(true)
              setCurrentUser(authService.getCurrentUser())
            } else {
              setIsAuthenticated(false)
            }
          }
        }
      } catch (error) {
        console.error('认证检查失败:', error)
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
                <>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/evidence" element={<Evidence />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/sync" element={<SyncSettings />} />
                  <Route path="/auth" element={<Navigate to="/" replace />} />
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
        {isAuthenticated && <DesktopPet />}
      </div>
    </BrowserRouter>
  )
}