/**
 * 套餐/计费实时挂钩服务（需求 4.2.3 两级计费）
 * 对接后端 /api/billing/summary 与 /api/billing/monthly-detail
 */

import { apiConfig } from '../config/apiConfig';
import { authService } from './authService';

export interface BillingPlan {
  plan_type: string;
  plan_name: string;
  monthly_price: number;
  api_limit: number;
  api_call_price: number;
  is_plan: boolean;
}

export interface MonthlyUsage {
  cost: number;
  tokens: number;
  calls: number;
}

export interface OverQuota {
  calls: number;
  cost: number;
}

export interface BillingSummary {
  month: string;
  plan: BillingPlan;
  is_vip: boolean;
  vip_level: number;
  vip_expire_at: string | null;
  usage: MonthlyUsage;
  plan_remaining: number | null;
  over_quota: OverQuota;
  projected_month_cost: number;
  advice: 'bind_key' | 'upgrade' | 'watch' | 'ok';
  generated_at: string;
}

export interface BillingDayItem {
  date: string;
  cost: number;
  tokens: number;
  calls: number;
}

export interface MonthlyDetail {
  month: string;
  days: BillingDayItem[];
}

export interface BillingSummaryResponse {
  success: boolean;
  data: BillingSummary;
}

export interface MonthlyDetailResponse {
  success: boolean;
  data: MonthlyDetail;
}

class BillingService {
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

  /** 实时账单摘要：本月已用 / 套餐剩余 / 预估费用 / 建议 */
  async getSummary(): Promise<BillingSummaryResponse> {
    const resp = await this.authFetch(`${this.baseUrl}/api/billing/summary/`);
    if (!resp.ok) {
      throw new Error(`获取账单摘要失败: ${resp.status}`);
    }
    return resp.json();
  }

  /** 月度账单明细：按天聚合（month 形如 2026-08，缺省当月） */
  async getMonthlyDetail(month?: string): Promise<MonthlyDetailResponse> {
    const qs = month ? `?month=${month}` : '';
    const resp = await this.authFetch(`${this.baseUrl}/api/billing/monthly-detail/${qs}`);
    if (!resp.ok) {
      throw new Error(`获取月度账单失败: ${resp.status}`);
    }
    return resp.json();
  }
}

export const billingService = new BillingService();