/**
 * 数据存储服务
 */

import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { OperationRecord } from '../monitoring/fileMonitor'
import { logger } from './loggerService'

export class StorageService {
  private dataPath: string
  private operationsFile: string

  constructor() {
    this.dataPath = path.join(app.getPath('userData'), 'data')
    this.operationsFile = path.join(this.dataPath, 'operations.json')

    // 确保数据目录存在
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true })
    }
  }

  async saveOperation(operation: OperationRecord): Promise<{ success: boolean; count?: number; error?: string }> {
    try {
      logger.info('[StorageService] 开始保存记录', { module: 'StorageService' }, { operationId: operation.id })
      logger.debug('[StorageService] 存储路径:', { module: 'StorageService' }, { path: this.operationsFile })

      let operations: OperationRecord[] = []

      if (fs.existsSync(this.operationsFile)) {
        const data = fs.readFileSync(this.operationsFile, 'utf-8')
        operations = JSON.parse(data)
        logger.debug('[StorageService] 当前记录数:', { module: 'StorageService' }, { count: operations.length })
      } else {
        logger.debug('[StorageService] 文件不存在，将创建新文件', { module: 'StorageService' })
      }

      // 添加时间戳和审计哈希
      const newOperation = {
        ...operation,
        timestamp: operation.timestamp || new Date().toISOString(),
        audit_hash: operation.audit_hash || `hash-${Date.now()}-${Math.random().toString(36).substring(7)}`
      }

      operations.push(newOperation)
      logger.info('[StorageService] 新增记录', { module: 'StorageService' }, { newOperationId: operation.id })

      // 保留最近5000条记录（覆盖近30天级别，避免过早丢掉同一天内的记录）
      if (operations.length > 5000) {
        operations = operations.slice(-5000)
        logger.info('[StorageService] 保留最近5000条记录', { module: 'StorageService' })
      }

      fs.writeFileSync(this.operationsFile, JSON.stringify(operations, null, 2))
      logger.info('[StorageService] ✅ 保存成功', { module: 'StorageService' }, { title: operation.title })
      logger.debug('[StorageService] 总记录数:', { module: 'StorageService' }, { count: operations.length })
      return { success: true, count: operations.length }
    } catch (error) {
      logger.error('[StorageService] ❌ 保存失败:', { module: 'StorageService' }, { error })
      return { success: false, error: String(error) }
    }
  }

  async getOperations(): Promise<OperationRecord[]> {
    try {
      if (fs.existsSync(this.operationsFile)) {
        const data = fs.readFileSync(this.operationsFile, 'utf-8')
        return JSON.parse(data)
      }
      return []
    } catch (error) {
      logger.error('读取操作记录失败:', { module: 'StorageService' }, { error })
      return []
    }
  }

  async clearOperations(): Promise<{ success: boolean; error?: string }> {
    try {
      fs.writeFileSync(this.operationsFile, '[]')
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }

  async exportData(format: 'json' | 'txt'): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
      if (!fs.existsSync(this.operationsFile)) {
        return { success: false, error: '无数据可导出' }
      }

      const data = fs.readFileSync(this.operationsFile, 'utf-8')
      const operations = JSON.parse(data)

      const exportPath = path.join(app.getPath('downloads'), `yijiandaodi-export-${Date.now()}.${format}`)

      if (format === 'json') {
        fs.writeFileSync(exportPath, data)
      } else {
        // 简单的文本格式
        const text = operations.map((op: OperationRecord) =>
          `${op.timestamp} [${op.type}] ${op.content}`
        ).join('\n')
        fs.writeFileSync(exportPath, text)
      }

      return { success: true, path: exportPath }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }

  getDataPath(): string {
    return this.dataPath
  }
}