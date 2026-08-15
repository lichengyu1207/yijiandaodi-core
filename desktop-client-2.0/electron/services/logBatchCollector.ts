/**
 * Agent活动日志批量收集器
 *
 * 功能：
 * 1. 收集Agent行为事件队列
 * 2. 本地SQLite缓冲（容量上限50MB）
 * 3. 定时批量上报（30秒/100条触发）
 * 4. 失败重试机制（最多3次，指数退避）
 */

import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { agentBehaviorParser, AgentBehaviorLog } from '../monitoring/agentBehaviorParser';

// API配置
const API_BASE = import.meta.env.DEV
  ? 'http://localhost:9092/api'
  : 'https://yijiandaodi.com/api';

// 配置参数
const CONFIG = {
  MAX_BATCH_SIZE: 100, // 单次上报最大条数
  MAX_RETRY_COUNT: 3, // 最大重试次数
  RETRY_BASE_DELAY: 1000, // 重试基础延迟（毫秒）
  UPLOAD_INTERVAL: 30000, // 定时上报间隔（30秒）
  MAX_DB_SIZE_MB: 50, // 数据库最大容量（MB）
  MAX_AGE_HOURS: 1, // 本地缓冲最大保留时间（小时）
};

/**
 * Agent活动日志批量收集器
 */
export class LogBatchCollector {
  private db: Database.Database | null = null;
  private dbPath: string;
  private clientId: string;
  private sessionId: string;
  private uploadTimer: NodeJS.Timeout | null = null;
  private isUploading = false;

  constructor() {
    // 数据库路径
    const userDataPath = app.getPath('userData');
    this.dbPath = path.join(userDataPath, 'agent-activities.db');

    // 客户端ID（首次启动生成，后续保持不变）
    const clientIdPath = path.join(userDataPath, 'client-id.txt');
    if (fs.existsSync(clientIdPath)) {
      this.clientId = fs.readFileSync(clientIdPath, 'utf-8').trim();
    } else {
      this.clientId = `desktop_${uuidv4().replace(/-/g, '')}`;
      fs.writeFileSync(clientIdPath, this.clientId);
    }

    // 会话ID（每次启动生成新的）
    this.sessionId = `session_${uuidv4().replace(/-/g, '')}`;

    this.initializeDatabase();
    this.startUploadTimer();
  }

  /**
   * 初始化SQLite数据库
   */
  private initializeDatabase(): void {
    try {
      this.db = new Database(this.dbPath);

      // 创建表
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS agent_activities (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          agent_type TEXT NOT NULL,
          action TEXT NOT NULL,
          target TEXT NOT NULL,
          risk_level TEXT NOT NULL,
          risk_score INTEGER NOT NULL,
          confidence REAL NOT NULL,
          source TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          session_id TEXT NOT NULL,
          client_id TEXT NOT NULL,
          metadata TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          uploaded_at TEXT,
          retry_count INTEGER DEFAULT 0
        )
      `);

      // 创建索引
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_timestamp ON agent_activities(timestamp);
        CREATE INDEX IF NOT EXISTS idx_uploaded ON agent_activities(uploaded_at);
      `);

      // 检查数据库大小
      this.checkDatabaseSize();

      // 清理过期数据
      this.cleanupOldData();

      console.log('[LogBatchCollector] 数据库初始化成功:', this.dbPath);
    } catch (error) {
      console.error('[LogBatchCollector] 数据库初始化失败:', error);
    }
  }

  /**
   * 收集Agent行为日志
   */
  public collectActivity(behaviorLog: AgentBehaviorLog): void {
    if (!this.db) {
      console.error('[LogBatchCollector] 数据库未初始化');
      return;
    }

    try {
      const stmt = this.db.prepare(`
        INSERT INTO agent_activities (
          agent_type, action, target, risk_level, risk_score,
          confidence, source, timestamp, session_id, client_id, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        behaviorLog.agentType,
        behaviorLog.action,
        behaviorLog.target,
        behaviorLog.riskLevel,
        behaviorLog.riskScore,
        behaviorLog.confidence || 1.0,
        behaviorLog.source,
        behaviorLog.timestamp.toISOString(),
        this.sessionId,
        this.clientId,
        JSON.stringify(behaviorLog.details || {})
      );

      // 检查是否达到批量上报阈值
      this.checkBatchThreshold();
    } catch (error) {
      console.error('[LogBatchCollector] 收集日志失败:', error);
    }
  }

  /**
   * 检查批量上报阈值
   */
  private checkBatchThreshold(): void {
    if (!this.db) return;

    const count = this.db.prepare('SELECT COUNT(*) as count FROM agent_activities WHERE uploaded_at IS NULL').get() as { count: number };

    if (count.count >= CONFIG.MAX_BATCH_SIZE) {
      console.log(`[LogBatchCollector] 达到批量上报阈值: ${count.count} 条`);
      this.uploadBatch();
    }
  }

  /**
   * 定时上报器
   */
  private startUploadTimer(): void {
    this.uploadTimer = setInterval(() => {
      if (!this.isUploading) {
        this.uploadBatch();
      }
    }, CONFIG.UPLOAD_INTERVAL);
  }

  /**
   * 批量上报到后端
   */
  private async uploadBatch(): Promise<void> {
    if (!this.db || this.isUploading) return;

    this.isUploading = true;

    try {
      // 查询待上报的日志
      const rows = this.db.prepare(`
        SELECT * FROM agent_activities
        WHERE uploaded_at IS NULL
        ORDER BY timestamp ASC
        LIMIT ?
      `).all(CONFIG.MAX_BATCH_SIZE) as any[];

      if (rows.length === 0) {
        this.isUploading = false;
        return;
      }

      // 构建请求数据
      const activities = rows.map(row => ({
        agent_type: row.agent_type,
        action: row.action,
        target: row.target,
        risk_level: row.risk_level,
        risk_score: row.risk_score,
        confidence: row.confidence,
        source: row.source,
        timestamp: row.timestamp,
        session_id: row.session_id,
        metadata: JSON.parse(row.metadata || '{}'),
      }));

      const payload = {
        client_id: this.clientId,
        session_id: this.sessionId,
        activities,
      };

      console.log(`[LogBatchCollector] 开始上报 ${rows.length} 条日志`);

      // 发送HTTP请求
      const response = await fetch(`${API_BASE}/agent-activities/batch/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`[LogBatchCollector] 上报成功:`, result);

        // 标记为已上报
        const ids = rows.map(row => row.id);
        const stmt = this.db.prepare(`UPDATE agent_activities SET uploaded_at = ? WHERE id IN (${ids.join(',')})`);
        stmt.run(new Date().toISOString());

        // 清理已上报的记录（保留最近1小时）
        this.cleanupUploadedData();
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('[LogBatchCollector] 上报失败:', error);

      // 重试机制
      this.handleUploadFailure();
    } finally {
      this.isUploading = false;
    }
  }

  /**
   * 处理上报失败
   */
  private handleUploadFailure(): void {
    if (!this.db) return;

    // 增加重试计数
    this.db.exec(`
      UPDATE agent_activities
      SET retry_count = retry_count + 1
      WHERE uploaded_at IS NULL
    `);

    // 检查重试次数超过阈值的记录
    const failedRows = this.db.prepare(`
      SELECT COUNT(*) as count FROM agent_activities
      WHERE uploaded_at IS NULL AND retry_count >= ?
    `).get(CONFIG.MAX_RETRY_COUNT) as { count: number };

    if (failedRows.count > 0) {
      console.warn(`[LogBatchCollector] ${failedRows.count} 条日志重试次数超过阈值，将被丢弃`);

      // 删除失败记录
      this.db.exec(`
        DELETE FROM agent_activities
        WHERE uploaded_at IS NULL AND retry_count >= ?
      `, [CONFIG.MAX_RETRY_COUNT]);
    }

    // 指数退避重试
    setTimeout(() => {
      this.uploadBatch();
    }, CONFIG.RETRY_BASE_DELAY * Math.pow(2, Math.random()));
  }

  /**
   * 检查数据库大小
   */
  private checkDatabaseSize(): void {
    try {
      const stats = fs.statSync(this.dbPath);
      const sizeMB = stats.size / (1024 * 1024);

      if (sizeMB > CONFIG.MAX_DB_SIZE_MB) {
        console.warn(`[LogBatchCollector] 数据库大小 ${sizeMB.toFixed(2)}MB 超过阈值 ${CONFIG.MAX_DB_SIZE_MB}MB`);

        // 删除最旧的已上报记录
        this.db.exec(`
          DELETE FROM agent_activities
          WHERE uploaded_at IS NOT NULL
          ORDER BY timestamp ASC
          LIMIT 1000
        `);
      }
    } catch (error) {
      console.error('[LogBatchCollector] 检查数据库大小失败:', error);
    }
  }

  /**
   * 清理过期数据
   */
  private cleanupOldData(): void {
    if (!this.db) return;

    const cutoffTime = new Date(Date.now() - CONFIG.MAX_AGE_HOURS * 60 * 60 * 1000).toISOString();

    this.db.exec(`
      DELETE FROM agent_activities
      WHERE timestamp < ?
    `, [cutoffTime]);

    console.log(`[LogBatchCollector] 清理 ${CONFIG.MAX_AGE_HOURS} 小时前的数据`);
  }

  /**
   * 清理已上报数据
   */
  private cleanupUploadedData(): void {
    if (!this.db) return;

    const cutoffTime = new Date(Date.now() - CONFIG.MAX_AGE_HOURS * 60 * 60 * 1000).toISOString();

    this.db.exec(`
      DELETE FROM agent_activities
      WHERE uploaded_at IS NOT NULL AND timestamp < ?
    `, [cutoffTime]);
  }

  /**
   * 获取统计信息
   */
  public getStats(): any {
    if (!this.db) return null;

    const total = this.db.prepare('SELECT COUNT(*) as count FROM agent_activities').get() as { count: number };
    const pending = this.db.prepare('SELECT COUNT(*) as count FROM agent_activities WHERE uploaded_at IS NULL').get() as { count: number };

    return {
      clientId: this.clientId,
      sessionId: this.sessionId,
      totalLogs: total.count,
      pendingLogs: pending.count,
      uploadedLogs: total.count - pending.count,
    };
  }

  /**
   * 销毁实例
   */
  public destroy(): void {
    if (this.uploadTimer) {
      clearInterval(this.uploadTimer);
    }

    if (this.db) {
      // 最后一次上报
      this.uploadBatch();
      this.db.close();
    }
  }
}

// 导出单例
export const logBatchCollector = new LogBatchCollector();