import request from '@/utils/request';

/**
 * Agent行为分析API
 */

// 行为监控总览
export interface BehaviorOverviewResponse {
  success: boolean;
  data: {
    today: {
      total_count: number;
      anomaly_count: number;
      high_risk_count: number;
      anomaly_rate: number;
    };
    agent_distribution: Array<{ agent_code: string; count: number }>;
    behavior_type_distribution: Array<{ behavior_type: string; count: number }>;
    risk_distribution: Array<{ risk_level: string; count: number }>;
    timestamp: string;
  };
}

// 行为日志列表
export interface BehaviorLog {
  id: number;
  agent_code: string;
  agent_name: string;
  session_id: string;
  behavior_type: string;
  behavior_data: any;
  risk_level: string;
  risk_score: number;
  anomaly_score: number;
  baseline_deviation: number;
  user_id: number | null;
  ip_address: string | null;
  timestamp: string;
  duration_ms: number;
  is_anomaly: boolean;
}

export interface BehaviorListResponse {
  success: boolean;
  data: {
    total_count: number;
    page: number;
    page_size: number;
    behaviors: BehaviorLog[];
  };
}

// 行为统计分析
export interface BehaviorStatisticsResponse {
  success: boolean;
  data: {
    time_range: string;
    start_time: string;
    end_time: string;
    total_count: number;
    avg_latency_ms: number;
    hourly_frequency: Array<{ hour: string; count: number }>;
    risk_distribution: Array<{ risk_level: string; count: number }>;
    anomaly_rate_trend: Array<{
      hour: string;
      total: number;
      anomalies: number;
      rate: number;
    }>;
  };
}

// 基线模型
export interface BehaviorBaseline {
  id: number;
  agent_code: string;
  baseline_type: string;
  version: string;
  sample_count: number;
  period_start: string;
  period_end: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  is_active: boolean;
  updated_at: string;
}

export interface BaselineListResponse {
  success: boolean;
  data: {
    total_count: number;
    baselines: BehaviorBaseline[];
  };
}

// 异常检测
export interface AnomalyDetection {
  id: number;
  behavior_log_id: number;
  anomaly_type: string;
  severity: string;
  confidence: number;
  anomaly_description: string;
  status: string;
  detected_at: string;
  agent_code: string;
  agent_name: string;
}

export interface AnomalyListResponse {
  success: boolean;
  data: {
    total_count: number;
    page: number;
    page_size: number;
    anomalies: AnomalyDetection[];
  };
}

// 行为分析报告
export interface BehaviorReportResponse {
  success: boolean;
  data: {
    report_period: {
      start_time: string;
      end_time: string;
      time_range: string;
    };
    summary: {
      total_behaviors: number;
      anomaly_behaviors: number;
      high_risk_behaviors: number;
      anomaly_rate: number;
    };
    metrics: {
      avg_latency_ms: number;
      avg_risk_score: number;
    };
    behavior_type_distribution: Array<{ behavior_type: string; count: number }>;
    anomaly_summary: Array<{ severity: string; status: string; count: number }>;
    recommendations: string[];
    generated_at: string;
  };
}

// 行为模式
export interface BehaviorPattern {
  id: number;
  agent_code: string;
  pattern_type: string;
  pattern_name: string;
  occurrence_count: number;
  support: number;
  confidence: number;
  is_normal: boolean;
  last_occurred_at: string | null;
}

export interface PatternListResponse {
  success: boolean;
  data: {
    patterns: BehaviorPattern[];
  };
}

// API函数
export const behaviorApi = {
  /**
   * 获取行为监控总览
   */
  getOverview(): Promise<BehaviorOverviewResponse> {
    return request.get('/behavior/overview/');
  },

  /**
   * 获取行为日志列表
   */
  getBehaviorList(params?: {
    agent_code?: string;
    behavior_type?: string;
    risk_level?: string;
    is_anomaly?: boolean;
    session_id?: string;
    start_time?: string;
    end_time?: string;
    page?: number;
    page_size?: number;
  }): Promise<BehaviorListResponse> {
    return request.get('/behavior/list/', { params });
  },

  /**
   * 获取单个行为详情
   */
  getBehaviorDetail(behaviorId: number): Promise<any> {
    return request.get(`/behavior/${behaviorId}/`);
  },

  /**
   * 获取行为统计分析
   */
  getStatistics(params?: {
    agent_code?: string;
    time_range?: string;
  }): Promise<BehaviorStatisticsResponse> {
    return request.get('/behavior/statistics/', { params });
  },

  /**
   * 获取行为分析报告
   */
  getReport(params?: {
    agent_code?: string;
    time_range?: string;
  }): Promise<BehaviorReportResponse> {
    return request.get('/behavior/report/', { params });
  },

  /**
   * 获取基线模型列表
   */
  getBaselineList(params?: {
    agent_code?: string;
    baseline_type?: string;
    is_active?: boolean;
  }): Promise<BaselineListResponse> {
    return request.get('/behavior/baseline/list/', { params });
  },

  /**
   * 获取基线模型详情
   */
  getBaselineDetail(baselineId: number): Promise<any> {
    return request.get(`/behavior/baseline/${baselineId}/`);
  },

  /**
   * 建立基线模型
   */
  buildBaseline(data: {
    agent_code: string;
    baseline_type: string;
    force?: boolean;
  }): Promise<any> {
    return request.post('/behavior/baseline/build/', data);
  },

  /**
   * 批量建立基线模型
   */
  buildAllBaselines(): Promise<any> {
    return request.post('/behavior/baseline/build-all/');
  },

  /**
   * 获取异常检测结果列表
   */
  getAnomalyList(params?: {
    severity?: string;
    status?: string;
    anomaly_type?: string;
    start_time?: string;
    end_time?: string;
    page?: number;
    page_size?: number;
  }): Promise<AnomalyListResponse> {
    return request.get('/behavior/anomaly/list/', { params });
  },

  /**
   * 获取异常详情
   */
  getAnomalyDetail(anomalyId: number): Promise<any> {
    return request.get(`/behavior/anomaly/${anomalyId}/`);
  },

  /**
   * 解决异常
   */
  resolveAnomaly(anomalyId: number, data: {
    status: 'resolved' | 'false_positive';
    resolution_notes?: string;
  }): Promise<any> {
    return request.post(`/behavior/anomaly/${anomalyId}/resolve/`, data);
  },

  /**
   * 获取行为模式列表
   */
  getPatternList(params?: {
    agent_code?: string;
    pattern_type?: string;
    is_normal?: boolean;
  }): Promise<PatternListResponse> {
    return request.get('/behavior/pattern/list/', { params });
  },

  /**
   * 获取系统健康状态
   */
  getHealth(): Promise<any> {
    return request.get('/behavior/health/');
  },
};