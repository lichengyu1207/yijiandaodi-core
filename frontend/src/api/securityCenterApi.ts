import request from '@/utils/request';

export interface DashboardSummary {
  security_score: number;
  score_level: string;
  today_events: number;
  open_alerts: number;
  critical_alerts: number;
  unresolved_vulns: number;
  today_blocked: number;
  today_audits: number;
  active_rules: number;
  recent_alerts: Array<{
    id: number; title: string; severity: string; category: string; triggered_at: string;
  }>;
  trend_7d: Array<{ date: string; events: number; blocked: number }>;
  by_category: Record<string, any>;
}

export interface UnifiedLogEntry {
  id: string;
  log_type: 'operation' | 'content_audit' | 'rag' | 'permission';
  source: string;
  user: string;
  action: string;
  detail: string;
  result: string;
  risk_level?: string;
  ip_address: string;
  created_at: string;
}

export interface AlertItem {
  id: number;
  title: string;
  description: string;
  category: string;
  category_display: string;
  severity: string;
  severity_display: string;
  status: string;
  status_display: string;
  source_type: string;
  source_id: number | null;
  source_detail: Record<string, any>;
  assignee_id: number | null;
  assignee_name: string;
  resolved_by: number | null;
  resolved_at: string | null;
  resolution_note: string;
  triggered_at: string;
  updated_at: string;
}

export interface ReportItem {
  id: number;
  report_type: string;
  report_type_display: string;
  title: string;
  status: string;
  status_display: string;
  period_start: string;
  period_end: string;
  summary: Record<string, any>;
  detail_data: Record<string, any>;
  file_path: string | null;
  created_by: number | null;
  created_at: string;
}

export const securityCenterApi = {

  getDashboardSummary: () =>
    request.get('/security-center/dashboard/summary/'),

  getScoreHistory: () =>
    request.get('/security-center/dashboard/score_history/'),

  getUnifiedLogs: (params?: {
    log_type?: string; source?: string; user?: string; result?: string;
    date_from?: string; date_to?: string; search?: string; page?: number; page_size?: number;
  }) => request.get('/security-center/logs/unified/', { params }),

  getAlerts: (params?: {
    severity?: string; status?: string; category?: string; page?: number; page_size?: number;
  }) => request.get('/security-center/alerts/', { params }),

  getAlertDetail: (id: number) =>
    request.get(`/security-center/alerts/${id}/`),

  acknowledgeAlert: (id: number) =>
    request.post(`/security-center/alerts/${id}/acknowledge/`),

  resolveAlert: (id: number, note?: string) =>
    request.post(`/security-center/alerts/${id}/resolve/`, { note: note || '' }),

  batchResolveAlerts: (ids: number[], note?: string) =>
    request.post('/security-center/alerts/batch_resolve/', { ids, note: note || '' }),

  getAlertStatistics: () =>
    request.get('/security-center/alerts/statistics/'),

  getReports: (params?: { report_type?: string; page?: number; page_size?: number }) =>
    request.get('/security-center/reports/', { params }),

  generateReport: (data: { report_type?: string; period_days?: number; title?: string }) =>
    request.post('/security-center/reports/generate/', data),

  exportReport: (params?: { report_id?: string; report_type?: string; period_days?: number }) =>
    request.get('/security-center/reports/export/', { params }),
};
