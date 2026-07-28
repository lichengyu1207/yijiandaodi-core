import request from '@/utils/request';

export interface DataSensitivityLevel {
  id: number; code: string; name: string; description: string;
  color: string; icon: string; retention_days: number;
  encryption_required: boolean; access_log_required: boolean;
  export_approval_required: boolean; allowed_roles: string[];
  dpo_review_required: boolean; sort_order: number; is_active: boolean;
}

export interface DataCategory {
  id: number; code: string; name: string; category_type: string;
  category_type_display: string; description: string;
  default_level_id?: number | null; default_level_name?: string;
  default_level_code?: string; legal_basis: string;
  compliance_requirements: string[]; cross_border_transfer_allowed: boolean;
  is_active: boolean;
}

export interface DataFieldTag {
  id: number; field_path: string; field_label: string;
  pii_type: string; pii_type_display: string;
  sensitivity_level_id: number; level_name: string; level_code: string; level_color: string;
  data_category_id: number; category_name: string;
  mask_rule: string; mask_pattern: string; is_encrypted_at_rest: boolean;
  legal_basis: string; created_at: string;
}

export interface ClassificationRecord {
  id: number; object_type: string; object_id: number; object_repr: string;
  sensitivity_level_id: number | null; level_name: string; level_color: string;
  data_category_id: number | null; category_name: string;
  action_type: string; operator_id: number | null; operator_name: string;
  operator_role: string; reason: string; ip_address: string;
  previous_level_code: string; new_level_code: string;
  auto_classification_score: number | null; classification_rules_matched: string[];
  created_at: string;
}

export interface ExportApproval {
  id: number; requester_id: number; requester_name: string;
  approver_id: number | null; approver_name: string;
  data_description: string; object_types: string[];
  max_sensitivity_level: string; record_count_estimate: number;
  purpose: string; recipient: string; export_format: string;
  status: string; status_display: string;
  approval_comment: string; approved_at: string | null; expires_at: string | null;
  file_path: string; download_count: number; last_download_at: string | null;
  ip_address: string; created_at: string;
}

export interface ComplianceDashboard {
  summary: {
    total_tagged_fields: number; pii_field_count: number; pii_coverage_pct: number;
    encrypted_field_count: number; recent_classification_actions: number;
    pending_export_approvals: number; active_dpo_count: number;
    categories_with_compliance_rules: number;
  };
  level_breakdown: Record<string, { name: string; color: string; field_count: number }>;
  compliance_status: Record<string, boolean>;
  legal_basises: string[];
}

export const dcApi = {
  getLevels: () => request.get('/levels/', { baseURL: '/api/data-classification' }),
  getCategories: () => request.get('/categories/', { baseURL: '/api/data-classification' }),
  getCategoryTree: () => request.get('/categories/tree/', { baseURL: '/api/data-classification' }),
  getFieldTags: (params?: Record<string, string>) => request.get('/field-tags/', { params, baseURL: '/api/data-classification' }),
  getByPiiType: () => request.get('/field-tags/by-pii-type/', { baseURL: '/api/data-classification' }),
  batchTagFields: (tags: Partial<DataFieldTag>[]) => request.post('/field-tags/batch-tag/', { tags }, { baseURL: '/api/data-classification' }),

  getClassificationRecords: (params?: Record<string, string>) => request.get('/records/', { params, baseURL: '/api/data-classification' }),
  classifyObject: (data: { object_type: string; object_id: number | string; level_code: string; category_code?: string; reason?: string }) =>
    request.post('/records/classify-object/', data, { baseURL: '/api/data-classification' }),
  getRecordStats: () => request.get('/records/statistics/', { baseURL: '/api/data-classification' }),

  getExportApprovals: (params?: Record<string, string>) => request.get('/export-approvals/', { params, baseURL: '/api/data-classification' }),
  createExportApproval: (data: Partial<ExportApproval>) => request.post('/export-approvals/', data, { baseURL: '/api/data-classification' }),
  approveExport: (id: number) => request.post(`/export-approvals/${id}/approve/`, {}, { baseURL: '/api/data-classification' }),
  rejectExport: (id: number, comment: string) => request.post(`/export-approvals/${id}/reject/`, { comment }, { baseURL: '/api/data-classification' }),

  getActiveDPOs: () => request.get('/dpo/active-dpo/', { baseURL: '/api/data-classification' }),
  getDashboard: () => request.get('/dashboard/', { baseURL: '/api/data-classification' }),
};
