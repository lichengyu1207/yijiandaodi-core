# 一鉴到底 (yijiandaodi-desktop)

> 本地优先的 AI 操作行为安全审计桌面端 —— 实时监控、智能检测、链式存证、账号互通

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)

**一鉴到底** 是一款面向个人与企业的 AI 行为安全审计桌面应用。所有检测在本地完成，不上传原始数据；同时提供账号互通、套餐计费、月度账单等云端能力，兼顾离线隐私与在线协同。

**🔗 相关链接**：[官网](https://yijiandaodi.com) · [安装包下载](https://yijiandaodi.com/download) · [核心库 SDK](https://www.npmjs.com/package/@lichengyu1207/yijiandaodi-security-core)

---

## 📦 桌面端安装包

| 平台 | 版本 | 下载 |
|------|------|------|
| Windows x64 | v2.0.0 | [下载安装包](https://yijiandaodi.com/download)（NSIS 安装程序，可选安装目录） |

- **安装方式**：下载 `Setup.exe` 后双击运行，按向导选择安装目录（支持 C/D 盘），安装完成自动启动。
- **零依赖**：安装包已内置 Django 后端与沙箱推理服务，无需安装 Node.js 或 Python 即可运行。
- **自动更新**：新版本发布后，可在设置页「检查更新」一键升级。

> 下载入口：官网 [下载页](https://yijiandaodi.com/download) 或 GitHub [Releases](https://github.com/lichengyu1207/yijiandaodi-core/releases)。

---

## ✨ 桌面端核心能力

**三大核心能力**

| 核心能力 | 说明 |
|----------|------|
| 🔍 **操作白盒化** | 从输入到输出全链路白盒审计，AI 每一步操作可追溯、可验证、可拦截，行为风险一目了然 |
| 🤖 **多智能体协同** | 聚合代码检测、风险识别、合规校验等多类型智能体，形成协同检测网络，覆盖全流程风险 |
| 🔗 **链式存证** | 基于哈希链的不可篡改白盒审计存证，每条记录环环相扣，支持合规报告一键导出与可信追溯 |

**更多能力**

- 📁 **文件监控** - 实时监控文件系统，检测文件中的安全风险
- 📋 **剪贴板监控** - 监控剪贴板内容，防止敏感信息泄露
- 🛡️ **风险拦截** - 可配置的风险拦截机制
- 🔔 **意图分析** - 实时监控 AI 行为，检测敏感信息与安全风险
- 🔍 **常态化巡检** - 定期对系统进行安全检查，及时发现潜在风险
- 🧠 **AIGC 本地校验** - 本地完成 AIGC 内容安全检测，不上传原始数据
- 📊 **月度账单** - 套餐用量实时挂钩，消费明细与趋势可视化
- 🔑 **账号互通** - 桌面端登录后一键直达官网免登录（临时 token 兑换）

---

## 🏠 官网

- **官网地址**：https://yijiandaodi.com
- 提供产品介绍、能力单元展示、账号注册/登录、套餐计费、开发者中心、下载页面。
- 桌面端与官网同账号体系：桌面端「官网入口」跳转后自动保持登录态。

---

## 📖 核心库 SDK（@lichengyu1207/yijiandaodi-security-core）

桌面端底层安全能力以独立 SDK 形式提供，供 Node.js / TypeScript 项目直接集成。

### NPM 安装

```bash
npm install @lichengyu1207/yijiandaodi-security-core
```

### 基本使用

```typescript
import { YijianDaoDiCore } from '@lichengyu1207/yijiandaodi-security-core';

const core = new YijianDaoDiCore({
  storage: { path: './data', maxRecords: 100 }
});

// 检测文本中的安全风险
const risks = core.detect('SELECT * FROM users WHERE id = 1 OR 1=1');
console.log('检测到的风险:', risks);

// 检测并生成报告
const report = core.detectWithReport('sk-proj-abc123def456', '配置文件');
console.log('检测报告:', report);
```

### 高级功能

```typescript
import { FileMonitor, initSecurityKnowledgeBase } from '@lichengyu1207/yijiandaodi-security-core';

// 文件监控
const monitor = new FileMonitor(securityKB);
monitor.start();

// 自定义安全知识库
const securityKB = initSecurityKnowledgeBase();
console.log('SQL注入Payload:', securityKB.sqli.length);

// 风险检测回调
const core = new YijianDaoDiCore({
  callbacks: {
    onRiskDetected: (risks, context) => {
      console.log('发现风险:', risks.length, '个');
      console.log('来源:', context.source);
    }
  }
});
```

### 支持的检测类型

| 类型 | 描述 | 风险等级 |
|------|------|----------|
| `sqli` | SQL注入攻击 | 🔴 High |
| `xss` | XSS跨站脚本攻击 | 🔴 High |
| `apikey` | API Key泄露 | 🔴 High |
| `password` | 密码明文存储 | 🟡 Medium |
| `sensitive` | 敏感关键词 | 🟡 Medium |

> 核心库完整 API 文档见 `npm-package/README.md`。

---

## 🛠️ 开发

### 桌面端

```bash
cd desktop-client-2.0
npm install
npm run dev          # 开发模式
npm run build        # 构建渲染层
npm test             # 前端测试
```

### 后端

```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8000
```

### 打包发布

```bash
cd desktop-client-2.0
npx electron-builder --win --x64 --publish never
```

---

## 📄 许可证

本项目采用 **Apache 2.0** 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

---

## 🤝 贡献

欢迎社区贡献！请查看贡献指南后提交 Issue 和 Pull Request。

---

## 📞 联系方式

- **官方网站**: [yijiandaodi.com](https://yijiandaodi.com)
- **GitHub**: [github.com/lichengyu1207/yijiandaodi-core](https://github.com/lichengyu1207/yijiandaodi-core)
- **Email**: 155861995@qq.com

---

**⭐ 如果这个项目对你有帮助，请给一个 Star！**
