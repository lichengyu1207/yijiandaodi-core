/**
 * 进程监控模块
 *
 * 功能：
 * - 定时扫描本机进程列表（默认 60s，可配置）
 * - 识别漫剧生产工具进程（剪映/即梦/PR/AE/Audition/CapCut 等白名单）
 * - 记录工具进程的启动、退出与运行时长
 * - 工具会话结束后上报后端，用于前端统计展示
 * - 保留原有 AI Agent 检测能力（用于桌宠/告警）
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';
import { logger } from '../services/loggerService';

const execAsync = promisify(exec);

// AI Agent 应用列表（保留原有检测能力）
const AI_AGENTS = [
  'Cursor',
  'Code',
  'chrome',
  'firefox',
  'edge',
  'GitHub CLI',
  'postman'
];

// 漫剧生产工具白名单：可执行文件名匹配 → 工具展示名
const TOOL_WHITELIST: { name: string; patterns: string[] }[] = [
  { name: '剪映', patterns: ['jianyingpro', 'jianying', 'capcut'] },
  { name: '即梦', patterns: ['jimeng'] },
  { name: 'Premiere (PR)', patterns: ['adobepremierepro', 'premiere pro'] },
  { name: 'After Effects (AE)', patterns: ['afterfx'] },
  { name: 'Audition', patterns: ['audition'] },
];

export interface ProcessInfo {
  name: string;
  pid: number;
  memory: number;
  cpu: number;
  isAIAgent: boolean;
  timestamp: string;
  command?: string;
}

export interface ToolSession {
  pid: number;
  toolName: string;
  processName: string;
  sessionStart: string; // ISO 字符串
  sessionEnd: string | null;
  durationSeconds: number;
  /** 关联文件三态：null=未确定；false=确实无；true=有（配合 relatedFiles） */
  hasRelatedFiles?: boolean | null;
  relatedFiles?: string[];
}

export interface ProcessMonitorConfig {
  /** 扫描间隔（毫秒），默认 60s */
  scanIntervalMs?: number;
  /** 可选后端上报配置 */
  backend?: {
    enabled: boolean;
    baseUrl: string;
    token?: string;
  };
}

export class ProcessMonitor {
  private monitoringInterval: NodeJS.Timeout | null = null;
  private detectedProcesses: Map<string, ProcessInfo> = new Map();
  private toolSessions: Map<number, ToolSession> = new Map();
  private onAIAgentDetected?: (process: ProcessInfo) => void;
  private onToolSessionEnded?: (session: ToolSession) => void;
  /** 联动：根据会话时间窗解析关联文件列表（由 FileMonitor 提供） */
  private resolveRelatedFiles?: (sessionStart: string, sessionEnd: string) => string[];
  private config: ProcessMonitorConfig;

  constructor(config: ProcessMonitorConfig = {}) {
    this.config = {
      scanIntervalMs: config.scanIntervalMs ?? 60000,
      backend: config.backend,
    };
  }

  setAIAgentDetectedCallback(callback: (process: ProcessInfo) => void) {
    this.onAIAgentDetected = callback;
  }

  setToolSessionEndedCallback(callback: (session: ToolSession) => void) {
    this.onToolSessionEnded = callback;
  }

  /**
   * 设置关联文件解析器（联动文件监控）。
   * 工具会话结束时，将用会话的时间窗查询文件监控，得到该期间操作过的文件。
   */
  setRelatedFilesResolver(resolver: (sessionStart: string, sessionEnd: string) => string[]) {
    this.resolveRelatedFiles = resolver;
  }

  /**
   * 获取后端上报配置
   */
  getBackendConfig() {
    return this.config.backend ? { ...this.config.backend } : null;
  }

  /**
   * 设置后端上报配置（含可选的鉴权 token）
   */
  setBackendConfig(enabled: boolean, baseUrl: string, token?: string) {
    this.config.backend = { enabled, baseUrl, token };
  }

  /**
   * 启动进程监控
   */
  start() {
    if (this.monitoringInterval) {
      logger.info('[进程监控] 已在运行', { module: 'ProcessMonitor' });
      return;
    }

    logger.info(`[进程监控] 启动...（扫描间隔 ${this.config.scanIntervalMs}ms）`, { module: 'ProcessMonitor' });

    this.monitoringInterval = setInterval(() => {
      this.checkProcesses();
    }, this.config.scanIntervalMs!);

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

      // 停止时结束所有未结束的工具会话
      const now = new Date().toISOString();
      this.toolSessions.forEach((session, pid) => {
        this.finalizeSession(pid, now);
      });

      logger.info('[进程监控] 已停止', { module: 'ProcessMonitor' });
    }
  }

  /**
   * 检查运行中的进程
   */
  private async checkProcesses() {
    let processes: ProcessInfo[] = [];
    try {
      const { stdout } = await execAsync('tasklist /fo csv /nh');
      processes = this.parseProcessList(stdout);
    } catch (error: any) {
      logger.error('[进程监控] 检查进程失败:', { module: 'ProcessMonitor' }, { error: error.message });
      return;
    }

    const runningToolPids = new Set<number>();
    const now = new Date().toISOString();

    processes.forEach(process => {
      // AI Agent 检测（保留原有能力）
      if (this.isAIAgentProcess(process.name)) {
        process.isAIAgent = true;
        this.detectedProcesses.set(process.name, process);
        logger.info(`[进程监控] 检测到 AI Agent: ${process.name}`, { module: 'ProcessMonitor' }, { pid: process.pid });
        if (this.onAIAgentDetected) {
          this.onAIAgentDetected(process);
        }
      }

      // 漫剧工具识别
      const toolName = this.matchTool(process.name);
      if (toolName) {
        runningToolPids.add(process.pid);
        if (!this.toolSessions.has(process.pid)) {
          // 新启动的工具进程 → 开始会话
          this.toolSessions.set(process.pid, {
            pid: process.pid,
            toolName,
            processName: process.name,
            sessionStart: now,
            sessionEnd: null,
            durationSeconds: 0,
            hasRelatedFiles: null, // 尚未关联文件监控，标记为“未确定”
            relatedFiles: [],
          });
          logger.info(`[进程监控] 检测到工具启动: ${toolName} (${process.name}, pid=${process.pid})`, { module: 'ProcessMonitor' });
        }
      }
    });

    // 结束本次扫描未出现的工具会话（进程已退出）
    this.toolSessions.forEach((session, pid) => {
      if (!runningToolPids.has(pid)) {
        this.finalizeSession(pid, now);
      }
    });
  }

  /**
   * 结束工具会话：计算时长、触发上报回调
   */
  private finalizeSession(pid: number, endIso: string) {
    const session = this.toolSessions.get(pid);
    if (!session) return;

    const start = new Date(session.sessionStart).getTime();
    const end = new Date(endIso).getTime();
    session.sessionEnd = endIso;
    session.durationSeconds = Math.max(0, Math.round((end - start) / 1000));

    // 联动：用会话时间窗解析关联文件（来自文件监控）
    if (this.resolveRelatedFiles) {
      try {
        const files = this.resolveRelatedFiles(session.sessionStart, session.sessionEnd);
        const uniqueFiles = Array.from(new Set(files || [])).filter(Boolean);
        session.relatedFiles = uniqueFiles;
        session.hasRelatedFiles = uniqueFiles.length > 0;
        if (uniqueFiles.length > 0) {
          logger.info(
            `[进程监控] 会话关联到 ${uniqueFiles.length} 个文件`,
            { module: 'ProcessMonitor' },
            { pid, files: uniqueFiles.slice(0, 10) }
          );
        }
      } catch (error: any) {
        logger.warn('[进程监控] 关联文件解析失败，保持“未确定”', { module: 'ProcessMonitor' }, { error: error.message });
        // hasRelatedFiles 保持 null（未确定）
      }
    }

    this.toolSessions.delete(pid);

    logger.info(
      `[进程监控] 工具会话结束: ${session.toolName} 时长 ${session.durationSeconds}s`,
      { module: 'ProcessMonitor' },
      { pid, durationSeconds: session.durationSeconds }
    );

    // 本地回调（供联动使用）
    if (this.onToolSessionEnded) {
      this.onToolSessionEnded(session);
    }

    // 后端上报
    this.reportToBackend(session);
  }

  /**
   * 上报工具会话到后端
   */
  private async reportToBackend(session: ToolSession) {
    const backend = this.config.backend;
    if (!backend || !backend.enabled || !backend.baseUrl) return;

    try {
      await axios.post(`${backend.baseUrl.replace(/\/$/, '')}/api/v1/process/report/`, {
        tool_name: session.toolName,
        process_name: session.processName,
        pid: session.pid,
        session_start: session.sessionStart,
        session_end: session.sessionEnd,
        duration_seconds: session.durationSeconds,
        related_files: session.relatedFiles || [],
        has_related_files: session.hasRelatedFiles ?? null,
      }, {
        timeout: 5000,
        headers: backend.token ? { Authorization: `Bearer ${backend.token}` } : {},
      });
      logger.info('[进程监控] 已上报工具会话', { module: 'ProcessMonitor' }, { tool: session.toolName });
    } catch (error: any) {
      logger.warn('[进程监控] 后端上报失败（不影响本地）', { module: 'ProcessMonitor' }, { error: error.message });
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
            memory: 0,
            cpu: 0,
            isAIAgent: false,
            timestamp: new Date().toISOString(),
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
   * 匹配漫剧生产工具，返回工具展示名；未匹配返回 null
   */
  private matchTool(processName: string): string | null {
    const lower = processName.toLowerCase();
    for (const tool of TOOL_WHITELIST) {
      if (tool.patterns.some(p => lower.includes(p))) {
        return tool.name;
      }
    }
    return null;
  }

  /**
   * 获取当前正在运行的工具会话
   */
  getRunningToolSessions(): ToolSession[] {
    return Array.from(this.toolSessions.values());
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
