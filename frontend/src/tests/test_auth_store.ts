import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ===== Mock zustand (use real implementation) =====
vi.mock('zustand', async () => {
  const actual = await vi.importActual('zustand');
  return { ...actual };
});

vi.mock('zustand/middleware', async () => {
  const actual = await vi.importActual('zustand/middleware');
  return { ...actual };
});

// ===== Mock auth API =====
const mockLogin = vi.fn().mockResolvedValue({
  data: {
    token: 'test-token-123',
    user: { id: 1, username: 'admin', email: 'a@b.com', role: 'super_admin' },
    expires_in: 86400,
  },
});
const mockLogout = vi.fn().mockResolvedValue(undefined);
const mockGetUserInfo = vi.fn().mockResolvedValue({
  id: 1,
  username: 'admin',
  role: 'super_admin',
});

vi.mock('@/api/auth', () => ({
  authApi: {
    login: mockLogin,
    logout: mockLogout,
    getUserInfo: mockGetUserInfo,
  },
}));

import { useAuthStore } from '@/store/useAuthStore';
import { authApi } from '@/api/auth';
const mockedAuth = vi.mocked(authApi);

describe('useAuthStore - Zustand + persist 认证状态管理', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  // ========== 初始状态 (3个) ==========

  it('1. 初始 token=null, user=null, loading=false', () => {
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(state.loading).toBe(false);
  });

  it('2. isAuthenticated() 返回 false（无 token）', () => {
    const { isAuthenticated } = useAuthStore.getState();
    expect(isAuthenticated()).toBe(false);
  });

  it('3. store 包含 login/logout/fetchUserInfo/isAuthenticated 方法', () => {
    const state = useAuthStore.getState();
    expect(typeof state.login).toBe('function');
    expect(typeof state.logout).toBe('function');
    expect(typeof state.fetchUserInfo).toBe('function');
    expect(typeof state.isAuthenticated).toBe('function');
  });

  // ========== login (4个) ==========

  it('4. login 成功后 token 被设置', async () => {
    await useAuthStore.getState().login('admin', 'password123');
    const state = useAuthStore.getState();
    expect(state.token).toBe('test-token-123');
    expect(localStorage.getItem('token')).toBe('test-token-123');
  });

  it('5. login 成功后 user 被设置', async () => {
    await useAuthStore.getState().login('admin', 'password123');
    const state = useAuthStore.getState();
    expect(state.user).toEqual({ id: 1, username: 'admin', email: 'a@b.com', role: 'super_admin' });
  });

  it('6. login 过程中 loading=true，完成后 loading=false', async () => {
    const loginPromise = useAuthStore.getState().login('admin', 'password123');

    // login 内部是同步 set loading=true 然后异步等待，所以此时可能已完成
    // 但我们可以验证最终 loading 为 false
    await loginPromise;
    expect(useAuthStore.getState().loading).toBe(false);

    // 验证 login 过程中确实设置过 loading
    // 由于 login 是 async 且内部先 set({loading:true}) 再 await，
    // 我们可以通过 spy 来验证
    const setStateSpy = vi.spyOn(useAuthStore, 'setState');
    await useAuthStore.getState().login('admin', 'password123');

    const calls = setStateSpy.mock.calls;
    const hadLoadingTrue = calls.some((call) => call[0].loading === true);
    expect(hadLoadingTrue).toBe(true);

    setStateSpy.mockRestore();
  });

  it('7. login 失败时 loading 重置为 false 且错误被抛出', async () => {
    mockedAuth.login.mockRejectedValueOnce(new Error('密码错误'));

    await expect(useAuthStore.getState().login('admin', 'wrong')).rejects.toThrow('密码错误');
    expect(useAuthStore.getState().loading).toBe(false);
  });

  // ========== logout (2个) ==========

  it('8. logout 清除 token 和 user', async () => {
    // 先登录
    await useAuthStore.getState().login('admin', 'password123');
    expect(useAuthStore.getState().token).not.toBeNull();

    // 再登出
    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('9. logout 调用 authApi.logout', async () => {
    await useAuthStore.getState().logout();
    expect(mockedAuth.logout).toHaveBeenCalledTimes(1);
  });

  // ========== fetchUserInfo (2个) ==========

  it('10. fetchUserInfo 成功设置 user', async () => {
    await useAuthStore.getState().fetchUserInfo();
    const state = useAuthStore.getState();
    expect(state.user).toEqual({ id: 1, username: 'admin', role: 'super_admin' });
  });

  it('11. fetchUserInfo 失败不抛错（只 console.error）', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockedAuth.getUserInfo.mockRejectedValueOnce(new Error('网络错误'));

    // 不应抛出异常
    await expect(useAuthStore.getState().fetchUserInfo()).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('获取用户信息失败'), expect.any(Error));

    consoleSpy.mockRestore();
  });

  // ========== isAuthenticated (1个) ==========

  it('12. 有 token 时 isAuthenticated() 返回 true', async () => {
    await useAuthStore.getState().login('admin', 'password123');
    expect(useAuthStore.getState().isAuthenticated()).toBe(true);
  });
});
