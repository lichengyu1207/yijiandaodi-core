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
        return true;
      }

      console.warn('[AuthService] refreshToken 失败', { status: response.status, data });
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
      // 尝试刷新Token
      const refreshed = await this.refreshToken();

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