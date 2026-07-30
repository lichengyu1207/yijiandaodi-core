# 一鉴到底核心库 (yijiandaodi-security-core)

> 🇨🇳 AI操作行为实时审计和安全监控核心库  
> 🇺🇸 AI Operation Behavior Audit and Security Monitoring Core Library

[![npm version](https://img.shields.io/npm/v/yijiandaodi-security-core.svg)](https://www.npmjs.com/package/yijiandaodi-security-core)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)

🔒 **企业级 AI 安全审计解决方案** - 支持敏感信息检测、文件监控、剪贴板监控、链式存证、风险拦截。用于企业安全合规、数据防泄漏、AI Agent 行为审计。

**🔗 相关链接**：[官网](https://yijiandaodi.com) · [文档](https://docs.yijiandaodi.com) · [在线演示](https://demo.yijiandaodi.com)

## 📖 简介

一鉴到底核心库提供AI操作行为实时审计和安全监控功能，包括：

- 🔍 **敏感信息检测** - SQL注入、XSS、API Key、密码等敏感信息检测
- 📁 **文件监控** - 实时监控文件系统，检测文件中的安全风险
- 📋 **剪贴板监控** - 监控剪贴板内容，防止敏感信息泄露
- 💾 **数据存储** - 本地存储审计记录，支持导出
- 🔗 **链式存证** - 基于哈希链的不可篡改审计存证
- 🛡️ **风险拦截** - 可配置的风险拦截机制

## 🏗️ 架构设计

```
┌─────────────────────────────────────────────────────────┐
│                    YijianDaoDiCore                      │
│                   （核心协调层）                          │
└─────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  Detectors  │   │  Monitors   │   │  Services   │
│  (检测层)   │   │  (监控层)   │   │  (服务层)   │
└─────────────┘   └─────────────┘   └─────────────┘
        │                 │                 │
        ▼                 ▼                 ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│ Risk        │   │ File        │   │ Storage     │
│ Detector    │   │ Monitor     │   │ Service     │
└─────────────┘   └─────────────┘   └─────────────┘
        │                 │                 │
        └─────────────────┼─────────────────┘
                          │
                          ▼
              ┌─────────────────────┐
              │ Security Knowledge  │
              │ Base (安全知识库)    │
              └─────────────────────┘

系统流程：
1. 用户操作 → Monitor 捕获
2. Detector 检测 → 风险识别
3. Storage 存储 → 链式存证
4. Callback 通知 → 外部响应
```

## 🚀 快速开始

### 安装

```bash
npm install yijiandaodi-security-core
```

### 基本使用

```typescript
import { YijianDaoDiCore } from 'yijiandaodi-security-core';

// 创建核心实例
const core = new YijianDaoDiCore({
  storage: {
    path: './data',  // 可选：自定义存储路径
    maxRecords: 100  // 可选：最大记录数
  }
});

// 检测文本中的安全风险
const risks = core.detect('SELECT * FROM users WHERE id = 1 OR 1=1');

console.log('检测到的风险:', risks);
// 输出: [{ type: 'sqli', matched: 'or 1=1', risk: 'high' }]

// 检测并生成报告
const report = core.detectWithReport(
  'sk-proj-abc123def456 API Key',
  '配置文件'
);

console.log('检测报告:', report);
```

### 高级功能

#### 1. 文件监控

```typescript
import { YijianDaoDiCore } from 'yijiandaodi-core';

const core = new YijianDaoDiCore({
  fileMonitor: {
    enabled: true,
    paths: ['./src', './config'],  // 监控路径
    excludePatterns: [/node_modules/, /\.git/]  // 排除模式
  }
});

// 启动监控
core.startFileMonitoring();

// 停止监控
core.stopFileMonitoring();
```

#### 2. 自定义回调

```typescript
const core = new YijianDaoDiCore({
  callbacks: {
    onRiskDetected: (risks, context) => {
      console.log(`发现风险: ${risks.length} 个，上下文: ${context}`);
      // 发送通知、记录日志等
    },
    onRecordSaved: (record) => {
      console.log('记录已保存:', record.id);
    },
    onError: (error) => {
      console.error('发生错误:', error);
    }
  }
});
```

#### 3. 获取审计记录

```typescript
// 获取所有记录
const records = await core.getRecords();

// 导出记录
const exportPath = await core.exportRecords('json');
console.log('导出路径:', exportPath);
```

## 🔗 链式存证（核心特性）

本库实现了基于哈希链的不可篡改审计存证：

### 技术原理

**五元组联合哈希**：
```
hash = SHA256(操作指令 | 校验结果 | 确认凭证 | 时间戳 | 前次指纹)
```

- **操作指令**：用户操作内容（前100字符）
- **校验结果**：passed 或 flagged
- **确认凭证**：检测到的风险类型
- **时间戳**：ISO 8601 格式
- **前次指纹**：上一次审计的哈希值（首次为0）

### 链式结构

```typescript
记录1: hash_1 = SHA256(操作1 | 结果1 | 凭证1 | 时间1 | 000000...)
记录2: hash_2 = SHA256(操作2 | 结果2 | 凭证2 | 时间2 | hash_1)
记录3: hash_3 = SHA256(操作3 | 结果3 | 凭证3 | 时间3 | hash_2)
...
```

### 验证方法

```typescript
// 验证哈希链完整性
const records = core.getRecords();
for (let i = 1; i < records.length; i++) {
  const prev = records[i - 1];
  const curr = records[i];
  
  // 重新计算哈希，验证是否匹配
  const expected = calculateHash(prev.content, prev.risks, curr.timestamp, prev.audit_hash);
  if (curr.audit_hash !== expected) {
    console.error('❌ 哈希链断裂，记录可能被篡改！');
  }
}
```

### 安全特性

- ✅ **不可篡改**：任何记录修改都会导致哈希链断裂
- ✅ **可追溯**：每条记录都链接到前一条记录
- ✅ **时间证明**：时间戳嵌入哈希计算
- ✅ **完整性验证**：可验证整个审计链的完整性

## 📚 API 文档

### `YijianDaoDiCore`

主类，提供完整的审计功能。

#### 构造函数

```typescript
new YijianDaoDiCore(config?: CoreConfig)
```

#### 方法

- `detect(content: string): RiskResult[]` - 检测内容中的安全风险
- `detectWithReport(content: string, context?: string): OperationRecord` - 检测并生成报告
- `startFileMonitoring(): void` - 启动文件监控
- `stopFileMonitoring(): void` - 停止文件监控
- `getRecords(): Promise<OperationRecord[]>` - 获取审计记录
- `exportRecords(format?: 'json' | 'txt'): Promise<string>` - 导出记录
- `getVersion(): string` - 获取版本信息

### 类型定义

```typescript
interface RiskResult {
  type: 'sqli' | 'xss' | 'password' | 'apikey' | 'sensitive';
  matched: string;
  risk: 'high' | 'medium' | 'low';
}

interface OperationRecord {
  id: string;
  type: 'ai_dialog' | 'file_op' | 'search' | 'clipboard' | 'other';
  title: string;
  content: string;
  source: string;
  status: 'verified' | 'pending' | 'flagged';
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  risk_score: number;
  should_block: boolean;
  context: string;
  explanation: string;
  timestamp?: string;
  audit_hash?: string;
}
```

## 🔧 集成示例

### Node.js 项目

```typescript
import { YijianDaoDiCore } from 'yijiandaodi-core';

const core = new YijianDaoDiCore();

// 在Express中间件中使用
app.use((req, res, next) => {
  const content = JSON.stringify(req.body);
  const risks = core.detect(content);

  if (risks.some(r => r.risk === 'high')) {
    return res.status(400).json({ error: '检测到安全风险' });
  }

  next();
});
```

### Electron 应用

```typescript
import { YijianDaoDiCore } from 'yijiandaodi-core';
import { app } from 'electron';

const core = new YijianDaoDiCore({
  storage: {
    path: path.join(app.getPath('userData'), 'audit-records')
  },
  fileMonitor: {
    enabled: true,
    paths: [
      path.join(app.getPath('home'), 'Documents'),
      path.join(app.getPath('home'), 'Desktop')
    ]
  }
});

app.whenReady().then(() => {
  core.startFileMonitoring();
});
```

### 作为 Skill 集成

```typescript
import { YijianDaoDiCore } from 'yijiandaodi-core';

export class SecuritySkill {
  private core: YijianDaoDiCore;

  constructor() {
    this.core = new YijianDaoDiCore();
  }

  // 作为Skill的执行方法
  async execute(params: { content: string; context?: string }) {
    return this.core.detectWithReport(params.content, params.context);
  }

  // 其他Skill方法
  async validate(content: string): Promise<boolean> {
    const risks = this.core.detect(content);
    return !risks.some(r => r.risk === 'high');
  }
}
```

## 📦 发布

```bash
# 构建
npm run build

# 发布到NPM
npm publish
```

## 📄 许可证

MIT License

## 👥 贡献

欢迎提交Issue和Pull Request！

## 🏠 主页

- 官网: https://yijiandaodi.com
- GitHub: https://github.com/yijiandaodi/core
- NPM: https://www.npmjs.com/package/yijiandaodi-core