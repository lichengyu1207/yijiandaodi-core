# 一鉴到底 · 技术方案设计文档

**文档版本**: V1.0  
**编制日期**: 2026年8月8日  
**编制人**: 技术团队

---

## 一、方向一：主动监控系统技术方案

### 1.1 系统架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                     Agent 执行环境                           │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│  │ Cursor IDE │  │ VS Code AI │  │ Claude App │  ...      │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘           │
└────────┼───────────────┼───────────────┼───────────────────┘
         │               │               │
         └───────────────┼───────────────┘
                         ▼
         ┌───────────────────────────────────┐
         │   Agent Harness Protocol (AHP)    │
         │   标准化日志采集接口               │
         └───────────────┬───────────────────┘
                         ▼
         ┌───────────────────────────────────┐
         │      日志采集层 (Log Collector)    │
         │  ├─ 文件监控 (已实现)              │
         │  ├─ 剪贴板监控 (已实现)            │
         │  ├─ 进程监控 (已实现)              │
         │  └─ 网络监控 (已实现)              │
         └───────────────┬───────────────────┘
                         ▼
         ┌───────────────────────────────────┐
         │   结构化日志解析器 (Log Parser)    │
         │  ├─ JSON 格式解析                  │
         │  ├─ 工具调用提取                   │
         │  ├─ 动作序列构建                   │
         │  └─ 推理轨迹提取                   │
         └───────────────┬───────────────────┘
                         ▼
         ┌───────────────────────────────────┐
         │   行为分析引擎 (Behavior Engine)   │
         │  ├─ 单次行为检测 (已有)            │
         │  ├─ 行为序列分析 (新增)            │
         │  ├─ 异常模式匹配 (新增)            │
         │  └─ 实时风险评估 (新增)            │
         └───────────────┬───────────────────┘
                         ▼
         ┌───────────────────────────────────┐
         │    干预决策系统 (Intervention)     │
         │  ├─ 预警通知                       │
         │  ├─ 操作延迟                       │
         │  ├─ 权限降级                       │
         │  └─ 强制拦截 (需用户授权)          │
         └───────────────────────────────────┘
```

### 1.2 技术选型

#### 1.2.1 日志采集层

**方案A: 基于现有监控系统扩展**
- ✅ **优势**: 无需额外开发，利用已有的文件/剪贴板/进程/网络监控
- ✅ **劣势**: 依赖Agent自身记录日志的完整性
- 📊 **适用性**: ⭐⭐⭐⭐ (推荐)

**方案B: Agent Harness Protocol (AHP)**
- ✅ **优势**: 标准化协议，适配多种Agent
- ✅ **劣势**: 需要Agent生态支持，推广周期长
- 📊 **适用性**: ⭐⭐⭐ (长期目标)

**推荐方案**: 方案A + 方案B渐进式
- 短期：基于现有监控系统，增加日志解析能力
- 中期：推动AHP协议标准化，吸引Agent开发者接入

#### 1.2.2 行为分析引擎

**技术栈**:
- **语言**: TypeScript + Node.js (与现有项目一致)
- **规则引擎**: json-rules-engine (轻量级，热加载支持)
- **ML模型**: TensorFlow.js (行为模式识别)
- **图数据库**: LevelDB (行为轨迹存储)

**核心算法**:
```typescript
// 行为异常检测算法
interface BehaviorPattern {
  sequence: string[]           // 行为序列
  frequency: number            // 频率
  riskScore: number            // 风险分数
  context: BehaviorContext     // 上下文
}

// 基于时序的行为检测
function detectAnomaly(
  currentBehavior: BehaviorPattern,
  historyPatterns: BehaviorPattern[]
): AnomalyResult {
  // 1. 序列匹配
  const sequenceMatch = matchSequence(
    currentBehavior.sequence, 
    historyPatterns
  )
  
  // 2. 频率异常检测
  const frequencyAnomaly = detectFrequencyAnomaly(
    currentBehavior.frequency,
    historyPatterns.map(p => p.frequency)
  )
  
  // 3. 综合风险评估
  return {
    isAnomaly: sequenceMatch.similarity < 0.7 || frequencyAnomaly,
    riskLevel: calculateRiskLevel(sequenceMatch, frequencyAnomaly),
    intervention: suggestIntervention(sequenceMatch)
  }
}
```

### 1.3 实施路径

#### 阶段1: 日志采集增强 (2-3周)

**任务清单**:
```
[P0] 日志解析器
├─ JSON 日志格式识别
├─ 工具调用日志提取 (Tool Use)
├─ 推理轨迹日志提取 (Chain of Thought)
└─ 结构化存储到 LevelDB

[P1] 实时日志流
├─ 基于 fs.watch 的实时日志监听
├─ 日志缓冲队列 (防止丢失)
└─ 异步批量处理 (性能优化)
```

**验收标准**:
- ✅ 支持解析 Cursor IDE 日志
- ✅ 支持解析 Claude App 日志
- ✅ 实时性 < 1秒延迟

#### 阶段2: 主动异常检测 (3-4周)

**任务清单**:
```
[P0] 行为模式库
├─ 基于500组测试数据构建初始模式库
├─ 正常行为模式定义
├─ 异常行为模式定义
└─ 模式匹配算法实现

[P1] 实时检测引擎
├─ 流式行为分析
├─ 滑动窗口检测 (最近10个操作)
└─ 多维度风险评估
```

**验收标准**:
- ✅ 异常行为检出率 > 90%
- ✅ 误报率 < 10%
- ✅ 响应时间 < 500ms

### 1.4 性能与开销评估

| 指标 | 预估值 | 说明 |
|------|--------|------|
| 内存开销 | +50MB | 行为模式库 + 日志缓冲 |
| CPU开销 | +5% | 实时日志解析 + 行为分析 |
| 磁盘IO | +10MB/s | 日志写入 (峰值) |
| 网络开销 | 0 | 本地处理，无网络传输 |

---

## 二、方向二：行为链路追踪技术方案

### 2.1 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                  行为链路追踪系统                            │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │          链路聚合层 (Chain Aggregator)                 │ │
│  │  ├─ 会话识别 (Session Identification)                 │ │
│  │  ├─ 行为序列构建 (Behavior Sequence Builder)          │ │
│  │  └─ 时间窗口切分 (Time Window Segmentation)           │ │
│  └────────────────────┬───────────────────────────────────┘ │
│                       ▼                                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │         轨迹存储层 (Trajectory Storage)                │ │
│  │  ├─ 行为图谱存储 (Behavior Graph DB)                  │ │
│  │  ├─ 时序索引 (Temporal Index)                         │ │
│  │  └─ 压缩存储 (Compression Storage)                    │ │
│  └────────────────────┬───────────────────────────────────┘ │
│                       ▼                                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │          轨迹分析层 (Trajectory Analyzer)              │ │
│  │  ├─ 轨迹相似度计算 (Trajectory Similarity)            │ │
│  │  ├─ 异常轨迹聚类 (Anomaly Clustering)                 │ │
│  │  ├─ 攻击链路识别 (Attack Chain Detection)             │ │
│  │  └─ 预测模型 (Prediction Model)                       │ │
│  └────────────────────┬───────────────────────────────────┘ │
│                       ▼                                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │          可视化层 (Visualization Layer)                │ │
│  │  ├─ 行为链路图 (Behavior Chain Graph)                 │ │
│  │  ├─ 时序演化图 (Timeline Evolution)                   │ │
│  │  └─ 风险热力图 (Risk Heatmap)                         │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 核心数据结构

#### 2.2.1 行为轨迹 (Behavior Trajectory)

```typescript
interface BehaviorTrajectory {
  trajectoryId: string              // 轨迹唯一ID
  sessionId: string                 // 会话ID
  agentId: string                   // Agent标识
  startTime: number                 // 开始时间
  endTime: number                   // 结束时间
  
  // 行为序列
  behaviors: BehaviorNode[]         // 行为节点列表
  
  // 链路指纹
  chainHash: string                 // 链路哈希 (用于快速匹配)
  parentHash?: string               // 父链路哈希 (用于追溯)
  
  // 风险评估
  riskScore: number                 // 整体风险分数
  riskDistribution: RiskDistribution // 风险分布
  
  // 上下文
  context: TrajectoryContext        // 上下文信息
}

interface BehaviorNode {
  nodeId: string                    // 节点ID
  timestamp: number                 // 时间戳
  action: string                    // 动作类型
  target: string                    // 目标对象
  params: Record<string, any>       // 参数
  result: ActionResult              // 结果
  riskScore: number                 // 单点风险分数
  
  // 关联信息
  prevNodeId?: string               // 前驱节点
  nextNodeId?: string               // 后继节点
  relatedNodes: string[]            // 关联节点
}

interface RiskDistribution {
  low: number                       // 低风险占比
  medium: number                    // 中风险占比
  high: number                      // 高风险占比
  critical: number                  // 严重风险占比
}
```

#### 2.2.2 攻击链路模式

```typescript
interface AttackPattern {
  patternId: string                 // 模式ID
  name: string                      // 模式名称
  description: string               // 描述
  
  // 链路特征
  sequence: BehaviorSequence[]      // 行为序列特征
  constraints: PatternConstraint[]  // 约束条件
  
  // 风险等级
  severity: RiskLevel               // 严重程度
  
  // 检测规则
  detectionRules: DetectionRule[]   // 检测规则
}

// 示例：数据窃取攻击链路
const dataExfiltrationPattern: AttackPattern = {
  patternId: 'data-exfiltration-001',
  name: '数据窃取链路',
  description: '通过多步骤操作窃取敏感数据',
  
  sequence: [
    { action: 'file_read', target: '*password*', context: 'sensitive' },
    { action: 'clipboard_write', target: '*', context: 'any' },
    { action: 'network_upload', target: '*', context: 'external' }
  ],
  
  constraints: [
    { type: 'time_window', value: 60000 },  // 60秒内完成
    { type: 'sequence_order', value: 'strict' }
  ],
  
  severity: 'critical',
  detectionRules: [
    { rule: 'match_sequence', threshold: 0.8 },
    { rule: 'time_constraint', maxDuration: 60000 }
  ]
}
```

### 2.3 关键算法

#### 2.3.1 轨迹相似度计算

```typescript
/**
 * 基于动态时间规整 (DTW) 的轨迹相似度计算
 */
function calculateTrajectorySimilarity(
  trajectory1: BehaviorTrajectory,
  trajectory2: BehaviorTrajectory
): number {
  // 1. 行为序列对齐
  const alignedSequence = alignSequences(
    trajectory1.behaviors,
    trajectory2.behaviors
  )
  
  // 2. 计算行为相似度
  let similarity = 0
  for (let i = 0; i < alignedSequence.length; i++) {
    const behaviorSim = calculateBehaviorSimilarity(
      alignedSequence[i][0],
      alignedSequence[i][1]
    )
    similarity += behaviorSim
  }
  
  // 3. 归一化
  return similarity / alignedSequence.length
}

/**
 * 行为相似度计算
 */
function calculateBehaviorSimilarity(
  behavior1: BehaviorNode,
  behavior2: BehaviorNode
): number {
  // 动作类型相似度
  const actionSim = behavior1.action === behavior2.action ? 1 : 0
  
  // 目标相似度 (编辑距离)
  const targetSim = calculateEditDistance(
    behavior1.target,
    behavior2.target
  )
  
  // 时间间隔相似度
  const timeSim = calculateTimeSimilarity(
    behavior1.timestamp,
    behavior2.timestamp
  )
  
  // 加权平均
  return 0.5 * actionSim + 0.3 * targetSim + 0.2 * timeSim
}
```

#### 2.3.2 攻击链路识别

```typescript
/**
 * 基于模式匹配的攻击链路识别
 */
function detectAttackChain(
  trajectory: BehaviorTrajectory,
  patterns: AttackPattern[]
): AttackDetectionResult[] {
  const results: AttackDetectionResult[] = []
  
  for (const pattern of patterns) {
    // 1. 快速哈希匹配
    if (trajectory.chainHash === pattern.signatureHash) {
      results.push({
        pattern: pattern,
        confidence: 1.0,
        matchedNodes: trajectory.behaviors
      })
      continue
    }
    
    // 2. 序列匹配
    const sequenceMatch = matchBehaviorSequence(
      trajectory.behaviors,
      pattern.sequence
    )
    
    // 3. 约束检查
    const constraintMatch = checkConstraints(
      trajectory,
      pattern.constraints
    )
    
    // 4. 综合判断
    if (sequenceMatch.score > 0.8 && constraintMatch.passed) {
      results.push({
        pattern: pattern,
        confidence: sequenceMatch.score,
        matchedNodes: sequenceMatch.matchedNodes
      })
    }
  }
  
  return results
}
```

### 2.4 存储方案

#### 2.4.1 行为图谱存储

**技术选型**: LevelDB + 自定义索引

**存储结构**:
```
行为节点存储:
  key: behavior:{nodeId}
  value: BehaviorNode (JSON)

轨迹存储:
  key: trajectory:{trajectoryId}
  value: BehaviorTrajectory (JSON)

时序索引:
  key: timeline:{timestamp}:{trajectoryId}
  value: {trajectoryId}

哈希索引:
  key: hash:{chainHash}
  value: {trajectoryId}
```

**查询性能**:
- 单节点查询: < 1ms
- 轨迹查询: < 10ms
- 时间范围查询: < 50ms (1000条记录)
- 哈希匹配: < 5ms

### 2.5 可视化方案

#### 2.5.1 技术栈

- **图表库**: D3.js (自定义可视化)
- **流程图**: React Flow (行为链路图)
- **时序图**: vis-timeline (时间线)
- **热力图**: ECharts (风险分布)

#### 2.5.2 可视化组件

```typescript
// 行为链路图组件
interface BehaviorChainGraphProps {
  trajectory: BehaviorTrajectory
  highlightNodes: string[]
  onNodeClick: (node: BehaviorNode) => void
}

function BehaviorChainGraph({ trajectory, highlightNodes, onNodeClick }) {
  return (
    <ReactFlow
      nodes={convertToFlowNodes(trajectory.behaviors)}
      edges={convertToFlowEdges(trajectory.behaviors)}
      onNodeClick={(event, node) => onNodeClick(node.data)}
      nodeTypes={{
        behavior: BehaviorNodeComponent,
        risk: RiskNodeComponent
      }}
      defaultEdgeOptions={{
        type: 'smoothstep',
        animated: true
      }}
    />
  )
}
```

---

## 三、方向四：轻量自监控系统技术方案

### 3.1 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                  自监控系统架构                              │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │        监控指标采集层 (Metrics Collector)              │ │
│  │  ├─ 准确率监控 (Accuracy Monitor)                     │ │
│  │  ├─ 性能监控 (Performance Monitor)                    │ │
│  │  ├─ 误报监控 (False Positive Monitor)                 │ │
│  │  └─ 权限监控 (Permission Monitor)                     │ │
│  └────────────────────┬───────────────────────────────────┘ │
│                       ▼                                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │          基线管理层 (Baseline Manager)                 │ │
│  │  ├─ 基线建立 (Baseline Building)                      │ │
│  │  ├─ 基线更新 (Baseline Update)                        │ │
│  │  └─ 基线对比 (Baseline Comparison)                    │ │
│  └────────────────────┬───────────────────────────────────┘ │
│                       ▼                                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │          异常检测层 (Anomaly Detector)                 │ │
│  │  ├─ 漂移检测 (Drift Detection)                        │ │
│  │  ├─ 阈值告警 (Threshold Alerting)                     │ │
│  │  └─ 趋势预测 (Trend Prediction)                       │ │
│  └────────────────────┬───────────────────────────────────┘ │
│                       ▼                                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │          告警响应层 (Alert Handler)                    │ │
│  │  ├─ 实时通知 (Real-time Notification)                 │ │
│  │  ├─ 自动修复 (Auto Remediation)                       │ │
│  │  └─ 人工介入 (Manual Intervention)                    │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 核心监控指标

#### 3.2.1 准确率监控

```typescript
interface AccuracyMetrics {
  // 召回率 (真实异常被检出的比例)
  recall: {
    current: number          // 当前值
    baseline: number         // 基线值
    trend: number[]          // 趋势
  }
  
  // 精确率 (检出异常中真实异常的比例)
  precision: {
    current: number
    baseline: number
    trend: number[]
  }
  
  // F1分数
  f1Score: {
    current: number
    baseline: number
    trend: number[]
  }
}

// 计算方式: 每日抽样评估
function calculateAccuracyMetrics(): AccuracyMetrics {
  // 1. 从审计日志中抽样100条记录
  const samples = sampleAuditLogs(100)
  
  // 2. 人工复核或对比已知结果
  const verified = verifySamples(samples)
  
  // 3. 计算指标
  const truePositives = verified.filter(v => v.isAnomaly && v.detected).length
  const falsePositives = verified.filter(v => !v.isAnomaly && v.detected).length
  const falseNegatives = verified.filter(v => v.isAnomaly && !v.detected).length
  
  const recall = truePositives / (truePositives + falseNegatives)
  const precision = truePositives / (truePositives + falsePositives)
  const f1Score = 2 * (precision * recall) / (precision + recall)
  
  return {
    recall: { current: recall, baseline: 0.912, trend: [] },
    precision: { current: precision, baseline: 0.94, trend: [] },
    f1Score: { current: f1Score, baseline: 0.926, trend: [] }
  }
}
```

#### 3.2.2 性能监控

```typescript
interface PerformanceMetrics {
  // 响应时间
  responseTime: {
    mean: number            // 平均响应时间
    p50: number             // 中位数
    p95: number             // 95分位数
    p99: number             // 99分位数
  }
  
  // 吞吐量
  throughput: {
    qps: number             // 每秒查询数
    dailyTotal: number      // 日总量
  }
  
  // 资源占用
  resource: {
    cpu: number             // CPU占用率
    memory: number          // 内存占用
    diskIO: number          // 磁盘IO
  }
}

// 实时监控
function monitorPerformance(): PerformanceMetrics {
  const history = getResponseTimeHistory(1000)
  
  return {
    responseTime: {
      mean: calculateMean(history),
      p50: calculatePercentile(history, 50),
      p95: calculatePercentile(history, 95),
      p99: calculatePercentile(history, 99)
    },
    throughput: {
      qps: calculateQPS(),
      dailyTotal: getDailyTotal()
    },
    resource: {
      cpu: getCpuUsage(),
      memory: getMemoryUsage(),
      diskIO: getDiskIO()
    }
  }
}
```

### 3.3 异常检测算法

#### 3.3.1 漂移检测

```typescript
/**
 * 基于 CUSUM 的漂移检测算法
 */
function detectDrift(
  currentValue: number,
  baseline: number,
  threshold: number = 0.1  // 10% 漂移阈值
): DriftResult {
  // 累积和
  let cusumPos = 0
  let cusumNeg = 0
  
  // 计算偏差
  const deviation = (currentValue - baseline) / baseline
  
  // 更新累积和
  cusumPos = Math.max(0, cusumPos + deviation - threshold)
  cusumNeg = Math.min(0, cusumNeg + deviation + threshold)
  
  // 判断漂移
  if (cusumPos > threshold || cusumNeg < -threshold) {
    return {
      hasDrift: true,
      direction: cusumPos > threshold ? 'increase' : 'decrease',
      magnitude: Math.abs(deviation),
      recommendation: generateRecommendation(deviation)
    }
  }
  
  return { hasDrift: false }
}

// 自动生成建议
function generateRecommendation(deviation: number): string {
  if (deviation > 0.2) {
    return '准确率显著下降，建议检查规则库更新'
  } else if (deviation > 0.1) {
    return '准确率轻微下降，建议复核最近校验结果'
  }
  return '系统运行正常'
}
```

### 3.4 可视化仪表盘

#### 3.4.1 技术方案

- **框架**: React + Ant Design
- **图表**: ECharts
- **实时更新**: WebSocket
- **数据导出**: CSV/JSON

#### 3.4.2 仪表盘组件

```typescript
// 治理健康度仪表盘
function GovernanceHealthDashboard() {
  const [metrics, setMetrics] = useState<HealthMetrics>()
  
  // 实时更新
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3001/metrics')
    ws.onmessage = (event) => {
      setMetrics(JSON.parse(event.data))
    }
    return () => ws.close()
  }, [])
  
  return (
    <div className="dashboard">
      {/* 准确率卡片 */}
      <MetricCard
        title="校验准确率"
        value={metrics?.accuracy.f1Score}
        baseline={0.926}
        trend={metrics?.accuracy.trend}
        status={getMetricStatus(metrics?.accuracy.f1Score, 0.926)}
      />
      
      {/* 性能卡片 */}
      <MetricCard
        title="响应时间 (P95)"
        value={metrics?.performance.responseTime.p95}
        baseline={180}
        unit="ms"
        status={getMetricStatus(metrics?.performance.responseTime.p95, 180, 'lower')}
      />
      
      {/* 误报率卡片 */}
      <MetricCard
        title="误报率"
        value={metrics?.falsePositive.rate}
        baseline={0.06}
        unit="%"
        status={getMetricStatus(metrics?.falsePositive.rate, 0.06, 'lower')}
      />
      
      {/* 趋势图 */}
      <TrendChart
        data={metrics?.history}
        metrics={['accuracy', 'performance', 'falsePositive']}
      />
    </div>
  )
}
```

---

## 四、实施路线图

### 4.1 开发计划 (Gantt图)

```
2026年8月 ────────────────────────────────────────────────
W1  W2  W3  W4  W5  W6  W7  W8  W9  W10 W11 W12
├─────────────┤
│ 日志采集模块 │ ▓▓▓▓▓
└─────────────┘
        ├─────────────┤
        │ 行为链路聚合 │     ▓▓▓▓▓
        └─────────────┘
                ├─────────────┤
                │ 主动监控原型│           ▓▓▓▓▓
                └─────────────┘
                        ├─────┤
                        │自监控│                   ▓▓▓▓
                        └─────┘
```

### 4.2 资源配置

| 功能模块 | 开发人员 | 测试人员 | 预计工时 |
|---------|---------|---------|---------|
| 日志采集 | 1人 | 0.5人 | 2-3周 |
| 链路聚合 | 1人 | 0.5人 | 2-3周 |
| 主动监控 | 1.5人 | 1人 | 3-4周 |
| 自监控 | 0.5人 | 0.5人 | 2周 |

### 4.3 风险与应对

| 风险 | 影响 | 应对策略 |
|------|------|---------|
| 日志格式不统一 | 高 | 制定AHP协议，推动标准化 |
| 性能开销过大 | 中 | 分层检测，异步处理 |
| 误报率上升 | 高 | 定期基线校准，规则优化 |
| 存储空间不足 | 中 | 压缩存储，定期清理 |

---

## 五、技术债务管理

### 5.1 已知技术债务

1. **测试覆盖率** (Sprint 1已解决 ✅)
2. **性能监控** (Sprint 2已解决 ✅)
3. **日志系统** (Sprint 2已解决 ✅)

### 5.2 新增技术债务

1. **行为模式库** - 需要持续积累
2. **攻击链路库** - 需要安全专家维护
3. **AHP协议** - 需要社区推动

---

## 六、总结与建议

### 6.1 推荐实施顺序

1. **优先**: 方向一（主动监控）- 核心价值，用户感知强
2. **次之**: 方向四（自监控）- 开发量小，提升成熟度
3. **并行**: 方向二（链路追踪）- 基于现有能力扩展
4. **长期**: 方向三（治理体系）- 作为愿景呈现

### 6.2 成功标准

- ✅ 异常行为检出率 > 90%
- ✅ 误报率 < 10%
- ✅ 响应时间 < 500ms
- ✅ 用户满意度 > 85%

---

**文档状态**: 最终版  
**下次更新**: 根据实施进展动态调整