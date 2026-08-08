# 主动监控系统升级方案
## 基于 SecureAgentics、AgentStalker、A.I.G 框架的深度整合

---

## 一、参考框架核心思想分析

### 1. SecureAgentics (Adrian开源项目)
**核心思想**: 实时分析Agent活动日志和推理轨迹

**关键特性**:
- ✅ **实时监控**: 在Agent执行过程中实时捕获日志
- ✅ **推理轨迹追踪**: 记录Agent的推理过程，而不仅仅是最终行为
- ✅ **执行前干预**: 在恶意行为执行前主动拦截
- ✅ **行为模式库**: 建立恶意行为模式库用于匹配

**技术架构**:
```
Agent执行层
    ↓ 实时日志流
日志采集层（轻量级探针）
    ↓ 结构化日志
行为分析层（规则引擎 + ML模型）
    ↓ 异常判断
干预层（拦截/放行/告警）
```

---

### 2. AgentStalker 框架
**核心思想**: 将Agent系统抽象为审计对象，通过污点流图追踪行为链路

**关键特性**:
- ✅ **污点分析**: 标记敏感数据，追踪其流向
- ✅ **行为链路图**: 构建Agent行为的完整链路图
- ✅ **抽象审计**: 将Agent视为黑盒，通过输入输出推断意图
- ✅ **链路追踪**: 从初始输入到最终输出的完整追踪

**技术架构**:
```
输入数据（污点标记）
    ↓ 追踪传播
Agent内部处理（黑盒）
    ↓ 行为链路图
输出数据（污点验证）
    ↓ 异常检测
行为链路分析（图算法）
```

---

### 3. A.I.G 框架（腾讯朱雀实验室）
**核心思想**: 四层全链路自动化红队框架

**关键特性**:
- ✅ **基础设施层**: 监控CPU/内存/网络等底层资源
- ✅ **MCP层**: 监控模型上下文协议的调用
- ✅ **智能体行为层**: 监控Agent的具体行为
- ✅ **大模型层**: 监控大模型的输出和幻觉

**技术架构**:
```
Layer 1: 基础设施监控
├─ CPU使用异常
├─ 内存泄漏
└─ 网络连接异常

Layer 2: MCP监控
├─ 工具调用监控
├─ 资源访问监控
└─ 权限使用监控

Layer 3: 智能体行为监控
├─ 操作序列监控
├─ 目标偏离检测
└─ 异常行为模式

Layer 4: 大模型监控
├─ 输出内容审核
├─ 幻觉检测
└─ 提示注入检测
```

---

## 二、框架对比与融合

### 三种框架的优势

| 框架 | 优势 | 适用场景 |
|------|------|---------|
| **SecureAgentics** | 实时性强，执行前干预 | 实时安全防护 |
| **AgentStalker** | 数据流追踪，链路完整 | 数据泄露检测 |
| **A.I.G** | 全链路覆盖，层次清晰 | 企业级安全治理 |

### 融合方案：四层三阶段主动监控体系

```
┌─────────────────────────────────────────┐
│           四层监控体系                     │
├─────────────────────────────────────────┤
│ Layer 4: 大模型层                         │
│   └─ 输出审核、幻觉检测、提示注入检测       │
├─────────────────────────────────────────┤
│ Layer 3: 智能体行为层                     │
│   └─ 操作序列、目标偏离、异常模式（当前实现）│
├─────────────────────────────────────────┤
│ Layer 2: MCP层                           │
│   └─ 工具调用、资源访问、权限使用          │
├─────────────────────────────────────────┤
│ Layer 1: 基础设施层                       │
│   └─ CPU、内存、网络（Sprint 2实现）      │
└─────────────────────────────────────────┘

         ↓ 数据流

┌─────────────────────────────────────────┐
│           三阶段处理流程                   │
├─────────────────────────────────────────┤
│ Stage 1: 实时采集（SecureAgentics）      │
│   └─ 轻量级探针、实时日志流               │
├─────────────────────────────────────────┤
│ Stage 2: 链路分析（AgentStalker）        │
│   └─ 污点追踪、行为链路图构建             │
├─────────────────────────────────────────┤
│ Stage 3: 主动干预（A.I.G）               │
│   └─ 分层告警、自动拦截、策略执行         │
└─────────────────────────────────────────┘
```

---

## 三、升级方案：从 MVP 到完整实现

### 当前 MVP 实现回顾

**已实现**:
- ✅ Layer 1: 基础设施监控（内存、CPU）
- ✅ Layer 3: 部分智能体行为监控（文件、剪贴板、进程、网络）
- ✅ Stage 1: 实时采集（日志系统）
- ✅ Stage 3: 基础主动干预（告警、状态更新）

**缺失**:
- ❌ Layer 2: MCP层监控
- ❌ Layer 4: 大模型层监控
- ❌ Stage 2: 链路分析（污点追踪、行为链路图）
- ❌ 执行前干预能力

---

## 四、深度技术实现方案

### 1. 污点追踪系统（AgentStalker核心）

**目标**: 标记敏感数据，追踪其在Agent系统中的流向

**实现方案**:

```typescript
// electron/monitoring/taintTracking.ts

/**
 * 污点标记
 */
interface TaintMark {
  id: string              // 污点唯一ID
  source: string          // 污点来源（文件、剪贴板等）
  type: 'sensitive' | 'secret' | 'pii' | 'credential'
  contentHash: string     // 内容哈希
  location: string        // 原始位置
  timestamp: number       // 创建时间
}

/**
 * 污点传播记录
 */
interface TaintPropagation {
  taintId: string
  fromLocation: string    // 来源位置
  toLocation: string      // 目标位置
  operation: string       // 操作类型（复制、修改、传输等）
  timestamp: number
}

/**
 * 污点追踪器
 */
class TaintTracker {
  private taints: Map<string, TaintMark> = new Map()
  private propagations: TaintPropagation[] = []
  
  /**
   * 创建污点标记
   */
  createTaint(
    content: string,
    source: string,
    type: TaintMark['type']
  ): TaintMark {
    const taint: TaintMark = {
      id: this.generateTaintId(),
      source,
      type,
      contentHash: this.hashContent(content),
      location: source,
      timestamp: Date.now()
    }
    
    this.taints.set(taint.id, taint)
    this.logTaintCreation(taint)
    
    return taint
  }
  
  /**
   * 追踪污点传播
   */
  trackPropagation(
    taintId: string,
    fromLocation: string,
    toLocation: string,
    operation: string
  ): void {
    const propagation: TaintPropagation = {
      taintId,
      fromLocation,
      toLocation,
      operation,
      timestamp: Date.now()
    }
    
    this.propagations.push(propagation)
    this.analyzePropagationRisk(propagation)
  }
  
  /**
   * 检查内容是否被污点标记
   */
  checkTainted(content: string): TaintMark | null {
    const hash = this.hashContent(content)
    
    for (const taint of this.taints.values()) {
      if (taint.contentHash === hash) {
        return taint
      }
    }
    
    return null
  }
  
  /**
   * 生成污点链路图
   */
  generateTaintFlowGraph(taintId: string): {
    nodes: Array<{ id: string; label: string }>
    edges: Array<{ from: string; to: string; label: string }>
  } {
    const nodes: Array<{ id: string; label: string }> = []
    const edges: Array<{ from: string; to: string; label: string }> = []
    
    // 添加起始节点
    const taint = this.taints.get(taintId)
    if (taint) {
      nodes.push({
        id: taint.location,
        label: `Source: ${taint.location}`
      })
    }
    
    // 添加传播节点和边
    const relatedPropagations = this.propagations.filter(p => p.taintId === taintId)
    relatedPropagations.forEach(prop => {
      nodes.push({ id: prop.toLocation, label: prop.toLocation })
      edges.push({
        from: prop.fromLocation,
        to: prop.toLocation,
        label: prop.operation
      })
    })
    
    return { nodes, edges }
  }
}
```

**使用场景**:
```typescript
// 1. 检测到敏感文件时创建污点
const taint = taintTracker.createTaint(
  fileContent,
  filePath,
  'secret'
)

// 2. 追踪污点传播（例如：复制到剪贴板）
taintTracker.trackPropagation(
  taint.id,
  filePath,
  'clipboard',
  'copy'
)

// 3. 检测剪贴板是否包含污点数据
const clipboardTaint = taintTracker.checkTainted(clipboardContent)
if (clipboardTaint) {
  // 触发告警：敏感数据正在被复制
  alerter.alert({
    level: 'high',
    message: '敏感数据正在被复制到剪贴板',
    taint: clipboardTaint
  })
}
```

---

### 2. Agent活动日志标准化协议（SecureAgentics核心）

**目标**: 定义统一的Agent活动日志格式，支持不同Agent框架

**协议设计**:

```typescript
// electron/monitoring/agentActivityProtocol.ts

/**
 * Agent活动日志（AHP - Agent Harness Protocol）
 */
interface AgentActivityLog {
  // 基础信息
  id: string
  timestamp: number
  agent_id: string
  agent_type: 'cursor' | 'claude' | 'copilot' | 'custom'
  
  // 活动类型
  activity_type: 'tool_call' | 'file_op' | 'network' | 'reasoning' | 'output'
  
  // 活动详情
  activity: {
    // 工具调用
    tool_name?: string
    tool_args?: Record<string, any>
    tool_result?: any
    
    // 文件操作
    file_path?: string
    file_operation?: 'read' | 'write' | 'delete' | 'execute'
    file_size?: number
    
    // 网络请求
    url?: string
    method?: string
    request_body?: string
    
    // 推理过程
    reasoning_step?: string
    reasoning_content?: string
    
    // 输出
    output_type?: 'text' | 'code' | 'file'
    output_content?: string
  }
  
  // 安全评估（实时）
  security: {
    risk_level: 'low' | 'medium' | 'high' | 'critical'
    risk_factors: string[]
    intervention_needed: boolean
    intervention_type?: 'block' | 'warn' | 'log' | 'approve'
  }
  
  // 上下文信息
  context: {
    session_id: string
    parent_activity_id?: string
    user_intent?: string
    agent_goal?: string
  }
}

/**
 * Agent活动日志采集器
 */
class AgentActivityCollector {
  private hooks: Map<string, Function> = new Map()
  
  /**
   * 注册Agent活动Hook
   */
  registerHook(agentType: string, hookFn: Function): void {
    this.hooks.set(agentType, hookFn)
  }
  
  /**
   * 采集活动日志
   */
  collectActivity(log: AgentActivityLog): void {
    // 1. 验证日志格式
    if (!this.validateLog(log)) {
      console.error('Invalid activity log format:', log)
      return
    }
    
    // 2. 实时安全评估
    const assessment = this.assessActivity(log)
    log.security = assessment
    
    // 3. 记录日志
    this.logActivity(log)
    
    // 4. 触发干预（如果需要）
    if (assessment.intervention_needed) {
      this.triggerIntervention(log, assessment)
    }
  }
  
  /**
   * 实时安全评估
   */
  private assessActivity(log: AgentActivityLog): AgentActivityLog['security'] {
    const riskFactors: string[] = []
    let riskLevel: AgentActivityLog['security']['risk_level'] = 'low'
    let interventionNeeded = false
    let interventionType: AgentActivityLog['security']['intervention_type'] = 'log'
    
    // 检查工具调用风险
    if (log.activity_type === 'tool_call') {
      const dangerousTools = ['exec', 'eval', 'subprocess', 'system']
      if (dangerousTools.includes(log.activity.tool_name || '')) {
        riskFactors.push('dangerous_tool_call')
        riskLevel = 'high'
        interventionNeeded = true
        interventionType = 'block'
      }
    }
    
    // 检查文件操作风险
    if (log.activity_type === 'file_op') {
      if (log.activity.file_operation === 'execute') {
        riskFactors.push('file_execution')
        riskLevel = 'high'
        interventionNeeded = true
        interventionType = 'approve'
      }
    }
    
    // 检查网络请求风险
    if (log.activity_type === 'network') {
      const suspiciousDomains = ['pastebin.com', 'ngrok.io']
      if (suspiciousDomains.some(d => log.activity.url?.includes(d))) {
        riskFactors.push('suspicious_domain')
        riskLevel = 'medium'
        interventionNeeded = true
        interventionType = 'warn'
      }
    }
    
    return {
      risk_level: riskLevel,
      risk_factors: riskFactors,
      intervention_needed: interventionNeeded,
      intervention_type: interventionType
    }
  }
  
  /**
   * 触发干预
   */
  private triggerIntervention(
    log: AgentActivityLog,
    assessment: AgentActivityLog['security']
  ): void {
    switch (assessment.intervention_type) {
      case 'block':
        // 拦截操作
        this.blockActivity(log)
        break
      
      case 'warn':
        // 发送警告
        this.warnActivity(log)
        break
      
      case 'approve':
        // 请求用户批准
        this.requestApproval(log)
        break
      
      case 'log':
        // 仅记录
        this.logActivity(log)
        break
    }
  }
}
```

---

### 3. 四层监控整合（A.I.G核心）

**目标**: 实现完整的四层监控体系

**架构设计**:

```typescript
// electron/monitoring/layeredMonitoring.ts

/**
 * 四层监控体系
 */
class LayeredMonitoringSystem {
  private layer1: InfrastructureMonitor
  private layer2: MCPMonitor
  private layer3: AgentBehaviorMonitor
  private layer4: LLMOutputMonitor
  
  constructor() {
    this.layer1 = new InfrastructureMonitor()
    this.layer2 = new MCPMonitor()
    this.layer3 = new AgentBehaviorMonitor()
    this.layer4 = new LLMOutputMonitor()
  }
  
  /**
   * 启动所有层级的监控
   */
  startAll(): void {
    this.layer1.start()
    this.layer2.start()
    this.layer3.start()
    this.layer4.start()
    
    // 跨层关联分析
    this.startCrossLayerAnalysis()
  }
  
  /**
   * 跨层关联分析
   */
  private startCrossLayerAnalysis(): void {
    // 示例：检测跨层攻击模式
    // Layer 1: CPU异常升高 + Layer 3: 大量文件操作 = 可能的挖矿行为
    // Layer 2: MCP工具调用 + Layer 4: 输出包含敏感信息 = 可能的数据泄露
    
    setInterval(() => {
      this.analyzeCrossLayerPatterns()
    }, 5000)
  }
  
  /**
   * 分析跨层模式
   */
  private analyzeCrossLayerPatterns(): void {
    const layer1State = this.layer1.getState()
    const layer2State = this.layer2.getState()
    const layer3State = this.layer3.getState()
    const layer4State = this.layer4.getState()
    
    // 模式1: 挖矿行为检测
    if (layer1State.cpuUsage > 80 && 
        layer3State.fileOpsCount > 100) {
      this.alertPotentialMining()
    }
    
    // 模式2: 数据泄露检测
    if (layer2State.toolCalls.includes('file_read') &&
        layer4State.containsSensitiveInfo) {
      this.alertPotentialDataExfiltration()
    }
    
    // 模式3: 提示注入攻击
    if (layer4State.promptInjectionDetected &&
        layer3State.unauthorizedAccess) {
      this.alertPromptInjectionAttack()
    }
  }
}

/**
 * Layer 2: MCP监控器
 */
class MCPMonitor {
  private toolCalls: Array<{
    tool: string
    args: any
    result: any
    timestamp: number
  }> = []
  
  start(): void {
    // 监听MCP工具调用
    this.hookMCPTools()
  }
  
  private hookMCPTools(): void {
    // Hook到MCP协议层
    // 监控工具调用、资源访问、权限使用
  }
  
  getState(): { toolCalls: string[] } {
    return {
      toolCalls: this.toolCalls.map(c => c.tool)
    }
  }
}

/**
 * Layer 4: 大模型输出监控器
 */
class LLMOutputMonitor {
  private outputs: Array<{
    content: string
    type: string
    timestamp: number
    flags: string[]
  }> = []
  
  start(): void {
    // 监听LLM输出
    this.hookLLMOutputs()
  }
  
  private hookLLMOutputs(): void {
    // Hook到LLM输出层
    // 检测幻觉、提示注入、敏感信息泄露
  }
  
  getState(): { containsSensitiveInfo: boolean; promptInjectionDetected: boolean } {
    return {
      containsSensitiveInfo: this.outputs.some(o => o.flags.includes('sensitive')),
      promptInjectionDetected: this.outputs.some(o => o.flags.includes('prompt_injection'))
    }
  }
}
```

---

## 五、实施路线图

### 阶段1: 污点追踪系统（2-3周）

**目标**: 实现数据流追踪能力

**任务**:
1. ✅ 设计污点标记和传播机制
2. ✅ 实现污点追踪器核心逻辑
3. ✅ 集成到文件和剪贴板监控
4. ✅ 实现污点链路图可视化

**验收标准**:
- 能够标记敏感数据
- 能够追踪数据在不同组件间的流动
- 能够生成完整的数据流图

---

### 阶段2: Agent活动日志协议（2-3周）

**目标**: 建立统一的日志采集标准

**任务**:
1. ✅ 定义AHP协议规范
2. ✅ 实现日志采集器
3. ✅ 实现实时安全评估
4. ✅ 集成到现有Agent监控

**验收标准**:
- 支持标准化的日志格式
- 能够实时评估活动风险
- 能够触发干预机制

---

### 阶段3: 四层监控整合（3-4周）

**目标**: 实现完整的四层监控体系

**任务**:
1. ✅ 实现Layer 2 MCP监控
2. ✅ 实现Layer 4 LLM输出监控
3. ✅ 实现跨层关联分析
4. ✅ 实现跨层攻击模式检测

**验收标准**:
- 四层监控全部工作
- 能够检测跨层攻击模式
- 能够关联分析不同层的异常

---

### 阶段4: 执行前干预能力（2-3周）

**目标**: 实现真正的主动拦截

**任务**:
1. ✅ 实现操作拦截机制
2. ✅ 实现用户批准流程
3. ✅ 实现策略执行引擎
4. ✅ 实现干预日志和审计

**验收标准**:
- 能够在执行前拦截高风险操作
- 能够请求用户批准敏感操作
- 所有干预行为都有审计记录

---

## 六、技术难点与应对

### 难点1: Agent异构性
**问题**: 不同Agent框架的日志格式不统一

**应对**:
- 采用AHP协议适配层
- 为每个Agent框架开发专用Hook
- 提供SDK简化集成

---

### 难点2: 实时性要求
**问题**: 实时监控可能影响Agent性能

**应对**:
- 采用轻量级探针
- 异步日志处理
- 分级评估策略（快速预检 + 深度分析）

---

### 难点3: 误报率控制
**问题**: 过多误报会干扰用户工作

**应对**:
- 机器学习模型优化
- 用户反馈机制
- 可配置的风险阈值

---

## 七、预期效果

### 技术指标

| 指标 | MVP版本 | 完整版本 | 提升 |
|------|---------|---------|------|
| 检测覆盖层 | 2层 | 4层 | +100% |
| 干预能力 | 后告警 | 执行前拦截 | 质变 |
| 数据流追踪 | 无 | 完整链路 | 新增 |
| 跨层分析 | 无 | 支持 | 新增 |

### 安全能力提升

- ✅ 从被动响应到主动预防
- ✅ 从单点检测到全链路追踪
- ✅ 从事后审计到事前干预
- ✅ 从单一维度到多维度关联

---

**升级方案已完成，可以按阶段实施！** 🎯