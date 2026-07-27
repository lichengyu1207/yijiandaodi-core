# 一鉴到底核心库 (yijiandaodi-security-core)

> AI操作行为实时审计和安全监控核心库

[![npm version](https://img.shields.io/npm/v/yijiandaodi-security-core.svg)](https://www.npmjs.com/package/yijiandaodi-security-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 📖 简介

一鉴到底核心库提供AI操作行为实时审计和安全监控功能，包括：

- 🔍 **敏感信息检测** - SQL注入、XSS、API Key、密码等敏感信息检测
- 📁 **文件监控** - 实时监控文件系统，检测文件中的安全风险
- 📋 **剪贴板监控** - 监控剪贴板内容，防止敏感信息泄露
- 💾 **数据存储** - 本地存储审计记录，支持导出
- 🛡️ **风险拦截** - 可配置的风险拦截机制

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