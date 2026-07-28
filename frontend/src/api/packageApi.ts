import request from '@/utils/request';

export interface ScenarioPackage {
  id: number; name: string; package_type: string; package_type_display: string;
  description: string; cover_image: string;
  s_scenario_id: number | null; s_scenario_name: string; s_scenario_price: string;
  a_scenario_id: number | null; a_scenario_name: string; a_scenario_price: string;
  b_scenarios_list: { id: number; title: string; price: string }[];
  original_total_price: string; package_price: string;
  discount_percent: number; saved_amount: string;
  included_features: string[]; tier_badges: string[];
  validity_days: number; max_users: number;
  is_active: boolean; is_featured: boolean; sales_count: number;
}

export interface EnterpriseAuditService {
  id: number; name: string; audit_tier: string; tier_display: string;
  scope: string; scope_display: string; description: string;
  deliverables: string[]; base_price: string; min_price: string;
  profit_margin: number; audit_days: number; on_site_visits: number;
  report_count: number; includes_remediation: boolean;
  includes_certification: boolean; includes_training: boolean;
  target_company_size: string; industry_focus: string[];
  compliance_standards: string[]; is_active: boolean; is_recommended: boolean;
}

export interface AuditContract {
  id: number; contract_no: string; company_name: string;
  service_id: number; service_name: string; service_tier: string;
  status: string; status_display: string;
  final_price: string; contact_person: string; contact_phone: string;
  start_date: string; signed_at: string; created_at: string;
}

const pkgApi = { baseURL: '/api/packages' };

export const packageApi = {
  getPackages: () => request.get('/scenario-packages/', { baseURL: '/api/packages' }),
  getFeaturedPackages: () => request.get('/scenario-packages/featured/', { baseURL: '/api/packages' }),
  getTierOverview: () => request.get('/scenario-packages/tier-overview/', { baseURL: '/api/packages' }),

  purchasePackage: (pkgId: number, selectedBId?: number) =>
    request.post(`/scenario-packages/${pkgId}/purchase/`, { selected_b_id: selectedBId }, { baseURL: '/api/packages' }),

  getAuditServices: (params?: Record<string, string>) =>
    request.get('/audit-services/', { params, baseURL: '/api/packages' }),
  getPricingMatrix: () => request.get('/audit-services/pricing-matrix/', { baseURL: '/api/packages' }),

  submitAuditInquiry: (data: {
    service_id: number; company_name: string; contact_person: string;
    contact_phone: string; contact_email: string;
    employee_count?: string; industry?: string; requirements?: string;
  }) => request.post('/audit-services/submit-inquiry/', data, { baseURL: '/api/packages' }),

  getAuditContracts: () => request.get('/audit-services/contracts/', { baseURL: '/api/packages' }),
  getAuditStats: () => request.get('/audit-services/stats/', { baseURL: '/api/packages' }),
};
