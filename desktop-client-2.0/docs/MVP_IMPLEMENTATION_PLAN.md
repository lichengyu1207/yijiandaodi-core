# MVP 实施方案：基于现有代码库的最小可行开发

## 一、现有能力分析

### 已有监控能力 ✅
```
electron/monitoring/
├── fileMonitor.ts      ✅ 文件监控（实时）
├── clipboardMonitor.ts ✅ 剪贴板监控（500ms）
├── processMonitor.ts   ✅ 进程监控（5s）
└── networkMonitor.ts   ✅ 网络监控（10s）
```

### 已有服务能力 ✅
```
electron/services/
├── memoryMonitor.ts    ✅ 内存监控（Sprint 2）
├── cpuMonitor.ts       ✅ CPU监控（Sprint 2）
├── loggerService.ts    ✅ 日志系统（Sprint 2）
└── errorMonitor.ts     ✅ 错误监控（Sprint 2）
```

---

## 二、方向一 MVP：最小可行主动监控

### 核心功能
基于现有监控模块，增加：
1. **日志结构化解析** - 将监控结果转为 Agent 行为日志
2. **实时风险评分** - 基于现有检测能力实时打分
3. **主动预警通知** - 风险超过阈值时主动通知

### MVP 开发清单

#### 文件1: `electron/monitoring/agentBehaviorParser.ts` (新增)
```typescript
/**
 * Agent 行为解析器 - MVP 版本
 * 功能：将现有监控结果解析为 Agent 行为日志
 */

import { RiskResult } from './fileMonitor'
import { AutoDetectionResult } from './autoDetector'

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
        detected_types: detectionResult.risks?.map(r => r.type) || []
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
        detected_types: detectionResult.risks?.map(r => r.type) || []
      }
    }
  }

  /**
   * 检测 Agent 类型
   */
  private static detectAgentType(filePath: string): AgentBehaviorLog['agentType'] {
    if (filePath.includes('Cursor')) return 'cursor'
    if (filePath.includes('Claude')) return 'claude'
    if (filePath.includes('Copilot')) return 'copilot'
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
    
    return Math.min(score, 100)
  }
}
```

#### 文件2: `electron/monitoring/behaviorRiskScorer.ts` (新增)
```typescript
/**
 * 行为风险评分器 - MVP 版本
 * 功能：实时计算 Agent 行为风险分数
 */

import { AgentBehaviorLog } from './agentBehaviorParser'

export interface RiskAssessment {
  overallScore: number
  riskLevel: 'safe' | 'warning' | 'danger' | 'critical'
  recommendations: string[]
  shouldAlert: boolean
}

export class BehaviorRiskScorer {
  private recentBehaviors: AgentBehaviorLog[] = []
  private readonly maxHistorySize = 100
  private readonly alertThreshold = 70

  /**
   * 添加行为日志并评估风险
   */
  assessBehavior(behavior: AgentBehaviorLog): RiskAssessment {
    // 1. 添加到历史记录
    this.recentBehaviors.push(behavior)
    if (this.recentBehaviors.length > this.maxHistorySize) {
      this.recentBehaviors.shift()
    }

    // 2. 计算综合风险分数
    const overallScore = this.calculateOverallScore()

    // 3. 确定风险等级
    const riskLevel = this.determineRiskLevel(overallScore)

    // 4. 生成建议
    const recommendations = this.generateRecommendations(overallScore)

    // 5. 判断是否需要告警
    const shouldAlert = overallScore >= this.alertThreshold

    return {
      overallScore,
      riskLevel,
      recommendations,
      shouldAlert
    }
  }

  /**
   * 计算综合风险分数
   */
  private calculateOverallScore(): number {
    if (this.recentBehaviors.length === 0) return 0

    // 最近10个行为的加权平均
    const recentBehaviors = this.recentBehaviors.slice(-10)
    
    // 时间衰减因子（越近的行为权重越高）
    const weights = recentBehaviors.map((_, index) => 
      Math.pow(1.2, index)
    )
    
    const totalWeight = weights.reduce((a, b) => a + b, 0)
    const weightedSum = recentBehaviors.reduce((sum, behavior, index) => {
      return sum + behavior.riskScore * weights[index]
    }, 0)

    // 加入频率因子（短时间内多次风险行为加分）
    const frequencyBonus = this.calculateFrequencyBonus()
    
    return Math.min((weightedSum / totalWeight) + frequencyBonus, 100)
  }

  /**
   * 计算频率加分
   */
  private calculateFrequencyBonus(): number {
    const oneMinuteAgo = Date.now() - 60000
    const recentRiskCount = this.recentBehaviors.filter(
      b => b.timestamp > oneMinuteAgo && b.riskScore > 50
    ).length

    // 1分钟内超过3次风险行为，每次加5分
    return Math.max(0, (recentRiskCount - 3) * 5)
  }

  /**
   * 确定风险等级
   */
  private determineRiskLevel(score: number): RiskAssessment['riskLevel'] {
    if (score >= 90) return 'critical'
    if (score >= 70) return 'danger'
    if (score >= 50) return 'warning'
    return 'safe'
  }

  /**
   * 生成建议
   */
  private generateRecommendations(score: number): string[] {
    const recommendations: string[] = []

    if (score >= 70) {
      recommendations.push('检测到高风险行为，建议暂停Agent操作')
    }
    
    if (score >= 90) {
      recommendations.push('发现严重安全风险，立即介入审查')
    }

    // 根据最近行为类型给出建议
    const recentRisks = this.recentBehaviors
      .slice(-5)
      .filter(b => b.riskScore > 50)
    
    if (recentRisks.some(b => b.details.detected_types?.includes('sqli'))) {
      recommendations.push('发现SQL注入风险，建议检查数据库操作')
    }
    
    if (recentRisks.some(b => b.details.detected_types?.includes('apikey'))) {
      recommendations.push('发现API Key泄露风险，建议立即更新密钥')
    }

    return recommendations
  }

  /**
   * 获取最近的行为日志
   */
  getRecentBehaviors(limit: number = 10): AgentBehaviorLog[] {
    return this.recentBehaviors.slice(-limit)
  }
}
```

#### 文件3: `electron/monitoring/proactiveAlerter.ts` (新增)
```typescript
/**
 * 主动告警器 - MVP 版本
 * 功能：基于风险评估主动发送通知
 */

import { Notification } from 'electron'
import { RiskAssessment } from './behaviorRiskScorer'
import { AgentBehaviorLog } from './agentBehaviorParser'
import { smartAlerter } from './smartAlerter'

export class ProactiveAlerter {
  private lastAlertTime = 0
  private readonly minAlertInterval = 60000 // 1分钟

  /**
   * 处理风险评估结果，决定是否告警
   */
  handleAssessment(
    behavior: AgentBehaviorLog,
    assessment: RiskAssessment
  ): void {
    // 1. 记录到智能提示器
    smartAlerter.alert(assessment.overallScore, assessment.recommendations.join('; '))

    // 2. 如果需要告警且间隔足够，发送系统通知
    if (assessment.shouldAlert && this.canAlert()) {
      this.sendSystemNotification(behavior, assessment)
      this.lastAlertTime = Date.now()
    }
  }

  /**
   * 检查是否可以发送告警
   */
  private canAlert(): boolean {
    return Date.now() - this.lastAlertTime >= this.minAlertInterval
  }

  /**
   * 发送系统通知
   */
  private sendSystemNotification(
    behavior: AgentBehaviorLog,
    assessment: RiskAssessment
  ): void {
    const title = this.getNotificationTitle(assessment.riskLevel)
    const body = this.getNotificationBody(behavior, assessment)

    const notification = new Notification({
      title,
      body,
      silent: false,
      urgency: assessment.riskLevel === 'critical' ? 'critical' : 'normal'
    })

    notification.show()
  }

  /**
   * 获取通知标题
   */
  private getNotificationTitle(level: RiskAssessment['riskLevel']): string {
    const titles = {
      'safe': '✅ Agent 行为正常',
      'warning': '⚠️ Agent 行为异常',
      'danger': '🔴 Agent 高风险操作',
      'critical': '🚨 Agent 严重安全风险'
    }
    return titles[level]
  }

  /**
   * 获取通知内容
   */
  private getNotificationBody(
    behavior: AgentBehaviorLog,
    assessment: RiskAssessment
  ): string {
    let body = `检测到 ${behavior.agentType} 执行 ${behavior.action}\n`
    body += `风险分数: ${assessment.overallScore}/100\n`
    
    if (assessment.recommendations.length > 0) {
      body += `建议: ${assessment.recommendations[0]}`
    }
    
    return body
  }
}
```

---

## 三、方向四 MVP：最小可行自监控

### 核心功能
基于 Sprint 2 的监控服务，增加：
1. **治理健康度指标采集**
2. **简单基线对比**
3. **基础仪表盘展示**

### MVP 开发清单

#### 文件4: `electron/services/governanceHealthMonitor.ts` (新增)
```typescript
/**
 * 治理健康度监控器 - MVP 版本
 * 功能：采集和评估系统治理健康度
 */

import { MemoryMonitorService } from './memoryMonitor'
import { CPUMonitor } from './cpuMonitor'

export interface HealthMetrics {
  accuracy: {
    value: number
    baseline: number
    deviation: number
    status: 'normal' | 'warning' | 'critical'
  }
  performance: {
    avgResponseTime: number
    baseline: number
    deviation: number
    status: 'normal' | 'warning' | 'critical'
  }
  falsePositiveRate: {
    value: number
    baseline: number
    deviation: number
    status: 'normal' | 'warning' | 'critical'
  }
  overallHealth: number
  overallStatus: 'healthy' | 'degraded' | 'critical'
}

export class GovernanceHealthMonitor {
  private memoryMonitor: MemoryMonitorService
  private cpuMonitor: CPUMonitor
  
  // 基线值（基于文档中的技术指标）
  private readonly baselines = {
    accuracy: 0.912,        // 91.2% 召回率
    responseTime: 180,      // 0.18秒 = 180ms
    falsePositiveRate: 0.06 // 6%
  }

  constructor(memoryMonitor: MemoryMonitorService, cpuMonitor: CPUMonitor) {
    this.memoryMonitor = memoryMonitor
    this.cpuMonitor = cpuMonitor
  }

  /**
   * 采集健康度指标
   */
  collectMetrics(): HealthMetrics {
    // 1. 准确率指标（模拟数据，实际需要抽样评估）
    const accuracy = this.collectAccuracyMetrics()
    
    // 2. 性能指标
    const performance = this.collectPerformanceMetrics()
    
    // 3. 误报率指标（模拟数据）
    const falsePositiveRate = this.collectFalsePositiveMetrics()
    
    // 4. 计算整体健康度
    const overallHealth = this.calculateOverallHealth(
      accuracy,
      performance,
      falsePositiveRate
    )
    
    // 5. 确定整体状态
    const overallStatus = this.determineOverallStatus(overallHealth)

    return {
      accuracy,
      performance,
      falsePositiveRate,
      overallHealth,
      overallStatus
    }
  }

  /**
   * 采集准确率指标
   */
  private collectAccuracyMetrics(): HealthMetrics['accuracy'] {
    // MVP: 使用内存和CPU状态作为健康度代理
    const memReport = this.memoryMonitor.generateReport()
    
    // 如果系统资源紧张，认为准确率可能下降
    const proxyAccuracy = 1 - (memReport.current.risk_score / 200) // 简化映射
    
    const value = Math.min(proxyAccuracy, 1)
    const deviation = value - this.baselines.accuracy
    
    return {
      value,
      baseline: this.baselines.accuracy,
      deviation,
      status: this.getStatus(Math.abs(deviation), 0.05, 0.1)
    }
  }

  /**
   * 采集性能指标
   */
  private collectPerformanceMetrics(): HealthMetrics['performance'] {
    const cpuStats = this.cpuMonitor.getRealtimeStats()
    const avgResponseTime = cpuStats.current.total * 10 // 简化映射
    
    const deviation = avgResponseTime - this.baselines.responseTime
    
    return {
      avgResponseTime,
      baseline: this.baselines.responseTime,
      deviation,
      status: this.getStatus(Math.abs(deviation), 50, 100)
    }
  }

  /**
   * 采集误报率指标
   */
  private collectFalsePositiveMetrics(): HealthMetrics['falsePositiveRate'] {
    // MVP: 使用固定值或随机波动模拟
    const value = this.baselines.falsePositiveRate + (Math.random() * 0.02 - 0.01)
    const deviation = value - this.baselines.falsePositiveRate
    
    return {
      value,
      baseline: this.baselines.falsePositiveRate,
      deviation,
      status: this.getStatus(Math.abs(deviation), 0.02, 0.05)
    }
  }

  /**
   * 计算整体健康度
   */
  private calculateOverallHealth(
    accuracy: HealthMetrics['accuracy'],
    performance: HealthMetrics['performance'],
    falsePositiveRate: HealthMetrics['falsePositiveRate']
  ): number {
    // 加权平均
    const weights = {
      accuracy: 0.5,
      performance: 0.3,
      falsePositiveRate: 0.2
    }

    const accuracyScore = accuracy.value * 100
    const performanceScore = Math.max(0, 100 - (performance.avgResponseTime / 10))
    const fpsScore = Math.max(0, 100 - (falsePositiveRate.value * 1000))

    return (
      accuracyScore * weights.accuracy +
      performanceScore * weights.performance +
      fpsScore * weights.falsePositiveRate
    )
  }

  /**
   * 确定整体状态
   */
  private determineOverallStatus(health: number): HealthMetrics['overallStatus'] {
    if (health >= 85) return 'healthy'
    if (health >= 60) return 'degraded'
    return 'critical'
  }

  /**
   * 获取状态
   */
  private getStatus(deviation: number, warningThreshold: number, criticalThreshold: number): 'normal' | 'warning' | 'critical' {
    if (deviation >= criticalThreshold) return 'critical'
    if (deviation >= warningThreshold) return 'warning'
    return 'normal'
  }
}
```

#### 文件5: `src/components/HealthDashboard.tsx` (前端组件)
```typescript
/**
 * 治理健康度仪表盘 - MVP 版本
 */

import React, { useState, useEffect } from 'react'
import { Card, Progress, Alert } from 'antd'

interface HealthMetrics {
  accuracy: { value: number; baseline: number; status: string }
  performance: { avgResponseTime: number; baseline: number; status: string }
  falsePositiveRate: { value: number; baseline: number; status: string }
  overallHealth: number
  overallStatus: 'healthy' | 'degraded' | 'critical'
}

export const HealthDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<HealthMetrics | null>(null)

  useEffect(() => {
    // 定期获取健康度指标
    const fetchMetrics = async () => {
      const result = await window.electronAPI.getHealthMetrics()
      setMetrics(result)
    }

    fetchMetrics()
    const interval = setInterval(fetchMetrics, 10000) // 10秒更新一次
    return () => clearInterval(interval)
  }, [])

  if (!metrics) return <div>加载中...</div>

  return (
    <div className="health-dashboard">
      {/* 整体健康度 */}
      <Card title="系统健康度" style={{ marginBottom: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <Progress
            type="circle"
            percent={metrics.overallHealth}
            status={metrics.overallStatus === 'healthy' ? 'success' : 
                    metrics.overallStatus === 'degraded' ? 'normal' : 'exception'}
            format={percent => `${percent.toFixed(1)}%`}
          />
          <Alert
            message={`系统状态: ${
              metrics.overallStatus === 'healthy' ? '健康' :
              metrics.overallStatus === 'degraded' ? '降级' : '严重'
            }`}
            type={metrics.overallStatus === 'healthy' ? 'success' : 
                  metrics.overallStatus === 'degraded' ? 'warning' : 'error'}
            style={{ marginTop: 16 }}
          />
        </div>
      </Card>

      {/* 准确率 */}
      <Card title="校验准确率" style={{ marginBottom: 16 }}>
        <Progress
          percent={metrics.accuracy.value * 100}
          status={metrics.accuracy.status === 'normal' ? 'success' : 
                  metrics.accuracy.status === 'warning' ? 'normal' : 'exception'}
        />
        <div style={{ marginTop: 8, color: '#666' }}>
          基线: {(metrics.accuracy.baseline * 100).toFixed(1)}%
        </div>
      </Card>

      {/* 响应时间 */}
      <Card title="响应时间" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 24, fontWeight: 'bold' }}>
          {metrics.performance.avgResponseTime.toFixed(0)} ms
        </div>
        <div style={{ marginTop: 8, color: '#666' }}>
          基线: {metrics.performance.baseline} ms
        </div>
      </Card>

      {/* 误报率 */}
      <Card title="误报率">
        <Progress
          percent={(1 - metrics.falsePositiveRate.value) * 100}
          format={percent => `${((100 - percent) / 100 * 100).toFixed(1)}%`}
          status={metrics.falsePositiveRate.status === 'normal' ? 'success' : 
                  metrics.falsePositiveRate.status === 'warning' ? 'normal' : 'exception'}
        />
        <div style={{ marginTop: 8, color: '#666' }}>
          基线: {(metrics.falsePositiveRate.baseline * 100).toFixed(1)}%
        </div>
      </Card>
    </div>
  )
}
```

---

## 四、集成到现有系统

### 修改文件: `electron/monitoring/index.ts`
```typescript
// 新增导出
export { AgentBehaviorParser } from './agentBehaviorParser'
export { BehaviorRiskScorer } from './behaviorRiskScorer'
export { ProactiveAlerter } from './proactiveAlerter'
```

### 修改文件: `electron/services/index.ts`
```typescript
// 新增导出
export { GovernanceHealthMonitor } from './governanceHealthMonitor'
export type { HealthMetrics } from './governanceHealthMonitor'
```

### 修改文件: `electron/ipc/handlers.ts`
```typescript
// 新增 IPC 处理器
import { GovernanceHealthMonitor } from '../services'

// 健康度指标查询
ipcMain.handle('get-health-metrics', async () => {
  const healthMonitor = container.resolve<GovernanceHealthMonitor>('healthMonitor')
  return healthMonitor.collectMetrics()
})
```

---

## 五、使用示例

### 在主进程启动
```typescript
// electron/main.ts
import { AgentBehaviorParser, BehaviorRiskScorer, ProactiveAlerter } from './monitoring'
import { GovernanceHealthMonitor } from './services'

// 初始化
const behaviorParser = new AgentBehaviorParser()
const riskScorer = new BehaviorRiskScorer()
const alerter = new ProactiveAlerter()
const healthMonitor = new GovernanceHealthMonitor(memoryMonitor, cpuMonitor)

// 在文件监控回调中添加主动监控
fileMonitor.on('risk-detected', (result) => {
  const behavior = AgentBehaviorParser.parseFileEvent(
    result.filePath,
    result.content,
    result.detectionResult
  )
  
  const assessment = riskScorer.assessBehavior(behavior)
  alerter.handleAssessment(behavior, assessment)
})
```

---

## 六、MVP 验证清单

### 功能验证
- [ ] Agent 行为日志能正确解析
- [ ] 风险评分算法准确
- [ ] 主动通知正常触发
- [ ] 健康度指标正确采集
- [ ] 仪表盘实时更新

### 性能验证
- [ ] 内存开销 < 50MB
- [ ] CPU开销 < 5%
- [ ] 响应延迟 < 1秒

### 集成验证
- [ ] 与现有监控模块兼容
- [ ] 不影响原有功能
- [ ] 日志正确记录

---

**MVP 开发周期**: 约 1-2 周  
**技术风险**: 低（基于现有能力）  
**价值验证**: 快速验证主动监控的可行性和用户体验