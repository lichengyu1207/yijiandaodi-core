import axios from 'axios';

const PAY_API_BASE = '/api/payment';
const AFF_API_BASE = '/api/affiliate';

const payApi = axios.create({
  baseURL: PAY_API_BASE,
  timeout: 15000,
});

payApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = 'Bearer ' + token;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

payApi.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('[Payment API] Error:', error);
    return Promise.reject(error);
  }
);

export interface HotSkillItem {
  id: number;
  name: string;
  category: string;
  main_scenario: string;
  keywords: string[];
  tier: string;
  icon_name: string;
  icon_color: string;
  weight: number;
  dev_days: number;
  monetization_type: string;
  is_hot: boolean;
  is_new: boolean;
  is_recommended: boolean;
  usage_count: number;
  hotness: number;
  rank: number;
  trend: number;
  click_count: number;
  execute_count: number;
}

export interface UserQuotaData {
  is_authenticated: boolean;
  free_remaining: number;
  free_limit: number;
  free_used_today: number;
  is_vip: boolean;
  vip_level: number;
  vip_expire_at?: string | null;
  total_paid_uses: number;
  total_free_uses: number;
}

export interface OrderItem {
  id: number;
  order_no: string;
  order_type: string;
  type_display: string;
  status: string;
  status_display: string;
  amount: number;
  subject: string;
  pay_channel: string;
  paid_at?: string | null;
  created_at?: string | null;
}

export const getTopHotSkills = async (limit: number = 9): Promise<{ success: boolean; data: { items: HotSkillItem[]; count: number; hour_key: string } }> => {
  return payApi.get('/hotness/top-skills/', { params: { limit } });
};

export const refreshHotness = async () => {
  return payApi.post('/hotness/refresh-hotness/');
};

export const getUserQuota = async (): Promise<{ success: boolean; data: UserQuotaData }> => {
  return payApi.get('/quota/');
};

export const useQuota = async (useType: string = 'free') => {
  return payApi.post('/use-quota/', { use_type: useType });
};

export const createOrder = async (orderType: string, couponCode?: string): Promise<{ success: boolean; data: any }> => {
  const data: any = { order_type: orderType };
  if (couponCode) data.coupon_code = couponCode;
  return payApi.post('/create-order/', data);
};

export interface FirstOrderPromoInfo {
  id: number;
  name: string;
  discount_type: string;
  discount_value: number;
  max_discount: number;
  min_order_amount: number;
  applicable_types: string[];
  start_time: string;
  end_time: string;
  status: string;
  extra_config: {
    banner_text: string;
    subtext: string;
    badge_text: string;
    bg_color: string;
    border_color: string;
    accent_color: string;
  };
  user_can_claim: boolean;
  user_has_claimed: boolean;
  user_coupon_code?: string;
  remaining_count?: number;
}

export const getFirstOrderPromo = async (): Promise<{ success: boolean; data: FirstOrderPromoInfo | null }> => {
  return payApi.get('/first-order-promo/');
};

export const claimFirstOrderCoupon = async (): Promise<{ success: boolean; data: any }> => {
  return payApi.post('/claim-first-order-coupon/');
};

export const applyFirstOrderDiscount = async (orderType: string): Promise<{ success: boolean; data: any }> => {
  return payApi.post('/apply-first-order-discount/', { order_type: orderType });
};

export const mockPay = async (orderNo: string): Promise<{ success: boolean; data: any }> => {
  return payApi.post('/mock-pay/', { order_no: orderNo });
};

// ===== 支付宝真实支付接口 =====

export interface AlipayPagePayRequest {
  order_no: string;
}

export interface AlipayPagePayResponse {
  success: boolean;
  data?: {
    order_no: string;
    amount: number;
    payment_html: string;  // HTML 表单字符串，需渲染并自动提交
    pay_channel: 'alipay_page';
  };
  message?: string;
  fallback_mock?: boolean;  // SDK 未安装时回退到 mock
}

/** 电脑网站支付 — PC 端浏览器跳转支付宝收银台 */
export const alipayPagePay = async (orderNo: string): Promise<AlipayPagePayResponse> => {
  return payApi.post('/alipay-page-pay/', { order_no: orderNo });
};

/** 手机网站支付 — 移动端浏览器唤起支付宝 App 或 WAP 收银台 */
export const alipayWapPay = async (orderNo: string): Promise<AlipayPagePayResponse> => {
  return payApi.post('/alipay-wap-pay/', { order_no: orderNo });
};

export interface AlipayQueryResponse {
  success: boolean;
  data?: {
    success: boolean;
    code: string;
    trade_status: string;
    trade_no: string;
    out_trade_no: string;
    total_amount: string;
    buyer_logon_id: string;
  };
}

/** 查询支付宝交易状态 */
export const alipayQuery = async (orderNo: string): Promise<AlipayQueryResponse> => {
  return payApi.post('/alipay-query/', { order_no: orderNo });
};

export interface AlipayRefundRequest {
  order_no: string;
  refund_amount: string;
  refund_reason?: string;
}

/** 支付宝退款 */
export const alipayRefund = async (data: AlipayRefundRequest) => {
  return payApi.post('/alipay-refund/', data);
};

/**
 * 渲染支付宝支付表单并自动提交
 * ⚠️ 必须将 HTML 表单渲染到页面并自动提交，禁止直接用 URL 跳转
 */
export const submitAlipayForm = (htmlForm: string): void => {
  const container = document.createElement('div');
  container.innerHTML = htmlForm;
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '100%';
  container.style.height = '100%';
  container.style.zIndex = '99999';
  container.style.background = 'white';
  document.body.appendChild(container);
  const form = container.querySelector('form') as HTMLFormElement | null;
  if (form) {
    form.submit();
  } else {
    console.error('[Alipay] No form found in payment HTML');
    document.body.removeChild(container);
  }
};

/** 检测是否为移动端设备（用于选择 page_pay 或 wap_pay） */
export const isMobileDevice = (): boolean => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

export const getMyOrders = async (): Promise<{ success: boolean; data: { orders: OrderItem[]; count: number } }> => {
  return payApi.get('/my-orders/');
};

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

const affApi = axios.create({
  baseURL: AFF_API_BASE,
  timeout: 15000,
});

affApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = 'Bearer ' + token;
    return config;
  },
  (error) => Promise.reject(error)
);

affApi.interceptors.response.use(
  (response) => response.data,
  (error) => Promise.reject(error)
);

export const getMembershipPlans = async (): Promise<{ success: boolean; data: { plans: MembershipPlanItem[]; count: number } }> => {
  return affApi.get('/membership/plans/');
};

const mallApi = axios.create({
  baseURL: '/api/mall',
  timeout: 15000,
});

mallApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = 'Bearer ' + token;
    return config;
  },
  (error) => Promise.reject(error)
);

mallApi.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('[Mall API] Error:', error);
    return Promise.reject(error);
  }
);

const statsApi = axios.create({
  baseURL: '/api/stats',
  timeout: 15000,
});

statsApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = 'Bearer ' + token;
    return config;
  },
  (error) => Promise.reject(error)
);

statsApi.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('[Stats API] Error:', error);
    return Promise.reject(error);
  }
);

export interface DigitalProduct {
  id: number;
  title: string;
  description: string;
  category: string;
  price: number;
  original_price?: number;
  cover_image: string;
  images: string[];
  tags: string[];
  is_hot: boolean;
  is_recommend: boolean;
  sales_count: number;
  view_count: number;
  status: string;
}

export const getDigitalProducts = async (params?: { category?: string; is_hot?: string }) => {
  return mallApi.get('/mall-products/hot-products/', { params });
};

export interface UserFeedbackInput {
  rating: number;
  feedback_type?: string;
  content?: string;
  session_id?: string;
  agent_response_time_ms?: number;
  query_text?: string;
  agent_answer_preview?: string;
}

export const submitFeedback = async (data: UserFeedbackInput) => {
  return mallApi.post('/feedback/', data);
};

export const getMyFeedbacks = async () => {
  return mallApi.get('/feedback/my/');
};

export const getRevenueDetail = async () => {
  return statsApi.get('/revenue-detail/');
};

export interface BusinessInquiryInput {
  inquiry_type: 'enterprise_rag' | 'enterprise_agent' | 'ad_cooperation' | 'kol_cooperation';
  company?: string;
  contact_name: string;
  phone?: string;
  email?: string;
  requirement?: string;
  ad_type?: string;
  budget?: string;
  kol_target?: string;
  platform?: string;
  followers?: string;
  cooperation_intent?: string;
}

export const submitBusinessInquiry = async (data: BusinessInquiryInput) => {
  return mallApi.post('/inquiries/', data);
};

export const getCourses = async () => {
  return mallApi.get('/mall-products/courses/');
};

export default payApi;
