/**
 * 行为风险评分器 - MVP 版本
 * 功能：实时计算 Agent 行为风险分数
 */

import type { AgentBehaviorLog } from './agentBehaviorParser'

/**
 * 风险评估结果
 */
export interface RiskAssessment {
  overallScore: number
  riskLevel: 'safe' | 'warning' | 'danger' | 'critical'
  recommendations: string[]
  shouldAlert: boolean
  timestamp: number
}

/**
 * 行为风险评分器
 */
export class BehaviorRiskScorer {
  private recentBehaviors: AgentBehaviorLog[] = []
  private readonly maxHistorySize = 100
  private readonly alertThreshold = 70
  private readonly criticalThreshold = 90

  /**
   * 添加行为日志并评估风险
   */
  assessBehavior(behavior: AgentBehaviorLog): RiskAssessment {
    // 1. 添加到历史记录
    this.recentBehaviors.push(behavior)
    if (this.recentBehaviors.length > this.maxHistorySize) {
      this.recentBehaviors.shift()
    }

    // 2. 计算综合风险分数
    const overallScore = this.calculateOverallScore()

    // 3. 确定风险等级
    const riskLevel = this.determineRiskLevel(overallScore)

    // 4. 生成建议
    const recommendations = this.generateRecommendations(overallScore, behavior)

    // 5. 判断是否需要告警
    const shouldAlert = overallScore >= this.alertThreshold

    return {
      overallScore,
      riskLevel,
      recommendations,
      shouldAlert,
      timestamp: Date.now()
    }
  }

  /**
   * 批量评估风险
   */
  assessBatch(behaviors: AgentBehaviorLog[]): RiskAssessment[] {
    return behaviors.map(b => this.assessBehavior(b))
  }

  /**
   * 获取最近的行为日志
   */
  getRecentBehaviors(limit: number = 10): AgentBehaviorLog[] {
    return this.recentBehaviors.slice(-limit)
  }

  /**
   * 获取风险趋势
   */
  getRiskTrend(minutes: number = 10): Array<{ time: number; score: number }> {
    const cutoff = Date.now() - minutes * 60 * 1000
    const recent = this.recentBehaviors.filter(b => b.timestamp > cutoff)
    
    return recent.map(b => ({
      time: b.timestamp,
      score: b.riskScore
    }))
  }

  /**
   * 计算综合风险分数
   */
  private calculateOverallScore(): number {
    if (this.recentBehaviors.length === 0) return 0

    // 最近10个行为的加权平均
    const recentBehaviors = this.recentBehaviors.slice(-10)
    
    // 时间衰减因子（越近的行为权重越高）
    const weights = recentBehaviors.map((_, index) => 
      Math.pow(1.2, index)
    )
    
    const totalWeight = weights.reduce((a, b) => a + b, 0)
    const weightedSum = recentBehaviors.reduce((sum, behavior, index) => {
      return sum + behavior.riskScore * weights[index]
    }, 0)

    // 基础分数
    let baseScore = weightedSum / totalWeight

    // 加入频率因子（短时间内多次风险行为加分）
    const frequencyBonus = this.calculateFrequencyBonus()
    
    // 加入序列因子（连续风险行为加分）
    const sequenceBonus = this.calculateSequenceBonus()
    
    return Math.min(baseScore + frequencyBonus + sequenceBonus, 100)
  }

  /**
   * 计算频率加分
   */
  private calculateFrequencyBonus(): number {
    const oneMinuteAgo = Date.now() - 60000
    const recentRiskCount = this.recentBehaviors.filter(
      b => b.timestamp > oneMinuteAgo && b.riskScore > 50
    ).length

    // 1分钟内超过3次风险行为，每次加5分
    return Math.max(0, (recentRiskCount - 3) * 5)
  }

  /**
   * 计算序列加分（检测连续攻击模式）
   */
  private calculateSequenceBonus(): number {
    const recent = this.recentBehaviors.slice(-5)
    if (recent.length < 3) return 0

    // 检测是否为连续高风险行为
    const highRiskCount = recent.filter(b => b.riskScore > 60).length
    if (highRiskCount >= 3) {
      return 15 // 连续3次以上高风险行为加分
    }

    // 检测是否为文件+剪贴板组合（可能的数据泄露）
    const hasFileOp = recent.some(b => b.action === 'file_operation')
    const hasClipboardOp = recent.some(b => b.action === 'clipboard_operation')
    if (hasFileOp && hasClipboardOp && recent.some(b => b.riskScore > 50)) {
      return 10
    }

    return 0
  }

  /**
   * 确定风险等级
   */
  private determineRiskLevel(score: number): RiskAssessment['riskLevel'] {
    if (score >= this.criticalThreshold) return 'critical'
    if (score >= this.alertThreshold) return 'danger'
    if (score >= 50) return 'warning'
    return 'safe'
  }

  /**
   * 生成建议
   */
  private generateRecommendations(score: number, behavior: AgentBehaviorLog): string[] {
    const recommendations: string[] = []

    // 基于分数的建议
    if (score >= 90) {
      recommendations.push('⚠️ 发现严重安全风险，建议立即暂停Agent操作')
    } else if (score >= 70) {
      recommendations.push('⚡ 检测到高风险行为，建议审查Agent操作')
    } else if (score >= 50) {
      recommendations.push('📋 发现中等风险行为，建议关注')
    }

    // 基于行为类型的建议
    if (behavior.details.detected_types?.length > 0) {
      const types = behavior.details.detected_types
      
      if (types.includes('sqli') || types.includes('sql_injection')) {
        recommendations.push('🔍 发现SQL注入风险，建议检查数据库操作')
      }
      
      if (types.includes('xss')) {
        recommendations.push('🔍 发现XSS风险，建议检查输出编码')
      }
      
      if (types.includes('apikey') || types.includes('api_key')) {
        recommendations.push('🔑 发现API Key泄露风险，建议立即更新密钥')
      }
      
      if (types.includes('code_injection')) {
        recommendations.push('💻 发现代码注入风险，建议检查动态执行')
      }
    }

    // 基于行为模式的建议
    if (behavior.action === 'clipboard_operation' && behavior.riskScore > 60) {
      recommendations.push('📋 剪贴板包含敏感信息，建议检查数据流向')
    }

    if (behavior.action === 'file_operation' && behavior.riskScore > 70) {
      recommendations.push('📁 文件操作风险较高，建议检查文件内容')
    }

    // 基于Agent类型的建议
    if (behavior.agentType !== 'unknown') {
      recommendations.push(`🤖 来源: ${behavior.agentType.toUpperCase()}`)
    }

    return recommendations
  }

  /**
   * 清空历史记录
   */
  clearHistory(): void {
    this.recentBehaviors = []
  }

  /**
   * 导出历史记录
   */
  exportHistory(): AgentBehaviorLog[] {
    return [...this.recentBehaviors]
  }

  /**
   * 获取统计信息
   */
  getStatistics(): {
    totalCount: number
    avgScore: number
    maxScore: number
    riskDistribution: Record<string, number>
    agentDistribution: Record<string, number>
  } {
    if (this.recentBehaviors.length === 0) {
      return {
        totalCount: 0,
        avgScore: 0,
        maxScore: 0,
        riskDistribution: {},
        agentDistribution: {}
      }
    }

    const scores = this.recentBehaviors.map(b => b.riskScore)
    
    // 风险等级分布
    const riskDistribution: Record<string, number> = {
      safe: 0,
      warning: 0,
      danger: 0,
      critical: 0
    }
    
    this.recentBehaviors.forEach(b => {
      const level = this.determineRiskLevel(b.riskScore)
      riskDistribution[level]++
    })

    // Agent类型分布
    const agentDistribution: Record<string, number> = {}
    this.recentBehaviors.forEach(b => {
      agentDistribution[b.agentType] = (agentDistribution[b.agentType] || 0) + 1
    })

    return {
      totalCount: this.recentBehaviors.length,
      avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
      maxScore: Math.max(...scores),
      riskDistribution,
      agentDistribution
    }
  }
}