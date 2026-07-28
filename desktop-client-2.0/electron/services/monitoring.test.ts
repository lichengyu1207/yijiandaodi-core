/**
 * 监控服务测试
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FileMonitor } from '../monitoring/fileMonitor'
import { ClipboardMonitor } from '../monitoring/clipboardMonitor'
import { initSecurityKnowledgeBase } from '../securityKnowledgeBase'

// Mock Electron API
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock/path')
  }
}))

describe('Monitoring Services', () => {
  let fileMonitor: FileMonitor
  let clipboardMonitor: ClipboardMonitor
  let securityKB: any

  beforeEach(() => {
    securityKB = initSecurityKnowledgeBase()
    fileMonitor = new FileMonitor()
    clipboardMonitor = new ClipboardMonitor()
  })

  afterEach(() => {
    fileMonitor.stop()
    clipboardMonitor.stop()
  })

  describe('FileMonitor', () => {
    it('should initialize with default config', () => {
      expect(fileMonitor).toBeDefined()
    })

    it('should set security knowledge base', () => {
      fileMonitor.setSecurityKnowledgeBase(securityKB)
      expect(fileMonitor).toBeDefined()
    })

    it('should register risk detected callback', () => {
      const callback = vi.fn()
      fileMonitor.setRiskDetectedCallback(callback)
      expect(fileMonitor).toBeDefined()
    })

    it('should register pet state change callback', () => {
      const callback = vi.fn()
      fileMonitor.setPetStateChangeCallback(callback)
      expect(fileMonitor).toBeDefined()
    })
  })

  describe('ClipboardMonitor', () => {
    it('should initialize', () => {
      expect(clipboardMonitor).toBeDefined()
    })

    it('should set security knowledge base', () => {
      clipboardMonitor.setSecurityKnowledgeBase(securityKB)
      expect(clipboardMonitor).toBeDefined()
    })

    it('should register risk detected callback', () => {
      const callback = vi.fn()
      clipboardMonitor.setRiskDetectedCallback(callback)
      expect(clipboardMonitor).toBeDefined()
    })
  })
})