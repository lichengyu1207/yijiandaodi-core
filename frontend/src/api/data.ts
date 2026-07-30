import request from '@/utils/request';

export interface DataOverview {
  article_count: number;
  published_count: number;
  draft_count: number;
  user_count: number;
  category_count: number;
  today_login_count: number;
}

export interface ExportRecord {
  id: number;
  export_type: string;
  file_name: string;
  record_count: number;
  created_by_name: string;
  created_at: string;
}

export interface AnalysisData {
  article_trend: { date: string; count: number }[];
  article_status_dist: { name: string; value: number }[];
  user_role_dist: { name: string; value: number }[];
  login_trend: { date: string; count: number }[];
}

export interface SystemConfigItem {
  key: string;
  value: string;
  value_type: string;
  description: string;
  updated_at: string;
}

export const dataApi = {
  getOverview: (): Promise<DataOverview> => request.get('/data/overview/'),

  exportData: (type: string): Promise<ExportRecord> => request.post('/data/export/', { export_type: type }),

  getExportHistory: (): Promise<ExportRecord[]> => request.get('/data/export-history/'),

  getAnalysis: (): Promise<AnalysisData> => request.get('/data/analysis/'),

  getConfigs: (): Promise<SystemConfigItem[]> => request.get('/data/config/'),

  updateConfigs: (items: { key: string; value: string; description?: string }[]): Promise<SystemConfigItem[]> =>
    request.put('/data/config/', { items }),

  updateProfile: (data: { username?: string; email?: string; avatar?: string }): Promise<any> =>
    request.put('/data/profile/', data),
};
