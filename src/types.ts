/**
 * 类型定义
 */

export interface OperationRecord {
  id: string;
  type: 'ai_dialog' | 'file_op' | 'search' | 'clipboard' | 'other';
  title: string;
  content: string;
  source: string;
  status: 'verified' | 'pending' | 'flagged';
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  risk_score: number;
  should_block: boolean;
  context: string;
  explanation: string;
  timestamp?: string;
  audit_hash?: string;
}

export interface RiskResult {
  type: 'sqli' | 'xss' | 'password' | 'apikey' | 'sensitive';
  matched: string;
  risk: 'high' | 'medium' | 'low';
  position?: {
    start: number;
    end: number;
  };
}

export interface MonitorConfig {
  enabled: boolean;
  paths?: string[];
  interval?: number;
  excludePatterns?: RegExp[];
}

export interface CoreConfig {
  securityKnowledgeBase?: SecurityKnowledgeBaseConfig;
  fileMonitor?: MonitorConfig;
  storage?: StorageConfig;
  callbacks?: {
    onRiskDetected?: (risks: RiskResult[], context: string) => void;
    onRecordSaved?: (record: OperationRecord) => void;
    onError?: (error: Error) => void;
  };
}

export interface SecurityKnowledgeBaseConfig {
  sqliPayloads?: string[];
  xssPayloads?: string[];
  passwords?: string[];
  apiKeys?: string[];
  sensitiveKeywords?: string[];
}

export interface StorageConfig {
  path?: string;
  maxRecords?: number;
  format?: 'json' | 'sqlite';
}