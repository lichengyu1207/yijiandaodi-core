import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout } from 'antd';
import Header from '@/components/Header';
import SiderMenu from '@/components/Sidebar';
import { useAuthStore } from '@/store/useAuthStore';
import './AdminLayout.css';

const { Content } = Layout;

const AdminLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  /* 移动端断点检测 */
  useEffect(() => {
    const mql = window.matchMedia('(max-width:768px)');
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  /* 移动端默认折叠侧边栏 */
  useEffect(() => {
    if (isMobile && !collapsed) setCollapsed(true);
  }, [isMobile]);

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
    if (isMobile) setMobileOpen(false);
  };

  return (
    <Layout className="admin-layout">
      <SiderMenu
        collapsed={isMobile ? false : collapsed}
        onCollapse={setCollapsed}
        selectedKeys={[location.pathname]}
        onClick={handleMenuClick}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <Layout className={`admin-right ${mobileOpen ? 'admin-right--shifted' : ''} ${isMobile ? 'admin-right--mobile' : ''}`}>
        <Header
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
          user={user}
          onLogout={handleLogout}
          onMobileToggle={() => setMobileOpen(!mobileOpen)}
          mobileOpen={mobileOpen}
          isMobile={isMobile}
        />
        <Content className="admin-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};

export default AdminLayout;
