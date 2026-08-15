/**
 * 错误上报器（简化版）
 */

export type ErrorLevel = 'fatal' | 'error' | 'warning' | 'info' | 'debug'
export type ErrorType = 'uncaught_exception' | 'unhandled_rejection' | 'renderer_error' | 'api_error' | 'business_error'

export interface ErrorContext {
  type: ErrorType
  level: ErrorLevel
  process: 'main' | 'renderer'
  timestamp: number
  message: string
  tags?: Record<string, string>
  extra?: Record<string, any>
}

/**
 * 错误上报器类
 */
export class ErrorReporter {
  /**
   * 创建错误处理装饰器
   */
  static withErrorHandling(
    _type: ErrorType = 'business_error',
    _level: ErrorLevel = 'error',
    _tags?: Record<string, string>
  ) {
    return function (
      _target: any,
      propertyKey: string,
      descriptor: PropertyDescriptor
    ) {
      const originalMethod = descriptor.value

      descriptor.value = async function (...args: any[]) {
        try {
          return await originalMethod.apply(this, args)
        } catch (error) {
          console.error(`[ErrorReporter] ${propertyKey} 执行失败:`, error)
          throw error
        }
      }

      return descriptor
    }
  }

  /**
   * 上报 API 错误
   */
  static reportApiError(error: Error, context?: Record<string, any>): void {
    console.error('[ErrorReporter] API 错误:', error, context)
  }

  /**
   * 上报网络错误
   */
  static reportNetworkError(error: Error, context?: Record<string, any>): void {
    console.error('[ErrorReporter] 网络错误:', error, context)
  }

  /**
   * 上报文件错误
   */
  static reportFileError(error: Error, context?: Record<string, any>): void {
    console.error('[ErrorReporter] 文件错误:', error, context)
  }

  /**
   * 上报验证错误
   */
  static reportValidationError(error: Error, context?: Record<string, any>): void {
    console.error('[ErrorReporter] 验证错误:', error, context)
  }
}

export default ErrorReporter