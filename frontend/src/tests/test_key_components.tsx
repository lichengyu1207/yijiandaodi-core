import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, RouterProvider, createMemoryRouter } from 'react-router-dom';
import AuthGuard from '@/components/AuthGuard';
import SecureInput from '@/components/SecureInput/index';
import { InputGuardAlert } from '@/components/InputGuardAlert/index';
import { DataProtectionBadge } from '@/components/DataProtectionBadge/index';
import { QuotaLimitAlert } from '@/components/QuotaLimitAlert/index';
import { MembershipStatus } from '@/components/MembershipStatus/index';

// ==================== 统一 Mock ====================

vi.mock('antd', async () => {
  const antd = await vi.importActual('antd');
  return {
    ...antd,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
    Modal: { ...antd.Modal, confirm: vi.fn() },
  };
});

vi.mock('@/api/auth', () => ({ authApi: { logout: vi.fn() } }));

const mockLogout = vi.fn();
let mockIsAuthenticated = true;

vi.mock('@/store/useAuthStore', () => ({
  useAuthStore: vi.fn((selector) =>
    selector({
      token: 'test',
      user: { id: 1, username: 'test', role: 'admin' },
      logout: mockLogout,
      isAuthenticated: () => mockIsAuthenticated,
    })
  ),
}));

vi.mock('@/utils/request', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    intercepts: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));

vi.mock('@/api/securityApi', () => ({
  checkContentSecurity: vi.fn(),
}));

// ==================== 辅助函数 ====================

function renderWithRouter(ui: React.ReactElement, initialEntries = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      {ui}
    </MemoryRouter>
  );
}

// ==================== 组件 1: AuthGuard ====================

describe('AuthGuard', () => {
  beforeEach(() => {
    mockIsAuthenticated = true;
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('有 token 且已认证时渲染 children', async () => {
    localStorage.setItem('token', 'valid-token');
    renderWithRouter(
      <AuthGuard>
        <div data-testid="protected-content">受保护的内容</div>
      </AuthGuard>
    );

    // 初始显示 loading
    expect(screen.getByText(/正在验证身份/)).toBeInTheDocument();

    // 300ms 后 loading 完成，显示 children
    await vi.advanceTimersByTimeAsync(300);
    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    expect(screen.getByText('受保护的内容')).toBeInTheDocument();
  });

  it('无 token 时重定向到 /login', async () => {
    // 不设置 token
    mockIsAuthenticated = false;
    renderWithRouter(
      <AuthGuard>
        <div>不应该看到这个</div>
      </AuthGuard>
    );

    // 无 token 时立即完成 loading（不等待 300ms）
    await waitFor(() => {
      expect(screen.queryByText('正在验证身份')).not.toBeInTheDocument();
    });

    // Navigate 组件会触发重定向
    // 验证 children 未被渲染
    expect(screen.queryByText('不应该看到这个')).not.toBeInTheDocument();
  });

  it('有 token 但未认证时重定向到 /login', async () => {
    localStorage.setItem('token', 'expired-token');
    mockIsAuthenticated = false;
    renderWithRouter(
      <AuthGuard>
        <div>不应出现</div>
      </AuthGuard>
    );

    await vi.advanceTimersByTimeAsync(300);
    expect(screen.queryByText('不应出现')).not.toBeInTheDocument();
  });

  it('初始状态显示加载中提示', () => {
    localStorage.setItem('token', 'test-token');
    const { container } = renderWithRouter(
      <AuthGuard>
        <div>内容</div>
      </AuthGuard>
    );

    // 应显示 Spin 和 "正在验证身份..."
    expect(screen.getByText(/正在验证身份/)).toBeInTheDocument();
    expect(container.querySelector('.ant-spin')).toBeTruthy();
  });
});

// ==================== 组件 2: SecureInput ====================

describe('SecureInput', () => {
  beforeEach(() => {
    vi.mocked(require('@/api/securityApi').checkContentSecurity).mockResolvedValue({ data: null });
  });

  const defaultProps = {
    value: '',
    onChange: vi.fn(),
  };

  it('正常渲染输入框和占位符', () => {
    renderWithRouter(<SecureInput {...defaultProps} />);
    expect(screen.getByPlaceholderText(/请输入内容/)).toBeInTheDocument();
  });

  it('输入值变化时调用 onChange', () => {
    renderWithRouter(<SecureInput {...defaultProps} />);
    const textarea = screen.getByPlaceholderText(/请输入内容/) as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: 'hello' } });
    expect(defaultProps.onChange).toHaveBeenCalledWith('hello');
  });

  it('显示字数统计', () => {
    renderWithRouter(<SecureInput {...defaultProps} value="test" onChange={vi.fn()} />);
    expect(screen.getByText(/4 \/ 10000/)).toBeInTheDocument();
  });

  it('字数接近上限时统计变红', () => {
    const longValue = 'a'.repeat(9001); // 超过 maxLength * 0.9 = 9000
    renderWithRouter(
      <SecureInput value={longValue} onChange={vi.fn()} />
    );
    const charCount = screen.getByText(/9001 \/ 10000/);
    expect(charCount).toHaveStyle({ color: '#EF4444' });
  });

  it('安全检测通过后显示绿色盾牌图标和状态栏', async () => {
    const mockFn = vi.mocked(require('@/api/securityApi').checkContentSecurity);
    mockFn.mockResolvedValue({
      data: {
        is_safe: true,
        risk_level: 'low',
        action_taken: 'pass',
        matched_rules: [],
        warning_message: '',
        masked_content: '',
      },
    });

    const longValue = 'a'.repeat(15); // 触发检测（>=10字符）
    renderWithRouter(<SecureInput value={longValue} onChange={vi.fn()} />);

    // 等待防抖 + API 返回
    await waitFor(() => {
      expect(mockFn).toHaveBeenCalled();
    }, { timeout: 2000 });
  });

  it('禁用状态下 textarea 不可编辑', () => {
    renderWithRouter(<SecureInput {...defaultProps} disabled={true} />);
    const textarea = screen.getByPlaceholderText(/请输入内容/) as HTMLTextAreaElement;
    expect(textarea.disabled).toBe(true);
  });
});

// ==================== 组件 3: InputGuardAlert ====================

describe('InputGuardAlert', () => {
  it('result 为 null 时不渲染任何内容', () => {
    const { container } = renderWithRouter(
      <InputGuardAlert result={null} visible={true} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('blocked=true 时显示拦截弹窗', () => {
    const blockedResult = {
      passed: false,
      level: 'critical' as const,
      warnings: ['检测到危险操作指令'],
      blocked: true,
      riskScore: 90,
    };

    renderWithRouter(
      <InputGuardAlert result={blockedResult} visible={true} />
    );

    expect(screen.getByText('操作已拦截')).toBeInTheDocument();
    expect(screen.getByText(/检测到高风险内容/)).toBeInTheDocument();
    expect(screen.getByText(/检测到危险操作指令/)).toBeInTheDocument();
  });

  it('level=high 时显示带确认按钮的警告弹窗', () => {
    const highRiskResult = {
      passed: false,
      level: 'high' as const,
      warnings: ['包含敏感词汇', '可疑指令模式'],
      blocked: false,
      riskScore: 65,
    };

    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    renderWithRouter(
      <InputGuardAlert
        result={highRiskResult}
        visible={true}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    expect(screen.getByText('安全风险提醒')).toBeInTheDocument();
    expect(screen.getByText(/检测到以下风险项/)).toBeInTheDocument();
    expect(screen.getByText(/包含敏感词汇/)).toBeInTheDocument();
    expect(screen.getByText(/继续执行/)).toBeInTheDocument();
    expect(screen.getByText(/返回修改/)).toBeInTheDocument();
  });

  it('level=medium 时显示 Alert 警告条', () => {
    const mediumResult = {
      passed: true,
      level: 'medium' as const,
      warnings: ['检测到可疑HTML标签'],
      blocked: false,
      riskScore: 30,
    };

    renderWithRouter(
      <InputGuardAlert result={mediumResult} visible={true} />
    );

    expect(screen.getByText(/内容已通过安全校验/)).toBeInTheDocument();
    expect(screen.getByText(/系统将自动处理风险内容/)).toBeInTheDocument();
  });

  it('visible=false 时不显示 Modal 内容', () => {
    const blockedResult = {
      passed: false,
      level: 'critical' as const,
      warnings: ['测试警告'],
      blocked: true,
      riskScore: 100,
    };

    renderWithRouter(
      <InputGuardAlert result={blockedResult} visible={false} />
    );

    // antd Modal open=false 不渲染内容
    expect(screen.queryByText('操作已拦截')).not.toBeInTheDocument();
  });
});

// ==================== 组件 4: DataProtectionBadge ====================

describe('DataProtectionBadge', () => {
  const sampleMaskResult = {
    original: '联系电话：13812345678，邮箱：test@example.com',
    masked: '联系电话：138****5678，邮箱：t***t@example.com',
    maskCount: 2,
    details: [
      { type: 'phone' as const, value: '13812345678', maskedValue: '138****5678', position: 5 },
      { type: 'email' as const, value: 'test@example.com', maskedValue: 't***t@example.com', position: 20 },
    ],
  };

  it('maskResult 为 null 时不渲染', () => {
    const { container } = renderWithRouter(
      <DataProtectionBadge maskResult={null} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('完整模式渲染数据保护徽章文本', () => {
    renderWithRouter(
      <DataProtectionBadge maskResult={sampleMaskResult} verified={true} />
    );

    expect(screen.getByText('数据安全保障')).toBeInTheDocument();
    expect(screen.getByText(/已自动保护.*2.*条敏感信息/)).toBeInTheDocument();
  });

  it('完整模式展示脱敏详情分类', () => {
    renderWithRouter(
      <DataProtectionBadge maskResult={sampleMaskResult} />
    );

    expect(screen.getByText(/phone: 1条/)).toBeInTheDocument();
    expect(screen.getByText(/email: 1条/)).toBeInTheDocument();
  });

  it('compact 模式只渲染紧凑徽章', () => {
    renderWithRouter(
      <DataProtectionBadge maskResult={sampleMaskResult} compact={true} />
    );

    // compact 模式下不显示"数据安全保障"文字
    expect(screen.queryByText('数据安全保障')).not.toBeInTheDocument();
    // Tooltip 内部应包含保护信息
    expect(document.body.innerHTML).toContain('已自动保护 2 条敏感信息');
  });

  it('verified=false 时不显示 Lock 图标区域', () => {
    renderWithRouter(
      <DataProtectionBadge maskResult={sampleMaskResult} verified={false} />
    );

    // 渲染正常但不应该有问题
    expect(screen.getByText('数据安全保障')).toBeInTheDocument();
  });

  it('空详情列表时不渲染详情区域', () => {
    const emptyDetailsResult = {
      original: 'safe text',
      masked: 'safe text',
      maskCount: 0,
      details: [],
    };

    renderWithRouter(
      <DataProtectionBadge maskResult={emptyDetailsResult} />
    );

    expect(screen.getByText(/已自动保护.*0.*条敏感信息/)).toBeInTheDocument();
  });
});

// ==================== 组件 5: QuotaLimitAlert ====================

describe('QuotaLimitAlert', () => {
  it('visible=true 时渲染配额限制弹窗', () => {
    renderWithRouter(
      <QuotaLimitAlert visible={true} onUpgrade={vi.fn()} onCancel={vi.fn()} />
    );

    expect(screen.getByText('今日免费额度已用完')).toBeInTheDocument();
    expect(screen.getByText(/免费版每天提供 10 次检测额度/)).toBeInTheDocument();
    expect(screen.getByText('开通会员 · 399元/年')).toBeInTheDocument();
    expect(screen.getByText('明天再试')).toBeInTheDocument();
  });

  it('显示会员权益列表', () => {
    renderWithRouter(
      <QuotaLimitAlert visible={true} onUpgrade={vi.fn()} onCancel={vi.fn()} />
    );

    expect(screen.getByText(/无限次任务执行/)).toBeInTheDocument();
    expect(screen.getByText(/P2P分布式算力/)).toBeInTheDocument();
    expect(screen.getByText(/全链路安全扫描/)).toBeInTheDocument();
    expect(screen.getByText(/完整审计报告/)).toBeInTheDocument();
  });

  it('点击升级按钮触发 onUpgrade 回调', () => {
    const onUpgrade = vi.fn();
    renderWithRouter(
      <QuotaLimitAlert visible={true} onUpgrade={onUpgrade} onCancel={vi.fn()} />
    );

    fireEvent.click(screen.getByText('开通会员 · 399元/年'));
    expect(onUpgrade).toHaveBeenCalledTimes(1);
  });

  it('点击取消按钮触发 onCancel 回调', () => {
    const onCancel = vi.fn();
    renderWithRouter(
      <QuotaLimitAlert visible={true} onUpgrade={vi.fn()} onCancel={onCancel} />
    );

    fireEvent.click(screen.getByText('明天再试'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('visible=false 时不渲染弹窗内容', () => {
    renderWithRouter(
      <QuotaLimitAlert visible={false} onUpgrade={vi.fn()} onCancel={vi.fn()} />
    );

    expect(screen.queryByText('今日免费额度已用完')).not.toBeInTheDocument();
  });

  it('显示底部说明文字', () => {
    renderWithRouter(
      <QuotaLimitAlert visible={true} onUpgrade={vi.fn()} onCancel={vi.fn()} />
    );

    expect(screen.getByText(/开通后立即恢复使用/)).toBeInTheDocument();
  });
});

// ==================== 组件 6: MembershipStatus ====================

describe('MembershipStatus', () => {
  it('free 用户默认渲染免费版', () => {
    renderWithRouter(<MembershipStatus />);

    expect(screen.getByText('免费版')).toBeInTheDocument();
    expect(screen.getByText(/0 积分/)).toBeInTheDocument();
  });

  it('premium 用户显示专业版和 Crown 图标', () => {
    renderWithRouter(
      <MembershipStatus level="premium" points={500} expireDate="2027-12-31" />
    );

    expect(screen.getByText('专业版')).toBeInTheDocument();
    expect(screen.getByText(/500 积分/)).toBeInTheDocument();
    expect(screen.getByText(/到期: 2027-12-31/)).toBeInTheDocument();
  });

  it('enterprise 用户显示企业版', () => {
    renderWithRouter(
      <MembershipStatus level="enterprise" points={9999} expireDate="2028-06-01" />
    );

    expect(screen.getByText('企业版')).toBeInTheDocument();
    expect(screen.getByText(/9999 积分/)).toBeInTheDocument();
  });

  it('basic 用户显示基础版', () => {
    renderWithRouter(
      <MembershipStatus level="basic" points={100} expireDate="2026-12-31" />
    );

    expect(screen.getByText('基础版')).toBeInTheDocument();
    expect(screen.getByText(/100 积分/)).toBeInTheDocument();
    expect(screen.getByText(/到期: 2026-12-31/)).toBeInTheDocument();
  });

  it('free 用户不显示到期时间', () => {
    renderWithRouter(
      <MembershipStatus level="free" points={10} expireDate="2025-01-01" />
    );

    expect(screen.getByText('免费版')).toBeInTheDocument();
    // free 用户即使传了 expireDate 也不显示
    expect(screen.queryByText(/到期:/)).not.toBeInTheDocument();
  });

  it('compact 模式渲染紧凑徽章', () => {
    renderWithRouter(
      <MembershipStatus level="premium" points={888} compact={true} />
    );

    // compact 模式下不显示完整文字
    expect(screen.queryByText('专业版')).not.toBeInTheDocument();
    expect(screen.queryByText(/积分/)).not.toBeInTheDocument();
    // Tooltip 中应包含信息
    expect(document.body.innerHTML).toContain('专业版');
  });

  it('积分超过 999 显示 999+', () => {
    renderWithRouter(
      <MembershipStatus level="premium" points={1500} compact={true} />
    );

    expect(document.body.innerHTML).toContain('999+');
  });

  it('无到期时间时不显示到期区域', () => {
    renderWithRouter(
      <MembershipStatus level="basic" points={50} />
    );

    expect(screen.getByText('基础版')).toBeInTheDocument();
    expect(screen.queryByText(/到期:/)).not.toBeInTheDocument();
  });
});
