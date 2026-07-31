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