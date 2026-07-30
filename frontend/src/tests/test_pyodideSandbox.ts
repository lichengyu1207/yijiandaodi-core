import { describe, it, expect, vi } from 'vitest';

// Mock pyodide 动态导入（pyodideSandbox 内部通过 import('pyodide') 加载）
vi.mock('pyodide', () => ({
  default: { loadPyodide: vi.fn() },
}));

import { getPyodideStatus, disposePyodide } from '@/utils/pyodideSandbox';

describe('pyodideSandbox', () => {
  describe('getPyodideStatus', () => {
    it('初始状态: available=false, loading=false, loaded=false, version=null, sizeMB=null', () => {
      const status = getPyodideStatus();
      expect(status.available).toBe(false);
      expect(status.loading).toBe(false);
      expect(status.loaded).toBe(false);
      expect(status.version).toBeNull();
      expect(status.sizeMB).toBeNull();
    });

    it('返回对象包含所有必需字段', () => {
      const status = getPyodideStatus();
      expect(status).toHaveProperty('available');
      expect(status).toHaveProperty('loading');
      expect(status).toHaveProperty('loaded');
      expect(status).toHaveProperty('version');
      expect(status).toHaveProperty('sizeMB');
      expect(Object.keys(status)).toEqual(['available', 'loading', 'loaded', 'version', 'sizeMB']);
    });

    it('多次调用初始状态一致', () => {
      const s1 = getPyodideStatus();
      const s2 = getPyodideStatus();
      expect(s1).toEqual(s2);
    });

    it('available 和 loaded 在未初始化时均为 false', () => {
      const status = getPyodideStatus();
      expect(status.available).toBe(false);
      expect(status.loaded).toBe(false);
    });

    it('version 在未初始化时为 null', () => {
      expect(getPyodideStatus().version).toBeNull();
    });
  });

  describe('disposePyodide', () => {
    it('未初始化时调用 dispose 不报错', () => {
      expect(() => disposePyodide()).not.toThrow();
    });

    it('返回 undefined', () => {
      const result = disposePyodide();
      expect(result).toBeUndefined();
    });
  });
});
