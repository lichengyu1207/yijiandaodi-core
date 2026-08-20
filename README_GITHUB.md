# 一鉴到底 (yijiandaodi-desktop)

> AI 操作行为安全审计桌面端 + 核心库 SDK —— 实时审计、智能检测、区块链存证

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

**一鉴到底** 是一款本地优先的 AI 操作行为安全审计桌面应用：全链路白盒审计、多智能体协同检测、哈希链不可篡改存证，并配套意图分析、常态化巡检、AIGC 本地校验、账号互通与月度账单等能力。

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

**三大核心能力**

| 核心能力 | 说明 |
|----------|------|
| 🔍 **操作白盒化** | 从输入到输出全链路白盒审计，AI 每一步操作可追溯、可验证、可拦截 |
| 🤖 **多智能体协同** | 聚合代码检测、风险识别、合规校验等多类型智能体，协同覆盖全流程风险 |
| 🔗 **链式存证** | 基于哈希链的不可篡改审计存证，支持合规报告一键导出与可信追溯 |

**更多能力**

- 📁 **文件监控** · 📋 **剪贴板监控** · 🛡️ **风险拦截** · 🔍 **敏感信息检测**
- 🔔 **意图分析** - 实时监控 AI 行为，检测敏感信息与安全风险
- 🔍 **常态化巡检** - 定期对系统进行安全检查，及时发现潜在风险
- 🧠 **AIGC 本地校验** - 本地完成 AIGC 内容安全检测，不上传原始数据
- 📊 **月度账单** · 🔑 **账号互通**（桌面端 ↔ 官网免登录）

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
