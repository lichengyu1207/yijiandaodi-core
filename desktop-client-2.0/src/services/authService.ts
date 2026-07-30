/**
 * 统一认证服务
 * 处理桌面端与网站后端的数据同步
 */

const API_BASE = 'https://yijiandaodi.com/api'

export interface LoginCredentials {
  username: string
  password: string
}

export interface RegisterCredentials {
  username: string
  email: string
  password: string
  privacy_agreed: boolean
}

export interface AuthResponse {
  success: boolean
  message?: string
  data?: {
    token: string
    refresh_token: string
    user: {
      id: number
      username: string
      email: string
      role: string
    }
    expires_in: number
  }
  error?: string
}

export class AuthService {
  private static instance: AuthService
  private token: string | null = null
  private user: any = null

  private constructor() {
    this.loadStoredAuth()
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService()
    }
    return AuthService.instance
  }

  /**
   * 从本地存储加载认证信息
   */
  private loadStoredAuth() {
    try {
      const storedToken = localStorage.getItem('auth_token')
      const storedUser = localStorage.getItem('auth_user')

      if (storedToken && storedUser) {
        this.token = storedToken
        this.user = JSON.parse(storedUser)
      }
    } catch (error) {
      console.error('加载认证信息失败:', error)
    }
  }

  /**
   * 保存认证信息到本地存储
   */
  private saveAuth(token: string, user: any) {
    this.token = token
    this.user = user

    localStorage.setItem('auth_token', token)
    localStorage.setItem('auth_user', JSON.stringify(user))
  }

  /**
   * 清除认证信息
   */
  private clearAuth() {
    this.token = null
    this.user = null

    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
  }

  /**
   * 用户登录
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE}/auth/login/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // 包含Cookie
        body: JSON.stringify(credentials)
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // 保存认证信息
        this.saveAuth(data.data!.token, data.data!.user)
        return data
      } else {
        throw new Error(data.error || '登录失败')
      }
    } catch (error) {
      console.error('登录失败:', error)
      throw error
    }
  }

  /**
   * 用户注册
   */
  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE}/auth/register/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(credentials)
      })

      const data = await response.json()

      if (response.ok && data.success) {
        // 注册成功后自动登录
        return await this.login({
          username: credentials.username,
          password: credentials.password
        })
      } else {
        throw new Error(data.error || '注册失败')
      }
    } catch (error) {
      console.error('注册失败:', error)
      throw error
    }
  }

  /**
   * 用户登出
   */
  async logout(): Promise<void> {
    try {
      // 调用后端登出接口
      if (this.token) {
        await fetch(`${API_BASE}/auth/logout/`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`
          },
          credentials: 'include'
        })
      }
    } catch (error) {
      console.error('登出接口调用失败:', error)
    } finally {
      // 无论接口是否成功，都清除本地认证信息
      this.clearAuth()
    }
  }

  /**
   * 验证Token是否有效
   */
  async validateToken(): Promise<boolean> {
    if (!this.token) {
      return false
    }

    try {
      const response = await fetch(`${API_BASE}/auth/verify/`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      })

      return response.ok
    } catch (error) {
      console.error('Token验证失败:', error)
      return false
    }
  }

  /**
   * 刷新Token
   */
  async refreshToken(): Promise<boolean> {
    const refreshToken = localStorage.getItem('refresh_token')
    if (!refreshToken) {
      return false
    }

    try {
      const response = await fetch(`${API_BASE}/auth/refresh/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refresh: refreshToken })
      })

      const data = await response.json()

      if (response.ok && data.access) {
        this.token = data.access
        localStorage.setItem('auth_token', data.access)
        return true
      }

      return false
    } catch (error) {
      console.error('Token刷新失败:', error)
      return false
    }
  }

  /**
   * 获取当前用户信息
   */
  getCurrentUser() {
    return this.user
  }

  /**
   * 获取Token
   */
  getToken() {
    return this.token
  }

  /**
   * 检查是否已登录
   */
  isAuthenticated() {
    return !!this.token && !!this.user
  }

  /**
   * 获取认证头部
   */
  getAuthHeaders() {
    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json'
    }
  }

  /**
   * 带认证的fetch请求
   */
  async authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
    // 检查Token是否有效
    const isValid = await this.validateToken()

    if (!isValid) {
      // 尝试刷新Token
      const refreshed = await this.refreshToken()

      if (!refreshed) {
        // 刷新失败，清除认证信息
        this.clearAuth()
        throw new Error('认证已过期，请重新登录')
      }
    }

    // 添加认证头部
    const headers = {
      ...options.headers,
      ...this.getAuthHeaders()
    }

    return fetch(url, {
      ...options,
      headers,
      credentials: 'include'
    })
  }
}

// 导出单例实例
export const authService = AuthService.getInstance()