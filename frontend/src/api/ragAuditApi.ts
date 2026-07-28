import request from '@/utils/request';

export interface RAGOpLogItem {
  id: number;
  action: string;
  action_display: string;
  target_type: string;
  target_id: number;
  target_name: string;
  username: string;
  ip_address: string;
  status: string;
  status_display: string;
  error_message: string;
  duration_ms: number;
  request_detail: any;
  created_at: string;
}

export interface RAGOpLogStats {
  total: number;
  today: number;
  success: number;
  failed: number;
  by_action: Record<string, number>;
  by_status: Record<string, number>;
  recent_7_days: { date: string; count: number }[];
}

export const ragAuditApi = {
  getLogs: (params?: { action?: string; status?: string; target_type?: string; search?: string; page?: number; page_size?: number }) =>
    request.get('/rag/operation-logs/', { params }),

  getStatistics: () =>
    request.get('/rag/operation-logs/statistics/'),
};
