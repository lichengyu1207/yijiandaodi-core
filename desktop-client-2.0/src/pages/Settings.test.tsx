/**
 * Settings 页面「操作权限」区块单元测试
 * 覆盖：
 *  - 加载权限配置并渲染 PermissionList（勾选状态回显）
 *  - 切换勾选后保存，调用 setPermissionConfig 并回显成功提示
 *  - 保存失败（success:false）时展示错误提示
 *  - 非 Electron 环境：显示"不支持该设置"
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import Settings from './Settings'

// ---- mock 服务与 API 层 ----
vi.mock('../services/authService', () => ({
  authService: {
    getCurrentUser: () => ({ id: 1, username: 'admin', email: '', role: 'admin' }),
  },
}))

vi.mock('../services/memoryApi', () => ({
  StrategicMemoryApi: {
    getInstance: () => ({
      getStrategies: () => Promise.resolve([]),
    }),
  },
}))

// 全局 fetch mock（服务状态轮询 / 节点指标）
beforeEach(() => {
  vi.clearAllMocks()
  ;(global as any).fetch = vi.fn().mockImplementation((url: string) => {
    if (String(url).includes('/health')) {
      return Promise.resolve({ ok: true })
    }
    if (String(url).includes('/metrics')) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            cpu_usage: 10,
            memory_usage: 20,
            gpu_usage: null,
            disk_available: 100,
            disk_total: 200,
          }),
      })
    }
    return Promise.reject(new Error('unhandled fetch'))
  })
})

/** 构造可用的 electronAPI mock（覆盖权限 + 治理日志相关方法） */
function createMockApi(overrides: Record<string, any> = {}) {
  return {
    getPermissionConfig: vi.fn().mockResolvedValue({
      success: true,
      data: { onboarded: true, granted: { fileMonitor: true, clipboardMonitor: false, tray: true } },
    }),
    setPermissionConfig: vi.fn().mockResolvedValue({ success: true }),
    getGovernanceLogLevel: vi.fn().mockResolvedValue({ success: true, data: { level: 'debug' } }),
    setGovernanceLogLevel: vi.fn().mockResolvedValue({ success: true }),
    setProcessBackend: vi.fn().mockResolvedValue({ success: true }),
    ...overrides,
  }
}

let mockApi: ReturnType<typeof createMockApi>

beforeEach(() => {
  mockApi = createMockApi()
  ;(window as any).electronAPI = mockApi
})

afterEach(() => {
  ;(window as any).electronAPI = undefined
})

async function renderSettings() {
  render(<Settings />)
  // 等待权限区块渲染完成
  await screen.findByText('操作权限')
  await waitFor(() => expect(screen.queryByText('正在加载操作权限配置...')).not.toBeInTheDocument())
}

describe('Settings 操作权限区块', () => {
  it('加载权限配置并回显勾选状态', async () => {
    await renderSettings()

    expect(mockApi.getPermissionConfig).toHaveBeenCalled()
    // 权限列表中的复选框按配置回显
    const checkboxes = screen.getAllByRole('checkbox')
    const byLabel = (label: string) =>
      checkboxes.find((c) => c.closest('label')?.textContent?.includes(label))

    expect(byLabel('文件系统监控')?.checked).toBe(true)
    expect(byLabel('剪贴板监控')?.checked).toBe(false)
  })

  it('切换勾选后点击保存，调用 setPermissionConfig 并展示成功提示', async () => {
    await renderSettings()

    // 打开「剪贴板监控」
    const clipboard = screen.getAllByRole('checkbox').find((c) =>
      c.closest('label')?.textContent?.includes('剪贴板监控'),
    )!
    fireEvent.click(clipboard)

    // 保存
    fireEvent.click(screen.getByRole('button', { name: /保存操作权限/ }))

    await waitFor(() => expect(mockApi.setPermissionConfig).toHaveBeenCalledTimes(1))
    // 传入的 granted 应包含剪贴板监控的开启
    const patch = mockApi.setPermissionConfig.mock.calls[0][0]
    expect(patch.clipboardMonitor).toBe(true)
    expect(patch.fileMonitor).toBe(true)

    await waitFor(() => expect(screen.getByText('操作权限已保存并立即生效')).toBeInTheDocument())
  })

  it('保存失败（success:false）时展示错误提示', async () => {
    mockApi = createMockApi({
      setPermissionConfig: vi.fn().mockResolvedValue({ success: false, error: '权限配置文件写入失败' }),
    })
    ;(window as any).electronAPI = mockApi

    await renderSettings()

    fireEvent.click(screen.getByRole('button', { name: /保存操作权限/ }))

    await waitFor(() =>
      expect(screen.getByText('权限配置文件写入失败')).toBeInTheDocument(),
    )
  })

  it('保存时 IPC 抛异常展示错误提示', async () => {
    mockApi = createMockApi({
      setPermissionConfig: vi.fn().mockRejectedValue(new Error('IPC channel closed')),
    })
    ;(window as any).electronAPI = mockApi

    await renderSettings()

    fireEvent.click(screen.getByRole('button', { name: /保存操作权限/ }))

    await waitFor(() => expect(screen.getByText('IPC channel closed')).toBeInTheDocument())
  })

  it('非 Electron 环境：保存时提示不支持', async () => {
    ;(window as any).electronAPI = {
      // 无 setPermissionConfig，仅有部分方法以避免其它分支报错
      getGovernanceLogLevel: vi.fn().mockResolvedValue({ success: true, data: { level: 'debug' } }),
    }

    await renderSettings()

    fireEvent.click(screen.getByRole('button', { name: /保存操作权限/ }))

    await waitFor(() => expect(screen.getByText('当前环境不支持该设置')).toBeInTheDocument())
  })
})
