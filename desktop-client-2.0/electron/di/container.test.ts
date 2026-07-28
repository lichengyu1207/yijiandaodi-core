/**
 * 依赖注入容器测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { DIContainer } from '../container'

describe('DIContainer', () => {
  let container: DIContainer

  beforeEach(() => {
    container = new DIContainer()
  })

  describe('register', () => {
    it('should register a service', () => {
      const service = { name: 'test' }
      container.register('testService', service)

      expect(container.has('testService')).toBe(true)
    })

    it('should overwrite existing service', () => {
      const service1 = { name: 'service1' }
      const service2 = { name: 'service2' }

      container.register('testService', service1)
      container.register('testService', service2)

      const resolved = container.resolve('testService')
      expect(resolved.name).toBe('service2')
    })
  })

  describe('resolve', () => {
    it('should resolve a registered service', () => {
      const service = { name: 'test' }
      container.register('testService', service)

      const resolved = container.resolve('testService')
      expect(resolved).toBe(service)
    })

    it('should throw error for unregistered service', () => {
      expect(() => {
        container.resolve('unregistered')
      }).toThrow("Service 'unregistered' not found in DI container")
    })
  })

  describe('has', () => {
    it('should return true for registered service', () => {
      container.register('testService', {})
      expect(container.has('testService')).toBe(true)
    })

    it('should return false for unregistered service', () => {
      expect(container.has('unregistered')).toBe(false)
    })
  })

  describe('clear', () => {
    it('should clear all services', () => {
      container.register('service1', {})
      container.register('service2', {})

      container.clear()

      expect(container.has('service1')).toBe(false)
      expect(container.has('service2')).toBe(false)
    })
  })
})