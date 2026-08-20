import request from '@/utils/request';

export interface UserProfileData {
  theme: string;
  layout: Record<string, any>;
  favorites: unknown[];
}

// P1-4 用户个性化数据（主题/布局/收藏）跨端持久化
export const profileApi = {
  // 拉取后端 profile（登录成功后调用，覆盖 localStorage）
  getProfile: (): Promise<UserProfileData> => {
    return request.get('/user/profile/');
  },

  // 保存后端 profile（个性化数据变更时同步）
  saveProfile: (data: Partial<Pick<UserProfileData, 'theme' | 'layout' | 'favorites'>>): Promise<UserProfileData> => {
    return request.put('/user/profile/', data);
  },
};
