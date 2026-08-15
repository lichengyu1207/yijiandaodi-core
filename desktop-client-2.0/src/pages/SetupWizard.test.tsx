/**
 * SetupWizard 错误处理逻辑单元测试
 * 覆盖：
 *  - 保存账号时 IPC 网络失败（reject）→ 系统错误提示
 *  - 保存账号时返回失败（success:false）→ 系统错误提示
 *  - 写入权限时 IPC 网络失败（reject）→ 系统错误提示
 *  - 写入权限时返回失败（success:false）→ 系统错误提示
 *  - 网络设置阶段失败 → 系统错误提示并停留在当前步骤
 *  - 输入校验失败 → 输入错误提示
 *  - 正常流程全部成功 → 进入完成页
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import SetupWizard from './SetupWizard'

// Mock react-router-dom 的 useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

/** 构造一套可控的 electronAPI mock */
function createMockApi() {
  return {
    getPermissionConfig: vi.fn().mockResolvedValue({ success: true, data: { granted: {} } }),
    registerLocalAuth: vi.fn(),
    setPermissionConfig: vi.fn(),
    setApiCallConfig: vi.fn(),
    completeLocalSetup: vi.fn(),
    completeOnboarding: vi.fn(),
  }
}

let mockApi: ReturnType<typeof createMockApi>

beforeEach(() => {
  vi.clearAllMocks()
  mockApi = createMockApi()
  ;(window as any).electronAPI = mockApi
})

/** 等待初始加载完成（getPermissionConfig 返回后） */
async function waitLoaded() {
  await screen.findByText('欢迎使用一鉴到底')
}

/** 仅填写账号表单并点击「下一步」（不等待步骤切换） */
function fillAndSubmitAccount() {
  fireEvent.change(screen.getByPlaceholderText('至少 3 个字符'), { target: { value: 'admin' } })
  fireEvent.change(screen.getByPlaceholderText('至少 6 位'), { target: { value: 'secret123' } })
  fireEvent.change(screen.getByPlaceholderText('再次输入密码'), { target: { value: 'secret123' } })
  fireEvent.click(screen.getByRole('button', { name: /下一步/ }))
}

/** 填写账号并提交，等待进入权限步骤 */
async function fillAccount() {
  fillAndSubmitAccount()
  await waitFor(() => expect(screen.getByText('允许操作权限')).toBeInTheDocument())
}

describe('SetupWizard 错误处理', () => {
  it('正常流程全部成功：账号 → 权限 → 网络 → 完成页', async () => {
    mockApi.registerLocalAuth.mockResolvedValue({ success: true })
    mockApi.setPermissionConfig.mockResolvedValue({ success: true })
    mockApi.setApiCallConfig.mockResolvedValue({ success: true })
    mockApi.completeLocalSetup.mockResolvedValue({ success: true })
    mockApi.completeOnboarding.mockResolvedValue({ success: true })

    render(<SetupWizard />)
    await waitLoaded()

    // 第 1 步：保存账号
    await fillAccount()
    expect(mockApi.registerLocalAuth).toHaveBeenCalledWith({ username: 'admin', password: 'secret123' })

    // 第 2 步：写入权限
    fireEvent.click(screen.getByRole('button', { name: /下一步/ }))
    await waitFor(() => expect(screen.getByText('允许网络访问')).toBeInTheDocument())
    expect(mockApi.setPermissionConfig).toHaveBeenCalled()

    // 第 3 步：网络设置并完成
    fireEvent.click(screen.getByRole('button', { name: /完成设置/ }))
    await waitFor(() => expect(screen.getByText('设置完成')).toBeInTheDocument())
    expect(mockApi.setApiCallConfig).toHaveBeenCalled()
    expect(mockApi.completeLocalSetup).toHaveBeenCalled()
    expect(mockApi.completeOnboarding).toHaveBeenCalled()

    // 点击「开始使用」→ 回调 + 跳转
    fireEvent.click(screen.getByRole('button', { name: /开始使用/ }))
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true })
  })

  it('保存账号：IPC 网络失败（reject）时显示系统错误与建议', async () => {
    mockApi.registerLocalAuth.mockRejectedValue(new Error('net::ERR_CONNECTION_RESET'))

    render(<SetupWizard />)
    await waitLoaded()
    fillAndSubmitAccount()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('操作未完成'))

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('操作未完成')
    expect(alert).toHaveTextContent('账号保存未完成，可能是应用进程无响应')
    expect(alert).toHaveTextContent('请稍后重试')
    expect(alert).toHaveTextContent('net::ERR_CONNECTION_RESET')
    // 仍停留在账号步骤
    expect(screen.getByText('设置账号密码')).toBeInTheDocument()
  })

  it('保存账号：返回失败（success:false）时显示系统错误', async () => {
    mockApi.registerLocalAuth.mockResolvedValue({ success: false, error: '本地账号已设置，不可重复注册' })

    render(<SetupWizard />)
    await waitLoaded()
    fillAndSubmitAccount()
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('操作未完成'))

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('操作未完成')
    expect(alert).toHaveTextContent('账号保存失败，未能写入本地数据库')
    expect(alert).toHaveTextContent('本地账号已设置，不可重复注册')
    expect(screen.getByText('设置账号密码')).toBeInTheDocument()
  })

  it('写入权限：IPC 网络失败（reject）时显示系统错误并停留在权限步骤', async () => {
    mockApi.registerLocalAuth.mockResolvedValue({ success: true })
    mockApi.setPermissionConfig.mockRejectedValue(new Error('IPC channel closed'))

    render(<SetupWizard />)
    await waitLoaded()
    await fillAccount()

    fireEvent.click(screen.getByRole('button', { name: /下一步/ }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('操作未完成'))

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('操作权限保存未完成，可能是应用进程无响应')
    expect(alert).toHaveTextContent('IPC channel closed')
    expect(screen.getByText('允许操作权限')).toBeInTheDocument()
    // 未进入网络步骤
    expect(screen.queryByText('允许网络访问')).not.toBeInTheDocument()
  })

  it('写入权限：返回失败（success:false）时显示系统错误', async () => {
    mockApi.registerLocalAuth.mockResolvedValue({ success: true })
    mockApi.setPermissionConfig.mockResolvedValue({ success: false, error: '权限配置文件写入失败' })

    render(<SetupWizard />)
    await waitLoaded()
    await fillAccount()

    fireEvent.click(screen.getByRole('button', { name: /下一步/ }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('操作未完成'))

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('操作权限保存失败，未能写入本地配置')
    expect(alert).toHaveTextContent('权限配置文件写入失败')
    expect(screen.getByText('允许操作权限')).toBeInTheDocument()
  })

  it('网络设置：API 调用监控保存失败时显示系统错误并停留在网络步骤', async () => {
    mockApi.registerLocalAuth.mockResolvedValue({ success: true })
    mockApi.setPermissionConfig.mockResolvedValue({ success: true })
    mockApi.setApiCallConfig.mockResolvedValue({ success: false, error: '代理端口被占用' })

    render(<SetupWizard />)
    await waitLoaded()
    await fillAccount()

    fireEvent.click(screen.getByRole('button', { name: /下一步/ }))
    await waitFor(() => expect(screen.getByText('允许网络访问')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /完成设置/ }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('操作未完成'))

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('API 调用监控配置保存失败')
    expect(alert).toHaveTextContent('代理端口被占用')
    expect(screen.getByText('允许网络访问')).toBeInTheDocument()
    expect(screen.queryByText('设置完成')).not.toBeInTheDocument()
  })

  it('网络设置：完成引导状态标记失败时显示系统错误', async () => {
    mockApi.registerLocalAuth.mockResolvedValue({ success: true })
    mockApi.setPermissionConfig.mockResolvedValue({ success: true })
    mockApi.setApiCallConfig.mockResolvedValue({ success: true })
    mockApi.completeLocalSetup.mockResolvedValue({ success: false, error: 'localAuth.json 写入失败' })

    render(<SetupWizard />)
    await waitLoaded()
    await fillAccount()

    fireEvent.click(screen.getByRole('button', { name: /下一步/ }))
    await waitFor(() => expect(screen.getByText('允许网络访问')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /完成设置/ }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('操作未完成'))

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('引导状态标记失败，可点击「完成设置」重试')
    expect(alert).toHaveTextContent('localAuth.json 写入失败')
    expect(screen.queryByText('设置完成')).not.toBeInTheDocument()
  })

  it('输入校验失败：用户名过短显示输入错误提示', async () => {
    render(<SetupWizard />)
    await waitLoaded()

    fireEvent.change(screen.getByPlaceholderText('至少 3 个字符'), { target: { value: 'ab' } })
    fireEvent.change(screen.getByPlaceholderText('至少 6 位'), { target: { value: 'secret123' } })
    fireEvent.change(screen.getByPlaceholderText('再次输入密码'), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByRole('button', { name: /下一步/ }))

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('请检查输入')
    expect(alert).toHaveTextContent('账号至少需要 3 个字符')
    // 未调用 IPC
    expect(mockApi.registerLocalAuth).not.toHaveBeenCalled()
  })

  it('输入校验失败：两次密码不一致显示输入错误提示', async () => {
    render(<SetupWizard />)
    await waitLoaded()

    fireEvent.change(screen.getByPlaceholderText('至少 3 个字符'), { target: { value: 'admin' } })
    fireEvent.change(screen.getByPlaceholderText('至少 6 位'), { target: { value: 'secret123' } })
    fireEvent.change(screen.getByPlaceholderText('再次输入密码'), { target: { value: 'different' } })
    fireEvent.click(screen.getByRole('button', { name: /下一步/ }))

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('请检查输入')
    expect(alert).toHaveTextContent('两次输入的密码不一致')
    expect(mockApi.registerLocalAuth).not.toHaveBeenCalled()
  })
})
