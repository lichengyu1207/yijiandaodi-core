import request from '@/utils/request';

export interface ProductItem {
  id: number;
  title: string;
  description: string;
  category: string;
  category_display: string;
  price: number;
  original_price: number;
  cover_image: string;
  images: string;
  tags: string[];
  is_hot: boolean;
  is_recommend: boolean;
  stock: number;
  sales_count: number;
  view_count: number;
  status: string;
  status_display: string;
  created_by: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: number;
  order_no: string;
  user_id: number;
  total_amount: number;
  pay_amount: number;
  status: string;
  status_display: string;
  pay_method: string;
  pay_time: string | null;
  shipping_info: string;
  remark: string;
  items: Array<{
    product_id: number;
    title: string;
    price: number;
    quantity: number;
  }>;
  created_at: string;
  updated_at: string;
}

export interface PaymentRecordItem {
  id: number;
  order_id: number;
  order_no: string;
  amount: number;
  pay_method: string;
  trade_no: string;
  status: string;
  status_display: string;
  created_at: string;
}

export interface WithdrawalRecordItem {
  id: number;
  user_id: number;
  amount: number;
  method: string;
  account: string;
  status: string;
  status_display: string;
  remark: string;
  handled_by: number | null;
  handled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface HotTemplateItem {
  id: number;
  title: string;
  description: string;
  category: string;
  cover_image: string;
  preview_url: string;
  download_count: number;
  use_count: number;
  is_trending: boolean;
  tags: string[];
  created_at: string;
}

export const mallApi = {
  getProducts: (params?: Record<string, any>) =>
    request.get('/mall/mall-products/', { params }),
  getProductDetail: (id: number | string) =>
    request.get('/mall/mall-products/' + id + '/'),
  createProduct: (data: Partial<ProductItem>) =>
    request.post('/mall/mall-products/', data),
  updateProduct: (id: number | string, data: Partial<ProductItem>) =>
    request.put('/mall/mall-products/' + id + '/', data),
  deleteProduct: (id: number | string) =>
    request.delete('/mall/mall-products/' + id + '/'),
  getMyProducts: (params?: Record<string, any>) =>
    request.get('/mall/mall-products/my-products/', { params }),
  getHotProducts: () =>
    request.get('/mall/mall-products/hot-products/', { skipAuth: true } as any),
  getCategories: () =>
    request.get('/mall/mall-products/categories/', { skipAuth: true } as any),
  toggleProductStatus: (id: number | string, status: string) =>
    request.post('/mall/mall-products/toggle-status/', { product_id: id }),

  getOrders: (params?: Record<string, any>) =>
    request.get('/mall/mall-orders/', { params }),
  getOrderDetail: (id: number | string) =>
    request.get('/mall/mall-orders/' + id + '/'),
  createOrder: (data: { items: Array<{ product_id: number; quantity: number }>; remark?: string }) =>
    request.post('/mall/mall-orders/create-order/', data),
  cancelOrder: (id: number | string) =>
    request.post('/mall/mall-orders/cancel/', { order_id: id }),
  getMyOrders: (params?: Record<string, any>) =>
    request.get('/mall/mall-orders/my-orders/', { params }),
  getOrderStats: () =>
    request.get('/mall/mall-orders/stats/'),

  createPayment: (data: { order_id: number; pay_method: string }) =>
    request.post('/mall/mall-payments/create-payment/', data),
  paymentCallback: (data: Record<string, any>) =>
    request.post('/mall/mall-payments/callback/', data),
  getMyPayments: (params?: Record<string, any>) =>
    request.get('/mall/mall-payments/my-payments/', { params }),

  applyWithdrawal: (data: { amount: number; method: string; account: string; remark?: string }) =>
    request.post('/mall/mall-withdrawals/apply/', data),
  getMyWithdrawals: (params?: Record<string, any>) =>
    request.get('/mall/mall-withdrawals/my-withdrawals/', { params }),
  getAdminWithdrawals: (params?: Record<string, any>) =>
    request.get('/mall/mall-withdrawals/admin-list/', { params }),
  handleWithdrawal: (data: { withdrawal_id: number; action: string; remark?: string }) =>
    request.post('/mall/mall-withdrawals/handle/', data),

  getTemplates: (params?: Record<string, any>) =>
    request.get('/mall/hot-templates/', { params }),
  getTemplateDetail: (id: number | string) =>
    request.get('/mall/hot-templates/' + id + '/'),
  getTrendingTemplates: () =>
    request.get('/mall/hot-templates/trending/', { skipAuth: true } as any),
  useTemplate: (id: number | string) =>
    request.get('/mall/hot-templates/' + id + '/use-template/'),
};
