/**
 * agent/tools/risk.ts — 内置治理工具：risk.mark
 *
 * 风险标记：把文件/资源标记为指定风险等级，写入本地风险标签 registry（JSON）。
 *  - 写类工具：非只读 / 非并发安全，执行前必经 ToolBridge 的 canUseTool 权限钩子。
 *  - notify 回调（可选）：main.ts 接入 taintTracker / 前端 UI 联动。
 *  - 文件路径可注入（默认用户数据目录下的 risk-tags.json），避免测试与生产耦合。
 *
 * 详见 docs/AGENT_FUSION_MODULE_DESIGN.md §0.4 / M4
 */

import fs from 'fs'
import path from 'path'
import { GovTool, ToolContext, ToolError } from '../types'
import { backendLog } from './backendConfig'

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

/** 风险标签记录 */
export interface RiskTag {
  path: string
  level: RiskLevel
  reason?: string
  markedAt: string
  byAgent?: string
  runId?: string
}

let _riskFilePath = ''
let _notify: ((tag: RiskTag) => void) | undefined

/** 配置 risk.mark：风险标签文件路径 + 标记通知回调 */
export function setRiskConfig(config: { filePath?: string; notify?: (tag: RiskTag) => void }): void {
  if (config.filePath !== undefined) _riskFilePath = config.filePath
  if (config.notify !== undefined) _notify = config.notify
}

export function resetRiskConfig(): void {
  _riskFilePath = ''
  _notify = undefined
}

/** 从本地 registry 读取风险标签（异步） */
export async function readRiskTags(filePath: string): Promise<RiskTag[]> {
  try {
    const raw = await fs.promises.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as RiskTag[]) : []
  } catch {
    return []
  }
}

/** 构建 risk 系列内置治理工具 */
export function createRiskTools(): GovTool[] {
  return [
    {
      name: 'risk.mark',
      description: '把文件/资源标记为风险等级（low/medium/high/critical），写入本地风险标签 registry。写类动作，需权限确认。',
      inputSchema: {
        type: 'object',
        required: ['path', 'level'],
        properties: {
          path: { type: 'string', description: '目标文件/资源绝对路径' },
          level: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            description: '风险等级',
          },
          reason: { type: 'string', description: '标记原因' },
        },
      },
      isReadOnly: () => false,
      isConcurrencySafe: () => false,
      isDestructive: () => false,
      async run(input: { path: string; level: RiskLevel; reason?: string }, ctx: ToolContext) {
        const abs = path.resolve(input.path)
        if (!['low', 'medium', 'high', 'critical'].includes(input.level)) {
          throw new ToolError('invalid_params', `非法风险等级: ${input.level}`, { level: input.level })
        }
        if (!_riskFilePath) {
          throw new ToolError(
            'execution_error',
            'risk.mark 未配置风险标签文件路径，请先调用 setRiskConfig({ filePath })',
            { path: abs },
          )
        }

        const tag: RiskTag = {
          path: abs,
          level: input.level,
          reason: input.reason,
          markedAt: new Date().toISOString(),
          byAgent: ctx.agentId,
          runId: ctx.runId,
        }

        ctx.onProgress?.({ tool: 'risk.mark', detail: `标记风险 ${abs} [${input.level}]` })

        // 读取现有标签 → 去重（同路径更新等级）→ 追加 → 落盘（异步，有界上限）
        const tags = await readRiskTags(_riskFilePath)
        const idx = tags.findIndex((t) => t.path === abs)
        if (idx >= 0) tags[idx] = tag
        else tags.push(tag)
        const capped = tags.slice(-1000)

        // trace：标记决策（去重命中/追加 + 上限裁剪 + 落盘目标）
        backendLog('trace', 'risk.mark 标记决策', {
          path: abs,
          level: input.level,
          reason: input.reason,
          runId: ctx.runId,
          agentId: ctx.agentId,
          dedup: idx >= 0 ? 'update_existing' : 'append_new',
          trimmed: tags.length > 1000,
          total: capped.length,
        })

        try {
          await fs.promises.mkdir(path.dirname(_riskFilePath), { recursive: true })
          await fs.promises.writeFile(_riskFilePath, JSON.stringify(capped, null, 2), 'utf-8')
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          throw new ToolError('execution_error', `风险标签写入失败: ${msg}`, { path: _riskFilePath })
        }

        _notify?.(tag)

        return {
          output: { marked: true, ...tag, registryPath: _riskFilePath, total: capped.length },
          content: `已标记风险: ${abs} [${input.level}]${input.reason ? ` — ${input.reason}` : ''}`,
        }
      },
    },
  ]
}