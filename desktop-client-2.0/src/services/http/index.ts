/**
 * HTTP 客户端单例实例
 * 
 * 功能：
 * - 统一的 HTTP 客户端实例
 * - 自动集成熔断器
 * - 日志记录
 * - 错误处理
 * 
 * 作者：一鉴到底团队
 * 创建时间：2026-08-12
 */

import { HttpClient } from './HttpClient'
import { apiConfig } from '../../config/apiConfig'

/**
 * 创建并导出 HTTP 客户端单例实例
 */
class HttpClientSingleton {
  private static instance: HttpClient

  static getInstance(): HttpClient {
    if (!HttpClientSingleton.instance) {
      const baseURL = apiConfig.getBaseURL()

      HttpClientSingleton.instance = new HttpClient({
        baseURL,
        timeout: 30000,
        logging: {
          enabled: true,
          level: 1, // INFO 级别
          logRequestBody: true,
          logResponseBody: true,
          performance: {
            warnThreshold: 2000,
            errorThreshold: 5000
          }
        },
        circuitBreaker: {
          enabled: true,
          failureThreshold: 5,
          failureRateThreshold: 0.5,
          minimumNumberOfCalls: 10,
          timeWindow: 60000,
          openDuration: 30000,
          halfOpenMaxCalls: 3,
          successThreshold: 3,
          slowCallDurationThreshold: 5000,
          slowCallRateThreshold: 0.8,

          // 降级函数
          fallbackFunction: async (context) => {
            console.log(`[HTTP降级] 服务暂时不可用`, {
              requestId: context.requestId,
              path: context.path,
              method: context.method,
              failureRate: `${(context.failureRate * 100).toFixed(2)}%`
            })

            // 根据不同的请求路径返回不同的降级数据
            if (context.path.includes('/api/v1/file-watch')) {
              return {
                data: {
                  success: false,
                  message: '文件监控服务暂时不可用',
                  errorCode: 'FILE_WATCH_SERVICE_UNAVAILABLE',
                  degraded: true,
                  requestId: context.requestId
                },
                status: 503
              }
            }

            if (context.path.includes('/api/v1/verify')) {
              return {
                data: {
                  success: false,
                  message: '验证服务暂时不可用',
                  errorCode: 'VERIFY_SERVICE_UNAVAILABLE',
                  degraded: true,
                  requestId: context.requestId
                },
                status: 503
              }
            }

            // 默认降级响应
            return {
              data: {
                success: false,
                message: '服务暂时不可用，请稍后重试',
                errorCode: 'SERVICE_UNAVAILABLE',
                degraded: true,
                requestId: context.requestId
              },
              status: 503
            }
          }
        }
      })

      console.log(`[HTTP客户端] 初始化完成，baseURL: ${baseURL}`)
    }

    return HttpClientSingleton.instance
  }

  /**
   * 重置 HTTP 客户端（用于切换环境）
   */
  static reset(): void {
    HttpClientSingleton.instance = new HttpClient({
      baseURL: apiConfig.getBaseURL(),
      timeout: 30000,
      logging: {
        enabled: true,
        level: 1,
        logRequestBody: true,
        logResponseBody: true
      },
      circuitBreaker: {
        enabled: true,
        failureThreshold: 5,
        failureRateThreshold: 0.5,
        minimumNumberOfCalls: 10,
        timeWindow: 60000,
        openDuration: 30000,
        halfOpenMaxCalls: 3,
        successThreshold: 3,
        slowCallDurationThreshold: 5000,
        slowCallRateThreshold: 0.8
      }
    })
  }
}

// 导出单例实例
export const httpClient = HttpClientSingleton.getInstance()

// 导出类型
export { HttpClient } from './HttpClient'
export * from './types/http.types'
export * from './circuit-breaker/circuit.types'