/**
 * agent 模块导出（执行层 + 决策层 + 插件化，M1-M7）
 * 供 main.ts / di/container.ts / 内置工具 / 插件 统一引用。
 */

// 统一类型
export {
  ToolError,
} from './types'
export type {
  GovTool,
  ToolContext,
  ToolResult,
  ToolErrorCode,
  ToolParseResult,
  ToolValidationResult,
  ToolPermissionResult,
  ToolProgress,
} from './types'

// M1 工具注册表
export { ToolRegistry, TOOL_DEFAULTS, normalizeTool } from './toolRegistry'

// M2 执行分发桥
export { ToolBridge } from './toolBridge'
export type { ToolBridgeOptions } from './toolBridge'

// M3 指数退避重试
export {
  DEFAULT_BACKOFF,
  calculateDelay,
  executeWithBackoff,
  sleep,
} from './retryWithBackoff'
export type { BackoffConfig } from './retryWithBackoff'

// M5a 规划层（RulePlanner，LLMPlanner 预留）
export { RulePlanner, isPerceptionStream } from './planner'
export type { AgentAction, Planner, PerceptionStream, RulePlannerConfig } from './planner'

// M5b 决策层主循环
export { GovernanceEngine } from './governanceEngine'
export type {
  GovernanceEngineDeps,
  GovernanceEngineConfig,
  RunOutcome,
  DecisionCallback,
  AlertCallback,
} from './governanceEngine'

// M7 Skill 插件注册表
export { PluginRegistry, runOncePerAgentRun, clearRunOnceRegistry } from './pluginRegistry'
export type { GovPlugin } from './pluginRegistry'

// P1 插件钩子点契约（8 决策链路钩子 + 三合并策略）
export {
  HOOK_MERGE,
  HOOK_DEFAULTS,
} from './hooks/types'
export type {
  PluginHookPoint,
  HookMerge,
  PluginHooks,
  PluginHooksHost,
  HookHandler,
  HookData,
  HookDataMap,
  HookReturn,
  HookEmitResult,
  PerceptData,
  DecisionInput,
  RunStartData,
  RiskAssessment,
  AlertPayload,
  ToolCallRequestPayload,
  ToolCallResultPayload,
  RunEndData,
} from './hooks/types'

// P1 钩子运行时（HooksHost 三合并策略 + 异常隔离 + 熔断）
export { HooksHost } from './hooks/runtime'
export type { HooksHostOptions, PluginHookHealth } from './hooks/runtime'

// 内置 Skill 插件
export { createRiskSummaryPlugin } from './plugins/riskSummaryPlugin'
export type { RiskSummaryPluginConfig, RiskSummaryEntry } from './plugins/riskSummaryPlugin'

// M4 内置治理工具
export { createFileTools } from './tools/file'
export { createVerifyTools, setVerifyBackendConfig, resetVerifyBackendConfig } from './tools/verify'
export { createEvidenceTools, setEvidenceConfig, resetEvidenceConfig } from './tools/evidence'
export type { EvidenceTuple, LocalEvidenceSink } from './tools/evidence'
export { createReportTools } from './tools/report'
export { createRiskTools, setRiskConfig, resetRiskConfig, readRiskTags } from './tools/risk'
export type { RiskTag, RiskLevel } from './tools/risk'
export { createBackendTools } from './tools/backend'
export { setBackendClientConfig, resetBackendClientConfig } from './tools/backendConfig'
export type { BackendClientConfig } from './tools/backendConfig'
