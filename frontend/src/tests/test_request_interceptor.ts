import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ===== Mock axios =====
const mockRequestUse = vi.fn((config: any) => config);
const mockResponseSuccessUse = vi.fn((response: any) => response);
const mockResponseErrorUse = vi.fn((error: any) => Promise.reject(error));

vi.mock('axios', () => {
  const mockInstance: Record<string, any> = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: mockRequestUse },
      response: { use: mockResponseSuccessUse },
    },
  };
  return {
    default: vi.fn(() => mockInstance),
    create: vi.fn(() => mockInstance),
  };
});

import request from '@/utils/request';
import axios from 'axios';
const mockedCreate = vi.mocked(axios.create);

describe('request.ts - axios 实例与拦截器', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  // ========== axios 实例配置 (4个) ==========

  it('1. axios.create 被调用且 baseURL="/api"', () => {
    expect(mockedCreate).toHaveBeenCalledTimes(1);
    const config = mockedCreate.mock.calls[0][0] as Record<string, any>;
    expect(config.baseURL).toBe('/api');
  });

  it('2. timeout=10000', () => {
    const config = mockedCreate.mock.calls[0][0] as Record<string, any>;
    expect(config.timeout).toBe(10000);
  });

  it('3. 默认 Content-Type 为 application/json', () => {
    const config = mockedCreate.mock.calls[0][0] as Record<string, any>;
    expect(config.headers['Content-Type']).toBe('application/json');
  });

  it('4. request 是一个对象（含 get/post/put/delete/interceptors）', () => {
    expect(request).toBeDefined();
    expect(typeof (request as any).get).toBe('function');
    expect(typeof (request as any).post).toBe('function');
    expect(typeof (request as any).put).toBe('function');
    expect(typeof (request as any).delete).toBe('function');
    expect(request.interceptors).toBeDefined();
    expect(request.interceptors.request).toBeDefined();
    expect(request.interceptors.response).toBeDefined();
  });

  // ========== 请求拦截器 (3个) ==========

  it('5. interceptors.request.use 被注册（调用了一次）', () => {
    expect(mockRequestUse).toHaveBeenCalledTimes(1);
  });

  it('6. 有 token 时请求头应包含 Bearer', () => {
    localStorage.setItem('token', 'my-test-token-xyz');

    const inputConfig = { headers: {} };
    const result = mockRequestUse.mock.calls[0][0](inputConfig);

    expect(result.headers.Authorization).toBe('Bearer my-test-token-xyz');
  });

  it('7. 无 token 时不应有 Authorization header', () => {
    localStorage.removeItem('token');

    const inputConfig = { headers: {} };
    const result = mockRequestUse.mock.calls[0][0](inputConfig);

    expect(result.headers.Authorization).toBeUndefined();
  });

  // ========== 响应拦截器 (3个) ==========

  it('8. interceptors.response.use 被注册（成功+失败各一次）', () => {
    expect(mockResponseSuccessUse).toHaveBeenCalledTimes(1);
    expect(mockResponseErrorUse).toHaveBeenCalledTimes(1);
  });

  it('9. 成功响应返回 response.data（拦截器转换）', () => {
    const mockResponse = { data: { id: 1, name: 'test' }, status: 200 };
    const result = mockResponseSuccessUse.mock.calls[0][0](mockResponse);

    expect(result).toEqual({ id: 1, name: 'test' });
  });

  it('10. 401 错误时清除 token 并跳转 /login', async () => {
    const originalLocation = window.location;
    const mockAssign = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, pathname: '/dashboard', href: '', assign: mockAssign },
      writable: true,
    });

    localStorage.setItem('token', 'some-token');
    localStorage.setItem('user', '{"id":1}');

    const error401: any = new Error('Unauthorized');
    error401.response = { status: 401 };

    await mockResponseErrorUse.mock.calls[0][1](error401);

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();

    Object.defineProperty(window, 'location', { value: originalLocation, writable: true });
  });
});
