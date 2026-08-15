/**
 * agent/tools/report.ts — 内置治理工具：report.generate
 *
 * 审计报告：聚合后端 LongTermMemory（存证链）生成 markdown 审计报告。
 *  - 只读 / 并发安全：纯聚合查询，不修改本地状态。
 *  - 数据源：GET /api/agent/memory/?limit=N（存证记录列表）。
 *
 * 详见 docs/AGENT_FUSION_MODULE_DESIGN.md §0.4 / M4
 */

import { GovTool, ToolContext } from '../types'
import { backendRequest, backendLog, parseBackendData, callBackendWithRetry } from './backendConfig'

/** 后端存证记录结构 */
interface MemoryEntry {
  id?: string
  content?: string
  metadata?: Record<string, unknown>
  created_at?: string
  updated_at?: string
}

/** 构建 report 系列内置治理工具 */
export function createReportTools(): GovTool[] {
  return [
    {
      name: 'report.generate',
      description: '生成审计报告：聚合后端存证链（LongTermMemory）输出 markdown 报告，含概要、明细表与动作分布统计。',
      inputSchema: {
        type: 'object',
        properties: {
          since: { type: 'string', description: '起始时间过滤（ISO 字符串），可选' },
          limit: { type: 'integer', description: '聚合最近 N 条存证，默认 100' },
        },
      },
      isReadOnly: () => true,
      isConcurrencySafe: () => true,
      async run(input: { since?: string; limit?: number }, ctx: ToolContext) {
        const limit = input.limit && input.limit > 0 ? input.limit : 100
        ctx.onProgress?.({ tool: 'report.generate', detail: `聚合最近 ${limit} 条存证生成审计报告` })

        const data = await callBackendWithRetry('report.generate', async () => {
          const res = await backendRequest('GET', `/api/agent/memory/?limit=${limit}`)
          return parseBackendData(res, 'report.generate')
        })

        // data 可能是数组（存证列表），也可能是 {…}（空/异常结构）
        const entries: MemoryEntry[] = Array.isArray(data) ? (data as MemoryEntry[]) : []
        const sinceMs = input.since ? new Date(input.since).getTime() : undefined

        const filtered = sinceMs
          ? entries.filter((e) => e.created_at && new Date(e.created_at).getTime() >= sinceMs)
          : entries

        // 动作分布统计（从 metadata.action 提取）
        const byAction: Record<string, number> = {}
        for (const e of filtered) {
          const action = String(e.metadata?.action ?? 'unknown')
          byAction[action] = (byAction[action] ?? 0) + 1
        }

        const generatedAt = new Date().toISOString()
        const rows = filtered
          .slice(-50)
          .map((e, i) => {
            const created = (e.created_at ?? '').slice(0, 19).replace('T', ' ')
            const content = (e.content ?? '').slice(0, 60)
            return `| ${filtered.length - i} | ${created} | ${content} | ${JSON.stringify(e.metadata ?? {}).slice(0, 60)} |`
          })
          .join('\n')

        const distribution = Object.entries(byAction)
          .sort((a, b) => b[1] - a[1])
          .map(([action, count]) => `- ${action}: ${count}`)
          .join('\n')

        backendLog('info', 'report.generate 完成', { recordCount: filtered.length, since: input.since })

        const markdown =
          `# 一鉴到底 · 审计报告\n\n` +
          `- 生成时间: ${generatedAt}\n` +
          `- 存证记录数: ${filtered.length}（共查询 ${entries.length} 条${sinceMs ? '，含时间过滤' : ''}）\n\n` +
          `## 动作分布\n${distribution || '  （无记录）'}\n\n` +
          `## 存证明细（最近 ${Math.min(filtered.length, 50)} 条）\n` +
          `| # | 时间 | 内容 | 元数据 |\n|---|---|---|---|\n${rows || '（无记录）'}`

        return {
          output: {
            generatedAt,
            recordCount: filtered.length,
            totalFetched: entries.length,
            byAction,
            records: filtered.slice(-50),
          },
          content: markdown,
        }
      },
    },
  ]
}