# 自动化检测功能使用指南

## 概述

一鉴到底 2.0 集成了 **code-detector** 和 **content-moderator** skill，提供强大的自动化安全检测能力。

### 核心能力

| 能力 | 来源 | 说明 |
|------|------|------|
| 代码安全检测 | code-detector | 危险模式匹配、语言白名单、复杂度评估、资源预估 |
| 内容审核 | content-moderator | 输入净化、敏感词检测、内容分级 |
| 安全知识库 | 项目原生 | SQL注入、XSS、API Key检测 |

---

## 快速开始

### 1. 基础使用

```typescript
import { AutoDetector } from './monitoring/autoDetector'

const detector = new AutoDetector()

// 检测文本内容
const result = detector.detect('print("hello world")')

console.log(result)
// {
//   safe: true,
//   risk_level: 'low',
//   content_type: 'code',
//   detected_language: 'python',
//   warnings: [],
//   risks: [],
//   estimated_resources: { memory_mb: 16, cpu_seconds: 5, disk_mb: 1 }
// }
```

### 2. 集成安全知识库

```typescript
import { AutoDetector } from './monitoring/autoDetector'
import { initSecurityKnowledgeBase } from '../securityKnowledgeBase'

const securityKB = initSecurityKnowledgeBase()
const detector = new AutoDetector(securityKB)

// 检测包含SQL注入的内容
const result = detector.detect("SELECT * FROM users WHERE id='1' OR '1'='1'")
console.log(result.risks)
// [
//   { type: 'sqli', matched: 'or 1=1', risk: 'high' }
// ]
```

---

## 检测能力详解

### 1. 代码安全检测

#### 语言白名单

仅支持以下语言：

- Python
- JavaScript
- TypeScript
- Bash
- HTML

**不支持的语言** 会直接返回 `risk_level: 'critical'`

#### 危险模式检测

自动检测以下 11 种危险模式：

| 模式 | 风险等级 | 说明 |
|------|---------|------|
| `import os.system` | high | 系统命令注入 |
| `import subprocess` | high | 子进程逃逸 |
| `eval()` | high | 动态代码执行 |
| `exec()` | high | 动态代码执行 |
| `__import__` | high | 动态导入 |
| `open("/etc...")` | high | 系统文件读取 |
| `open("/proc...")` | high | 进程信息泄露 |
| `rm -rf /` | high | 破坏性删除 |
| `chmod 777` | high | 权限提升 |
| `.env` 文件访问 | high | 敏感文件访问 |
| `socket.socket` | medium | 网络连接 |

#### 复杂度评估

| 指标 | 低风险 | 中风险警告 |
|------|-------|-----------|
| 代码行数 | ≤500 行 | >500 行 |
| 导入模块数 | ≤20 个 | >20 个 |

#### 资源需求预估

自动预估执行所需资源：

```typescript
{
  memory_mb: 16~512 MB,
  cpu_seconds: 5~300 秒,
  disk_mb: 1~256 MB
}
```

---

### 2. 内容审核

#### 内容净化

自动移除以下危险HTML标签：

- `script`, `iframe`, `object`, `embed`
- `form`, `input`, `textarea`, `button`
- `meta`, `link`, `style`, `base`, `applet`

同时清除：
- 事件处理器（onclick、onerror等）
- 控制字符（\x00-\x08等）

#### 敏感信息分级

| 等级 | 关键词示例 | 场景 |
|------|-----------|------|
| **public** | 无敏感词 | 普通文本 |
| **internal** | internal, 员工, 薪资, 部署配置 | 组织内部信息 |
| **confidential** | password, api_key, 身份证, 银行卡 | 个人隐私/密钥数据 |

---

### 3. 安全知识库检测

继承项目原有的安全知识库能力：

- **SQL注入Payload**: 从 AboutSecurity 项目提取的注入Payload
- **XSS Payload**: JavaScript事件型XSS
- **常见密码字典**: pass-admin.txt
- **API Key模式**: OpenAI/GitHub/AWS等

---

## 使用场景

### 场景1：文件监控集成

```typescript
import { FileMonitor } from './monitoring/fileMonitor'
import { initSecurityKnowledgeBase } from '../securityKnowledgeBase'

const fileMonitor = new FileMonitor()
const securityKB = initSecurityKnowledgeBase()

fileMonitor.setSecurityKnowledgeBase(securityKB)
fileMonitor.setRiskDetectedCallback((risks, filePath) => {
  console.log(`检测到风险: ${filePath}`, risks)
})

fileMonitor.start()
```

### 场景2：剪贴板监控集成

```typescript
import { ClipboardMonitor } from './monitoring/clipboardMonitor'
import { initSecurityKnowledgeBase } from '../securityKnowledgeBase'

const clipboardMonitor = new ClipboardMonitor()
const securityKB = initSecurityKnowledgeBase()

clipboardMonitor.setSecurityKnowledgeBase(securityKB)
clipboardMonitor.setRiskDetectedCallback((risks, content) => {
  if (risks.some(r => r.risk === 'high')) {
    console.warn('剪贴板包含高风险内容！')
  }
})

clipboardMonitor.start()
```

### 场景3：独立内容检测

```typescript
import { autoDetector } from './monitoring/autoDetector'

// 检测用户输入
function checkUserInput(input: string) {
  const result = autoDetector.detect(input)

  if (!result.safe) {
    if (result.risk_level === 'critical') {
      return { allowed: false, reason: '不支持的内容类型' }
    }

    if (result.risk_level === 'high') {
      return {
        allowed: false,
        reason: `检测到高风险内容: ${result.risks.map(r => r.matched).join(', ')}`
      }
    }

    return {
      allowed: true,
      warning: `检测到${result.warnings.length}个警告`,
      sanitized: result.sanitized_content
    }
  }

  return { allowed: true }
}
```

---

## 检测结果说明

### AutoDetectionResult 结构

```typescript
interface AutoDetectionResult {
  safe: boolean                    // 是否安全
  risk_level: RiskLevel            // 风险等级: low/medium/high/critical
  content_type: ContentType        // 内容类型: code/text/mixed
  detected_language?: Language     // 检测到的编程语言
  warnings: string[]               // 警告信息列表
  risks: Array<{                   // 检测到的风险
    type: string                   // 风险类型
    matched: string                // 匹配的内容
    risk: RiskLevel                // 风险等级
    location?: string              // 位置信息
  }>
  estimated_resources?: {          // 预估资源需求
    memory_mb: number
    cpu_seconds: number
    disk_mb: number
  }
  sanitized_content?: string       // 净化后的内容
  sensitivity_level?: string       // 敏感等级: public/internal/confidential
}
```

---

## 性能优化建议

### 1. 复用检测器实例

```typescript
// ✅ 推荐：复用实例
const detector = new AutoDetector(securityKB)
results.forEach(content => detector.detect(content))

// ❌ 不推荐：每次创建新实例
results.forEach(content => {
  const detector = new AutoDetector(securityKB)
  detector.detect(content)
})
```

### 2. 批量检测

```typescript
// 对于大量内容，建议批量处理
function batchDetect(contents: string[]) {
  const detector = new AutoDetector(securityKB)
  return contents.map(content => ({
    content,
    result: detector.detect(content)
  }))
}
```

### 3. 短路优化

```typescript
// 根据业务需求，可提前终止检测
function quickCheck(content: string) {
  const detector = new AutoDetector()

  // 先检测最危险的模式
  const dangerousRisks = detector.detectDangerousPatterns(content)
  if (dangerousRisks.some(r => r.risk === 'high')) {
    return { safe: false, reason: '检测到危险模式' }
  }

  // 再进行完整检测
  return detector.detect(content)
}
```

---

## 注意事项

1. **安全知识库必须初始化**: 使用前需调用 `initSecurityKnowledgeBase()`
2. **语言检测为启发式**: 基于正则匹配，非精确解析
3. **净化操作不可逆**: 原始数据应在净化前自行备份
4. **资源预估为粗略估计**: 实际消耗以运行时为准

---

## 更新日志

### v2.0.0 (2026-08-01)

- ✅ 集成 code-detector skill
- ✅ 集成 content-moderator skill
- ✅ 新增自动化检测管理模块 `autoDetector.ts`
- ✅ 增强 11 种危险模式检测
- ✅ 新增内容类型自动识别
- ✅ 新增编程语言自动检测
- ✅ 新增敏感信息分级
- ✅ 新增内容净化功能

---

## 相关文档

- [code-detector skill 文档](../.trae/skills/code-detector/SKILL.md)
- [content-moderator skill 文档](../.trae/skills/content-moderator/SKILL.md)
- [安全知识库文档](../securityKnowledgeBase.ts)