/**
 * API配置管理
 *
 * 功能：
 * 1. 动态获取后端地址（支持开发/生产环境切换）
 * 2. 自动检测本地后端是否运行
 * 3. 配置持久化，重启应用后仍然有效
 */

export class APIConfig {
  private static instance: APIConfig;
  private baseURL: string;

  private constructor() {
    // 1. 优先从配置文件读取（生产环境）
    const configBaseURL = localStorage.getItem('api_base_url');

    // 2. 其次检测本地开发后端
    if (configBaseURL) {
      this.baseURL = configBaseURL;
    } else {
      // 3. 默认使用 Django 认证后端（开发环境）
      this.baseURL = 'http://localhost:8000';
    }
  }

  static getInstance(): APIConfig {
    if (!APIConfig.instance) {
      APIConfig.instance = new APIConfig();
    }
    return APIConfig.instance;
  }

  getBaseURL(): string {
    return this.baseURL;
  }

  /**
   * 官网（Web 端）地址解析（P1 账号互通）
   * - 允许通过 localStorage 'web_base_url' 显式配置；
   * - 开发环境：后端 localhost:8000 → 官网 Vite dev server localhost:3000；
   * - 生产环境：官网与后端同域部署。
   */
  getWebBaseURL(): string {
    const stored = localStorage.getItem('web_base_url');
    if (stored) return stored.replace(/\/+$/, '');
    // 生产默认官网地址；开发联调可用 localStorage.web_base_url 覆盖为 http://localhost:3000
    return 'https://yijiandaodi.com';
  }

  setBaseURL(url: string): void {
    this.baseURL = url;
    localStorage.setItem('api_base_url', url);
  }

  /**
   * 检测本地后端是否运行
   */
  async isLocalBackendRunning(): Promise<boolean> {
    try {
      const response = await fetch('http://localhost:8000/api/health/', {
        signal: AbortSignal.timeout(2000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 自动检测并设置后端地址
   */
  async autoDetectBackend(): Promise<string> {
    const configBaseURL = localStorage.getItem('api_base_url');

    if (configBaseURL) {
      // 使用配置的后端地址
      this.baseURL = configBaseURL;
      return configBaseURL;
    }

    // 检测本地后端
    const isLocalRunning = await this.isLocalBackendRunning();

    if (isLocalRunning) {
      this.baseURL = 'http://localhost:8000';
      return 'http://localhost:8000';
    } else {
      // 生产后端地址
      this.baseURL = 'https://yijiandaodi.com';
      return 'https://yijiandaodi.com';
    }
  }

  /**
   * 重置为默认配置
   */
  reset(): void {
    localStorage.removeItem('api_base_url');
    this.baseURL = 'http://localhost:8000';
  }
}

// 导出单例实例
export const apiConfig = APIConfig.getInstance();