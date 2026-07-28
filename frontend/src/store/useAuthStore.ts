import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi, UserInfo } from '@/api/auth';

interface AuthState {
  token: string | null;
  user: UserInfo | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  fetchUserInfo: () => Promise<void>;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      loading: false,

      login: async (username: string, password: string) => {
        set({ loading: true });
        try {
          const result = await authApi.login({ username, password });
          // axios 返回 { data: { success, message, data: { token, user, ... } } }
          const body = (result as any)?.data || result;
          const innerData = body?.data || body;
          const token = innerData?.token || '';
          // 存 token 到 localStorage（用于 API 请求 Bearer Header 兜底）
          if (token) {
            localStorage.setItem('token', token);
          }
          set({
            token: token || 'cookie-auth',
            user: innerData?.user || null,
            loading: false,
          });
        } catch (error) {
          set({ loading: false });
          throw error;
        }
      },

      logout: async () => {
        try {
          await authApi.logout();
        } finally {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          set({ token: null, user: null });
        }
      },

      fetchUserInfo: async () => {
        try {
          const user = await authApi.getUserInfo();
          set({ user });
        } catch (error) {
          console.error('获取用户信息失败:', error);
        }
      },

      isAuthenticated: () => {
        const { token, user } = get();
        return !!token && !!user;  // 有用户信息即认为已认证
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
);
