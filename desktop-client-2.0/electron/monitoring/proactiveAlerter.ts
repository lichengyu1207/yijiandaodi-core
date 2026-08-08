/**
 * 主动告警器 - MVP 版本
 * 功能：基于风险评估主动发送通知
 */

import { Notification } from 'electron'
import type { RiskAssessment } from './behaviorRiskScorer'
import type { AgentBehaviorLog } from './agentBehaviorParser'
import { smartAlerter } from './smartAlerter'

/**
 * 告警记录
 */
interface AlertRecord {
  timestamp: number
  behavior: AgentBehaviorLog
  assessment: RiskAssessment
  notified: boolean
}

/**
 * 主动告警器
 */
export class ProactiveAlerter {
  private lastAlertTime = 0
  private readonly minAlertInterval = 60000 // 1分钟
  private alertHistory: AlertRecord[] = []
  private readonly maxHistorySize = 50

  /**
   * 处理风险评估结果，决定是否告警
   */
  handleAssessment(
    behavior: AgentBehaviorLog,
    assessment: RiskAssessment
  ): boolean {
    // 1. 记录告警历史
    this.alertHistory.push({
      timestamp: Date.now(),
      behavior,
      assessment,
      notified: false
    })

    if (this.alertHistory.length > this.maxHistorySize) {
      this.alertHistory.shift()
    }

    // 2. 记录到智能提示器（始终记录）
    smartAlerter.alert(
      assessment.overallScore,
      assessment.recommendations.join('\n')
    )

    // 3. 如果需要告警且间隔足够，发送系统通知
    if (assessment.shouldAlert && this.canAlert()) {
      this.sendSystemNotification(behavior, assessment)
      this.lastAlertTime = Date.now()
      
      // 更新告警记录
      const lastRecord = this.alertHistory[this.alertHistory.length - 1]
      if (lastRecord) {
        lastRecord.notified = true
      }
      
      return true
    }

    return false
  }

  /**
   * 检查是否可以发送告警
   */
  private canAlert(): boolean {
    return Date.now() - this.lastAlertTime >= this.minAlertInterval
  }

  /**
   * 发送系统通知
   */
  private sendSystemNotification(
    behavior: AgentBehaviorLog,
    assessment: RiskAssessment
  ): void {
    try {
      const title = this.getNotificationTitle(assessment.riskLevel)
      const body = this.getNotificationBody(behavior, assessment)

      const notification = new Notification({
        title,
        body,
        silent: false,
        urgency: assessment.riskLevel === 'critical' ? 'critical' : 'normal',
        timeoutType: assessment.riskLevel === 'critical' ? 'never' : 'default'
      })

      notification.show()

      // 点击通知时打开主窗口
      notification.on('click', () => {
        // 这里可以触发打开主窗口的操作
        console.log('[ProactiveAlerter] 用户点击了通知')
      })

      console.log('[ProactiveAlerter] 已发送系统通知:', title)
    } catch (error) {
      console.error('[ProactiveAlerter] 发送通知失败:', error)
    }
  }

  /**
   * 获取通知标题
   */
  private getNotificationTitle(level: RiskAssessment['riskLevel']): string {
    const titles = {
      'safe': '✅ Agent 行为正常',
      'warning': '⚠️ Agent 行为异常',
      'danger': '🔴 Agent 高风险操作',
      'critical': '🚨 Agent 严重安全风险'
    }
    return titles[level]
  }

  /**
   * 获取通知内容
   */
  private getNotificationBody(
    behavior: AgentBehaviorLog,
    assessment: RiskAssessment
  ): string {
    let body = ''
    
    // Agent 信息
    const agentName = behavior.agentType === 'unknown' ? '未知Agent' : 
                      behavior.agentType.toUpperCase()
    body += `${agentName} 执行了 ${behavior.action}\n`
    
    // 风险分数
    body += `风险分数: ${assessment.overallScore.toFixed(1)}/100\n`
    
    // 目标信息
    if (behavior.target && behavior.target.length < 50) {
      body += `目标: ${behavior.target}\n`
    }
    
    // 最重要的建议
    if (assessment.recommendations.length > 0) {
      const topRecommendation = assessment.recommendations[0]
      body += `\n${topRecommendation}`
    }

    return body
  }

  /**
   * 获取告警历史
   */
  getAlertHistory(limit: number = 10): AlertRecord[] {
    return this.alertHistory.slice(-limit)
  }

  /**
   * 获取告警统计
   */
  getAlertStatistics(): {
    totalAlerts: number
    notifiedCount: number
    riskLevelDistribution: Record<string, number>
    agentTypeDistribution: Record<string, number>
  } {
    const riskLevelDistribution: Record<string, number> = {}
    const agentTypeDistribution: Record<string, number> = {}

    this.alertHistory.forEach(record => {
      // 风险等级分布
      riskLevelDistribution[record.assessment.riskLevel] = 
        (riskLevelDistribution[record.assessment.riskLevel] || 0) + 1
      
      // Agent类型分布
      agentTypeDistribution[record.behavior.agentType] = 
        (agentTypeDistribution[record.behavior.agentType] || 0) + 1
    })

    return {
      totalAlerts: this.alertHistory.length,
      notifiedCount: this.alertHistory.filter(r => r.notified).length,
      riskLevelDistribution,
      agentTypeDistribution
    }
  }

  /**
   * 清空告警历史
   */
  clearHistory(): void {
    this.alertHistory = []
  }

  /**
   * 设置最小告警间隔
   */
  setMinAlertInterval(intervalMs: number): void {
    this.minAlertInterval = intervalMs
  }
}

// 导出单例
export const proactiveAlerter = new ProactiveAlerter()