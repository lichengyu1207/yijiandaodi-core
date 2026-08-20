# 一鉴到底 (yijiandaodi-desktop)

> AI 操作行为安全审计桌面端 + 核心库 SDK —— 实时审计、智能检测、区块链存证

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

**一鉴到底** 是一款本地优先的 AI 行为安全审计桌面应用：敏感信息检测、文件/剪贴板监控、哈希链存证、风险拦截，并配套多智能体协同、账号互通、套餐计费与月度账单等云端能力。

**🔗 相关链接**：[官网](https://yijiandaodi.com) · [下载页面](https://yijiandaodi.com/download) · [NPM 核心库](https://www.npmjs.com/package/@lichengyu1207/yijiandaodi-security-core)

---

## 📦 桌面端

### 下载安装

| 平台 | 版本 | 说明 |
|------|------|------|
| Windows x64 | v2.0.0 | [官网下载](https://yijiandaodi.com/download) / [GitHub Releases](https://github.com/lichengyu1207/yijiandaodi-core/releases) |

- NSIS 安装程序：可自选安装目录（C/D 盘），完成即启动。
- 自包含运行时：内置后端与推理服务，无需安装 Node.js / Python。
- 设置页支持「检查更新」自动升级。

### 核心能力

- 🔍 敏感信息检测（SQL 注入 / XSS / API Key / 密码）
- 📁 文件监控 · 📋 剪贴板监控 · 🔗 链式存证 · 🛡️ 风险拦截
- 🤖 多智能体协同（推理引擎 + 集群调度 + 异步任务）
- 📊 月度账单 · 🔔 配额告警 · 🔑 账号互通（桌面端 ↔ 官网免登录）

---

## 📦 核心库 SDK

桌面端安全能力以独立 SDK 发布到 NPM，供 Node.js / TypeScript 项目集成。

```bash
npm install @lichengyu1207/yijiandaodi-security-core
```

```typescript
import { YijianDaoDiCore } from '@lichengyu1207/yijiandaodi-security-core';

const core = new YijianDaoDiCore({ storage: { path: './data', maxRecords: 100 } });
const risks = core.detect('SELECT * FROM users WHERE id = 1 OR 1=1');
console.log('检测到的风险:', risks);
```

检测类型：`sqli` / `xss` / `apikey` / `password` / `sensitive`，完整 API 见 `npm-package/README.md`。

---

## 🛠️ 开发

```bash
# 桌面端
cd desktop-client-2.0 && npm install && npm run dev

# 后端
cd backend && pip install -r requirements.txt && python manage.py migrate && python manage.py runserver 8000

# 核心库 SDK
cd npm-package && npm install && npm run build
```

---

## 📄 许可证

本项目采用 **Apache 2.0** 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 📞 联系方式

- 官网：https://yijiandaodi.com
- GitHub：https://github.com/lichengyu1207/yijiandaodi-core
- Email：155861995@qq.com

---

**⭐ 如果这个项目对你有帮助，请给一个 Star！**
