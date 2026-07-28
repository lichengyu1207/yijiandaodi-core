import request from '@/utils/request';

export interface AntiFraudDevice {
  id: string;
  fingerprint_hash: string;
  device_type: string;
  device_type_display: string;
  os_name: string;
  browser: string;
  ip_address: string;
  ip_country: string;
  is_proxy: boolean;
  is_datacenter_ip: boolean;
  risk_level: string;
  risk_score: number;
  risk_reasons: string[];
  event_count: number;
  user_count: number;
  first_seen_at: string;
  last_seen_at: string;
}

export interface AntiFraudEvent {
  id: string;
  user?: number | null;
  device?: string | null;
  event_type: string;
  event_type_display: string;
  severity: string;
  severity_display: string;
  action_taken: string;
  action_display: string;
  ip_address: string;
  user_agent: string;
  request_path: string;
  username_attempted: string;
  risk_score: number;
  triggered_rules: string[];
  risk_indicators: Array<Record<string, any>>;
  is_blocked: boolean;
  block_reason: string;
  processing_time_ms: number;
  created_at: string;
}

export interface FraudRuleItem {
  id: string;
  rule_code: string;
  rule_name: string;
  category: string;
  category_display: string;
  description: string;
  threshold_value: number;
  action: string;
  action_display: string;
  priority: number;
  weight: number;
  status: string;
  hit_count: number;
  block_count: number;
  last_hit_at: string;
}

export interface UserRiskProfileItem {
  id: string;
  user: number;
  username: string;
  email: string;
  overall_risk_score: number;
  risk_level: string;
  risk_level_display: string;
  registration_risk_score: number;
  login_risk_score: number;
  behavior_risk_score: number;
  device_risk_score: number;
  ip_risk_score: number;
  velocity_risk_score: number;
  total_events: number;
  blocked_events: number;
  failed_logins_24h: number;
  is_frozen: boolean;
  requires_mfa: boolean;
  frozen_reason: string;
  created_at: string;
}

export interface DashboardStats {
  time_range: string;
  events: {
    total_24h: number;
    blocked_24h: number;
    critical_24h: number;
    high_24h: number;
    by_event_type: Record<string, number>;
    avg_risk_score: number;
  };
  top_risk_ips: Array<{ ip: string; count: number }>;
  user_profiles: Record<string, number>;
  recent_critical_events: AntiFraudEvent[];
}

const BASE = '/api/anti-fraud';

export const antiFraudApi = {
  devices: {
    list: (params?: Record<string, any>) => request.get(`${BASE}/device-fingerprint/`, { params }),
    collect: (data: { fingerprint_data: Record<string, any> }) =>
      request.post(`${BASE}/device-fingerprint/collect/`, data),
  },
  events: {
    list: (params?: Record<string, any>) => request.get(`${BASE}/risk-event/`, { params }),
    report: (data: { event_type: string; fingerprint_data?: Record<string, any>; [key: string]: any }) =>
      request.post(`${BASE}/risk-event/report/`, data),
    myEvents: () => request.get(`${BASE}/risk-event/my-events/`),
    dashboardStats: () => request.get(`${BASE}/risk-event/dashboard-stats/`),
    takeAction: (data: { action_type: string; user_id: number | string; reason?: string; duration_hours?: number }) =>
      request.post(`${BASE}/risk-event/take-action/`, data),
  },
  rules: {
    list: (params?: Record<string, any>) => request.get(`${BASE}/fraud-rule/`, { params }),
    activeRules: () => request.get(`${BASE}/fraud-rule/active-rules/`),
    toggle: (id: string) => request.post(`${BASE}/fraud-rule/${id}/toggle/`),
  },
  profiles: {
    list: (params?: Record<string, any>) => request.get(`${BASE}/user-risk-profile/`, { params }),
    highRiskUsers: () => request.get(`${BASE}/user-risk-profile/high-risk-users/`),
  },
};
