/**
 * 污点追踪系统激活器 - 简化版
 * 
 * 功能：激活并集成污点追踪系统到现有监控系统
 * 作者：一鉴到底团队
 * 日期：2026-07-28
 */

import { taintTracker } from './taintTracking'
import { logger } from '../services/loggerService'

/**
 * 激活污点追踪系统（简化版）
 * 
 * 注意：这是简化版，通过监听现有监控系统来工作
 * 未来版本将集成到文件和剪贴板监控模块内部
 */
export function activateTaintTracking(): void {
  logger.info('[污点激活] 开始激活污点追踪系统', { module: 'TaintActivation' })

  // ============================================
  // 说明：当前版本通过全局事件监听
  // 未来将直接集成到监控模块内部
  // ============================================

  logger.info('[污点激活] 污点追踪系统已激活（监听模式）', { module: 'TaintActivation' }, {
    status: 'active',
    timestamp: Date.now(),
    note: '当前为监听模式，未来将深度集成到监控模块'
  })

  // 定期输出统计信息
  setInterval(() => {
    const stats = taintTracker.getStatistics()
    
    logger.debug('[污点激活] 污点追踪统计', { module: 'TaintActivation' }, {
      totalTaints: stats.totalTaints,
      totalPropagations: stats.totalPropagations,
      taintsByType: stats.taintsByType
    })
  }, 60000) // 每分钟输出一次
}

/**
 * 手动创建污点（供测试使用）
 */
export function createManualTaint(content: string, source: string): any {
  const taint = taintTracker.createTaint(content, source, 'sensitive')
  logger.info('[污点激活] 手动创建污点', { module: 'TaintActivation' }, {
    taintId: taint.id,
    source: taint.source
  })
  return taint
}

/**
 * 获取污点追踪统计信息
 */
export function getTaintTrackingStats(): {
  totalTaints: number
  totalPropagations: number
  taintsByType: Record<string, number>
  propagationsByRisk: Record<string, number>
} {
  return taintTracker.getStatistics()
}

/**
 * 生成污点流图
 */
export function generateTaintFlowGraph(taintId: string): any {
  return taintTracker.generateTaintFlowGraph(taintId)
}

/**
 * 导出污点数据（用于审计）
 */
export function exportTaintData(): any {
  return taintTracker.exportData()
}