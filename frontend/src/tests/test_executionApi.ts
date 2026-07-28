import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executionApi } from '@/api/executionApi';
import request from '@/utils/request';

vi.mock('@/utils/request', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

const mockedPost = vi.mocked(request.post);
const mockedGet = vi.mocked(request.get);

describe('executionApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========== 1. 接口类型检查 ==========
  describe('接口类型检查', () => {
    it('所有方法存在且为函数', () => {
      expect(typeof executionApi.submit).toBe('function');
      expect(typeof executionApi.getStatus).toBe('function');
      expect(typeof executionApi.getSummary).toBe('function');
      expect(typeof executionApi.getList).toBe('function');
      expect(typeof executionApi.cancel).toBe('function');
      expect(typeof executionApi.getAuditLogs).toBe('function');
    });
  });

  // ========== 2. submit ==========
  describe('submit', () => {
    it('调用 request.post 并传入正确的 URL 和参数', async () => {
      const mockResponse = {
        task_id: 'task-001',
        status: 'pending',
        stages: [],
        total_duration_ms: 0,
        created_at: '2026-06-05T10:00:00Z',
      };
      mockedPost.mockResolvedValue(mockResponse);

      const payload = {
        workflow_type: 'code_audit' as const,
        input_content: 'const x = 1;',
        security_level: 'high' as const,
        priority: 'normal' as const,
      };

      const result = await executionApi.submit(payload);

      expect(mockedPost).toHaveBeenCalledTimes(1);
      expect(mockedPost).toHaveBeenCalledWith(
        '/api/p2p/v1/pipeline/execute/',
        payload
      );
      expect(result).toEqual(mockResponse);
    });
  });

  // ========== 3. getStatus ==========
  describe('getStatus', () => {
    it('调用 request.get 且 taskId 在 URL 中', async () => {
      const mockResponse = {
        task_id: 'task-abc',
        status: 'running',
        stages: [
          {
            stage: 'L3',
            stage_name: '安全网关',
            status: 'completed' as const,
            duration_ms: 120,
            summary: '检测通过',
            timestamp: '2026-06-05T10:01:00Z',
          },
        ],
        total_duration_ms: 120,
        created_at: '2026-06-05T10:00:00Z',
      };
      mockedGet.mockResolvedValue(mockResponse);

      const result = await executionApi.getStatus('task-abc');

      expect(mockedGet).toHaveBeenCalledTimes(1);
      expect(mockedGet).toHaveBeenCalledWith(
        '/api/p2p/v1/pipeline/status/task-abc/'
      );
      expect(result.task_id).toBe('task-abc');
    });
  });

  // ========== 4. getSummary ==========
  describe('getSummary', () => {
    it('返回摘要统计数据', async () => {
      const mockSummary = {
        pending_count: 12,
        running_count: 5,
        completed_today: 48,
        avg_duration_ms: 3420,
        success_rate: 96.8,
      };
      mockedGet.mockResolvedValue(mockSummary);

      const result = await executionApi.getSummary();

      expect(mockedGet).toHaveBeenCalledWith('/api/p2p/v1/pipeline/summary/');
      expect(result.pending_count).toBe(12);
      expect(result.success_rate).toBe(96.8);
    });
  });

  // ========== 5. getList ==========
  describe('getList', () => {
    it('带 params 的请求正确传递查询参数', async () => {
      const mockListData = { results: [], total: 0 };
      mockedGet.mockResolvedValue(mockListData);

      const params = { status: 'completed', page: 1, page_size: 20 };
      await executionApi.getList(params);

      expect(mockedGet).toHaveBeenCalledWith(
        '/api/p2p/v1/pipeline/tasks/',
        { params }
      );
    });

    it('不带 params 时也能正常调用', async () => {
      mockedGet.mockResolvedValue({ results: [], total: 0 });

      await executionApi.getList();

      expect(mockedGet).toHaveBeenCalledWith(
        '/api/p2p/v1/pipeline/tasks/',
        { params: undefined }
      );
    });
  });

  // ========== 6. cancel ==========
  describe('cancel', () => {
    it('调用 request.post 取消任务', async () => {
      mockedPost.mockResolvedValue({ success: true });

      await executionApi.cancel('task-to-cancel');

      expect(mockedPost).toHaveBeenCalledTimes(1);
      expect(mockedPost).toHaveBeenCalledWith(
        '/api/p2p/v1/pipeline/cancel/task-to-cancel/'
      );
    });
  });

  // ========== 7. getAuditLogs ==========
  describe('getAuditLogs', () => {
    it('获取审计日志', async () => {
      const mockLogs = [
        { time: '11:12:08', level: 'info', message: '日志内容' },
      ];
      mockedGet.mockResolvedValue(mockLogs);

      const result = await executionApi.getAuditLogs('task-log-001');

      expect(mockedGet).toHaveBeenCalledWith(
        '/api/p2p/v1/pipeline/audit/task-log-001/'
      );
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ========== 8. 错误处理 ==========
  describe('错误处理', () => {
    it('request 抛出异常时 submit 正确传播错误', async () => {
      const error = new Error('Network Error');
      mockedPost.mockRejectedValue(error);

      await expect(executionApi.submit({
        workflow_type: 'code_audit',
        input_content: 'test',
      })).rejects.toThrow('Network Error');
    });

    it('request 抛出异常时 getStatus 正确传播错误', async () => {
      const error = new Error('Server Error 500');
      mockedGet.mockRejectedValue(error);

      await expect(executionApi.getStatus('bad-task')).rejects.toThrow(
        'Server Error 500'
      );
    });

    it('request 抛出异常时 getSummary 正确传播错误', async () => {
      mockedGet.mockRejectedValue(new Error('Gateway Timeout'));

      await expect(executionApi.getSummary()).rejects.toThrow(
        'Gateway Timeout'
      );
    });

    it('request 抛出异常时 cancel 正确传播错误', async () => {
      mockedPost.mockRejectedValue(new Error('Cancel Failed'));

      await expect(executionApi.cancel('x')).rejects.toThrow('Cancel Failed');
    });
  });
});
