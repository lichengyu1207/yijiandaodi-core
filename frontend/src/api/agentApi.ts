import request from '@/utils/request';

export interface AgentConfigItem {
  id: number;
  code: string;
  name: string;
  enabled: boolean;
  sort_order: number;
  short_desc: string;
  full_desc: string;
  icon: string;
  color: string;
  bg_color: string;
  system_prompt: string;
  welcome_msg: string;
  temperature: number;
  max_tokens: number;
  allow_summary: boolean;
  allow_analysis: boolean;
  allow_query: boolean;
  allow_export: boolean;
  timeout: number;
  retry_count: number;
  model: string;
  api_endpoint: string;
  created_at: string;
  updated_at: string;
}

export interface AgentPublicItem {
  id: number;
  code: string;
  name: string;
  enabled: boolean;
  icon: string;
  color: string;
  bg_color: string;
  short_desc: string;
  welcome_msg: string;
}

export interface ChatRequest {
  agent_code: string;
  message: string;
  session_id?: string;
}

export interface DetectRequest {
  message: string;
  scenario?: string;
  skills?: string[];
  image?: string; // Base64图片数据
  image_name?: string; // 图片文件名
}

export interface DetectAgentResult {
  agentCode: string;
  agentName: string;
  status: 'completed' | 'running' | 'failed';
  result: {
    level: 'safe' | 'warning' | 'danger';
    levelText: string;
    confidence: number;
    aiProbability: number;
    summary: string;
    details: Array<{ category: string; description: string; severity: string }>;
    recommendations: string[];
  };
  latencyMs: number;
}

export interface DetectResponse {
  sessionId: string;
  scenario: string;
  totalLatencyMs: number;
  finalResult: {
    level: 'safe' | 'warning' | 'danger';
    levelText: string;
    confidence: number;
    aiProbability: number;
    summary: string;
    details: Array<{ category: string; description: string; severity: string }>;
    recommendations: string[];
    agentAnalysis: string;
  };
  agentResults: DetectAgentResult[];
}

// SSE 事件类型
export interface SSEStartEvent {
  type: 'start';
  data: { sessionId: string; scenario: string; agents: Array<{ code: string; name: string }> };
}
export interface SSEAgentStartEvent {
  type: 'agent_start';
  data: { index: number; agentCode: string; agentName: string; totalAgents: number };
}
export interface SSEAgentCompleteEvent {
  type: 'agent_complete';
  data: DetectAgentResult;
}
export interface SSECompleteEvent {
  type: 'complete';
  data: DetectResponse;
}
export interface SSEErrorEvent {
  type: 'error';
  data: { message: string };
}
export type SSEEvent = SSEStartEvent | SSEAgentStartEvent | SSEAgentCompleteEvent | SSECompleteEvent | SSEErrorEvent;

// 会话相关
export interface SessionMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  modelUsed: string;
  latencyMs: number;
  createdAt: string;
}
export interface SessionItem {
  sessionId: string;
  title: string;
  status: string;
  messageCount: number;
  scenario: string;
  messages: SessionMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatResponse {
  reply: string;
  session_id: string;
  agent_code: string;
  timestamp: string;
  is_new_session: boolean;
}

export interface VerificationRecordItem {
  id: number;
  article_id: number;
  agent_code: string;
  agent_name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  title: string;
  summary: string;
  detail: string;
  duration_ms: number;
  result_data: any;
  operator_name?: string;
  created_at: string;
}

export const agentApi = {
  getConfigs: (params?: { page?: number; page_size?: number }): Promise<any> => {
    return request.get('/agent/configs/', { params });
  },

  getConfigDetail: (id: number): Promise<AgentConfigItem> => {
    return request.get(`/agent/configs/${id}/`);
  },

  updateConfig: (id: number, data: Partial<AgentConfigItem>): Promise<any> => {
    return request.put(`/agent/configs/${id}/`, data);
  },

  batchUpdateConfigs: (configs: Partial<AgentConfigItem>[]): Promise<any> => {
    return request.post('/agent/configs/batch_update/', { configs });
  },

  getPublicConfigs: (): Promise<AgentPublicItem[]> => {
    return request.get('/agent/public/configs/');
  },

  sendMessage: (data: ChatRequest): Promise<ChatResponse> => {
    return request.post('/agent/public/chat/', data);
  },

  detect: (data: DetectRequest): Promise<DetectResponse> => {
    return request.post('/agent/public/detect/', data, { timeout: 120000 });
  },

  /**
   * SSE流式检测 — 返回 AsyncIterable<SSEEvent>
   * 每个Agent完成后立即推送，前端可实时渲染进度
   */
  detectStream: async function* (data: DetectRequest): AsyncGenerator<SSEEvent, void, unknown> {
    const controller = new AbortController();
    const response = await fetch('/api/agent/public/detect-stream/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      credentials: 'include',
      signal: controller.signal,
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`SSE请求失败 ${response.status}: ${errBody}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          try {
            const event: SSEEvent = JSON.parse(trimmed.slice(6));
            yield event;
          } catch {
            // 忽略解析失败的行
          }
        }
      }

      // 处理buffer中剩余的数据
      if (buffer.trim()) {
        try {
          const event: SSEEvent = JSON.parse(buffer.replace(/^data:\s*/, ''));
          yield event;
        } catch {
          // ignore
        }
      }
    } finally {
      reader.releaseLock();
    }
  },

  /** 获取会话列表 */
  getSessions: (limit?: number): Promise<{ success: boolean; data: SessionItem[] }> => {
    return request.get('/agent/public/sessions/', { params: { limit: limit || 20 } });
  },

  getVerificationRecords: (articleId: number): Promise<VerificationRecordItem[]> => {
    return request.get('/agent/verification/', { params: { article_id: articleId } });
  },

  triggerVerification: (articleId: number, agentCode: string): Promise<any> => {
    return request.post('/agent/verification/', { article_id: articleId, agent_code: agentCode });
  },
};
