/**
 * events/monitorEventAdapter.ts — M6 监控器事件化适配层
 *
 * 来源：OpenClaw 事件模型（已落地到 AgentEventBus）。作用是把现有各 monitor 的
 * "回调"改成"发事件"（bus.publish），**不动监控器检测逻辑**；同时保留现有 UI 消费
 * （onRiskDetected / onProcessDetected / ... 先发布后消费，兼容现有告警与桌宠）。
 *
 * 映射：
 *  - fileMonitor.setRiskDetectedCallback        → file 流
 *  - clipboardMonitor.setRiskDetectedCallback   → clipboard 流
 *  - processMonitor.setAIAgentDetectedCallback  → process 流
 *  - processMonitor.setToolSessionEndedCallback → process 流（含关联文件）
 *  - networkMonitor.setAIAPIRequestDetectedCallback → network 流
 *  - apiCallMonitor.setHighRiskCallback / setApiCallDetectedCallback → api_call 流
 *  - memoryMonitor 'alert' / cpuMonitor 'cpu-warning'|'cpu-critical' → resource 流
 *  - attach/detach 服务生命周期                      → lifecycle 流
 *
 * 详见 docs/AGENT_FUSION_MODULE_DESIGN.md §0.2 / M6 / §6 渐进替换
 */

import type { AgentEventBus, AgentEventStream, RiskEventData } from './agentEventBus'
import type { GovernanceLoggerLike } from './governanceLogger'
import type { FileMonitor, RiskResult } from '../monitoring/fileMonitor'
import type { ClipboardMonitor } from '../monitoring/clipboardMonitor'
import type { ProcessInfo, ToolSession } from '../monitoring/processMonitor'
import type { ProcessMonitor } from '../monitoring/processMonitor'
import type { NetworkRequest } from '../monitoring/networkMonitor'
import type { NetworkMonitor } from '../monitoring/networkMonitor'
import type { ApiCallInfo } from '../monitoring/apiCallMonitor'
import type { ApiCallMonitor } from '../monitoring/apiCallMonitor'
import type { MemoryMonitorService } from '../services/memoryMonitor'
import type { CPUMonitor } from '../services/cpuMonitor'

export type Severity = RiskEventData['severity']

/** 现有 UI 消费回调（由 main.ts 传入，先发布后消费） */
export interface MonitorEventAdapterOptions {
  bus: AgentEventBus
  logger: GovernanceLoggerLike
  /** 风险检测（文件/剪贴板）：risks + 来源标签 + 检测结果 */
  onRiskDetected?: (risks: RiskResult[], source: string, detectionResult?: unknown) => void
  /** AI Agent 进程检测 */
  onProcessDetected?: (process: ProcessInfo) => void
  /** AI API 网络请求检测 */
  onNetworkRequestDetected?: (request: NetworkRequest) => void
  /** API 高风险调用 */
  onHighRiskApiCall?: (info: ApiCallInfo) => void
  /** API 调用检测（任意） */
  onApiCallDetected?: (info: ApiCallInfo) => void
}

/** attach 需要持有的监控器集合 */
export interface MonitorSet {
  fileMonitor: FileMonitor
  clipboardMonitor: ClipboardMonitor
  processMonitor: ProcessMonitor
  networkMonitor: NetworkMonitor
  apiCallMonitor: ApiCallMonitor
  memoryMonitor?: MemoryMonitorService
  cpuMonitor?: CPUMonitor
}

/**
 * 监控器事件化适配器：把 monitor 回调接到事件总线，同时透传原消费逻辑。
 * 只加"发布"，保留现有回调消费，可逐步灰度、不回退风险。
 */
export class MonitorEventAdapter {
  private bus: AgentEventBus
  private logger: GovernanceLoggerLike
  private opts: MonitorEventAdapterOptions
  private attached = false
  /** EventEmitter 型监控器（memory/cpu）的退订处理器 */
  private emitterDisposers: Array<() => void> = []

  constructor(opts: MonitorEventAdapterOptions) {
    this.bus = opts.bus
    this.logger = opts.logger
    this.opts = opts
  }

  /** 接管 6 类监控器回调 → 先 publish 再消费；重复调用安全（重新接管） */
  attach(monitors: MonitorSet): void {
    const { fileMonitor, clipboardMonitor, processMonitor, networkMonitor, apiCallMonitor } = monitors

    // ---- file 流（文件风险检测）----
    fileMonitor.setRiskDetectedCallback((risks, filePath, result) => {
      this.publishRisk('file', {
        source: 'file',
        severity: this.severityFromRisks(risks),
        riskScore: risks.length,
        file: { path: filePath, operation: 'modify' },
        risks: risks.map((r) => ({ type: r.type, risk: r.risk, matched: r.matched })),
      })
      this.opts.onRiskDetected?.(risks, `文件 ${filePath}`, result)
    })

    // ---- clipboard 流（剪贴板风险检测）----
    clipboardMonitor.setRiskDetectedCallback((risks, result) => {
      this.publishRisk('clipboard', {
        source: 'clipboard',
        severity: this.severityFromRisks(risks),
        riskScore: risks.length,
        risks: risks.map((r) => ({ type: r.type, risk: r.risk, matched: r.matched })),
      })
      this.opts.onRiskDetected?.(risks, '剪贴板', result)
    })

    // ---- process 流（AI Agent 进程）----
    processMonitor.setAIAgentDetectedCallback((process) => {
      this.publishRisk('process', {
        source: 'process',
        severity: 'info',
        process: { tool: process.name, sessionId: `proc_${process.pid}` },
      })
      this.opts.onProcessDetected?.(process)
    })

    // ---- process 流（工具会话结束 + 关联文件）----
    processMonitor.setToolSessionEndedCallback((session: ToolSession) => {
      this.publishRisk('process', {
        source: 'process',
        severity: 'info',
        process: {
          tool: session.toolName,
          sessionId: `proc_${session.pid}`,
          relatedFiles: session.relatedFiles ?? undefined,
        },
      })
    })

    // ---- network 流（AI API 请求）----
    networkMonitor.setAIAPIRequestDetectedCallback((request) => {
      this.publishRisk('network', {
        source: 'network',
        severity: 'info',
        apiCall: {
          url: request.foreignAddress,
          method: 'tcp',
          target: request.domain ?? request.foreignAddress,
        },
      })
      this.opts.onNetworkRequestDetected?.(request)
    })

    // ---- api_call 流（高风险调用）----
    apiCallMonitor.setHighRiskCallback((info) => {
      this.publishRisk('api_call', {
        source: 'api_call',
        severity: this.severityFromApiRisk(info.riskLevel),
        riskScore: info.riskScore,
        apiCall: { url: `${info.host}${info.path}`, method: info.method, target: info.host },
        findings: info.findings,
      })
      this.opts.onHighRiskApiCall?.(info)
    })

    // ---- api_call 流（任意调用，AI 平台重点关注）----
    apiCallMonitor.setApiCallDetectedCallback((info) => {
      this.publishRisk('api_call', {
        source: 'api_call',
        severity: info.isAIProvider ? 'info' : this.severityFromApiRisk(info.riskLevel),
        riskScore: info.riskScore,
        apiCall: { url: `${info.host}${info.path}`, method: info.method, target: info.host },
        findings: info.findings,
      })
      this.opts.onApiCallDetected?.(info)
    })

    // ---- resource 流（内存告警）----
    if (monitors.memoryMonitor) {
      const onMemoryAlert = (alert: { level: string; message: string; usagePercent: number }): void => {
        this.publishRisk('resource', {
          source: 'resource',
          severity: alert.level === 'critical' ? 'critical' : 'warning',
          riskScore: Math.round(alert.usagePercent ?? 0),
          resource: { kind: 'memory', message: alert.message, usagePercent: alert.usagePercent },
        })
      }
      monitors.memoryMonitor.on('alert', onMemoryAlert)
      this.emitterDisposers.push(() => monitors.memoryMonitor!.off('alert', onMemoryAlert))
    }

    // ---- resource 流（CPU 告警）----
    if (monitors.cpuMonitor) {
      const onCpuAlert = (level: 'warning' | 'critical') => (data: { message?: string; usage?: unknown }): void => {
        this.publishRisk('resource', {
          source: 'resource',
          severity: level,
          resource: { kind: 'cpu', message: data.message ?? '', usage: data.usage },
        })
      }
      const warnHandler = onCpuAlert('warning')
      const critHandler = onCpuAlert('critical')
      monitors.cpuMonitor.on('cpu-warning', warnHandler)
      monitors.cpuMonitor.on('cpu-critical', critHandler)
      this.emitterDisposers.push(() => {
        monitors.cpuMonitor!.off('cpu-warning', warnHandler)
        monitors.cpuMonitor!.off('cpu-critical', critHandler)
      })
    }

    // ---- lifecycle 流（治理感知层启动）----
    void this.bus.publish('lifecycle', {
      event: 'governance-monitoring-attached',
      ts: Date.now(),
    })

    this.attached = true
    this.logger.info('[监控事件适配] 已接管 6 类监控器回调，接入事件总线', {
      module: 'MonitorEventAdapter',
      function: 'attach',
    }, { streams: ['file', 'process', 'network', 'clipboard', 'api_call', 'resource'] })
  }

  /** 释放 EventEmitter 订阅（memory/cpu），不再接收新事件 */
  detach(): void {
    for (const dispose of this.emitterDisposers) dispose()
    this.emitterDisposers = []
    this.attached = false
    this.logger.info('[监控事件适配] 已解除 EventEmitter 订阅', {
      module: 'MonitorEventAdapter',
      function: 'detach',
    })
  }

  get isAttached(): boolean {
    return this.attached
  }

  // ==================== 内部 ====================

  /** 发布感知风险事件（fire-and-forget，单点异常只记日志，不阻断监控） */
  private publishRisk(stream: AgentEventStream, data: RiskEventData & Record<string, unknown>): void {
    void this.bus.publish(stream, data as RiskEventData).catch((e) => {
      this.logger.error('[监控事件适配] 发布失败', { module: 'MonitorEventAdapter' }, {
        stream,
        error: e instanceof Error ? e.message : e,
      })
    })
  }

  /** 从风险列表取最高严重级：high/critical→critical，medium→warning，其余 info */
  private severityFromRisks(risks: RiskResult[]): Severity {
    let worst: Severity = 'info'
    for (const r of risks) {
      const s = this.severityFromRiskLevel(r.risk)
      if (this.rank(s) > this.rank(worst)) worst = s
    }
    return worst
  }

  private severityFromRiskLevel(level: string): Severity {
    if (level === 'high' || level === 'critical') return 'critical'
    if (level === 'medium') return 'warning'
    return 'info'
  }

  /** API 风险等级映射：high→critical，medium→warning，其余 info */
  private severityFromApiRisk(level: string): Severity {
    if (level === 'high') return 'critical'
    if (level === 'medium') return 'warning'
    return 'info'
  }

  private rank(s: Severity): number {
    if (s === 'critical') return 3
    if (s === 'warning') return 2
    return 1
  }
}
