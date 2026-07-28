import axios from 'axios';

const STATS_API_BASE = '/api/stats';

const statsApi = axios.create({
  baseURL: STATS_API_BASE,
  timeout: 20000,
});

statsApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = 'Bearer ' + token;
    return config;
  },
  (error) => Promise.reject(error)
);

statsApi.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('[Stats API] Error:', error);
    return Promise.reject(error);
  }
);

export interface OverviewSummary {
  total_dau_avg: number;
  total_new_users: number;
  total_clicks: number;
  total_executions: number;
  total_shares: number;
  total_revenue: number;
  avg_conversion_rate: number;
  total_gross_revenue: number;
  total_net_revenue: number;
  total_orders: number;
  total_refunds: number;
  period_days: number;
}

export interface ChartDataPoint {
  date: string;
  dau: number;
  new_users: number;
  clicks: number;
  executions: number;
  revenue: number;
  conversion_rate: number;
  paid_uses: number;
  free_uses: number;
  gross_revenue: number;
  orders: number;
}

export interface SkillStatItem {
  skill_id: number;
  skill_name: string;
  tier: string;
  category: string;
  impressions: number;
  clicks: number;
  executions: number;
  shares: number;
  revenue: number;
  click_rate: number;
  execution_rate: number;
  conversion_rate: number;
  days_active: number;
}

export interface AreaStatItem {
  area_type: string;
  area_label: string;
  impressions: number;
  clicks: number;
  uv: number;
  ctr: number;
  avg_ctr: number;
  days_active: number;
}

export interface RevenueSummary {
  total_gross_revenue: number;
  total_net_revenue: number;
  total_orders: number;
  total_refunds: number;
  avg_order_value: number;
  avg_conversion_rate: number;
  total_commission: number;
  total_vip_active: number;
  total_new_vip: number;
}

export interface PackageBreakdown {
  per_use: number;
  monthly: number;
  yearly_199: number;
  yearly_599: number;
  enterprise: number;
  combo_security: number;
  combo_content: number;
  combo_enterprise: number;
}

export const getStatsOverview = async (days = 7): Promise<{
  success: boolean;
  data: { summary: OverviewSummary; chart_data: ChartDataPoint[]; latest_date: string };
}> => {
  return statsApi.get('/overview/', { params: { days } });
};

export const getStatsSkills = async (params?: {
  days?: number;
  category?: string;
  tier?: string;
  sort_by?: string;
  limit?: number;
}): Promise<{ success: boolean; data: { items: SkillStatItem[]; total: number; categories: string[]; tiers: string[] } }> => {
  return statsApi.get('/skills/', { params });
};

export const getStatsAreas = async (days = 7): Promise<{
  success: boolean;
  data: { summary: AreaStatItem[]; trend: Record<string, Array<{date: string; clicks: number; impressions: number; ctr: number}>>; period_days: number };
}> => {
  return statsApi.get('/areas/', { params: { days } });
};

export const getStatsRevenue = async (days = 30): Promise<{
  success: boolean;
  data: { summary: RevenueSummary; package_breakdown: PackageBreakdown; chart_data: Array<{date: string; gross_revenue: number; net_revenue: number; orders: number; refunds: number; aov: number; commission: number; vip_active: number}>; period_days: number };
}> => {
  return statsApi.get('/revenue/', { params: { days } });
};

export const refreshStats = async (targetDate?: string): Promise<any> => {
  return statsApi.post('/refresh-stats/', targetDate ? { target_date: targetDate } : {});
};

export default statsApi;
