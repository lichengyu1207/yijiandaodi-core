/**
 * mcp 模块导出（方案 C · C1-C4）
 */

export {
  McpServerService,
  DEFAULT_MCP_PORT,
  DEFAULT_MCP_HOST,
} from './mcpServerService'
export type {
  McpAuthResult,
  McpAuthenticator,
  McpServerServiceOptions,
} from './mcpServerService'

export {
  createMcpAuthenticator,
  createBackendJwtVerifier,
  ensureMcpApiKey,
  rotateMcpApiKey,
  loadMcpApiKeyConfig,
  saveMcpApiKeyConfig,
  generateMcpApiKey,
  getMcpConfigPath,
} from './mcpAuth'
export type { McpApiKeyConfig, McpAuthenticatorOptions } from './mcpAuth'
