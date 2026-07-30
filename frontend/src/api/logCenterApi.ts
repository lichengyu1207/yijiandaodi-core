import request from '@/utils/request';

export const logCenterApi = {
  getLoginLogs: (params?: Record<string, any>) =>
    request.get('/log-center/login-logs/', { params }),

  exportLoginLogs: (params?: Record<string, any>) =>
    request.get('/log-center/login-logs/export/', { params, responseType: 'blob' }),

  getOperationLogs: (params?: Record<string, any>) =>
    request.get('/log-center/operation-logs/', { params }),

  exportOperationLogs: (params?: Record<string, any>) =>
    request.get('/log-center/operation-logs/export/', { params, responseType: 'blob' }),

  getPermissionIntercepts: (params?: Record<string, any>) =>
    request.get('/log-center/permission-intercepts/', { params }),

  exportPermissionIntercepts: (params?: Record<string, any>) =>
    request.get('/log-center/permission-intercepts/export/', { params, responseType: 'blob' }),
};

export const systemManageApi = {
  getFrontendUsers: (params?: Record<string, any>) =>
    request.get('/system-manage/frontend-users/', { params }),

  banUser: (id: number, reason: string) =>
    request.post(`/system-manage/frontend-users/${id}/ban/`, { reason }),

  unbanUser: (id: number) =>
    request.post(`/system-manage/frontend-users/${id}/unban/`),

  resetUserInfo: (id: number, data: Record<string, any>) =>
    request.post(`/system-manage/frontend-users/${id}/reset-info/`, data),

  getUserBrowseRecords: (userId: number) =>
    request.get(`/system-manage/frontend-users/${userId}/browse-records/`),

  getFrontendUserStats: () =>
    request.get('/system-manage/frontend-users/stats/'),

  getSecurityConfigs: () =>
    request.get('/system-manage/security-configs/'),

  updateSecurityConfig: (configKey: string, configValue: string) =>
    request.put('/system-manage/security-configs/update-config/', { config_key: configKey, config_value: configValue }),

  refreshCache: () =>
    request.post('/system-manage/security-configs/refresh-cache/'),

  cleanupLogs: (days?: number) =>
    request.post('/system-manage/security-configs/cleanup-logs/', { days: days || 90 }),
};

export const functionCardApi = {
  getFunctionCards: (params?: Record<string, any>) =>
    request.get('/function-cards/function-cards/', { params }),

  createFunctionCard: (data: Record<string, any>) =>
    request.post('/function-cards/function-cards/', data),

  updateFunctionCard: (id: number, data: Record<string, any>) =>
    request.put(`/function-cards/function-cards/${id}/`, data),

  deleteFunctionCard: (id: number) =>
    request.delete(`/function-cards/function-cards/${id}/`),

  toggleCardStatus: (id: number) =>
    request.post(`/function-cards/function-cards/${id}/toggle-status/`),

  getKnowledgeBases: () =>
    request.get('/knowledge-bases/knowledge-bases/'),

  getPublicCards: () =>
    request.get('/function-cards/function-cards/public-cards/'),
};

export const identifyApi = {
  // Agent 聊天接口 — 复用现有Agent接口传入场景化Prompt
  agentChat: (agentCode: string, message: string) =>
    request.post('/api/agent/public/chat/', { agent_code: agentCode, message }),

  // Agent 聊天接口（支持附件）- 新增附件上传能力
  agentChatWithAttachments: (agentCode: string, message: string, attachments?: File[]) => {
    const formData = new FormData();
    formData.append('agent_code', agentCode);
    formData.append('message', message);
    
    // 添加附件
    if (attachments && attachments.length > 0) {
      attachments.forEach((file, index) => {
        formData.append(`attachment_${index}`, file);
      });
    }
    
    return request.post('/api/agent/public/chat/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },

  // 内容风险检测接口 — 复用现有多则规则风控接口
  checkContent: (content: string, source?: string) =>
    request.post('/api/risk-control/check/check/', { content, source: source || 'identify-modal' }),

  // 快速内容检测
  quickCheckContent: (content: string) =>
    request.post('/api/risk-control/check/quick_check/', { content }),

  // RAG 知识库问答 — 复用现有RAG接口
  ragAsk: (question: string, categorySlug?: string) =>
    request.post('/api/rag/ask/', { question, category_slug: categorySlug || 'default' }),

  // RAG 检索
  ragSearch: (query: string, categorySlug?: string) =>
    request.post('/api/rag/search/', { query, category_slug: categorySlug || 'default' }),
};
