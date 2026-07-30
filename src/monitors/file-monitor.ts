/**
 * 文件监控模块
 */

import * as fs from 'fs';
import * as path from 'path';
import { SecurityKnowledgeBase, detectSecurityRisks } from '../security-knowledge-base';
import { MonitorConfig } from '../types';

export class FileMonitor {
  private fileWatcher: fs.FSWatcher | null = null;
  private securityKB: SecurityKnowledgeBase;
  private config: MonitorConfig;

  constructor(securityKB: SecurityKnowledgeBase, config?: MonitorConfig) {
    this.securityKB = securityKB;
    this.config = config || { enabled: true };
  }

  /**
   * 开始监控
   */
  start(): void {
    if (this.fileWatcher) {
      console.log('[FileMonitor] 已在运行');
      return;
    }

    const watchPaths = this.config.paths || ['.'];

    console.log('[FileMonitor] 启动监控...');
    console.log('[FileMonitor] 监控路径:', watchPaths);

    watchPaths.forEach(watchPath => {
      if (fs.existsSync(watchPath)) {
        this.fileWatcher = fs.watch(watchPath, { recursive: true }, (eventType, filename) => {
          if (filename) {
            console.log(`[FileMonitor] ${eventType}: ${filename}`);
            this.triggerDetection(path.join(watchPath, filename));
          }
        });
      }
    });
  }

  /**
   * 停止监控
   */
  stop(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
      console.log('[FileMonitor] 已停止');
    }
  }

  /**
   * 触发检测
   */
  private async triggerDetection(filePath: string): Promise<void> {
    try {
      // 检查文件是否存在且是文件
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        return;
      }

      // 读取文件内容
      const content = fs.readFileSync(filePath, 'utf-8');

      // 使用安全知识库检测
      const risks = detectSecurityRisks(content, this.securityKB);

      if (risks.length > 0) {
        const highRisks = risks.filter(r => r.risk === 'high');
        const mediumRisks = risks.filter(r => r.risk === 'medium');

        console.log('[FileMonitor] 发现安全风险:', {
          file: filePath,
          total: risks.length,
          high: highRisks.length,
          medium: mediumRisks.length,
          types: [...new Set(risks.map(r => r.type))]
        });
      }
    } catch (error: any) {
      console.error('[FileMonitor] 检测失败:', error.message);
    }
  }
}