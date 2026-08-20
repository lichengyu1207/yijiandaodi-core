/**
 * 服务模块导出
 */

export { TrayService } from './trayService'
export { ApiService } from './apiService'
export { BackendService } from './backendService'
export { StorageService } from './storageService'
export { syncService, SyncService } from './syncService'
export { LoggerService, logger, createContextLogger, LogLevel } from './loggerService'
export type { LogContext, LogEntry, LogQueryOptions, LogExportOptions, LoggerConfig } from './loggerService'
export { ErrorMonitor, createErrorMonitor } from './errorMonitor'
export type {
  ErrorLevel,
  ErrorType,
  ErrorContext,
  RecoveryStrategy,
  RecoveryConfig,
  ReportingConfig,
  ErrorMonitorConfig,
  ErrorEvent,
  ErrorStats
} from './errorMonitor'
export { MemoryMonitorService } from './memoryMonitor'
export type {
  MemoryUsage,
  HeapStatistics,
  MemorySnapshot,
  MemoryTrendPoint,
  MemoryTrendAnalysis,
  AlertLevel,
  MemoryAlert,
  MemoryMonitorConfig,
  MemoryMonitorStatus,
  MemoryReport
} from './memoryMonitor'
export { CPUMonitor } from './cpuMonitor'
export type {
  CPUMonitorConfig,
  CPUUsageInfo,
  CPUCoreInfo,
  ProcessCPUUsage,
  PerformanceHotspot,
  SlowOperation,
  CPUPerformanceReport,
  CPUMonitorEvents
} from './cpuMonitor'

// 导出治理健康度监控器
export { GovernanceHealthMonitor } from './governanceHealthMonitor'
export type { HealthMetrics } from './governanceHealthMonitor'

// 自动更新（electron-updater）
export { UpdaterService, updaterService, UPDATER_EVENTS } from './updaterService'

// P0 统一控制面（M1 MVP）：模块状态聚合 / 日志级别 / 预算额度
export { ModuleControlService, computeModuleSummary } from './moduleControlService'
export type {
  ModuleStatus,
  ModuleSummary,
  ModuleKind,
  ModuleState,
  ModuleHealth,
  DeepSeekQuotaStatus,
  ModuleControlDeps,
} from './moduleControlService'