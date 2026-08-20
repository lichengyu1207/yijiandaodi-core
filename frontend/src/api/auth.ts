import request from '@/utils/request';

export interface LoginParams {
  username: string;
  password: string;
}

export interface UserInfo {
  id: number;
  username: string;
  email: string;
  avatar?: string;
  role: string;
  date_joined?: string;
  last_login?: string | null;
  is_creator?: boolean;  // 是否是创作者
  is_developer?: boolean;  // 是否是API开发者
}

export interface LoginResult {
  token: string;
  user: UserInfo;
  expires_in: number;
}

export interface SystemStatus {
  status: string;
  server_time: string;
  system_name: string;
  python_version: string;
  django_version: string;
}

export interface UserItem {
  id: number;
  username: string;
  email: string;
  role: 'super_admin' | 'admin' | 'editor' | 'viewer';
  is_active: boolean;
  date_joined: string;
  last_login?: string | null;
}

export interface UserUpdateData {
  role?: string;
  is_active?: boolean;
}

export interface LoginLog {
  id: number;
  ip_address: string;
  login_time: string;
  status: 'success' | 'failed';
  user_agent?: string;
}

export interface ChangePasswordData {
  old_password: string;
  new_password: string;
}

export interface RegisterParams {
  username: string;
  password: string;
  confirm_password: string;
  email?: string;
}

export const authApi = {
  login: (data: LoginParams): Promise<LoginResult> => {
    return request.post('/auth/login/', data);
  },

  register: (data: RegisterParams): Promise<any> => {
    return request.post('/auth/register/', data);
  },

  getUserInfo: (): Promise<UserInfo> => {
    return request.get('/auth/userinfo/');
  },

  // P1 账号互通：桌面端一次性临时 token 兑换正式登录态
  exchangeDesktopLogin: (token: string): Promise<LoginResult> => {
    return request.post('/auth/desktop-login/exchange/', { token });
  },

  getSystemStatus: (): Promise<SystemStatus> => {
    return request.get('/auth/system-status/');
  },

  logout: () => {
    return request.post('/auth/logout/');
  },

  getUsers: (params?: { role?: string }): Promise<UserItem[]> => {
    return request.get('/auth/users/', { params });
  },

  updateUser: (id: number, data: UserUpdateData): Promise<UserItem> => {
    return request.put(`/auth/users/${id}/`, data);
  },

  getLoginLogs: (): Promise<LoginLog[]> => {
    return request.get('/auth/login-logs/');
  },

  changePassword: (data: ChangePasswordData): Promise<void> => {
    return request.put('/auth/change-password/', data);
  },
};
