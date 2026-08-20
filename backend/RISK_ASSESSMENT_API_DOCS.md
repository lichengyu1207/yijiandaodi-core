# 风险评估和告警API文档

## 概述

风险评估API提供独立的风险评估和告警接口，方便其他服务调用。

**API基础URL**: `http://localhost:9092/api/risk-assessment/`

## 接口列表

### 1. 实时风险评估

**接口**: `POST /api/risk-assessment/assess/`

**功能**: 对单个活动日志进行实时风险评估

**请求示例**:
```json
{
  "activity_id": "act_5d8f384ecd5d44a0"
}
```

**响应示例**:
```json
{
  "success": true,
  "result": {
    "activity_id": "act_5d8f384ecd5d44a0",
    "overall_score": 95.0,
    "risk_level": "critical",
    "should_alert": true,
    "recommendations": [
      "⚠️ 发现严重安全风险，建议立即暂停Agent操作",
      "⚠️ 中信任级Agent，应用宽松风控策略"
    ],
    "agent_id": "agent_20260809220404_c7e5f62c89a6",
    "agent_name": "E2ETest_Unauthorized",
    "agent_trust_level": "medium",
    "alert_threshold": 59.5,
    "critical_threshold": 76.5,
    "permission_bonus": 30.0
  }
}
```

**字段说明**:
- `overall_score`: 综合风险分数（0-100）
- `risk_level`: 风险等级（safe/warning/danger/critical）
- `should_alert`: 是否触发告警
- `recommendations`: 建议列表
- `agent_id`: Agent ID
- `agent_name`: Agent名称
- `agent_trust_level`: Agent信任级别
- `alert_threshold`: 调整后的告警阈值
- `critical_threshold`: 调整后的严重阈值
- `permission_bonus`: 权限风险加成

---

### 2. 批量风险评估

**接口**: `POST /api/risk-assessment/assess-batch/`

**功能**: 批量评估多个活动日志的风险

**请求示例**:
```json
{
  "activity_ids": [
    "act_5d8f384ecd5d44a0",
    "act_abc123def456"
  ]
}
```

**响应示例**:
```json
{
  "success": true,
  "results": [
    {
      "activity_id": "act_5d8f384ecd5d44a0",
      "overall_score": 95.0,
      "risk_level": "critical",
      "should_alert": true,
      ...
    }
  ],
  "total_count": 2,
  "alert_count": 1
}
```

---

### 3. 手动触发告警

**接口**: `POST /api/risk-assessment/alerts/trigger/`

**功能**: 手动触发告警（支持强制触发）

**请求示例**:
```json
{
  "activity_id": "act_5d8f384ecd5d44a0",
  "force": false
}
```

**参数说明**:
- `activity_id`: 活动日志ID
- `force`: 是否强制触发（true: 忽略风险评估结果，直接触发告警）

**响应示例**:
```json
{
  "success": true,
  "alert": {
    "alert_id": "alert_act_5d8f384ecd5d44a0",
    "timestamp": "2026-08-09T22:04:08.123456Z",
    "session_id": "e2e_test_unauthorized",
    "client_id": "e2e_test_client",
    "agent": {
      "id": "agent_20260809220404_c7e5f62c89a6",
      "name": "E2ETest_Unauthorized",
      "type": "copilot",
      "trust_level": "medium"
    },
    "action": "file_operation",
    "target": "/etc/passwd",
    "source": "file",
    "risk_level": "critical",
    "overall_score": 95.0,
    "risk_score": 65,
    "recommendations": [...],
    "metadata": {...}
  }
}
```

---

### 4. 获取缓存统计

**接口**: `GET /api/risk-assessment/cache-stats/`

**功能**: 查询风险评估缓存的统计信息

**响应示例**:
```json
{
  "success": true,
  "cache_stats": {
    "total_sessions": 10,
    "total_activities": 150,
    "sessions": {
      "session_abc123": 15,
      "session_def456": 20
    }
  }
}
```

---

### 5. 清空缓存

**接口**: `POST /api/risk-assessment/clear-cache/`

**功能**: 清空风险评估缓存

**请求示例**:
```json
{
  "session_id": "session_abc123"
}
```

**参数说明**:
- `session_id`: 可选，不提供则清空所有缓存

**响应示例**:
```json
{
  "success": true,
  "message": "会话 session_abc123 缓存已清空"
}
```

---

## 风险评估逻辑

### 信任级别动态阈值

| 信任级别 | 阈值调整因子 | 告警阈值 | 严重阈值 |
|---------|-------------|---------|---------|
| critical | 1.2 | 84分 | 108分 |
| high | 1.0 | 70分 | 90分 |
| medium | 0.85 | 59.5分 | 76.5分 |
| low | 0.7 | 49分 | 63分 |

**逻辑说明**:
- **critical**: 阈值提高20%，对关键级Agent执行更严格的管控
- **high**: 标准阈值
- **medium**: 阈值降低15%，应用更宽松的策略
- **low**: 阈值降低30%，应用最宽松的策略

### 权限越权风险加成

当Agent执行的操作超出其权限范围时，自动增加风险分数：

| 越权类型 | 风险加成 |
|---------|---------|
| unauthorized_access | +30分 |
| permission_denied | +20分 |
| suspicious_behavior | +15分 |

---

## 使用示例

### Python调用示例

```python
import requests

# 1. 实时风险评估
response = requests.post(
    'http://localhost:9092/api/risk-assessment/assess/',
    json={'activity_id': 'act_xxx'}
)

result = response.json()
if result['success']:
    print(f"风险分数: {result['result']['overall_score']}")
    print(f"风险等级: {result['result']['risk_level']}")
    print(f"是否触发告警: {result['result']['should_alert']}")

# 2. 批量风险评估
response = requests.post(
    'http://localhost:9092/api/risk-assessment/assess-batch/',
    json={'activity_ids': ['act_xxx', 'act_yyy']}
)

# 3. 手动触发告警
response = requests.post(
    'http://localhost:9092/api/risk-assessment/alerts/trigger/',
    json={'activity_id': 'act_xxx', 'force': False}
)
```

### cURL调用示例

```bash
# 实时风险评估
curl -X POST http://localhost:9092/api/risk-assessment/assess/ \
  -H "Content-Type: application/json" \
  -d '{"activity_id": "act_xxx"}'

# 批量风险评估
curl -X POST http://localhost:9092/api/risk-assessment/assess-batch/ \
  -H "Content-Type: application/json" \
  -d '{"activity_ids": ["act_xxx", "act_yyy"]}'

# 手动触发告警
curl -X POST http://localhost:9092/api/risk-assessment/alerts/trigger/ \
  -H "Content-Type: application/json" \
  -d '{"activity_id": "act_xxx", "force": false}'
```

---

## 错误处理

**常见错误码**:
- `400 Bad Request`: 请求参数错误
- `404 Not Found`: 活动日志不存在
- `500 Internal Server Error`: 服务器内部错误

**错误响应示例**:
```json
{
  "success": false,
  "error": "Activity act_xxx 不存在"
}
```

---

## 集成建议

### 1. 与日志采集系统集成

在日志批量上报后，立即调用风险评估接口：

```python
# 批量上报活动日志
activities = [...]
response = requests.post('/api/agent-activities/batch/', json={'activities': activities})

# 对上报的活动进行风险评估
activity_ids = response.json()['created_activity_ids']
requests.post('/api/risk-assessment/assess-batch/', json={'activity_ids': activity_ids})
```

### 2. 与告警系统集成

根据风险评估结果决定是否触发告警：

```python
# 评估风险
result = requests.post('/api/risk-assessment/assess/', json={'activity_id': activity_id})

# 如果需要告警，推送到监控系统
if result.json()['result']['should_alert']:
    # 触发告警
    alert = requests.post('/api/risk-assessment/alerts/trigger/', json={'activity_id': activity_id})

    # 推送到监控系统（如Prometheus、ELK等）
    push_to_monitoring_system(alert.json()['alert'])
```

### 3. 与Agent认证系统集成

在Agent身份验证后，根据信任级别调整风控策略：

```python
# 验证Agent身份
agent = authenticate_agent(api_key)

# 根据信任级别获取阈值
trust_level = agent.trust_level
threshold_factor = RISK_THRESHOLDS[trust_level]

# 应用到风险评估
adjusted_threshold = BASE_THRESHOLD * threshold_factor
```

---

## 性能优化

### 缓存机制

风险评估服务使用内存缓存，避免频繁查询数据库：

- 每个session缓存最近100条活动
- 支持手动清空缓存
- 提供缓存统计接口

### 并发处理

- 支持批量评估，减少HTTP请求
- 建议批量大小：10-50个活动日志
- 最大支持50个活动日志的批量评估

---

## 测试

运行本地测试：

```bash
python test_risk_assessment_api.py --local
```

运行HTTP API测试（需要启动服务器）：

```bash
python test_risk_assessment_api.py
```