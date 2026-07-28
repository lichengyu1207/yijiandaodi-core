import axios from 'axios';

const BANNER_API_BASE = '/api/content/banners';
const bannerApi = axios.create({ baseURL: BANNER_API_BASE, timeout: 15000 });

bannerApi.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = 'Bearer ' + token;
  return config;
}, error => Promise.reject(error));

bannerApi.interceptors.response.use(response => response.data, error => {
  console.error('[Banner API] Error:', error);
  return Promise.reject(error);
});

export interface BannerItem {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  image_url: string;
  link_url: string;
  link_type: string;
  bg_color: string;
  category_tag: string;
  sort_order: number;
  status: string;
  click_count: number;
  created_at: string;
  updated_at: string;
}

export const getPublicBanners = async () => {
  return bannerApi.get('/public/');
};

export const getAdminBannerList = async () => {
  return bannerApi.get('/');
};

export const createBanner = async (data: Partial<BannerItem>) => {
  return bannerApi.post('/', data);
};

export const updateBanner = async (id: number, data: Partial<BannerItem>) => {
  return bannerApi.put(`/${id}/`, data);
};

export const deleteBanner = async (id: number) => {
  return bannerApi.delete(`/${id}/`);
};

export default bannerApi;