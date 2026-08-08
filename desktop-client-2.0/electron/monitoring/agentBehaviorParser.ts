/**
 * Agent 行为解析器 - MVP 版本
 * 功能：将现有监控结果解析为 Agent 行为日志
 */

import type { AutoDetectionResult } from './autoDetector'

/**
 * Agent 行为日志结构
 */
export interface AgentBehaviorLog {
  timestamp: number
  agentType: 'cursor' | 'claude' | 'copilot' | 'unknown'
  action: string
  target: string
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  riskScore: number
  source: 'file' | 'clipboard' | 'process' | 'network'
  details: Record<string, any>
}

/**
 * Agent 行为解析器
 */
export class AgentBehaviorParser {
  /**
   * 解析文件监控结果
   */
  static parseFileEvent(
    filePath: string,
    content: string,
    detectionResult: AutoDetectionResult
  ): AgentBehaviorLog {
    return {
      timestamp: Date.now(),
      agentType: this.detectAgentType(filePath),
      action: 'file_operation',
      target: filePath,
      riskLevel: detectionResult.risk_level,
      riskScore: this.calculateRiskScore(detectionResult),
      source: 'file',
      details: {
        content_snippet: content.substring(0, 100),
        detected_types: detectionResult.risks?.map(r => r.type) || [],
        risk_count: detectionResult.risks?.length || 0
      }
    }
  }

  /**
   * 解析剪贴板监控结果
   */
  static parseClipboardEvent(
    content: string,
    detectionResult: AutoDetectionResult
  ): AgentBehaviorLog {
    return {
      timestamp: Date.now(),
      agentType: 'unknown',
      action: 'clipboard_operation',
      target: 'clipboard',
      riskLevel: detectionResult.risk_level,
      riskScore: this.calculateRiskScore(detectionResult),
      source: 'clipboard',
      details: {
        content_length: content.length,
        detected_types: detectionResult.risks?.map(r => r.type) || [],
        risk_count: detectionResult.risks?.length || 0
      }
    }
  }

  /**
   * 解析进程监控结果
   */
  static parseProcessEvent(
    processName: string,
    pid: number,
    isAgent: boolean
  ): AgentBehaviorLog {
    return {
      timestamp: Date.now(),
      agentType: this.detectAgentType(processName),
      action: isAgent ? 'agent_detected' : 'process_started',
      target: `${processName} (${pid})`,
      riskLevel: 'low',
      riskScore: isAgent ? 30 : 10,
      source: 'process',
      details: {
        process_name: processName,
        pid: pid,
        is_agent: isAgent
      }
    }
  }

  /**
   * 解析网络监控结果
   */
  static parseNetworkEvent(
    domain: string,
    port: number,
    isAIProvider: boolean
  ): AgentBehaviorLog {
    return {
      timestamp: Date.now(),
      agentType: 'unknown',
      action: isAIProvider ? 'ai_api_call' : 'network_request',
      target: `${domain}:${port}`,
      riskLevel: isAIProvider ? 'medium' : 'low',
      riskScore: isAIProvider ? 40 : 15,
      source: 'network',
      details: {
        domain: domain,
        port: port,
        is_ai_provider: isAIProvider
      }
    }
  }

  /**
   * 检测 Agent 类型
   */
  private static detectAgentType(pathOrName: string): AgentBehaviorLog['agentType'] {
    const lower = pathOrName.toLowerCase()
    
    if (lower.includes('cursor')) return 'cursor'
    if (lower.includes('claude')) return 'claude'
    if (lower.includes('copilot') || lower.includes('github copilot')) return 'copilot'
    
    return 'unknown'
  }

  /**
   * 计算风险分数 (0-100)
   */
  private static calculateRiskScore(result: AutoDetectionResult): number {
    const baseScore = {
      'low': 20,
      'medium': 50,
      'high': 80,
      'critical': 100
    }
    
    let score = baseScore[result.risk_level] || 0
    
    // 根据检测到的风险类型加分
    if (result.risks && result.risks.length > 0) {
      score += Math.min(result.risks.length * 5, 20)
    }
    
    // 根据内容类型调整
    if (result.content_type === 'code') {
      score += 10
    }
    
    return Math.min(score, 100)
  }

  /**
   * 批量解析行为日志
   */
  static parseBatch(
    events: Array<{
      type: 'file' | 'clipboard' | 'process' | 'network'
      data: any
      detectionResult: AutoDetectionResult
    }>
  ): AgentBehaviorLog[] {
    return events.map(event => {
      switch (event.type) {
        case 'file':
          return this.parseFileEvent(
            event.data.filePath,
            event.data.content,
            event.detectionResult
          )
        case 'clipboard':
          return this.parseClipboardEvent(
            event.data.content,
            event.detectionResult
          )
        case 'process':
          return this.parseProcessEvent(
            event.data.processName,
            event.data.pid,
            event.data.isAgent
          )
        case 'network':
          return this.parseNetworkEvent(
            event.data.domain,
            event.data.port,
            event.data.isAIProvider
          )
        default:
          throw new Error(`Unknown event type: ${event.type}`)
      }
    })
  }
}