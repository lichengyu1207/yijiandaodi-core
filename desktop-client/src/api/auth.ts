import request from '@/utils/request';

export interface UserInfo {
  id: number;
  username: string;
  email: string;
  role: string;
  avatar?: string;
  created_at: string;
  last_login?: string;
}

export interface LoginParams {
  username: string;
  password: string;
}

export interface LoginResult {
  token: string;
  user: UserInfo;
  expires_in: number;
}

export const authApi = {
  login: (data: LoginParams): Promise<LoginResult> => {
    return request.post('/auth/login/', data);
  },
  
  getUserInfo: (): Promise<UserInfo> => {
    return request.get('/auth/userinfo/');
  },
  
  logout: (): Promise<void> => {
    return request.post('/auth/logout/');
  },
  
  changePassword: (data: { old_password: string; new_password: string }): Promise<void> => {
    return request.post('/auth/change-password/', data);
  },
};