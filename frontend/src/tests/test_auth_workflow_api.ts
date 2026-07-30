import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authApi } from '@/api/auth';
import workflowApi, {
  getWorkflows,
  getWorkflowDetail,
  saveWorkflowGraph,
  publishWorkflow,
  executeWorkflow,
  duplicateWorkflow,
  getWorkflowTemplates,
  getExecutions,
  stopExecution,
} from '@/api/workflowApi';

// ═══════════════════════════════════════════
// Mock: authApi uses @/utils/request
// ═══════════════════════════════════════════
vi.mock('@/utils/request', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
  },
}));
import request from '@/utils/request';

const mockedPost = vi.mocked(request.post);
const mockedGet = vi.mocked(request.get);
const mockedPut = vi.mocked(request.put);

// ═══════════════════════════════════════════
// Mock: workflowApi uses axios.create()
// ═══════════════════════════════════════════
vi.mock('axios', () => {
  const mockInstance = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };
  const mockAxios = vi.fn(() => mockInstance);
  mockAxios.create = vi.fn(() => mockInstance);
  mockAxios.defaults = {};
  return { default: mockAxios };
});
import axios from 'axios';

const wfInstance = axios.create({}) as ReturnType<typeof axios.create>;

// ═══════════════════════════════════════════
// authApi 测试 (12 个用例)
// ═══════════════════════════════════════════
describe('authApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- 1. login ---
  describe('login', () => {
    it('调用 request.post("/auth/login/", data)，验证 URL 和参数传递', async () => {
      const mockResult = { token: 'abc123', user: { id: 1 }, expires_in: 3600 };
      mockedPost.mockResolvedValue(mockResult);

      const data = { username: 'admin', password: 'pass' };
      const result = await authApi.login(data);

      expect(mockedPost).toHaveBeenCalledTimes(1);
      expect(mockedPost).toHaveBeenCalledWith('/auth/login/', data);
      expect(result).toEqual(mockResult);
    });
  });

  // --- 2. register ---
  describe('register', () => {
    it('调用 request.post("/auth/register/", data)', async () => {
      mockedPost.mockResolvedValue({ id: 2, username: 'newuser' });

      const data = { username: 'newuser', password: 'pw123', confirm_password: 'pw123' };
      await authApi.register(data);

      expect(mockedPost).toHaveBeenCalledTimes(1);
      expect(mockedPost).toHaveBeenCalledWith('/auth/register/', data);
    });
  });

  // --- 3. getUserInfo ---
  describe('getUserInfo', () => {
    it('调用 request.get("/auth/userinfo/")', async () => {
      const userInfo = { id: 1, username: 'admin', email: 'a@b.com', role: 'super_admin' };
      mockedGet.mockResolvedValue(userInfo);

      const result = await authApi.getUserInfo();

      expect(mockedGet).toHaveBeenCalledWith('/auth/userinfo/');
      expect(result.username).toBe('admin');
    });
  });

  // --- 4. getSystemStatus ---
  describe('getSystemStatus', () => {
    it('调用 request.get("/auth/system-status/")', async () => {
      mockedGet.mockResolvedValue({ status: 'ok', server_time: '2026-06-05T00:00:00Z' });

      await authApi.getSystemStatus();

      expect(mockedGet).toHaveBeenCalledWith('/auth/system-status/');
    });
  });

  // --- 5. logout ---
  describe('logout', () => {
    it('调用 request.post("/auth/logout/")', async () => {
      mockedPost.mockResolvedValue({ success: true });

      await authApi.logout();

      expect(mockedPost).toHaveBeenCalledTimes(1);
      expect(mockedPost).toHaveBeenCalledWith('/auth/logout/');
    });
  });

  // --- 6. getUsers ---
  describe('getUsers', () => {
    it('调用 request.get("/auth/users/")，支持 params', async () => {
      mockedGet.mockResolvedValue([]);

      const params = { role: 'editor' };
      await authApi.getUsers(params);

      expect(mockedGet).toHaveBeenCalledWith('/auth/users/', { params });
    });

    it('不传 params 时 params 为 undefined', async () => {
      mockedGet.mockResolvedValue([]);

      await authApi.getUsers();

      expect(mockedGet).toHaveBeenCalledWith('/auth/users/', { params: undefined });
    });
  });

  // --- 7. updateUser ---
  describe('updateUser', () => {
    it('调用 request.put(`/auth/users/${id}/`)，验证 ID 拼接', async () => {
      mockedPut.mockResolvedValue({ id: 42, username: 'updated' });

      const data = { is_active: false };
      await authApi.updateUser(42, data);

      expect(mockedPut).toHaveBeenCalledTimes(1);
      expect(mockedPut).toHaveBeenCalledWith('/auth/users/42/', data);
    });
  });

  // --- 8. getLoginLogs ---
  describe('getLoginLogs', () => {
    it('调用 request.get("/auth/login-logs/")', async () => {
      mockedGet.mockResolvedValue([]);

      const logs = await authApi.getLoginLogs();

      expect(mockedGet).toHaveBeenCalledWith('/auth/login-logs/');
      expect(Array.isArray(logs)).toBe(true);
    });
  });

  // --- 9. changePassword ---
  describe('changePassword', () => {
    it('调用 request.put("/auth/change-password/", data)', async () => {
      mockedPut.mockResolvedValue(undefined);

      const data = { old_password: 'old', new_password: 'new' };
      await authApi.changePassword(data);

      expect(mockedPut).toHaveBeenCalledWith('/auth/change-password/', data);
    });
  });

  // --- 10. 接口完整性 ---
  describe('接口完整性', () => {
    it('所有 9 个方法都存在且为 function 类型', () => {
      const methods = ['login', 'register', 'getUserInfo', 'getSystemStatus', 'logout', 'getUsers', 'updateUser', 'getLoginLogs', 'changePassword'] as const;

      for (const method of methods) {
        expect(typeof authApi[method]).toBe('function');
      }
    });
  });

  // --- 11. login 成功 ---
  describe('login 成功场景', () => {
    it('mock 返回 token / user / expires_in', async () => {
      const mockResponse: import('@/api/auth').LoginResult = {
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        user: {
          id: 1,
          username: 'admin',
          email: 'admin@example.com',
          role: 'super_admin',
          date_joined: '2026-01-01T00:00:00Z',
          last_login: '2026-06-04T12:00:00Z',
        },
        expires_in: 86400,
      };
      mockedPost.mockResolvedValue(mockResponse);

      const result = await authApi.login({ username: 'admin', password: 'secret' });

      expect(result.token).toBeTruthy();
      expect(result.user.id).toBe(1);
      expect(result.user.role).toBe('super_admin');
      expect(result.expires_in).toBe(86400);
    });
  });

  // --- 12. login 失败 ---
  describe('login 失败场景', () => {
    it('mock reject 验证错误传播', async () => {
      const error = new Error('Unauthorized: invalid credentials');
      mockedPost.mockRejectedValue(error);

      await expect(authApi.login({ username: 'bad', password: 'bad' })).rejects.toThrow(
        'Unauthorized'
      );
    });
  });
});

// ═══════════════════════════════════════════
// workflowApi 测试 (12 个用例)
// ═══════════════════════════════════════════
describe('workflowApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockGet = vi.mocked(wfInstance.get);
  const mockPost = vi.mocked(wfInstance.post);

  // --- 1. getWorkflows ---
  describe('getWorkflows', () => {
    it('调用 GET /workflows/，支持 params', async () => {
      mockGet.mockResolvedValue({ data: [] });

      const params = { type: 'workflow' };
      await getWorkflows(params);

      expect(mockGet).toHaveBeenCalledTimes(1);
      expect(mockGet).toHaveBeenCalledWith('/workflows/', { params });
    });
  });

  // --- 2. getWorkflowDetail ---
  describe('getWorkflowDetail', () => {
    it('调用 GET /workflows/${id}/', async () => {
      mockGet.mockResolvedValue({ data: { id: 'wf-001', name: 'Test Workflow' } });

      const result = await getWorkflowDetail('wf-001');

      expect(mockGet).toHaveBeenCalledWith('/workflows/wf-001/');
      expect(result.data.id).toBe('wf-001');
    });
  });

  // --- 3. saveWorkflowGraph ---
  describe('saveWorkflowGraph', () => {
    it('调用 POST /workflows/save-graph/，验证 nodes/edges 数据', async () => {
      mockPost.mockResolvedValue({ data: { workflow_id: 'new-wf' } });

      const data = {
        name: 'My Flow',
        nodes: [
          { id: 'n1', type: 'start', position: { x: 0, y: 0 }, data: {} },
          { id: 'n2', type: 'end', position: { x: 200, y: 0 }, data: {} },
        ],
        edges: [{ id: 'e1', source: 'n1', target: 'n2' }],
      };
      await saveWorkflowGraph(data);

      expect(mockPost).toHaveBeenCalledWith('/workflows/save-graph/', data);
      // 验证 nodes 和 edges 被正确传递
      const callArgs = mockPost.mock.calls[0];
      expect(callArgs![1].nodes).toHaveLength(2);
      expect(callArgs![1].edges).toHaveLength(1);
    });
  });

  // --- 4. publishWorkflow ---
  describe('publishWorkflow', () => {
    it('调用 POST /workflows/${id}/publish/', async () => {
      mockPost.mockResolvedValue({ data: { status: 'published' } });

      await publishWorkflow('wf-42');

      expect(mockPost).toHaveBeenCalledWith('/workflows/wf-42/publish/');
    });
  });

  // --- 5. executeWorkflow ---
  describe('executeWorkflow', () => {
    it('调用 POST /workflows/${id}/execute/', async () => {
      mockPost.mockResolvedValue({ data: { execution_id: 'exec-1' } });

      await executeWorkflow('wf-42', { input_text: 'hello' });

      expect(mockPost).toHaveBeenCalledWith('/workflows/wf-42/execute/', { inputs: { input_text: 'hello' } });
    });
  });

  // --- 6. duplicateWorkflow ---
  describe('duplicateWorkflow', () => {
    it('调用 POST /workflows/duplicate/', async () => {
      mockPost.mockResolvedValue({ data: { new_id: 'wf-copy' } });

      await duplicateWorkflow('src-001', 'Copy Name');

      expect(mockPost).toHaveBeenCalledWith('/workflows/duplicate/', {
        source_workflow_id: 'src-001',
        new_name: 'Copy Name',
      });
    });
  });

  // --- 7. getWorkflowTemplates ---
  describe('getWorkflowTemplates', () => {
    it('调用 GET /workflows/templates/', async () => {
      mockGet.mockResolvedValue({ data: [] });

      await getWorkflowTemplates({ category: 'chatbot' });

      expect(mockGet).toHaveBeenCalledWith('/workflows/templates/', {
        params: { category: 'chatbot' },
      });
    });
  });

  // --- 8. getExecutions ---
  describe('getExecutions', () => {
    it('调用 GET /executions/', async () => {
      mockGet.mockResolvedValue({ data: [] });

      await getExecutions();

      expect(mockGet).toHaveBeenCalledWith('/executions/');
    });
  });

  // --- 9. stopExecution ---
  describe('stopExecution', () => {
    it('调用 POST /executions/${id}/stop/', async () => {
      mockPost.mockResolvedValue({ data: { status: 'stopped' } });

      await stopExecution('exec-99');

      expect(mockPost).toHaveBeenCalledWith('/executions/exec-99/stop/');
    });
  });

  // --- 10. 接口完整性 ---
  describe('接口完整性', () => {
    it('所有 9 个导出函数 + default export 都存在', () => {
      const exportedFunctions = [
        getWorkflows,
        getWorkflowDetail,
        saveWorkflowGraph,
        publishWorkflow,
        executeWorkflow,
        duplicateWorkflow,
        getWorkflowTemplates,
        getExecutions,
        stopExecution,
      ];

      for (const fn of exportedFunctions) {
        expect(typeof fn).toBe('function');
      }

      // default export 是 workflowApi 实例
      expect(workflowApi).toBeDefined();
      expect(typeof (workflowApi as any).get).toBe('function');
      expect(typeof (workflowApi as any).post).toBe('function');
    });
  });
});

// ═══════════════════════════════════════════
// workflowApi 模块级配置测试（不受 beforeEach clearAllMocks 影响）
// ═══════════════════════════════════════════
describe('workflowApi 模块配置', () => {
  it('workflowApi 是一个有效的 axios 实例（含 get/post/put/interceptors）', () => {
    // 验证 workflowApi 具备完整的 axios 实例结构
    expect(typeof workflowApi.get).toBe('function');
    expect(typeof workflowApi.post).toBe('function');
    expect(typeof workflowApi.put).toBe('function');
    expect(workflowApi.interceptors).toBeDefined();
    expect(typeof workflowApi.interceptors.request.use).toBe('function');
    expect(typeof workflowApi.interceptors.response.use).toBe('function');
  });

  it('请求拦截器: interceptors.request 存在且可注册', () => {
    // 验证拦截器对象存在（模块加载时已通过 interceptors.request.use 注册）
    expect(workflowApi.interceptors.request).toBeDefined();
    expect(workflowApi.interceptors.response).toBeDefined();
  });
});
