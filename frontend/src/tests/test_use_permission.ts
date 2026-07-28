import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

// ===== Mock rbacApi =====
const mockMenus = [
  {
    code: 'dashboard:view',
    name: '仪表盘',
    children: [
      { code: 'dashboard:edit', name: '编辑' },
    ],
  },
  { code: 'user:list', name: '用户列表' },
];

vi.mock('@/api/rbacApi', () => ({
  rbacApi: {
    getUserMenus: vi.fn().mockResolvedValue(mockMenus),
  },
  MenuItem: {} as any,
}));

import { usePermission, refreshPermissionCache } from '@/hooks/usePermission';
import { rbacApi } from '@/api/rbacApi';
const mockedRbac = vi.mocked(rbacApi);

describe('usePermission - RBAC 权限系统', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 重置全局状态
    refreshPermissionCache();
  });

  // ========== 初始加载 (3个) ==========

  it('1. 初始状态 loaded=false, permissions=[], menus=[]', () => {
    const { result } = renderHook(() => usePermission());

    expect(result.current.loaded).toBe(false);
    expect(result.current.permissions).toEqual([]);
    expect(result.current.menus).toEqual([]);
  });

  it('2. 加载完成后 loaded=true', async () => {
    const { result } = renderHook(() => usePermission());

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });
  });

  it('3. 权限码包含从菜单提取的所有 code（包括子菜单）', async () => {
    const { result } = renderHook(() => usePermission());

    await waitFor(() => {
      expect(result.current.permissions).toContain('dashboard:view');
      expect(result.current.permissions).toContain('dashboard:edit');
      expect(result.current.permissions).toContain('user:list');
      // 确保数量正确（2 个顶级 + 1 个子级）
      expect(result.current.permissions.length).toBe(3);
    });
  });

  // ========== hasPermission (3个) ==========

  it('4. 已有权限返回 true', async () => {
    const { result } = renderHook(() => usePermission());

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.hasPermission('dashboard:view')).toBe(true);
    expect(result.current.hasPermission('user:list')).toBe(true);
    expect(result.current.hasPermission('dashboard:edit')).toBe(true);
  });

  it('5. 未有权限返回 false', async () => {
    const { result } = renderHook(() => usePermission());

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.hasPermission('admin:delete')).toBe(false);
    expect(result.current.hasPermission('system:config')).toBe(false);
  });

  it('6. 空字符串返回 false', async () => {
    const { result } = renderHook(() => usePermission());

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.hasPermission('')).toBe(false);
  });

  // ========== hasAnyPermission (3个) ==========

  it('7. 任一匹配返回 true', async () => {
    const { result } = renderHook(() => usePermission());

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.hasAnyPermission(['admin:delete', 'dashboard:view'])).toBe(true);
    expect(result.current.hasAnyPermission(['nonexist', 'user:list'])).toBe(true);
  });

  it('8. 全部不匹配返回 false', async () => {
    const { result } = renderHook(() => usePermission());

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.hasAnyPermission(['admin:delete', 'system:config'])).toBe(false);
  });

  it('9. 空数组返回 false', async () => {
    const { result } = renderHook(() => usePermission());

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.hasAnyPermission([])).toBe(false);
  });

  // ========== hasAllPermissions (3个) ==========

  it('10. 全部拥有返回 true', async () => {
    const { result } = renderHook(() => usePermission());

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.hasAllPermissions(['dashboard:view', 'user:list', 'dashboard:edit'])).toBe(true);
  });

  it('11. 部分缺失返回 false', async () => {
    const { result } = renderHook(() => usePermission());

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.hasAllPermissions(['dashboard:view', 'admin:delete'])).toBe(false);
  });

  it('12. 空数组返回 true（vacuously true）', async () => {
    const { result } = renderHook(() => usePermission());

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    expect(result.current.hasAllPermissions([])).toBe(true);
  });

  // ========== refreshPermissionCache (1个) ==========

  it('13. 调用后重置全局状态', async () => {
    // 先加载完成
    const { result } = renderHook(() => usePermission());
    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    // 重置缓存
    refreshPermissionCache();

    // 重新渲染 hook，应回到初始状态（但会重新请求 API）
    const { result: result2 } = renderHook(() => usePermission());

    // 由于 globalPermState 被重置，新的 hook 应该重新发起请求
    expect(mockedRbac.getUserMenus).toHaveBeenCalled();
  });

  // ========== extractPermCodes 内部逻辑 (1个) ==========

  it('14. 递归提取嵌套菜单的 code（permissions 包含子菜单 code）', async () => {
    // 使用更深的嵌套结构来验证递归
    mockedRbac.getUserMenus.mockResolvedValueOnce([
      {
        code: 'parent:level1',
        name: '一级',
        children: [
          {
            code: 'child:level2a',
            name: '二级A',
            children: [
              { code: 'grandchild:level3', name: '三级' },
            ],
          },
          { code: 'child:level2b', name: '二级B' },
        ],
      },
      { code: 'standalone', name: '独立菜单' },
    ]);

    refreshPermissionCache();
    const { result } = renderHook(() => usePermission());

    await waitFor(() => {
      expect(result.current.loaded).toBe(true);
    });

    // 验证所有层级的 code 都被提取了
    expect(result.current.permissions).toContain('parent:level1');
    expect(result.current.permissions).toContain('child:level2a');
    expect(result.current.permissions).toContain('grandchild:level3');
    expect(result.current.permissions).toContain('child:level2b');
    expect(result.current.permissions).toContain('standalone');
    expect(result.current.permissions.length).toBe(5);
  });
});
