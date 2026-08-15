/**
 * agent/tools/verify.ts — 内置治理工具：verify.run / verify.flow / verify.check
 *
 * 对接后端四官 API：
 *  - verify.run:   POST /api/agent/verification/（单官校验，如 auditor/verifier）
 *  - verify.flow:  POST /api/auth/agent/flow/（四官全流程 action=verify）
 *  - verify.check: GET /api/agent/verification/?article_id=xxx（查询历史校验结果）
 *
 * 设计约束：
 *  - 只读 / 并发安全：校验是查询行为，不修改本地状态。
 *  - 网络型工具：统一走 backendConfig.callBackendWithRetry（指数退避 + 失败包装为
 *    ToolError('execution_error')）。
 *  - 后端配置（baseUrl/token/logger/retry）由 GovernanceEngine 启动时经
 *    setBackendClientConfig 注入（main process 无 localStorage）。
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

// 向后兼容别名（历史接口名，指向共享后端配置）
export { setBackendClientConfig as setVerifyBackendConfig, resetBackendClientConfig as resetVerifyBackendConfig } from './backendConfig'

// ============================================================================
// verify.flow 共享执行体
// ============================================================================

/** verify.flow 输入 */
interface FlowInput {
  session_id: string
  content?: string
  operations?: Array<Record<string, unknown>>
}

/** 调用后端四官全流程（共享给 verify.flow 的 run / stream 两条执行路径） */
async function invokeFlow(
  input: FlowInput,
): Promise<{ data: Record<string, unknown>; backendMs: number; attempts: number }> {
  const urlPath = '/api/auth/agent/flow/'
  const startedAt = performance.now()
  let attempts = 0

  backendLog('info', 'verify.flow 开始', { session_id: input.session_id })

  const data = await callBackendWithRetry(
    'verify.flow',
    async () => {
      attempts++
      const res = await backendRequest('POST', urlPath, {
        action: 'verify',
        agent_type: 'auditor', // 后端 flow 以 auditor 为主入口
        session_id: input.session_id,
        content: input.content ?? '',
        operations: input.operations ?? [],
        context: {},
      })
      return parseBackendData(res, 'verify.flow')
    },
    (attempt, maxRetries, delayMs) => {
      backendLog('warn', `verify.flow 重试 ${attempt}/${maxRetries}，${delayMs}ms 后`, {
        session_id: input.session_id,
      })
    },
  )

  const backendMs = Math.round(performance.now() - startedAt)
  backendLog('info', 'verify.flow 完成', {
    session_id: input.session_id,
    backendMs,
    attempts,
  })
  return { data: data as Record<string, unknown>, backendMs, attempts }
}

/** verify.flow 四官全流程的阶段进度埋点（供 stream 逐帧 yield） */
const FLOW_STAGES = [
  { step: 'request', progress: 10, detail: (id: string) => `触发四官全流程校验 session=${id}` },
  { step: 'auditor', progress: 30, detail: () => '审计官：评估操作上下文与风险' },
  { step: 'verifier', progress: 50, detail: () => '验证官：校验内容与操作记录' },
  { step: 'archiver', progress: 70, detail: () => '存证官：归档校验证据' },
  { step: 'judge', progress: 90, detail: () => '裁决官：汇总判定结论' },
  { step: 'result', progress: 100, detail: () => '四官全流程校验完成' },
] as const

/** 阶段计时器：记录每帧的累计耗时(elapsedMs)与距上一帧间隔(gapMs)，用于性能排查 */
function createStageTimer() {
  const start = performance.now()
  let last = start
  return {
    /** 阶段打点：返回累计耗时与距上一阶段间隔 */
    mark(label: string): { label: string; elapsedMs: number; gapMs: number } {
      const now = performance.now()
      const elapsedMs = Math.round(now - start)
      const gapMs = Math.round(now - last)
      last = now
      return { label, elapsedMs, gapMs }
    },
    /** 距开始的总耗时 */
    elapsed(): number {
      return Math.round(performance.now() - start)
    },
  }
}

// ============================================================================
// 工具定义
// ============================================================================

/** 构建 verify 系列三个内置治理工具 */
export function createVerifyTools(): GovTool[] {
  return [
    // ------------------------------------------------------------- verify.run
    {
      name: 'verify.run',
      description: '对指定目标执行单一官校验（如 auditor/verifier），调用后端 POST /api/agent/verification/。',
      inputSchema: {
        type: 'object',
        required: ['article_id', 'agent_code'],
        properties: {
          article_id: { type: 'integer', description: '目标文章/文件 ID' },
          agent_code: {
            type: 'string',
            description: '官编码：auditor / verifier / archiver / judge',
            enum: ['auditor', 'verifier', 'archiver', 'judge'],
          },
        },
      },
      isReadOnly: () => true,
      isConcurrencySafe: () => true,
      async run(input: { article_id: number; agent_code: string }, ctx: ToolContext) {
        const urlPath = '/api/agent/verification/'
        ctx.onProgress?.({ tool: 'verify.run', detail: `调用后端校验 ${input.agent_code}→文章#${input.article_id}` })

        backendLog('info', 'verify.run 开始', { article_id: input.article_id, agent_code: input.agent_code })

        const data = await callBackendWithRetry(
          'verify.run',
          async () => {
            const res = await backendRequest('POST', urlPath, {
              article_id: input.article_id,
              agent_code: input.agent_code,
            })
            return parseBackendData(res, 'verify.run')
          },
          (attempt, maxRetries, delayMs) => {
            backendLog('warn', `verify.run 重试 ${attempt}/${maxRetries}，${delayMs}ms 后`, {
              article_id: input.article_id,
              agent_code: input.agent_code,
            })
          },
        )

        backendLog('info', 'verify.run 完成', { article_id: input.article_id, agent_code: input.agent_code })

        const record = data as Record<string, unknown>
        return {
          output: record,
          content: `校验完成：${input.agent_code} → 文章#${input.article_id}\n` +
            `状态: ${record.status ?? 'completed'}\n` +
            `摘要: ${(record.summary as string) ?? ''}\n` +
            `ID: ${record.id ?? record.record_id ?? '未知'}`,
        }
      },
    },

    // ------------------------------------------------------------ verify.flow
    {
      name: 'verify.flow',
      description: '触发四官全流程校验（auditor→verifier→archiver→judge），调用后端 POST /api/auth/agent/flow/。',
      inputSchema: {
        type: 'object',
        required: ['session_id'],
        properties: {
          session_id: { type: 'string', description: '会话 ID，用于关联四官全流程的上下文' },
          content: { type: 'string', description: '校验内容描述或操作记录说明' },
          operations: {
            type: 'array',
            items: { type: 'object' },
            description: '操作记录列表（可选，传给后端做上下文分析）',
          },
        },
      },
      isReadOnly: () => true,
      isConcurrencySafe: () => true,
      /**
       * 流式执行：四官全流程按阶段逐帧 yield 进度（对齐 Grok ToolStream `[Progress*, Terminal]`）。
       * ToolBridge 会将每帧发布为 `tool_progress` 事件并回调 onProgress，末尾 return 终态。
       * 每帧记录累计耗时(elapsedMs)与距上一帧间隔(gapMs)，后端段单独计时。
       * 阶段日志用 info 级（四官流程由风险事件低频触发，逐官判定耗时默认可见，便于性能排查）。
       */
      stream: async function* (input: FlowInput, ctx: ToolContext) {
        const timer = createStageTimer()

        // 阶段帧：本地埋点成本极低（gapMs≈0），用于确认阶段管线无卡顿
        for (const stage of FLOW_STAGES) {
          const t = timer.mark(stage.step)
          backendLog('info', `verify.flow 阶段判定 [${stage.step}]`, {
            session_id: input.session_id,
            progress: stage.progress,
            elapsedMs: t.elapsedMs,
            gapMs: t.gapMs,
          })
          yield {
            tool: 'verify.flow',
            step: stage.step,
            progress: stage.progress,
            detail: stage.detail(input.session_id),
          }
        }

        // 后端段：四官在服务端一次完成，单独计时（含重试退避），是主要耗时来源
        const { data, backendMs, attempts } = await invokeFlow(input)

        const t = timer.mark('terminal')
        backendLog('info', 'verify.flow 流式完成', {
          session_id: input.session_id,
          backendMs,
          attempts,
          totalMs: t.elapsedMs,
          gapAfterResult: t.gapMs,
        })

        return {
          output: data,
          content: `四官全流程校验完成：session=${input.session_id}\n` +
            `结果: ${JSON.stringify(data, null, 2).slice(0, 2000)}`,
        }
      },
      // 兜底阻塞执行（GovTool 契约要求 run 存在；ToolBridge 检测到 stream 时优先走 stream）
      run: async (input: FlowInput, ctx: ToolContext) => {
        const startedAt = performance.now()
        ctx.onProgress?.({ tool: 'verify.flow', detail: `触发四官全流程校验 session=${input.session_id}` })
        const { data } = await invokeFlow(input)
        backendLog('info', 'verify.flow run 完成', {
          session_id: input.session_id,
          totalMs: Math.round(performance.now() - startedAt),
        })
        return {
          output: data,
          content: `四官全流程校验完成：session=${input.session_id}\n` +
            `结果: ${JSON.stringify(data, null, 2).slice(0, 2000)}`,
        }
      },
    },

    // ----------------------------------------------------------- verify.check
    {
      name: 'verify.check',
      description: '查询指定文章的所有历史校验记录，调用后端 GET /api/agent/verification/。',
      inputSchema: {
        type: 'object',
        required: ['article_id'],
        properties: {
          article_id: { type: 'integer', description: '目标文章/文件 ID' },
        },
      },
      isReadOnly: () => true,
      isConcurrencySafe: () => true,
      async run(input: { article_id: number }, ctx: ToolContext) {
        const urlPath = `/api/agent/verification/?article_id=${input.article_id}`
        ctx.onProgress?.({ tool: 'verify.check', detail: `查询校验历史 article#${input.article_id}` })

        const data = await callBackendWithRetry('verify.check', async () => {
          const res = await backendRequest('GET', urlPath)
          return parseBackendData(res, 'verify.check')
        })

        const records = (data as { timeline?: Array<{ agent_code: string; status: string; summary: string }> })
          .timeline ?? []
        const summary = records
          .map((r) => `- ${r.agent_code}: ${r.status}${r.summary ? ` — ${r.summary}` : ''}`)
          .join('\n')

        return {
          output: { article_id: input.article_id, verifiedCount: records.length, records },
          content: `文章#${input.article_id} 校验历史（共 ${records.length} 条记录）：\n${summary || '  无历史记录'}`,
        }
      },
    },
  ]
}