# 一鉴到底核心库 (yijiandaodi-security-core)

> AI操作行为实时审计和安全监控核心库

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
# 从 GitHub 安装
npm install https://github.com/lichengyu1207/yijiandaodi-core.git

# 或在 package.json 中指定
{
  "dependencies": {
    "yijiandaodi-security-core": "github:lichengyu1207/yijiandaodi-core"
  }
}
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

## 🔧 高级功能

### 1. 文件监控

```typescript
import { FileMonitor } from 'yijiandaodi-security-core';

const monitor = new FileMonitor(securityKB);

// 开始监控
monitor.start();

// 停止监控
monitor.stop();
```

### 2. 自定义安全知识库

```typescript
import { initSecurityKnowledgeBase } from 'yijiandaodi-security-core';

// 初始化自定义知识库
const securityKB = initSecurityKnowledgeBase();

// 查看加载的内容
console.log('SQL注入Payload:', securityKB.sqli.length);
console.log('XSS Payload:', securityKB.xss.length);
```

### 3. 风险检测回调

```typescript
const core = new YijianDaoDiCore({
  callbacks: {
    onRiskDetected: (risks, context) => {
      console.log('发现风险:', risks.length, '个');
      console.log('来源:', context.source);
    }
  }
});
```

## 📊 支持的检测类型

| 类型 | 描述 | 风险等级 |
|------|------|----------|
| `sqli` | SQL注入攻击 | 🔴 High |
| `xss` | XSS跨站脚本攻击 | 🔴 High |
| `apikey` | API Key泄露 | 🔴 High |
| `password` | 密码明文存储 | 🟡 Medium |
| `sensitive` | 敏感关键词 | 🟡 Medium |

## 📚 API 文档

### `YijianDaoDiCore`

主类，提供核心功能。

#### 构造函数

```typescript
constructor(options?: YijianDaoDiCoreOptions)
```

#### 方法

##### `detect(content: string): Risk[]`

检测文本中的安全风险。

**参数**：
- `content`: 要检测的文本内容

**返回值**：
- `Risk[]`: 检测到的风险列表

##### `detectWithReport(content: string, source: string): AuditRecord`

检测并生成审计报告。

**参数**：
- `content`: 要检测的文本内容
- `source`: 内容来源（如：剪贴板、文件路径等）

**返回值**：
- `AuditRecord`: 审计记录对象

## 🛠️ 开发

### 构建

```bash
npm run build
```

### 测试

```bash
npm test
```

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📞 联系方式

- 官网：https://yijiandaodi.com
- GitHub：https://github.com/lichengyu1207/yijiandaodi-core
- Email：155861995@qq.com

---

**⭐ 如果这个项目对你有帮助，请给一个 Star！**