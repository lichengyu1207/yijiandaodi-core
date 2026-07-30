/**
 * 一鉴到底核心类
 * 提供完整的AI操作行为审计和安全监控功能
 */

import { SecurityKnowledgeBase, initSecurityKnowledgeBase, detectSecurityRisks } from './security-knowledge-base';
import { FileMonitor } from './monitors/file-monitor';
import { StorageService } from './services/storage-service';
import { RiskDetector } from './detectors/risk-detector';
import { OperationRecord, RiskResult, CoreConfig } from './types';

export class YijianDaoDiCore {
  private securityKB: SecurityKnowledgeBase;
  private fileMonitor?: FileMonitor;
  private storageService?: StorageService;
  private riskDetector: RiskDetector;
  private config: CoreConfig;

  constructor(config?: CoreConfig) {
    this.config = config || {};
    this.securityKB = initSecurityKnowledgeBase();
    this.riskDetector = new RiskDetector(this.securityKB);

    if (this.config.storage) {
      this.storageService = new StorageService(this.config.storage);
    }

    if (this.config.fileMonitor?.enabled) {
      this.fileMonitor = new FileMonitor(this.securityKB, this.config.fileMonitor);
    }
  }

  /**
   * 检测内容中的安全风险
   * @param content 要检测的内容
   * @returns 检测到的风险列表
   */
  detect(content: string): RiskResult[] {
    return this.securityKB.detect(content);
  }

  /**
   * 检测内容并返回详细报告
   * @param content 要检测的内容
   * @param context 上下文信息（如文件路径、来源等）
   * @returns 操作记录
   */
  detectWithReport(content: string, context?: string): OperationRecord {
    const risks = this.detect(content);
    const highRisks = risks.filter(r => r.risk === 'high');
    const mediumRisks = risks.filter(r => r.risk === 'medium');

    const record: OperationRecord = {
      id: `detect-${Date.now()}`,
      type: 'other',
      title: '安全检测',
      content: content.substring(0, 200),
      source: context || '手动检测',
      status: risks.length > 0 ? 'flagged' : 'verified',
      risk_level: highRisks.length > 0 ? 'high' : mediumRisks.length > 0 ? 'medium' : 'low',
      risk_score: highRisks.length > 0 ? 80 : mediumRisks.length > 0 ? 50 : 10,
      should_block: highRisks.length > 0,
      context: context || '',
      explanation: `检测到${highRisks.length}个高风险，${mediumRisks.length}个中风险`,
      timestamp: new Date().toISOString(),
      audit_hash: this.generateAuditHash(content, risks, new Date().toISOString())
    };

    // 保存记录
    if (this.storageService) {
      this.storageService.saveOperation(record);
    }

    // 触发回调
    if (risks.length > 0 && this.config.callbacks?.onRiskDetected) {
      this.config.callbacks.onRiskDetected(risks, context || '');
    }

    if (this.config.callbacks?.onRecordSaved) {
      this.config.callbacks.onRecordSaved(record);
    }

    return record;
  }

  /**
   * 启动文件监控
   */
  startFileMonitoring(): void {
    if (this.fileMonitor) {
      this.fileMonitor.start();
    } else {
      console.warn('[YijianDaoDi] 文件监控未配置');
    }
  }

  /**
   * 停止文件监控
   */
  stopFileMonitoring(): void {
    if (this.fileMonitor) {
      this.fileMonitor.stop();
    }
  }

  /**
   * 获取审计记录
   */
  async getRecords(): Promise<OperationRecord[]> {
    if (!this.storageService) {
      console.warn('[YijianDaoDi] 存储服务未配置');
      return [];
    }
    return await this.storageService.getOperations();
  }

  /**
   * 导出审计记录
   * @param format 导出格式
   */
  async exportRecords(format: 'json' | 'txt' = 'json'): Promise<string> {
    if (!this.storageService) {
      throw new Error('存储服务未配置');
    }
    const result = await this.storageService.exportData(format);
    return result.path || '';
  }

  /**
   * 生成审计哈希
   */
  /**
   * 生成审计哈希（链式存证）
   * 五元组联合哈希：操作指令 + 校验结果 + 确认凭证 + 时间戳 + 前次指纹
   */
  private generateAuditHash(content: string, risks: RiskResult[], timestamp: string): string {
    const crypto = require('crypto');
    
    // 获取前一次哈希（链式存证的关键）
    const previousHash = this.getLastAuditHash();
    
    // 五元组
    const operation = content.substring(0, 100); // 操作指令（截取前100字符）
    const result = risks.length > 0 ? 'flagged' : 'passed'; // 校验结果
    const credential = risks.map(r => r.type).join(','); // 确认凭证（风险类型）
    const time = timestamp; // 时间戳
    const previous = previousHash || '0000000000000000'; // 前次指纹（首次为0）
    
    // 联合哈希
    const combined = `${operation}|${result}|${credential}|${time}|${previous}`;
    const hash = crypto.createHash('sha256').update(combined).digest('hex');
    
    // 返回16位短哈希（方便展示）
    return hash.substring(0, 16);
  }
  
  /**
   * 获取最后一次审计哈希
   */
  private getLastAuditHash(): string | null {
    try {
      if (!this.storageService) return null;
      
      // 使用同步方法获取记录
      const fs = require('fs');
      const path = require('path');
      const operationsFile = path.join(
        require('os').homedir(),
        '.yijiandaodi',
        'data',
        'operations.json'
      );
      
      if (!fs.existsSync(operationsFile)) return null;
      
      const data = fs.readFileSync(operationsFile, 'utf-8');
      const records: OperationRecord[] = JSON.parse(data);
      
      if (records.length === 0) return null;
      
      const lastRecord = records[records.length - 1];
      return lastRecord.audit_hash || null;
    } catch (error) {
      return null;
    }
  }

  private generateHash(): string {
    return `hash-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  /**
   * 获取版本信息
   */
  getVersion(): string {
    return '1.0.0';
  }
}