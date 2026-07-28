import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, Menu as MenuIcon, X, LogIn, FileText, ShoppingCart, MessageSquare, Home, DollarSign, Zap, User, LogOut } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';

const NAV_ITEMS = [
  { key: '/#products', label: '产品' },
  { key: '/execution-center', label: '内容' },
  { key: '/behavior-monitor', label: '行为监控' },
  { key: '/xialia', label: '虾聊' },
  { key: '/about', label: '关于我们' },
];

/* 移动端底部TabBar配置 */
const TAB_BAR_ITEMS = [
  { key: '/', label: '首页', icon: Home },
  { key: '/pricing', label: '定价', icon: DollarSign },
  { key: '/detect', label: '检测', icon: Zap, isCenter: true },
  { key: '/my-reports', label: '我的', icon: User },
];

const FrontHeader: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(max-width:768px)').matches;
    }
    return false;
  });
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* 移动端断点监听 */
  useEffect(() => {
    const mql = window.matchMedia('(max-width:768px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  /* 判断TabBar哪个tab处于激活状态 */
  const getActiveTabKey = () => {
    const path = location.pathname;
    if (path === '/') return '/';
    if (path.startsWith('/pricing')) return '/pricing';
    if (path.startsWith('/detect') || path.startsWith('/agent')) return '/detect';
    if (path.startsWith('/my-reports') || path.startsWith('/order-center') || path.startsWith('/login')) return '/my-reports';
    return '';
  };

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const headerContent = (
    <header
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        height: isMobile ? 52 : 72,
        backgroundColor: scrolled ? (isMobile ? 'rgba(255,255,255,0.92)' : '#FFFFFF') : (isMobile ? 'rgba(255,255,255,0.92)' : '#FFFFFF'),
        borderBottom: `1px solid ${scrolled ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.05)'}`,
        boxShadow: scrolled ? '0 2px 16px rgba(0,0,0,0.06)' : 'none',
        transition: 'all 0.3s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backdropFilter: isMobile ? 'blur(12px)' : 'none',
        WebkitBackdropFilter: isMobile ? 'blur(12px)' : 'none',
        className: 'front-header-main',
      }}
    >
      <div style={{
        maxWidth: 1440,
        width: '100%',
        padding: isMobile ? '0 16px' : '0 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxSizing: 'border-box',
      }}>
        <Link to="/" style={{
          display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 12,
          textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          <img src="/logo.png" alt="一鉴到底" style={{ height: isMobile ? 32 : 42, width: isMobile ? 32 : 42, objectFit: 'contain' }} />
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
            <span style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: '#165DFF', letterSpacing: '-0.5px' }}>一鉴到底</span>
            {!isMobile && (
              <span style={{ fontSize: 11, color: '#86909C', fontWeight: 400, letterSpacing: '0.5px' }}>让安全人人可鉴</span>
            )}
          </div>
        </Link>

        <button
          className="mobile-hamburger"
          onClick={() => setMobileOpen(true)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#475569',
            padding: 8,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MenuIcon size={22} />
        </button>

        <nav style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 16, listStyle: 'none', margin: 0, padding: 0 }} className="desktop-nav">
          {NAV_ITEMS.map((item) => (
            <Link key={item.key} to={item.key} style={{
              fontSize: 16, fontWeight: isActive(item.key) ? 700 : 500,
              color: isActive(item.key) ? '#165DFF' : '#475569',
              textDecoration: 'none', padding: '8px 0',
              transition: 'color 0.2s ease', cursor: 'pointer', whiteSpace: 'nowrap',
            }}>{item.label}</Link>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0 }} className="header-actions">
          <Link to="/my-reports" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 10, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 500, textDecoration: 'none' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F0F5FF'; e.currentTarget.style.color = '#165DFF'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#475569'; }}>
            <FileText size={16} /> 我的报告
          </Link>
          <Link to="/order-center" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 10, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 500, textDecoration: 'none' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#FFF7ED'; e.currentTarget.style.color = '#FF7D00'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#475569'; }}>
            <ShoppingCart size={16} /> 订单中心
          </Link>
          <Link to="/agent" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 10, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 500, textDecoration: 'none' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F0FDF4'; e.currentTarget.style.color = '#0F766E'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#475569'; }}>
            <MessageSquare size={16} /> Agent 执行
          </Link>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 10, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => navigate('/search')}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#F1F5F9'; e.currentTarget.style.color = '#165DFF'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#475569'; }}>
            <Search size={20} />
          </button>
          <Link to="/login" style={{ fontSize: 15, fontWeight: 600, color: '#0F172A', textDecoration: 'none', padding: '8px 20px', borderRadius: 8, border: '1.5px solid #E2E8F0', whiteSpace: 'nowrap', transition: 'all 0.2s ease' }}
            onMouseEnter={(e) => { (e.target as HTMLAnchorElement).style.borderColor = '#2563EB'; (e.target as HTMLAnchorElement).style.color = '#2563EB'; }}
            onMouseLeave={(e) => { (e.target as HTMLAnchorElement).style.borderColor = '#E5E6EB'; (e.target as HTMLAnchorElement).style.color = '#1D2129'; }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><LogIn size={15} /> 登录</span>
          </Link>
        </div>
      </div>
      {mobileOpen && (
        <>
          <div onClick={() => setMobileOpen(false)} style={{ display: 'block', position: 'fixed', top: isMobile ? 52 : 72, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.3)', zIndex: 9999 }} />
          <div style={{ display: 'flex', position: 'fixed', top: isMobile ? 52 : 72, left: 0, right: 0, backgroundColor: '#FFFFFF', borderBottom: '1px solid #E5E6EB', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', zIndex: 9999, flexDirection: 'column', padding: '16px 24px', gap: 0 }}>
            {NAV_ITEMS.map((item) => (
              <Link key={item.key} to={item.key} onClick={() => setMobileOpen(false)} style={{ fontSize: 16, fontWeight: isActive(item.key) ? 600 : 400, color: isActive(item.key) ? '#2563EB' : '#0F172A', textDecoration: 'none', padding: '14px 0', borderBottom: '1px solid #F1F5F9', width: '100%', boxSizing: 'border-box' }}>{item.label}</Link>
            ))}
          </div>
        </>
      )}
    </header>
  );

  /* 移动端底部TabBar */
  const activeTabKey = getActiveTabKey();
  const tabBarContent = isMobile ? (
    <div className="mobile-tab-bar" style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      height: 'calc(56px + env(safe-area-inset-bottom))',
      paddingBottom: 'env(safe-area-inset-bottom)',
      backgroundColor: '#FFFFFF',
      borderTop: '1px solid #E5E6EB',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-around',
      zIndex: 99998,
      boxShadow: '0 -2px 12px rgba(0,0,0,0.06)',
    }}>
      {TAB_BAR_ITEMS.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTabKey === tab.key;
        const isCenter = (tab as any).isCenter === true;

        if (isCenter) {
          return (
            <button
              key={tab.key}
              onClick={() => navigate(tab.key)}
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: '#165DFF',
                border: 'none',
                cursor: 'pointer',
                color: '#FFFFFF',
                display: 'flex',
                flexDirection: 'column' as const,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0,
                marginTop: -8,
                boxShadow: '0 4px 12px rgba(22,93,255,0.35)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                flex: 'none',
                position: 'relative' as const,
              }}
            >
              <Icon size={24} strokeWidth={2} />
            </button>
          );
        }

        return (
          <button
            key={tab.key}
            onClick={() => navigate(tab.key)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column' as const,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              padding: '4px 0',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: isActive ? '#165DFF' : '#86909C',
              fontSize: 10,
              fontWeight: isActive ? 600 : 400,
              minHeight: 44,
              transition: 'color 0.2s ease',
            }}
          >
            <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  ) : null;

  /* 移动端底部登录/用户入口（TabBar 下方） */
  const mobileAuthBar = isMobile ? (
    <div style={{
      position: 'fixed',
      bottom: 'calc(56px + env(safe-area-inset-bottom))',
      left: 0,
      right: 0,
      height: 36,
      backgroundColor: '#FAFBFC',
      borderTop: '1px solid #F0F1F3',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99997,
      padding: '0 16px',
      gap: 16,
    }}>
      {isAuthenticated() ? (
        <>
          <span style={{ fontSize: 12, color: '#86909C', flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.username || '已登录'}
          </span>
          <button
            onClick={() => { logout(); navigate('/'); }}
            style={{ fontSize: 12, color: '#FF4D4F', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <LogOut size={14} /> 退出
          </button>
        </>
      ) : (
        <>
          <Link to="/login" style={{ fontSize: 13, color: '#165DFF', fontWeight: 500, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
            <LogIn size={14} /> 登录 / 注册
          </Link>
        </>
      )}
    </div>
  ) : null;

  if (typeof document !== 'undefined') {
    return (
      <>
        {createPortal(headerContent, document.body)}
        {tabBarContent && createPortal(tabBarContent, document.body)}
        {mobileAuthBar && createPortal(mobileAuthBar, document.body)}
      </>
    );
  }
  return null;
};

export default FrontHeader;
