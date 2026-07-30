import axios from 'axios';

const SECURITY_API_BASE = '/api/security';

const securityApi = axios.create({
  baseURL: SECURITY_API_BASE,
  timeout: 10000,
});

securityApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

securityApi.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('Security API Error:', error);
    return Promise.reject(error);
  }
);

// ==================== 安全规则管理 ====================

export interface SecurityRule {
  id: number;
  name: string;
  rule_type: string;
  rule_type_display?: string;
  description: string;
  pattern: string;
  pattern_type: string;
  severity: string;
  severity_display?: string;
  action: string;
  action_display?: string;
  is_enabled: boolean;
  priority: number;
  target_roles: number[];
  exclude_users: number[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  created_by: number;
}

// 获取规则列表
export const getSecurityRules = (params?: { rule_type?: string; is_enabled?: boolean }) =>
  securityApi.get('/rules/', { params });

// 获取规则详情
export const getSecurityRule = (id: number) =>
  securityApi.get(`/rules/${id}/`);

// 创建规则
export const createSecurityRule = (data: Partial<SecurityRule>) =>
  securityApi.post('/rules/', data);

// 更新规则
export const updateSecurityRule = (id: number, data: Partial<SecurityRule>) =>
  securityApi.put(`/rules/${id}/`, data);

// 删除规则
export const deleteSecurityRule = (id: number) =>
  securityApi.delete(`/rules/${id}/`);

// 切换规则启用/禁用
export const toggleSecurityRule = (id: number) =>
  securityApi.post(`/rules/${id}/toggle/`);

// 获取规则统计
export const getSecurityStatistics = () =>
  securityApi.get('/rules/statistics/');

// ==================== 风控日志 ====================

export interface RiskLog {
  id: number;
  session_id: string;
  user_id: number;
  agent_role: string;
  rule_id: number | null;
  rule_name: string;
  rule_type: string;
  risk_level: string;
  risk_level_display?: string;
  status: string;
  status_display?: string;
  input_content: string;
  detected_pattern: string;
  action_taken: string;
  ip_address: string;
  response_message: string;
  processing_time_ms: number;
  created_at: string;
}

// 获取风控日志列表
export const getRiskLogs = (params?: {
  risk_level?: string;
  status?: string;
  user_id?: number;
  session_id?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}) => securityApi.get('/risk-logs/', { params });

// 获取风控统计摘要
export const getRiskLogSummary = () =>
  securityApi.get('/risk-logs/summary/');

// ==================== 安全检测 ====================

export interface SecurityCheckResult {
  is_safe: boolean;
  risk_level: string;
  action_taken: string;
  matched_rules: Array<{
    rule_id: number;
    rule_name: string;
    rule_type: string;
    severity: string;
    action: string;
    detected_pattern: string;
  }>;
  warning_message: string;
  masked_content: string;
}

// 检测内容安全性
export const checkContentSecurity = (data: {
  content: string;
  session_id?: string;
  agent_role?: string;
  user_id?: number;
}) => securityApi.post('/check/check_content/', data);

// 检测工具调用权限
export const checkToolPermission = (data: {
  tool_name: string;
  operation: string;
  user_id?: number;
  agent_role?: string;
}) => securityApi.post('/check/check_tool_permission/', data);

export default securityApi;
