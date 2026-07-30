import request from '../utils/request';

export interface EnterpriseInfo {
  id: number;
  name: string;
  company_name: string;
  plan_type: string;
  plan_display: string;
  status: string;
  status_display: string;
  contact_person: string;
  contact_phone: string;
  contact_email: string;
  balance: string;
  total_recharged: string;
  total_spent: string;
  api_calls_limit: number;
  api_calls_used: number;
  api_calls_remaining: number;
  members_limit: number;
  active_member_count: number;
  api_key_count: number;
  active_api_key_count: number;
  paid_until: string | null;
  trial_ends_at: string | null;
  auto_renew: boolean;
  member_count: number;
  members: EnterpriseMember[];
  api_keys: EnterpriseApiKeyPreview[];
  created_at: string | null;
}

export interface EnterpriseMember {
  id: number;
  user_id: number;
  username: string;
  email: string;
  role: string;
  role_display: string;
  status: string;
  status_display: string;
  department: string;
  position: string;
  last_login_at: string | null;
  joined_at: string | null;
  is_self: boolean;
}

export interface EnterpriseApiKeyPreview {
  id: number;
  name: string;
  key_type: string;
  key_preview: string;
  is_active: boolean;
  total_calls: number;
  last_used_at: string | null;
  created_at: string | null;
}

export interface EnterpriseApiKeyDetail extends EnterpriseApiKeyPreview {
  key_type_display: string;
  rate_limit_per_minute: number;
  daily_quota: number;
  monthly_quota: number;
  expires_at: string | null;
  ip_restrictions: string;
}

export interface RechargeRecord {
  id: number;
  recharge_type: string;
  recharge_type_display: string;
  amount: string;
  payment_method: string;
  transaction_no: string;
  status: string;
  status_display: string;
  invoice_requested: boolean;
  invoice_no: string;
  reviewed_by: string;
  review_remark: string;
  created_at: string | null;
  processed_at: string | null;
}

export interface UsageLogItem {
  id: number;
  resource_type: string;
  resource_type_display: string;
  endpoint: string;
  method: string;
  quantity: number;
  cost: string;
  request_id: string;
  response_time_ms: number;
  status_code: number;
  ip_address: string | null;
  api_key_name: string | null;
  member_username: string | null;
  created_at: string | null;
}

export interface DashboardData {
  overview: {
    balance: string;
    api_calls_used: number;
    api_calls_limit: number;
    api_usage_pct: number;
    member_count: number;
    members_limit: number;
    active_keys: number;
  };
  today: Record<string, { calls: number; quantity: number; cost: string }>;
  month: Record<string, { calls: number; quantity: number; cost: string }>;
  daily_trend: Array<{ date: string; calls: number; cost: string }>;
  top_endpoints: Array<{ endpoint: string; method: string; calls: number; avg_ms: number }>;
  active_members: Array<{ username: string; role: string; role_display: string; last_login: string | null }>;
  recent_logs: UsageLogItem[];
}

export interface CopyrightApp {
  id: number;
  software_name: string;
  software_type: string;
  software_type_display: string;
  version: string;
  status: string;
  status_display: string;
  applicant_name: string;
  lines_of_code: number;
  tech_stack: string;
  development_start_date: string | null;
  registration_number: string;
  certificate_number: string;
  submit_to: string;
  created_at: string | null;
  updated_at: string | null;
}

const BASE = '/api/enterprise';

export const enterpriseApi = {
  getMyEnterprise() {
    return request.get<EnterpriseInfo>(BASE + '/my-enterprise');
  },

  getDashboard() {
    return request.get<DashboardData>(BASE + '/dashboard');
  },

  createEnterprise(data: { name: string; company_name?: string; plan_type?: string; contact_person?: string }) {
    return request.post(BASE + '/create', data);
  },

  listMembers(params?: { role?: string }) {
    return request.get<{ data: EnterpriseMember[]; total: number }>(BASE + '/members/list', { params });
  },

  addMember(data: { username: string; role?: string; department?: string; position?: string }) {
    return request.post(BASE + '/members/add', data);
  },

  removeMember(data: { member_id: number }) {
    return request.post(BASE + '/members/remove', data);
  },

  updateMemberRole(data: { member_id: number; role: string }) {
    return request.post(BASE + '/members/role', data);
  },

  listApiKeys() {
    return request.get<{ data: EnterpriseApiKeyDetail[]; total: number }>(BASE + '/keys/list');
  },

  createApiKey(data: { name: string; key_type?: string; rate_limit?: number; daily_quota?: number; monthly_quota?: number }) {
    return request.post<{ data: { key_id: number; name: string; key: string; key_preview: string; key_type: string } }>(BASE + '/keys/create', data);
  },

  revokeApiKey(data: { key_id: number }) {
    return request.post(BASE + '/keys/revoke', data);
  },

  submitRecharge(data: { amount: string | number; recharge_type?: string; payment_method?: string; invoice_requested?: boolean }) {
    return request.post(BASE + '/recharge/submit', data);
  },

  getRechargeHistory() {
    return request.get<{ data: RechargeRecord[]; total: number }>(BASE + '/recharge/history');
  },

  getUsageLogs(params?: { page?: number; page_size?: number; resource_type?: string }) {
    return request.get<{ data: UsageLogItem[]; pagination: { page: number; page_size: number; total: number } }>(BASE + '/usage/logs', { params });
  },

  listAllEnterprises(params?: { status?: string; plan_type?: string }) {
    return request.get(BASE + '/admin/enterprises', { params });
  },

  approveRecharge(data: { recharge_id: number; remark?: string }) {
    return request.post(BASE + '/admin/recharge/approve', data);
  },

  rejectRecharge(data: { recharge_id: number; remark?: string }) {
    return request.post(BASE + '/admin/recharge/reject', data);
  },

  listCopyrights(params?: { status?: string }) {
    return request.get<{ data: CopyrightApp[]; total: number }>(BASE + '/copyright/list', { params });
  },

  createCopyright(data: {
    software_name: string;
    software_type: string;
    version?: string;
    description?: string;
    tech_stack?: string;
    lines_of_code?: number;
    development_start_date?: string;
    applicant_name: string;
    submit_to?: string;
  }) {
    return request.post(BASE + '/copyright/create', data);
  },

  submitCopyright(data: { id: number }) {
    return request.post(BASE + '/copyright/submit', data);
  },
};
