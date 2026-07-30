import axios from 'axios';

const AFF_API_BASE = '/api/affiliate';

const affApi = axios.create({
  baseURL: AFF_API_BASE,
  timeout: 15000,
});

affApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = 'Bearer ' + token;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

affApi.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('[Affiliate API] Error:', error);
    return Promise.reject(error);
  }
);

export interface AffiliateDashboard {
  total_invited: number;
  active_invited: number;
  total_commission: number;
  withdrawn: number;
  pending: number;
  available: number;
  commission_rate: number;
  min_withdrawal: number;
  recent_commissions: CommissionItem[];
  recent_withdrawals: WithdrawalItem[];
  invited_users: InvitedUserItem[];
}

export interface CommissionItem {
  id: number;
  amount: number;
  rate: number;
  status: string;
  order_no: string;
  created_at: string;
}

export interface WithdrawalItem {
  id: number;
  amount: number;
  actual: number;
  status: string;
  created_at: string;
}

export interface InvitedUserItem {
  username: string;
  joined_at: string;
  total_orders: number;
  total_spent: number;
  status: string;
}

export interface InviteLinkData {
  invite_code: string;
  invite_url: string;
  short_code: string;
  qr_data: string;
}

export interface MembershipPlanItem {
  id: number;
  plan_type: string;
  plan_name: string;
  price: number;
  original_price: number;
  duration_days: number;
  vip_level: number;
  daily_limit: number;
  features: string[];
  skill_categories: string[];
  included_skills_count: number;
  is_hot: boolean;
  is_new: boolean;
  description: string;
  badge_text: string;
  badge_color: string;
}

export const getAffiliateDashboard = async (): Promise<{ success: boolean; data: AffiliateDashboard }> => {
  return affApi.get('/affiliate/dashboard/');
};

export const generateInviteLink = async (): Promise<{ success: boolean; data: InviteLinkData }> => {
  return affApi.post('/affiliate/generate-link/');
};

export const getInvitedUsers = async (page = 1, pageSize = 10): Promise<any> => {
  return affApi.get('/affiliate/invited-users/', { params: { page, page_size: pageSize } });
};

export const getCommissions = async (): Promise<any> => {
  return affApi.get('/affiliate/commissions/');
};

export const requestWithdrawal = async (amount: number, bankName = '', accountNo = '', accountHolder = ''): Promise<any> => {
  return affApi.post('/affiliate/withdraw/', {
    amount,
    bank_name: bankName,
    account_no: accountNo,
    account_holder: accountHolder,
  });
};

export const getWithdrawals = async (): Promise<any> => {
  return affApi.get('/affiliate/withdrawals/');
};

export const getMembershipPlans = async (): Promise<{ success: boolean; data: { plans: MembershipPlanItem[]; count: number } }> => {
  return affApi.get('/membership/plans/');
};

export default affApi;
