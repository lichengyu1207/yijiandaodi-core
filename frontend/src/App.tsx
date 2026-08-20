import { useState, useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { ConfigProvider, App as AntApp, Modal, Button } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import router from '@/router';
import azureTheme from '@/styles/theme';
import '@/styles/global.css';
import ChatWidget from '@/components/ChatWidget';
import PrivacyAgreementModal from '@/components/PrivacyAgreementModal';
import IMChatWidget from '@/components/IMChatWidget';
import VoiceAssistant from '@/components/VoiceAssistant';
import { useAuthStore } from '@/store/useAuthStore';
import { authApi } from '@/api/auth';
import { profileApi } from '@/api/profile';

/** 登录态就绪后拉取后端个性化 profile 覆盖 localStorage（P1-4 跨端持久化） */
function syncProfileToLocal() {
  profileApi
    .getProfile()
    .then((res: any) => {
      const data = res?.data || res;
      if (data) localStorage.setItem('user_profile', JSON.stringify(data));
    })
    .catch(() => {
      // 拉取失败静默
    });
}

const App: React.FC = () => {
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [desktopSetup, setDesktopSetup] = useState<{ username?: string } | null>(null);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const fetchUserInfo = useAuthStore((state) => state.fetchUserInfo);
  const logout = useAuthStore((state) => state.logout);
  const setSession = useAuthStore((state) => state.setSession);

  /* 隐私协议弹窗 */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const consented = localStorage.getItem('privacy_consent');
    if (!consented) {
      const timer = setTimeout(() => setShowPrivacy(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  /* 启动时恢复登录状态：有token → 自动拉取用户信息校验session；失败 → 清除登录态 */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedToken = localStorage.getItem('token');
    if (savedToken && savedToken !== 'cookie-auth') {
      // 有持久化的JWT token → 向后端校验是否仍然有效
      fetchUserInfo()
        .then(() => {
          // session有效，用户信息已恢复
          syncProfileToLocal();
        })
        .catch(() => {
          // token过期或session失效，清除所有残留状态
          logout();
        });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* P1 账号互通：桌面端跳转携带一次性临时 token → 自动兑换正式登录态（免登录）。
     兑换用后即销毁，无论成败都清理 URL 参数，避免刷新时重复兑换。
     降级处理：官网（生产）未录入该账号导致兑换失败时，弹出引导用户「先设置密码」（注册），
     避免死链；用户名可来自桌面端附带的 auth_user 参数用于预填。 */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const tempToken = params.get('auth_token');
    const authUser = params.get('auth_user') || '';
    if (!tempToken) return;

    // 先清理 URL，再兑换（失败也不残留敏感参数）
    params.delete('auth_token');
    params.delete('auth_user');
    const query = params.toString();
    const cleanUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', cleanUrl);

    authApi
      .exchangeDesktopLogin(tempToken)
      .then((res: any) => {
        const inner = res?.data || res;
        const newToken = inner?.token || '';
        const newUser = inner?.user;
        if (newToken && newUser) {
          setSession(newToken, newUser);
          if (inner.refresh_token) {
            localStorage.setItem('refresh_token', inner.refresh_token);
          }
          // P1-4：兑换成功后拉取后端个性化 profile
          syncProfileToLocal();
        }
      })
      .catch((err) => {
        // 降级处理：生产官网可能未录入桌面端账号 → 引导先设置密码（注册）
        console.warn('桌面端临时登录 token 兑换失败:', err);
        setDesktopSetup({ username: authUser || undefined });
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ConfigProvider
      theme={azureTheme}
      locale={zhCN}
    >
      <AntApp>
        <RouterProvider router={router} />
        <ChatWidget />
        <IMChatWidget />
        {isAuthenticated() && <VoiceAssistant position="bottom-left" />}
        <PrivacyAgreementModal
          open={showPrivacy}
          onClose={() => setShowPrivacy(false)}
          onAgreed={() => {
            if (typeof window !== 'undefined') localStorage.setItem('privacy_consent', 'true');
            setShowPrivacy(false);
          }}
        />
        {/* 降级处理：桌面端登录跳转，但官网（生产）未录入该账号 → 引导先设置密码 */}
        <Modal
          open={!!desktopSetup}
          title="账号尚未录入官网"
          onCancel={() => setDesktopSetup(null)}
          footer={[
            <Button key="later" onClick={() => setDesktopSetup(null)}>
              暂不设置
            </Button>,
            <Button
              key="setup"
              type="primary"
              onClick={() => {
                const uname = desktopSetup?.username || '';
                const qs = new URLSearchParams({ tab: 'register' });
                if (uname) qs.set('username', uname);
                setDesktopSetup(null);
                router.navigate(`/login?${qs.toString()}`);
              }}
            >
              去设置密码
            </Button>,
          ]}
        >
          <p style={{ marginBottom: 8 }}>
            您从桌面端登录，但官网尚未录入{desktopSetup?.username ? `「${desktopSetup.username}」` : '该账号'}，
            暂时无法在官网免登录。
          </p>
          <p style={{ margin: 0 }}>
            点击「去设置密码」，先在官网完成账号注册与密码设置，之后即可免登录访问官网功能。
          </p>
        </Modal>
      </AntApp>
    </ConfigProvider>
  );
};

export default App;
