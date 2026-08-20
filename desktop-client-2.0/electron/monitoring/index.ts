/**
 * 监控模块导出
 */

export { FileMonitor, FileMonitorConfig, RiskResult, OperationRecord } from './fileMonitor'
export type { FileKind, HighRiskConfirmation, WatchPathStatus } from './fileMonitor'
export { ClipboardMonitor } from './clipboardMonitor'
export { ProcessMonitor, ProcessInfo, ToolSession, ProcessMonitorConfig } from './processMonitor'
export { NetworkMonitor, NetworkRequest } from './networkMonitor'
export { ApiCallMonitor } from './apiCallMonitor'
export type { ApiCallMonitorConfig, ApiCallInfo, ApiCallRecord, ApiRiskLevel } from './apiCallMonitor'
export { MonitoringDiagnostic } from './monitoringDiagnostic'

// 导出自动化检测器
export { AutoDetector, autoDetector } from './autoDetector'
export type { AutoDetectionResult, CodeAnalysisResult, RiskLevel, ContentType, Language } from './autoDetector'

// 导出智能提示器
export { SmartAlerter, smartAlerter } from './smartAlerter'
export type { AlertPolicy, AlertOptions } from './smartAlerter'

// 导出 Agent 行为解析器
export { AgentBehaviorParser } from './agentBehaviorParser'
export type { AgentBehaviorLog } from './agentBehaviorParser'

// 导出行为风险评分器
export { BehaviorRiskScorer } from './behaviorRiskScorer'
export type { RiskAssessment } from './behaviorRiskScorer'

// 导出主动告警器
export { ProactiveAlerter, proactiveAlerter } from './proactiveAlerter'

// 导出污点追踪系统
export { TaintTracker, taintTracker } from './taintTracking'
export type { TaintMark, TaintPropagation, TaintFlowGraph, TaintType } from './taintTracking'

// A5：监控器家族统一接缝（可替换实现；消费方只依赖 MonitorProvider）
export { createMonitorProvider } from './monitorProvider'
export type { MonitorProvider, MonitorProviderRegistry } from './monitorProvider'

// 监控事件 → 存证中心 自动联动
export { linkHighRiskToEvidence, setEvidenceLinkageEnabled, resetEvidenceLinkageDedup } from './evidenceLinkage'
export type { EvidenceLinkageInput, EvidenceLinkageSink } from './evidenceLinkage'