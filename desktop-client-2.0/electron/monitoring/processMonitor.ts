/**
 * AI Agent 进程监控模块
 * 监控运行中的 AI 应用进程
 */

import { app } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// AI Agent 应用列表
const AI_AGENTS = [
  'Cursor',
  'Code',
  'chrome',
  'firefox',
  'edge',
  'GitHub CLI',
  'postman'
];

// AI API 域名列表
const AI_API_DOMAINS = [
  'api.openai.com',
  'api.anthropic.com',
  'generativelanguage.googleapis.com',
  'api.perplexity.ai',
  'api.claude.ai'
];

export interface ProcessInfo {
  name: string;
  pid: number;
  memory: number;
  cpu: number;
  isAIAgent: boolean;
  timestamp: string;
}

export class ProcessMonitor {
  private monitoringInterval: NodeJS.Timeout | null = null;
  private detectedProcesses: Map<string, ProcessInfo> = new Map();
  private onAIAgentDetected?: (process: ProcessInfo) => void;

  setAIAgentDetectedCallback(callback: (process: ProcessInfo) => void) {
    this.onAIAgentDetected = callback;
  }

  /**
   * 启动进程监控
   */
  start() {
    if (this.monitoringInterval) {
      console.log('[进程监控] 已在运行');
      return;
    }

    console.log('[进程监控] 启动...');

    // 每5秒检查一次进程
    this.monitoringInterval = setInterval(() => {
      this.checkProcesses();
    }, 5000);

    // 立即执行一次
    this.checkProcesses();
  }

  /**
   * 停止进程监控
   */
  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('[进程监控] 已停止');
    }
  }

  /**
   * 检查运行中的进程
   */
  private async checkProcesses() {
    try {
      // Windows 命令：获取进程列表
      const { stdout } = await execAsync('tasklist /fo csv /nh');
      const processes = this.parseProcessList(stdout);

      // 检查 AI Agent 进程
      processes.forEach(process => {
        if (this.isAIAgentProcess(process.name)) {
          process.isAIAgent = true;
          this.detectedProcesses.set(process.name, process);

          console.log(`[进程监控] 检测到 AI Agent: ${process.name} (PID: ${process.pid})`);

          // 触发回调
          if (this.onAIAgentDetected) {
            this.onAIAgentDetected(process);
          }
        }
      });
    } catch (error: any) {
      console.error('[进程监控] 检查进程失败:', error.message);
    }
  }

  /**
   * 解析进程列表
   */
  private parseProcessList(output: string): ProcessInfo[] {
    const lines = output.split('\n').filter(line => line.trim());
    const processes: ProcessInfo[] = [];

    lines.forEach(line => {
      try {
        // CSV 格式: "名称","PID","会话名","会话#","内存使用"
        const parts = line.match(/"([^"]+)"/g);
        if (parts && parts.length >= 2) {
          const name = parts[0].replace(/"/g, '');
          const pid = parseInt(parts[1].replace(/"/g, ''));

          processes.push({
            name,
            pid,
            memory: 0, // 需要额外命令获取
            cpu: 0,    // 需要额外命令获取
            isAIAgent: false,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        // 跳过解析失败的行
      }
    });

    return processes;
  }

  /**
   * 判断是否是 AI Agent 进程
   */
  private isAIAgentProcess(processName: string): boolean {
    return AI_AGENTS.some(agent =>
      processName.toLowerCase().includes(agent.toLowerCase())
    );
  }

  /**
   * 获取检测到的 AI Agent 进程
   */
  getDetectedAIAgents(): ProcessInfo[] {
    return Array.from(this.detectedProcesses.values());
  }

  /**
   * 清除检测记录
   */
  clearDetectedProcesses() {
    this.detectedProcesses.clear();
  }
}