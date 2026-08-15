import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios'
import { RequestLogger } from './logging/RequestLogger'
import { CircuitBreaker } from './circuit-breaker/CircuitBreaker'
import { authService } from '../authService'
import {
  HttpClientConfig,
  HttpRequestConfig,
  HttpResponse,
  HttpError,
  ErrorType,
  LogLevel
} from './types/http.types'

/**
 * HTTP 客户端核心类
 */
export class HttpClient {
  private client: AxiosInstance
  private requestLogger: RequestLogger
  private config: HttpClientConfig
  private circuitBreaker: CircuitBreaker

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

    // 初始化日志记录器
    this.requestLogger = new RequestLogger(config.logging)

    console.log(`[HttpClient] [初始化] HttpClient 初始化开始`, {
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      loggingEnabled: config.logging?.enabled,
      circuitBreakerEnabled: config.circuitBreaker?.enabled
    })

    // 初始化熔断器（如果启用）
    if (config.circuitBreaker?.enabled) {
      this.circuitBreaker = new CircuitBreaker(
        config.baseURL,
        config.circuitBreaker
      )

      console.log(`[HttpClient] [熔断器] 熔断器已启用并初始化`, {
        serviceName: config.baseURL,
        failureThreshold: config.circuitBreaker.failureThreshold,
        openDuration: `${config.circuitBreaker.openDuration}ms`,
        successThreshold: config.circuitBreaker.successThreshold,
        hasFallback: !!config.circuitBreaker.fallbackFunction
      })
    } else {
      console.log(`[HttpClient] [熔断器] 熔断器未启用`)
    }

    // 设置拦截器
    this.setupInterceptors()

    console.log(`[HttpClient] [初始化完成] HttpClient 已就绪`, {
      baseURL: config.baseURL,
      timestamp: new Date().toISOString()
    })
  }

  /**
   * 设置拦截器
   */
  private setupInterceptors(): void {
    // 请求拦截器
    this.client.interceptors.request.use(
      (config) => {
        // 注入 JWT token（若有）
        const token = authService.getToken()
        if (token && config.headers) {
          config.headers['Authorization'] = `Bearer ${token}`
        }

        // 记录请求日志
        this.requestLogger.logRequest(config)
        return config
      },
      (error) => {
        console.error(`[HttpClient] 请求拦截器错误:`, error)
        return Promise.reject(error)
      }
    )

    // 响应拦截器
    this.client.interceptors.response.use(
      (response) => {
        // 记录响应日志
        this.requestLogger.logResponse(response)
        return response
      },
      async (error: AxiosError) => {
        // 记录错误日志
        this.requestLogger.logError(error)

        const originalRequest = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined

        // access token 过期：刷新后重试一次（_retry 防止无限重试）
        if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
          console.warn(`[HttpClient] 请求 401（access token 可能过期），url=${originalRequest.url}，开始刷新`)
          originalRequest._retry = true
          console.log('[HttpClient] 尝试获取共享刷新锁')
          const refreshed = await authService.refreshTokenGuarded()
          if (refreshed) {
            console.log(`[HttpClient] 刷新成功，重试请求 url=${originalRequest.url}`)
            if (originalRequest.headers) {
              originalRequest.headers['Authorization'] = `Bearer ${authService.getToken()}`
            }
            return this.client.request(originalRequest)
          }
          console.warn(`[HttpClient] 刷新失败，url=${originalRequest.url} 不再重试`)
        }

        // 统一错误处理
        const httpError = this.handleError(error)
        return Promise.reject(httpError)
      }
    )
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
   * 核心请求方法
   */
  private async request<T>(
    method: string,
    url: string,
    data?: any,
    config?: HttpRequestConfig
  ): Promise<HttpResponse<T>> {
    const requestId = this.generateRequestId()
    const startTime = Date.now()

    console.log(`[HttpClient] [${requestId}] [请求发起]`, {
      method,
      url,
      baseURL: this.config.baseURL,
      timestamp: new Date().toISOString()
    })

    // 如果熔断器启用，通过熔断器执行请求
    if (this.circuitBreaker) {
      console.log(`[HttpClient] [${requestId}] [熔断器检查] 熔断器已启用，进入熔断器执行流程`)

      try {
        const response = await this.circuitBreaker.execute<HttpResponse<T>>(
          async () => {
            console.log(`[HttpClient] [${requestId}] [执行请求] 开始执行实际HTTP请求`)
            return await this.executeRequest<T>(method, url, data, config, requestId, startTime)
          },
          requestId,
          method,
          `${this.config.baseURL}${url}`,
          config
        )

        console.log(`[HttpClient] [${requestId}] [请求完成] 熔断器执行成功`, {
          duration: `${Date.now() - startTime}ms`
        })

        return response
      } catch (error: any) {
        const elapsed = Date.now() - startTime
        console.error(`[HttpClient] [${requestId}] [请求失败] 熔断器执行失败`, {
          duration: `${elapsed}ms`,
          error: error.message
        })

        throw error
      }
    }

    // 否则直接执行请求
    console.log(`[HttpClient] [${requestId}] [直接执行] 熔断器未启用，直接执行请求`)
    return this.executeRequest<T>(method, url, data, config, requestId, startTime)
  }

  /**
   * 执行实际的 HTTP 请求
   */
  private async executeRequest<T>(
    method: string,
    url: string,
    data?: any,
    config?: HttpRequestConfig,
    requestId?: string,
    startTime?: number
  ): Promise<HttpResponse<T>> {
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

      console.log(`[HttpClient] [${requestId}] [axios请求] 发起 axios 请求`, {
        method,
        url,
        hasData: !!data,
        timeout: requestConfig.timeout
      })

      // 执行请求
      const response = await this.client.request<T>(requestConfig)

      const elapsed = Date.now() - (startTime || Date.now())
      console.log(`[HttpClient] [${requestId}] [axios成功] HTTP 请求成功`, {
        status: response.status,
        statusText: response.statusText,
        duration: `${elapsed}ms`,
        responseSize: JSON.stringify(response.data).length
      })

      return this.transformResponse<T>(response)

    } catch (error: any) {
      const elapsed = Date.now() - (startTime || Date.now())

      console.error(`[HttpClient] [${requestId}] [axios失败] HTTP 请求失败`, {
        duration: `${elapsed}ms`,
        errorMessage: error.message,
        errorCode: error.code,
        statusCode: error.response?.status
      })

      throw error
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
   * 错误处理
   */
  private handleError(error: AxiosError): HttpError {
    const requestId = (error.config?.headers?.['X-Request-ID'] as string) || 'unknown'

    // 响应错误（服务器返回了错误状态码）
    if (error.response) {
      return this.handleResponseError(error, requestId)
    }

    // 请求错误（请求已发出但没有收到响应）
    if (error.request) {
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

    const retryableCodes = [408, 429, 500, 502, 503, 504]
    const retryableErrorCodes = ['ECONNABORTED', 'ECONNREFUSED', 'ENETUNREACH']

    if (typeof statusOrCode === 'number') {
      return retryableCodes.includes(statusOrCode)
    }

    return retryableErrorCodes.includes(statusOrCode)
  }

  /**
   * 生成请求 ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * 获取请求日志
   */
  getRequestLogs(filter?: {
    requestId?: string
    method?: string
    status?: number
    minDuration?: number
    startTime?: Date
    endTime?: Date
  }): Array<any> {
    return this.requestLogger.getStoredLogs(filter)
  }

  /**
   * 获取请求统计
   */
  getRequestStatistics(): {
    totalRequests: number
    successRequests: number
    failedRequests: number
    avgDuration: number
    maxDuration: number
    minDuration: number
    avgResponseSize: number
  } {
    return this.requestLogger.getStatistics()
  }

  /**
   * 清除请求日志
   */
  clearRequestLogs(): void {
    this.requestLogger.clearLogs()
  }

  /**
   * 获取熔断器状态
   */
  getCircuitBreakerStatus(): {
    state: string
    statistics: any
  } | null {
    if (!this.circuitBreaker) {
      return null
    }

    return {
      state: this.circuitBreaker.getState(),
      statistics: this.circuitBreaker.getStatistics()
    }
  }

  /**
   * 重置熔断器
   */
  resetCircuitBreaker(): void {
    if (this.circuitBreaker) {
      this.circuitBreaker.reset()
      console.log(`[HttpClient] 熔断器已重置`)
    }
  }
}