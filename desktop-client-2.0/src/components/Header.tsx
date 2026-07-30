import { useState } from 'react'
import { authService } from '../services/authService'
import './Header.css'

interface HeaderProps {
  username?: string
  onLogout?: () => void
}

export default function Header({ username, onLogout }: HeaderProps) {
  const [showUserMenu, setShowUserMenu] = useState(false)

  const handleLogout = async () => {
    try {
      await authService.logout()
      if (onLogout) {
        onLogout()
      }
    } catch (error) {
      console.error('登出失败:', error)
      // 即使登出失败，也要清除本地状态
      if (onLogout) {
        onLogout()
      }
    }
  }

  return (
    <header className="header">
      <div className="header-left">
        <div className="logo">
          <img src="/yi.jpg" alt="一鉴到底" className="logo-img" />
          <span className="logo-text">一鉴到底</span>
        </div>
      </div>

      <div className="header-right">
        {/* 用户信息 */}
        <div className="user-info">
          <button
            className="user-button"
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            <div className="user-avatar">
              {username ? username.charAt(0).toUpperCase() : 'U'}
            </div>
            <span className="user-name">{username || '用户'}</span>
            <span className="dropdown-icon">▼</span>
          </button>

          {/* 下拉菜单 */}
          {showUserMenu && (
            <div className="user-menu">
              <div className="menu-header">
                <div className="menu-avatar">
                  {username ? username.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="menu-user-info">
                  <div className="menu-username">{username || '用户'}</div>
                  <div className="menu-role">AI Agent安全监控</div>
                </div>
              </div>

              <div className="menu-divider"></div>

              <button className="menu-item" onClick={() => setShowUserMenu(false)}>
                <span className="menu-icon">👤</span>
                <span>个人设置</span>
              </button>

              <button className="menu-item" onClick={() => setShowUserMenu(false)}>
                <span className="menu-icon">📊</span>
                <span>使用统计</span>
              </button>

              <button className="menu-item" onClick={() => setShowUserMenu(false)}>
                <span className="menu-icon">🔗</span>
                <span>数据同步</span>
              </button>

              <div className="menu-divider"></div>

              <button className="menu-item logout-item" onClick={handleLogout}>
                <span className="menu-icon">🚪</span>
                <span>退出登录</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 点击其他区域关闭菜单 */}
      {showUserMenu && (
        <div
          className="menu-backdrop"
          onClick={() => setShowUserMenu(false)}
        ></div>
      )}
    </header>
  )
}