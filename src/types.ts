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

/**
 * 安全知识库配置
 */
export interface SecurityKnowledgeBaseConfig {
  // SQL 注入规则
  sqli?: string[];
  // XSS 规则
  xss?: string[];
  // 密码字典
  passwords?: string[];
  // API Key 模式
  apiKeys?: string[];
  // 敏感关键词
  sensitive?: string[];
  // 自定义规则
  custom?: CustomRule[];
  // 从文件加载规则
  loadFromFile?: {
    sqli?: string;
    xss?: string;
    passwords?: string;
    sensitive?: string;
  };
  // 从 URL 加载规则
  loadFromUrl?: {
    [key: string]: string;
  };
}

/**
 * 自定义规则
 */
export interface CustomRule {
  name: string;
  patterns: string[];
  risk_level: 'low' | 'medium' | 'high';
  description?: string;
}

export interface RiskResult {
  type: 'sqli' | 'xss' | 'password' | 'apikey' | 'sensitive' | 'custom';
  matched: string;
  risk: 'high' | 'medium' | 'low';
  position?: {
    start: number;
    end: number;
  };
  description?: string;
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