# 一鉴到底 Skill API 文档

## 概述

Skill API 提供了 14 个安全能力模块，支持**本地调用**和**对外开放**。

### 基础信息

- **服务地址**: `http://localhost:9092`
- **协议**: HTTP/JSON
- **认证**: 可选（API Key）

---

## API 端点

### 1. 列出所有 Skill

```http
GET /api/v1/skills
```

**响应示例**:
```json
{
  "success": true,
  "count": 14,
  "skills": [
    {
      "id": "ass-gateway",
      "name": "ASS 安全网关",
      "description": "安全检测、注入防护、XSS",
      "actions": ["inspect", "sanitize", "classify", "sign", "verify"],
      "tier": "L3"
    }
  ]
}
```

---

### 2. 获取 Skill 详情

```http
GET /api/v1/skills/{skill_id}
```

**响应示例**:
```json
{
  "success": true,
  "skill_id": "ass-gateway",
  "info": {
    "name": "ASS 安全网关",
    "description": "安全检测、注入防护、XSS",
    "actions": ["inspect", "sanitize", "classify", "sign", "verify"],
    "tier": "L3"
  }
}
```

---

### 3. 调用 Skill（通用接口）

```http
POST /api/v1/skills/call
Content-Type: application/json

{
  "skill_id": "ass-gateway",
  "action": "inspect",
  "params": {
    "input": "<script>alert(1)</script>"
  }
}
```

**响应示例**:
```json
{
  "success": true,
  "skill_id": "ass-gateway",
  "action": "inspect",
  "result": {
    "safe": false,
    "risks": ["<script>"],
    "level": "high"
  },
  "timestamp": "2026-07-21T22:36:57.159338",
  "audit_hash": "5b7149d4ad9c066083f47a5643a4f3c81456b736db8f501240446147ef34314a"
}
```

---

### 4. 动态调用 Skill

```http
POST /api/v1/skills/{skill_id}/{action}
Content-Type: application/json

{
  "data": "13812345678",
  "type": "phone"
}
```

**响应示例**:
```json
{
  "success": true,
  "skill_id": "data-masker",
  "action": "mask",
  "result": {
    "masked": "138****5678"
  },
  "timestamp": "2026-07-21T22:36:59.218360",
  "audit_hash": "452d50a6e5e24b679eaa2c592ae3448b9ad1a48784adb3e3bd9e9d7d8f4d3521"
}
```

---

## 可用 Skill 列表

### L1 - 基础层

| Skill ID | 名称 | Actions |
|----------|------|---------|
| `node-discovery` | 节点发现服务 | register, discover, health_check |
| `idle-detector` | 闲时检测服务 | check_idle, schedule_task, get_status |

### L2 - 分析层

| Skill ID | 名称 | Actions |
|----------|------|---------|
| `code-detector` | 代码风险检测 | analyze, scan, detect |
| `content-moderator` | 内容安全审核 | sanitize, classify, moderate |
| `data-masker` | 数据脱敏引擎 | mask, unmask, detect_pii |
| `output-verifier` | 输出签名验签 | sign, verify, generate_key |
| `dag-orchestrator` | DAG 工作流编排 | create_dag, execute, get_status |

### L3 - 网关层

| Skill ID | 名称 | Actions |
|----------|------|---------|
| `ass-gateway` | ASS 安全网关 | inspect, sanitize, classify, sign, verify |

### L4-L7 - 高级层

| Skill ID | 名称 | Actions | Tier |
|----------|------|---------|------|
| `eihm-router` | EIHM 成本路由 | estimate_cost, select_node, route | L4 |
| `p2p-scheduler` | P2P 任务调度器 | dispatch, get_status, cancel | L5 |
| `sandbox-executor` | Pyodide 沙箱执行 | execute, run_python, run_javascript | L6 |
| `hashchain-audit` | HashChain 审计存证 | record, verify, export, get_chain | L7 |
| `result-aggregator` | 结果聚合分发 | aggregate, vote, deduplicate | L7 |
| `compliance-reporter` | 合规报告生成 | generate, export, get_template | L7 |

---

## 使用示例

### Python

```python
import requests

BASE_URL = "http://localhost:9092"

# 1. 安全检测
resp = requests.post(
    f"{BASE_URL}/api/v1/skills/call",
    json={
        "skill_id": "ass-gateway",
        "action": "inspect",
        "params": {"input": "<script>alert(1)</script>"}
    }
)
print(resp.json())

# 2. 数据脱敏
resp = requests.post(
    f"{BASE_URL}/api/v1/skills/data-masker/mask",
    json={"data": "13812345678", "type": "phone"}
)
print(resp.json())

# 3. 代码检测
resp = requests.post(
    f"{BASE_URL}/api/v1/skills/code-detector/analyze",
    json={"code": "eval(input())"}
)
print(resp.json())
```

### JavaScript

```javascript
const BASE_URL = "http://localhost:9092";

// 调用 Skill
async function callSkill(skillId, action, params) {
  const resp = await fetch(`${BASE_URL}/api/v1/skills/call`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ skill_id: skillId, action, params })
  });
  return resp.json();
}

// 使用示例
const result = await callSkill('ass-gateway', 'inspect', {
  input: '<script>alert(1)</script>'
});
console.log(result);
```

### curl

```bash
# 列出所有 Skill
curl http://localhost:9092/api/v1/skills

# 调用安全检测
curl -X POST http://localhost:9092/api/v1/skills/call \
  -H "Content-Type: application/json" \
  -d '{"skill_id":"ass-gateway","action":"inspect","params":{"input":"<script>alert(1)</script>"}}'

# 动态调用数据脱敏
curl -X POST http://localhost:9092/api/v1/skills/data-masker/mask \
  -H "Content-Type: application/json" \
  -d '{"data":"13812345678","type":"phone"}'
```

---

## 对外开放配置

### 1. 本地使用

直接访问 `http://localhost:9092`，无需认证。

### 2. 生产环境

1. **启用认证**:
   ```python
   # sandbox_api.py
   require_auth = True
   ```

2. **生成 API Key**:
   ```bash
   curl -X POST http://localhost:9092/api/v1/keys/generate \
     -H "Content-Type: application/json" \
     -d '{"scopes": ["skills:*"], "rate_limit": 1000}'
   ```

3. **使用 API Key**:
   ```bash
   curl http://localhost:9092/api/v1/skills \
     -H "X-API-Key: yjd_1_xxxxx"
   ```

### 3. 外网暴露

使用 Nginx 反向代理：

```nginx
server {
    listen 443 ssl;
    server_name api.yijiandaodi.com;

    location /api/ {
        proxy_pass http://127.0.0.1:9092;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 安全特性

1. **审计存证**: 每次调用生成 `audit_hash`
2. **风险检测**: 自动识别危险模式
3. **数据脱敏**: PII 敏感信息保护
4. **签名验签**: HMAC-SHA256 防篡改
5. **并发控制**: API Key 级别限流

---

## 错误处理

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 参数错误 |
| 401 | 认证失败 |
| 404 | Skill 不存在 |
| 500 | 服务器错误 |

错误响应示例:
```json
{
  "success": false,
  "error": "Skill not found: unknown-skill",
  "timestamp": "2026-07-21T22:36:57.159338"
}
```

---

## 更新日志

- **2026-07-21**: 发布 Skill API v1.0，支持 14 个 Skill 对外开放