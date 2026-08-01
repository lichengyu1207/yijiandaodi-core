/**
 * 渲染进程错误上报工具
 *
 * 用于在渲染进程中上报错误到主进程的 ErrorMonitor
 */

import { ipcRenderer } from 'electron'
import type { ErrorLevel, ErrorType, ErrorContext } from '../../electron/services/errorMonitor'

/**
 * 上报错误到主进程
 */
export async function reportError(
  error: Error | string,
  context?: Partial<ErrorContext>
): Promise<{ success: boolean; errorId: string }> {
  try {
    const result = await ipcRenderer.invoke('error-monitor:report', error, {
      ...context,
      process: 'renderer'
    })
    return result
  } catch (err) {
    console.error('[Renderer] 上报错误失败:', err)
    return { success: false, errorId: '' }
  }
}

/**
 * 添加面包屑到主进程
 */
export async function addBreadcrumb(breadcrumb: {
  level: ErrorLevel
  category: string
  message: string
  data?: Record<string, any>
}): Promise<void> {
  try {
    await ipcRenderer.invoke('error-monitor:breadcrumb', breadcrumb)
  } catch (err) {
    console.error('[Renderer] 添加面包屑失败:', err)
  }
}

/**
 * 获取错误统计
 */
export async function getErrorStats(): Promise<any> {
  try {
    return await ipcRenderer.invoke('error-monitor:stats')
  } catch (err) {
    console.error('[Renderer] 获取错误统计失败:', err)
    return null
  }
}

/**
 * 创建错误处理装饰器
 */
export function withErrorHandling(
  type: ErrorType = 'business_error',
  level: ErrorLevel = 'error',
  tags?: Record<string, string>
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      try {
        return await originalMethod.apply(this, args)
      } catch (error) {
        await reportError(error as Error, {
          type,
          level,
          tags,
          extra: {
            method: propertyKey,
            arguments: args
          }
        })
        throw error
      }
    }

    return descriptor
  }
}

/**
 * 全局错误处理器（渲染进程）
 */
export function setupGlobalErrorHandler() {
  // 捕获未处理的 Promise 拒绝
  window.addEventListener('unhandledrejection', async (event) => {
    event.preventDefault()

    await reportError(event.reason instanceof Error
      ? event.reason
      : new Error(String(event.reason)), {
      type: 'unhandled_rejection',
      level: 'error',
      process: 'renderer'
    })
  })

  // 捕获未捕获的异常
  window.addEventListener('error', async (event) => {
    event.preventDefault()

    if (event.error) {
      await reportError(event.error, {
        type: 'uncaught_exception',
        level: 'fatal',
        process: 'renderer'
      })
    }
  })

  console.log('[Renderer] 全局错误处理器已设置')
}

/**
 * 手动上报 API 错误
 */
export async function reportApiError(
  error: Error,
  endpoint: string,
  method: string = 'GET',
  statusCode?: number
): Promise<string> {
  const result = await reportError(error, {
    type: 'api_error',
    level: 'error',
    tags: {
      endpoint,
      method,
      statusCode: statusCode?.toString() || 'unknown'
    },
    extra: {
      timestamp: Date.now()
    }
  })
  return result.errorId
}

/**
 * 手动上报网络错误
 */
export async function reportNetworkError(
  error: Error,
  context?: {
    url?: string
    timeout?: boolean
    offline?: boolean
  }
): Promise<string> {
  const result = await reportError(error, {
    type: 'network_error',
    level: 'warning',
    extra: {
      ...context,
      timestamp: Date.now()
    }
  })
  return result.errorId
}

/**
 * 手动上报文件操作错误
 */
export async function reportFileError(
  error: Error,
  filePath: string,
  operation: 'read' | 'write' | 'delete' | 'copy' | 'move'
): Promise<string> {
  const result = await reportError(error, {
    type: 'file_error',
    level: 'error',
    tags: {
      operation,
      filePath
    },
    extra: {
      timestamp: Date.now()
    }
  })
  return result.errorId
}

/**
 * 手动上报验证错误
 */
export async function reportValidationError(
  error: Error,
  field?: string,
  value?: any
): Promise<string> {
  const result = await reportError(error, {
    type: 'validation_error',
    level: 'warning',
    tags: {
      field: field || 'unknown'
    },
    extra: {
      value: value ? '[REDACTED]' : undefined,
      timestamp: Date.now()
    }
  })
  return result.errorId
}