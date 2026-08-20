/**
 * 海马体记忆系统API服务
 *
 * 功能：
 * - 短期记忆轮询同步（5秒间隔）
 * - 长期记忆缓存查询（5分钟有效期）
 * - 策略记忆自动加载（启动时同步）
 * - 离线缓存支持
 */

import { APIConfig } from '../config/apiConfig';
import { authService } from './authService';

/**
 * 生成带认证信息的请求头
 * 附带当前登录用户的 JWT token，用于访问需要认证的接口
 */
export function authHeaders(): Record<string, string> {
  const token = authService.getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// ==================== 自动刷新 + 重试 ====================

/**
 * 确保 token 有效：复用 authService 的全局单飞刷新，
 * 与 HttpClient 路径共享同一次刷新，避免并发 401 触发刷新风暴
 */
async function ensureFreshToken(): Promise<boolean> {
  console.log('[memoryApi] 请求刷新 token（尝试获取共享刷新锁）');
  const refreshed = await authService.refreshTokenGuarded();
  console.log(`[memoryApi] 共享刷新完成，结果=${refreshed}`);
  return refreshed;
}

/**
 * 带自动刷新 + 重试的 fetch：
 * - 请求自动附加当前认证头
 * - 若返回 401（access token 过期），先刷新 token（更新本地存储），
 *   成功后使用新 token 重试一次原请求
 */
async function fetchAuth(url: string, options: RequestInit = {}, retried = false): Promise<Response> {
  // 合并认证头（重试时 authHeaders() 会拿到刷新后的新 token，覆盖旧值）
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...authHeaders(),
    },
  });

  if (response.status === 401 && !retried) {
    console.warn(`[memoryApi] 请求 401（access token 可能过期），url=${url}，开始刷新`);
    const refreshed = await ensureFreshToken();
    if (refreshed) {
      console.log(`[memoryApi] 刷新成功，重试请求 url=${url}`);
      return fetchAuth(url, options, true);
    }
    console.warn(`[memoryApi] 刷新失败，url=${url} 仍返回 401（不重试）`);
  }

  return response;
}

// ==================== 类型定义 ====================

export interface ShortTermMemory {
  id: number;
  agent_id: string;
  operation_type: string;
  operation_content: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  decision: 'allow' | 'deny' | 'review';
  timestamp: string;
  expires_at: string;
  is_expired: boolean;
}

export interface LongTermMemory {
  id: number;
  agent_id: string;
  operation_type: string;
  operation_content: string;
  risk_level: string;
  decision: string;
  chain_index: number;
  prev_hash: string;
  record_hash: string;
  created_at: string;
}

export interface StrategicMemory {
  id: number;
  strategy_name: string;
  strategy_type: 'detection_rule' | 'response_policy' | 'risk_assessment' | 'behavior_constraint';
  condition: Record<string, any>;
  action: Record<string, any>;
  priority: number;
  is_active: boolean;
  version: number;
  confidence: number;
  sample_count: number;
  success_rate: number;
  effective_from: string | null;
  effective_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemoryStatistics {
  short_term: {
    total: number;
    active: number;
    expired: number;
  };
  long_term: {
    total: number;
    chain_valid: boolean;
  };
  strategic: {
    total: number;
    active: number;
    avg_confidence: number;
  };
}

// ==================== 短期记忆API ====================

export class ShortTermMemoryApi {
  private static instance: ShortTermMemoryApi;
  private syncInterval: NodeJS.Timeout | null = null;
  private onSyncCallback: ((memories: ShortTermMemory[]) => void) | null = null;

  static getInstance(): ShortTermMemoryApi {
    if (!ShortTermMemoryApi.instance) {
      ShortTermMemoryApi.instance = new ShortTermMemoryApi();
    }
    return ShortTermMemoryApi.instance;
  }

  /**
   * 开始轮询同步（5秒间隔）
   */
  startSync(callback: (memories: ShortTermMemory[]) => void): void {
    this.onSyncCallback = callback;

    // 立即执行一次
    this.sync();

    // 每5秒执行一次
    this.syncInterval = setInterval(() => {
      this.sync();
    }, 5000);

    console.log('[短期记忆] 轮询同步已启动（间隔5秒）');
  }

  /**
   * 停止轮询同步
   */
  stopSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('[短期记忆] 轮询同步已停止');
    }
  }

  /**
   * 执行同步
   */
  private async sync(): Promise<void> {
    const startTime = performance.now();

    console.log('\n[短期记忆API] 开始同步');
    console.log('[短期记忆API] 同步时间:', new Date().toISOString());

    try {
      const memories = await this.getMemories();

      const endTime = performance.now();
      const duration = (endTime - startTime).toFixed(2);

      console.log('[短期记忆API] 同步成功');
      console.log(`[短期记忆API] 数据量: ${memories.length} 条`);
      console.log(`[短期记忆API] 耗时: ${duration}ms`);

      if (this.onSyncCallback) {
        this.onSyncCallback(memories);
      }

      console.log('[短期记忆API] 回调已执行\n');
    } catch (error) {
      const endTime = performance.now();
      const duration = (endTime - startTime).toFixed(2);

      console.error('[短期记忆API] 同步失败');
      console.error('[短期记忆API] 错误:', error);
      console.error(`[短期记忆API] 耗时: ${duration}ms\n`);
    }
  }

  /**
   * 获取短期记忆列表
   */
  async getMemories(params?: {
    agent_id?: string;
    risk_level?: string;
    limit?: number;
    offset?: number;
  }): Promise<ShortTermMemory[]> {
    const apiConfig = APIConfig.getInstance();
    const baseUrl = apiConfig.getBaseURL();

    // ===== 阶段1: 请求准备 =====
    const phase1Start = performance.now();
    const queryParams = new URLSearchParams();
    if (params?.agent_id) queryParams.append('agent_id', params.agent_id);
    if (params?.risk_level) queryParams.append('risk_level', params.risk_level);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const url = `${baseUrl}/api/v1/memory/short-term/?${queryParams}`;
    const phase1End = performance.now();
    const phase1Duration = (phase1End - phase1Start).toFixed(2);

    console.log('\n[短期记忆API] ════════════════════════════════════');
    console.log(`[短期记忆API] 开始网络请求: ${new Date().toLocaleTimeString()}`);
    console.log(`[短期记忆API] URL: ${url}`);
    console.log(`[短期记忆API] 参数: ${params ? JSON.stringify(params) : '无'}`);
    console.log(`[短期记忆API] 阶段1(请求准备)耗时: ${phase1Duration}ms`);

    // ===== 阶段2: 网络请求 =====
    const phase2Start = performance.now();
    console.log(`[短期记忆API] 阶段2(网络请求)开始...`);

    const response = await fetchAuth(url, {
      method: 'GET',
      headers: authHeaders(),
    });

    const phase2End = performance.now();
    const phase2Duration = (phase2End - phase2Start).toFixed(2);

    console.log(`[短期记忆API] 阶段2(网络请求)耗时: ${phase2Duration}ms`);
    console.log(`[短期记忆API] 响应状态: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[短期记忆API] ✗ 响应错误: ${errorText}`);
      console.error(`[短期记忆API] ✗ 总耗时: ${(phase2End - phase1Start).toFixed(2)}ms`);
      throw new Error(`获取短期记忆失败: ${response.statusText}`);
    }

    // ===== 阶段3: 数据解析 =====
    const phase3Start = performance.now();
    console.log(`[短期记忆API] 阶段3(数据解析)开始...`);

    const data = await response.json();
    const results = data.results || data;

    const phase3End = performance.now();
    const phase3Duration = (phase3End - phase3Start).toFixed(2);

    console.log(`[短期记忆API] 阶段3(数据解析)耗时: ${phase3Duration}ms`);
    console.log(`[短期记忆API] 解析数据: ${results.length} 条`);

    // ===== 总耗时统计 =====
    const totalDuration = (phase3End - phase1Start).toFixed(2);
    console.log(`[短期记忆API] ✓ 总耗时: ${totalDuration}ms`);
    console.log(`[短期记忆API]   - 请求准备: ${phase1Duration}ms (${((parseFloat(phase1Duration) / parseFloat(totalDuration)) * 100).toFixed(1)}%)`);
    console.log(`[短期记忆API]   - 网络请求: ${phase2Duration}ms (${((parseFloat(phase2Duration) / parseFloat(totalDuration)) * 100).toFixed(1)}%)`);
    console.log(`[短期记忆API]   - 数据解析: ${phase3Duration}ms (${((parseFloat(phase3Duration) / parseFloat(totalDuration)) * 100).toFixed(1)}%)`);
    console.log(`[短期记忆API] ════════════════════════════════════\n`);

    return results;
  }

  /**
   * 清理过期记忆
   */
  async cleanupExpired(): Promise<{ cleaned_count: number }> {
    const apiConfig = APIConfig.getInstance();
    const baseUrl = apiConfig.getBaseURL();

    // ===== 阶段1: 请求准备 =====
    const phase1Start = performance.now();
    const url = `${baseUrl}/api/v1/memory/short-term/cleanup_expired/`;
    const phase1End = performance.now();
    const phase1Duration = (phase1End - phase1Start).toFixed(2);

    console.log('\n[短期记忆API] ════════════════════════════════════');
    console.log(`[短期记忆API] 开始清理过期记忆: ${new Date().toLocaleTimeString()}`);
    console.log(`[短期记忆API] URL: ${url}`);
    console.log(`[短期记忆API] 阶段1(请求准备)耗时: ${phase1Duration}ms`);

    // ===== 阶段2: 网络请求 =====
    const phase2Start = performance.now();
    console.log(`[短期记忆API] 阶段2(网络请求)开始...`);

    const response = await fetchAuth(url, {
      method: 'POST',
      headers: authHeaders(),
    });

    const phase2End = performance.now();
    const phase2Duration = (phase2End - phase2Start).toFixed(2);

    console.log(`[短期记忆API] 阶段2(网络请求)耗时: ${phase2Duration}ms`);
    console.log(`[短期记忆API] 响应状态: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      console.error(`[短期记忆API] ✗ 响应错误: ${response.statusText}`);
      console.error(`[短期记忆API] ✗ 总耗时: ${(phase2End - phase1Start).toFixed(2)}ms`);
      throw new Error(`清理过期记忆失败: ${response.statusText}`);
    }

    // ===== 阶段3: 数据解析 =====
    const phase3Start = performance.now();
    console.log(`[短期记忆API] 阶段3(数据解析)开始...`);

    const data = await response.json();

    const phase3End = performance.now();
    const phase3Duration = (phase3End - phase3Start).toFixed(2);

    console.log(`[短期记忆API] 阶段3(数据解析)耗时: ${phase3Duration}ms`);
    console.log(`[短期记忆API] 清理结果: ${data.cleaned_count} 条记录`);

    // ===== 总耗时统计 =====
    const totalDuration = (phase3End - phase1Start).toFixed(2);
    console.log(`[短期记忆API] ✓ 总耗时: ${totalDuration}ms`);
    console.log(`[短期记忆API]   - 请求准备: ${phase1Duration}ms (${((parseFloat(phase1Duration) / parseFloat(totalDuration)) * 100).toFixed(1)}%)`);
    console.log(`[短期记忆API]   - 网络请求: ${phase2Duration}ms (${((parseFloat(phase2Duration) / parseFloat(totalDuration)) * 100).toFixed(1)}%)`);
    console.log(`[短期记忆API]   - 数据解析: ${phase3Duration}ms (${((parseFloat(phase3Duration) / parseFloat(totalDuration)) * 100).toFixed(1)}%)`);
    console.log(`[短期记忆API] ════════════════════════════════════\n`);

    return data;
  }

  /**
   * 获取风险统计
   */
  async getRiskStatistics(): Promise<{
    low: number;
    medium: number;
    high: number;
    critical: number;
  }> {
    const apiConfig = APIConfig.getInstance();
    const baseUrl = apiConfig.getBaseURL();

    // ===== 阶段1: 请求准备 =====
    const phase1Start = performance.now();
    const url = `${baseUrl}/api/v1/memory/short-term/risk_statistics/`;
    const phase1End = performance.now();
    const phase1Duration = (phase1End - phase1Start).toFixed(2);

    console.log('\n[短期记忆API] ════════════════════════════════════');
    console.log(`[短期记忆API] 开始获取风险统计: ${new Date().toLocaleTimeString()}`);
    console.log(`[短期记忆API] URL: ${url}`);
    console.log(`[短期记忆API] 阶段1(请求准备)耗时: ${phase1Duration}ms`);

    // ===== 阶段2: 网络请求 =====
    const phase2Start = performance.now();
    console.log(`[短期记忆API] 阶段2(网络请求)开始...`);

    const response = await fetchAuth(url, {
      method: 'GET',
      headers: authHeaders(),
    });

    const phase2End = performance.now();
    const phase2Duration = (phase2End - phase2Start).toFixed(2);

    console.log(`[短期记忆API] 阶段2(网络请求)耗时: ${phase2Duration}ms`);
    console.log(`[短期记忆API] 响应状态: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      console.error(`[短期记忆API] ✗ 响应错误: ${response.statusText}`);
      console.error(`[短期记忆API] ✗ 总耗时: ${(phase2End - phase1Start).toFixed(2)}ms`);
      throw new Error(`获取风险统计失败: ${response.statusText}`);
    }

    // ===== 阶段3: 数据解析 =====
    const phase3Start = performance.now();
    console.log(`[短期记忆API] 阶段3(数据解析)开始...`);

    const data = await response.json();

    const phase3End = performance.now();
    const phase3Duration = (phase3End - phase3Start).toFixed(2);

    console.log(`[短期记忆API] 阶段3(数据解析)耗时: ${phase3Duration}ms`);
    console.log(`[短期记忆API] 风险分布:`);
    console.log(`  - 低风险: ${data.low}`);
    console.log(`  - 中风险: ${data.medium}`);
    console.log(`  - 高风险: ${data.high}`);
    console.log(`  - 严重: ${data.critical}`);

    // ===== 总耗时统计 =====
    const totalDuration = (phase3End - phase1Start).toFixed(2);
    console.log(`[短期记忆API] ✓ 总耗时: ${totalDuration}ms`);
    console.log(`[短期记忆API]   - 请求准备: ${phase1Duration}ms (${((parseFloat(phase1Duration) / parseFloat(totalDuration)) * 100).toFixed(1)}%)`);
    console.log(`[短期记忆API]   - 网络请求: ${phase2Duration}ms (${((parseFloat(phase2Duration) / parseFloat(totalDuration)) * 100).toFixed(1)}%)`);
    console.log(`[短期记忆API]   - 数据解析: ${phase3Duration}ms (${((parseFloat(phase3Duration) / parseFloat(totalDuration)) * 100).toFixed(1)}%)`);
    console.log(`[短期记忆API] ════════════════════════════════════\n`);

    return data;
  }
}

// ==================== 长期记忆API ====================

export class LongTermMemoryApi {
  private static instance: LongTermMemoryApi;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5分钟
  private syncInterval: NodeJS.Timeout | null = null;
  private onSyncCallback: ((memories: LongTermMemory[]) => void) | null = null;

  static getInstance(): LongTermMemoryApi {
    if (!LongTermMemoryApi.instance) {
      LongTermMemoryApi.instance = new LongTermMemoryApi();
    }
    return LongTermMemoryApi.instance;
  }

  /**
   * 开始轮询同步（5秒间隔）
   */
  startSync(callback: (memories: LongTermMemory[]) => void): void {
    this.onSyncCallback = callback;

    // 立即执行一次
    this.sync();

    // 每5秒执行一次
    this.syncInterval = setInterval(() => {
      this.sync();
    }, 5000);

    console.log('[长期记忆] 轮询同步已启动（间隔5秒）');
  }

  /**
   * 停止轮询同步
   */
  stopSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('[长期记忆] 轮询同步已停止');
    }
  }

  /**
   * 执行同步
   */
  private async sync(): Promise<void> {
    // ===== 阶段1: 同步开始 =====
    const phase1Start = performance.now();
    console.log('\n[长期记忆轮询] ════════════════════════════════════');
    console.log(`[长期记忆轮询] 开始同步: ${new Date().toLocaleTimeString()}`);
    console.log(`[长期记忆轮询] 阶段1(同步准备)开始...`);

    try {
      // ===== 阶段2: 数据获取 =====
      const phase2Start = performance.now();
      console.log(`[长期记忆轮询] 阶段2(数据获取)开始...`);

      // 获取长期记忆数据（不使用缓存）
      const apiConfig = APIConfig.getInstance();
      const baseUrl = apiConfig.getBaseURL();

      const queryParams = new URLSearchParams();
      queryParams.append('limit', '50');

      const response = await fetchAuth(`${baseUrl}/api/v1/memory/long-term/?${queryParams}`, {
        method: 'GET',
        headers: authHeaders(),
      });

      if (!response.ok) {
        throw new Error(`获取长期记忆失败: ${response.statusText}`);
      }

      const data = await response.json();
      const memories = data.results || data;

      const phase2End = performance.now();
      const phase2Duration = (phase2End - phase2Start).toFixed(2);

      console.log(`[长期记忆轮询] 阶段2(数据获取)耗时: ${phase2Duration}ms`);
      console.log(`[长期记忆轮询] 获取数据: ${memories.length} 条`);

      // ===== 阶段3: 回调处理 =====
      const phase3Start = performance.now();
      console.log(`[长期记忆轮询] 阶段3(回调处理)开始...`);

      if (this.onSyncCallback) {
        this.onSyncCallback(memories);
      }

      const phase3End = performance.now();
      const phase3Duration = (phase3End - phase3Start).toFixed(2);

      console.log(`[长期记忆轮询] 阶段3(回调处理)耗时: ${phase3Duration}ms`);

      // ===== 总耗时统计 =====
      const totalDuration = (phase3End - phase1Start).toFixed(2);
      console.log(`[长期记忆轮询] ✓ 同步总耗时: ${totalDuration}ms`);
      console.log(`[长期记忆轮询]   - 同步准备: 0.00ms (0.0%)`);
      console.log(`[长期记忆轮询]   - 数据获取: ${phase2Duration}ms (${((parseFloat(phase2Duration) / parseFloat(totalDuration)) * 100).toFixed(1)}%)`);
      console.log(`[长期记忆轮询]   - 回调处理: ${phase3Duration}ms (${((parseFloat(phase3Duration) / parseFloat(totalDuration)) * 100).toFixed(1)}%)`);
      console.log(`[长期记忆轮询] ════════════════════════════════════\n`);

    } catch (error) {
      console.error('[长期记忆轮询] 同步失败:', error);
      console.log(`[长期记忆轮询] ════════════════════════════════════\n`);
    }
  }

  /**
   * 获取长期记忆列表（带缓存）
   */
  async getMemories(params?: {
    agent_id?: string;
    risk_level?: string;
    start_date?: string;
    end_date?: string;
    limit?: number;
    offset?: number;
  }): Promise<LongTermMemory[]> {
    const cacheKey = `long_term_${JSON.stringify(params)}`;

    // ===== 阶段0: 缓存检查 =====
    const phase0Start = performance.now();
    const cached = this.cache.get(cacheKey);
    const phase0End = performance.now();

    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      console.log('\n[长期记忆API] ════════════════════════════════════');
      console.log(`[长期记忆API] 开始获取记忆列表: ${new Date().toLocaleTimeString()}`);
      console.log(`[长期记忆API] 使用缓存数据（有效期5分钟）`);
      console.log(`[长期记忆API] 缓存检查耗时: ${(phase0End - phase0Start).toFixed(2)}ms`);
      console.log(`[长期记忆API] ✓ 总耗时: ${(phase0End - phase0Start).toFixed(2)}ms（缓存命中）`);
      console.log(`[长期记忆API] ════════════════════════════════════\n`);
      return cached.data;
    }

    // ===== 阶段1: 请求准备 =====
    const phase1Start = performance.now();
    const apiConfig = APIConfig.getInstance();
    const baseUrl = apiConfig.getBaseURL();

    const queryParams = new URLSearchParams();
    if (params?.agent_id) queryParams.append('agent_id', params.agent_id);
    if (params?.risk_level) queryParams.append('risk_level', params.risk_level);
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const url = `${baseUrl}/api/v1/memory/long-term/?${queryParams}`;
    const phase1End = performance.now();
    const phase1Duration = (phase1End - phase1Start).toFixed(2);

    console.log('\n[长期记忆API] ════════════════════════════════════');
    console.log(`[长期记忆API] 开始获取记忆列表: ${new Date().toLocaleTimeString()}`);
    console.log(`[长期记忆API] URL: ${url}`);
    console.log(`[长期记忆API] 参数: ${params ? JSON.stringify(params) : '无'}`);
    console.log(`[长期记忆API] 阶段1(请求准备)耗时: ${phase1Duration}ms`);

    // ===== 阶段2: 网络请求 =====
    const phase2Start = performance.now();
    console.log(`[长期记忆API] 阶段2(网络请求)开始...`);

    const response = await fetchAuth(url, {
      method: 'GET',
      headers: authHeaders(),
    });

    const phase2End = performance.now();
    const phase2Duration = (phase2End - phase2Start).toFixed(2);

    console.log(`[长期记忆API] 阶段2(网络请求)耗时: ${phase2Duration}ms`);
    console.log(`[长期记忆API] 响应状态: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      console.error(`[长期记忆API] ✗ 响应错误: ${response.statusText}`);
      console.error(`[长期记忆API] ✗ 总耗时: ${(phase2End - phase1Start).toFixed(2)}ms`);
      throw new Error(`获取长期记忆失败: ${response.statusText}`);
    }

    // ===== 阶段3: 数据解析 =====
    const phase3Start = performance.now();
    console.log(`[长期记忆API] 阶段3(数据解析)开始...`);

    const data = await response.json();
    const results = data.results || data;

    const phase3End = performance.now();
    const phase3Duration = (phase3End - phase3Start).toFixed(2);

    console.log(`[长期记忆API] 阶段3(数据解析)耗时: ${phase3Duration}ms`);
    console.log(`[长期记忆API] 解析数据: ${results.length} 条`);

    // ===== 阶段4: 缓存存储 =====
    const phase4Start = performance.now();
    this.cache.set(cacheKey, {
      data: results,
      timestamp: Date.now(),
    });
    const phase4End = performance.now();
    const phase4Duration = (phase4End - phase4Start).toFixed(2);

    console.log(`[长期记忆API] 阶段4(缓存存储)耗时: ${phase4Duration}ms`);
    console.log(`[长期记忆API] 数据已缓存（有效期5分钟）`);

    // ===== 总耗时统计 =====
    const totalDuration = (phase4End - phase1Start).toFixed(2);
    console.log(`[长期记忆API] ✓ 总耗时: ${totalDuration}ms`);
    console.log(`[长期记忆API]   - 请求准备: ${phase1Duration}ms (${((parseFloat(phase1Duration) / parseFloat(totalDuration)) * 100).toFixed(1)}%)`);
    console.log(`[长期记忆API]   - 网络请求: ${phase2Duration}ms (${((parseFloat(phase2Duration) / parseFloat(totalDuration)) * 100).toFixed(1)}%)`);
    console.log(`[长期记忆API]   - 数据解析: ${phase3Duration}ms (${((parseFloat(phase3Duration) / parseFloat(totalDuration)) * 100).toFixed(1)}%)`);
    console.log(`[长期记忆API]   - 缓存存储: ${phase4Duration}ms (${((parseFloat(phase4Duration) / parseFloat(totalDuration)) * 100).toFixed(1)}%)`);
    console.log(`[长期记忆API] ════════════════════════════════════\n`);

    return results;
  }

  /**
   * 验证链完整性
   */
  async verifyChain(): Promise<{
    is_valid: boolean;
    total_records: number;
    broken_at?: number;
  }> {
    // ===== 阶段1: 请求准备 =====
    const phase1Start = performance.now();
    const apiConfig = APIConfig.getInstance();
    const baseUrl = apiConfig.getBaseURL();

    const url = `${baseUrl}/api/v1/memory/long-term/chain_verification/`;
    const phase1End = performance.now();
    const phase1Duration = (phase1End - phase1Start).toFixed(2);

    console.log('\n[长期记忆API] ════════════════════════════════════');
    console.log(`[长期记忆API] 开始验证链完整性: ${new Date().toLocaleTimeString()}`);
    console.log(`[长期记忆API] URL: ${url}`);
    console.log(`[长期记忆API] 阶段1(请求准备)耗时: ${phase1Duration}ms`);

    // ===== 阶段2: 网络请求 =====
    const phase2Start = performance.now();
    console.log(`[长期记忆API] 阶段2(网络请求)开始...`);

    const response = await fetchAuth(url, {
      method: 'GET',
      headers: authHeaders(),
    });

    const phase2End = performance.now();
    const phase2Duration = (phase2End - phase2Start).toFixed(2);

    console.log(`[长期记忆API] 阶段2(网络请求)耗时: ${phase2Duration}ms`);
    console.log(`[长期记忆API] 响应状态: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      console.error(`[长期记忆API] ✗ 响应错误: ${response.statusText}`);
      console.error(`[长期记忆API] ✗ 总耗时: ${(phase2End - phase1Start).toFixed(2)}ms`);
      throw new Error(`验证链完整性失败: ${response.statusText}`);
    }

    // ===== 阶段3: 数据解析 =====
    const phase3Start = performance.now();
    console.log(`[长期记忆API] 阶段3(数据解析)开始...`);

    const data = await response.json();

    const phase3End = performance.now();
    const phase3Duration = (phase3End - phase3Start).toFixed(2);

    console.log(`[长期记忆API] 阶段3(数据解析)耗时: ${phase3Duration}ms`);
    console.log(`[长期记忆API] 验证结果: ${data.is_valid ? '有效' : '无效'}`);
    console.log(`[长期记忆API] 总记录数: ${data.total_records}`);

    if (data.broken_at) {
      console.log(`[长期记忆API] ⚠️ 链在位置 ${data.broken_at} 断裂`);
    }

    // ===== 总耗时统计 =====
    const totalDuration = (phase3End - phase1Start).toFixed(2);
    console.log(`[长期记忆API] ✓ 总耗时: ${totalDuration}ms`);
    console.log(`[长期记忆API]   - 请求准备: ${phase1Duration}ms (${((parseFloat(phase1Duration) / parseFloat(totalDuration)) * 100).toFixed(1)}%)`);
    console.log(`[长期记忆API]   - 网络请求: ${phase2Duration}ms (${((parseFloat(phase2Duration) / parseFloat(totalDuration)) * 100).toFixed(1)}%)`);
    console.log(`[长期记忆API]   - 数据解析: ${phase3Duration}ms (${((parseFloat(phase3Duration) / parseFloat(totalDuration)) * 100).toFixed(1)}%)`);
    console.log(`[长期记忆API] ════════════════════════════════════\n`);

    return data;
  }

  /**
   * 导出审计报告
   */
  async exportReport(params?: {
    start_date?: string;
    end_date?: string;
    format?: 'json' | 'csv';
  }): Promise<Blob> {
    // ===== 阶段1: 请求准备 =====
    const phase1Start = performance.now();
    const apiConfig = APIConfig.getInstance();
    const baseUrl = apiConfig.getBaseURL();

    const queryParams = new URLSearchParams();
    if (params?.start_date) queryParams.append('start_date', params.start_date);
    if (params?.end_date) queryParams.append('end_date', params.end_date);
    if (params?.format) queryParams.append('format', params.format);

    const url = `${baseUrl}/api/v1/memory/long-term/export_report/?${queryParams}`;
    const phase1End = performance.now();
    const phase1Duration = (phase1End - phase1Start).toFixed(2);

    console.log('\n[长期记忆API] ════════════════════════════════════');
    console.log(`[长期记忆API] 开始导出审计报告: ${new Date().toLocaleTimeString()}`);
    console.log(`[长期记忆API] URL: ${url}`);
    console.log(`[长期记忆API] 格式: ${params?.format || 'json'}`);
    console.log(`[长期记忆API] 阶段1(请求准备)耗时: ${phase1Duration}ms`);

    // ===== 阶段2: 网络请求 =====
    const phase2Start = performance.now();
    console.log(`[长期记忆API] 阶段2(网络请求)开始...`);

    const response = await fetchAuth(url, {
      method: 'GET',
      headers: authHeaders(),
    });

    const phase2End = performance.now();
    const phase2Duration = (phase2End - phase2Start).toFixed(2);

    console.log(`[长期记忆API] 阶段2(网络请求)耗时: ${phase2Duration}ms`);
    console.log(`[长期记忆API] 响应状态: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      console.error(`[长期记忆API] ✗ 响应错误: ${response.statusText}`);
      console.error(`[长期记忆API] ✗ 总耗时: ${(phase2End - phase1Start).toFixed(2)}ms`);
      throw new Error(`导出报告失败: ${response.statusText}`);
    }

    // ===== 阶段3: 数据解析 =====
    const phase3Start = performance.now();
    console.log(`[长期记忆API] 阶段3(数据解析)开始...`);

    const blob = await response.blob();

    const phase3End = performance.now();
    const phase3Duration = (phase3End - phase3Start).toFixed(2);

    console.log(`[长期记忆API] 阶段3(数据解析)耗时: ${phase3Duration}ms`);
    console.log(`[长期记忆API] 报告大小: ${(blob.size / 1024).toFixed(2)} KB`);
    console.log(`[长期记忆API] 内容类型: ${blob.type}`);

    // ===== 总耗时统计 =====
    const totalDuration = (phase3End - phase1Start).toFixed(2);
    console.log(`[长期记忆API] ✓ 总耗时: ${totalDuration}ms`);
    console.log(`[长期记忆API]   - 请求准备: ${phase1Duration}ms (${((parseFloat(phase1Duration) / parseFloat(totalDuration)) * 100).toFixed(1)}%)`);
    console.log(`[长期记忆API]   - 网络请求: ${phase2Duration}ms (${((parseFloat(phase2Duration) / parseFloat(totalDuration)) * 100).toFixed(1)}%)`);
    console.log(`[长期记忆API]   - 数据解析: ${phase3Duration}ms (${((parseFloat(phase3Duration) / parseFloat(totalDuration)) * 100).toFixed(1)}%)`);
    console.log(`[长期记忆API] ════════════════════════════════════\n`);

    return blob;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    const phase1Start = performance.now();
    console.log('\n[长期记忆API] ════════════════════════════════════');
    console.log(`[长期记忆API] 开始清除缓存: ${new Date().toLocaleTimeString()}`);

    const cacheSize = this.cache.size;
    this.cache.clear();

    const phase1End = performance.now();
    const phase1Duration = (phase1End - phase1Start).toFixed(2);

    console.log(`[长期记忆API] 阶段1(缓存清除)耗时: ${phase1Duration}ms`);
    console.log(`[长期记忆API] 清除项数: ${cacheSize} 条`);
    console.log(`[长期记忆API] ✓ 总耗时: ${phase1Duration}ms`);
    console.log(`[长期记忆API] ════════════════════════════════════\n`);
  }
}

// ==================== 策略记忆API ====================

export class StrategicMemoryApi {
  private static instance: StrategicMemoryApi;
  private effectiveStrategies: StrategicMemory[] = [];
  private loaded: boolean = false;

  static getInstance(): StrategicMemoryApi {
    if (!StrategicMemoryApi.instance) {
      StrategicMemoryApi.instance = new StrategicMemoryApi();
    }
    return StrategicMemoryApi.instance;
  }

  /**
   * 加载生效策略（启动时调用）
   */
  async loadEffectiveStrategies(): Promise<StrategicMemory[]> {
    // ===== 阶段1: 请求准备 =====
    const phase1Start = performance.now();
    const apiConfig = APIConfig.getInstance();
    const baseUrl = apiConfig.getBaseURL();

    const url = `${baseUrl}/api/v1/memory/strategic/effective_strategies/`;
    const phase1End = performance.now();
    const phase1Duration = (phase1End - phase1Start).toFixed(2);

    console.log('\n[策略记忆API] ════════════════════════════════════');
    console.log(`[策略记忆API] 开始加载生效策略: ${new Date().toLocaleTimeString()}`);
    console.log(`[策略记忆API] URL: ${url}`);
    console.log(`[策略记忆API] 阶段1(请求准备)耗时: ${phase1Duration}ms`);

    // ===== 阶段2: 网络请求 =====
    const phase2Start = performance.now();
    console.log(`[策略记忆API] 阶段2(网络请求)开始...`);

    const response = await fetchAuth(url, {
      method: 'GET',
      headers: authHeaders(),
    });

    const phase2End = performance.now();
    const phase2Duration = (phase2End - phase2Start).toFixed(2);

    console.log(`[策略记忆API] 阶段2(网络请求)耗时: ${phase2Duration}ms`);
    console.log(`[策略记忆API] 响应状态: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      console.error(`[策略记忆API] ✗ 响应错误: ${response.statusText}`);
      console.error(`[策略记忆API] ✗ 总耗时: ${(phase2End - phase1Start).toFixed(2)}ms`);
      throw new Error(`加载策略失败: ${response.statusText}`);
    }

    // ===== 阶段3: 数据解析 =====
    const phase3Start = performance.now();
    console.log(`[策略记忆API] 阶段3(数据解析)开始...`);

    const data = await response.json();
    this.effectiveStrategies = data.strategies || [];
    this.loaded = true;

    const phase3End = performance.now();
    const phase3Duration = (phase3End - phase3Start).toFixed(2);

    console.log(`[策略记忆API] 阶段3(数据解析)耗时: ${phase3Duration}ms`);
    console.log(`[策略记忆API] 加载策略: ${this.effectiveStrategies.length} 条`);
    console.log(`[策略记忆API] 加载状态: 已完成`);

    // ===== 总耗时统计 =====
    const totalDuration = (phase3End - phase1Start).toFixed(2);
    console.log(`[策略记忆API] ✓ 总耗时: ${totalDuration}ms`);
    console.log(`[策略记忆API]   - 请求准备: ${phase1Duration}ms (${((parseFloat(phase1Duration) / parseFloat(totalDuration)) * 100).toFixed(1)}%)`);
    console.log(`[策略记忆API]   - 网络请求: ${phase2Duration}ms (${((parseFloat(phase2Duration) / parseFloat(totalDuration)) * 100).toFixed(1)}%)`);
    console.log(`[策略记忆API]   - 数据解析: ${phase3Duration}ms (${((parseFloat(phase3Duration) / parseFloat(totalDuration)) * 100).toFixed(1)}%)`);
    console.log(`[策略记忆API] ════════════════════════════════════\n`);

    return this.effectiveStrategies;
  }

  /**
   * 获取生效策略（本地缓存）
   */
  getEffectiveStrategies(): StrategicMemory[] {
    if (!this.loaded) {
      console.warn('[策略记忆] 策略尚未加载，请先调用 loadEffectiveStrategies()');
    }
    return this.effectiveStrategies;
  }

  /**
   * 根据策略类型获取策略
   */
  getStrategiesByType(type: StrategicMemory['strategy_type']): StrategicMemory[] {
    return this.effectiveStrategies.filter(s => s.strategy_type === type);
  }

  /**
   * 应用策略到检测引擎
   */
  applyToDetectionEngine(): void {
    // 这里可以将策略应用到检测引擎
    // 例如：更新规则、调整参数等
    console.log('[策略记忆] 已应用到检测引擎');
  }

  /**
   * 获取策略列表（管理界面）
   */
  async getStrategies(params?: {
    strategy_type?: string;
    is_active?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<StrategicMemory[]> {
    // ===== 阶段1: 请求准备 =====
    const phase1Start = performance.now();
    const apiConfig = APIConfig.getInstance();
    const baseUrl = apiConfig.getBaseURL();

    const queryParams = new URLSearchParams();
    if (params?.strategy_type) queryParams.append('strategy_type', params.strategy_type);
    if (params?.is_active !== undefined) queryParams.append('is_active', params.is_active.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const url = `${baseUrl}/api/v1/memory/strategic/?${queryParams}`;
    const phase1End = performance.now();
    const phase1Duration = (phase1End - phase1Start).toFixed(2);

    console.log('\n[策略记忆API] ════════════════════════════════════');
    console.log(`[策略记忆API] 开始获取策略列表: ${new Date().toLocaleTimeString()}`);
    console.log(`[策略记忆API] URL: ${url}`);
    console.log(`[策略记忆API] 参数: ${params ? JSON.stringify(params) : '无'}`);
    console.log(`[策略记忆API] 阶段1(请求准备)耗时: ${phase1Duration}ms`);

    // ===== 阶段2: 网络请求 =====
    const phase2Start = performance.now();
    console.log(`[策略记忆API] 阶段2(网络请求)开始...`);

    const response = await fetchAuth(url, {
      method: 'GET',
      headers: authHeaders(),
    });

    const phase2End = performance.now();
    const phase2Duration = (phase2End - phase2Start).toFixed(2);

    console.log(`[策略记忆API] 阶段2(网络请求)耗时: ${phase2Duration}ms`);
    console.log(`[策略记忆API] 响应状态: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      console.error(`[策略记忆API] ✗ 响应错误: ${response.statusText}`);
      console.error(`[策略记忆API] ✗ 总耗时: ${(phase2End - phase1Start).toFixed(2)}ms`);
      throw new Error(`获取策略列表失败: ${response.statusText}`);
    }

    // ===== 阶段3: 数据解析 =====
    const phase3Start = performance.now();
    console.log(`[策略记忆API] 阶段3(数据解析)开始...`);

    const data = await response.json();
    const results = data.results || data;

    const phase3End = performance.now();
    const phase3Duration = (phase3End - phase3Start).toFixed(2);

    console.log(`[策略记忆API] 阶段3(数据解析)耗时: ${phase3Duration}ms`);
    console.log(`[策略记忆API] 解析数据: ${results.length} 条`);

    const activeCount = results.filter((s: any) => s.is_active).length;
    console.log(`[策略记忆API] 激活策略: ${activeCount} 条`);

    // ===== 总耗时统计 =====
    const totalDuration = (phase3End - phase1Start).toFixed(2);
    console.log(`[策略记忆API] ✓ 总耗时: ${totalDuration}ms`);
    console.log(`[策略记忆API]   - 请求准备: ${phase1Duration}ms (${((parseFloat(phase1Duration) / parseFloat(totalDuration)) * 100).toFixed(1)}%)`);
    console.log(`[策略记忆API]   - 网络请求: ${phase2Duration}ms (${((parseFloat(phase2Duration) / parseFloat(totalDuration)) * 100).toFixed(1)}%)`);
    console.log(`[策略记忆API]   - 数据解析: ${phase3Duration}ms (${((parseFloat(phase3Duration) / parseFloat(totalDuration)) * 100).toFixed(1)}%)`);
    console.log(`[策略记忆API] ════════════════════════════════════\n`);

    return results;
  }

  /**
   * 激活策略
   */
  async activateStrategy(id: number): Promise<StrategicMemory> {
    // ===== 阶段1: 请求准备 =====
    const phase1Start = performance.now();
    const apiConfig = APIConfig.getInstance();
    const baseUrl = apiConfig.getBaseURL();

    const url = `${baseUrl}/api/v1/memory/strategic/${id}/activate/`;
    const phase1End = performance.now();
    const phase1Duration = (phase1End - phase1Start).toFixed(2);

    console.log('\n[策略记忆API] ════════════════════════════════════');
    console.log(`[策略记忆API] 开始激活策略: ${new Date().toLocaleTimeString()}`);
    console.log(`[策略记忆API] URL: ${url}`);
    console.log(`[策略记忆API] 策略ID: ${id}`);
    console.log(`[策略记忆API] 阶段1(请求准备)耗时: ${phase1Duration}ms`);

    // ===== 阶段2: 网络请求 =====
    const phase2Start = performance.now();
    console.log(`[策略记忆API] 阶段2(网络请求)开始...`);

    const response = await fetchAuth(url, {
      method: 'POST',
      headers: authHeaders(),
    });

    const phase2End = performance.now();
    const phase2Duration = (phase2End - phase2Start).toFixed(2);

    console.log(`[策略记忆API] 阶段2(网络请求)耗时: ${phase2Duration}ms`);
    console.log(`[策略记忆API] 响应状态: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      console.error(`[策略记忆API] ✗ 响应错误: ${response.statusText}`);
      console.error(`[策略记忆API] ✗ 总耗时: ${(phase2End - phase1Start).toFixed(2)}ms`);
      throw new Error(`激活策略失败: ${response.statusText}`);
    }

    // ===== 阶段3: 数据解析 =====
    const phase3Start = performance.now();
    console.log(`[策略记忆API] 阶段3(数据解析)开始...`);

    const data = await response.json();

    const phase3End = performance.now();
    const phase3Duration = (phase3End - phase3Start).toFixed(2);

    console.log(`[策略记忆API] 阶段3(数据解析)耗时: ${phase3Duration}ms`);
    console.log(`[策略记忆API] 激活结果: 成功`);
    console.log(`[策略记忆API] 策略名称: ${data.strategy_name || '未知'}`);

    // ===== 总耗时统计 =====
    const totalDuration = (phase3End - phase1Start).toFixed(2);
    console.log(`[策略记忆API] ✓ 总耗时: ${totalDuration}ms`);
    console.log(`[策略记忆API]   - 请求准备: ${phase1Duration}ms (${((parseFloat(phase1Duration) / parseFloat(totalDuration)) * 100).toFixed(1)}%)`);
    console.log(`[策略记忆API]   - 网络请求: ${phase2Duration}ms (${((parseFloat(phase2Duration) / parseFloat(totalDuration)) * 100).toFixed(1)}%)`);
    console.log(`[策略记忆API]   - 数据解析: ${phase3Duration}ms (${((parseFloat(phase3Duration) / parseFloat(totalDuration)) * 100).toFixed(1)}%)`);
    console.log(`[策略记忆API] ════════════════════════════════════\n`);

    // 重新加载策略
    console.log(`[策略记忆API] 触发重新加载生效策略...`);
    await this.loadEffectiveStrategies();

    return data;
  }

  /**
   * 停用策略
   */
  async deactivateStrategy(id: number): Promise<void> {
    // ===== 阶段1: 请求准备 =====
    const phase1Start = performance.now();
    const apiConfig = APIConfig.getInstance();
    const baseUrl = apiConfig.getBaseURL();

    const url = `${baseUrl}/api/v1/memory/strategic/${id}/deactivate/`;
    const phase1End = performance.now();
    const phase1Duration = (phase1End - phase1Start).toFixed(2);

    console.log('\n[策略记忆API] ════════════════════════════════════');
    console.log(`[策略记忆API] 开始停用策略: ${new Date().toLocaleTimeString()}`);
    console.log(`[策略记忆API] URL: ${url}`);
    console.log(`[策略记忆API] 策略ID: ${id}`);
    console.log(`[策略记忆API] 阶段1(请求准备)耗时: ${phase1Duration}ms`);

    // ===== 阶段2: 网络请求 =====
    const phase2Start = performance.now();
    console.log(`[策略记忆API] 阶段2(网络请求)开始...`);

    const response = await fetchAuth(url, {
      method: 'POST',
      headers: authHeaders(),
    });

    const phase2End = performance.now();
    const phase2Duration = (phase2End - phase2Start).toFixed(2);

    console.log(`[策略记忆API] 阶段2(网络请求)耗时: ${phase2Duration}ms`);
    console.log(`[策略记忆API] 响应状态: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      console.error(`[策略记忆API] ✗ 响应错误: ${response.statusText}`);
      console.error(`[策略记忆API] ✗ 总耗时: ${(phase2End - phase1Start).toFixed(2)}ms`);
      throw new Error(`停用策略失败: ${response.statusText}`);
    }

    // ===== 阶段3: 数据解析 =====
    const phase3Start = performance.now();
    console.log(`[策略记忆API] 阶段3(数据解析)开始...`);

    await response.json();

    const phase3End = performance.now();
    const phase3Duration = (phase3End - phase3Start).toFixed(2);

    console.log(`[策略记忆API] 阶段3(数据解析)耗时: ${phase3Duration}ms`);
    console.log(`[策略记忆API] 停用结果: 成功`);

    // ===== 总耗时统计 =====
    const totalDuration = (phase3End - phase1Start).toFixed(2);
    console.log(`[策略记忆API] ✓ 总耗时: ${totalDuration}ms`);
    console.log(`[策略记忆API]   - 请求准备: ${phase1Duration}ms (${((parseFloat(phase1Duration) / parseFloat(totalDuration)) * 100).toFixed(1)}%)`);
    console.log(`[策略记忆API]   - 网络请求: ${phase2Duration}ms (${((parseFloat(phase2Duration) / parseFloat(totalDuration)) * 100).toFixed(1)}%)`);
    console.log(`[策略记忆API]   - 数据解析: ${phase3Duration}ms (${((parseFloat(phase3Duration) / parseFloat(totalDuration)) * 100).toFixed(1)}%)`);
    console.log(`[策略记忆API] ════════════════════════════════════\n`);

    // 重新加载策略
    console.log(`[策略记忆API] 触发重新加载生效策略...`);
    await this.loadEffectiveStrategies();
  }
}

// ==================== 记忆统计API ====================

export class MemoryStatisticsApi {
  /**
   * 获取综合统计信息
   */
  async getStatistics(): Promise<MemoryStatistics> {
    const apiConfig = APIConfig.getInstance();
    const baseUrl = apiConfig.getBaseURL();

    const response = await fetchAuth(`${baseUrl}/api/v1/memory/statistics/`, {
      method: 'GET',
      headers: authHeaders(),
    });

    if (!response.ok) {
      throw new Error(`获取统计信息失败: ${response.statusText}`);
    }

    return await response.json();
  }
}