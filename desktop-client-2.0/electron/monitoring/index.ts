/**
 * 监控模块导出
 */

export { FileMonitor, FileMonitorConfig, RiskResult, OperationRecord } from './fileMonitor'
export { ClipboardMonitor } from './clipboardMonitor'
export { ProcessMonitor, ProcessInfo } from './processMonitor'
export { NetworkMonitor, NetworkRequest } from './networkMonitor'
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