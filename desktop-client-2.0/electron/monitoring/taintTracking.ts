/**
 * 污点追踪系统（Taint Tracking System）
 * 
 * 功能：标记敏感数据，追踪其在Agent系统中的流向
 * 参考：AgentStalker框架的污点分析机制
 */

import { logger } from '../services/loggerService'
import crypto from 'crypto'

/**
 * 污点类型
 */
export type TaintType = 'sensitive' | 'secret' | 'pii' | 'credential' | 'api_key'

/**
 * 污点标记
 */
export interface TaintMark {
  id: string              // 污点唯一ID
  source: string          // 污点来源（文件路径、剪贴板等）
  type: TaintType         // 污点类型
  contentHash: string     // 内容哈希（用于匹配）
  location: string        // 原始位置
  timestamp: number       // 创建时间
  metadata?: {            // 元数据
    fileName?: string
    fileType?: string
    size?: number
    tags?: string[]
  }
}

/**
 * 污点传播记录
 */
export interface TaintPropagation {
  id: string
  taintId: string         // 关联的污点ID
  fromLocation: string    // 来源位置
  toLocation: string      // 目标位置
  operation: string       // 操作类型（复制、修改、传输等）
  timestamp: number
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  metadata?: {
    agentType?: string
    processName?: string
    networkDomain?: string
  }
}

/**
 * 污点流图
 */
export interface TaintFlowGraph {
  nodes: Array<{
    id: string
    label: string
    type: 'source' | 'intermediate' | 'destination'
    timestamp: number
  }>
  edges: Array<{
    from: string
    to: string
    label: string
    riskLevel: string
  }>
}

/**
 * 污点追踪器
 */
export class TaintTracker {
  private taints: Map<string, TaintMark> = new Map()
  private propagations: TaintPropagation[] = []
  private readonly maxTaints = 10000        // 最大污点数量
  private readonly maxPropagations = 50000  // 最大传播记录数量

  constructor() {
    logger.info('[污点追踪] 初始化完成', { module: 'TaintTracker' })
  }

  /**
   * 创建污点标记
   */
  createTaint(
    content: string,
    source: string,
    type: TaintType,
    metadata?: TaintMark['metadata']
  ): TaintMark {
    // 检查是否已存在相同内容的污点
    const existingTaint = this.findTaintByContent(content)
    if (existingTaint) {
      logger.debug('[污点追踪] 污点已存在', { module: 'TaintTracker' }, {
        taintId: existingTaint.id,
        source: existingTaint.source
      })
      return existingTaint
    }

    // 创建新污点
    const taint: TaintMark = {
      id: this.generateTaintId(),
      source,
      type,
      contentHash: this.hashContent(content),
      location: source,
      timestamp: Date.now(),
      metadata
    }

    // 添加到污点库
    this.taints.set(taint.id, taint)

    // 限制污点数量
    this.enforceTaintLimit()

    // 记录日志
    logger.info('[污点追踪] 创建污点标记', { module: 'TaintTracker' }, {
      taintId: taint.id,
      type: taint.type,
      source: taint.source,
      contentHash: taint.contentHash.substring(0, 16) + '...'
    })

    return taint
  }

  /**
   * 追踪污点传播
   */
  trackPropagation(
    taintId: string,
    fromLocation: string,
    toLocation: string,
    operation: string,
    metadata?: TaintPropagation['metadata']
  ): TaintPropagation | null {
    // 验证污点是否存在
    const taint = this.taints.get(taintId)
    if (!taint) {
      logger.warn('[污点追踪] 污点不存在，无法追踪传播', { module: 'TaintTracker' }, {
        taintId,
        fromLocation,
        toLocation
      })
      return null
    }

    // 评估传播风险
    const riskLevel = this.assessPropagationRisk(taint, operation, metadata)

    // 创建传播记录
    const propagation: TaintPropagation = {
      id: this.generatePropagationId(),
      taintId,
      fromLocation,
      toLocation,
      operation,
      timestamp: Date.now(),
      riskLevel,
      metadata
    }

    // 添加到传播记录
    this.propagations.push(propagation)

    // 限制传播记录数量
    this.enforcePropagationLimit()

    // 记录日志
    logger.info('[污点追踪] 记录污点传播', { module: 'TaintTracker' }, {
      propagationId: propagation.id,
      taintId,
      operation,
      fromLocation,
      toLocation,
      riskLevel
    })

    // 如果是高风险传播，触发告警
    if (riskLevel === 'high' || riskLevel === 'critical') {
      this.alertHighRiskPropagation(propagation, taint)
    }

    return propagation
  }

  /**
   * 检查内容是否被污点标记
   */
  checkTainted(content: string): TaintMark | null {
    const hash = this.hashContent(content)

    for (const taint of this.taints.values()) {
      if (taint.contentHash === hash) {
        logger.info('[污点追踪] 检测到污点数据', { module: 'TaintTracker' }, {
          taintId: taint.id,
          type: taint.type,
          source: taint.source
        })
        return taint
      }
    }

    return null
  }

  /**
   * 根据内容查找污点
   */
  private findTaintByContent(content: string): TaintMark | null {
    const hash = this.hashContent(content)

    for (const taint of this.taints.values()) {
      if (taint.contentHash === hash) {
        return taint
      }
    }

    return null
  }

  /**
   * 获取污点的所有传播记录
   */
  getTaintPropagations(taintId: string): TaintPropagation[] {
    return this.propagations.filter(p => p.taintId === taintId)
  }

  /**
   * 生成污点流图
   */
  generateTaintFlowGraph(taintId: string): TaintFlowGraph {
    const nodes: TaintFlowGraph['nodes'] = []
    const edges: TaintFlowGraph['edges'] = []

    // 获取污点信息
    const taint = this.taints.get(taintId)
    if (!taint) {
      logger.warn('[污点追踪] 污点不存在，无法生成流图', { module: 'TaintTracker' }, { taintId })
      return { nodes, edges }
    }

    // 添加起始节点
    nodes.push({
      id: taint.location,
      label: `Source: ${taint.source}`,
      type: 'source',
      timestamp: taint.timestamp
    })

    // 获取所有传播记录
    const relatedPropagations = this.getTaintPropagations(taintId)

    // 添加传播节点和边
    const locations = new Set<string>()
    locations.add(taint.location)

    relatedPropagations.forEach(prop => {
      // 添加目标节点（如果尚未存在）
      if (!locations.has(prop.toLocation)) {
        nodes.push({
          id: prop.toLocation,
          label: prop.toLocation,
          type: prop === relatedPropagations[relatedPropagations.length - 1] ? 'destination' : 'intermediate',
          timestamp: prop.timestamp
        })
        locations.add(prop.toLocation)
      }

      // 添加边
      edges.push({
        from: prop.fromLocation,
        to: prop.toLocation,
        label: prop.operation,
        riskLevel: prop.riskLevel
      })
    })

    logger.info('[污点追踪] 生成污点流图', { module: 'TaintTracker' }, {
      taintId,
      nodeCount: nodes.length,
      edgeCount: edges.length
    })

    return { nodes, edges }
  }

  /**
   * 获取所有污点
   */
  getAllTaints(): TaintMark[] {
    return Array.from(this.taints.values())
  }

  /**
   * 获取统计信息
   */
  getStatistics(): {
    totalTaints: number
    totalPropagations: number
    taintsByType: Record<TaintType, number>
    propagationsByRisk: Record<string, number>
  } {
    const taintsByType: Record<TaintType, number> = {
      sensitive: 0,
      secret: 0,
      pii: 0,
      credential: 0,
      api_key: 0
    }

    this.taints.forEach(taint => {
      taintsByType[taint.type]++
    })

    const propagationsByRisk: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    }

    this.propagations.forEach(prop => {
      propagationsByRisk[prop.riskLevel]++
    })

    return {
      totalTaints: this.taints.size,
      totalPropagations: this.propagations.length,
      taintsByType,
      propagationsByRisk
    }
  }

  /**
   * 清除所有污点和传播记录
   */
  clear(): void {
    this.taints.clear()
    this.propagations = []
    logger.info('[污点追踪] 已清除所有污点和传播记录', { module: 'TaintTracker' })
  }

  /**
   * 导出污点数据（用于审计）
   */
  exportData(): {
    taints: TaintMark[]
    propagations: TaintPropagation[]
    exportedAt: number
  } {
    return {
      taints: this.getAllTaints(),
      propagations: [...this.propagations],
      exportedAt: Date.now()
    }
  }

  // ========== 私有方法 ==========

  /**
   * 生成污点ID
   */
  private generateTaintId(): string {
    return `taint_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * 生成传播ID
   */
  private generatePropagationId(): string {
    return `prop_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * 计算内容哈希
   */
  private hashContent(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex')
  }

  /**
   * 评估传播风险
   */
  private assessPropagationRisk(
    taint: TaintMark,
    operation: string,
    metadata?: TaintPropagation['metadata']
  ): 'low' | 'medium' | 'high' | 'critical' {
    // 基础风险：基于污点类型
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'

    if (taint.type === 'api_key' || taint.type === 'credential') {
      riskLevel = 'high'
    } else if (taint.type === 'secret') {
      riskLevel = 'medium'
    } else if (taint.type === 'pii') {
      riskLevel = 'medium'
    }

    // 操作类型加分
    const highRiskOperations = ['network_transfer', 'clipboard_copy', 'file_write', 'email_send']
    if (highRiskOperations.includes(operation)) {
      if (riskLevel === 'medium') riskLevel = 'high'
      else if (riskLevel === 'low') riskLevel = 'medium'
    }

    // 网络传播额外加分
    if (metadata?.networkDomain) {
      const suspiciousDomains = ['pastebin.com', 'ngrok.io', 'webhook.site']
      if (suspiciousDomains.some(d => metadata.networkDomain!.includes(d))) {
        riskLevel = 'critical'
      } else {
        if (riskLevel === 'medium') riskLevel = 'high'
      }
    }

    return riskLevel
  }

  /**
   * 高风险传播告警
   */
  private alertHighRiskPropagation(propagation: TaintPropagation, taint: TaintMark): void {
    logger.warn('[污点追踪] ⚠️ 高风险数据传播', { module: 'TaintTracker' }, {
      propagationId: propagation.id,
      taintId: taint.id,
      taintType: taint.type,
      operation: propagation.operation,
      from: propagation.fromLocation,
      to: propagation.toLocation,
      riskLevel: propagation.riskLevel
    })
  }

  /**
   * 限制污点数量
   */
  private enforceTaintLimit(): void {
    if (this.taints.size > this.maxTaints) {
      // 删除最旧的污点
      const sortedTaints = Array.from(this.taints.values())
        .sort((a, b) => a.timestamp - b.timestamp)

      const toRemove = sortedTaints.slice(0, this.taints.size - this.maxTaints)
      toRemove.forEach(taint => this.taints.delete(taint.id))

      logger.info('[污点追踪] 已清理旧污点', { module: 'TaintTracker' }, {
        removedCount: toRemove.length,
        remainingCount: this.taints.size
      })
    }
  }

  /**
   * 限制传播记录数量
   */
  private enforcePropagationLimit(): void {
    if (this.propagations.length > this.maxPropagations) {
      // 删除最旧的传播记录
      this.propagations.sort((a, b) => a.timestamp - b.timestamp)
      const removedCount = this.propagations.length - this.maxPropagations
      this.propagations = this.propagations.slice(-this.maxPropagations)

      logger.info('[污点追踪] 已清理旧传播记录', { module: 'TaintTracker' }, {
        removedCount,
        remainingCount: this.propagations.length
      })
    }
  }
}

// 导出单例
export const taintTracker = new TaintTracker()