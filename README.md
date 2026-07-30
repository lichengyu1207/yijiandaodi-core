# 一鉴到底核心库 (yijiandaodi-security-core)

> 🇨🇳 AI操作行为实时审计和安全监控核心库
> 🇺🇸 AI Operation Behavior Audit and Security Monitoring Core Library

[![npm version](https://img.shields.io/npm/v/yijiandaodi-security-core.svg)](https://www.npmjs.com/package/yijiandaodi-security-core)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)

🔒 **企业级 AI 安全审计解决方案** - 支持敏感信息检测、文件监控、剪贴板监控、链式存证、风险拦截。用于企业安全合规、数据防泄漏、AI Agent 行为审计。

**🔗 相关链接**：[官网](https://yijiandaodi.com) · [文档](https://docs.yijiandaodi.com) · [在线演示](https://demo.yijiandaodi.com)

---

## 📖 简介

一鉴到底核心库提供AI操作行为实时审计和安全监控功能，包括：

- 🔍 **敏感信息检测** - SQL注入、XSS、API Key、密码等敏感信息检测
- 📁 **文件监控** - 实时监控文件系统，检测文件中的安全风险
- 📋 **剪贴板监控** - 监控剪贴板内容，防止敏感信息泄露
- 💾 **数据存储** - 本地存储审计记录，支持导出
- 🔗 **链式存证** - 基于哈希链的不可篡改审计存证
- 🛡️ **风险拦截** - 可配置的风险拦截机制

---

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
    path: './data',
    maxRecords: 100
  }
});

// 检测文本中的安全风险
const risks = core.detect('SELECT * FROM users WHERE id = 1 OR 1=1');
console.log('检测到的风险:', risks);

// 检测并生成报告
const report = core.detectWithReport('sk-proj-abc123def456', '配置文件');
console.log('检测报告:', report);
```

---

## 📚 文档

- [快速开始](npm-package/README.md)
- [API 文档](npm-package/docs/)
- [更新日志](CHANGELOG.md)

---

## 📦 项目结构

```
npm-package/
├── src/           # 源代码
│   ├── core.ts    # 核心类
│   ├── detectors/ # 检测器
│   ├── monitors/  # 监控器
│   └── services/  # 服务层
├── docs/          # 文档
├── LICENSE        # Apache 2.0 许可证
└── README.md      # 使用文档
```

---

## 📄 许可证

本项目采用 Apache 2.0 许可证 - 查看 [LICENSE](npm-package/LICENSE) 文件了解详情

---

## 🤝 贡献

欢迎社区贡献！请查看贡献指南。

---

## 📞 联系方式

- **技术支持**: lichengyu@fangsuanyun.cn
- **官方网站**: [yijiandaodi.com](https://yijiandaodi.com)
- **GitHub**: [github.com/lichengyu1207/yijiandaodi-core](https://github.com/lichengyu1207/yijiandaodi-core)

---

**Made with ❤️ by 一鉴到底团队**