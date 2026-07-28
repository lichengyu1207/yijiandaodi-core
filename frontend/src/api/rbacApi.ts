import request from '@/utils/request';

// ===== 类型定义 =====

export interface RoleItem {
  id: number;
  name: string;
  code: string;
  description: string;
  data_scope: 'all' | 'self' | 'role';
  status: boolean;
  sort_order: number;
  permissions?: number[];
  permission_list?: PermItem[];
  user_count?: number;
  created_at: string;
  updated_at: string;
}

export interface RoleCreateData {
  name: string;
  code: string;
  description?: string;
  data_scope?: 'all' | 'self' | 'role';
  status?: boolean;
  sort_order?: number;
  permission_ids?: number[];
}

export interface PermItem {
  id: number;
  name: string;
  code: string;
  perm_type: 'menu' | 'button' | 'api';
  parent_id: number | null;
  path: string;
  method: string;
  component: string;
  icon: string;
  sort_order: number;
  visible: boolean;
  status: boolean;
  children?: PermItem[];
  created_at: string;
}

export interface PermCreateData {
  name: string;
  code: string;
  perm_type?: 'menu' | 'button' | 'api';
  parent_id?: number | null;
  path?: string;
  method?: string;
  component?: string;
  icon?: string;
  sort_order?: number;
  visible?: boolean;
}

export interface MenuItem {
  id: number;
  name: string;
  code: string;
  menu_type: 'directory' | 'menu' | 'button';
  parent_id: number | null;
  path: string;
  component: string;
  icon: string;
  permission_id: number | null;
  sort_order: number;
  visible: boolean;
  status: boolean;
  children?: MenuItem[];
  created_at: string;
  updated_at: string;
}

export interface MenuCreateData {
  name: string;
  code: string;
  menu_type?: 'directory' | 'menu' | 'button';
  parent_id?: number | null;
  path?: string;
  component?: string;
  icon?: string;
  permission_id?: number | null;
  sort_order?: number;
  visible?: boolean;
}

export interface UserManageItem {
  id: number;
  username: string;
  email: string;
  avatar?: string;
  is_active: boolean;
  is_staff: boolean;
  date_joined: string;
  last_login: string | null;
  roles?: RoleItem[];
  role_ids?: number[];
  role_names?: string[];
}

export interface UserManageCreateData {
  username: string;
  email?: string;
  password: string;
  role_ids?: number[];
}

export interface UserManageUpdateData {
  email?: string;
  is_active?: boolean;
  role_ids?: number[];
}

export interface OperationLogItem {
  id: number;
  operator_name: string;
  operator_id: number;
  module: string;
  action: string;
  method: string;
  url: string;
  params: string;
  ip_address: string;
  result: string;
  message: string;
  duration: number;
  created_at: string;
}

export interface AuditLogItem {
  id: number;
  operator_name: string;
  operator_id: number;
  target_type: string;
  target_id: number;
  target_name: string;
  action: string;
  detail_before: string;
  detail_after: string;
  ip_address: string;
  created_at: string;
}

// 分页响应包装
interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ===== RBAC API =====

export const rbacApi = {
  // ========== 角色管理 ==========
  getRoles: (params?: { search?: string; page?: number; page_size?: number }): Promise<PaginatedResponse<RoleItem>> => {
    return request.get('/rbac/roles/', { params });
  },

  getRoleDetail: (id: number): Promise<RoleItem> => {
    return request.get(`/rbac/roles/${id}/`);
  },

  createRole: (data: RoleCreateData): Promise<RoleItem> => {
    return request.post('/rbac/roles/', data);
  },

  updateRole: (id: number, data: Partial<RoleCreateData>): Promise<RoleItem> => {
    return request.put(`/rbac/roles/${id}/`, data);
  },

  deleteRole: (id: number): Promise<void> => {
    return request.delete(`/rbac/roles/${id}/`);
  },

  assignPermissions: (id: number, permission_ids: number[]): Promise<void> => {
    return request.post(`/rbac/roles/${id}/assign_permissions/`, { permission_ids });
  },

  // ========== 权限管理 ==========
  getPermissions: (params?: { perm_type?: string; search?: string; page?: number; page_size?: number }): Promise<PaginatedResponse<PermItem>> => {
    return request.get('/rbac/permissions/', { params });
  },

  getPermissionTree: (): Promise<PermItem[]> => {
    return request.get('/rbac/permissions/tree/');
  },

  createPermission: (data: PermCreateData): Promise<PermItem> => {
    return request.post('/rbac/permissions/', data);
  },

  updatePermission: (id: number, data: Partial<PermCreateData>): Promise<PermItem> => {
    return request.put(`/rbac/permissions/${id}/`, data);
  },

  deletePermission: (id: number): Promise<void> => {
    return request.delete(`/rbac/permissions/${id}/`);
  },

  // ========== 菜单管理 ==========
  getMenus: (params?: { menu_type?: string; search?: string; page?: number; page_size?: number }): Promise<PaginatedResponse<MenuItem>> => {
    return request.get('/rbac/menus/', { params });
  },

  getMenuTree: (): Promise<MenuItem[]> => {
    return request.get('/rbac/menus/tree/');
  },

  getUserMenus: (): Promise<MenuItem[]> => {
    return request.get('/rbac/menus/user-menus/');
  },

  createMenu: (data: MenuCreateData): Promise<MenuItem> => {
    return request.post('/rbac/menus/', data);
  },

  updateMenu: (id: number, data: Partial<MenuCreateData>): Promise<MenuItem> => {
    return request.put(`/rbac/menus/${id}/`, data);
  },

  deleteMenu: (id: number): Promise<void> => {
    return request.delete(`/rbac/menus/${id}/`);
  },

  // ========== 用户管理(增强版) ==========
  getUserManageList: (params?: {
    search?: string;
    role?: string;
    status?: boolean | null;
    page?: number;
    page_size?: number;
  }): Promise<PaginatedResponse<UserManageItem>> => {
    return request.get('/rbac/users-manage/', { params });
  },

  getUserManageDetail: (id: number): Promise<UserManageItem> => {
    return request.get(`/rbac/users-manage/${id}/`);
  },

  createUser: (data: UserManageCreateData): Promise<UserManageItem> => {
    return request.post('/rbac/users-manage/', data);
  },

  updateUser: (id: number, data: UserManageUpdateData): Promise<UserManageItem> => {
    return request.put(`/rbac/users-manage/${id}/`, data);
  },

  deleteUser: (id: number): Promise<void> => {
    return request.delete(`/rbac/users-manage/${id}/`);
  },

  resetPassword: (id: number, new_password?: string): Promise<{ message: string }> => {
    return request.post(`/rbac/users-manage/${id}/reset_password/`, { new_password });
  },

  assignRoles: (id: number, role_ids: number[]): Promise<void> => {
    return request.post(`/rbac/users-manage/${id}/assign_roles/`, { role_ids });
  },

  // ========== 日志查询 ==========
  getOperationLogs: (params?: {
    module?: string;
    action?: string;
    result?: string;
    keyword?: string;
    start_date?: string;
    end_date?: string;
    page?: number;
    page_size?: number;
  }): Promise<PaginatedResponse<OperationLogItem>> => {
    return request.get('/rbac/operation-logs/', { params });
  },

  getAuditLogs: (params?: {
    target_type?: string;
    action?: string;
    keyword?: string;
    start_date?: string;
    end_date?: string;
    page?: number;
    page_size?: number;
  }): Promise<PaginatedResponse<AuditLogItem>> => {
    return request.get('/rbac/permission-audit-logs/', { params });
  },
};
