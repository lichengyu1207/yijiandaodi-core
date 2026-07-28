import { useState } from 'react'
import './Docs.css'

export default function Docs() {
  const [section, setSection] = useState('intro')

  const sections = {
    intro: {
      title: '快速开始',
      content: `
# 一鉴到底 API 快速开始

## 简介

一鉴到底是一个本地运行的 AI 操作行为校验工具，核心功能包括：

- **常态化巡检**：实时监控 AI Agent 行为
- **操作白盒化**：完整记录操作过程
- **司法级存证**：不可篡改的审计日志
- **数据不出域**：本地推理，数据不上云

## API 端点

基础地址：http://localhost:9092

### 核心接口

| 接口 | 方法 | 说明 |
|------|------|------|
| /api/v1/sandbox/start | POST | 启动沙箱会话 |
| /api/v1/sandbox/execute | POST | 执行操作 |
| /api/v1/sandbox/logs | GET | 获取日志 |
| /api/v1/keys/generate | POST | 生成 API Key |

## 快速示例

\`\`\`python
import requests

# 启动沙箱
response = requests.post('http://localhost:9092/api/v1/sandbox/start')
session_id = response.json()['session_id']

# 执行操作
response = requests.post('http://localhost:9092/api/v1/sandbox/execute', json={
    'agent': 'Cursor AI',
    'operation': 'git push origin main',
    'context': '推送到生产环境'
})

print(response.json())
\`\`\`
      `
    },
    auth: {
      title: '认证',
      content: `
# API 认证

## API Key 格式

\`\`\`
yjd_1_{64位十六进制密钥}
\`\`\`

示例：\`yjd_1_85311f25d1a2643a06dea7ce3d831fe9a87a2caa4dceb6aac612f230856e2710\`

## 请求签名

所有请求需要携带以下认证头：

| 头部 | 说明 |
|------|------|
| X-API-Key | 完整 API Key |
| X-Signature | HMAC-SHA256 签名 |
| X-Timestamp | Unix 时间戳 |
| X-Nonce | 随机字符串（防重放） |

## 签名生成

\`\`\`python
from xai_grok_crypto import RequestSigner

signer = RequestSigner()
signed = signer.sign(
    api_key='yjd_1_xxx',
    method='POST',
    path='/api/v1/sandbox/execute',
    body='{"operation": "test"}'
)

headers = {
    'X-API-Key': 'yjd_1_xxx',
    'X-Signature': signed['signature'],
    'X-Timestamp': signed['timestamp'],
    'X-Nonce': signed['nonce']
}
\`\`\`

## 防重放攻击

- 时间戳有效期为 5 分钟
- 每个 nonce 只能使用一次
      `
    },
    sandbox: {
      title: '沙箱 API',
      content: `
# 沙箱 API

## 1. 启动沙箱会话

**POST** /api/v1/sandbox/start

请求体：
\`\`\`json
{
  "environment_id": "default",
  "repository": "user/repo"
}
\`\`\`

响应：
\`\`\`json
{
  "success": true,
  "sandbox_id": "abc123",
  "session_id": "xyz789"
}
\`\`\`

## 2. 执行操作

**POST** /api/v1/sandbox/execute

请求体：
\`\`\`json
{
  "agent": "Cursor AI",
  "operation_type": "git",
  "operation": "git push origin main",
  "target": "production",
  "context": "推送到生产环境"
}
\`\`\`

响应：
\`\`\`json
{
  "success": true,
  "operation_id": "op123",
  "risk_level": "high",
  "decision": "ask_user",
  "needs_confirmation": true,
  "explanation": "检测到高风险：代码推送"
}
\`\`\`

## 3. 获取日志

**GET** /api/v1/sandbox/logs?limit=100

响应：
\`\`\`json
{
  "count": 10,
  "logs": [...]
}
\`\`\`
      `
    },
    key: {
      title: 'Key 管理',
      content: `
# API Key 管理

## 生成 Key

**POST** /api/v1/keys/generate

请求体：
\`\`\`json
{
  "scopes": ["sandbox:read", "sandbox:write"],
  "expires_days": 30,
  "rate_limit": 100
}
\`\`\`

响应：
\`\`\`json
{
  "success": true,
  "key_id": "85311f25",
  "api_key": "yjd_1_...",
  "expires_at": "2026-08-20T00:00:00"
}
\`\`\`

## 生产级限制

| 限制 | 值 |
|------|-----|
| 用户 Key 数量 | 10 个 |
| 生成冷却时间 | 1 小时 |
| 并发限制 | 5 个/Key |
| 每日配额 | 10,000 次 |

## 安全机制

- HMAC-SHA256 签名验证
- 5 分钟时间窗口
- Nonce 防重放
- IP/设备白名单
- 异常行为检测
      `
    },
    sdk: {
      title: 'SDK',
      content: `
# SDK 使用

## Python SDK

\`\`\`python
from yijiandaodi import YiJianDaoDiSDK

# 初始化
sdk = YiJianDaoDiSDK(api_key='yjd_1_xxx')

# 执行操作
result = sdk.verify(
    operation='git push origin main',
    context='推送到生产环境'
)

print(result.risk_level)  # 'low', 'medium', 'high', 'critical'
print(result.decision)    # 'allow', 'ask_user', 'block'
\`\`\`

## JavaScript SDK

\`\`\`javascript
import { YiJianDaoDiSDK } from '@yijiandaodi/sdk'

const sdk = new YiJianDaoDiSDK({ apiKey: 'yjd_1_xxx' })

const result = await sdk.verify({
  operation: 'git push origin main',
  context: '推送到生产环境'
})

console.log(result.riskLevel)
console.log(result.decision)
\`\`\`

## 安装

\`\`\`bash
# Python
pip install yijiandaodi

# JavaScript
npm install @yijiandaodi/sdk
\`\`\`
      `
    },
    skills: {
      title: 'Skill API',
      content: `
# Skill API (对外开放)

## 概述

Skill API 提供 14 个安全能力模块，支持本地调用和对外开放。

## 可用 Skill

### L2 - 分析层

| Skill | 名称 | 功能 |
|-------|------|------|
| code-detector | 代码风险检测 | 静态分析、漏洞检测 |
| content-moderator | 内容安全审核 | XSS防护、敏感词过滤 |
| data-masker | 数据脱敏引擎 | 手机号/身份证脱敏 |
| output-verifier | 输出签名验签 | HMAC签名、防篡改 |

### L3 - 网关层

| Skill | 名称 | 功能 |
|-------|------|------|
| ass-gateway | ASS 安全网关 | 安全检测、注入防护 |

### L7 - 存证层

| Skill | 名称 | 功能 |
|-------|------|------|
| hashchain-audit | HashChain 审计存证 | 不可变审计日志 |
| compliance-reporter | 合规报告生成 | 等保、GDPR报告 |

## 调用方式

### 通用接口

\`\`\`bash
POST /api/v1/skills/call
\`\`\`

\`\`\`json
{
  "skill_id": "ass-gateway",
  "action": "inspect",
  "params": {"input": "<script>alert(1)</script>"}
}
\`\`\`

### 动态接口

\`\`\`bash
POST /api/v1/skills/{skill_id}/{action}
\`\`\`

\`\`\`json
{"data": "13812345678", "type": "phone"}
\`\`\`

## 示例

### 安全检测

\`\`\`python
import requests

resp = requests.post(
    'http://localhost:9092/api/v1/skills/call',
    json={
        'skill_id': 'ass-gateway',
        'action': 'inspect',
        'params': {'input': '<script>alert(1)</script>'}
    }
)

# 结果: {"safe": false, "risks": ["<script>"], "level": "high"}
\`\`\`

### 数据脱敏

\`\`\`python
resp = requests.post(
    'http://localhost:9092/api/v1/skills/data-masker/mask',
    json={'data': '13812345678', 'type': 'phone'}
)

# 结果: {"masked": "138****5678"}
\`\`\`

### 代码检测

\`\`\`python
resp = requests.post(
    'http://localhost:9092/api/v1/skills/code-detector/analyze',
    json={'code': 'eval(input())'}
)

# 结果: {"risk_level": "high", "risks": ["eval"]}
\`\`\`

## 对外开放

### 生产环境配置

1. 启用认证：\`require_auth = True\`
2. 生成 API Key：\`POST /api/v1/keys/generate\`
3. 使用 HTTPS + Nginx 反向代理

### Nginx 配置

\`\`\`nginx
server {
    listen 443 ssl;
    server_name api.yijiandaodi.com;

    location /api/ {
        proxy_pass http://127.0.0.1:9092;
    }
}
\`\`\`

## 安全特性

- ✓ 审计存证（每次调用生成 audit_hash）
- ✓ 风险检测（自动识别危险模式）
- ✓ 数据脱敏（PII 敏感信息保护）
- ✓ 签名验签（HMAC-SHA256）
      `
    }
  }

  return (
    <div className="docs-page">
      <div className="docs-header">
        <a href="/" className="logo">
          <img src="/logo.png" alt="一鉴到底" />
          <span>一鉴到底</span>
        </a>
        <nav>
          <a href="/">首页</a>
          <a href="/docs" className="active">文档</a>
          <a href="/download">下载</a>
        </nav>
      </div>

      <div className="docs-container">
        <aside className="docs-sidebar">
          {Object.entries(sections).map(([key, value]) => (
            <button
              key={key}
              className={`nav-item ${section === key ? 'active' : ''}`}
              onClick={() => setSection(key)}
            >
              {value.title}
            </button>
          ))}
        </aside>

        <main className="docs-content">
          <article className="markdown">
            <pre>{sections[section].content}</pre>
          </article>
        </main>
      </div>

      <footer className="docs-footer">
        <p>© 2026 一鉴到底 版权所有 · 公司地址：湖南省湘潭市</p>
        <div className="icp-info">
          <a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">湘ICP备2025151710号-3</a>
          <span className="divider">|</span>
          <a href="https://beian.mps.gov.cn/#/query/webSearch?code=43030402000431" target="_blank" rel="noreferrer">湘公网安备43030402000431号</a>
        </div>
      </footer>
    </div>
  )
}