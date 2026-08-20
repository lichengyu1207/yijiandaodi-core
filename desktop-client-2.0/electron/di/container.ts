/**
 * 依赖注入容器
 *
 * A4 完善：单例统一注册（registerSingleton）、可选依赖（resolveOptional）、
 * 重复注册告警、注册清单（names），支撑「消除 import 单例技术债 → 容器注入统一管理」。
 */

import type { GovernanceLoggerLike } from '../events/governanceLogger'

export class DIContainer {
  private services = new Map<string, any>()
  private logger?: GovernanceLoggerLike

  constructor(opts?: { logger?: GovernanceLoggerLike }) {
    this.logger = opts?.logger
  }

  /** 设置 logger（延迟注入：container 创建早于 governanceLogger 实例） */
  setLogger(logger: GovernanceLoggerLike): void {
    this.logger = logger
  }

  register<T>(name: string, instance: T): void {
    if (this.services.has(name)) {
      this.logger?.warn(`[DI] 容器重复注册已覆盖: ${name}`, { module: 'DIContainer', service: name })
    }
    this.services.set(name, instance)
  }

  /** 注册共享单例：语义化标记该实例为进程内单例，消费方一律 resolve 获取（不直接 import） */
  registerSingleton<T>(name: string, instance: T): void {
    this.register(name, instance)
  }

  resolve<T>(name: string): T {
    const service = this.services.get(name)
    if (!service) {
      throw new Error(`Service '${name}' not found in DI container`)
    }
    return service
  }

  /** 可选依赖：未注册返回 undefined（不抛错） */
  resolveOptional<T>(name: string): T | undefined {
    return this.services.get(name)
  }

  has(name: string): boolean {
    return this.services.has(name)
  }

  /** 已注册服务名（装配清单 / 排查用） */
  names(): string[] {
    return [...this.services.keys()]
  }

  clear(): void {
    this.services.clear()
  }
}
