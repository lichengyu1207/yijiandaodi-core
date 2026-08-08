/**
 * 剪贴板监控模块 - 集成污点追踪
 */

import { clipboard } from 'electron'
import { SecurityKnowledgeBase } from '../securityKnowledgeBase'
import { AutoDetector } from './autoDetector'
import { PetState } from '../windows/petWindow'
import { RiskResult, OperationRecord } from './fileMonitor'
import { logger } from '../services/loggerService'
import { TaintTracker, taintTracker, TaintType } from './taintTracking'

export class ClipboardMonitor {
  private clipboardWatcher: NodeJS.Timeout | null = null
  private lastClipboardContent: string = ''
  private securityKB: SecurityKnowledgeBase | null = null
  private autoDetector: AutoDetector
  private onRiskDetected?: (risks: RiskResult[], content: string) => void
  private onPetStateChange?: (state: PetState, message?: string) => void
  private onSaveRecord?: (record: OperationRecord) => Promise<void>

  constructor() {
    this.autoDetector = new AutoDetector()
  }

  setSecurityKnowledgeBase(kb: SecurityKnowledgeBase) {
    this.securityKB = kb
    this.autoDetector.setSecurityKnowledgeBase(kb)
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
      logger.info('[剪贴板监控] 已停止', { module: 'ClipboardMonitor' })
    }
  }

  private async triggerDetection(content: string) {
    try {
      logger.info('[剪贴板监控] 开始自动检测', { module: 'ClipboardMonitor' })

      // 使用自动化检测器进行综合检测
      const detectionResult = this.autoDetector.detect(content)

      logger.info('[剪贴板监控] 检测结果:', { module: 'ClipboardMonitor' }, {
        safe: detectionResult.safe,
        risk_level: detectionResult.risk_level,
        content_type: detectionResult.content_type,
        language: detectionResult.detected_language,
        risks_count: detectionResult.risks.length,
        sensitivity: detectionResult.sensitivity_level
      })

      if (!detectionResult.safe || detectionResult.risks.length > 0) {
        // ===== 污点追踪集成开始 =====
        logger.info('[污点追踪] 开始处理剪贴板污点', { module: 'TaintTracking' }, {
          contentLength: content.length,
          riskLevel: detectionResult.risk_level
        })

        // 检查剪贴板内容是否来自已知的污点
        const existingTaint = taintTracker.checkTainted(content)

        if (existingTaint) {
          // 记录污点传播（从文件到剪贴板）
          logger.info('[污点追踪] ✅ 检测到已知污点数据', { module: 'TaintTracking' }, {
            taintId: existingTaint.id,
            source: existingTaint.source,
            type: existingTaint.type
          })

          taintTracker.trackPropagation(
            existingTaint.id,
            existingTaint.location,
            'clipboard',
            'clipboard_copy',
            {
              processName: 'ClipboardMonitor'
            }
          )

          logger.warn('[污点追踪] ⚠️ 敏感数据已被复制到剪贴板', { module: 'TaintTracking' }, {
            originalSource: existingTaint.source,
            taintType: existingTaint.type
          })
        } else {
          // 创建新的污点标记（剪贴板为源头）
          logger.info('[污点追踪] 创建新污点标记', { module: 'TaintTracking' })

          // 根据检测结果确定污点类型
          let taintType: TaintType = 'sensitive'
          if (detectionResult.risks.some(r => r.type.includes('api') || r.type.includes('key'))) {
            taintType = 'api_key'
          } else if (detectionResult.risks.some(r => r.type.includes('password') || r.type.includes('credential'))) {
            taintType = 'credential'
          } else if (detectionResult.risks.some(r => r.type.includes('secret'))) {
            taintType = 'secret'
          } else if (detectionResult.risks.some(r => r.type.includes('pii'))) {
            taintType = 'pii'
          }

          const taint = taintTracker.createTaint(
            content.substring(0, 1000),  // 只使用前1000字符作为指纹
            'clipboard',
            taintType,
            {
              size: content.length,
              tags: [...new Set(detectionResult.risks.map(r => r.type))]
            }
          )

          logger.info('[污点追踪] ✅ 剪贴板污点已标记', { module: 'TaintTracking' }, {
            taintId: taint.id,
            type: taint.type
          })

          // 记录剪贴板作为污点源
          taintTracker.trackPropagation(
            taint.id,
            'clipboard',
            `memory:process:${process.pid}`,
            'clipboard_created',
            {
              processName: 'ClipboardMonitor'
            }
          )
        }
        // ===== 污点追踪集成结束 =====

        // 统计风险等级
        const highRisks = detectionResult.risks.filter(r => r.risk === 'high')
        const mediumRisks = detectionResult.risks.filter(r => r.risk === 'medium')

        logger.warn('[剪贴板] 发现安全风险:', { module: 'ClipboardMonitor' }, {
          total: detectionResult.risks.length,
          high: highRisks.length,
          medium: mediumRisks.length,
          types: [...new Set(detectionResult.risks.map(r => r.type))],
          warnings: detectionResult.warnings
        })

        // 保存操作记录
        if (this.onSaveRecord) {
          logger.debug('[剪贴板监控] 准备保存记录...', { module: 'ClipboardMonitor' })
          const record = {
            id: `clipboard-${Date.now()}`,
            type: 'ai_dialog',
            title: '剪贴板安全检测',
            content: `剪贴板中发现${detectionResult.risks.length}个安全风险`,
            source: '剪贴板监控',
            status: 'flagged',
            risk_level: detectionResult.risk_level,
            risk_score: detectionResult.risk_level === 'critical' ? 100 : detectionResult.risk_level === 'high' ? 80 : 50,
            should_block: ['high', 'critical'].includes(detectionResult.risk_level),
            context: `内容类型: ${detectionResult.content_type}\n检测语言: ${detectionResult.detected_language || 'unknown'}\n敏感等级: ${detectionResult.sensitivity_level}\n风险类型: ${[...new Set(detectionResult.risks.map(r => r.type))].join(', ')}\n风险详情:\n${detectionResult.risks.slice(0, 5).map(r => `- ${r.type}: ${r.matched}`).join('\n')}\n警告:\n${detectionResult.warnings.slice(0, 5).join('\n')}`,
            explanation: `检测到${highRisks.length}个高风险, ${mediumRisks.length}个中风险。${detectionResult.warnings.length}个警告。`
          }

          try {
            await this.onSaveRecord(record)
            logger.info('[剪贴板监控] ✅ 记录保存成功:', { module: 'ClipboardMonitor' }, { recordId: record.id })
          } catch (error) {
            logger.error('[剪贴板监控] ❌ 记录保存失败:', { module: 'ClipboardMonitor' }, { error })
          }
        } else {
          logger.warn('[剪贴板监控] ⚠️ onSaveRecord 回调未设置', { module: 'ClipboardMonitor' })
        }

        // 更新桌宠状态
        if (this.onPetStateChange) {
          this.onPetStateChange('red', `检测到${highRisks.length}个高风险, ${mediumRisks.length}个中风险`)
        }

        // 触发风险检测回调
        if (this.onRiskDetected) {
          this.onRiskDetected(detectionResult.risks as RiskResult[], content)
        }
      } else {
        // 未发现风险
        logger.info('[剪贴板监控] 内容检测通过', { module: 'ClipboardMonitor' })
      }
    } catch (error: any) {
      logger.error('[剪贴板检测] 失败:', { module: 'ClipboardMonitor' }, { error: error.message })
    }
  }
}