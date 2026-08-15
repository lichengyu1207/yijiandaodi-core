/**
 * agent/tools/backend.ts — 内置治理工具：backend.call
 *
 * 后端 Grok 工具桥：把桌面端工具调用透传给后端 grok-tools。
 *  - GET /api/agent/tools/            → 列出后端可用工具（list=true 或 tool 省略）
 *  - POST /api/agent/tools/           → 执行后端工具 { tool, params }
 *
 * 安全语义：后端工具语义未知，一律按"非只读 / 破坏性"保守处理（fail-closed），
 * 执行前必经 ToolBridge 的 canUseTool 权限钩子（四官裁决 + 二次确认）。
 * 并发安全=true：后端调用无本地共享可变状态，可并行。
 *
 * 详见 docs/AGENT_FUSION_MODULE_DESIGN.md §0.4 / M4
 */

import { GovTool, ToolContext } from '../types'
import {
  backendRequest,
  backendLog,
  parseBackendData,
  callBackendWithRetry,
} from './backendConfig'

/** 构建 backend 系列内置治理工具 */
export function createBackendTools(): GovTool[] {
  return [
    {
      name: 'backend.call',
      description: '透传调用后端 Grok 工具桥：list=true 时列出可用工具，否则执行 { tool, params }。写类/未知语义工具需权限确认。',
      inputSchema: {
        type: 'object',
        required: ['tool'],
        properties: {
          tool: { type: 'string', description: '后端工具名（list=true 时可省略）' },
          params: { type: 'object', description: '工具参数' },
          list: { type: 'boolean', description: 'true 时仅列出后端可用工具，不执行' },
        },
      },
      isReadOnly: () => false,
      isConcurrencySafe: () => true,
      isDestructive: () => true,
      async run(
        input: { tool?: string; params?: Record<string, unknown>; list?: boolean },
        ctx: ToolContext,
      ) {
        // ---- 列出后端工具（只读语义，但保守起见仍走同一权限闸门） ----
        if (input.list || !input.tool) {
          ctx.onProgress?.({ tool: 'backend.call', detail: '列出后端可用工具' })
          const data = await callBackendWithRetry('backend.call', async () => {
            const res = await backendRequest('GET', '/api/agent/tools/')
            return parseBackendData(res, 'backend.call')
          })

          const record = data as { tools?: string[]; definitions?: unknown }
          const tools = record.tools ?? []
          backendLog('info', 'backend.call 列工具完成', { count: tools.length })

          return {
            output: { list: true, tools: record.tools, definitions: record.definitions },
            content: `后端可用工具（${tools.length} 个）: ${tools.join(', ') || '无'}`,
          }
        }

        // ---- 执行后端工具 ----
        const tool = input.tool
        const params = input.params ?? {}
        ctx.onProgress?.({ tool: 'backend.call', detail: `调用后端工具 ${tool}` })
        backendLog('info', 'backend.call 开始', { tool })

        const data = await callBackendWithRetry(
          'backend.call',
          async () => {
            const res = await backendRequest('POST', '/api/agent/tools/', { tool, params })
            return parseBackendData(res, 'backend.call')
          },
          (attempt, maxRetries, delayMs) => {
            backendLog('warn', `backend.call 重试 ${attempt}/${maxRetries}，${delayMs}ms 后`, { tool })
          },
        )

        const record = data as { output?: unknown; error?: string }
        backendLog('info', 'backend.call 完成', { tool })

        return {
          output: { tool, output: record.output, error: record.error },
          content: `后端工具 ${tool} 执行完成\n` +
            (record.error
              ? `错误: ${record.error}`
              : `输出: ${JSON.stringify(record.output).slice(0, 2000)}`),
        }
      },
    },
  ]
}