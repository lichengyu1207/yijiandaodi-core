# Skill API 设计方案

**目标**: 让其他用户能够通过 API 接入平台的 skill

---

## 📋 设计目标

### 核心目标
1. ✅ 提供标准的 REST API
2. ✅ 安全的认证机制
3. ✅ 清晰的错误处理
4. ✅ 完整的文档和示例
5. ✅ 易于接入

---

## 🎯 API 设计规范

### 基础信息
```
API 基础路径: https://api.yijiandaodi.com/v1
协议: HTTPS
数据格式: JSON
编码: UTF-8
```

### 认证方式
```
方式: Bearer Token (API Key)
Header: Authorization: Bearer sk-xxxxxxxxxxxx
```

---

## 📚 核心 API 接口设计

### 1. 代码安全检测 (code-detector)

#### 接口信息
```
POST /v1/skills/code-detector/analyze
```

#### 请求参数
```json
{
  "code": "string",           // 必填：要检测的代码
  "language": "string",       // 可选：编程语言 (python/javascript/typescript/bash/html)
  "options": {
    "checkSyntax": true,      // 是否检查语法
    "checkSecurity": true,    // 是否检查安全
    "checkStyle": false       // 是否检查风格
  }
}
```

#### 响应结果
```json
{
  "success": true,
  "data": {
    "safe": false,
    "risk_level": "high",
    "language": "javascript",
    "risks": [
      {
        "type": "code_injection",
        "pattern": "eval(",
        "line": 1,
        "column": 1,
        "severity": "high",
        "description": "动态代码执行可能导致注入攻击"
      }
    ],
    "analysis": {
      "line_count": 10,
      "complexity": "low",
      "imports": []
    }
  },
  "metadata": {
    "timestamp": "2026-08-01T12:00:00Z",
    "version": "1.0.0"
  }
}
```

---

### 2. 内容审核 (content-moderator)

#### 接口信息
```
POST /v1/skills/content-moderator/check
```

#### 请求参数
```json
{
  "content": "string",        // 必填：要审核的内容
  "options": {
    "checkSensitiveWords": true,
    "checkPII": true,
    "checkXSS": true,
    "checkSQLInjection": true
  }
}
```

#### 响应结果
```json
{
  "success": true,
  "data": {
    "safe": false,
    "risk_level": "medium",
    "content_type": "text",
    "sensitive_words": [
      {
        "word": "password",
        "position": [10, 18],
        "severity": "medium"
      }
    ],
    "pii_detected": [
      {
        "type": "email",
        "value": "user@example.com",
        "position": [20, 36]
      }
    ],
    "sanitized_content": "密码是 ********，邮箱是 ***@example.com"
  }
}
```

---

### 3. 沙箱执行 (sandbox-executor)

#### 接口信息
```
POST /v1/skills/sandbox-executor/run
```

#### 请求参数
```json
{
  "code": "string",           // 必填：要执行的代码
  "language": "string",       // 必填：编程语言
  "timeout": 5000,            // 可选：超时时间（毫秒）
  "env": {                    // 可选：环境变量
    "DEBUG": "true"
  }
}
```

#### 响应结果
```json
{
  "success": true,
  "data": {
    "output": "Hello, World!",
    "exit_code": 0,
    "execution_time": 123,
    "memory_used": 1024,
    "status": "success"
  }
}
```

---

### 4. 安全网关 (ass-gateway)

#### 接口信息
```
POST /v1/skills/ass-gateway/inspect
```

#### 请求参数
```json
{
  "input": "string",
  "operation": "inspect" | "sanitize" | "classify" | "sign" | "verify"
}
```

#### 响应结果
```json
{
  "success": true,
  "data": {
    "safe": true,
    "classification": "public",
    "sanitized": "...",
    "signature": "..."
  }
}
```

---

## 🔐 认证与授权

### API Key 管理

#### 获取 API Key
```
POST /v1/auth/api-keys
```

#### 请求参数
```json
{
  "name": "my-app",
  "permissions": ["code-detector", "content-moderator"],
  "expires_at": "2026-12-31"
}
```

#### 响应结果
```json
{
  "success": true,
  "data": {
    "api_key": "sk-proj-xxxxxxxxxxxx",
    "name": "my-app",
    "permissions": ["code-detector", "content-moderator"],
    "created_at": "2026-08-01T12:00:00Z",
    "expires_at": "2026-12-31T23:59:59Z"
  }
}
```

---

### 权限控制

#### 权限级别
```
- read: 只读访问
- write: 写入权限
- admin: 管理权限
```

#### 权限范围
```
- code-detector: 代码检测
- content-moderator: 内容审核
- sandbox-executor: 沙箱执行
- ass-gateway: 安全网关
- compliance-reporter: 合规报告
- hashchain-audit: 审计存证
```

---

## 🚦 错误处理

### 错误响应格式
```json
{
  "success": false,
  "error": {
    "code": "INVALID_API_KEY",
    "message": "API Key 无效或已过期",
    "details": {
      "field": "Authorization",
      "hint": "请检查 API Key 是否正确"
    }
  },
  "request_id": "req-xxxxxxxx"
}
```

### 错误码定义

| 错误码 | HTTP状态 | 说明 |
|--------|---------|------|
| INVALID_API_KEY | 401 | API Key 无效 |
| PERMISSION_DENIED | 403 | 权限不足 |
| RESOURCE_NOT_FOUND | 404 | 资源不存在 |
| RATE_LIMIT_EXCEEDED | 429 | 超过频率限制 |
| INTERNAL_ERROR | 500 | 服务器内部错误 |
| SERVICE_UNAVAILABLE | 503 | 服务不可用 |

---

## 📊 频率限制

### 默认限制
```
- 免费用户: 100 次/小时
- 基础用户: 1000 次/小时
- 高级用户: 10000 次/小时
- 企业用户: 无限制
```

### 响应头
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1627776000
```

---

## 📖 API 文档结构

### 文档目录
```
docs/
├── getting-started.md        # 快速开始
├── authentication.md         # 认证说明
├── api-reference/            # API 参考
│   ├── code-detector.md
│   ├── content-moderator.md
│   ├── sandbox-executor.md
│   └── ...
├── sdk/                      # SDK 文档
│   ├── javascript.md
│   ├── python.md
│   └── go.md
├── examples/                 # 示例代码
│   ├── javascript/
│   ├── python/
│   └── curl/
└── changelog.md              # 更新日志
```

---

## 💻 SDK 实现

### JavaScript SDK

```typescript
// @yijiandaodi/skill-client

import axios from 'axios'

interface SkillClientConfig {
  apiKey: string
  baseURL?: string
  timeout?: number
}

export class SkillClient {
  private client: axios.AxiosInstance

  constructor(config: SkillClientConfig) {
    this.client = axios.create({
      baseURL: config.baseURL || 'https://api.yijiandaodi.com/v1',
      timeout: config.timeout || 30000,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      }
    })
  }

  // 代码检测
  async analyzeCode(code: string, options?: any) {
    const response = await this.client.post('/skills/code-detector/analyze', {
      code,
      ...options
    })
    return response.data
  }

  // 内容审核
  async checkContent(content: string, options?: any) {
    const response = await this.client.post('/skills/content-moderator/check', {
      content,
      ...options
    })
    return response.data
  }

  // 沙箱执行
  async runInSandbox(code: string, language: string, options?: any) {
    const response = await this.client.post('/skills/sandbox-executor/run', {
      code,
      language,
      ...options
    })
    return response.data
  }
}

// 使用示例
const client = new SkillClient({ apiKey: 'sk-xxx' })

const result = await client.analyzeCode('eval(userInput)')
console.log(result)
// { safe: false, risk_level: 'high', ... }
```

---

## 🚀 实施步骤

### 阶段1: 基础 API 开发（1-2 周）

```
✅ 设计 API 接口
✅ 实现认证机制
✅ 开发核心 skill API:
   - code-detector
   - content-moderator
   - sandbox-executor
✅ 实现错误处理
✅ 实现频率限制
```

### 阶段2: 文档和示例（1 周）

```
✅ 编写 API 文档
✅ 创建示例代码
✅ 编写快速开始指南
✅ 创建 Postman 集合
```

### 阶段3: SDK 开发（1-2 周）

```
✅ JavaScript SDK
✅ Python SDK
✅ SDK 文档
✅ 单元测试
```

### 阶段4: 测试和上线（1 周）

```
✅ API 测试
✅ 性能测试
✅ 安全测试
✅ 灰度发布
✅ 正式上线
```

---

## 📝 技术选型建议

### 后端框架
```
推荐:
- Node.js + Express/Fastify
- Python + FastAPI
- Go + Gin

理由:
- 易于开发和维护
- 社区活跃
- 性能良好
```

### 数据库
```
推荐:
- PostgreSQL (关系型)
- Redis (缓存)
- MongoDB (日志)

理由:
- 成熟稳定
- 性能良好
- 功能丰富
```

### 认证
```
推荐:
- JWT
- OAuth 2.0

理由:
- 标准化
- 安全性高
- 易于集成
```

---

## 📞 后续支持

### 用户支持
```
✅ 技术文档
✅ API 参考
✅ 示例代码
✅ 常见问题
✅ 技术支持邮箱
```

### 监控和分析
```
✅ API 调用统计
✅ 错误监控
✅ 性能监控
✅ 用户反馈收集
```

---

**一句话总结**: **提供标准化 REST API + SDK，让用户能够轻松接入你的 skill！**