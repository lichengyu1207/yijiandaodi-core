/**
 * 数据存储服务
 */

import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { OperationRecord } from '../monitoring/fileMonitor'

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
      console.log('[StorageService] 开始保存记录:', operation.id)
      console.log('[StorageService] 存储路径:', this.operationsFile)
      
      let operations: OperationRecord[] = []

      if (fs.existsSync(this.operationsFile)) {
        const data = fs.readFileSync(this.operationsFile, 'utf-8')
        operations = JSON.parse(data)
        console.log('[StorageService] 当前记录数:', operations.length)
      } else {
        console.log('[StorageService] 文件不存在，将创建新文件')
      }

      // 添加时间戳和审计哈希
      const newOperation = {
        ...operation,
        timestamp: operation.timestamp || new Date().toISOString(),
        audit_hash: operation.audit_hash || `hash-${Date.now()}-${Math.random().toString(36).substring(7)}`
      }
      
      operations.push(newOperation)
      console.log('[StorageService] 新增记录:', newOperation.id)

      // 只保留最近100条记录
      if (operations.length > 100) {
        operations = operations.slice(-100)
        console.log('[StorageService] 保留最近100条记录')
      }

      fs.writeFileSync(this.operationsFile, JSON.stringify(operations, null, 2))
      console.log('[StorageService] ✅ 保存成功:', operation.title)
      console.log('[StorageService] 总记录数:', operations.length)
      return { success: true, count: operations.length }
    } catch (error) {
      console.error('[StorageService] ❌ 保存失败:', error)
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
      console.error('读取操作记录失败:', error)
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