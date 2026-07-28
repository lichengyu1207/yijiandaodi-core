import request from '@/utils/request';

export interface UnifiedScanItem {
  id: string;
  user?: number;
  input_category: string;
  input_cat_display: string;
  detected_category: string;
  detected_cat_display: string;
  classification_confidence: number;
  file_name: string;
  file_size: number;
  file_hash_sha256: string;
  file_type: string;
  original_content: string;
  content_preview: string;
  content_language: string;
  overall_risk_level: string;
  risk_level_display: string;
  overall_risk_score: number;
  compliance_score: number;
  integrity_score: number;
  ai_generated_probability: number;
  plagiarism_similarity: number;
  deepfake_probability: number;
  data_leak_risk: number;
  sensitivity_level: string;
  dimension_results: Record<string, any>;
  triggered_detectors: string[];
  scan_timeline: Array<Record<string, any>>;
  findings_summary: Record<string, number>;
  finding_details: Array<Record<string, any>>;
  risk_indicators: Array<Record<string, any>>;
  compliance_mapping: Record<string, any>;
  affected_regulations: Array<Record<string, any>>;
  remediation_plan: Array<Record<string, any>>;
  audit_trail: Array<Record<string, any>>;
  unified_report: string;
  executive_brief: string;
  status: string;
  status_display: string;
  processing_time_ms: number;
  detectors_executed: number;
  detectors_passed: number;
  detectors_failed: number;
  tags: string[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

const BASE = '/api/unified-scan';

export const unifiedScanApi = {
  list: (params?: Record<string, any>) => request.get(`${BASE}/`, { params }),
  detail: (id: string) => request.get(`${BASE}/${id}/`),
  scan: (data: Partial<UnifiedScanItem>) => request.post(`${BASE}/scan/`, data),
  stats: () => request.get(`${BASE}/stats/`),
  complianceRules: () => request.get(`${BASE}/compliance-rules/`),
};

export type { UnifiedScanItem };
