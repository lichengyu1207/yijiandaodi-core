/**
 * 平台核心能力 API 客户端
 * ============================
 * 基于 OpenRath Runtime 驱动的统一能力调用接口
 *
 * API 前缀: /api/platform/v1/capabilities/
 * 文档: https://docs.openrath.com/
 */

import axios from 'axios';

const request = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

// ====== 类型定义 ======

export interface PlatformCapability {
  id: string;
  name: string;
  nameEn: string;
  category: string;
  version: string;
  description: string;
  method: string;
  endpoint: string | null;
  hasStreamEndpoint?: boolean;
  inputSchema: Record<string, any>;
  outputSchema: Record<string, any>;
}

export interface CapabilityListResponse {
  success: boolean;
  message?: string;
  data: {
    total: number;
    categories: Record<string, number>;
    capabilities: PlatformCapability[];
    _docs?: {
      github: string;
      docs: string;
      openapi?: string;
    };
  };
}

export interface CallAgentRequest {
  agent_code: 'auditor' | 'verifier' | 'archiver' | 'judge';
  message: string;
  scenario?: string;
  extra_context?: string;
}

export interface CallAgentResponse {
  success: boolean;
  message: string;
  data: {
    reply: string;
    sessionId: string;
    latencyMs: number;
    agentCode: string;
    agentName: string;
    scenario: string;
    usage: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
    lineage: Record<string, any>;
  };
}

export interface DetectResponse {
  success: boolean;
  message: string;
  source: string;
  data: {
    sessionId: string;
    scenario: string;
    totalLatencyMs: number;
    finalResult: Record<string, any>;
    agentResults: Array<Record<string, any>>;
    graphInfo?: Record<string, any>;
  };
}

export interface CompressRequest {
  messages: Array<{ role: string; content: string }>;
  max_tokens?: number;
  keep_recent?: number;
}

export interface CompressResponse {
  success: boolean;
  data: {
    originalCount: number;
    compressedCount: number;
    compressionRatio: number;
    compressedMessages: Array<{ role: string; content: string }>;
    lineage: Record<string, any>;
  };
}

export interface OpenRathInfoResponse {
  success: boolean;
  data: {
    adapterVersion: string;
    officialVersion: string;
    license: string;
    source: string;
    docs: string;
    pypi: string;
    coreModules: string[];
    availableAgents: string[];
    availableScenarios: string[];
    capabilityCount: number;
    agentCount: number;
    pythonCompat: string;
  };
}

// ====== API 方法 ======

export const platformApi = {
  /**
   * 获取所有平台能力列表（含 Schema）
   * GET /api/platform/v1/capabilities/
   */
  getCapabilities(): Promise<CapabilityListResponse> {
    return request.get('/platform/v1/capabilities/');
  },

  /**
   * 获取单个能力详情 + 调用示例
   * GET /api/platform/v1/capabilities/{id}/
   */
  getCapabilityDetail(id: string): Promise<any> {
    return request.get(`/platform/v1/capabilities/${id}/`);
  },

  /**
   * 调用单个 Agent
   * POST /api/platform/v1/capabilities/call-agent/
   */
  callAgent(data: CallAgentRequest): Promise<CallAgentResponse> {
    return request.post('/platform/v1/capabilities/call-agent/', data, { timeout: 120000 });
  },

  /**
   * 触发四Agent完整检测（通过平台API）
   * POST /api/platform/v1/capabilities/detect/
   */
  detect(data: { message: string; scenario?: string; skills?: string[] }): Promise<DetectResponse> {
    return request.post('/platform/v1/capabilities/detect/', data, { timeout: 120000 });
  },

  /**
   * 上下文智能压缩
   * POST /api/platform/v1/capabilities/compress/
   */
  compress(data: CompressRequest): Promise<CompressResponse> {
    return request.post('/platform/v1/capabilities/compress/', data, { timeout: 60000 });
  },

  /**
   * OpenRath 运行时信息
   * GET /api/platform/v1/capabilities/openrath-info/?action=stats|list_agents|graph_info
   */
  getOpenRathInfo(action: string = 'stats'): Promise<OpenRathInfoResponse> {
    return request.get(`/platform/v1/capabilities/openrath-info/?action=${action}`);
  },
};

export default platformApi;
