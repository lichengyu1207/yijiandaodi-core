/**
 * 文件监控模块 - 集成污点追踪
 */

import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { SecurityKnowledgeBase } from '../securityKnowledgeBase'
import { AutoDetector, autoDetector } from './autoDetector'
import { PetState } from '../windows/petWindow'
import { logger } from '../services/loggerService'
import { TaintTracker, taintTracker, TaintType } from './taintTracking'

export interface FileMonitorConfig {
  watchPaths: string[]
}

export interface RiskResult {
  type: 'sqli' | 'xss' | 'password' | 'apikey' | 'sensitive'
  matched: string
  risk: 'high' | 'medium' | 'low'
}

export interface OperationRecord {
  id: string
  type: string
  title: string
  content: string
  source: string
  status: string
  risk_level: string
  risk_score: number
  should_block: boolean
  context: string
  explanation: string
  timestamp?: string
  audit_hash?: string
}

export class FileMonitor {
  private fileWatcher: fs.FSWatcher | null = null
  private securityKB: SecurityKnowledgeBase | null = null
  private autoDetector: AutoDetector
  private config: FileMonitorConfig
  private onRiskDetected?: (risks: RiskResult[], filePath: string) => void
  private onPetStateChange?: (state: PetState, message?: string) => void
  private onSaveRecord?: (record: OperationRecord) => Promise<void>

  constructor(config?: FileMonitorConfig) {
    this.config = config || {
      watchPaths: [
        path.join(app.getPath('home'), 'Documents'),
        path.join(app.getPath('home'), 'Desktop'),
      ]
    }
    this.autoDetector = new AutoDetector()
  }

  setSecurityKnowledgeBase(kb: SecurityKnowledgeBase) {
    this.securityKB = kb
    this.autoDetector.setSecurityKnowledgeBase(kb)
  }

  setRiskDetectedCallback(callback: (risks: RiskResult[], filePath: string) => void) {
    this.onRiskDetected = callback
  }

  setPetStateChangeCallback(callback: (state: PetState, message?: string) => void) {
    this.onPetStateChange = callback
  }

  setSaveRecordCallback(callback: (record: OperationRecord) => Promise<void>) {
    this.onSaveRecord = callback
  }

  start() {
    if (this.fileWatcher) {
      logger.info('[文件监控] 已在运行', { module: 'FileMonitor' })
      return
    }

    logger.info('[文件监控] 启动...', { module: 'FileMonitor' })

    this.config.watchPaths.forEach(watchPath => {
      if (fs.existsSync(watchPath)) {
        this.fileWatcher = fs.watch(watchPath, { recursive: true }, (eventType, filename) => {
          if (filename) {
            logger.info(`[文件监控] ${eventType}: ${filename}`, { module: 'FileMonitor' })

            // 触发检测
            const filePath = path.join(watchPath, filename)
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
              this.triggerDetection(filePath)
            }
          }
        })
      }
    })
  }

  stop() {
    if (this.fileWatcher) {
      this.fileWatcher.close()
      this.fileWatcher = null
    }
  }

  private async triggerDetection(filePath: string) {
    try {
      // 读取文件内容
      const content = fs.readFileSync(filePath, 'utf-8')

      logger.info('[文件监控] 开始自动检测:', { module: 'FileMonitor' }, { file: path.basename(filePath) })

      // 使用自动化检测器进行综合检测
      const detectionResult = this.autoDetector.detect(content)

      logger.info('[文件监控] 检测结果:', { module: 'FileMonitor' }, {
        safe: detectionResult.safe,
        risk_level: detectionResult.risk_level,
        content_type: detectionResult.content_type,
        language: detectionResult.detected_language,
        risks_count: detectionResult.risks.length,
        sensitivity: detectionResult.sensitivity_level
      })

      if (!detectionResult.safe || detectionResult.risks.length > 0) {
        // ===== 污点追踪集成开始 =====
        logger.info('[污点追踪] 开始处理文件污点', { module: 'TaintTracking' }, {
          filePath,
          riskLevel: detectionResult.risk_level
        })

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

        // 创建污点标记
        const taint = taintTracker.createTaint(
          content.substring(0, 1000),  // 只使用前1000字符作为指纹
          filePath,
          taintType,
          {
            fileName: path.basename(filePath),
            fileType: path.extname(filePath),
            size: content.length,
            tags: [...new Set(detectionResult.risks.map(r => r.type))]
          }
        )

        logger.info('[污点追踪] ✅ 文件污点已标记', { module: 'TaintTracking' }, {
          taintId: taint.id,
          type: taint.type,
          source: taint.source
        })

        // 记录文件读取操作（污点传播）
        taintTracker.trackPropagation(
          taint.id,
          filePath,
          `memory:process:${process.pid}`,
          'file_read',
          {
            processName: 'FileMonitor'
          }
        )
        // ===== 污点追踪集成结束 =====

        // 统计风险等级
        const highRisks = detectionResult.risks.filter(r => r.risk === 'high')
        const mediumRisks = detectionResult.risks.filter(r => r.risk === 'medium')

        logger.warn('[文件] 发现安全风险:', { module: 'FileMonitor' }, {
          file: filePath,
          total: detectionResult.risks.length,
          high: highRisks.length,
          medium: mediumRisks.length,
          types: [...new Set(detectionResult.risks.map(r => r.type))],
          warnings: detectionResult.warnings
        })

        // 保存操作记录
        if (this.onSaveRecord) {
          logger.debug('[文件监控] 准备保存记录...', { module: 'FileMonitor' })
          const record = {
            id: `file-${Date.now()}`,
            type: 'file_op',
            title: `文件安全检测: ${path.basename(filePath)}`,
            content: `文件 ${path.basename(filePath)} 中发现${detectionResult.risks.length}个安全风险`,
            source: '文件监控',
            status: 'flagged',
            risk_level: detectionResult.risk_level,
            risk_score: detectionResult.risk_level === 'critical' ? 100 : detectionResult.risk_level === 'high' ? 80 : 50,
            should_block: ['high', 'critical'].includes(detectionResult.risk_level),
            context: `文件路径: ${filePath}\n内容类型: ${detectionResult.content_type}\n检测语言: ${detectionResult.detected_language || 'unknown'}\n敏感等级: ${detectionResult.sensitivity_level}\n风险类型: ${[...new Set(detectionResult.risks.map(r => r.type))].join(', ')}\n风险详情:\n${detectionResult.risks.slice(0, 5).map(r => `- ${r.type}: ${r.matched}`).join('\n')}\n警告:\n${detectionResult.warnings.slice(0, 5).join('\n')}`,
            explanation: `检测到${highRisks.length}个高风险, ${mediumRisks.length}个中风险。${detectionResult.warnings.length}个警告。`
          }

          try {
            await this.onSaveRecord(record)
            logger.info('[文件监控] ✅ 记录保存成功:', { module: 'FileMonitor' }, { recordId: record.id })
          } catch (error) {
            logger.error('[文件监控] ❌ 记录保存失败:', { module: 'FileMonitor' }, { error })
          }
        } else {
          logger.warn('[文件监控] ⚠️ onSaveRecord 回调未设置', { module: 'FileMonitor' })
        }

        // 更新桌宠状态
        if (this.onPetStateChange) {
          this.onPetStateChange('red', `文件检测到${highRisks.length}个高风险, ${mediumRisks.length}个中风险`)
        }

        // 触发风险检测回调
        if (this.onRiskDetected) {
          this.onRiskDetected(detectionResult.risks as RiskResult[], filePath)
        }
      } else {
        // 未发现风险，不保存安全记录（避免记录过多）
        logger.info('[文件监控] 文件检测通过:', { module: 'FileMonitor' }, { file: path.basename(filePath) })

        // 短暂显示黄灯后恢复
        if (this.onPetStateChange) {
          this.onPetStateChange('yellow', '文件检测中')
          setTimeout(() => {
            if (this.onPetStateChange) {
              this.onPetStateChange('green', '文件安全')
            }
          }, 1000)
        }
      }
    } catch (error: any) {
      logger.error('[文件检测] 失败:', { module: 'FileMonitor' }, { error: error.message })
    }
  }
}