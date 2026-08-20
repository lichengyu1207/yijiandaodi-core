/**
 * 统一认证服务
 * 处理桌面端与网站后端的数据同步
 */

import { apiConfig } from '../config/apiConfig';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterCredentials {
  username: string;
  email: string;
  password: string;
  confirm_password: string;
  privacy_agreed: boolean;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  data?: {
    token: string;
    refresh_token: string;
    user: {
      id: number;
      username: string;
      email: string;
      role: string;
    };
    expires_in: number;
  };
  error?: string;
}

export class AuthService {
  private static instance: AuthService;
  private token: string | null = null;
  private user: any = null;

  private constructor() {
    this.loadStoredAuth();
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * 从本地存储加载认证信息
   */
  private loadStoredAuth() {
    try {
      const storedToken = localStorage.getItem('auth_token');
      const storedUser = localStorage.getItem('auth_user');

      if (storedToken && storedUser) {
        this.token = storedToken;
        this.user = JSON.parse(storedUser);
      }
    } catch (error) {
      console.error('加载认证信息失败:', error);
    }
  }

  /**
   * 保存认证信息到本地存储
   */
  private saveAuth(token: string, user: any) {
    this.token = token;
    this.user = user;

    localStorage.setItem('auth_token', token);
    localStorage.setItem('auth_user', JSON.stringify(user));

    // 同步最新 token 到主进程（存证联动 / evidence / report 共用同一认证）
    this.syncTokenToMain();
  }

  /**
   * 同步当前 access token 到 Electron 主进程（非 Electron 环境自动忽略）
   */
  private syncTokenToMain(): void {
    try {
      const api = (window as any).electronAPI;
      if (api?.setSyncToken && this.token) {
        void api.setSyncToken(this.token);
      }
    } catch {
      // 浏览器开发预览等无 Electron 环境：忽略
    }
  }

  /**
   * 登录态备份到主进程文件（userData/data/auth-state.json，fs 立即落盘抗强杀）。
   * localStorage 因异常退出未 flush 丢失时，启动可经 restoreFromMain 恢复。
   */
  private persistAuthToMain(): void {
    try {
      const api = (window as any).electronAPI;
      if (!api?.saveAuthState) return;
      const token = localStorage.getItem('auth_token');
      if (!token) return;
      let user: unknown = null;
      try {
        user = JSON.parse(localStorage.getItem('auth_user') || 'null');
      } catch {
        user = null;
      }
      void api.saveAuthState({
        token,
        refresh: localStorage.getItem('refresh_token') ?? '',
        user,
        savedAt: Date.now(),
      });
    } catch {
      // 无 Electron 环境：忽略
    }
  }

  /**
   * 从主进程备份恢复登录态（仅当 localStorage 缺失时；localStorage 优先）。
   * App 启动时在 checkAuth 之前调用，返回是否恢复了凭据。
   */
  async restoreFromMain(): Promise<boolean> {
    try {
      const api = (window as any).electronAPI;
      if (!api?.getAuthState) return false;
      const state = (await api.getAuthState()) as {
        token?: string;
        refresh?: string;
        user?: unknown;
      } | null;
      if (!state || !state.token) return false;
      if (localStorage.getItem('auth_token')) return false; // localStorage 已有，无需恢复
      localStorage.setItem('auth_token', state.token);
      if (state.user) localStorage.setItem('auth_user', JSON.stringify(state.user));
      if (state.refresh) localStorage.setItem('refresh_token', state.refresh);
      this.token = state.token;
      this.user = state.user ?? null;
      console.log('[Auth] 已从主进程备份恢复登录态');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 清除认证信息
   */
  private clearAuth() {
    this.token = null;
    this.user = null;

    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('refresh_token');

    // 同步清除主进程备份（登出后不应残留凭据）
    try {
      const api = (window as any).electronAPI;
      if (api?.saveAuthState) {
        void api.saveAuthState(null as unknown as Record<string, unknown>);
      }
    } catch {
      // 无 Electron 环境：忽略
    }
  }

  /**
   * 用户登录
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const baseURL = apiConfig.getBaseURL();
      const response = await fetch(`${baseURL}/api/auth/login/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // 包含Cookie
        body: JSON.stringify(credentials)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // 保存认证信息
        this.saveAuth(data.data!.token, data.data!.user);

        // 保存refresh_token
        if (data.data!.refresh_token) {
          localStorage.setItem('refresh_token', data.data!.refresh_token);
        }

        // 登录态备份到主进程（抗强杀防丢失）
        this.persistAuthToMain();

        return data;
      } else {
        throw new Error(data.error || '登录失败');
      }
    } catch (error) {
      console.error('登录失败:', error);
      throw error;
    }
  }

  /**
   * 用户注册
   */
  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    try {
      const baseURL = apiConfig.getBaseURL();
      const response = await fetch(`${baseURL}/api/auth/register/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(credentials)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // 注册成功后自动登录
        return await this.login({
          username: credentials.username,
          password: credentials.password
        });
      } else {
        throw new Error(data.error || '注册失败');
      }
    } catch (error) {
      console.error('注册失败:', error);
      throw error;
    }
  }

  /**
   * 首次运行「设置账号」：一键注册到后端数据库并自动登录。
   * 引导流程无需手动输入邮箱/勾选协议，自动生成本地邮箱并视为同意本地产品协议。
   */
  async setupAccount(username: string, password: string): Promise<AuthResponse> {
    return this.register({
      username,
      email: `${username}@local.yijiandaodi`,
      password,
      confirm_password: password,
      privacy_agreed: true,
    });
  }

  /**
   * 查询后端是否已有用户（首次运行判断：无用户 → 引导设置账号；有用户 → 登录页）
   */
  async getBackendSetupStatus(): Promise<{ is_initialized: boolean; has_users: boolean; has_superuser: boolean } | null> {
    try {
      const baseURL = apiConfig.getBaseURL();
      const response = await fetch(`${baseURL}/api/auth/setup-status/`, {
        signal: AbortSignal.timeout(5000)
      });
      const data = await response.json();
      if (response.ok && data.success && data.data) {
        return data.data;
      }
      return null;
    } catch (error) {
      console.warn('[AuthService] getBackendSetupStatus 异常:', error);
      return null;
    }
  }

  /**
   * 用户登出
   */
  async logout(): Promise<void> {
    try {
      // 调用后端登出接口
      if (this.token) {
        const baseURL = apiConfig.getBaseURL();
        await fetch(`${baseURL}/api/auth/logout/`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`
          },
          credentials: 'include'
        });
      }
    } catch (error) {
      console.error('登出接口调用失败:', error);
    } finally {
      // 无论接口是否成功，都清除本地认证信息
      this.clearAuth();
    }
  }

  /**
   * 验证Token是否有效
   */
  async validateToken(): Promise<boolean> {
    console.log('[AuthService] validateToken 开始校验', {
      hasToken: Boolean(this.token),
      tokenPrefix: this.token ? this.token.slice(0, 12) + '...' : null,
      baseURL: apiConfig.getBaseURL(),
      user: this.user ? this.user.username : null,
    });

    if (!this.token) {
      console.warn('[AuthService] validateToken 未找到本地 token，返回 false');
      return false;
    }

    try {
      const baseURL = apiConfig.getBaseURL();
      const url = `${baseURL}/api/auth/verify/`;
      console.log('[AuthService] validateToken 发起请求', { url, method: 'GET' });

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      console.log('[AuthService] validateToken 收到响应', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      });

      // 尝试解析响应体，便于排查
      if (!response.ok) {
        try {
          const body = await response.text();
          console.warn('[AuthService] validateToken 校验失败，响应内容', { status: response.status, body: body.slice(0, 300) });
        } catch {
          // 忽略响应体解析失败
        }
      }

      return response.ok;
    } catch (error) {
      console.error('[AuthService] validateToken 异常:', {
        error,
        message: error instanceof Error ? error.message : String(error),
        baseURL: apiConfig.getBaseURL(),
      });
      return false;
    }
  }

  /**
   * 刷新Token
   */
  async refreshToken(): Promise<boolean> {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      console.warn('[AuthService] refreshToken 未找到 refresh_token，返回 false');
      return false;
    }

    try {
      const baseURL = apiConfig.getBaseURL();
      const url = `${baseURL}/api/auth/refresh/`;
      console.log('[AuthService] refreshToken 发起请求', { url });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refresh: refreshToken })
      });

      const data = await response.json();
      console.log('[AuthService] refreshToken 收到响应', { status: response.status, ok: response.ok });

      if (response.ok && data.access) {
        this.token = data.access;
        localStorage.setItem('auth_token', data.access);

        // 轮换后的新 refresh token 覆盖保存，避免旧 token 被拉黑后无法再次刷新
        if (data.refresh) {
          localStorage.setItem('refresh_token', data.refresh);
        }
        // 同步轮换后的新 access token 到主进程（存证联动共用认证）
        this.syncTokenToMain();
        // 登录态备份到主进程（refresh 轮换后同步更新，防强杀丢失）
        this.persistAuthToMain();
        return true;
      }

      // 明确 401：refresh token 已失效（过期/被拉黑/密钥变更）。
      // 必须清除本地认证信息，否则下次启动 loadStoredAuth 会重新加载同一作废 token，
      // 导致每次启动都卡在 validateToken→refresh→401 的死循环。
      if (response.status === 401) {
        console.warn('[AuthService] refreshToken 401：token 已失效，清除本地认证信息（需重新登录）', { data });
        this.clearAuth();
      } else {
        // 非 401（如网络/5xx）：保留本地 token，避免瞬时故障导致强制登出
        console.warn('[AuthService] refreshToken 失败', { status: response.status, data });
      }
      return false;
    } catch (error) {
      console.error('[AuthService] refreshToken 异常:', {
        error,
        message: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * 获取当前用户信息
   */
  getCurrentUser() {
    return this.user;
  }

  /**
   * 获取Token
   */
  getToken() {
    return this.token;
  }

  /**
   * P1 账号互通：向后端申请一次性临时登录 token（5 分钟、用后即销毁），
   * 用于桌面端→官网跳转时保持登录态（拼到官网 URL 后由官网兑换正式 JWT）。
   * 未登录或请求失败返回 null（调用方降级为不带 token 直开官网）。
   */
  async getDesktopLoginToken(): Promise<{ token: string; expires_in: number } | null> {
    if (!this.token) return null;
    try {
      const baseURL = apiConfig.getBaseURL();
      const response = await fetch(`${baseURL}/api/auth/desktop-login-token/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (response.ok && data.success && data.data?.token) {
        return { token: data.data.token, expires_in: data.data.expires_in ?? 300 };
      }
      return null;
    } catch (error) {
      console.warn('[AuthService] 获取桌面端临时登录 token 失败:', error);
      return null;
    }
  }

  /**
   * 单飞刷新 token：全局共享同一次刷新，
   * 避免多个并发 401 同时触发刷新（BLACKLIST_AFTER_ROTATION 下重复刷新会失败）
   */
  private static refreshGuard: Promise<boolean> | null = null;

  async refreshTokenGuarded(): Promise<boolean> {
    if (AuthService.refreshGuard) {
      console.log('[AuthService] 已有进行中的刷新，等待共享结果');
    } else {
      console.log('[AuthService] 获取刷新锁，发起首次刷新');
    }
    if (!AuthService.refreshGuard) {
      AuthService.refreshGuard = this.refreshToken().finally(() => {
        console.log('[AuthService] 刷新锁已释放');
        AuthService.refreshGuard = null;
      });
    }
    const result = await AuthService.refreshGuard;
    console.log(`[AuthService] 刷新结果=${result}`);
    return result;
  }

  /**
   * 检查是否已登录
   */
  isAuthenticated() {
    return !!this.token && !!this.user;
  }

  /**
   * 获取认证头部
   */
  getAuthHeaders() {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * 带认证的fetch请求
   */
  async authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    // 检查Token是否有效
    const isValid = await this.validateToken();

    if (!isValid) {
      // 尝试刷新Token（单飞：多个并发 401 共享同一次刷新，避免轮换后旧 token 被拉黑）
      const refreshed = await this.refreshTokenGuarded();

      if (!refreshed) {
        // 刷新失败，清除认证信息
        this.clearAuth();
        throw new Error('认证已过期，请重新登录');
      }
    }

    // 添加认证头部
    const headers = {
      ...options.headers,
      ...this.getAuthHeaders()
    };

    return fetch(url, {
      ...options,
      headers,
      credentials: 'include'
    });
  }
}

// 导出单例实例
export const authService = AuthService.getInstance();