/**
 * 依赖注入容器
 */

export class DIContainer {
  private services = new Map<string, any>()

  register<T>(name: string, instance: T): void {
    this.services.set(name, instance)
  }

  resolve<T>(name: string): T {
    const service = this.services.get(name)
    if (!service) {
      throw new Error(`Service '${name}' not found in DI container`)
    }
    return service
  }

  has(name: string): boolean {
    return this.services.has(name)
  }

  clear(): void {
    this.services.clear()
  }
}