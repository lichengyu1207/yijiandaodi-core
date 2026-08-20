import axios from 'axios';

const request = axios.create({
  baseURL: '/api',
  timeout: 30000,
  withCredentials: true,  // 携带 httpOnly Cookie（跨域必需）
  headers: {
    'Content-Type': 'application/json',
  },
});

request.interceptors.request.use(
  (config) => {
    // 优先使用 httpOnly Cookie（安全方式），同时兼容 localStorage token（Bearer Header 兜底）
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

request.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    if (error.response) {
      const { status } = error.response;
      // skipAuthRedirect：调用方自行处理 401（如桌面端临时 token 兑换失败需降级引导「先设置密码」），
      // 避免被强制重定向到 /login 导致降级弹窗丢失。
      const skipRedirect = (error.config as any)?.skipAuthRedirect === true;
      if (status === 401 && !skipRedirect) {
        // Token 过期或无效，跳转登录页
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      } else if (status === 429) {
        console.warn('请求过于频繁，请稍后再试');
      } else if (status >= 500) {
        console.error('服务器内部错误，请稍后重试');
      }
    }
    return Promise.reject(error);
  }
);

export default request;
