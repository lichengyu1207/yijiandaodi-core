/**
 * 桌面端→官网跳转工具（P1 账号互通一期）
 *
 * openInBrowser(url, preserveAuth=true)
 *  - 官网地址由 apiConfig.getWebBaseURL() 解析（localStorage 可显式配置）；
 *  - preserveAuth=true 且已登录时：向后端申请一次性临时 token（5 分钟、用后即销毁），
 *    拼到官网 URL 上，官网前端用其兑换正式登录态（免登录）；
 *  - 同时附带 auth_user（用户名）：官网兑换失败（生产未录入该账号）时，
 *    降级引导用户「先设置密码」（注册页预填用户名），避免死链；
 *  - 未登录或申请失败时降级为不带 token 直开官网。
 */

import { apiConfig } from '../config/apiConfig';
import { authService } from './authService';

export interface OpenInBrowserResult {
  success: boolean;
  url: string;
  error?: string;
}

/**
 * 打开官网页面，可选保持登录态（携带一次性临时 token）。
 * @param targetPath 官网相对路径，如 '/pricing'、'/developer'
 * @param preserveAuth 是否携带登录态（默认 true）
 */
export async function openInBrowser(
  targetPath: string,
  preserveAuth = true
): Promise<OpenInBrowserResult> {
  let url = `${apiConfig.getWebBaseURL()}${targetPath.startsWith('/') ? targetPath : `/${targetPath}`}`;

  if (preserveAuth) {
    const temp = await authService.getDesktopLoginToken();
    if (temp?.token) {
      const sep = url.includes('?') ? '&' : '?';
      url = `${url}${sep}auth_token=${encodeURIComponent(temp.token)}`;
      // 附带用户名：官网兑换失败（生产未录入该账号）时，降级引导「先设置密码」并可预填用户名
      const user = authService.getCurrentUser?.();
      if (user?.username) {
        url += `&auth_user=${encodeURIComponent(user.username)}`;
      }
    }
  }

  try {
    const api = (window as any).electronAPI;
    if (api?.openInBrowser) {
      const res = await api.openInBrowser(url);
      if (res && res.success === false) {
        return { success: false, url, error: res.error };
      }
    } else {
      // 浏览器开发预览等无 Electron 环境：直接新标签页打开
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    return { success: true, url };
  } catch (error: any) {
    return { success: false, url, error: error?.message || '打开官网失败' };
  }
}

/** 桌面端→官网 入口映射（需求文档 6.2.2） */
export const OFFICIAL_SITE_ENTRIES: {
  key: string;
  label: string;
  desc: string;
  path: string;
}[] = [
  {
    key: 'pricing',
    label: '查看套餐',
    desc: '前往官网查看版本与套餐',
    path: '/pricing',
  },
  {
    key: 'account',
    label: '管理账号',
    desc: '前往官网用户中心管理账号',
    path: '/mall/user-center',
  },
  {
    key: 'billing',
    label: '查看账单',
    desc: '前往官网订单中心查看账单',
    path: '/mall/orders',
  },
  {
    key: 'developer',
    label: '开发者中心',
    desc: '前往官网 API 开发者中心',
    path: '/developer',
  },
];
