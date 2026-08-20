/**
 * CPU 监控服务
 * 提供完整的 CPU 性能监控和分析能力
 */

import { EventEmitter } from 'events';
import * as os from 'os';

// ==================== 类型定义 ====================

/**
 * CPU 监控配置
 */
export interface CPUMonitorConfig {
  /** 监控间隔（毫秒），默认 1000ms */
  interval?: number;
  /** CPU 使用率警告阈值（百分比），默认 80% */
  warningThreshold?: number;
  /** CPU 使用率危险阈值（百分比），默认 95% */
  criticalThreshold?: number;
  /** 慢操作阈值（毫秒），默认 100ms */
  slowOperationThreshold?: number;
  /** 是否启用核心负载分析，默认 true */
  enableCoreAnalysis?: boolean;
  /** 历史数据保留时长（毫秒），默认 60000ms (1分钟) */
  historyRetentionTime?: number;
}

/**
 * CPU 使用率信息
 */
export interface CPUUsageInfo {
  /** 总使用率（百分比） */
  total: number;
  /** 用户态使用率（百分比） */
  user: number;
  /** 系统态使用率（百分比） */
  system: number;
  /** 空闲率（百分比） */
  idle: number;
  /** 时间戳 */
  timestamp: string;
}

/**
 * CPU 核心信息
 */
export interface CPUCoreInfo {
  /** 核心编号 */
  id: number;
  /** 核心型号 */
  model: string;
  /** 使用率（百分比） */
  usage: number;
  /** 用户态时间（毫秒） */
  userTime: number;
  /** 系统态时间（毫秒） */
  systemTime: number;
  /** 空闲时间（毫秒） */
  idleTime: number;
  /** 时间戳 */
  timestamp: string;
}

/**
 * 进程 CPU 使用情况
 */
export interface ProcessCPUUsage {
  /** 用户态 CPU 时间（微秒） */
  user: number;
  /** 系统态 CPU 时间（微秒） */
  system: number;
  /** 总 CPU 时间（微秒） */
  total: number;
  /** 时间戳 */
  timestamp: string;
}

/**
 * 性能热点信息
 */
export interface PerformanceHotspot {
  /** 操作名称 */
  operation: string;
  /** 平均 CPU 使用率 */
  avgCPUUsage: number;
  /** 最大 CPU 使用率 */
  maxCPUUsage: number;
  /** 出现次数 */
  occurrences: number;
  /** 首次出现时间 */
  firstSeen: string;
  /** 最后出现时间 */
  lastSeen: string;
}

/**
 * 慢操作记录
 */
export interface SlowOperation {
  /** 操作名称 */
  operation: string;
  /** 执行时间（毫秒） */
  duration: number;
  /** CPU 使用率 */
  cpuUsage: number;
  /** 时间戳 */
  timestamp: string;
  /** 堆栈信息（可选） */
  stackTrace?: string;
}

/**
 * CPU 性能报告
 */
export interface CPUPerformanceReport {
  /** 报告生成时间 */
  generatedAt: string;
  /** 监控时长（毫秒） */
  monitoringDuration: number;
  /** 总体 CPU 使用情况 */
  overall: {
    avgCPUUsage: number;
    maxCPUUsage: number;
    minCPUUsage: number;
    avgUserUsage: number;
    avgSystemUsage: number;
  };
  /** 各核心使用情况 */
  cores: CPUCoreInfo[];
  /** 性能热点列表 */
  hotspots: PerformanceHotspot[];
  /** 慢操作列表 */
  slowOperations: SlowOperation[];
  /** 系统信息 */
  systemInfo: {
    cpuModel: string;
    cpuCores: number;
    cpuSpeed: number;
    totalMemory: number;
    freeMemory: number;
    loadAverage: number[];
  };
}

/**
 * CPU 监控事件
 */
export interface CPUMonitorEvents {
  'cpu-warning': (data: { usage: CPUUsageInfo; message: string }) => void;
  'cpu-critical': (data: { usage: CPUUsageInfo; message: string }) => void;
  'slow-operation': (data: SlowOperation) => void;
  'hotspot-detected': (data: PerformanceHotspot) => void;
}

// ==================== CPU 监控服务类 ====================

/**
 * CPU 监控服务类
 * 提供实时监控、性能分析、热点检测等完整能力
 */
export class CPUMonitor extends EventEmitter {
  private config: Required<CPUMonitorConfig>;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private lastCPUTimes: NodeJS.CpuInfo[] | null = null;
  private lastProcessCPUUsage: NodeJS.CpuUsage | null = null;
  private usageHistory: CPUUsageInfo[] = [];
  private coreHistory: CPUCoreInfo[][] = [];
  private hotspots: Map<string, PerformanceHotspot> = new Map();
  private slowOperations: SlowOperation[] = [];
  private startTime: number = 0;
  private isMonitoring: boolean = false;

  constructor(config: CPUMonitorConfig = {}) {
    super();

    // 设置默认配置
    this.config = {
      interval: config.interval ?? 1000,
      warningThreshold: config.warningThreshold ?? 80,
      criticalThreshold: config.criticalThreshold ?? 95,
      slowOperationThreshold: config.slowOperationThreshold ?? 100,
      enableCoreAnalysis: config.enableCoreAnalysis ?? true,
      historyRetentionTime: config.historyRetentionTime ?? 60000
    };
  }

  /**
   * 启动 CPU 监控
   */
  start(): void {
    if (this.isMonitoring) {
      console.log('[CPU监控] 已在运行中');
      return;
    }

    console.log('[CPU监控] 启动监控服务...');
    this.startTime = Date.now();
    this.isMonitoring = true;
    this.lastCPUTimes = os.cpus();
    this.lastProcessCPUUsage = process.cpuUsage();

    // 定时监控
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, this.config.interval);

    // 立即收集一次
    this.collectMetrics();

    console.log(`[CPU监控] 监控间隔: ${this.config.interval}ms`);
    console.log(`[CPU监控] 警告阈值: ${this.config.warningThreshold}%`);
    console.log(`[CPU监控] 危险阈值: ${this.config.criticalThreshold}%`);
  }

  /** 当前是否在监控中（P0 统一控制面：desktop.monitor.cpu 状态查询） */
  isRunning(): boolean {
    return this.isMonitoring
  }

  /**
   * 停止 CPU 监控
   */
  stop(): void {
    if (!this.isMonitoring) {
      return;
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.isMonitoring = false;
    console.log('[CPU监控] 已停止监控');
  }

  /**
   * 收集性能指标
   */
  private collectMetrics(): void {
    const timestamp = new Date().toISOString();

    // 1. 收集总体 CPU 使用率
    const usageInfo = this.calculateCPUUsage(timestamp);
    this.addToHistory(usageInfo);

    // 2. 收集各核心使用情况
    if (this.config.enableCoreAnalysis) {
      const coreInfos = this.calculateCoreUsage(timestamp);
      this.addToCoreHistory(coreInfos);
    }

    // 3. 检查阈值
    this.checkThresholds(usageInfo);

    // 4. 清理过期历史数据
    this.cleanupHistory();
  }

  /**
   * 计算总体 CPU 使用率
   */
  private calculateCPUUsage(timestamp: string): CPUUsageInfo {
    const currentCPUTimes = os.cpus();

    if (!this.lastCPUTimes) {
      this.lastCPUTimes = currentCPUTimes;
      return {
        total: 0,
        user: 0,
        system: 0,
        idle: 100,
        timestamp
      };
    }

    // 计算所有核心的总时间差
    let totalUser = 0;
    let totalSystem = 0;
    let totalIdle = 0;
    let totalNice = 0;
    let totalIRQ = 0;

    for (let i = 0; i < currentCPUTimes.length; i++) {
      const current = currentCPUTimes[i].times;
      const last = this.lastCPUTimes[i].times;

      totalUser += current.user - last.user;
      totalSystem += current.system - last.system;
      totalIdle += current.idle - last.idle;
      totalNice += (current.nice || 0) - (last.nice || 0);
      totalIRQ += (current.irq || 0) - (last.irq || 0);
    }

    const totalTime = totalUser + totalSystem + totalIdle + totalNice + totalIRQ;
    const totalUsage = totalTime - totalIdle;

    // 计算百分比
    const userPercent = totalTime > 0 ? (totalUser / totalTime) * 100 : 0;
    const systemPercent = totalTime > 0 ? (totalSystem / totalTime) * 100 : 0;
    const idlePercent = totalTime > 0 ? (totalIdle / totalTime) * 100 : 0;
    const totalPercent = totalTime > 0 ? (totalUsage / totalTime) * 100 : 0;

    // 更新上次时间
    this.lastCPUTimes = currentCPUTimes;

    return {
      total: totalPercent,
      user: userPercent,
      system: systemPercent,
      idle: idlePercent,
      timestamp
    };
  }

  /**
   * 计算各核心使用情况
   */
  private calculateCoreUsage(timestamp: string): CPUCoreInfo[] {
    const currentCPUTimes = os.cpus();
    const coreInfos: CPUCoreInfo[] = [];

    if (!this.lastCPUTimes) {
      return coreInfos;
    }

    for (let i = 0; i < currentCPUTimes.length; i++) {
      const current = currentCPUTimes[i];
      const last = this.lastCPUTimes[i];

      const userTime = current.times.user - last.times.user;
      const systemTime = current.times.system - last.times.system;
      const idleTime = current.times.idle - last.times.idle;
      const niceTime = (current.times.nice || 0) - (last.times.nice || 0);
      const irqTime = (current.times.irq || 0) - (last.times.irq || 0);

      const totalTime = userTime + systemTime + idleTime + niceTime + irqTime;
      const usageTime = totalTime - idleTime;
      const usage = totalTime > 0 ? (usageTime / totalTime) * 100 : 0;

      coreInfos.push({
        id: i,
        model: current.model,
        usage,
        userTime,
        systemTime,
        idleTime,
        timestamp
      });
    }

    return coreInfos;
  }

  /**
   * 获取进程 CPU 使用情况
   */
  getProcessCPUUsage(): ProcessCPUUsage {
    const currentUsage = process.cpuUsage();
    const timestamp = new Date().toISOString();

    if (!this.lastProcessCPUUsage) {
      this.lastProcessCPUUsage = currentUsage;
      return {
        user: 0,
        system: 0,
        total: 0,
        timestamp
      };
    }

    const userDiff = currentUsage.user - this.lastProcessCPUUsage.user;
    const systemDiff = currentUsage.system - this.lastProcessCPUUsage.system;

    this.lastProcessCPUUsage = currentUsage;

    return {
      user: userDiff,
      system: systemDiff,
      total: userDiff + systemDiff,
      timestamp
    };
  }

  /**
   * 添加到历史记录
   */
  private addToHistory(usageInfo: CPUUsageInfo): void {
    this.usageHistory.push(usageInfo);
  }

  /**
   * 添加到核心历史记录
   */
  private addToCoreHistory(coreInfos: CPUCoreInfo[]): void {
    this.coreHistory.push(coreInfos);
  }

  /**
   * 检查阈值
   */
  private checkThresholds(usageInfo: CPUUsageInfo): void {
    if (usageInfo.total >= this.config.criticalThreshold) {
      const message = `CPU 使用率达到危险水平: ${usageInfo.total.toFixed(2)}%`;
      console.warn(`[CPU监控] ${message}`);
      this.emit('cpu-critical', { usage: usageInfo, message });
    } else if (usageInfo.total >= this.config.warningThreshold) {
      const message = `CPU 使用率较高: ${usageInfo.total.toFixed(2)}%`;
      console.log(`[CPU监控] ${message}`);
      this.emit('cpu-warning', { usage: usageInfo, message });
    }
  }

  /**
   * 清理过期历史数据
   */
  private cleanupHistory(): void {
    const cutoffTime = Date.now() - this.config.historyRetentionTime;

    // 清理使用率历史
    this.usageHistory = this.usageHistory.filter(info => {
      const timestamp = new Date(info.timestamp).getTime();
      return timestamp >= cutoffTime;
    });

    // 清理核心历史
    this.coreHistory = this.coreHistory.filter(cores => {
      if (cores.length === 0) return false;
      const timestamp = new Date(cores[0].timestamp).getTime();
      return timestamp >= cutoffTime;
    });

    // 清理慢操作
    this.slowOperations = this.slowOperations.filter(op => {
      const timestamp = new Date(op.timestamp).getTime();
      return timestamp >= cutoffTime;
    });
  }

  /**
   * 记录操作并检测性能热点
   */
  trackOperation(operation: string, duration: number, stackTrace?: string): void {
    const timestamp = new Date().toISOString();
    const currentUsage = this.getCurrentUsage();

    // 记录慢操作
    if (duration >= this.config.slowOperationThreshold) {
      const slowOp: SlowOperation = {
        operation,
        duration,
        cpuUsage: currentUsage.total,
        timestamp,
        stackTrace
      };

      this.slowOperations.push(slowOp);
      console.warn(`[CPU监控] 慢操作检测: ${operation} 耗时 ${duration}ms`);
      this.emit('slow-operation', slowOp);
    }

    // 更新热点信息
    this.updateHotspots(operation, currentUsage.total);
  }

  /**
   * 获取当前 CPU 使用率
   */
  private getCurrentUsage(): CPUUsageInfo {
    if (this.usageHistory.length === 0) {
      return {
        total: 0,
        user: 0,
        system: 0,
        idle: 100,
        timestamp: new Date().toISOString()
      };
    }
    return this.usageHistory[this.usageHistory.length - 1];
  }

  /**
   * 更新性能热点
   */
  private updateHotspots(operation: string, cpuUsage: number): void {
    const timestamp = new Date().toISOString();
    const existing = this.hotspots.get(operation);

    if (existing) {
      // 更新现有热点
      existing.occurrences++;
      existing.maxCPUUsage = Math.max(existing.maxCPUUsage, cpuUsage);
      existing.avgCPUUsage = (existing.avgCPUUsage * (existing.occurrences - 1) + cpuUsage) / existing.occurrences;
      existing.lastSeen = timestamp;

      // 触发热点检测事件
      if (existing.occurrences >= 5 && existing.avgCPUUsage >= this.config.warningThreshold) {
        this.emit('hotspot-detected', existing);
      }
    } else {
      // 创建新热点
      const hotspot: PerformanceHotspot = {
        operation,
        avgCPUUsage: cpuUsage,
        maxCPUUsage: cpuUsage,
        occurrences: 1,
        firstSeen: timestamp,
        lastSeen: timestamp
      };
      this.hotspots.set(operation, hotspot);
    }
  }

  /**
   * 获取 CPU 使用率历史
   */
  getUsageHistory(): CPUUsageInfo[] {
    return [...this.usageHistory];
  }

  /**
   * 获取核心负载历史
   */
  getCoreHistory(): CPUCoreInfo[][] {
    return [...this.coreHistory];
  }

  /**
   * 获取性能热点列表
   */
  getHotspots(): PerformanceHotspot[] {
    return Array.from(this.hotspots.values())
      .sort((a, b) => b.avgCPUUsage - a.avgCPUUsage);
  }

  /**
   * 获取慢操作列表
   */
  getSlowOperations(): SlowOperation[] {
    return [...this.slowOperations]
      .sort((a, b) => b.duration - a.duration);
  }

  /**
   * 生成性能分析报告
   */
  generateReport(): CPUPerformanceReport {
    const timestamp = new Date().toISOString();
    const monitoringDuration = this.startTime > 0 ? Date.now() - this.startTime : 0;

    // 计算总体统计数据
    let avgCPUUsage = 0;
    let maxCPUUsage = 0;
    let minCPUUsage = 100;
    let avgUserUsage = 0;
    let avgSystemUsage = 0;

    if (this.usageHistory.length > 0) {
      this.usageHistory.forEach(usage => {
        avgCPUUsage += usage.total;
        avgUserUsage += usage.user;
        avgSystemUsage += usage.system;
        maxCPUUsage = Math.max(maxCPUUsage, usage.total);
        minCPUUsage = Math.min(minCPUUsage, usage.total);
      });

      avgCPUUsage /= this.usageHistory.length;
      avgUserUsage /= this.usageHistory.length;
      avgSystemUsage /= this.usageHistory.length;
    }

    // 获取最新核心信息
    const cores = this.coreHistory.length > 0
      ? this.coreHistory[this.coreHistory.length - 1]
      : [];

    // 系统信息
    const cpus = os.cpus();
    const systemInfo = {
      cpuModel: cpus.length > 0 ? cpus[0].model : 'Unknown',
      cpuCores: cpus.length,
      cpuSpeed: cpus.length > 0 ? cpus[0].speed : 0,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      loadAverage: os.loadavg()
    };

    return {
      generatedAt: timestamp,
      monitoringDuration,
      overall: {
        avgCPUUsage,
        maxCPUUsage,
        minCPUUsage,
        avgUserUsage,
        avgSystemUsage
      },
      cores,
      hotspots: this.getHotspots(),
      slowOperations: this.getSlowOperations(),
      systemInfo
    };
  }

  /**
   * 获取实时 CPU 使用统计
   */
  getRealtimeStats(): {
    current: CPUUsageInfo;
    process: ProcessCPUUsage;
    cores: CPUCoreInfo[];
  } {
    return {
      current: this.getCurrentUsage(),
      process: this.getProcessCPUUsage(),
      cores: this.coreHistory.length > 0 ? this.coreHistory[this.coreHistory.length - 1] : []
    };
  }

  /**
   * 分析核心负载分布
   */
  analyzeCoreDistribution(): {
    avgLoadPerCore: number[];
    maxLoadPerCore: number[];
    imbalanced: boolean;
    imbalanceRatio: number;
  } {
    if (this.coreHistory.length === 0) {
      return {
        avgLoadPerCore: [],
        maxLoadPerCore: [],
        imbalanced: false,
        imbalanceRatio: 0
      };
    }

    const cpuCount = os.cpus().length;
    const avgLoadPerCore: number[] = new Array(cpuCount).fill(0);
    const maxLoadPerCore: number[] = new Array(cpuCount).fill(0);

    // 计算每个核心的平均和最大负载
    this.coreHistory.forEach(cores => {
      cores.forEach(core => {
        avgLoadPerCore[core.id] += core.usage;
        maxLoadPerCore[core.id] = Math.max(maxLoadPerCore[core.id], core.usage);
      });
    });

    // 计算平均值
    for (let i = 0; i < cpuCount; i++) {
      avgLoadPerCore[i] /= this.coreHistory.length;
    }

    // 检查负载不均衡
    const maxAvg = Math.max(...avgLoadPerCore);
    const minAvg = Math.min(...avgLoadPerCore);
    const imbalanceRatio = maxAvg > 0 ? (maxAvg - minAvg) / maxAvg : 0;
    const imbalanced = imbalanceRatio > 0.3; // 30% 差异视为不均衡

    return {
      avgLoadPerCore,
      maxLoadPerCore,
      imbalanced,
      imbalanceRatio
    };
  }

  /**
   * 清除所有历史数据
   */
  clearHistory(): void {
    this.usageHistory = [];
    this.coreHistory = [];
    this.hotspots.clear();
    this.slowOperations = [];
    console.log('[CPU监控] 历史数据已清除');
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<CPUMonitorConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig
    };

    console.log('[CPU监控] 配置已更新:', this.config);
  }

  /**
   * 获取当前配置
   */
  getConfig(): Required<CPUMonitorConfig> {
    return { ...this.config };
  }

  /**
   * 检查监控状态
   */
  isActive(): boolean {
    return this.isMonitoring;
  }
}

// ==================== 使用示例和文档 ====================

/**
 * 使用示例：
 *
 * // 1. 创建实例
 * const cpuMonitor = new CPUMonitor({
 *   interval: 1000,              // 1秒监控间隔
 *   warningThreshold: 80,        // 80% 警告阈值
 *   criticalThreshold: 95,       // 95% 危险阈值
 *   slowOperationThreshold: 100, // 100ms 慢操作阈值
 *   enableCoreAnalysis: true,    // 启用核心分析
 *   historyRetentionTime: 60000  // 保留 1 分钟历史数据
 * });
 *
 * // 2. 监听事件
 * cpuMonitor.on('cpu-warning', (data) => {
 *   console.log(`警告: ${data.message}`);
 *   console.log(`使用率: ${data.usage.total}%`);
 * });
 *
 * cpuMonitor.on('cpu-critical', (data) => {
 *   console.error(`危险: ${data.message}`);
 *   // 执行紧急处理...
 * });
 *
 * cpuMonitor.on('slow-operation', (data) => {
 *   console.warn(`慢操作: ${data.operation} 耗时 ${data.duration}ms`);
 * });
 *
 * cpuMonitor.on('hotspot-detected', (data) => {
 *   console.log(`性能热点: ${data.operation}, 平均 CPU: ${data.avgCPUUsage}%`);
 * });
 *
 * // 3. 启动监控
 * cpuMonitor.start();
 *
 * // 4. 跟踪操作（可选）
 * function myHeavyOperation() {
 *   const start = Date.now();
 *   try {
 *     // 执行耗时操作...
 *   } finally {
 *     const duration = Date.now() - start;
 *     cpuMonitor.trackOperation('myHeavyOperation', duration);
 *   }
 * }
 *
 * // 5. 获取实时统计
 * const stats = cpuMonitor.getRealtimeStats();
 * console.log(`当前 CPU: ${stats.current.total}%`);
 * console.log(`进程 CPU: ${stats.process.total}μs`);
 *
 * // 6. 分析核心分布
 * const coreAnalysis = cpuMonitor.analyzeCoreDistribution();
 * console.log(`核心负载是否均衡: ${!coreAnalysis.imbalanced}`);
 * console.log(`不均衡比例: ${(coreAnalysis.imbalanceRatio * 100).toFixed(2)}%`);
 *
 * // 7. 生成性能报告
 * const report = cpuMonitor.generateReport();
 * console.log('性能报告:', report);
 *
 * // 8. 停止监控
 * cpuMonitor.stop();
 *
 * // 9. 清理历史数据（可选）
 * cpuMonitor.clearHistory();
 */

/**
 * API 说明：
 *
 * 公共方法：
 * - start(): 启动监控
 * - stop(): 停止监控
 * - isActive(): 检查是否正在监控
 * - getRealtimeStats(): 获取实时统计
 * - getUsageHistory(): 获取使用率历史
 * - getCoreHistory(): 获取核心历史
 * - getHotspots(): 获取性能热点
 * - getSlowOperations(): 获取慢操作
 * - trackOperation(name, duration): 跟踪操作
 * - analyzeCoreDistribution(): 分析核心分布
 * - generateReport(): 生成性能报告
 * - clearHistory(): 清除历史数据
 * - updateConfig(config): 更新配置
 * - getConfig(): 获取当前配置
 *
 * 事件：
 * - 'cpu-warning': CPU 使用率超过警告阈值
 * - 'cpu-critical': CPU 使用率超过危险阈值
 * - 'slow-operation': 检测到慢操作
 * - 'hotspot-detected': 检测到性能热点
 */

/**
 * 性能优化建议：
 *
 * 1. 合理设置监控间隔：
 *    - 生产环境: 1000-5000ms
 *    - 开发环境: 500-1000ms
 *    - 性能分析: 100-500ms
 *
 * 2. 阈值设置：
 *    - 警告阈值: 70-85%
 *    - 危险阈值: 90-95%
 *    - 慢操作阈值: 根据业务需求
 *
 * 3. 历史数据管理：
 *    - 定期清理历史数据
 *    - 根据内存情况调整保留时长
 *
 * 4. 核心分析：
 *    - 仅在需要时启用
 *    - 多核心系统建议启用
 *
 * 5. 热点检测：
 *    - 对关键操作进行跟踪
 *    - 结合业务逻辑设置合理的阈值
 */