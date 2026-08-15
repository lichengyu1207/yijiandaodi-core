/**
 * agent/plugins/petPlugin.ts — 治理桌宠插件（P1：挂载决策链路钩子驱动桌宠）
 *
 * 融会贯通三大能力，让桌宠成为「感知（安全）→ 决策（治理）→ 行动（Agent）」的
 * 实时人格化化身：
 *  - onRunStart     开工播报（Agent 执行态）→ 桌宠进入「工作」状态
 *  - onRiskAssessed 风险定级播报（AI 治理）→ 桌宠按 severity 切换状态 + 播报定级
 *  - beforeAlert    告警播报（安全）→ 桌宠红色警示
 *  - onRunEnd       本轮结果播报（Agent + 治理闭环）→ 成功/失败反馈
 *
 * 零改动治理引擎核心：本插件是 GovPlugin，经 PluginRegistry 挂载到共享 HooksHost，
 * 引擎 emit 时自动触发。桌宠侧不感知插件，只暴露一个窄 driver 接口。
 *
 * 详见 docs/AGENT_FUSION_MODULE_DESIGN.md §3 M7 / 桌宠融合方案 P1
 */

import type { GovernanceLoggerLike } from '../../events/governanceLogger'
import type {
  AlertPayload,
  RiskAssessment,
  RunEndData,
  RunStartData,
} from '../hooks/types'

/** 桌宠可表达的状态（对齐既有 PetState，扩展 thinking 表示「工作中」） */
export type PetMood = 'green' | 'yellow' | 'red' | 'thinking'

/** 桌宠驱动接口：petPlugin 只依赖这个窄接口，与具体渲染窗口解耦 */
export interface PetDriver {
  /** 切换桌宠状态/情绪 */
  setState(mood: PetMood, message?: string): void
  /** 弹出一个气泡播报（自动淡出） */
  showBubble(text: string): void
}

const silentLogger: GovernanceLoggerLike = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  trace: () => {},
}

/** 短文案截断（气泡不宜过长） */
function brief(text: string, max = 40): string {
  const t = text?.trim() ?? ''
  return t.length > max ? `${t.slice(0, max)}…` : t
}

/** 根据定级生成气泡文案 */
function assessmentBubble(assessment: RiskAssessment): string {
  const severityText = assessment.severity === 'critical' ? '严重' : assessment.severity === 'warning' ? '中等' : '低'
  const verifyText = assessment.hasVerifyFlow ? '已进四官复核' : assessment.hasVerify ? '已触发验证' : '待复核'
  return `检测到${severityText}风险（${assessment.stream}），${verifyText}`
}

/**
 * 构建治理桌宠插件。
 * @param driver 桌宠驱动（main.ts 注入 PetWindow 适配层）
 * @param opts 可配 logger
 */
export function createPetPlugin(driver: PetDriver, opts?: { logger?: GovernanceLoggerLike }) {
  const logger = opts?.logger ?? silentLogger

  return {
    id: 'governance-pet',
    version: '1.0.0',
    description: '治理桌宠：把 Agent 执行、安全告警、AI 治理定级实时呈现为桌宠状态与气泡播报',
    priority: 10, // 桌宠播报优先于其他 observe 观察者

    hooks: {
      /** onRunStart：本轮治理开工（observe，fire-and-forget） */
      onRunStart(data: RunStartData): void {
        logger.trace('[桌宠插件] 治理开工', { module: 'PluginRegistry', pluginId: 'governance-pet' }, {
          runId: data.runId,
          stream: data.stream,
        })
        driver.setState('thinking', `开始治理：${data.stream} 事件`)
      },

      /** onRiskAssessed：定级后播报（observe） */
      onRiskAssessed(assessment: RiskAssessment): void {
        const mood: PetMood = assessment.severity === 'critical' ? 'red' : assessment.severity === 'warning' ? 'yellow' : 'green'
        const bubble = assessmentBubble(assessment)
        logger.trace('[桌宠插件] 风险定级', { module: 'PluginRegistry', pluginId: 'governance-pet' }, {
          runId: assessment.runId,
          stream: assessment.stream,
          severity: assessment.severity,
          mood,
        })
        driver.setState(mood, bubble)
        driver.showBubble(bubble)
      },

      /** beforeAlert：告警前桌宠警示（不抑制，observe 语义——返回 undefined 放行告警） */
      beforeAlert(alert: AlertPayload): void {
        const mood: PetMood = alert.level === 'critical' ? 'red' : 'yellow'
        logger.trace('[桌宠插件] 治理告警', { module: 'PluginRegistry', pluginId: 'governance-pet' }, {
          runId: alert.runId,
          level: alert.level,
          title: alert.title,
        })
        driver.setState(mood, brief(alert.description))
        driver.showBubble(`⚠️ ${brief(alert.title)}`)
      },

      /** onRunEnd：本轮结果播报（observe） */
      onRunEnd(data: RunEndData): void {
        const failed = data.failed > 0
        const mood: PetMood = failed ? 'yellow' : 'green'
        const bubble = failed
          ? `本轮 ${data.actions} 个动作，${data.failed} 个失败`
          : `本轮治理完成：${data.succeeded}/${data.actions} 全部成功`
        logger.trace('[桌宠插件] 治理收尾', { module: 'PluginRegistry', pluginId: 'governance-pet' }, {
          runId: data.runId,
          stream: data.stream,
          actions: data.actions,
          succeeded: data.succeeded,
          failed: data.failed,
          followUp: data.followUp,
        })
        driver.setState(mood, bubble)
        driver.showBubble(bubble)
      },
    },
  }
}
