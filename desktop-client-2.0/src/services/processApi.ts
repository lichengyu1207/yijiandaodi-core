/**
 * 进程行为监控 API 服务
 * 对接后端 /api/v1/process/ 接口（工具使用统计 + 行为存证时间线）
 */

import { apiConfig } from '../config/apiConfig';
import { authService } from './authService';

/**
 * 带认证头 + 401 自动刷新重试的 fetch
 */
async function authFetch(url: string, options: RequestInit = {}, retried = false): Promise<Response> {
  const token = authService.getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401 && !retried) {
    const refreshed = await authService.refreshTokenGuarded();
    if (refreshed) {
      return authFetch(url, options, true);
    }
  }

  return response;
}

export interface ToolStat {
  tool_name: string;
  total_duration_seconds: number;
  usage_count: number;
}

export interface ProcessStats {
  period: string;
  total_duration_seconds: number;
  tools: ToolStat[];
}

export interface TimelineEvent {
  type: 'process' | 'file';
  time: string;
  // process 类型
  tool_name?: string;
  process_name?: string;
  duration_seconds?: number;
  related_files?: string[];
  // file 类型
  file_path?: string;
  file_name?: string;
  operation_type?: string;
  risk_level?: string;
}

export interface ProcessTimeline {
  days: number;
  total_events: number;
  events: TimelineEvent[];
}

export class ProcessApiService {
  private baseUrl = apiConfig.getBaseURL();

  /**
   * 获取工具使用统计
   */
  async getStats(period: 'week' | 'month' = 'week'): Promise<ProcessStats> {
    const response = await authFetch(`${this.baseUrl}/api/v1/process/stats/?period=${period}`);
    if (!response.ok) {
      throw new Error(`获取进程统计失败: ${response.status}`);
    }
    const data = await response.json();
    return data;
  }

  /**
   * 获取行为存证时间线（进程 + 文件操作合并）
   */
  async getTimeline(days = 7): Promise<ProcessTimeline> {
    const response = await authFetch(`${this.baseUrl}/api/v1/process/timeline/?days=${days}`);
    if (!response.ok) {
      throw new Error(`获取行为时间线失败: ${response.status}`);
    }
    const data = await response.json();
    return data;
  }
}

export const processApiService = new ProcessApiService();
