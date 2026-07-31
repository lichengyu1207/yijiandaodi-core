/**
 * 智能提示管理器
 * 避免频繁弹窗，提供巧妙的提示方式
 */

import { Notification } from 'electron'

// ============================================================================
// 类型定义
// ============================================================================

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

export interface AlertPolicy {
  showPopup: RiskLevel[]           // 弹窗提示的风险等级
  showNotification: RiskLevel[]    // 系统通知的风险等级
  updatePet: RiskLevel[]           // 更新桌宠状态的风险等级
  silentLog: RiskLevel[]           // 仅静默记录的风险等级
  dedupInterval: number            // 去重时间窗口（毫秒）
  maxAlertsPerHour: number         // 每小时最多提示次数
}

export interface AlertOptions {
  riskLevel: RiskLevel
  riskType: string
  message: string
  detail?: string
  filePath?: string
}

// ============================================================================
// 默认提示策略
// ============================================================================

const DEFAULT_POLICY: AlertPolicy = {
  // 仅 critical 才弹窗（实际建议不弹窗）
  showPopup: [],  // ['critical']

  // critical + high 发送系统通知
  showNotification: ['critical', 'high'],

  // 所有风险都更新桌宠
  updatePet: ['low', 'medium', 'high', 'critical'],

  // 所有风险都静默记录
  silentLog: ['low', 'medium', 'high', 'critical'],

  // 同类型风险5分钟内不重复提示
  dedupInterval: 5 * 60 * 1000,

  // 每小时最多提示5次
  maxAlertsPerHour: 5
}

// ============================================================================
// 智能提示器类
// ============================================================================

export class SmartAlerter {
  private policy: AlertPolicy
  private alertHistory: Map<string, number> = new Map()
  private hourlyCount: number = 0
  private lastHourReset: number = Date.now()

  constructor(policy: Partial<AlertPolicy> = {}) {
    this.policy = { ...DEFAULT_POLICY, ...policy }
  }

  /**
   * 处理风险提示
   */
  handleAlert(options: AlertOptions): {
    shouldPopup: boolean
    shouldNotify: boolean
    shouldUpdatePet: boolean
    shouldLog: boolean
  } {
    const { riskLevel, riskType } = options

    // 重置每小时计数
    this.resetHourlyCountIfNeeded()

    // 检查是否超过每小时限制
    if (this.hourlyCount >= this.policy.maxAlertsPerHour) {
      return {
        shouldPopup: false,
        shouldNotify: false,
        shouldUpdatePet: true,  // 仍然更新桌宠
        shouldLog: true         // 仍然记录
      }
    }

    // 检查是否在去重时间窗口内
    if (this.isInDedupWindow(riskType)) {
      return {
        shouldPopup: false,
        shouldNotify: false,
        shouldUpdatePet: true,
        shouldLog: true
      }
    }

    // 记录本次提示
    this.recordAlert(riskType)

    return {
      shouldPopup: this.policy.showPopup.includes(riskLevel),
      shouldNotify: this.policy.showNotification.includes(riskLevel),
      shouldUpdatePet: this.policy.updatePet.includes(riskLevel),
      shouldLog: this.policy.silentLog.includes(riskLevel)
    }
  }

  /**
   * 发送系统通知
   */
  sendNotification(title: string, body: string, silent: boolean = false) {
    new Notification({
      title,
      body,
      silent,
      timeoutType: 'default'
    }).show()
  }

  /**
   * 检查是否在去重时间窗口内
   */
  private isInDedupWindow(riskType: string): boolean {
    const lastAlert = this.alertHistory.get(riskType)
    if (!lastAlert) return false

    return Date.now() - lastAlert < this.policy.dedupInterval
  }

  /**
   * 记录本次提示
   */
  private recordAlert(riskType: string) {
    this.alertHistory.set(riskType, Date.now())
    this.hourlyCount++
  }

  /**
   * 重置每小时计数
   */
  private resetHourlyCountIfNeeded() {
    const now = Date.now()
    if (now - this.lastHourReset >= 60 * 60 * 1000) {
      this.hourlyCount = 0
      this.lastHourReset = now
      this.alertHistory.clear()
    }
  }

  /**
   * 获取当前小时的提示次数
   */
  getHourlyCount(): number {
    this.resetHourlyCountIfNeeded()
    return this.hourlyCount
  }

  /**
   * 清除提示历史
   */
  clearHistory() {
    this.alertHistory.clear()
    this.hourlyCount = 0
    this.lastHourReset = Date.now()
  }
}

// 导出单例实例（使用默认策略）
export const smartAlerter = new SmartAlerter()