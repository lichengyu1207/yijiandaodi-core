# 🚀 核心库进阶改进指南

## ✅ 已完成的改进

### 1. 可配置的安全知识库

**功能概述**：
- ✅ 支持自定义检测规则
- ✅ 支持从文件加载规则
- ✅ 支持从 URL 加载规则
- ✅ 支持自定义规则添加

**代码位置**：`src/security-knowledge-base.ts`

**使用方法**：

```typescript
import { SecurityKnowledgeBase } from '@lichengyu1207/yijiandaodi-security-core';

// 创建可配置的知识库
const knowledgeBase = new SecurityKnowledgeBase({
  // 自定义 API Key 模式
  apiKeys: ['custom-key-', 'my-api-'],
  
  // 自定义敏感关键词
  sensitive: ['内部文档', '机密', 'confidential'],
  
  // 从文件加载 SQL 注入规则
  loadFromFile: {
    sqli: '/path/to/sqli-rules.txt'
  },
  
  // 添加自定义规则
  custom: [
    {
      name: '身份证号检测',
      patterns: ['\\d{17}[0-9X]', '\\d{15}'],
      risk_level: 'high',
      description: '检测到身份证号码'
    }
  ]
});

// 检测内容
const risks = knowledgeBase.detect('敏感内容: password=admin');
console.log(risks);

// 获取统计信息
const stats = knowledgeBase.getStats();
console.log('规则统计:', stats);

// 添加新的自定义规则
knowledgeBase.addCustomRule({
  name: '银行卡号检测',
  patterns: ['\\d{16}', '\\d{19}'],
  risk_level: 'high',
  description: '检测到银行卡号'
});

// 导出规则（用于备份）
const exportedRules = knowledgeBase.exportRules();
console.log('导出的规则:', exportedRules);
```

---

### 2. 行为模式检测框架（AI 驱动）

**功能概述**：
- ✅ 行为历史记录
- ✅ 规则匹配模式检测
- ✅ 风险评分
- ✅ AI 模型接口预留

**代码位置**：`src/detectors/behavior-pattern-detector.ts`

**使用方法**：

```typescript
import { BehaviorPatternDetector } from '@lichengyu1207/yijiandaodi-security-core';

const detector = new BehaviorPatternDetector();

// 分析行为
const result = detector.analyzeBehavior({
  userId: 'user-123',
  sessionId: 'session-456',
  operationType: 'clipboard',
  timestamp: new Date().toISOString(),
  content: '复制的内容',
  sourceApp: 'Cursor'
});

console.log('分析结果:', result);

// 查看历史
const history = detector.getHistory();
console.log('行为历史:', history);

// 导出数据（用于分析）
const data = detector.exportBehaviorData();
console.log('行为数据:', data);
```

**预留的 AI 接口**：

```typescript
// AI 分析（预留，待集成模型）
const aiResult = await detector.analyzeWithAI(context);

// 训练自定义模型（预留）
await detector.trainModel(trainingData);
```

---

### 3. 增强的类型定义

**新增类型**：

```typescript
// 安全知识库配置
export interface SecurityKnowledgeBaseConfig {
  sqli?: string[];
  xss?: string[];
  passwords?: string[];
  apiKeys?: string[];
  sensitive?: string[];
  custom?: CustomRule[];
  loadFromFile?: {...};
  loadFromUrl?: {...};
}

// 自定义规则
export interface CustomRule {
  name: string;
  patterns: string[];
  risk_level: 'low' | 'medium' | 'high';
  description?: string;
}

// 行为上下文
export interface BehaviorContext {
  userId?: string;
  sessionId?: string;
  operationType: 'file' | 'clipboard' | 'network' | 'api' | 'custom';
  timestamp: string;
  content?: string;
  sourceApp?: string;
  metadata?: { [key: string]: any };
}

// 行为模式
export interface BehaviorPattern {
  id: string;
  name: string;
  riskLevel: 'low' | 'medium' | 'high';
  confidence: number;
  description: string;
  triggers: string[];
  recommendation?: string;
}
```

---

## 📊 使用场景示例

### 场景1：企业安全合规

```typescript
import { SecurityKnowledgeBase } from '@lichengyu1207/yijiandaodi-security-core';

// 创建企业级知识库
const enterpriseKB = new SecurityKnowledgeBase({
  // 添加企业特定关键词
  sensitive: [
    '商业秘密', '内部资料', '机密文件',
    '财务报表', '客户名单', '技术文档'
  ],
  
  // 添加企业 API Key 模式
  apiKeys: [
    'COMPANY-', 'ENTERPRISE-', 'INTERNAL-'
  ],
  
  // 从企业知识库加载
  loadFromFile: {
    sqli: '/etc/security/sqli-rules.txt',
    xss: '/etc/security/xss-rules.txt',
    passwords: '/etc/security/common-passwords.txt'
  },
  
  // 自定义规则
  custom: [
    {
      name: '员工编号检测',
      patterns: ['EMP\\d{6}', '员工编号:\\d+'],
      risk_level: 'medium',
      description: '检测到员工编号'
    },
    {
      name: '项目代码检测',
      patterns: ['PRJ-[A-Z]{3}-\\d{4}'],
      risk_level: 'low',
      description: '检测到项目代码'
    }
  ]
});
```

### 场景2：AI Agent 行为监控

```typescript
import { BehaviorPatternDetector } from '@lichengyu1207/yijiandaodi-security-core';

const detector = new BehaviorPatternDetector();

// 监控 AI Agent 操作
const operations = [
  { type: 'clipboard', app: 'ChatGPT' },
  { type: 'file', app: 'Cursor' },
  { type: 'api', app: 'OpenAI' }
];

operations.forEach(op => {
  const result = detector.analyzeBehavior({
    operationType: op.type,
    timestamp: new Date().toISOString(),
    sourceApp: op.app
  });
  
  if (result.isAnomaly) {
    console.log('⚠️ 检测到异常行为:', result.patterns);
  }
});
```

### 场景3：实时审计

```typescript
import { SecurityKnowledgeBase, BehaviorPatternDetector } from '@lichengyu1207/yijiandaodi-security-core';

const kb = new SecurityKnowledgeBase();
const behaviorDetector = new BehaviorPatternDetector();

// 实时监控函数
function auditOperation(content: string, context: any) {
  // 1. 内容检测
  const contentRisks = kb.detect(content);
  
  // 2. 行为分析
  const behaviorResult = behaviorDetector.analyzeBehavior({
    operationType: context.type,
    timestamp: new Date().toISOString(),
    sourceApp: context.app
  });
  
  // 3. 综合评估
  const riskScore = contentRisks.length * 20 + behaviorResult.riskScore;
  
  return {
    contentRisks,
    behaviorPatterns: behaviorResult.patterns,
    riskScore,
    shouldBlock: riskScore > 60
  };
}

// 使用示例
const audit = auditOperation('sk-proj-abc123', { type: 'clipboard', app: 'Cursor' });
console.log(audit);
```

---

## 🔮 后续演进方向

### 短期（1-2周）

1. **完善测试覆盖**
   - 添加 SecurityKnowledgeBase 单元测试
   - 添加 BehaviorPatternDetector 单元测试
   - 测试覆盖率目标：80%

2. **性能优化**
   - 规则匹配算法优化
   - 历史记录管理优化
   - 内存使用优化

### 中期（1-2个月）

3. **AI 模型集成**
   - OpenAI GPT-4 集成
   - Anthropic Claude 集成
   - 本地 ML 模型支持

4. **分布式部署**
   - 规则同步服务
   - 集中式知识库管理
   - 协作式行为分析

### 长期（3-6个月）

5. **区块链存证**
   - 以太坊集成
   - IPFS 存储
   - 智能合约验证

6. **企业级功能**
   - 权限管理
   - 审计报告
   - 合规性检查

---

## 📝 API 参考文档

### SecurityKnowledgeBase

```typescript
class SecurityKnowledgeBase {
  constructor(config?: SecurityKnowledgeBaseConfig)
  
  detect(content: string): RiskResult[]
  addCustomRule(rule: CustomRule): void
  getStats(): { [key: string]: number }
  exportRules(): SecurityKnowledgeBaseConfig
  reset(): void
}
```

### BehaviorPatternDetector

```typescript
class BehaviorPatternDetector {
  analyzeBehavior(context: BehaviorContext): BehaviorAnalysisResult
  getHistory(): BehaviorContext[]
  clearHistory(): void
  exportBehaviorData(): string
  
  // AI 接口（预留）
  async analyzeWithAI(context: BehaviorContext): Promise<BehaviorAnalysisResult>
  async trainModel(trainingData: BehaviorContext[]): Promise<void>
}
```

---

## 🎯 总结

**已完成的核心改进**：

1. ✅ **可配置安全知识库** - 支持自定义规则、文件加载、URL 加载
2. ✅ **行为模式检测框架** - AI 驱动框架，预留模型接口
3. ✅ **增强类型定义** - 完善的 TypeScript 类型支持

**代码质量**：
- ✅ 架构清晰，职责分离
- ✅ 可扩展性强，支持自定义
- ✅ 文档完善，易于使用

**下一步行动**：
1. 在实际项目中集成使用
2. 收集反馈，持续优化
3. 准备 AI 模型集成

---

**准备好使用这些新功能了吗？** 按照上述示例开始集成！