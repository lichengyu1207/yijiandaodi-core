import '@testing-library/jest-dom'
import { vi, afterEach } from 'vitest'

// 全局测试配置
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock Electron API
const mockElectronAPI = {
  invoke: vi.fn(),
  send: vi.fn(),
  receive: vi.fn(),
  removeAllListeners: vi.fn(),
}

// @ts-ignore - 用于测试的 mock
if (typeof window !== 'undefined') {
  window.electronAPI = mockElectronAPI
}

// 清理函数
afterEach(() => {
  vi.clearAllMocks()
})