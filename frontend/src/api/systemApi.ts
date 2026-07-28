import request from '@/utils/request';

export interface PrivacyAgreementItem {
  id: number;
  title: string;
  agreement_type: string;
  agreement_type_display: string;
  content: string;
  version: string;
  is_active: boolean;
  is_required: boolean;
  effective_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConsentRecord {
  id: number;
  user_id: number | string;
  username: string;
  agreement_type: string;
  agreement_version: string;
  status: 'agreed' | 'declined' | 'pending';
  status_display: string;
  consented_at: string;
}

export interface IMMessageItem {
  id: number;
  session_id: string;
  sender_type: 'user' | 'agent' | 'system' | 'auto_reply';
  sender_type_display: string;
  user_id: number | null;
  message_type: string;
  content: string;
  file_url: string;
  is_read: boolean;
  created_at: string;
}

export interface AutoReplyItem {
  id: number;
  trigger_type: string;
  trigger_type_display: string;
  keyword: string;
  reply_content: string;
  priority: number;
  is_enabled: boolean;
  match_count: number;
  created_at: string;
}

export const systemApi = {

  getActiveAgreements: () =>
    request.get('/system/privacy/active/', { skipAuth: true }),

  getAgreements: (params?: { agreement_type?: string; is_active?: string }) =>
    request.get('/system/privacy/', { params }),

  createAgreement: (data: Partial<PrivacyAgreementItem>) =>
    request.post('/system/privacy/', data),

  updateAgreement: (id: number, data: Partial<PrivacyAgreementItem>) =>
    request.put(`/system/privacy/${id}/`, data),

  deleteAgreement: (id: number) =>
    request.delete(`/system/privacy/${id}/`),

  submitConsent: (data: { user_id: number | string; username?: string; agreement_type: string; agreement_version: string; status: 'agreed' | 'declined' }) =>
    request.post('/system/privacy/consent/', data),

  checkConsent: (params: { user_id: string | number; agreement_type?: string }) =>
    request.get('/system/privacy/check_consent/', { params }),

  getConsentRecords: (params?: { page?: number; page_size?: number }) =>
    request.get('/api/rbac/operation-logs/', { params }),

  sendIMMessage: (data: { session_id?: string; content: string; message_type?: string; file_url?: string }) =>
    request.post('/system/im-messages/send/', data),

  getIMHistory: (params: { session_id: string; limit?: number }) =>
    request.get('/system/im-messages/history/', { params }),

  getIMSessions: () =>
    request.get('/system/im-messages/sessions/'),

  getAdminIMMessages: (params?: { page?: number; page_size?: number; sender_type?: string; session_id?: string; keyword?: string }) =>
    request.get('/system/im-messages/admin_messages/', { params }),

  markIMRead: (data: { session_id?: string; ids?: number[] }) =>
    request.post('/system/im-messages/mark_read/', data),

  getAutoReplies: (params?: { trigger_type?: string }) =>
    request.get('/system/auto-replies/', { params }),

  createAutoReply: (data: Partial<AutoReplyItem>) =>
    request.post('/system/auto-replies/', data),

  updateAutoReply: (id: number, data: Partial<AutoReplyItem>) =>
    request.put(`/system/auto-replies/${id}/`, data),

  deleteAutoReply: (id: number) =>
    request.delete(`/system/auto-replies/${id}/`),

  getVoiceConfig: () =>
    request.get('/system/voice/config/'),

  updateVoiceConfig: (data: Record<string, string>) =>
    request.post('/system/voice/update_config/', data),
};
