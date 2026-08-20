# 统一 Skill API 网关设计

**目标**: 让网站上的所有 skill（包括 /yijiandaodi-skill）都能对外提供 API

---

## 🎯 核心架构

### 架构图
```
用户应用
    ↓
Skill API 网关 (https://api.yijiandaodi.com)
    ↓
├── /yijiandaodi-skill/
│   ├── code-detector
│   ├── content-moderator
│   ├── sandbox-executor
│   └── ...
│
├── /other-skill/
│   ├── skill-1
│   └── skill-2
│
└── /@lichengyu1207/yijiandaodi-security-core/
    ├── ass-gateway
    ├── hashchain-audit
    └── ...
```

---

## 📋 统一 API 规范

### 基础路径
```
https://api.yijiandaodi.com/v1/skills/{skill-path}/{action}
```

### 示例
```
POST https://api.yijiandaodi.com/v1/skills/yijiandaodi-skill/code-detector/analyze
POST https://api.yijiandaodi.com/v1/skills/yijiandaodi-skill/content-moderator/check
POST https://api.yijiandaodi.com/v1/skills/yijiandaodi-skill/sandbox-executor/run
```

---

## 🔧 Skill 网关实现

### 1. Skill 注册中心

```javascript
/**
 * Skill 注册中心
 * 管理所有可用的 skill
 */

class SkillRegistry {
  constructor() {
    this.skills = new Map()
  }

  /**
   * 注册 skill
   */
  register(skillPath, skillConfig) {
    this.skills.set(skillPath, {
      path: skillPath,
      name: skillConfig.name,
      version: skillConfig.version,
      description: skillConfig.description,
      actions: skillConfig.actions,
      handler: skillConfig.handler
    })
  }

  /**
   * 获取 skill
   */
  get(skillPath) {
    return this.skills.get(skillPath)
  }

  /**
   * 列出所有 skill
   */
  list() {
    return Array.from(this.skills.values())
  }

  /**
   * 检查权限
   */
  hasPermission(skillPath, apiKey, action) {
    const skill = this.skills.get(skillPath)
    if (!skill) return false

    // 检查 API Key 是否有权限访问该 skill
    // 实际应该查询数据库
    return true
  }
}

// 创建全局注册中心
const registry = new SkillRegistry()

// ============================================================================
// 注册所有 skill
// ============================================================================

// 注册 yijiandaodi-skill 下的所有 skill
registry.register('yijiandaodi-skill/code-detector', {
  name: '代码安全检测',
  version: '1.0.0',
  description: '检测代码中的安全风险',
  actions: ['analyze', 'batch-analyze'],
  handler: require('./skills/yijiandaodi-skill/code-detector')
})

registry.register('yijiandaodi-skill/content-moderator', {
  name: '内容审核',
  version: '1.0.0',
  description: '审核内容中的敏感信息',
  actions: ['check', 'sanitize', 'classify'],
  handler: require('./skills/yijiandaodi-skill/content-moderator')
})

registry.register('yijiandaodi-skill/sandbox-executor', {
  name: '沙箱执行',
  version: '1.0.0',
  description: '在沙箱环境中执行代码',
  actions: ['run', 'execute', 'status'],
  handler: require('./skills/yijiandaodi-skill/sandbox-executor')
})

// 注册其他 skill
registry.register('yijiandaodi-skill/ass-gateway', {
  name: '安全网关',
  version: '1.0.0',
  description: '零信任安全网关',
  actions: ['inspect', 'sanitize', 'classify', 'sign', 'verify'],
  handler: require('./skills/yijiandaodi-skill/ass-gateway')
})

registry.register('yijiandaodi-skill/hashchain-audit', {
  name: '审计存证',
  version: '1.0.0',
  description: '白盒审计存证',
  actions: ['record', 'query', 'verify'],
  handler: require('./skills/yijiandaodi-skill/hashchain-audit')
})

// 可以继续注册更多 skill...

module.exports = registry
```

---

### 2. 统一网关路由

```javascript
/**
 * Skill API 网关
 * 统一处理所有 skill 的 API 请求
 */

const express = require('express')
const registry = require('./skill-registry')

const router = express.Router()

/**
 * 列出所有可用的 skill
 * GET /v1/skills
 */
router.get('/', async (req, res) => {
  try {
    const skills = registry.list()

    res.json({
      success: true,
      data: skills.map(skill => ({
        path: skill.path,
        name: skill.name,
        version: skill.version,
        description: skill.description,
        actions: skill.actions
      }))
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message
      }
    })
  }
})

/**
 * 调用 skill
 * POST /v1/skills/:skillPath/:action
 */
router.post('/:skillPath/:action', async (req, res) => {
  try {
    const { skillPath, action } = req.params
    const fullSkillPath = skillPath + '/' + action

    // 获取 skill
    const skill = registry.get(fullSkillPath)

    if (!skill) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SKILL_NOT_FOUND',
          message: `Skill ${fullSkillPath} 不存在`
        }
      })
    }

    // 检查权限
    const apiKey = req.headers['authorization']?.replace('Bearer ', '')
    if (!registry.hasPermission(fullSkillPath, apiKey, action)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'PERMISSION_DENIED',
          message: '没有权限访问该 skill'
        }
      })
    }

    // 调用 skill handler
    const result = await skill.handler(req.body, {
      action,
      user: req.user,
      apiKey
    })

    res.json({
      success: true,
      data: result,
      metadata: {
        skill: fullSkillPath,
        action,
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Skill 调用错误:', error)
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message
      }
    })
  }
})

module.exports = router
```

---

### 3. Skill Handler 示例

```javascript
/**
 * Skill Handler 实现示例
 */

// code-detector handler
module.exports = async function codeDetectorHandler(input, context) {
  const { code, language, options } = input

  // 实现检测逻辑
  const risks = []
  const dangerousPatterns = [
    { pattern: /eval\s*\(/g, type: 'code_injection', severity: 'high' },
    { pattern: /exec\s*\(/g, type: 'code_injection', severity: 'high' },
    { pattern: /__import__/g, type: 'code_injection', severity: 'high' }
  ]

  for (const { pattern, type, severity } of dangerousPatterns) {
    const matches = code.matchAll(pattern)
    for (const match of matches) {
      risks.push({
        type,
        pattern: match[0],
        line: code.substring(0, match.index).split('\n').length,
        severity
      })
    }
  }

  return {
    safe: risks.length === 0,
    risk_level: risks.length > 0 ? 'high' : 'low',
    language,
    risks,
    analysis: {
      line_count: code.split('\n').length,
      complexity: 'low'
    }
  }
}
```

---

## 📊 完整的 Skill API 列表

### yijiandaodi-skill 路径

| Skill | API 路径 | 方法 | 说明 |
|-------|---------|------|------|
| code-detector | `/v1/skills/yijiandaodi-skill/code-detector/analyze` | POST | 代码检测 |
| content-moderator | `/v1/skills/yijiandaodi-skill/content-moderator/check` | POST | 内容审核 |
| sandbox-executor | `/v1/skills/yijiandaodi-skill/sandbox-executor/run` | POST | 沙箱执行 |
| ass-gateway | `/v1/skills/yijiandaodi-skill/ass-gateway/inspect` | POST | 安全网关 |
| hashchain-audit | `/v1/skills/yijiandaodi-skill/hashchain-audit/record` | POST | 审计存证 |

---

## 🚀 部署架构

### 单体部署
```
api.yijiandaodi.com
    └── server.js (包含所有 skill)
```

### 微服务部署
```
api.yijiandaodi.com (网关)
    ├── code-detector-service
    ├── content-moderator-service
    ├── sandbox-executor-service
    └── ...
```

---

## 📖 API 文档生成

### 自动生成文档
```javascript
/**
 * 生成 API 文档
 */
function generateAPIDocs() {
  const skills = registry.list()

  return skills.map(skill => ({
    path: `/v1/skills/${skill.path}`,
    method: 'POST',
    description: skill.description,
    parameters: {
      body: {
        type: 'object',
        properties: skill.handler.parameters
      }
    },
    responses: {
      200: {
        description: '成功',
        schema: skill.handler.responseSchema
      }
    }
  }))
}
```

---

## 💡 用户接入指南

### 快速开始

```javascript
// 1. 获取 API Key
const apiKey = 'sk-your-api-key'

// 2. 调用任意 skill
const response = await fetch('https://api.yijiandaodi.com/v1/skills/yijiandaodi-skill/code-detector/analyze', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    code: 'eval(userInput)',
    language: 'javascript'
  })
})

const result = await response.json()
```

### SDK 使用

```javascript
import { SkillClient } from '@yijiandaodi/skill-client'

const client = new SkillClient({ apiKey: 'sk-xxx' })

// 调用任意 skill
const result = await client.call('yijiandaodi-skill/code-detector', 'analyze', {
  code: 'eval(userInput)',
  language: 'javascript'
})
```

---

## 🔐 权限管理

### API Key 权限配置
```javascript
{
  "api_key": "sk-xxx",
  "permissions": [
    "yijiandaodi-skill/code-detector",
    "yijiandaodi-skill/content-moderator",
    "yijiandaodi-skill/sandbox-executor"
  ],
  "rate_limit": 1000,
  "expires_at": "2026-12-31"
}
```

---

## 🎯 总结

**你的所有 skill 现在都可以通过统一的 API 对外提供！**

**API 格式**:
```
POST https://api.yijiandaodi.com/v1/skills/{skill-path}/{action}
```

**优势**:
- ✅ 统一管理所有 skill
- ✅ 标准化 API 接口
- ✅ 灵活的权限控制
- ✅ 易于扩展新 skill

---

**一句话总结**: **建立统一网关，让所有 skill 都能通过标准化 API 对外服务！**