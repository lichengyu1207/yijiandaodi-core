# HTTP 客户端封装设计方案

## 设计目标

基于 axios 创建一个健壮、可扩展的 HTTP 客户端封装，支持：
- 统一的请求/响应处理
- 自动认证 Token 管理
- 智能错误处理和重试机制
- 请求取消和并发控制
- TypeScript 类型安全
- 详细的日志记录

---

## 架构设计

### 1. 核心模块结构

```
src/services/http/
├── HttpClient.ts           # 核心 HTTP 客户端类
├── interceptors/
│   ├── requestInterceptor.ts   # 请求拦截器
│   └── responseInterceptor.ts  # 响应拦截器
├── auth/
│   └── TokenManager.ts     # Token 管理器
├── error/
│   └── ErrorHandler.ts     # 错误处理器
├── retry/
│   └── RetryPolicy.ts      # 重试策略
├── cancel/
│   └── RequestCancel.ts    # 请求取消管理
├── types/
│   └── http.types.ts       # TypeScript 类型定义
└── config/
    └── http.config.ts      # HTTP 配置
```

---

## 2. 核心 HTTP 客户端类

### HttpClient.ts

```typescript
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios'
import { TokenManager } from './auth/TokenManager'
import { ErrorHandler } from './error/ErrorHandler'
import { RetryPolicy } from './retry/RetryPolicy'
import { RequestCancelManager } from './cancel/RequestCancel'
import { setupRequestInterceptors, setupResponseInterceptors } from './interceptors'
import { HttpClientConfig, HttpRequestConfig, HttpResponse, HttpError } from './types/http.types'

export class HttpClient {
  private client: AxiosInstance
  private tokenManager: TokenManager
  private errorHandler: ErrorHandler
  private retryPolicy: RetryPolicy
  private cancelManager: RequestCancelManager
  private config: HttpClientConfig

  constructor(config: HttpClientConfig) {
    this.config = config
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        ...config.defaultHeaders
      }
    })

    this.tokenManager = new TokenManager(config.auth)
    this.errorHandler = new ErrorHandler(config.errorHandling)
    this.retryPolicy = new RetryPolicy(config.retry)
    this.cancelManager = new RequestCancelManager()

    // 设置拦截器
    this.setupInterceptors()

    console.log(`[HttpClient] 初始化完成，baseURL: ${config.baseURL}`)
  }

  /**
   * 设置拦截器
   */
  private setupInterceptors(): void {
    // 请求拦截器：添加 Token、请求 ID、日志
    setupRequestInterceptors(this.client, this.tokenManager, this.config)

    // 响应拦截器：统一错误处理、Token 刷新、日志
    setupResponseInterceptors(this.client, this.tokenManager, this.errorHandler, this.config)
  }

  /**
   * GET 请求
   */
  async get<T = any>(
    url: string,
    config?: HttpRequestConfig
  ): Promise<HttpResponse<T>> {
    return this.request<T>('GET', url, undefined, config)
  }

  /**
   * POST 请求
   */
  async post<T = any>(
    url: string,
    data?: any,
    config?: HttpRequestConfig
  ): Promise<HttpResponse<T>> {
    return this.request<T>('POST', url, data, config)
  }

  /**
   * PUT 请求
   */
  async put<T = any>(
    url: string,
    data?: any,
    config?: HttpRequestConfig
  ): Promise<HttpResponse<T>> {
    return this.request<T>('PUT', url, data, config)
  }

  /**
   * DELETE 请求
   */
  async delete<T = any>(
    url: string,
    config?: HttpRequestConfig
  ): Promise<HttpResponse<T>> {
    return this.request<T>('DELETE', url, undefined, config)
  }

  /**
   * PATCH 请求
   */
  async patch<T = any>(
    url: string,
    data?: any,
    config?: HttpRequestConfig
  ): Promise<HttpResponse<T>> {
    return this.request<T>('PATCH', url, data, config)
  }

  /**
   * 核心请求方法（带重试和取消）
   */
  private async request<T>(
    method: string,
    url: string,
    data?: any,
    config?: HttpRequestConfig
  ): Promise<HttpResponse<T>> {
    const requestId = this.generateRequestId()
    const startTime = Date.now()

    console.log(`[HttpClient] [${requestId}] 发起 ${method} 请求: ${url}`)

    try {
      // 合并配置
      const requestConfig: AxiosRequestConfig = {
        method,
        url,
        data,
        ...config,
        headers: {
          ...this.config.defaultHeaders,
          ...config?.headers,
          'X-Request-ID': requestId
        }
      }

      // 添加取消令牌
      if (config?.cancelKey) {
        const cancelToken = this.cancelManager.createCancelToken(config.cancelKey)
        requestConfig.cancelToken = cancelToken
      }

      // 执行请求（带重试）
      const response = await this.retryPolicy.executeWithRetry(
        () => this.client.request<T>(requestConfig),
        requestId
      )

      const elapsed = Date.now() - startTime
      console.log(`[HttpClient] [${requestId}] 请求成功，耗时: ${elapsed}ms`)

      return this.transformResponse<T>(response)

    } catch (error: any) {
      const elapsed = Date.now() - startTime

      // 处理取消请求
      if (axios.isCancel(error)) {
        console.log(`[HttpClient] [${requestId}] 请求已取消，耗时: ${elapsed}ms`)
        throw new Error('请求已取消')
      }

      // 统一错误处理
      const httpError = this.errorHandler.handle(error, requestId)
      console.error(`[HttpClient] [${requestId}] 请求失败，耗时: ${elapsed}ms，错误: ${httpError.message}`)

      throw httpError
    }
  }

  /**
   * 转换响应数据
   */
  private transformResponse<T>(response: AxiosResponse<T>): HttpResponse<T> {
    return {
      data: response.data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers as any,
      config: response.config as any
    }
  }

  /**
   * 生成请求 ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * 取消请求
   */
  cancelRequest(cancelKey: string, message?: string): void {
    this.cancelManager.cancel(cancelKey, message || '请求已取消')
  }

  /**
   * 取消所有请求
   */
  cancelAllRequests(message?: string): void {
    this.cancelManager.cancelAll(message || '所有请求已取消')
  }

  /**
   * 更新认证 Token
   */
  setAuthToken(token: string): void {
    this.tokenManager.setToken(token)
    console.log(`[HttpClient] 认证 Token 已更新`)
  }

  /**
   * 清除认证 Token
   */
  clearAuthToken(): void {
    this.tokenManager.clearToken()
    console.log(`[HttpClient] 认证 Token 已清除`)
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalRequests: number
    successRequests: number
    failedRequests: number
    avgResponseTime: number
  } {
    return {
      totalRequests: 0, // TODO: 实现统计逻辑
      successRequests: 0,
      failedRequests: 0,
      avgResponseTime: 0
    }
  }
}
```

---

## 3. Token 管理器

### TokenManager.ts

```typescript
export interface TokenManagerConfig {
  tokenKey?: string
  refreshTokenKey?: string
  tokenExpiredThreshold?: number // Token 过期阈值（秒）
  onTokenExpired?: () => Promise<string | null> // Token 过期回调
}

export class TokenManager {
  private token: string | null = null
  private refreshToken: string | null = null
  private tokenExpiry: number | null = null
  private config: TokenManagerConfig

  constructor(config?: TokenManagerConfig) {
    this.config = {
      tokenKey: 'auth_token',
      refreshTokenKey: 'refresh_token',
      tokenExpiredThreshold: 300, // 5分钟
      ...config
    }

    this.loadStoredTokens()
  }

  /**
   * 加载存储的 Token
   */
  private loadStoredTokens(): void {
    try {
      const storedToken = localStorage.getItem(this.config.tokenKey!)
      const storedRefreshToken = localStorage.getItem(this.config.refreshTokenKey!)

      if (storedToken) {
        this.token = storedToken
      }

      if (storedRefreshToken) {
        this.refreshToken = storedRefreshToken
      }

      console.log(`[TokenManager] 已加载存储的 Token`)
    } catch (error) {
      console.error(`[TokenManager] 加载 Token 失败:`, error)
    }
  }

  /**
   * 设置 Token
   */
  setToken(token: string, expiresIn?: number): void {
    this.token = token

    if (expiresIn) {
      this.tokenExpiry = Date.now() + expiresIn * 1000
    }

    // 持久化存储
    try {
      localStorage.setItem(this.config.tokenKey!, token)
      console.log(`[TokenManager] Token 已保存`)
    } catch (error) {
      console.error(`[TokenManager] 保存 Token 失败:`, error)
    }
  }

  /**
   * 设置刷新 Token
   */
  setRefreshToken(refreshToken: string): void {
    this.refreshToken = refreshToken

    try {
      localStorage.setItem(this.config.refreshTokenKey!, refreshToken)
      console.log(`[TokenManager] 刷新 Token 已保存`)
    } catch (error) {
      console.error(`[TokenManager] 保存刷新 Token 失败:`, error)
    }
  }

  /**
   * 获取 Token
   */
  getToken(): string | null {
    return this.token
  }

  /**
   * 获取刷新 Token
   */
  getRefreshToken(): string | null {
    return this.refreshToken
  }

  /**
   * 检查 Token 是否即将过期
   */
  isTokenExpiringSoon(): boolean {
    if (!this.tokenExpiry) {
      return false
    }

    const threshold = this.config.tokenExpiredThreshold! * 1000
    return Date.now() + threshold >= this.tokenExpiry
  }

  /**
   * 检查是否需要刷新 Token
   */
  async ensureValidToken(): Promise<string | null> {
    // 如果没有 Token，返回 null
    if (!this.token) {
      return null
    }

    // 如果 Token 即将过期，尝试刷新
    if (this.isTokenExpiringSoon() && this.config.onTokenExpired) {
      console.log(`[TokenManager] Token 即将过期，尝试刷新`)
      const newToken = await this.config.onTokenExpired()

      if (newToken) {
        this.setToken(newToken)
        return newToken
      }
    }

    return this.token
  }

  /**
   * 清除 Token
   */
  clearToken(): void {
    this.token = null
    this.refreshToken = null
    this.tokenExpiry = null

    try {
      localStorage.removeItem(this.config.tokenKey!)
      localStorage.removeItem(this.config.refreshTokenKey!)
      console.log(`[TokenManager] Token 已清除`)
    } catch (error) {
      console.error(`[TokenManager] 清除 Token 失败:`, error)
    }
  }
}
```

---

## 4. 错误处理器

### ErrorHandler.ts

```typescript
import { AxiosError } from 'axios'
import { HttpError, ErrorType } from '../types/http.types'

export interface ErrorHandlerConfig {
  showNotifications?: boolean
  retryableStatusCodes?: number[]
  maxRetries?: number
}

export class ErrorHandler {
  private config: ErrorHandlerConfig

  constructor(config?: ErrorHandlerConfig) {
    this.config = {
      showNotifications: true,
      retryableStatusCodes: [408, 429, 500, 502, 503, 504],
      maxRetries: 3,
      ...config
    }
  }

  /**
   * 统一错误处理
   */
  handle(error: AxiosError | Error, requestId: string): HttpError {
    // Axios 错误
    if (error instanceof AxiosError) {
      return this.handleAxiosError(error, requestId)
    }

    // 普通错误
    return {
      type: ErrorType.UNKNOWN,
      message: error.message || '未知错误',
      requestId,
      timestamp: Date.now(),
      originalError: error
    }
  }

  /**
   * 处理 Axios 错误
   */
  private handleAxiosError(error: AxiosError, requestId: string): HttpError {
    const { response, request, code } = error

    // 响应错误（服务器返回了错误状态码）
    if (response) {
      return this.handleResponseError(error, requestId)
    }

    // 请求错误（请求已发出但没有收到响应）
    if (request) {
      return this.handleRequestError(error, requestId)
    }

    // 配置错误
    return {
      type: ErrorType.CONFIG_ERROR,
      message: '请求配置错误',
      requestId,
      timestamp: Date.now(),
      originalError: error
    }
  }

  /**
   * 处理响应错误
   */
  private handleResponseError(error: AxiosError, requestId: string): HttpError {
    const { response } = error
    const status = response?.status || 0
    const data = response?.data as any

    let errorType: ErrorType
    let message: string

    switch (status) {
      case 400:
        errorType = ErrorType.BAD_REQUEST
        message = data?.message || '请求参数错误'
        break

      case 401:
        errorType = ErrorType.UNAUTHORIZED
        message = '认证失败，请重新登录'
        break

      case 403:
        errorType = ErrorType.FORBIDDEN
        message = '权限不足，拒绝访问'
        break

      case 404:
        errorType = ErrorType.NOT_FOUND
        message = '请求的资源不存在'
        break

      case 408:
        errorType = ErrorType.TIMEOUT
        message = '请求超时'
        break

      case 429:
        errorType = ErrorType.RATE_LIMIT
        message = '请求过于频繁，请稍后重试'
        break

      case 500:
      case 502:
      case 503:
      case 504:
        errorType = ErrorType.SERVER_ERROR
        message = '服务器错误，请稍后重试'
        break

      default:
        errorType = ErrorType.RESPONSE_ERROR
        message = data?.message || `请求失败，状态码: ${status}`
    }

    return {
      type: errorType,
      message,
      status,
      data,
      requestId,
      timestamp: Date.now(),
      originalError: error,
      retryable: this.isRetryable(status)
    }
  }

  /**
   * 处理请求错误
   */
  private handleRequestError(error: AxiosError, requestId: string): HttpError {
    const code = error.code

    let errorType: ErrorType
    let message: string

    switch (code) {
      case 'ECONNABORTED':
        errorType = ErrorType.TIMEOUT
        message = '请求超时，请检查网络连接'
        break

      case 'ECONNREFUSED':
        errorType = ErrorType.NETWORK_ERROR
        message = '无法连接到服务器，请检查网络'
        break

      case 'ENETUNREACH':
        errorType = ErrorType.NETWORK_ERROR
        message = '网络不可达，请检查网络设置'
        break

      default:
        errorType = ErrorType.REQUEST_ERROR
        message = '网络请求失败，请稍后重试'
    }

    return {
      type: errorType,
      message,
      requestId,
      timestamp: Date.now(),
      originalError: error,
      retryable: this.isRetryable(code)
    }
  }

  /**
   * 判断是否可重试
   */
  private isRetryable(statusOrCode: number | string | undefined): boolean {
    if (!statusOrCode) return false

    const statusCode = typeof statusOrCode === 'number' ? statusOrCode : parseInt(statusOrCode)

    return this.config.retryableStatusCodes!.includes(statusCode)
  }
}
```

---

## 5. 重试策略

### RetryPolicy.ts

```typescript
export interface RetryConfig {
  maxRetries?: number
  retryDelay?: number
  retryMultiplier?: number
  maxRetryDelay?: number
  retryableErrors?: string[]
}

export class RetryPolicy {
  private config: RetryConfig

  constructor(config?: RetryConfig) {
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      retryMultiplier: 2,
      maxRetryDelay: 10000,
      retryableErrors: ['ECONNABORTED', 'ECONNREFUSED', 'ENETUNREACH', '500', '502', '503', '504'],
      ...config
    }
  }

  /**
   * 执行带重试的请求
   */
  async executeWithRetry<T>(
    requestFn: () => Promise<T>,
    requestId: string
  ): Promise<T> {
    let lastError: Error | null = null
    let retryCount = 0

    while (retryCount <= this.config.maxRetries!) {
      try {
        return await requestFn()
      } catch (error: any) {
        lastError = error

        // 检查是否可重试
        if (!this.shouldRetry(error)) {
          throw error
        }

        retryCount++

        if (retryCount <= this.config.maxRetries!) {
          const delay = this.calculateDelay(retryCount)
          console.warn(`[RetryPolicy] [${requestId}] 第 ${retryCount} 次重试，等待 ${delay}ms`)

          await this.sleep(delay)
        }
      }
    }

    console.error(`[RetryPolicy] [${requestId}] 重试次数已用尽`)
    throw lastError
  }

  /**
   * 判断是否应该重试
   */
  private shouldRetry(error: any): boolean {
    if (!error) return false

    // 检查错误代码
    const errorCode = error.code || error.status?.toString()
    if (errorCode && this.config.retryableErrors!.includes(errorCode)) {
      return true
    }

    // 检查响应状态码
    if (error.response?.status) {
      return this.config.retryableErrors!.includes(error.response.status.toString())
    }

    return false
  }

  /**
   * 计算延迟时间（指数退避）
   */
  private calculateDelay(retryCount: number): number {
    const delay = this.config.retryDelay! * Math.pow(this.config.retryMultiplier!, retryCount - 1)
    return Math.min(delay, this.config.maxRetryDelay!)
  }

  /**
   * 延迟函数
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
```

---

## 6. 请求取消管理

### RequestCancel.ts

```typescript
import axios from 'axios'

export class RequestCancelManager {
  private cancelTokens: Map<string, AbortController> = new Map()

  /**
   * 创建取消令牌
   */
  createCancelToken(cancelKey: string): any {
    const controller = new AbortController()
    this.cancelTokens.set(cancelKey, controller)

    // 创建 axios 兼容的 cancel token
    return new axios.CancelToken(cancel => {
      controller.abort = () => cancel('请求已取消')
    })
  }

  /**
   * 取消指定请求
   */
  cancel(cancelKey: string, message?: string): void {
    const controller = this.cancelTokens.get(cancelKey)

    if (controller) {
      controller.abort()
      this.cancelTokens.delete(cancelKey)
      console.log(`[RequestCancelManager] 请求已取消: ${cancelKey}`)
    }
  }

  /**
   * 取消所有请求
   */
  cancelAll(message?: string): void {
    this.cancelTokens.forEach((controller, key) => {
      controller.abort()
    })

    const count = this.cancelTokens.size
    this.cancelTokens.clear()
    console.log(`[RequestCancelManager] 已取消 ${count} 个请求`)
  }

  /**
   * 获取活跃请求数量
   */
  getActiveCount(): number {
    return this.cancelTokens.size
  }
}
```

---

## 7. TypeScript 类型定义

### http.types.ts

```typescript
import { AxiosRequestConfig, AxiosResponse } from 'axios'

/**
 * HTTP 客户端配置
 */
export interface HttpClientConfig {
  baseURL: string
  timeout?: number
  defaultHeaders?: Record<string, string>
  auth?: TokenManagerConfig
  errorHandling?: ErrorHandlerConfig
  retry?: RetryConfig
  logging?: {
    enabled?: boolean
    level?: 'debug' | 'info' | 'warn' | 'error'
  }
}

/**
 * HTTP 请求配置
 */
export interface HttpRequestConfig extends AxiosRequestConfig {
  cancelKey?: string
  skipAuth?: boolean
  skipRetry?: boolean
  metadata?: Record<string, any>
}

/**
 * HTTP 响应
 */
export interface HttpResponse<T = any> {
  data: T
  status: number
  statusText: string
  headers: Record<string, string>
  config: HttpRequestConfig
}

/**
 * HTTP 错误
 */
export interface HttpError {
  type: ErrorType
  message: string
  status?: number
  data?: any
  requestId: string
  timestamp: number
  originalError?: Error
  retryable?: boolean
}

/**
 * 错误类型枚举
 */
export enum ErrorType {
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMIT = 'RATE_LIMIT',
  SERVER_ERROR = 'SERVER_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  REQUEST_ERROR = 'REQUEST_ERROR',
  RESPONSE_ERROR = 'RESPONSE_ERROR',
  CONFIG_ERROR = 'CONFIG_ERROR',
  UNKNOWN = 'UNKNOWN'
}

/**
 * 请求统计信息
 */
export interface RequestStats {
  totalRequests: number
  successRequests: number
  failedRequests: number
  avgResponseTime: number
  errorRate: number
}
```

---

## 8. 拦截器

### requestInterceptor.ts

```typescript
import { AxiosInstance } from 'axios'
import { TokenManager } from '../auth/TokenManager'
import { HttpClientConfig } from '../types/http.types'

export function setupRequestInterceptors(
  client: AxiosInstance,
  tokenManager: TokenManager,
  config: HttpClientConfig
): void {
  client.interceptors.request.use(
    async (config) => {
      const requestId = config.headers?.['X-Request-ID'] as string

      console.log(`[RequestInterceptor] [${requestId}] 请求拦截: ${config.method?.toUpperCase()} ${config.url}`)

      // 添加认证 Token（如果需要）
      if (!config.skipAuth) {
        const token = await tokenManager.ensureValidToken()
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
      }

      // 添加时间戳（防止缓存）
      if (config.method === 'get') {
        config.params = {
          ...config.params,
          _t: Date.now()
        }
      }

      // 记录请求开始时间
      config.metadata = {
        ...config.metadata,
        startTime: Date.now()
      }

      return config
    },
    (error) => {
      console.error(`[RequestInterceptor] 请求拦截器错误:`, error)
      return Promise.reject(error)
    }
  )
}
```

### responseInterceptor.ts

```typescript
import { AxiosInstance } from 'axios'
import { TokenManager } from '../auth/TokenManager'
import { ErrorHandler } from '../error/ErrorHandler'
import { HttpClientConfig } from '../types/http.types'

export function setupResponseInterceptors(
  client: AxiosInstance,
  tokenManager: TokenManager,
  errorHandler: ErrorHandler,
  config: HttpClientConfig
): void {
  client.interceptors.response.use(
    (response) => {
      const requestId = response.config.headers?.['X-Request-ID'] as string
      const elapsed = Date.now() - (response.config.metadata?.startTime || 0)

      console.log(`[ResponseInterceptor] [${requestId}] 响应成功，状态: ${response.status}，耗时: ${elapsed}ms`)

      return response
    },
    async (error) => {
      const requestId = error.config?.headers?.['X-Request-ID'] as string

      // 处理 401 认证失败
      if (error.response?.status === 401) {
        console.warn(`[ResponseInterceptor] [${requestId}] 认证失败，清除 Token`)
        tokenManager.clearToken()

        // 可以在这里触发重新登录流程
        // window.location.href = '/login'
      }

      // 统一错误处理
      const httpError = errorHandler.handle(error, requestId)

      console.error(`[ResponseInterceptor] [${requestId}] 响应失败:`, httpError)

      return Promise.reject(httpError)
    }
  )
}
```

---

## 使用示例

### 初始化和使用

```typescript
// 创建 HTTP 客户端
const httpClient = new HttpClient({
  baseURL: 'http://localhost:9092',
  timeout: 30000,
  auth: {
    onTokenExpired: async () => {
      // 实现刷新 Token 逻辑
      const response = await axios.post('/auth/refresh')
      return response.data.token
    }
  },
  retry: {
    maxRetries: 3,
    retryDelay: 1000
  },
  logging: {
    enabled: true,
    level: 'info'
  }
})

// 登录后设置 Token
httpClient.setAuthToken('your-auth-token')

// 发起请求
try {
  const response = await httpClient.get('/api/v1/users')
  console.log('用户列表:', response.data)
} catch (error) {
  console.error('请求失败:', error.message)
}

// 取消请求
httpClient.cancelRequest('user-list-request', '用户取消了请求')

// 清除 Token
httpClient.clearAuthToken()
```

---

## 总结

这个 HTTP 客户端封装设计提供了：

1. **模块化设计**：各个功能模块独立，易于维护和扩展
2. **类型安全**：完整的 TypeScript 类型定义
3. **健壮性**：完善的错误处理和重试机制
4. **可扩展性**：支持自定义拦截器、错误处理器等
5. **易用性**：简洁的 API 设计，开箱即用

下一步可以开始实现各个模块的代码。