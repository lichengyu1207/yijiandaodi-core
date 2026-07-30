import { Link } from 'react-router-dom';
import { Mail, MapPin, GitFork, MessageCircle, Globe } from 'lucide-react';
import './FrontFooter.css';

const FOOTER_LINKS = {
  about: [
    { label: '关于我们', to: '/about' },
    { label: '团队介绍', to: '/about/team' },
    { label: '发展历程', to: '/about/history' },
    { label: '加入我们', to: '/about/join' },
  ],
  quick: [
    { label: '品牌首页', to: '/' },
    { label: '内容中心', to: '/execution-center' },
    { label: 'AI 对话', to: '/agent' },
    { label: '虾聊 Skill', to: '/xialia' },
    { label: 'API 计费', to: '/developer' },
    { label: '帮助中心', to: '/help' },
  ],
};

const STYLES = {
  footer: {
    backgroundColor: '#1E293B',
    color: '#94A3B8',
    padding: '48px 24px 0',
    marginTop: 'auto',
    className: 'front-footer',
  },
  container: {
    maxWidth: 1400,
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 40,
    paddingBottom: 40,
  },
  column: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
  },
  columnTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: '#F1F5F9',
    marginBottom: 4,
    letterSpacing: '0.3px',
  },
  link: {
    fontSize: 14,
    color: '#94A3B8',
    textDecoration: 'none',
    transition: 'color 0.2s ease',
    padding: '2px 0',
  },
  contactItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    fontSize: 14,
    color: '#94A3B8',
  },
  socials: {
    display: 'flex',
    gap: 12,
    marginTop: 4,
  },
  socialIcon: {
    width: 38,
    height: 38,
    borderRadius: 6,
    backgroundColor: '#334155',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#94A3B8',
    textDecoration: 'none',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    border: 'none',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    maxWidth: 1400,
    margin: '0 auto',
  },
  copyright: {
    maxWidth: 1400,
    margin: '0 auto',
    padding: '20px 0',
    textAlign: 'center' as const,
    fontSize: 13,
    color: '#64748B',
  },
} as const;

const FrontFooter: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer style={STYLES.footer}>
      <div style={STYLES.container} className="footer-grid">
        <div style={STYLES.column}>
          <h3 style={STYLES.columnTitle}>关于我们</h3>
          <p style={{ fontSize: 14, lineHeight: 1.7 }}>
            一鉴到底 — 多智能体协同校验平台。基于七层架构执行引擎，为用户提供 AI 安全审计、内容真实性核验、Skill 生态市场等一站式智能服务。
          </p>
        </div>

        <div style={STYLES.column}>
          <h3 style={STYLES.columnTitle}>快速链接</h3>
          {FOOTER_LINKS.quick.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              style={STYLES.link}
              onMouseEnter={(e) => {
                (e.target as HTMLAnchorElement).style.color = '#FFFFFF';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLAnchorElement).style.color = '#94A3B8';
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div style={STYLES.column}>
          <h3 style={STYLES.columnTitle}>联系方式</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span style={STYLES.contactItem} className="contact-item">
              <Mail size={16} style={{ flexShrink: 0 }} />
              <a href="mailto:lichengyu@fangsuanyun.cn" style={{ color: '#94A3B8', textDecoration: 'none' }}>
                lichengyu@fangsuanyun.cn
              </a>
            </span>
            <span style={STYLES.contactItem} className="contact-item">
              <MapPin size={16} style={{ flexShrink: 0 }} />
              湖南省湘潭市
            </span>
          </div>
        </div>

        <div style={STYLES.column}>
          <h3 style={STYLES.columnTitle}>关注我们</h3>
          <p style={{ fontSize: 14, lineHeight: 1.7 }}>
            关注我们，获取多智能体协同校验最新动态与 Skill 生态更新。
          </p>
          <div style={STYLES.socials}>
            {[
              { icon: <GitFork size={18} />, label: 'GitHub' },
              { icon: <MessageCircle size={18} />, label: '社区' },
              { icon: <Globe size={18} />, label: '官网' },
            ].map((social) => (
              <a
                key={social.label}
                href="#"
                style={STYLES.socialIcon}
                className="social-icon"
                aria-label={social.label}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#2563EB';
                  e.currentTarget.style.color = '#FFFFFF';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#334155';
                  e.currentTarget.style.color = '#94A3B8';
                }}
              >
                {social.icon}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div style={STYLES.divider} className="footer-divider" />

      <div style={STYLES.copyright} className="footer-copyright">
        &copy; {currentYear} 一鉴到底 All Rights Reserved. |{' '}
        <a
          href="https://beian.miit.gov.cn/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#94A3B8', textDecoration: 'none' }}
        >
          湘ICP备2025151710号-3
        </a>
        {' | '}
        <a
          href="https://beian.mps.gov.cn/#/query/webSearch?code=43030402000431"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#94A3B8', textDecoration: 'none' }}
        >
          湘公网安备43030402000431号
        </a>
      </div>
    </footer>
  );
};

export default FrontFooter;
