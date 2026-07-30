import './BrandHome.css'

export default function BrandHome() {
  return (
    <div className="brand-home">
      {/* 导航栏 */}
      <nav className="navbar">
        <div className="nav-content">
          <a href="/" className="logo">
            <img src="/logo.png" alt="一鉴到底" />
            <span>一鉴到底</span>
          </a>
          <div className="nav-links">
            <a href="/">首页</a>
            <a href="/docs">文档</a>
            <a href="/download">下载</a>
            <a href="/login" className="login-btn">登录</a>
          </div>
        </div>
      </nav>

      {/* Hero 区域 */}
      <section className="hero">
        <div className="hero-content">
          <h1>一鉴到底</h1>
          <p className="tagline">本地运行的 AI 操作行为校验工具</p>
          <p className="description">
            解决 AI Agent 的三大风险：操作黑盒、授权模糊、证据缺失
          </p>
          <div className="hero-btns">
            <a href="/download" className="btn primary">下载桌面端</a>
            <a href="/docs" className="btn secondary">查看文档</a>
          </div>
        </div>
      </section>

      {/* 核心价值 */}
      <section className="values">
        <div className="section-content">
          <h2>核心价值</h2>
          <div className="value-cards">
            <div className="value-card">
              <div className="icon">🔍</div>
              <h3>操作白盒化</h3>
              <p>完整记录 AI Agent 的操作过程，每个决策都可追溯</p>
            </div>
            <div className="value-card">
              <div className="icon">🔐</div>
              <h3>数据不出域</h3>
              <p>本地推理，数据不上云，确保隐私安全</p>
            </div>
            <div className="value-card">
              <div className="icon">📜</div>
              <h3>司法级存证</h3>
              <p>不可篡改的审计日志，可用于合规审计和司法存证</p>
            </div>
          </div>
        </div>
      </section>

      {/* Skill API */}
      <section className="skills">
        <div className="section-content">
          <h2>Skill API</h2>
          <p className="section-desc">14 个安全能力模块，支持本地调用和对外开放</p>
          <div className="skill-grid">
            <div className="skill-item">
              <span className="skill-icon">🛡️</span>
              <span className="skill-name">ASS 安全网关</span>
            </div>
            <div className="skill-item">
              <span className="skill-icon">💻</span>
              <span className="skill-name">代码风险检测</span>
            </div>
            <div className="skill-item">
              <span className="skill-icon">🙈</span>
              <span className="skill-name">数据脱敏引擎</span>
            </div>
            <div className="skill-item">
              <span className="skill-icon">✍️</span>
              <span className="skill-name">输出签名验签</span>
            </div>
            <div className="skill-item">
              <span className="skill-icon">🔗</span>
              <span className="skill-name">HashChain 审计存证</span>
            </div>
            <div className="skill-item">
              <span className="skill-icon">📋</span>
              <span className="skill-name">合规报告生成</span>
            </div>
          </div>
          <a href="/docs" className="view-all">查看全部 14 个 Skill →</a>
        </div>
      </section>

      {/* 用户群体 */}
      <section className="users">
        <div className="section-content">
          <h2>面向用户</h2>
          <div className="user-cards">
            <div className="user-card">
              <div className="user-icon">👨‍💻</div>
              <h3>开发者</h3>
              <p>确保 AI 编程助手的安全运行</p>
            </div>
            <div className="user-card">
              <div className="user-icon">🤖</div>
              <h3>Agent 使用者</h3>
              <p>监控和审计 AI Agent 行为</p>
            </div>
            <div className="user-card">
              <div className="user-icon">🏢</div>
              <h3>企业</h3>
              <p>满足合规要求，保护数据安全</p>
            </div>
          </div>
        </div>
      </section>

      {/* 页脚 */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-top">
            <div className="footer-brand">
              <img src="/logo.png" alt="一鉴到底" />
              <span>一鉴到底</span>
            </div>
            <div className="footer-links">
              <div className="link-group">
                <h4>产品</h4>
                <a href="/download">下载</a>
                <a href="/docs">文档</a>
              </div>
              <div className="link-group">
                <h4>法律</h4>
                <a href="#">用户协议</a>
                <a href="#">隐私政策</a>
              </div>
            </div>
          </div>
          
          <div className="footer-bottom">
            <div className="company-info">
              <p>© 2026 一鉴到底 版权所有</p>
              <p>公司地址：湖南省湘潭市</p>
            </div>
            <div className="icp-info">
              <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">
                湘ICP备2025151710号-3
              </a>
              <span className="divider">|</span>
              <a 
                href="https://beian.mps.gov.cn/#/query/webSearch?code=43030402000431" 
                target="_blank" 
                rel="noreferrer"
              >
                湘公网安备43030402000431号
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}