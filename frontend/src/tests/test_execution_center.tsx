import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ExecutionCenter from '@/pages/executioncenter/index';

// Mock antd message
vi.mock('antd', async (importOriginal) => {
  const antd = await importOriginal<typeof import('antd')>();
  return {
    ...antd,
    message: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
    },
  };
});

// Mock executionApi
const mockSubmit = vi.fn().mockResolvedValue({
  task_id: 'test-123',
  status: 'pending',
  stages: [],
  total_duration_ms: 0,
  created_at: '',
});

const mockGetSummary = vi.fn().mockResolvedValue({
  pending_count: 12,
  running_count: 5,
  completed_today: 48,
  avg_duration_ms: 3420,
  success_rate: 96.8,
});

vi.mock('@/api/executionApi', () => ({
  executionApi: {
    submit: (...args: unknown[]) => mockSubmit(...args),
    getSummary: (...args: unknown[]) => mockGetSummary(...args),
    getStatus: vi.fn(),
    getList: vi.fn(),
    cancel: vi.fn(),
    getAuditLogs: vi.fn(),
  },
}));

// Mock CSS module
vi.mock('./index.module.css', () => ({}));

const { message } = await import('antd');

describe('ExecutionCenter 组件', () => {
  // ========== 1. 渲染测试 ==========
  it('组件正常渲染不报错', () => {
    render(<ExecutionCenter />);
    expect(screen.getByText('Agent 执行中心')).toBeInTheDocument();
  });

  // ========== 2. 标题显示 ==========
  it('包含 "Agent 执行中心" 标题', () => {
    render(<ExecutionCenter />);
    expect(screen.getByText('Agent 执行中心')).toBeInTheDocument();
  });

  // ========== 3. 统计卡片 ==========
  it('显示 5 个统计项', () => {
    render(<ExecutionCenter />);
    expect(screen.getByText('待处理任务')).toBeInTheDocument();
    expect(screen.getByText('执行中')).toBeInTheDocument();
    expect(screen.getByText('今日完成')).toBeInTheDocument();
    expect(screen.getByText('平均耗时')).toBeInTheDocument();
    expect(screen.getByText('成功率')).toBeInTheDocument();
  });

  // ========== 4. 流水线阶段 ==========
  it('显示 L3-L7 共 6 个阶段', () => {
    render(<ExecutionCenter />);
    expect(screen.getByText('安全网关')).toBeInTheDocument();   // L3
    expect(screen.getByText('编排引擎')).toBeInTheDocument();     // L2
    expect(screen.getByText('成本路由')).toBeInTheDocument();     // L4
    expect(screen.getByText('P2P调度')).toBeInTheDocument();      // L5
    expect(screen.getByText('沙箱执行')).toBeInTheDocument();     // L6
    expect(screen.getByText('审计存证')).toBeInTheDocument();     // L7
  });

  // ========== 5. 提交表单 ==========
  it('提交表单包含工作流模板下拉框、安全等级、优先级、文本域、提交按钮', () => {
    render(<ExecutionCenter />);
    expect(screen.getByText('工作流模板')).toBeInTheDocument();
    expect(screen.getByText('安全等级')).toBeInTheDocument();
    expect(screen.getByText('优先级')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/在此输入代码或文本内容/)).toBeInTheDocument();
    expect(screen.getByText('提交执行')).toBeInTheDocument();
  });

  // ========== 6. 历史表格 ==========
  it('显示任务列表', () => {
    render(<ExecutionCenter />);
    // 检查至少一个 task_id 出现在文档中
    expect(screen.getByText('TK-20260604-001')).toBeInTheDocument();
    expect(screen.getAllByText('详情').length).toBeGreaterThan(0);
  });

  // ========== 7. 审计日志 ==========
  it('可折叠面板显示日志条数', () => {
    render(<ExecutionCenter />);
    // MOCK_LOGS 有 10 条，Collapse label 应包含条数
    expect(screen.getByText(/10 条/)).toBeInTheDocument();
  });

  // ========== 8. formatDuration 函数 ==========
  describe('formatDuration 工具函数', () => {
    // 由于 formatDuration 是模块内部函数，我们通过渲染结果间接验证其行为
    // 同时也可以直接导入并测试（如果导出的话），这里通过组件渲染验证

    it('ms=0 时显示 "-"', () => {
      render(<ExecutionCenter />);
      // pending 阶段 duration_ms=0 应显示 '-'
      const dashes = screen.getAllByText('-');
      expect(dashes.length).toBeGreaterThan(0);
    });

    it('ms < 1000 时显示 "{ms}ms"', () => {
      render(<ExecutionCenter />);
      // L3 completed duration_ms=120 → "120ms"
      expect(screen.getByText('120ms')).toBeInTheDocument();
      // L2 completed duration_ms=340 → "340ms"
      expect(screen.getByText('340ms')).toBeInTheDocument();
    });

    it('ms >= 1000 时显示 "{sec}s" (保留一位小数)', () => {
      render(<ExecutionCenter />);
      // L4 running duration_ms=890 → "890ms" (< 1000)
      // 但平均耗时 3420ms → "3.4s" (>= 1000)
      expect(screen.getByText('3.4s')).toBeInTheDocument();
    });
  });

  // ========== 9. getStatusIconKey 函数 ==========
  describe('getStatusIconKey 状态映射', () => {
    it('各状态在表格中正确显示', () => {
      render(<ExecutionCenter />);
      // 表格中应包含各种状态文本
      expect(screen.getByText('completed')).toBeInTheDocument();
      expect(screen.getByText('running')).toBeInTheDocument();
      expect(screen.getByText('pending')).toBeInTheDocument();
      expect(screen.getByText('error')).toBeInTheDocument();
      expect(screen.getByText('warning')).toBeInTheDocument();
    });
  });

  // ========== 10. 状态筛选 ==========
  it('点击筛选按钮改变过滤状态', () => {
    render(<ExecutionCenter />);

    // 默认显示全部任务 (7 条)
    const allBtn = screen.getByText('全部');
    fireEvent.click(allBtn);

    // 点击"已完成"筛选
    const completedBtn = screen.getByText('已完成');
    fireEvent.click(completedBtn);

    // 筛选后应只显示 completed 状态的任务 (TK-20260604-001, TK-20260604-004, TK-202603-018 = 3条)
    expect(screen.getByText('TK-20260604-001')).toBeInTheDocument();
    expect(screen.queryByText('TK-20260604-002')).not.toBeInTheDocument();
    expect(screen.queryByText('TK-20260604-003')).not.toBeInTheDocument();
    expect(screen.getByText('TK-20260604-004')).toBeInTheDocument();
    expect(screen.queryByText('TK-20260604-005')).not.toBeInTheDocument();
    expect(screen.getByText('TK-202603-018')).toBeInTheDocument();
    expect(screen.queryByText('TK-202603-017')).not.toBeInTheDocument();
  });

  // ========== 11. 详情弹窗 ==========
  it('点击"详情"按钮打开 Modal', () => {
    render(<ExecutionCenter />);

    // 初始状态 Modal 不显示
    expect(screen.queryByText('任务详情')).not.toBeInTheDocument();

    // 点击第一条记录的"详情"按钮
    const detailButtons = screen.getAllByText('详情');
    fireEvent.click(detailButtons[0]);

    // Modal 打开，显示任务详情
    expect(screen.getByText('任务详情')).toBeInTheDocument();
    expect(screen.getByText('TK-20260604-001')).toBeInTheDocument();
  });

  // ========== 12. 空输入提交 ==========
  it('不填内容点提交应提示警告', async () => {
    render(<ExecutionCenter />);

    const submitBtn = screen.getByText('提交执行');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(message.warning).toHaveBeenCalledWith('请输入任务内容');
    });
  });
});
