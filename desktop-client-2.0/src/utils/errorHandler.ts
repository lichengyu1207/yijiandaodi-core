/**
 * 错误处理和提示工具
 */

// 错误类型定义
export type ErrorType = 
  | 'network'        // 网络错误
  | 'auth'           // 认证错误
  | 'validation'     // 验证错误
  | 'server'         // 服务器错误
  | 'timeout'        // 超时错误
  | 'unknown'        // 未知错误

// 错误信息接口
export interface ErrorMessage {
  type: ErrorType
  title: string
  message: string
  action?: string
}

/**
 * 解析错误类型
 */
export function parseError(error: any): ErrorMessage {
  // 网络错误
  if (!navigator.onLine) {
    return {
      type: 'network',
      title: '网络连接失败',
      message: '请检查您的网络连接后重试',
      action: '重试'
    }
  }

  // API错误
  if (error.response) {
    const status = error.response.status
    const data = error.response.data

    // 认证错误
    if (status === 401) {
      return {
        type: 'auth',
        title: '认证失败',
        message: data?.error || '用户名或密码错误',
        action: '重新登录'
      }
    }

    // 权限错误
    if (status === 403) {
      return {
        type: 'auth',
        title: '权限不足',
        message: '您没有权限执行此操作'
      }
    }

    // 验证错误
    if (status === 400) {
      return {
        type: 'validation',
        title: '数据验证失败',
        message: data?.error || '请检查输入信息是否正确',
        action: '修改'
      }
    }

    // 服务器错误
    if (status >= 500) {
      return {
        type: 'server',
        title: '服务器错误',
        message: '服务器暂时无法响应，请稍后重试',
        action: '重试'
      }
    }
  }

  // 超时错误
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return {
      type: 'timeout',
      title: '请求超时',
      message: '请求时间过长，请检查网络后重试',
      action: '重试'
    }
  }

  // 默认错误
  return {
    type: 'unknown',
    title: '操作失败',
    message: error.message || '发生未知错误，请稍后重试',
    action: '重试'
  }
}

/**
 * 显示错误提示（可扩展为Toast、Modal等）
 */
export function showError(error: any): void {
  const errorInfo = parseError(error)
  
  // 开发环境下打印详细错误
  if (process.env.NODE_ENV === 'development') {
    console.error('错误详情:', error)
  }

  // 生产环境下可以使用更友好的提示方式
  // 例如：Toast.error(errorInfo.message)
  alert(`${errorInfo.title}\n\n${errorInfo.message}`)
}

/**
 * 显示成功提示
 */
export function showSuccess(message: string): void {
  // 生产环境下可以使用更友好的提示方式
  // 例如：Toast.success(message)
  console.log('成功:', message)
}

/**
 * 显示警告提示
 */
export function showWarning(message: string): void {
  // 生产环境下可以使用更友好的提示方式
  // 例如：Toast.warning(message)
  console.warn('警告:', message)
}

/**
 * 显示信息提示
 */
export function showInfo(message: string): void {
  // 生产环境下可以使用更友好的提示方式
  // 例如：Toast.info(message)
  console.log('信息:', message)
}

/**
 * 延迟函数
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 重试函数
 */
export async function retry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (error) {
      if (i === retries - 1) {
        throw error
      }
      await delay(delayMs)
    }
  }
  throw new Error('重试次数用尽')
}