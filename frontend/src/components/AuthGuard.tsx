import { useEffect, useState, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuthStore } from '@/store/useAuthStore';

interface AuthGuardProps {
  children: React.ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const fetchUserInfo = useAuthStore((state) => state.fetchUserInfo);
  const location = useLocation();
  const lastFetchTime = useRef<number>(0);

  useEffect(() => {
    // httpOnly Cookie 模式：通过 zustand 状态 + 后端接口验证身份
    const verify = async () => {
      // 如果 zustand 已有用户信息，检查是否需要同步最新数据（每5分钟同步一次）
      if (isAuthenticated()) {
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000;
        // 每次进入受保护页面时，如果距离上次获取超过5分钟，则重新获取用户信息
        if (now - lastFetchTime.current > fiveMinutes) {
          try {
            await fetchUserInfo();
            lastFetchTime.current = now;
          } catch (error) {
            // 获取失败，session已失效，清除状态并跳转登录页
            console.error('Session失效，需要重新登录');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('auth-storage');
            // 强制跳转登录页
            window.location.href = '/login';
            return;
          }
        }
        setLoading(false);
        return;
      }
      // 否则尝试从后端获取用户信息来验证 Cookie 是否有效
      try {
        await fetchUserInfo();
        lastFetchTime.current = Date.now();
        setLoading(false);
      } catch (error) {
        // Cookie 无效或过期，清除状态并跳转登录页
        console.error('登录状态失效，需要重新登录');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('auth-storage');
        setLoading(false);
        // 不在这里跳转，由下面的 isAuthenticated() 判定后跳转
      }
    };
    verify();
  }, [location.pathname]); // 每次路由变化时重新验证

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        flexDirection: 'column',
        gap: 16,
      }}>
        <Spin size="large" />
        <span style={{ color: '#86909C', fontSize: 14 }}>正在验证身份...</span>
      </div>
    );
  }

  if (!isAuthenticated()) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  /* 所有已登录用户均可访问 /admin，RBAC 由侧边菜单权限控制可见功能 */
  return <>{children}</>;
};

export default AuthGuard;
