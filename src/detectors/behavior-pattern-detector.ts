/**
 * 行为模式检测框架
 * 为 AI 驱动的行为分析预留接口
 */

import { RiskResult } from '../types';

/**
 * 行为上下文
 */
export interface BehaviorContext {
  // 用户标识
  userId?: string;
  // 会话标识
  sessionId?: string;
  // 操作类型
  operationType: 'file' | 'clipboard' | 'network' | 'api' | 'custom';
  // 时间戳
  timestamp: string;
  // 操作内容（部分）
  content?: string;
  // 来源应用
  sourceApp?: string;
  // 额外元数据
  metadata?: { [key: string]: any };
}

/**
 * 行为模式
 */
export interface BehaviorPattern {
  // 模式 ID
  id: string;
  // 模式名称
  name: string;
  // 风险等级
  riskLevel: 'low' | 'medium' | 'high';
  // 置信度 (0-1)
  confidence: number;
  // 描述
  description: string;
  // 触发条件
  triggers: string[];
  // 建议
  recommendation?: string;
}

/**
 * 行为分析结果
 */
export interface BehaviorAnalysisResult {
  // 是否异常
  isAnomaly: boolean;
  // 检测到的模式
  patterns: BehaviorPattern[];
  // 风险分数 (0-100)
  riskScore: number;
  // 建议
  recommendations: string[];
}

/**
 * 行为模式检测器（AI 驱动框架）
 * 
 * 这是一个框架，预留了 AI 模型集成的接口
 * 目前使用规则匹配，后续可以集成：
 * - 监督学习模型（Random Forest, SVM, Neural Network）
 * - 异常检测算法（Isolation Forest, One-Class SVM）
 * - 深度学习模型（LSTM, Transformer）
 * - LLM 分析（GPT-4, Claude）
 */
export class BehaviorPatternDetector {
  private behaviorHistory: BehaviorContext[] = [];
  private maxHistorySize: number = 1000;

  constructor() {
    console.log('[行为模式检测器] 初始化完成（当前使用规则匹配，AI 模型待集成）');
  }

  /**
   * 分析行为模式
   */
  analyzeBehavior(context: BehaviorContext): BehaviorAnalysisResult {
    // 添加到历史记录
    this.addToHistory(context);

    // 当前使用规则匹配（简单的启发式方法）
    const patterns = this.detectPatternsByRules(context);

    // 计算风险分数
    const riskScore = this.calculateRiskScore(patterns);

    // 生成建议
    const recommendations = this.generateRecommendations(patterns);

    return {
      isAnomaly: patterns.length > 0,
      patterns,
      riskScore,
      recommendations
    };
  }

  /**
   * 添加到历史记录
   */
  private addToHistory(context: BehaviorContext): void {
    this.behaviorHistory.push(context);

    // 限制历史记录大小
    if (this.behaviorHistory.length > this.maxHistorySize) {
      this.behaviorHistory.shift();
    }
  }

  /**
   * 规则匹配模式检测（当前实现）
   * TODO: 后续替换为 AI 模型
   */
  private detectPatternsByRules(context: BehaviorContext): BehaviorPattern[] {
    const patterns: BehaviorPattern[] = [];

    // 规则1：高频操作检测
    const recentOps = this.behaviorHistory.filter(
      h => Date.now() - new Date(h.timestamp).getTime() < 60000 // 1分钟内
    );
    if (recentOps.length > 10) {
      patterns.push({
        id: 'high-frequency-operations',
        name: '高频操作',
        riskLevel: 'medium',
        confidence: 0.7,
        description: '短时间内进行了大量操作',
        triggers: ['operation_count > 10 in 1min'],
        recommendation: '建议人工审查该用户行为'
      });
    }

    // 规则2：跨应用操作检测
    const uniqueApps = new Set(
      this.behaviorHistory.slice(-10).map(h => h.sourceApp)
    );
    if (uniqueApps.size > 3) {
      patterns.push({
        id: 'cross-application-operations',
        name: '跨应用操作',
        riskLevel: 'low',
        confidence: 0.6,
        description: '在多个应用间频繁切换',
        triggers: ['multiple_apps in recent operations'],
        recommendation: '可能在进行数据迁移或敏感信息传递'
      });
    }

    // 规则3：敏感操作时间检测
    const hour = new Date(context.timestamp).getHours();
    if (hour < 6 || hour > 22) {
      patterns.push({
        id: 'off-hours-operations',
        name: '非工作时间操作',
        riskLevel: 'medium',
        confidence: 0.5,
        description: '在非常规工作时间进行操作',
        triggers: ['hour < 6 or hour > 22'],
        recommendation: '关注非工作时间的活动'
      });
    }

    // 规则4：剪贴板连续使用检测
    if (context.operationType === 'clipboard') {
      const recentClipboardOps = this.behaviorHistory.filter(
        h => h.operationType === 'clipboard' && 
             Date.now() - new Date(h.timestamp).getTime() < 300000 // 5分钟内
      );
      if (recentClipboardOps.length > 5) {
        patterns.push({
          id: 'excessive-clipboard-usage',
          name: '剪贴板过度使用',
          riskLevel: 'high',
          confidence: 0.8,
          description: '短时间内频繁使用剪贴板',
          triggers: ['clipboard_operations > 5 in 5min'],
          recommendation: '可能在进行数据窃取或批量信息收集'
        });
      }
    }

    return patterns;
  }

  /**
   * 计算风险分数
   */
  private calculateRiskScore(patterns: BehaviorPattern[]): number {
    if (patterns.length === 0) return 0;

    let score = 0;
    patterns.forEach(pattern => {
      const baseScore = pattern.riskLevel === 'high' ? 40 : 
                       pattern.riskLevel === 'medium' ? 20 : 10;
      score += baseScore * pattern.confidence;
    });

    return Math.min(100, Math.round(score));
  }

  /**
   * 生成建议
   */
  private generateRecommendations(patterns: BehaviorPattern[]): string[] {
    return patterns.map(p => p.recommendation || `检测到：${p.name}`);
  }

  /**
   * 获取行为历史
   */
  getHistory(): BehaviorContext[] {
    return [...this.behaviorHistory];
  }

  /**
   * 清除历史
   */
  clearHistory(): void {
    this.behaviorHistory = [];
    console.log('[行为模式检测器] 历史记录已清除');
  }

  /**
   * AI 模型接口（预留）
   * TODO: 集成实际的 AI 模型
   */
  async analyzeWithAI(context: BehaviorContext): Promise<BehaviorAnalysisResult> {
    // 预留接口，后续可以集成：
    // - OpenAI API
    // - Anthropic Claude API
    // - 本地 ML 模型
    // - 云端 AI 服务

    console.log('[行为模式检测器] AI 分析接口已预留，待集成模型');
    
    // 当前返回规则匹配结果
    return this.analyzeBehavior(context);
  }

  /**
   * 训练自定义模型（预留）
   * TODO: 支持自定义训练数据
   */
  async trainModel(trainingData: BehaviorContext[]): Promise<void> {
    console.log('[行为模式检测器] 模型训练接口已预留，待实现');
    // 预留接口，后续实现：
    // - 数据预处理
    // - 特征提取
    // - 模型训练
    // - 模型评估
  }

  /**
   * 导出行为数据（用于分析）
   */
  exportBehaviorData(): string {
    return JSON.stringify(this.behaviorHistory, null, 2);
  }
}