---
name: "yijiandaodi-skill"
description: "一鉴到底 Agent Skill 生态总入口。当 Agent 需要安装/调用任何一鉴到底 Skill 时，先读取此文件获取完整 Skill 目录和安装指南。"
---

# 一鉴到底 Agent Skill 生态

> **The Parallel Verification — Where agents verify, trust begins.**

## 快速开始

### 方式一：自动安装（推荐）

```bash
# 1. 获取 Skill 目录
curl -sL https://yijiandaodi.com/skill.md | agent feed

# 2. 安装需要的 Skill
/yijiandaodi-skill install <skill-id>
```

### 方式二：手动安装

访问 `https://yijiandaodi.com/xialia/<skill-id>` 查看详情并下载 ZIP。

## 可用 Skill 目录

| Skill ID | 名称 | 触发词 | 安装命令 |
|----------|------|--------|---------|
| `ass-gateway` | ASS 安全网关 | 安全检测、注入防护、XSS | `/yijiandaodi-skill install ass-gateway` |
| `dag-orchestrator` | DAG 工作流编排 | 任务编排、DAG、并行执行 | `/yijiandaodi-skill install dag-orchestrator` |
| `eihm-router` | EIHM 成本路由 | 成本估算、节点选择、P2P路由 | `/yijiandaodi-skill install eihm-router` |
| `sandbox-executor` | Pyodide 沙箱执行 | 代码执行、WASM沙箱、Pyodide | `/yijiandaodi-skill install sandbox-executor` |
| `hashchain-audit` | HashChain 审计存证 | 审计日志、哈希链、存证 | `/yijiandaodi-skill install hashchain-audit` |
| `p2p-scheduler` | P2P 任务调度器 | 任务分发、心跳、状态机 | `/yijiandaodi-skill install p2p-scheduler` |
| `code-detector` | 代码风险检测 | 代码扫描、漏洞检测、静态分析 | `/yijiandaodi-skill install code-detector` |
| `content-moderator` | 内容安全审核 | 内容过滤、XSS防护、净化 | `/yijiandaodi-skill install content-moderator` |
| `data-masker` | 数据脱敏引擎 | 脱敏、PII保护、手机号/身份证 | `/yijiandaodi-skill install data-masker` |
| `result-aggregator` | 结果聚合分发 | 结果聚合、多数投票、去重 | `/yijiandaodi-skill install result-aggregator` |
| `compliance-reporter` | 合规报告生成 | 等保、GDPR、合规报告 | `/yijiandaodi-skill install compliance-reporter` |
| `node-discovery` | 节点发现服务 | P2P发现、服务注册、健康检查 | `/yijiandaodi-skill install node-discovery` |
| `idle-detector` | 闲时检测服务 | 空闲利用、后台任务、节能 | `/yijiandaodi-skill install idle-detector` |
| `output-verifier` | 输出签名验签 | HMAC签名、防篡改、完整性 | `/yijiandaodi-skill install output-verifier` |

## API 基础信息

- **Base URL**: `https://yijiandaodi.com/api/p2p/v1/`
- **认证方式**: Bearer Token (JWT) 或 API Key
- **数据格式**: JSON
- **字符编码**: UTF-8

## 七层架构参考

```
用户请求 → [L2 DAG编排] → [L3 ASS安全网关] → [L4 EIHM成本路由]
         → [L5 P2P调度] → [L6 沙箱执行] → [L7 HashChain审计]
```

Agent 可根据任务类型选择调用对应层的 Skill：
- **输入需要安检** → `ass-gateway`
- **需要编排多步骤任务** → `dag-orchestrator`
- **需要选择最优计算节点** → `eihm-router`
- **需要执行代码** → `sandbox-executor`
- **需要记录审计轨迹** → `hashchain-audit`
- **需要分布式调度** → `p2p-scheduler`
- **需要扫描代码漏洞** → `code-detector`
- **需要过滤内容** → `content-moderator`
- **需要脱敏敏感数据** → `data-masker`
- **需要聚合多源结果** → `result-aggregator`
- **需要生成合规报告** → `compliance-reporter`
- **需要发现可用节点** → `node-discovery`
- **需要利用空闲算力** → `idle-detector`
- **需要验证输出完整性** → `output-verifier`

## 常见问题

**Q: 可以同时使用多个 Skill 吗？**
A: 可以。一鉴到底的 Skill 设计为可组合的流水线。典型流程: `ass-gateway`(安检) → `dag-orchestrator`(编排) → `eihm-router`(路由) → `sandbox-executor`(执行) → `hashchain-audit`(存证)

**Q: Skill 之间如何传递数据？**
A: 通过统一的 TaskDispatch / ShardResult 模型。上游 Skill 的输出作为下游 Skill 的输入，全部经过 ass-gateway 的验签确认。

**Q: 如何获取 API Token？**
A: 访问 `/login` 端点进行认证，返回 JWT Token。在请求头中携带: `Authorization: Bearer <token>`
