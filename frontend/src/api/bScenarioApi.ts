import request from '@/utils/request';

export interface MedicalReportItem {
  id: string;
  user?: number;
  report_type: string;
  report_type_display: string;
  file_name: string;
  file_size: number;
  original_text: string;
  ai_generated_prob: number;
  medical_error_score: number;
  risk_level: string;
  risk_level_display: string;
  status: string;
  status_display: string;
  detection_result: Record<string, any>;
  medical_issues: Array<{ category: string; severity: string; description: string; location: string }>;
  ai_indicators: Record<string, any>;
  professional_report: string;
  patient_id_masked: string;
  institution: string;
  department: string;
  report_date: string | null;
  processing_time_ms: number;
  created_at: string;
  updated_at: string;
}

export interface LegalDocumentItem {
  id: string;
  doc_type: string;
  doc_type_display: string;
  file_name: string;
  file_size: number;
  original_text: string;
  ai_generated_prob: number;
  legal_risk_score: number;
  risk_level: string;
  risk_level_display: string;
  status: string;
  status_display: string;
  detection_result: Record<string, any>;
  legal_risks: Array<{ category: string; severity: string; description: string; article_ref: string }>;
  compliance_issues: Array<{ standard: string; description: string; suggestion: string }>;
  ai_indicators: Record<string, any>;
  professional_report: string;
  parties_involved: string[];
  jurisdiction: string;
  effective_date: string | null;
  doc_amount: string | null;
  processing_time_ms: number;
  created_at: string;
  updated_at: string;
}

export interface FinancialStatementItem {
  id: string;
  statement_type: string;
  statement_type_display: string;
  file_name: string;
  file_size: number;
  original_text: string;
  ai_generated_prob: number;
  fraud_risk_score: number;
  risk_level: string;
  risk_level_display: string;
  status: string;
  status_display: string;
  detection_result: Record<string, any>;
  fraud_indicators: Array<{ indicator: string; value: string; threshold: string; risk_level: string; description: string }>;
  anomaly_items: Array<{ item: string; observed_value: string; expected_range: string; deviation: string; explanation: string }>;
  ai_indicators: Record<string, any>;
  professional_report: string;
  company_name_masked: string;
  reporting_period: string;
  total_assets: string | null;
  total_revenue: string | null;
  audit_firm: string;
  processing_time_ms: number;
  created_at: string;
  updated_at: string;
}

export interface DesignDraftItem {
  id: string;
  design_type: string;
  design_type_display: string;
  file_name: string;
  file_size: number;
  original_text: string;
  image_preview_url: string;
  ai_generated_prob: number;
  plagiarism_score: number;
  originality_score: number;
  risk_level: string;
  risk_level_display: string;
  status: string;
  status_display: string;
  detection_result: Record<string, any>;
  plagiarism_sources: Array<{ source: string; similarity: string; matched_elements: string }>;
  ai_style_markers: Array<{ marker: string; confidence: string; description: string }>;
  ai_indicators: Record<string, any>;
  professional_report: string;
  designer_alias: string;
  design_tool: string;
  color_palette: string[];
  dimensions: string;
  processing_time_ms: number;
  created_at: string;
  updated_at: string;
}

const BASE = '/api/b-scenario';

const medicalApi = {
  list: (params?: Record<string, any>) => request.get(`${BASE}/medical/`, { params }),
  detail: (id: string) => request.get(`${BASE}/medical/${id}/`),
  detect: (data: Partial<MedicalReportItem>) => request.post(`${BASE}/medical/detect/`, data),
  stats: () => request.get(`${BASE}/medical/stats/`),
};

const legalApi = {
  list: (params?: Record<string, any>) => request.get(`${BASE}/legal/`, { params }),
  detail: (id: string) => request.get(`${BASE}/legal/${id}/`),
  detect: (data: Partial<LegalDocumentItem>) => request.post(`${BASE}/legal/detect/`, data),
  stats: () => request.get(`${BASE}/legal/stats/`),
};

const financialApi = {
  list: (params?: Record<string, any>) => request.get(`${BASE}/financial/`, { params }),
  detail: (id: string) => request.get(`${BASE}/financial/${id}/`),
  detect: (data: Partial<FinancialStatementItem>) => request.post(`${BASE}/financial/detect/`, data),
  stats: () => request.get(`${BASE}/financial/stats/`),
};

const designApi = {
  list: (params?: Record<string, any>) => request.get(`${BASE}/design/`, { params }),
  detail: (id: string) => request.get(`${BASE}/design/${id}/`),
  detect: (data: Partial<DesignDraftItem>) => request.post(`${BASE}/design/detect/`, data),
  stats: () => request.get(`${BASE}/design/stats/`),
};

export const bScenarioApi = {
  medical: medicalApi,
  legal: legalApi,
  financial: financialApi,
  design: designApi,
};
