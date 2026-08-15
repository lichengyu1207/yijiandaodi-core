/**
 * App 首次启动集成测试
 * 模拟「新用户首次安装」场景：本地无账号、无权限授权。
 * 预期流程：登录后锁定到 SetupWizard → 完成三步（账号/权限/网络）→
 * 点击「开始使用」后应直接进入主界面（Dashboard），
 * 而不是被重定向到旧的 /onboarding 权限引导页。
 *
 * 本测试保留真实的 App 路由 + SetupWizard 组件，
 * 仅 mock 掉重页面组件与服务层，专注验证跳转链路。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

// ---- 服务层 mock（App.tsx 的依赖）----
vi.mock('./services/authService', () => ({
  authService: {
    isAuthenticated: () => true,
    getToken: () => 'mock-token',
    getCurrentUser: () => ({ username: 'newuser' }),
    validateToken: () => Promise.resolve(true),
    refreshToken: () => Promise.resolve(true),
    logout: () => Promise.resolve(),
  },
}))

vi.mock('./services/strategyService', () => ({
  strategyService: { initialize: () => Promise.resolve() },
}))

vi.mock('./config/apiConfig', () => ({
  apiConfig: { getBaseURL: () => 'http://localhost:8000' },
}))

// ---- 重页面/组件 mock（保留 SetupWizard 真实逻辑）----
const MOCK_DASHBOARD = '__DASHBOARD_MOCK__'
const MOCK_ONBOARDING = '__ONBOARDING_MOCK__'

vi.mock('./pages/Dashboard', () => ({ default: () => <div>{'__DASHBOARD_MOCK__'}</div> }))
vi.mock('./pages/Evidence', () => ({ default: () => <div>evidence</div> }))
vi.mock('./pages/RealNameAuth', () => ({ default: () => <div>realname</div> }))
vi.mock('./pages/Settings', () => ({ default: () => <div>settings</div> }))
vi.mock('./pages/SyncSettings', () => ({ default: () => <div>sync</div> }))
vi.mock('./pages/ProcessStats', () => ({ default: () => <div>process</div> }))
vi.mock('./pages/Onboarding', () => ({ default: () => <div>{'__ONBOARDING_MOCK__'}</div> }))
vi.mock('./components/HealthDashboard', () => ({ default: () => <div>health</div> }))
vi.mock('./components/DesktopPet', () => ({ default: () => <div>pet</div> }))
vi.mock('./pages/Auth', () => ({ default: () => <div>auth-login</div> }))

import App from './App'

/** 新用户首次安装的 electronAPI mock（本地无账号、未授权） */
function createNewUserMockApi() {
  return {
    getPermissionConfig: vi.fn().mockResolvedValue({
      success: true,
      data: { onboarded: false, granted: { fileMonitor: false, tray: true, notifications: true } },
    }),
    getLocalAuthStatus: vi.fn().mockResolvedValue({
      success: true,
      data: { setupCompleted: false },
    }),
    registerLocalAuth: vi.fn().mockResolvedValue({ success: true }),
    setPermissionConfig: vi.fn().mockResolvedValue({ success: true }),
    setApiCallConfig: vi.fn().mockResolvedValue({ success: true }),
    completeLocalSetup: vi.fn().mockResolvedValue({ success: true }),
    completeOnboarding: vi.fn().mockResolvedValue({ success: true }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  ;(window as any).electronAPI = createNewUserMockApi()
})

async function completeSetupWizard() {
  // 第 1 步：账号
  fireEvent.change(screen.getByPlaceholderText('至少 3 个字符'), { target: { value: 'admin' } })
  fireEvent.change(screen.getByPlaceholderText('至少 6 位'), { target: { value: 'secret123' } })
  fireEvent.change(screen.getByPlaceholderText('再次输入密码'), { target: { value: 'secret123' } })
  fireEvent.click(screen.getByRole('button', { name: /下一步/ }))
  await waitFor(() => expect(screen.getByText('允许操作权限')).toBeInTheDocument(), { timeout: 5000 })

  // 第 2 步：权限
  fireEvent.click(screen.getByRole('button', { name: /下一步/ }))
  await waitFor(() => expect(screen.getByText('允许网络访问')).toBeInTheDocument(), { timeout: 5000 })

  // 第 3 步：网络
  fireEvent.click(screen.getByRole('button', { name: /完成设置/ }))
  await waitFor(() => expect(screen.getByText('设置完成')).toBeInTheDocument(), { timeout: 5000 })

  // 点击「开始使用」
  fireEvent.click(screen.getByRole('button', { name: /开始使用/ }))
}

describe('App 首次启动引导跳转链路', () => {
  it('新用户首次安装：登录后进入 SetupWizard，完成后直接跳转主界面', async () => {
    render(<App />)

    // 认证完成 + 未完成首次设置 → 应显示 SetupWizard
    await screen.findByText('欢迎使用一鉴到底', undefined, { timeout: 5000 })
    expect(screen.getByText('设置账号密码')).toBeInTheDocument()

    // 走完三步引导
    await completeSetupWizard()

    // 修复后：应直接进入主界面（Dashboard），且不出现旧的 Onboarding 引导页
    await waitFor(() => expect(screen.getByText(MOCK_DASHBOARD)).toBeInTheDocument(), { timeout: 5000 })
    expect(screen.queryByText(MOCK_ONBOARDING)).not.toBeInTheDocument()
  })

  it('完成后 completeOnboarding 与 completeLocalSetup 均被调用，本地状态标记完成', async () => {
    const api = (window as any).electronAPI
    render(<App />)

    await screen.findByText('欢迎使用一鉴到底', undefined, { timeout: 5000 })
    await completeSetupWizard()

    await waitFor(() => expect(screen.getByText(MOCK_DASHBOARD)).toBeInTheDocument(), { timeout: 5000 })

    expect(api.registerLocalAuth).toHaveBeenCalledWith({ username: 'admin', password: 'secret123' })
    expect(api.completeLocalSetup).toHaveBeenCalled()
    expect(api.completeOnboarding).toHaveBeenCalled()
  })
})
