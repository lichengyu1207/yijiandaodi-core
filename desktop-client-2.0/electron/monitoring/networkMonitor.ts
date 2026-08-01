/**
 * 网络监控模块
 * 监控 AI API 调用
 */

import { app } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../services/loggerService';

// 在类中创建，以便于测试 mock

// AI API 域名列表
const AI_API_DOMAINS = [
  'api.openai.com',
  'api.anthropic.com',
  'generativelanguage.googleapis.com',
  'api.perplexity.ai',
  'api.claude.ai',
  'api.github.com'
];

export interface NetworkRequest {
  protocol: string;
  localAddress: string;
  foreignAddress: string;
  state: string;
  pid: number;
  isAIAPI: boolean;
  domain?: string;
  timestamp: string;
}

export class NetworkMonitor {
  private monitoringInterval: NodeJS.Timeout | null = null;
  private detectedConnections: Map<string, NetworkRequest> = new Map();
  private onAIAPIRequestDetected?: (request: NetworkRequest) => void;
  private execAsync: (command: string) => Promise<{ stdout: string; stderr: string }>;

  constructor() {
    this.execAsync = promisify(exec);
  }

  setAIAPIRequestDetectedCallback(callback: (request: NetworkRequest) => void) {
    this.onAIAPIRequestDetected = callback;
  }

  /**
   * 启动网络监控
   */
  start() {
    if (this.monitoringInterval) {
      logger.info('[网络监控] 已在运行', { module: 'NetworkMonitor' });
      return;
    }

    logger.info('[网络监控] 启动...', { module: 'NetworkMonitor' });

    // 每10秒检查一次网络连接
    this.monitoringInterval = setInterval(() => {
      this.checkNetworkConnections();
    }, 10000);

    // 立即执行一次
    this.checkNetworkConnections();
  }

  /**
   * 停止网络监控
   */
  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('[网络监控] 已停止', { module: 'NetworkMonitor' });
    }
  }

  /**
   * 检查网络连接
   */
  private async checkNetworkConnections() {
    try {
      // Windows 命令：获取网络连接
      const { stdout } = await this.execAsync('netstat -ano');
      const connections = this.parseNetworkConnections(stdout);

      // 检查 AI API 连接
      connections.forEach(connection => {
        const aiDomain = this.detectAIAPI(connection.foreignAddress);
        if (aiDomain) {
          connection.isAIAPI = true;
          connection.domain = aiDomain;
          this.detectedConnections.set(connection.foreignAddress, connection);

          logger.info(`[网络监控] 检测到 AI API 连接: ${aiDomain}`, { module: 'NetworkMonitor' }, { address: connection.foreignAddress });

          // 触发回调
          if (this.onAIAPIRequestDetected) {
            this.onAIAPIRequestDetected(connection);
          }
        }
      });
    } catch (error: any) {
      logger.error('[网络监控] 检查网络连接失败:', { module: 'NetworkMonitor' }, { error: error.message });
    }
  }

  /**
   * 解析网络连接
   */
  private parseNetworkConnections(output: string): NetworkRequest[] {
    const lines = output.split('\n').filter(line => line.trim());
    const connections: NetworkRequest[] = [];

    lines.forEach(line => {
      try {
        // 格式: 协议 本地地址 外部地址 状态 PID
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5) {
          connections.push({
            protocol: parts[0],
            localAddress: parts[1],
            foreignAddress: parts[2],
            state: parts[3],
            pid: parseInt(parts[4]),
            isAIAPI: false,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        // 跳过解析失败的行
      }
    });

    return connections;
  }

  /**
   * 检测是否是 AI API 连接
   */
  private detectAIAPI(address: string): string | null {
    // 移除端口号
    const addressWithoutPort = address.split(':')[0]

    for (const domain of AI_API_DOMAINS) {
      if (addressWithoutPort === domain || addressWithoutPort.endsWith('.' + domain)) {
        return domain
      }
    }
    return null
  }

  /**
   * 获取检测到的 AI API 连接
   */
  getDetectedAIAPIConnections(): NetworkRequest[] {
    return Array.from(this.detectedConnections.values());
  }

  /**
   * 清除检测记录
   */
  clearDetectedConnections() {
    this.detectedConnections.clear();
  }
}