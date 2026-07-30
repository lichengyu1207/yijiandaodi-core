import axios from 'axios';

const SKILL_API_BASE = '/api/skill-config';

const skillApi = axios.create({
  baseURL: SKILL_API_BASE,
  timeout: 15000,
});

skillApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = 'Bearer ' + token;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

skillApi.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('[SkillConfig API] Error:', error);
    return Promise.reject(error);
  }
);

export interface SkillConfigItem {
  id: number;
  name: string;
  category: string;
  main_scenario: string;
  keywords: string[];
  weight: number;
  dev_days: number;
  monetization_type: string;
  tier: string;
  icon_name: string;
  icon_color: string;
  description: string;
  status: string;
  is_recommended: boolean;
  is_hot: boolean;
  is_new: boolean;
  usage_count: number;
  tier_label?: string;
  monetization_label?: string;
  status_label?: string;
  created_at?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  count: number;
  total_pages: number;
  current_page: number;
  has_next: boolean;
  has_previous: boolean;
  results: T[];
}

export interface CategoriesResponse {
  tiers: { key: string; label: string; count: number; total_weight: number }[];
  categories: string[];
  scenarios: string[];
  monetization_types: string[];
  total_skills: number;
}

export interface StatsResponse {
  total: number;
  online: number;
  by_tier: { tier: string; count: number }[];
  by_monetization: { monetization_type: string; count: number }[];
}

export interface SearchParams {
  q?: string;
  tier?: string;
  category?: string;
  scenario?: string;
  monetization?: string;
  recommended?: string;
  hot?: string;
  new?: string;
  page?: number;
  page_size?: number;
}

export const getPublicSkillList = async (params?: { page?: number; page_size?: number }): Promise<PaginatedResponse<SkillConfigItem>> => {
  const res = await skillApi.get('/public-list/', { params: { page: params?.page || 1, page_size: params?.page_size || 20 } });
  return res.data as unknown as PaginatedResponse<SkillConfigItem>;
};

export const searchSkills = async (searchParams: SearchParams): Promise<PaginatedResponse<SkillConfigItem>> => {
  const res = await skillApi.get('/public-search/', { params: { ...searchParams, page: searchParams.page || 1 } });
  return res.data as unknown as PaginatedResponse<SkillConfigItem>;
};

export const getSkillCategories = async (): Promise<{ success: boolean; data: CategoriesResponse }> => {
  return skillApi.get('/categories/');
};

export const getSkillStats = async (): Promise<{ success: boolean; data: StatsResponse }> => {
  return skillApi.get('/stats/');
};

export const getSkillDetail = async (id: number): Promise<{ success: boolean; data: SkillConfigItem }> => {
  return skillApi.get('/' + id + '/');
};

export const batchImportSkills = async (skills: object[], overwrite: boolean = false) => {
  const token = localStorage.getItem('token');
  return axios.post(SKILL_API_BASE + '/batch-import/', { skills, overwrite }, {
    headers: { Authorization: 'Bearer ' + (token || '') },
    timeout: 30000,
  }).then((res) => res.data);
};

export const getAdminSkillList = async (params?: {page?: number; page_size?: number; status?: string}): Promise<any> => {
  return skillApi.get('/admin/', { params });
};
export const createSkill = async (data: Partial<SkillConfigItem>): Promise<any> => {
  return skillApi.post('/admin/', data);
};
export const updateSkill = async (id: number, data: Partial<SkillConfigItem>): Promise<any> => {
  return skillApi.put(`/admin/${id}/`, data);
};
export const deleteSkill = async (id: number): Promise<any> => {
  return skillApi.delete(`/admin/${id}/`);
};
export const toggleSkillStatus = async (id: number, status: string): Promise<any> => {
  return skillApi.post(`/admin/${id}/toggle-status/`, { status });
};
export const batchToggleSkills = async (ids: number[], status: string): Promise<any> => {
  return skillApi.post('/admin/batch-toggle/', { ids, status });
};
export const batchDeleteSkills = async (ids: number[]): Promise<any> => {
  return skillApi.delete('/admin/batch-delete/', { data: { ids } });
};

export default skillApi;
