# 一鉴到底 - Agent 数据流 API 文档

## 概述

整合 Python SDK 到 Django 后端，提供完整的数据流 API，支持：
- Agent 执行（分析、执行、验证、报告）
- 工具调用（文件操作、搜索、命令执行）
- 记忆系统（存储、检索、上下文）
- 数据同步（插件 ↔ 后端）

---

## API 端点

### 1. Agent 数据流 API

**端点**: `POST /api/auth/agent/flow/`

**请求体**:
```json
{
    "action": "analyze",           // analyze | execute | verify | report
    "agent_type": "auditor",       // auditor | verifier | archiver | judge | detector | grok-build | explore | plan
    "session_id": "xxx",           // 可选，会话ID
    "content": "用户输入内容",      // 用户消息
    "operations": [...],           // 操作记录（来自插件）
    "context": {...}               // 额外上下文
}
```

**响应**:
```json
{
    "success": true,
    "data": {
        "response": "AI 回复内容",
        "agent": "auditor",
        "session_id": "xxx"
    },
    "error": null,
    "timestamp": "2024-01-01T00:00:00"
}
```

---

### 2. 分析操作 (analyze)

**请求示例**:
```json
{
    "action": "analyze",
    "agent_type": "auditor",
    "content": "分析我的创作过程",
    "operations": [
        {"type": "PAGE_LOAD", "data": {"url": "https://deepseek.com"}},
        {"type": "AI_PROMPT", "data": {"preview": "帮我写一个登录页面"}}
    ]
}
```

**响应**:
```json
{
    "success": true,
    "data": {
        "response": "根据您的操作记录分析...",
        "agent": "auditor"
    }
}
```

---

### 3. 执行工具 (execute)

**请求示例**:
```json
{
    "action": "execute",
    "context": {
        "tool": "read_file",
        "params": {
            "path": "/path/to/file.py"
        }
    }
}
```

**可用工具**:
- `read_file` - 读取文件
- `list_dir` - 列出目录
- `grep` - 搜索内容
- `run_terminal_command` - 执行命令（受限）
- `web_search` - 网络搜索
- `web_fetch` - 获取网页
- `todo_write` - 任务管理

---

### 4. 验证原创性 (verify)

**请求示例**:
```json
{
    "action": "verify",
    "agent_type": "verifier",
    "operations": [
        {"type": "PAGE_LOAD", "data": {...}},
        {"type": "AI_PROMPT", "data": {...}},
        {"type": "AI_RESPONSE", "data": {...}}
    ]
}
```

**响应**:
```json
{
    "success": true,
    "data": {
        "record_id": "uuid",
        "verification_hash": "sha256...",
        "ai_analysis": "原创性评分：85分...",
        "operations_count": 10
    }
}
```

---

### 5. 生成报告 (report)

**请求示例**:
```json
{
    "action": "report",
    "session_id": "xxx"
}
```

**响应**:
```json
{
    "success": true,
    "data": {
        "user": "username",
        "generated_at": "2024-01-01T00:00:00",
        "verification_records": [...],
        "memory_count": 20,
        "total_operations": 50
    }
}
```

---

### 6. 数据同步 API

**端点**: `POST /api/auth/agent/sync/`

**请求体**:
```json
{
    "operations": [...],           // 插件录制的操作
    "session_id": "xxx",           // 会话ID
    "platform": "deepseek",        // 平台标识
    "timestamp": "2024-01-01..."   // 时间戳
}
```

**响应**:
```json
{
    "success": true,
    "message": "Synced 10 operations",
    "data": {
        "saved_count": 10,
        "session_id": "xxx"
    }
}
```

---

### 7. Agent 对话 API

**端点**: `POST /api/auth/agent/chat/`

**请求体**:
```json
{
    "message": "用户消息",
    "agent_type": "auditor",
    "stream": false
}
```

**响应**:
```json
{
    "success": true,
    "data": {
        "response": "AI 回复内容",
        "agent": "auditor"
    }
}
```

---

### 8. 工具 API

**获取工具列表**: `GET /api/auth/agent/tools/`

**执行工具**: `POST /api/auth/agent/tools/`
```json
{
    "tool": "read_file",
    "params": {
        "path": "/path/to/file"
    }
}
```

---

### 9. 记忆 API

**获取记忆列表**: `GET /api/auth/agent/memory/`

**保存记忆**: `POST /api/auth/agent/memory/`
```json
{
    "content": "记忆内容",
    "metadata": {"type": "context"}
}
```

**搜索记忆**: `GET /api/auth/agent/memory/search/?q=keyword`

**删除记忆**: `DELETE /api/auth/agent/memory/?id=xxx`

---

## 数据流架构

```
┌─────────────────────────────────────────────────────────────┐
│                        浏览器插件                            │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐   │
│  │录制控制 │  │操作捕获 │  │AI对话   │  │证据生成     │   │
│  └────┬────┘  └────┬────┘  └────┬────┘  └──────┬──────┘   │
└───────┼────────────┼────────────┼──────────────┼──────────┘
        │            │            │              │
        ▼            ▼            ▼              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Django 后端 API                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                 Agent 数据流 API                      │   │
│  │  /api/auth/agent/flow/                                │   │
│  │  ├── analyze  → AI 分析                               │   │
│  │  ├── execute  → 工具执行                              │   │
│  │  ├── verify   → 原创性验证                            │   │
│  │  └── report   → 报告生成                              │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐  │
│  │ Grok Tools     │  │ Grok Memory    │  │ DeepSeek AI  │  │
│  │ - read_file    │  │ - save()       │  │ - chat()     │  │
│  │ - list_dir     │  │ - search()     │  │ - analyze()  │  │
│  │ - grep         │  │ - list_all()   │  │ - verify()   │  │
│  │ - bash         │  │ - delete()     │  │              │  │
│  └────────────────┘  └────────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 插件集成示例

### 1. 同步操作记录

```javascript
// 浏览器插件中
async function syncOperations(operations) {
    const response = await fetch('https://yijiandaodi.com/api/auth/agent/sync/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            operations: operations,
            session_id: currentSessionId,
            platform: 'deepseek'
        })
    });
    return response.json();
}
```

### 2. 调用 AI 分析

```javascript
async function analyzeWithAgent(operations, userMessage) {
    const response = await fetch('https://yijiandaodi.com/api/auth/agent/flow/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            action: 'analyze',
            agent_type: 'auditor',
            operations: operations,
            content: userMessage
        })
    });
    return response.json();
}
```

### 3. 验证原创性

```javascript
async function verifyOriginality(operations) {
    const response = await fetch('https://yijiandaodi.com/api/auth/agent/flow/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            action: 'verify',
            agent_type: 'verifier',
            operations: operations
        })
    });
    return response.json();
}
```

---

## Agent 类型说明

| Agent | 代码 | 用途 |
|-------|------|------|
| 审计官 | auditor | 分析操作记录，审计创作流程 |
| 验证官 | verifier | 验证原创性，生成证据链 |
| 存证官 | archiver | 归档证据，生成证书 |
| 裁决官 | judge | 判定版权纠纷，提供法律依据 |
| 检测官 | detector | 检测侵权内容，监控风险 |
| 构建官 | grok-build | AI代码构建，项目开发 |
| 探索官 | explore | 代码库探索，技术分析 |
| 规划官 | plan | 项目规划，任务分解 |

---

## 安全说明

1. **认证**: 所有 API 需要 JWT Token 认证
2. **工具限制**: Bash 工具仅允许白名单命令
3. **数据隔离**: 记忆系统按用户 ID 隔离
4. **哈希验证**: 操作记录使用 SHA256 哈希保证不可篡改

---

## 版本

- API Version: 1.0.0
- Updated: 2024-01-01
- Author: 一鉴到底团队