import request from '@/utils/request';

export interface RegexRuleItem {
  id: number;
  name: string;
  category: string;
  category_display: string;
  pattern: string;
  description: string;
  severity: string;
  severity_display: string;
  action: string;
  action_display: string;
  replacement: string;
  is_enabled: boolean;
  match_count: number;
  false_positive_count: number;
  tags: string[];
  sort_order: number;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLogItem {
  id: number;
  content: string;
  content_hash: string;
  source: string;
  user_id: number | null;
  username: string;
  username_display: string;
  ip_address: string | null;
  result: string;
  result_display: string;
  risk_level: string;
  total_matches: number;
  matched_rules: RuleMatchInfo[];
  action_taken: string;
  action_taken_display: string;
  processing_time_ms: number;
  error_message: string;
  created_at: string;
}

export interface RuleMatchInfo {
  rule_id: number;
  rule_name: string;
  category: string;
  category_display: string;
  severity: string;
  action: string;
  match_count: number;
  matches: string[];
  pattern: string;
}

export interface TestResult {
  valid: boolean;
  matched: boolean;
  match_count: number;
  matches: string[];
  matched_text: string;
  position: number[] | null;
  error?: string;
}

export interface CategoryStat {
  value: string;
  label: string;
  count: number;
}

export const riskControlApi = {
  getRules: (params?: { category?: string; severity?: string; is_enabled?: string; search?: string; page?: number; page_size?: number }) =>
    request.get('/risk-control/rules/', { params }),

  getRuleDetail: (id: number) =>
    request.get(`/risk-control/rules/${id}/`),

  createRule: (data: Partial<RegexRuleItem>) =>
    request.post('/risk-control/rules/', data),

  updateRule: (id: number, data: Partial<RegexRuleItem>) =>
    request.put(`/risk-control/rules/${id}/`, data),

  deleteRule: (id: number) =>
    request.delete(`/risk-control/rules/${id}/`),

  getCategories: () =>
    request.get('/risk-control/rules/categories/'),

  getStatistics: () =>
    request.get('/risk-control/rules/statistics/'),

  testRule: (ruleId: number, text: string) =>
    request.post(`/risk-control/rules/${ruleId}/test/`, { text }),

  testRawPattern: (data: { text: string; pattern?: string; rule_id?: number }) =>
    request.post('/risk-control/rules/test_raw/', data),

  batchToggle: (ids: number[], is_enabled: boolean) =>
    request.post('/risk-control/rules/batch_toggle/', { ids, is_enabled }),

  batchDelete: (ids: number[]) =>
    request.post('/risk-control/rules/batch_delete/', { ids }),

  batchImport: (rules: any[], overwrite?: boolean) =>
    request.post('/risk-control/rules/batch_import/', { rules, overwrite: overwrite || false }),

  exportRules: (params?: { category?: string; only_enabled?: string }) =>
    request.get('/risk-control/rules/export/', { params }),

  getAuditLogs: (params?: {
    result?: string;
    risk_level?: string;
    source?: string;
    date_from?: string;
    date_to?: string;
    page?: number;
    page_size?: number;
  }) => request.get('/risk-control/audit-logs/', { params }),

  deleteAuditLog: (id: number) =>
    request.delete(`/risk-control/audit-logs/${id}/`),

  getAuditStatistics: () =>
    request.get('/risk-control/audit-logs/statistics/'),

  checkContent: (content: string, source?: string) =>
    request.post('/risk-control/check/check/', { content, source: source || 'web' }),

  quickCheck: (content: string) =>
    request.post('/risk-control/check/quick_check/', { content }),
};
