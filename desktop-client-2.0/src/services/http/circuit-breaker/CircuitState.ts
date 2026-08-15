import { CircuitStateType } from './circuit.types'

/**
 * 熔断器状态管理
 */
export class CircuitState {
  private state: CircuitStateType = CircuitStateType.CLOSED

  /**
   * 获取当前状态
   */
  getState(): CircuitStateType {
    return this.state
  }

  /**
   * 设置状态
   */
  setState(state: CircuitStateType): void {
    this.state = state
  }

  /**
   * 判断是否允许请求
   */
  allowRequest(): boolean {
    return this.state !== CircuitStateType.OPEN
  }

  /**
   * 判断是否是打开状态
   */
  isOpen(): boolean {
    return this.state === CircuitStateType.OPEN
  }

  /**
   * 判断是否是半打开状态
   */
  isHalfOpen(): boolean {
    return this.state === CircuitStateType.HALF_OPEN
  }

  /**
   * 判断是否是关闭状态
   */
  isClosed(): boolean {
    return this.state === CircuitStateType.CLOSED
  }
}