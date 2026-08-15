/**
 * 熔断器状态枚举
 */
export enum CircuitStateType {
  CLOSED = 'CLOSED',           // 关闭（正常）
  OPEN = 'OPEN',               // 打开（熔断）
  HALF_OPEN = 'HALF_OPEN'      // 半打开（探测）
}

/**
 * 熔断器配置
 */
export interface CircuitBreakerConfig {
  // 失败阈值配置
  failureThreshold: number           // 失败次数阈值
  failureRateThreshold: number       // 失败率阈值（0-1）
  minimumNumberOfCalls: number       // 最小调用次数（计算失败率）

  // 时间窗口配置
  timeWindow: number                 // 统计时间窗口（毫秒）

  // 熔断配置
  openDuration: number               // 熔断持续时间（毫秒）
  halfOpenMaxCalls: number           // 半打开状态最大调用次数

  // 恢复配置
  successThreshold: number           // 恢复成功阈值
  slowCallDurationThreshold: number  // 慢调用阈值（毫秒）
  slowCallRateThreshold: number      // 慢调用率阈值（0-1）

  // 降级配置（改进版）
  fallbackFunction?: (context: FallbackContext) => Promise<any>
}

/**
 * 降级上下文
 */
export interface FallbackContext {
  // 请求信息
  requestId: string                  // 请求ID
  method: string                     // 请求方法（GET/POST/PUT/DELETE等）
  url: string                        // 完整URL
  path: string                       // 请求路径
  params?: any                       // 请求参数
  data?: any                         // 请求体数据
  headers?: any                      // 请求头

  // 熔断信息
  serviceName: string                // 服务名称
  circuitState: CircuitStateType     // 熔断器状态
  failureCount: number               // 失败次数
  failureRate: number                // 失败率（0-1）
  slowCallRate: number               // 慢调用率（0-1）

  // 自定义错误码（可选）
  errorCode?: string                 // 自定义错误码
  errorMessage?: string              // 自定义错误消息

  // 其他元数据
  metadata?: Record<string, any>     // 请求元数据
}

/**
 * 熔断器状态
 */
export interface CircuitBreakerStatus {
  serviceName: string
  state: CircuitStateType
  lastStateChangeTime: number
  statistics: CircuitStatisticsSnapshot
  config: CircuitBreakerConfig
}

/**
 * 统计快照
 */
export interface CircuitStatisticsSnapshot {
  totalCalls: number
  successfulCalls: number
  failedCalls: number
  failureCount: number
  failureRate: number
  slowCalls: number
  slowCallRate: number
  avgDuration: number
  timeWindow: number
}

/**
 * 请求结果
 */
export interface RequestResult {
  success: boolean
  duration: number
  error?: Error
  isSlowCall?: boolean
}