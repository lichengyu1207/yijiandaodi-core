/**
 * 消费统计服务（P1-1 统计一期）
 * 对接后端 /api/stats/by-region 区域维度统计接口
 * 支持 start_date/end_date 时间范围筛选
 */

import { apiConfig } from '../config/apiConfig';
import { authService } from './authService';

export interface RegionStatItem {
  region: string;
  label: string;
  total: number;
  count: number;
  avg: number;
  error_count: number;
  error_rate: number;
  share: number;
}

export interface StatsRangeParams {
  start_date?: string;
  end_date?: string;
}

interface ByRegionResponse {
  success: boolean;
  data: {
    items: RegionStatItem[];
    total: number;
    period_days: number;
    granularity: string;
  };
}

/** 趋势点（GET /api/stats/trend） */
export interface TrendPoint {
  date: string;
  value: number;
  p50: number;
  p95: number;
  p99: number;
  calls: number;
  anomaly: boolean;
}

export interface TrendResponse {
  success: boolean;
  data: {
    field: string;
    granularity: string;
    period_days: number;
    trend: TrendPoint[];
    summary: {
      total_cost: number;
      total_calls: number;
      avg_cost_per_call: number;
      error_rate: number;
    };
  };
}

/** 趋势分析点（GET /api/usage/trend-analysis trend[]） */
export interface TrendAnalysisPoint {
  date: string;
  cost: number;
  calls: number;
  tokens: number;
  error_rate: number;
  p50: number;
  p95: number;
  p99: number;
  anomaly: boolean;
}

export interface CostBreakdownItem {
  model?: string;
  scenario?: string;
  cost: number;
  tokens?: number;
  calls: number;
  share: number;
}

export interface TopExpensiveItem {
  run_id: string;
  model: string;
  scenario: string;
  input_tokens: number;
  output_tokens: number;
  time: string;
  tokens: number;
  cost: number;
  status: string;
}

export interface SuggestionItem {
  type: 'info' | 'cost' | 'warning' | 'error';
  title: string;
  detail: string;
  action: string;
}

export interface TrendAnalysisResponse {
  success: boolean;
  data: {
    summary: {
      total_cost: number;
      total_calls: number;
      total_tokens: number;
      avg_cost_per_call: number;
      error_rate: number;
      period_days: number;
    };
    granularity: string;
    trend: TrendAnalysisPoint[];
    cost_breakdown: {
      by_model: CostBreakdownItem[];
      by_scenario: CostBreakdownItem[];
    };
    top_expensive: TopExpensiveItem[];
    suggestions: SuggestionItem[];
  };
}

/** 每小时区域监控热力图（GET /api/stats/hourly） */
export interface HourlyCell {
  hour: string; // YYYY-MM-DDTHH（本地时区整点）
  region: string;
  calls: number;
  errors: number;
  avg_latency: number;
  cost: number;
  anomaly: boolean;
}

export interface HourlyTopCall {
  id: number;
  endpoint: string;
  method: string;
  status_code: number;
  response_time_ms: number;
  region: string;
  time: string;
}

export interface HourlyRegionResponse {
  success: boolean;
  data: {
    start_date: string;
    end_date: string;
    days: number;
    granularity: string;
    region: string;
    hours: string[];
    regions: string[];
    matrix: HourlyCell[];
    summary: {
      total_calls: number;
      total_errors: number;
      avg_latency: number;
      cost: number;
      anomaly_count: number;
    };
    top_calls?: HourlyTopCall[];
  };
}

class StatsService {
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

  /** 区域维度统计：各区域（cn/us/eu/all）API 调用消耗聚合 */
  async getByRegion(params: StatsRangeParams = {}): Promise<ByRegionResponse> {
    const qs = new URLSearchParams();
    if (params.start_date) qs.set('start_date', params.start_date);
    if (params.end_date) qs.set('end_date', params.end_date);
    const suffix = qs.toString();
    const resp = await this.authFetch(`${this.baseUrl}/api/stats/by-region/${suffix ? `?${suffix}` : ''}`);
    if (!resp.ok) {
      throw new Error(`获取区域消费统计失败: ${resp.status}`);
    }
    return resp.json();
  }

  /** 消费趋势统计：按 field(cost/count/error_rate) 与时间粒度聚合 + 分位 + 3σ 异常点 */
  async getTrend(params: StatsRangeParams & {
    field?: 'cost' | 'count' | 'error_rate';
    granularity?: 'hour' | 'day' | 'week' | 'month';
    days?: number;
  } = {}): Promise<TrendResponse> {
    const qs = new URLSearchParams();
    if (params.start_date) qs.set('start_date', params.start_date);
    if (params.end_date) qs.set('end_date', params.end_date);
    if (params.days) qs.set('days', String(params.days));
    if (params.field) qs.set('field', params.field);
    if (params.granularity) qs.set('granularity', params.granularity);
    const suffix = qs.toString();
    const resp = await this.authFetch(`${this.baseUrl}/api/stats/trend/${suffix ? `?${suffix}` : ''}`);
    if (!resp.ok) {
      throw new Error(`获取消费趋势失败: ${resp.status}`);
    }
    return resp.json();
  }

  /** 消费趋势反向分析：总体趋势 / 成本分解 / Top10 昂贵调用 / 优化建议 */
  async getTrendAnalysis(params: StatsRangeParams & { days?: number } = {}): Promise<TrendAnalysisResponse> {
    const qs = new URLSearchParams();
    if (params.start_date) qs.set('start_date', params.start_date);
    if (params.end_date) qs.set('end_date', params.end_date);
    if (params.days) qs.set('days', String(params.days));
    const suffix = qs.toString();
    const resp = await this.authFetch(`${this.baseUrl}/api/usage/trend-analysis/${suffix ? `?${suffix}` : ''}`);
    if (!resp.ok) {
      throw new Error(`获取消费趋势分析失败: ${resp.status}`);
    }
    return resp.json();
  }

  /** 每小时区域监控热力图：小时×区域调用矩阵 + 3σ 异常（支持 region 过滤与精确小时 Top10 明细） */
  async getHourly(params: StatsRangeParams & {
    region?: string;
    days?: number;
    hour?: string;
  } = {}): Promise<HourlyRegionResponse> {
    const qs = new URLSearchParams();
    if (params.start_date) qs.set('start_date', params.start_date);
    if (params.end_date) qs.set('end_date', params.end_date);
    if (params.days) qs.set('days', String(params.days));
    if (params.region) qs.set('region', params.region);
    if (params.hour) qs.set('hour', params.hour);
    const suffix = qs.toString();
    const resp = await this.authFetch(`${this.baseUrl}/api/stats/hourly/${suffix ? `?${suffix}` : ''}`);
    if (!resp.ok) {
      throw new Error(`获取小时区域监控失败: ${resp.status}`);
    }
    return resp.json();
  }
}

export const statsService = new StatsService();
