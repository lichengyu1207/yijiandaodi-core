/**
 * agent/tools — 内置治理工具集合
 * 每个工具都是 GovTool[] 工厂，供 ToolRegistry 注册 / Skill 插件注入。
 */

export { createFileTools } from './file'
export { createVerifyTools, setVerifyBackendConfig, resetVerifyBackendConfig } from './verify'
export { createEvidenceTools, setEvidenceConfig, resetEvidenceConfig } from './evidence'
export type { EvidenceTuple, LocalEvidenceSink } from './evidence'
export { createReportTools } from './report'
export { createRiskTools, setRiskConfig, resetRiskConfig, readRiskTags } from './risk'
export type { RiskTag, RiskLevel } from './risk'
export { createBackendTools } from './backend'
export {
  setBackendClientConfig,
  resetBackendClientConfig,
} from './backendConfig'
export type { BackendClientConfig } from './backendConfig'
