import request from '@/utils/request';

export interface AcademicCheckItem {
  id: string;
  user?: number;
  institution: string;
  department: string;
  submitter_role: string;
  document_type: string;
  doc_type_display: string;
  file_name: string;
  file_size: number;
  title: string;
  author_names: string[];
  abstract_text: string;
  full_content: string;
  word_count: number;
  reference_count: number;
  overall_verdict: string;
  verdict_display: string;
  integrity_score: number;
  ai_detection_result: Record<string, any>;
  ai_generated_probability: number;
  ai_generated_sections: Array<Record<string, any>>;
  plagiarism_result: Record<string, any>;
  overall_similarity: number;
  plagiarism_sources: Array<Record<string, any>>;
  matched_segments: Array<Record<string, any>>;
  citation_analysis: Record<string, any>;
  fabrication_check: Record<string, any>;
  image_manipulation: Array<Record<string, any>>;
  authorship_analysis: Record<string, any>;
  violation_categories: Array<Record<string, any>>;
  recommended_actions: string[];
  academic_report: string;
  status: string;
  status_display: string;
  processing_time_ms: number;
  created_at: string;
  updated_at: string;
}

export interface EnterpriseAuditItem {
  id: string;
  user: number;
  enterprise_name: string;
  industry: string;
  employee_count: number;
  contact_person: string;
  contact_email: string;
  audit_name: string;
  audit_scope: string;
  scope_display: string;
  audit_config: Record<string, any>;
  scheduled_frequency: string;
  alert_threshold: Record<string, any>;
  total_items_scanned: number;
  risk_items_found: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  overall_risk_score: number;
  compliance_score: number;
  audit_results: Record<string, any>;
  active_alerts: Array<Record<string, any>>;
  alert_history: Array<Record<string, any>>;
  remediation_tracking: Array<Record<string, any>>;
  dashboard_snapshot: Record<string, any>;
  compliance_standards: Record<string, any>;
  executive_summary: string | string[];
  detailed_audit_report: string;
  contract_value: string | null;
  audit_period_start: string | null;
  audit_period_end: string | null;
  next_audit_date: string | null;
  status: string;
  status_display: string;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

const BASE = '/api/c-scenario';

export const cScenarioApi = {
  academic: {
    list: (params?: Record<string, any>) => request.get(`${BASE}/academic/`, { params }),
    detail: (id: string) => request.get(`${BASE}/academic/${id}/`),
    check: (data: Partial<AcademicCheckItem>) => request.post(`${BASE}/academic/check/`, data),
    stats: () => request.get(`${BASE}/academic/stats/`),
    exportPdf: (id: string, config?: Record<string, any>) => request.post(`${BASE}/academic/${id}/export-pdf/`, config || {}),
  },
  enterpriseAudit: {
    list: (params?: Record<string, any>) => request.get(`${BASE}/enterprise-audit/`, { params }),
    detail: (id: string) => request.get(`${BASE}/enterprise-audit/${id}/`),
    runAudit: (data: Partial<EnterpriseAuditItem>) => request.post(`${BASE}/enterprise-audit/run_audit/`, data),
    stats: () => request.get(`${BASE}/enterprise-audit/stats/`),
  },
};
