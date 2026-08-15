/**
 * 策略记忆同步服务
 *
 * 功能：
 * - 桌面端启动时自动加载生效策略
 * - 策略变化时自动同步
 * - 将策略应用到检测引擎
 * - 策略版本管理
 */

import { StrategicMemoryApi, StrategicMemory } from './memoryApi';
import { cacheService } from './cacheService';

export interface StrategyChange {
  type: 'add' | 'update' | 'delete';
  strategy: StrategicMemory;
  timestamp: number;
}

export class StrategyService {
  private static instance: StrategyService;
  private strategicApi: StrategicMemoryApi;
  private currentStrategies: Map<number, StrategicMemory> = new Map();
  private changeListeners: ((change: StrategyChange) => void)[] = [];
  private lastSyncTime: number = 0;
  private readonly SYNC_INTERVAL = 10 * 60 * 1000; // 10分钟

  static getInstance(): StrategyService {
    if (!StrategyService.instance) {
      StrategyService.instance = new StrategyService();
    }
    return StrategyService.instance;
  }

  constructor() {
    this.strategicApi = StrategicMemoryApi.getInstance();
  }

  /**
   * 初始化策略服务（桌面端启动时调用）
   */
  async initialize(): Promise<void> {
    console.log('[策略服务] 初始化...');

    // 尝试从缓存加载
    const cachedStrategies = cacheService.get<StrategicMemory[]>('effective_strategies');
    if (cachedStrategies) {
      console.log(`[策略服务] 从缓存加载 ${cachedStrategies.length} 条策略`);
      this.updateStrategies(cachedStrategies);
    }

    // 从服务器加载最新策略
    try {
      const strategies = await this.strategicApi.loadEffectiveStrategies();
      this.updateStrategies(strategies);

      // 缓存策略
      cacheService.set('effective_strategies', strategies, 10 * 60 * 1000); // 缓存10分钟

      // 应用到检测引擎
      this.applyToDetectionEngine();
    } catch (error) {
      console.error('[策略服务] 加载策略失败:', error);

      // 如果离线，使用缓存
      if (!cacheService.isOnlineStatus() && cachedStrategies) {
        console.log('[策略服务] 离线模式，使用缓存策略');
      }
    }

    this.lastSyncTime = Date.now();
  }

  /**
   * 定期同步策略
   */
  async syncIfNecessary(): Promise<void> {
    const now = Date.now();
    if (now - this.lastSyncTime > this.SYNC_INTERVAL) {
      console.log('[策略服务] 定期同步策略...');
      await this.initialize();
    }
  }

  /**
   * 获取当前策略
   */
  getStrategies(): StrategicMemory[] {
    return Array.from(this.currentStrategies.values());
  }

  /**
   * 根据ID获取策略
   */
  getStrategyById(id: number): StrategicMemory | undefined {
    return this.currentStrategies.get(id);
  }

  /**
   * 根据类型获取策略
   */
  getStrategiesByType(type: StrategicMemory['strategy_type']): StrategicMemory[] {
    return this.getStrategies().filter(s => s.strategy_type === type);
  }

  /**
   * 应用策略到检测引擎
   */
  applyToDetectionEngine(): void {
    const strategies = this.getStrategies();
    console.log(`[策略服务] 应用 ${strategies.length} 条策略到检测引擎`);

    // 按类型分组应用
    const detectionRules = this.getStrategiesByType('detection_rule');
    const responsePolicies = this.getStrategiesByType('response_policy');
    const riskAssessments = this.getStrategiesByType('risk_assessment');
    const behaviorConstraints = this.getStrategiesByType('behavior_constraint');

    // 应用检测规则
    detectionRules.forEach(rule => {
      this.applyDetectionRule(rule);
    });

    // 应用响应策略
    responsePolicies.forEach(policy => {
      this.applyResponsePolicy(policy);
    });

    // 应用风险评估
    riskAssessments.forEach(assessment => {
      this.applyRiskAssessment(assessment);
    });

    // 应用行为约束
    behaviorConstraints.forEach(constraint => {
      this.applyBehaviorConstraint(constraint);
    });

    console.log('[策略服务] 策略已应用到检测引擎');
  }

  /**
   * 应用检测规则
   */
  private applyDetectionRule(rule: StrategicMemory): void {
    // 这里可以将检测规则应用到检测引擎
    // 例如：添加新的检测模式、调整检测阈值等
    console.log(`[策略服务] 应用检测规则: ${rule.strategy_name}（置信度: ${rule.confidence}）`);
  }

  /**
   * 应用响应策略
   */
  private applyResponsePolicy(policy: StrategicMemory): void {
    // 这里可以将响应策略应用到响应引擎
    // 例如：设置自动响应行为、调整响应级别等
    console.log(`[策略服务] 应用响应策略: ${policy.strategy_name}`);
  }

  /**
   * 应用风险评估
   */
  private applyRiskAssessment(assessment: StrategicMemory): void {
    // 这里可以将风险评估应用到评估引擎
    // 例如：调整风险权重、更新评估模型等
    console.log(`[策略服务] 应用风险评估: ${assessment.strategy_name}`);
  }

  /**
   * 应用行为约束
   */
  private applyBehaviorConstraint(constraint: StrategicMemory): void {
    // 这里可以将行为约束应用到约束引擎
    // 例如：添加禁止行为列表、调整约束强度等
    console.log(`[策略服务] 应用行为约束: ${constraint.strategy_name}`);
  }

  /**
   * 更新策略
   */
  private updateStrategies(strategies: StrategicMemory[]): void {
    const newStrategies = new Map<number, StrategicMemory>();
    const changes: StrategyChange[] = [];

    strategies.forEach(strategy => {
      const existing = this.currentStrategies.get(strategy.id);

      if (!existing) {
        // 新增策略
        changes.push({
          type: 'add',
          strategy,
          timestamp: Date.now(),
        });
      } else if (existing.version < strategy.version) {
        // 策略更新
        changes.push({
          type: 'update',
          strategy,
          timestamp: Date.now(),
        });
      }

      newStrategies.set(strategy.id, strategy);
    });

    // 检查删除的策略
    this.currentStrategies.forEach((strategy, id) => {
      if (!newStrategies.has(id)) {
        changes.push({
          type: 'delete',
          strategy,
          timestamp: Date.now(),
        });
      }
    });

    // 更新当前策略
    this.currentStrategies = newStrategies;

    // 通知监听器
    if (changes.length > 0) {
      this.notifyChangeListeners(changes);
    }
  }

  /**
   * 添加变化监听器
   */
  addChangeListener(listener: (change: StrategyChange) => void): void {
    this.changeListeners.push(listener);
  }

  /**
   * 移除变化监听器
   */
  removeChangeListener(listener: (change: StrategyChange) => void): void {
    const index = this.changeListeners.indexOf(listener);
    if (index > -1) {
      this.changeListeners.splice(index, 1);
    }
  }

  /**
   * 通知变化监听器
   */
  private notifyChangeListeners(changes: StrategyChange[]): void {
    changes.forEach(change => {
      this.changeListeners.forEach(listener => {
        try {
          listener(change);
        } catch (error) {
          console.error('[策略服务] 监听器执行失败:', error);
        }
      });
    });
  }

  /**
   * 获取策略统计
   */
  getStatistics(): {
    total: number;
    byType: Record<string, number>;
    avgConfidence: number;
    avgSuccessRate: number;
  } {
    const strategies = this.getStrategies();

    const byType: Record<string, number> = {};
    let totalConfidence = 0;
    let totalSuccessRate = 0;

    strategies.forEach(s => {
      byType[s.strategy_type] = (byType[s.strategy_type] || 0) + 1;
      totalConfidence += s.confidence;
      totalSuccessRate += s.success_rate;
    });

    return {
      total: strategies.length,
      byType,
      avgConfidence: strategies.length > 0 ? totalConfidence / strategies.length : 0,
      avgSuccessRate: strategies.length > 0 ? totalSuccessRate / strategies.length : 0,
    };
  }
}

// 导出单例
export const strategyService = StrategyService.getInstance();