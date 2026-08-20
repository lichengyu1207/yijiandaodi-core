/**
 * monitoring/evidenceLinkage.ts — 监控事件 → 存证中心 自动联动
 *
 * 把监控回调中评估出的「高风险行为」（danger / critical）自动写入后端 LongTermMemory
 * 链式哈希存证（与「存证中心」读取的 /api/v1/memory/long-term/ 同一条链），实现
 * 桌面端监控行为实时出现在存证中心，无需 Agent 手动调用 evidence.commit。
 *
 * 设计约定：
 *  - 只联动高风险（assessment.riskLevel ∈ danger | critical），避免低价值记录刷屏；
 *  - 去重限流：同一 action+target 在时间窗内只存证一次，防止高频监控事件重复入链；
 *  - 异步 fire-and-forget：不阻塞监控回调；后端不可用时降级本地 storageService 记录；
 *  - 认证：使用 backendConfig 注入的用户 JWT（登录时由 set-sync-token 同步），401 即降级。
 *
 * 日志规范：统一 [存证联动] 前缀 + module: 'EvidenceLinkage'（三参调用）。
 */

import type { AgentBehaviorLog } from './agentBehaviorParser'
import type { RiskAssessment } from './behaviorRiskScorer'
import type { RiskResult } from './types'
import type { OperationRecord } from '../services/storageService'
import { backendRequest, backendLog } from '../agent/tools/backendConfig'

/** 本地降级目标（storageService.saveOperation） */
export interface EvidenceLinkageSink {
  saveOperation: (record: OperationRecord) => Promise<unknown> | unknown
}

export interface EvidenceLinkageInput {
  behavior: AgentBehaviorLog
  assessment: RiskAssessment
  /** 风险来源描述（如「文件 xxx」「剪贴板」） */
  source: string
  /** 原始风险检测结果（用于 risk_tags） */
  risks?: RiskResult[]
  /** 本地降级目标（后端不可用时落盘） */
  sink?: EvidenceLinkageSink
}

/** 去重时间窗（ms）：同一行为 10s 内只存证一次 */
const DEDUP_WINDOW_MS = 10_000

/** 最近一次存证的 key → 时间戳（模块级去重表） */
const lastRecorded = new Map<string, number>()

/** 模块级开关（测试可关闭） */
let _enabled = true

/** 启用/停用自动联动（测试用） */
export function setEvidenceLinkageEnabled(enabled: boolean): void {
  _enabled = enabled
  if (!enabled) lastRecorded.clear()
}

/** 清空去重表（测试用） */
export function resetEvidenceLinkageDedup(): void {
  lastRecorded.clear()
}

function isHighRisk(assessment: RiskAssessment): boolean {
  return assessment.riskLevel === 'danger' || assessment.riskLevel === 'critical'
}

function mapRiskLevel(assessment: RiskAssessment): 'high' | 'critical' {
  return assessment.riskLevel === 'critical' ? 'critical' : 'high'
}

/**
 * 自动联动存证：对高风险行为异步写入后端 LongTermMemory（后端不可用 → 本地降级）。
 * 无返回值（fire-and-forget）；调用方无需 await，内部全部捕获异常。
 */
export function linkHighRiskToEvidence(input: EvidenceLinkageInput): void {
  if (!_enabled) return

  const { behavior, assessment, source, risks, sink } = input
  if (!isHighRisk(assessment)) return

  const action = String(behavior.action ?? 'unknown')
  const target = String(behavior.target ?? '')
  const dedupKey = `${action}|${target}`

  // 去重限流
  const now = Date.now()
  const last = lastRecorded.get(dedupKey) ?? 0
  if (now - last < DEDUP_WINDOW_MS) {
    backendLog('debug', '[存证联动] 去重窗口内跳过（同一行为重复）', { action, target, dedupKey })
    return
  }
  lastRecorded.set(dedupKey, now)
  if (lastRecorded.size > 200) {
    const oldest = lastRecorded.keys().next().value
    if (oldest !== undefined) lastRecorded.delete(oldest)
  }

  // 构造五元组存证内容与 LongTermMemory 写入字段
  const riskTags = Array.from(
    new Set([...(risks ?? []).map((r) => String(r.type ?? 'unknown')), 'auto']),
  )
  const operationContent = [
    `${action}`,
    `主体=desktop.user`,
    `客体=${target || source || 'unknown'}`,
    `来源=${source}`,
    `结果=auto_record`,
  ].join(' | ')

  const payload = {
    agent_id: 'desktop.monitor',
    operation_type: action,
    operation_content: operationContent,
    risk_level: mapRiskLevel(assessment),
    risk_score: assessment.overallScore,
    risk_tags: riskTags,
    decision: 'auto_record',
  }

  backendLog('info', '[存证联动] 高风险行为自动存证', {
    action,
    target,
    riskLevel: assessment.riskLevel,
    riskScore: assessment.overallScore,
  })

  // 异步写入：后端优先，失败降级本地
  void (async () => {
    try {
      const res = await backendRequest('POST', '/api/v1/memory/long-term/', payload)
      if (!res.ok) {
        throw new Error(`后端返回 ${res.status}: ${(await res.text().catch(() => '')) || res.statusText}`)
      }
      const json = (await res.json()) as Record<string, unknown>
      const record = (json.data ?? json) as { id?: number; chain_index?: number }
      backendLog('info', '[存证联动] 自动存证成功（LongTermMemory）', {
        id: record.id,
        action,
        chainIndex: record.chain_index,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      backendLog('warn', '[存证联动] 后端存证失败，降级本地记录', {
        error: msg,
        action,
        target,
      })
      try {
        if (sink?.saveOperation) {
          await sink.saveOperation({
            id: `auto-evidence-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type: 'governance_evidence',
            title: `高风险行为自动存证 ${action}`,
            content: operationContent,
            source: 'monitoring',
            status: 'recorded',
            risk_level: mapRiskLevel(assessment),
            risk_score: assessment.overallScore,
            should_block: false,
            context: JSON.stringify({ source, riskTags, behavior: behavior.details }),
            explanation: '后端不可用时的本地存证降级（监控自动联动）',
          })
        }
      } catch (e2) {
        backendLog('error', '[存证联动] 本地降级记录失败', {
          error: e2 instanceof Error ? e2.message : String(e2),
        })
      }
    }
  })()
}
