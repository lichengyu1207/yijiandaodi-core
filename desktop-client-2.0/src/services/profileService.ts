/**
 * 用户个性化数据同步服务（P1-4 账号互通二期）
 *
 * 后端 UserProfile（GET/PUT /api/user/profile/）读写 主题/布局/收藏。
 * - 登录成功后拉取后端 profile 覆盖本地 localStorage（重新登录不丢失）；
 * - 本地主题/背景变更时同步保存到后端。
 */

import { apiConfig } from '../config/apiConfig';
import { authService } from './authService';
import { themeService } from './themeService';
import type { ThemeName, CustomBg } from '../styles/themes';

export interface UserProfileData {
  theme: string;
  layout: Record<string, any>;
  favorites: unknown[];
}

/** 带认证的请求（未登录时无 Authorization，接口会返回 401） */
async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = authService.getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  return fetch(url, { ...options, headers });
}

/** 拉取后端个性化 profile */
export async function fetchProfile(): Promise<UserProfileData | null> {
  try {
    const resp = await authFetch(`${apiConfig.getBaseURL()}/api/user/profile/`);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data?.success && data.data) {
      return {
        theme: data.data.theme || 'default',
        layout: data.data.layout || {},
        favorites: data.data.favorites || [],
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** 将本地主题/背景推送到后端（主题变更时调用） */
export async function pushThemeToProfile(): Promise<boolean> {
  try {
    const theme = themeService.getTheme();
    const customBg = themeService.getCustomBg();
    const resp = await authFetch(`${apiConfig.getBaseURL()}/api/user/profile/`, {
      method: 'PUT',
      body: JSON.stringify({
        theme,
        layout: { customBg },
      }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

/**
 * 登录后应用后端 profile 到本地（主题/背景）。
 * 仅在本地尚未设置时用后端覆盖；本地已有自定义则保留本地并回写后端。
 */
export async function applyProfileTheme(): Promise<void> {
  const profile = await fetchProfile();
  if (!profile) return;

  // 本地已选主题时保留本地；否则用后端主题
  const localTheme = themeService.getTheme();
  const hasLocalTheme = localStorage.getItem('yjd.theme') !== null;
  if (!hasLocalTheme && (profile.theme === 'light' || profile.theme === 'dark' || profile.theme === 'deep')) {
    themeService.setTheme(profile.theme as ThemeName);
  } else if (hasLocalTheme && localTheme !== profile.theme && profile.theme) {
    // 本地与后端不一致：以后端为准覆盖（跨端同步的核心目标：改主题后重新登录仍保持）
    if (profile.theme === 'light' || profile.theme === 'dark' || profile.theme === 'deep') {
      themeService.setTheme(profile.theme as ThemeName);
    }
  }

  // 自定义背景
  const customBg = profile.layout?.customBg;
  if (customBg && typeof customBg.type === 'string' && typeof customBg.value === 'string') {
    themeService.setCustomBg(customBg as CustomBg);
  }
}
