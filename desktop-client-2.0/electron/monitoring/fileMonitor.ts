/**
 * 文件监控模块
 */

import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import { SecurityKnowledgeBase, detectSecurityRisks } from '../securityKnowledgeBase'
import { PetState } from '../windows/petWindow'

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
  }

  setSecurityKnowledgeBase(kb: SecurityKnowledgeBase) {
    this.securityKB = kb
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
      console.log('[文件监控] 已在运行')
      return
    }

    console.log('[文件监控] 启动...')

    this.config.watchPaths.forEach(watchPath => {
      if (fs.existsSync(watchPath)) {
        this.fileWatcher = fs.watch(watchPath, { recursive: true }, (eventType, filename) => {
          if (filename) {
            console.log(`[文件监控] ${eventType}: ${filename}`)

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
      if (!this.securityKB) {
        console.warn('[文件检测] 安全知识库未初始化')
        return
      }

      // 读取文件内容
      const content = fs.readFileSync(filePath, 'utf-8')

      // 使用安全知识库检测
      const risks = detectSecurityRisks(content, this.securityKB)

      if (risks.length > 0) {
        // 统计风险等级
        const highRisks = risks.filter(r => r.risk === 'high')
        const mediumRisks = risks.filter(r => r.risk === 'medium')

        console.log('[文件] 发现安全风险:', {
          file: filePath,
          total: risks.length,
          high: highRisks.length,
          medium: mediumRisks.length,
          types: [...new Set(risks.map(r => r.type))]
        })

        // 保存操作记录
        if (this.onSaveRecord) {
          console.log('[文件监控] 准备保存记录...')
          const record = {
            id: `file-${Date.now()}`,
            type: 'file_op',
            title: `文件安全检测: ${path.basename(filePath)}`,
            content: `文件 ${path.basename(filePath)} 中发现${risks.length}个安全风险`,
            source: '文件监控',
            status: 'flagged',
            risk_level: highRisks.length > 0 ? 'high' : 'medium',
            risk_score: highRisks.length > 0 ? 80 : 50,
            should_block: highRisks.length > 0,
            context: `文件路径: ${filePath}\n风险类型: ${[...new Set(risks.map(r => r.type))].join(', ')}\n风险详情:\n${risks.slice(0, 5).map(r => `- ${r.type}: ${r.matched}`).join('\n')}`,
            explanation: `检测到${highRisks.length}个高风险, ${mediumRisks.length}个中风险`
          }
          
          try {
            await this.onSaveRecord(record)
            console.log('[文件监控] ✅ 记录保存成功:', record.id)
          } catch (error) {
            console.error('[文件监控] ❌ 记录保存失败:', error)
          }
        } else {
          console.warn('[文件监控] ⚠️ onSaveRecord 回调未设置')
        }

        // 更新桌宠状态
        if (this.onPetStateChange) {
          this.onPetStateChange('red', `文件检测到${highRisks.length}个高风险, ${mediumRisks.length}个中风险`)
        }

        // 触发风险检测回调
        if (this.onRiskDetected) {
          this.onRiskDetected(risks, filePath)
        }
      } else {
        // 未发现风险，不保存安全记录（避免记录过多）
        console.log('[文件监控] 文件检测通过:', path.basename(filePath))
        
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
      console.error('[文件检测] 失败:', error.message)
    }
  }
}