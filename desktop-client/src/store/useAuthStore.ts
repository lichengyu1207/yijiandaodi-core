import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi, UserInfo } from '@/api/auth';

interface AuthState {
  token: string | null;
  user: UserInfo | null;
  loading: boolean;
  error: string | null;
  
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchUserInfo: () => Promise<void>;
  isAuthenticated: () => boolean;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      loading: false,
      error: null,
      
      login: async (username: string, password: string) => {
        set({ loading: true, error: null });
        try {
          const result = await authApi.login({ username, password });
          localStorage.setItem('token', result.token);
          set({
            token: result.token,
            user: result.user,
            loading: false,
          });
        } catch (error: any) {
          const errorMsg = error.response?.data?.message || error.message || '登录失败';
          set({ error: errorMsg, loading: false });
          throw new Error(errorMsg);
        }
      },
      
      logout: async () => {
        try {
          await authApi.logout();
        } catch (error) {
          console.error('Logout error:', error);
        } finally {
          localStorage.removeItem('token');
          set({ token: null, user: null });
        }
      },
      
      fetchUserInfo: async () => {
        const { token } = get();
        if (!token) return;
        
        set({ loading: true });
        try {
          const user = await authApi.getUserInfo();
          set({ user, loading: false });
        } catch (error) {
          console.error('Fetch user info error:', error);
          set({ loading: false });
        }
      },
      
      isAuthenticated: () => {
        const { token, user } = get();
        return !!token && !!user;
      },
      
      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
);