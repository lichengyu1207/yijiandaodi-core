import { useState } from 'react'
import './Download.css'

export default function Download() {
  const [os, setOs] = useState<'windows' | 'macos' | 'linux'>('windows')

  const downloads = {
    windows: {
      name: 'Windows',
      icon: '🪟',
      version: 'v2.0.0',
      size: '85 MB',
      file: 'yijiandaodi-desktop-2.0.0-setup.exe',
      requirements: 'Windows 10/11, 64-bit'
    },
    macos: {
      name: 'macOS',
      icon: '🍎',
      version: 'v2.0.0',
      size: '92 MB',
      file: 'yijiandaodi-desktop-2.0.0.dmg',
      requirements: 'macOS 11+ (Intel/Apple Silicon)'
    },
    linux: {
      name: 'Linux',
      icon: '🐧',
      version: 'v2.0.0',
      size: '88 MB',
      file: 'yijiandaodi-desktop-2.0.0.AppImage',
      requirements: 'Ubuntu 20.04+ / Debian 11+'
    }
  }

  const current = downloads[os]

  return (
    <div className="download-page">
      <div className="download-header">
        <a href="/" className="logo">
          <img src="/logo.png" alt="一鉴到底" />
          <span>一鉴到底</span>
        </a>
        <nav>
          <a href="/">首页</a>
          <a href="/docs">文档</a>
          <a href="/download" className="active">下载</a>
        </nav>
      </div>

      <div className="download-content">
        <h1>下载桌面端</h1>
        <p className="subtitle">本地运行 · 数据不出域 · 常态化巡检</p>

        <div className="os-tabs">
          {(Object.keys(downloads) as Array<keyof typeof downloads>).map(key => (
            <button
              key={key}
              className={`os-tab ${os === key ? 'active' : ''}`}
              onClick={() => setOs(key)}
            >
              <span className="icon">{downloads[key].icon}</span>
              <span className="name">{downloads[key].name}</span>
            </button>
          ))}
        </div>

        <div className="download-card">
          <div className="card-header">
            <div className="icon-large">{current.icon}</div>
            <div className="info">
              <h2>{current.name} 版本</h2>
              <p className="version">{current.version}</p>
            </div>
          </div>

          <div className="card-details">
            <div className="detail-row">
              <span className="label">文件大小</span>
              <span className="value">{current.size}</span>
            </div>
            <div className="detail-row">
              <span className="label">系统要求</span>
              <span className="value">{current.requirements}</span>
            </div>
            <div className="detail-row">
              <span className="label">文件名</span>
              <span className="value">{current.file}</span>
            </div>
          </div>

          <button className="download-btn">
            立即下载
          </button>

          <p className="hash">
            SHA256: a1b2c3d4e5f6...
          </p>
        </div>

        <div className="features">
          <h3>核心功能</h3>
          <div className="feature-grid">
            <div className="feature">
              <span className="icon">🔍</span>
              <span className="text">常态化巡检</span>
            </div>
            <div className="feature">
              <span className="icon">🔒</span>
              <span className="text">数据不出域</span>
            </div>
            <div className="feature">
              <span className="icon">📜</span>
              <span className="text">司法级存证</span>
            </div>
            <div className="feature">
              <span className="icon">🤖</span>
              <span className="text">AI 行为分析</span>
            </div>
          </div>
        </div>

        <div className="migrated-notice">
          <h3>📋 功能迁移说明</h3>
          <p>原有网页端的以下功能已迁移至桌面端「常态化巡检」模块：</p>
          <ul>
            <li>文案鉴别</li>
            <li>代码安全分析</li>
            <li>语法检查</li>
            <li>图片溯源</li>
            <li>视频取证</li>
            <li>Deepfake 检测</li>
          </ul>
          <p className="reason">原因：这些功能需要本地运行，确保数据不出域。</p>
        </div>
      </div>

      <div className="download-footer">
        <p>© 2026 一鉴到底 版权所有 · 公司地址：湖南省湘潭市</p>
        <div className="icp-info">
          <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">湘ICP备2025151710号-3</a>
          <span className="divider">|</span>
          <a href="https://beian.mps.gov.cn/#/query/webSearch?code=43030402000431" target="_blank" rel="noreferrer">湘公网安备43030402000431号</a>
        </div>
        <div className="links">
          <a href="/docs">API 文档</a>
          <a href="#">用户协议</a>
          <a href="#">隐私政策</a>
        </div>
      </div>
    </div>
  )
}