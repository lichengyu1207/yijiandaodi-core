/**
 * 用户自有 API Key 管理服务
 * 对接后端 /api/api-keys/user-key/ 接口
 * 用户填写自己的 DeepSeek API Key 后，调用时优先使用自有 Key，不消耗平台共享额度
 */

import { apiConfig } from '../config/apiConfig';
import { authService } from './authService';

export interface UserKeyStatus {
  hasKey: boolean;
  provider: string;
  masked: string;       // sk-****abcd
  name: string;
  balance: string;      // "CNY 110.00"
  todayUsed: number;
  lastVerifiedOk: boolean;
  lastVerifiedAt: string | null;
}

interface SetKeyResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: {
    provider: string;
    name: string;
    masked: string;
    balance: string;
    lastVerifiedAt: string;
  };
}

class ApiKeyService {
  private baseUrl = apiConfig.getBaseURL();

  private async authFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const token = authService.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return fetch(url, { ...options, headers });
  }

  /**
   * 获取用户自有 Key 状态（掩码 + 余额 + 今日用量）
   */
  async getStatus(provider = 'deepseek'): Promise<UserKeyStatus> {
    const resp = await this.authFetch(`${this.baseUrl}/api/api-keys/user-key/status/?provider=${provider}`);
    if (!resp.ok) {
      throw new Error(`获取 API Key 状态失败: ${resp.status}`);
    }
    const data = await resp.json();
    return data.data;
  }

  /**
   * 设置/更新用户自有 Key（提交后自动验证，验证通过才保存）
   * @returns 成功则返回掩码 Key + 余额，失败抛出异常
   */
  async setKey(apiKey: string, provider = 'deepseek', name = ''): Promise<SetKeyResponse> {
    const resp = await this.authFetch(`${this.baseUrl}/api/api-keys/user-key/`, {
      method: 'POST',
      body: JSON.stringify({ api_key: apiKey, provider, name }),
    });
    const data = await resp.json();
    if (!resp.ok || !data.success) {
      throw new Error(data.error || '保存 API Key 失败');
    }
    return data;
  }

  /**
   * 删除用户自有 Key（回退到平台共享额度）
   */
  async deleteKey(provider = 'deepseek'): Promise<void> {
    const resp = await this.authFetch(`${this.baseUrl}/api/api-keys/user-key/delete/`, {
      method: 'DELETE',
      body: JSON.stringify({ provider }),
    });
    if (!resp.ok) {
      throw new Error(`删除 API Key 失败: ${resp.status}`);
    }
  }

  /**
   * 获取消费预算闸门实时额度（用于顶部进度条）
   */
  async getQuotaStatus(): Promise<{
    globalUsed: number;
    globalQuota: number;
    circuitOpen: boolean;
    circuitOpenedAt: number | null;
    failureRate: number;
    warnThreshold: number;
    criticalThreshold: number;
    status?: string;
  } | null> {
    try {
      const resp = await fetch(`${this.baseUrl}/api/deepseek/quota/`);
      if (!resp.ok) return null;
      const data = await resp.json();
      return data.quota || null;
    } catch {
      return null;
    }
  }

  /**
   * 获取消费额度预警配置（开关 / 阈值 / 通知方式）
   * GET /api/settings/quota-alert/
   */
  async getQuotaAlertConfig(): Promise<QuotaAlertConfig | null> {
    try {
      const resp = await this.authFetch(`${this.baseUrl}/api/settings/quota-alert/`);
      if (!resp.ok) return null;
      const data = await resp.json();
      return data.config || null;
    } catch {
      return null;
    }
  }

  /**
   * 保存消费额度预警配置
   * POST /api/settings/quota-alert/
   */
  async saveQuotaAlertConfig(cfg: Partial<QuotaAlertConfig>): Promise<QuotaAlertConfig> {
    const resp = await this.authFetch(`${this.baseUrl}/api/settings/quota-alert/`, {
      method: 'POST',
      body: JSON.stringify(cfg),
    });
    const data = await resp.json();
    if (!resp.ok || !data.success) {
      throw new Error(data.error || '保存消费预警配置失败');
    }
    return data.config;
  }
}

export interface QuotaAlertConfig {
  enabled: boolean;
  warn_threshold: number;
  critical_threshold: number;
  notify: string[]; // desktop | sound | email
}

export const apiKeyService = new ApiKeyService();