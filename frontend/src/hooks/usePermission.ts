import { useState, useEffect } from 'react';
import { rbacApi, MenuItem } from '@/api/rbacApi';

interface PermissionState {
  menus: MenuItem[];
  permissions: string[];
  loaded: boolean;
}

let globalPermState: PermissionState = {
  menus: [],
  permissions: [],
  loaded: false,
};

let fetchPromise: Promise<void> | null = null;

export function usePermission() {
  const [state, setState] = useState<PermissionState>(globalPermState);

  useEffect(() => {
    if (globalPermState.loaded) {
      setState({ ...globalPermState });
      return;
    }

    if (!fetchPromise) {
      fetchPromise = loadPermissions().then((data) => {
        globalPermState = { ...data, loaded: true };
        setState(globalPermState);
        fetchPromise = null;
      }).catch(() => {
        fetchPromise = null;
      });
    }

    return () => {};
  }, []);

  const hasPermission = (permCode: string): boolean => {
    return state.permissions.includes(permCode);
  };

  const hasAnyPermission = (permCodes: string[]): boolean => {
    return permCodes.some(code => state.permissions.includes(code));
  };

  const hasAllPermissions = (permCodes: string[]): boolean => {
    return permCodes.every(code => state.permissions.includes(code));
  };

  return {
    menus: state.menus,
    permissions: state.permissions,
    loaded: state.loaded,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  };
}

async function loadPermissions(): Promise<Omit<PermissionState, 'loaded'>> {
  try {
    const [menuRes] = await Promise.all([
      rbacApi.getUserMenus(),
    ]);
    
    const menus = Array.isArray(menuRes) ? menuRes : (menuRes as any)?.results || [];
    
    const perms = extractPermCodes(menus);
    
    return { menus, permissions: perms };
  } catch {
    return { menus: [], permissions: [] };
  }
}

function extractPermCodes(menus: MenuItem[], result: string[] = []): string[] {
  for (const menu of menus) {
    if (menu.code && !result.includes(menu.code)) {
      result.push(menu.code);
    }
    if (menu.children && menu.children.length > 0) {
      extractPermCodes(menu.children, result);
    }
  }
  return result;
}

export function refreshPermissionCache(): void {
  globalPermState = { menus: [], permissions: [], loaded: false };
}
