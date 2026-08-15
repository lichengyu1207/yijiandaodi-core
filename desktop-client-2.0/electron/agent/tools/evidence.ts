/**
 * agent/tools/evidence.ts — 内置治理工具：evidence.commit
 *
 * 五元组存证（subject/action/object/context/result）：
 *  - 优先写后端 LongTermMemory：POST /api/agent/memory/（链式哈希存证）；
 *  - 后端不可用时降级本地 storageService 记录（不静默失败）；
 *  - 写类工具：非只读 / 非并发安全，执行前必经 ToolBridge 的 canUseTool 权限钩子。
 *
 * 详见 docs/AGENT_FUSION_MODULE_DESIGN.md §0.4 / M4 / §6 后端可用性降级
 */

import { GovTool, ToolContext, ToolError } from '../types'
import {
  backendRequest,
  backendLog,
  parseBackendData,
  callBackendWithRetry,
} from './backendConfig'

/** 本地降级回调：后端不可用时把五元组写入本地 storageService（由 main.ts 注入） */
export type LocalEvidenceSink = (
  content: string,
  metadata: Record<string, unknown>,
) => Promise<unknown>

let _localSink: LocalEvidenceSink | undefined

/** 配置 evidence.commit 的本地降级落盘（main.ts 注入 storageService.saveOperation 等） */
export function setEvidenceConfig(config: { localFallback?: LocalEvidenceSink }): void {
  if (config.localFallback !== undefined) _localSink = config.localFallback
}

export function resetEvidenceConfig(): void {
  _localSink = undefined
}

/** 五元组结构 */
export interface EvidenceTuple {
  action: string // 操作类型，如 file_write / api_call / process_start
  subject: string // 主体（agentId / 用户）
  object: string // 客体（文件 / 事件 / 资源）
  result: string // 结果（allow / block / ask_user / 校验通过…）
  context?: Record<string, unknown> // 上下文（hashBefore/hashAfter/证据快照…）
  sessionId?: string
}

/** 构建 evidence 系列内置治理工具 */
export function createEvidenceTools(): GovTool[] {
  return [
    {
      name: 'evidence.commit',
      description: '五元组存证：把审计证据写入后端 LongTermMemory（链式哈希），后端不可用时降级本地记录。写类动作，需权限确认。',
      inputSchema: {
        type: 'object',
        required: ['action'],
        properties: {
          action: { type: 'string', description: '操作类型，如 file_write / api_call' },
          subject: { type: 'string', description: '主体（agentId / 用户）' },
          object: { type: 'string', description: '客体（文件 / 事件）' },
          result: { type: 'string', description: '结果（allow / block / 校验通过…）' },
          context: { type: 'object', description: '上下文（hashBefore/hashAfter 等）' },
          sessionId: { type: 'string', description: '关联会话' },
        },
      },
      isReadOnly: () => false,
      isConcurrencySafe: () => false,
      isDestructive: () => false,
      async run(input: EvidenceTuple, ctx: ToolContext) {
        const { action, subject = '', object = '', result = '', context = {}, sessionId } = input

        // 组装存证内容与元数据（五元组 + 治理上下文）
        const content = [
          action,
          subject ? `主体=${subject}` : '',
          object ? `客体=${object}` : '',
          result ? `结果=${result}` : '',
        ]
          .filter(Boolean)
          .join(' | ')
        const metadata: Record<string, unknown> = {
          action,
          subject,
          object,
          result,
          context,
          session_id: sessionId ?? ctx.runId,
          agent_id: ctx.agentId,
          ts: new Date().toISOString(),
        }

        ctx.onProgress?.({ tool: 'evidence.commit', detail: `五元组存证: ${content}` })
        backendLog('info', 'evidence.commit 开始', { action, object })
        backendLog('trace', 'evidence.commit 存证入参决策', {
          action,
          subject,
          object,
          result,
          sessionId: sessionId ?? ctx.runId,
          hasLocalSink: !!_localSink,
        })

        try {
          const data = await callBackendWithRetry('evidence.commit', async () => {
            const res = await backendRequest('POST', '/api/agent/memory/', { content, metadata })
            return parseBackendData(res, 'evidence.commit')
          })

          const record = data as { id?: string; created_at?: string }
          backendLog('info', 'evidence.commit 完成（后端）', { id: record.id, action })
          backendLog('trace', 'evidence.commit 后端存证成功', { id: record.id, action, object })

          return {
            output: { backend: true, id: record.id, created_at: record.created_at, content, metadata },
            content: `五元组已存证（后端 LongTermMemory）: ${content}\n存证ID: ${record.id ?? '未知'}`,
          }
        } catch (e) {
          // 后端不可用 → 降级本地，不静默失败
          const backendError = e instanceof Error ? e.message : e
          backendLog('trace', 'evidence.commit 降级决策（后端失败）', {
            action,
            backendError,
            hasLocalSink: !!_localSink,
          })
          if (_localSink) {
            try {
              const local = await _localSink(content, metadata)
              backendLog('warn', 'evidence.commit 降级本地存储', { action, error: e instanceof Error ? e.message : e })
              return {
                output: { backend: false, local, content, metadata },
                content: `五元组已存证（本地降级，后端不可用）: ${content}`,
              }
            } catch (localErr) {
              const msg = localErr instanceof Error ? localErr.message : String(localErr)
              throw new ToolError('execution_error', `五元组存证失败（后端与本地均失败）: ${msg}`, {
                action,
                error: msg,
              })
            }
          }
          // 未配置本地降级：上抛（由 ToolBridge 包装为 execution_error）
          throw e
        }
      },
    },
  ]
}