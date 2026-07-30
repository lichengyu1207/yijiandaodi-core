/**
 * 数据存储服务
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { OperationRecord, StorageConfig } from '../types';

export class StorageService {
  private dataPath: string;
  private operationsFile: string;
  private maxRecords: number;

  constructor(config?: StorageConfig) {
    // 默认路径：用户目录/.yijiandaodi/data
    this.dataPath = config?.path || path.join(os.homedir(), '.yijiandaodi', 'data');
    this.operationsFile = path.join(this.dataPath, 'operations.json');
    this.maxRecords = config?.maxRecords || 100;

    // 确保数据目录存在
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true });
    }
  }

  /**
   * 保存操作记录
   */
  async saveOperation(operation: OperationRecord): Promise<{ success: boolean; count?: number; error?: string }> {
    try {
      let operations: OperationRecord[] = [];

      if (fs.existsSync(this.operationsFile)) {
        const data = fs.readFileSync(this.operationsFile, 'utf-8');
        operations = JSON.parse(data);
      }

      // 添加时间戳和审计哈希
      const newOperation = {
        ...operation,
        timestamp: operation.timestamp || new Date().toISOString(),
        audit_hash: operation.audit_hash || `hash-${Date.now()}-${Math.random().toString(36).substring(7)}`
      };

      operations.push(newOperation);

      // 只保留最近的记录
      if (operations.length > this.maxRecords) {
        operations = operations.slice(-this.maxRecords);
      }

      fs.writeFileSync(this.operationsFile, JSON.stringify(operations, null, 2));
      return { success: true, count: operations.length };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * 获取所有操作记录
   */
  async getOperations(): Promise<OperationRecord[]> {
    try {
      if (fs.existsSync(this.operationsFile)) {
        const data = fs.readFileSync(this.operationsFile, 'utf-8');
        return JSON.parse(data);
      }
      return [];
    } catch (error) {
      console.error('[StorageService] 读取记录失败:', error);
      return [];
    }
  }

  /**
   * 清除所有记录
   */
  async clearOperations(): Promise<{ success: boolean; error?: string }> {
    try {
      fs.writeFileSync(this.operationsFile, '[]');
      return { success: true };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * 导出数据
   */
  async exportData(format: 'json' | 'txt' = 'json'): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
      if (!fs.existsSync(this.operationsFile)) {
        return { success: false, error: '无数据可导出' };
      }

      const data = fs.readFileSync(this.operationsFile, 'utf-8');
      const operations = JSON.parse(data);

      const exportPath = path.join(
        os.homedir(),
        'Downloads',
        `yijiandaodi-export-${Date.now()}.${format}`
      );

      if (format === 'json') {
        fs.writeFileSync(exportPath, data);
      } else {
        const text = operations.map((op: OperationRecord) =>
          `${op.timestamp} [${op.type}] ${op.content}`
        ).join('\n');
        fs.writeFileSync(exportPath, text);
      }

      return { success: true, path: exportPath };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * 获取数据路径
   */
  getDataPath(): string {
    return this.dataPath;
  }
}