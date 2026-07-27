/**
 * 一鉴到底核心库 - 主入口
 * 提供AI操作行为实时审计和安全监控功能
 */

export { YijianDaoDiCore } from './core';
export { SecurityKnowledgeBase, initSecurityKnowledgeBase, detectSecurityRisks } from './security-knowledge-base';
export { FileMonitor } from './monitors/file-monitor';
export { StorageService } from './services/storage-service';
export { RiskDetector } from './detectors/risk-detector';

export type {
  OperationRecord,
  RiskResult,
  MonitorConfig,
  CoreConfig
} from './types';

// 版本信息
export const VERSION = '1.0.0';
export const LIB_NAME = 'yijiandaodi-core';