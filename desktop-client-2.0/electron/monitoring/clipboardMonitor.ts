/**
 * 剪贴板监控模块
 */

import { clipboard } from 'electron'
import { SecurityKnowledgeBase, detectSecurityRisks } from '../securityKnowledgeBase'
import { PetState } from '../windows/petWindow'
import { RiskResult, OperationRecord } from './fileMonitor'

export class ClipboardMonitor {
  private clipboardWatcher: NodeJS.Timeout | null = null
  private lastClipboardContent: string = ''
  private securityKB: SecurityKnowledgeBase | null = null
  private onRiskDetected?: (risks: RiskResult[], content: string) => void
  private onPetStateChange?: (state: PetState, message?: string) => void
  private onSaveRecord?: (record: OperationRecord) => Promise<void>

  setSecurityKnowledgeBase(kb: SecurityKnowledgeBase) {
    this.securityKB = kb
  }

  setRiskDetectedCallback(callback: (risks: RiskResult[], content: string) => void) {
    this.onRiskDetected = callback
  }

  setPetStateChangeCallback(callback: (state: PetState, message?: string) => void) {
    this.onPetStateChange = callback
  }

  setSaveRecordCallback(callback: (record: OperationRecord) => Promise<void>) {
    this.onSaveRecord = callback
  }

  start() {
    if (this.clipboardWatcher) {
      console.log('[剪贴板监控] 已在运行')
      return
    }

    console.log('[剪贴板监控] 启动...')

    // 每500ms检查一次剪贴板
    this.clipboardWatcher = setInterval(() => {
      try {
        const currentContent = clipboard.readText()

        // 如果剪贴板内容发生变化
        if (currentContent && currentContent !== this.lastClipboardContent) {
          this.lastClipboardContent = currentContent
          console.log('[剪贴板] 检测到新内容')

          // 触发剪贴板检测
          this.triggerDetection(currentContent)
        }
      } catch (error: any) {
        console.error('[剪贴板监控] 错误:', error.message)
      }
    }, 500)
  }

  stop() {
    if (this.clipboardWatcher) {
      clearInterval(this.clipboardWatcher)
      this.clipboardWatcher = null
      console.log('[剪贴板监控] 已停止')
    }
  }

  private async triggerDetection(content: string) {
    try {
      if (!this.securityKB) {
        console.warn('[剪贴板检测] 安全知识库未初始化')
        return
      }

      // 使用安全知识库检测
      const risks = detectSecurityRisks(content, this.securityKB)

      if (risks.length > 0) {
        // 统计风险等级
        const highRisks = risks.filter(r => r.risk === 'high')
        const mediumRisks = risks.filter(r => r.risk === 'medium')

        console.log('[剪贴板] 发现安全风险:', {
          total: risks.length,
          high: highRisks.length,
          medium: mediumRisks.length,
          types: [...new Set(risks.map(r => r.type))]
        })

        // 保存操作记录
        if (this.onSaveRecord) {
          console.log('[剪贴板监控] 准备保存记录...')
          const record = {
            id: `clipboard-${Date.now()}`,
            type: 'ai_dialog',
            title: '剪贴板安全检测',
            content: `剪贴板中发现${risks.length}个安全风险`,
            source: '剪贴板监控',
            status: 'flagged',
            risk_level: highRisks.length > 0 ? 'high' : 'medium',
            risk_score: highRisks.length > 0 ? 80 : 50,
            should_block: highRisks.length > 0,
            context: `风险类型: ${[...new Set(risks.map(r => r.type))].join(', ')}\n风险详情:\n${risks.slice(0, 5).map(r => `- ${r.type}: ${r.matched}`).join('\n')}`,
            explanation: `检测到${highRisks.length}个高风险, ${mediumRisks.length}个中风险`
          }
          
          try {
            await this.onSaveRecord(record)
            console.log('[剪贴板监控] ✅ 记录保存成功:', record.id)
          } catch (error) {
            console.error('[剪贴板监控] ❌ 记录保存失败:', error)
          }
        } else {
          console.warn('[剪贴板监控] ⚠️ onSaveRecord 回调未设置')
        }

        // 更新桌宠状态
        if (this.onPetStateChange) {
          this.onPetStateChange('red', `检测到${highRisks.length}个高风险, ${mediumRisks.length}个中风险`)
        }

        // 触发风险检测回调
        if (this.onRiskDetected) {
          this.onRiskDetected(risks, content)
        }
      } else {
        // 未发现风险
        console.log('[剪贴板监控] 内容检测通过')
      }
    } catch (error: any) {
      console.error('[剪贴板检测] 失败:', error.message)
    }
  }
}