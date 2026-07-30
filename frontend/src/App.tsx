import { useState, useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import router from '@/router';
import azureTheme from '@/styles/theme';
import '@/styles/global.css';
import ChatWidget from '@/components/ChatWidget';
import PrivacyAgreementModal from '@/components/PrivacyAgreementModal';
import IMChatWidget from '@/components/IMChatWidget';
import VoiceAssistant from '@/components/VoiceAssistant';
import { useAuthStore } from '@/store/useAuthStore';

const App: React.FC = () => {
  const [showPrivacy, setShowPrivacy] = useState(false);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const fetchUserInfo = useAuthStore((state) => state.fetchUserInfo);
  const logout = useAuthStore((state) => state.logout);

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
        })
        .catch(() => {
          // token过期或session失效，清除所有残留状态
          logout();
        });
    }
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
      </AntApp>
    </ConfigProvider>
  );
};

export default App;
