/**
 * 风险检测器
 */

import { SecurityKnowledgeBase } from '../security-knowledge-base';
import { RiskResult } from '../types';

export class RiskDetector {
  private securityKB: SecurityKnowledgeBase;

  constructor(securityKB: SecurityKnowledgeBase) {
    this.securityKB = securityKB;
  }

  /**
   * 检测内容中的风险
   */
  detect(content: string): RiskResult[] {
    return this.securityKB.detect(content);
  }

  /**
   * 检测文件内容
   */
  async detectFile(filePath: string): Promise<RiskResult[]> {
    const fs = await import('fs');
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return this.detect(content);
    } catch (error) {
      console.error('[RiskDetector] 文件读取失败:', error);
      return [];
    }
  }

  /**
   * 批量检测
   */
  detectBatch(contents: string[]): RiskResult[][] {
    return contents.map(content => this.detect(content));
  }

  /**
   * 获取高风险项
   */
  getHighRisks(risks: RiskResult[]): RiskResult[] {
    return risks.filter(r => r.risk === 'high');
  }

  /**
   * 获取中风险项
   */
  getMediumRisks(risks: RiskResult[]): RiskResult[] {
    return risks.filter(r => r.risk === 'medium');
  }

  /**
   * 计算风险分数
   */
  calculateRiskScore(risks: RiskResult[]): number {
    let score = 0;
    for (const risk of risks) {
      if (risk.risk === 'high') score += 30;
      else if (risk.risk === 'medium') score += 15;
      else score += 5;
    }
    return Math.min(score, 100);
  }
}