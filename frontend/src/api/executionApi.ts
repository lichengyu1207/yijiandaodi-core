import request from '@/utils/request';

export interface ExecuteRequest {
  workflow_type: 'code_audit' | 'content_verify' | 'ai_execute';
  input_content: string;
  security_level?: 'normal' | 'high' | 'critical';
  priority?: 'normal' | 'high' | 'critical';
}

export interface PipelineStageResult {
  stage: string;
  stage_name: string;
  status: 'pending' | 'running' | 'completed' | 'warning' | 'error';
  duration_ms: number;
  summary: string;
  details?: object;
  timestamp: string;
}

export interface ExecutionResponse {
  task_id: string;
  status: string;
  stages: PipelineStageResult[];
  result?: object;
  total_duration_ms: number;
  created_at: string;
}

export interface ExecutionSummary {
  pending_count: number;
  running_count: number;
  completed_today: number;
  avg_duration_ms: number;
  success_rate: number;
}

export const executionApi = {
  submit: (data: ExecuteRequest): Promise<ExecutionResponse> => {
    return request.post('/api/p2p/v1/pipeline/execute/', data);
  },

  getStatus: (taskId: string): Promise<ExecutionResponse> => {
    return request.get(`/api/p2p/v1/pipeline/status/${taskId}/`);
  },

  getSummary: (): Promise<ExecutionSummary> => {
    return request.get('/api/p2p/v1/pipeline/summary/');
  },

  getList: (params?: { status?: string; page?: number; page_size?: number }): Promise<any> => {
    return request.get('/api/p2p/v1/pipeline/tasks/', { params });
  },

  cancel: (taskId: string): Promise<any> => {
    return request.post(`/api/p2p/v1/pipeline/cancel/${taskId}/`);
  },

  getAuditLogs: (taskId: string): Promise<any> => {
    return request.get(`/api/p2p/v1/pipeline/audit/${taskId}/`);
  },
};
