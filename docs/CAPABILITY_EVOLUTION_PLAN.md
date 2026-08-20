# 🎯 能力深度演进方案：从被动到主动
## 一鉴到底 AI Agent 安全监控能力升级路线

---

## 📊 现状评估：你已经有了一个强大的基础！

### ✅ 已实现的核心能力

```typescript
// 你的系统已经具备了这些关键能力：
1. ✅ 主动告警系统 (ProactiveAlerter)
   - 实时风险评估
   - 智能告警策略
   - 系统通知集成

2. ✅ 行为风险评分 (BehaviorRiskScorer)
   - 综合风险计算
   - 频率和序列分析
   - 趋势追踪

3. ✅ Agent行为解析 (AgentBehaviorParser)
   - 多数据源解析
   - Agent类型识别
   - 风险分数映射

4. ✅ 污点追踪框架 (TaintTracking)
   - 污点标记
   - 传播追踪
   - 链路图生成

5. ✅ 四层监控部分实现
   - Layer 1: 基础设施监控 ✅
   - Layer 2: MCP监控 ❌
   - Layer 3: 智能体行为监控 ✅
   - Layer 4: 大模型监控 ❌
```

### 🎯 你现在的位置

```
阶段1（当前） ══════════════════════════════>
  ✅ 被动触发校验 + 部分主动监控
  
阶段2（目标） ══════════════════════════════>
  🎯 完整的主动日志监控系统
  
阶段3（未来） ══════════════════════════════>
  🔮 推理轨迹分析 + AI驱动
  
阶段4（愿景） ══════════════════════════════>
  🚀 实时干预 + 执行前拦截
```

---

## 🚀 阶段2实施计划：完整主动日志监控（3-4周）

### Week 1: 污点追踪系统激活

**现状**：你已经有了 `taintTracking.ts` 框架，但需要激活和集成

**任务**：
1. ✅ 完善污点追踪核心逻辑
2. ✅ 集成到文件和剪贴板监控
3. ✅ 实现实时污点检测
4. ✅ 添加可视化链路图

**代码改进建议**：

```typescript
// electron/monitoring/enhancedTaintTracking.ts

/**
 * 增强版污点追踪系统
 * 集成到现有的监控系统中
 */
import { TaintTracker } from './taintTracking'
import { fileMonitor } from './fileMonitor'
import { clipboardMonitor } from './clipboardMonitor'
import { proactiveAlerter } from './proactiveAlerter'

class EnhancedTaintTracker extends TaintTracker {
  private static instance: EnhancedTaintTracker
  
  static getInstance(): EnhancedTaintTracker {
    if (!this.instance) {
      this.instance = new EnhancedTaintTracker()
      this.instance.initialize()
    }
    return this.instance
  }
  
  /**
   * 初始化：集成到现有监控系统
   */
  private initialize(): void {
    // 1. 文件监控集成
    fileMonitor.on('risk-detected', (event) => {
      const taint = this.createTaint(
        event.content,
        event.filePath,
        'sensitive'
      )
      
      this.trackPropagation(
        taint.id,
        event.filePath,
        'file_system',
        'created'
      )
    })
    
    // 2. 剪贴板监控集成
    clipboardMonitor.on('risk-detected', (event) => {
      // 检查是否包含污点数据
      const existingTaint = this.checkTainted(event.content)
      
      if (existingTaint) {
        // 追踪污点传播
        this.trackPropagation(
          existingTaint.id,
          existingTaint.location,
          'clipboard',
          'copy'
        )
        
        // 触发高危告警
        proactiveAlerter.handleAssessment(
          event.behavior,
          {
            overallScore: 90,
            riskLevel: 'critical',
            recommendations: [
              '🚨 敏感数据正在被复制到剪贴板！',
              `来源: ${existingTaint.location}`,
              '建议：立即阻止此操作'
            ],
            shouldAlert: true,
            timestamp: Date.now()
          }
        )
      }
    })
    
    console.log('[EnhancedTaintTracker] 污点追踪系统已激活')
  }
  
  /**
   * 生成实时污点报告
   */
  generateRealtimeReport(): {
    activeTaints: number
    recentPropagations: number
    highRiskFlows: Array<{ from: string; to: string; risk: string }>
  } {
    const activeTaints = this.getActiveTaints()
    const recentPropagations = this.getRecentPropagations(60000)
    const highRiskFlows = this.identifyHighRiskFlows()
    
    return {
      activeTaints: activeTaints.length,
      recentPropagations: recentPropagations.length,
      highRiskFlows
    }
  }
}

// 导出单例
export const enhancedTaintTracker = EnhancedTaintTracker.getInstance()
```

**集成到主进程**：

```typescript
// electron/main.ts (添加)

import { enhancedTaintTracker } from './monitoring/enhancedTaintTracking'

// 在应用启动时初始化
app.whenReady().then(() => {
  // ... 现有初始化代码 ...
  
  // 激活污点追踪
  enhancedTaintTracker.initialize()
  
  console.log('[Main] 污点追踪系统已启动')
})
```

---

### Week 2: MCP层监控实现

**目标**：实现Layer 2监控，监控Agent的工具调用

**设计思路**：
- Hook到MCP协议层
- 监控工具调用、资源访问、权限使用
- 实时风险评估

**核心实现**：

```typescript
// electron/monitoring/mcpMonitor.ts

/**
 * MCP层监控器
 * 监控Agent的工具调用和资源访问
 */
export class MCPMonitor {
  private toolCalls: MCPToolCall[] = []
  private resourceAccesses: MCPResourceAccess[] = []
  private permissionRequests: MCPPermissionRequest[] = []
  
  // 危险工具列表
  private readonly DANGEROUS_TOOLS = [
    'exec', 'eval', 'subprocess', 'system',
    'file_write', 'file_delete', 'network_request',
    'database_query', 'shell_execute'
  ]
  
  /**
   * 启动MCP监控
   */
  start(): void {
    this.hookMCPTools()
    this.hookResourceAccess()
    this.hookPermissionRequests()
    
    console.log('[MCPMonitor] MCP层监控已启动')
  }
  
  /**
   * Hook到MCP工具调用
   */
  private hookMCPTools(): void {
    // 监听所有工具调用
    global.mcpToolHook = (toolName: string, args: any) => {
      const riskLevel = this.assessToolRisk(toolName, args)
      
      const call: MCPToolCall = {
        timestamp: Date.now(),
        tool: toolName,
        args: this.sanitizeArgs(args),
        riskLevel,
        shouldBlock: riskLevel === 'critical'
      }
      
      this.toolCalls.push(call)
      this.analyzeToolCallPattern()
      
      // 如果是高风险工具，立即拦截
      if (call.shouldBlock) {
        this.blockToolCall(call)
        return false // 阻止执行
      }
      
      return true // 允许执行
    }
  }
  
  /**
   * 评估工具调用风险
   */
  private assessToolRisk(toolName: string, args: any): 'low' | 'medium' | 'high' | 'critical' {
    // 1. 检查是否是危险工具
    if (this.DANGEROUS_TOOLS.includes(toolName)) {
      return 'critical'
    }
    
    // 2. 检查参数中的敏感信息
    const argsStr = JSON.stringify(args)
    if (this.containsSensitiveData(argsStr)) {
      return 'high'
    }
    
    // 3. 检查文件路径
    if (args.file_path || args.path) {
      if (this.isSensitivePath(args.file_path || args.path)) {
        return 'high'
      }
    }
    
    return 'low'
  }
  
  /**
   * 分析工具调用模式
   */
  private analyzeToolCallPattern(): void {
    // 最近10次调用
    const recentCalls = this.toolCalls.slice(-10)
    
    // 检测连续危险操作
    const dangerousCount = recentCalls.filter(
      c => c.riskLevel === 'high' || c.riskLevel === 'critical'
    ).length
    
    if (dangerousCount >= 3) {
      this.alertSuspiciousPattern(recentCalls)
    }
  }
  
  /**
   * 获取监控状态
   */
  getState(): MCPMonitorState {
    return {
      totalToolCalls: this.toolCalls.length,
      dangerousToolCalls: this.toolCalls.filter(
        c => c.riskLevel === 'high' || c.riskLevel === 'critical'
      ).length,
      recentToolCalls: this.toolCalls.slice(-20),
      riskDistribution: this.calculateRiskDistribution()
    }
  }
}

// 在主进程启动
// electron/main.ts
import { MCPMonitor } from './monitoring/mcpMonitor'

const mcpMonitor = new MCPMonitor()
app.whenReady().then(() => {
  mcpMonitor.start()
})
```

---

### Week 3: 大模型输出监控

**目标**：实现Layer 4监控，检测LLM输出中的风险

**核心能力**：
- 幻觉检测
- 提示注入检测
- 敏感信息泄露检测

```typescript
// electron/monitoring/llmOutputMonitor.ts

/**
 * 大模型输出监控器
 */
export class LLMOutputMonitor {
  private outputs: LLMOutput[] = []
  private readonly MAX_OUTPUTS = 100
  
  /**
   * 监控LLM输出
   */
  monitorOutput(content: string, context: any): LLMOutput {
    const output: LLMOutput = {
      timestamp: Date.now(),
      content: content.substring(0, 1000), // 只保留前1000字符
      context,
      flags: [],
      riskLevel: 'low'
    }
    
    // 1. 幻觉检测
    if (this.detectHallucination(content, context)) {
      output.flags.push('hallucination')
      output.riskLevel = 'medium'
    }
    
    // 2. 提示注入检测
    if (this.detectPromptInjection(content)) {
      output.flags.push('prompt_injection')
      output.riskLevel = 'high'
    }
    
    // 3. 敏感信息检测
    if (this.detectSensitiveInfo(content)) {
      output.flags.push('sensitive_info')
      output.riskLevel = 'high'
    }
    
    this.outputs.push(output)
    
    // 保持最近100条
    if (this.outputs.length > this.MAX_OUTPUTS) {
      this.outputs.shift()
    }
    
    // 触发告警
    if (output.riskLevel === 'high') {
      this.alertHighRiskOutput(output)
    }
    
    return output
  }
  
  /**
   * 幻觉检测
   */
  private detectHallucination(content: string, context: any): boolean {
    // 检测幻觉模式
    const hallucinationPatterns = [
      /我(确定|肯定|保证)/,
      /百分之百/,
      /绝对/,
      /一定/
    ]
    
    return hallucinationPatterns.some(p => p.test(content))
  }
  
  /**
   * 提示注入检测
   */
  private detectPromptInjection(content: string): boolean {
    const injectionPatterns = [
      /ignore previous instructions/i,
      /disregard all above/i,
      /forget everything/i,
      /system: /i,
      /\[INST\]/i
    ]
    
    return injectionPatterns.some(p => p.test(content))
  }
  
  /**
   * 敏感信息检测
   */
  private detectSensitiveInfo(content: string): boolean {
    // 使用现有的安全知识库
    const risks = detectSecurityRisks(content, securityKnowledgeBase)
    return risks.length > 0
  }
}
```

---

### Week 4: 跨层关联分析

**目标**：实现四层监控的关联分析

```typescript
// electron/monitoring/crossLayerAnalyzer.ts

/**
 * 跨层关联分析器
 */
export class CrossLayerAnalyzer {
  /**
   * 分析跨层攻击模式
   */
  analyzeCrossLayerPatterns(): CrossLayerAlert[] {
    const alerts: CrossLayerAlert[] = []
    
    // 获取各层状态
    const layer1 = infrastructureMonitor.getState()
    const layer2 = mcpMonitor.getState()
    const layer3 = behaviorRiskScorer.getRecentBehaviors()
    const layer4 = llmOutputMonitor.getState()
    
    // 模式1: 挖矿行为检测
    if (layer1.cpuUsage > 80 && 
        layer3.filter(b => b.action === 'file_operation').length > 50) {
      alerts.push({
        type: 'mining_behavior',
        severity: 'critical',
        layers: [1, 3],
        description: '检测到可能的挖矿行为：CPU异常+大量文件操作'
      })
    }
    
    // 模式2: 数据泄露检测
    if (layer2.dangerousToolCalls > 0 &&
        layer4.containsSensitiveInfo) {
      alerts.push({
        type: 'data_exfiltration',
        severity: 'high',
        layers: [2, 4],
        description: '检测到可能的数据泄露：危险工具调用+敏感输出'
      })
    }
    
    // 模式3: 提示注入攻击
    if (layer4.promptInjectionDetected &&
        layer3.some(b => b.riskScore > 80)) {
      alerts.push({
        type: 'prompt_injection_attack',
        severity: 'critical',
        layers: [3, 4],
        description: '检测到提示注入攻击：高风险行为+注入检测'
      })
    }
    
    return alerts
  }
}
```

---

## 🎯 实施检查清单

### Week 1: 污点追踪
- [ ] 完善污点追踪核心逻辑
- [ ] 集成到文件监控
- [ ] 集成到剪贴板监控
- [ ] 实现实时污点报告
- [ ] 添加链路图可视化

### Week 2: MCP监控
- [ ] 实现工具调用Hook
- [ ] 实现风险评估逻辑
- [ ] 实现危险工具拦截
- [ ] 实现调用模式分析

### Week 3: LLM监控
- [ ] 实现输出监控
- [ ] 实现幻觉检测
- [ ] 实现提示注入检测
- [ ] 实现敏感信息检测

### Week 4: 跨层分析
- [ ] 实现跨层关联分析
- [ ] 实现攻击模式检测
- [ ] 实现跨层告警
- [ ] 集成到Dashboard

---

## 📊 预期效果

**技术指标**：

| 指标 | 当前 | Week 4后 | 提升 |
|------|------|----------|------|
| 监控覆盖层 | 2层 | 4层 | +100% |
| 主动监控能力 | 30% | 80% | +150% |
| 干预能力 | 后告警 | 执行中拦截 | 质变 |
| 数据流追踪 | 无 | 完整链路 | 新增 |

**安全能力提升**：
- ✅ 从单点检测到全链路追踪
- ✅ 从被动响应到主动预防
- ✅ 从事后审计到事中干预
- ✅ 从单一维度到多维度关联

---

**你的系统已经有了很好的基础，只需要按照这个计划逐步完善！** 🎯