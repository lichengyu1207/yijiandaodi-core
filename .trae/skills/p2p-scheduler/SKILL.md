---
name: "p2p-scheduler"
description: "P2P 任务调度器 Skill。当需要分发任务、管理节点心跳、处理任务状态机转换、调度分片到节点时调用。"
---

# P2P 任务调度器 (HeartbeatService + TaskStateMachine + TaskDispatcher)

## 概述
P2P 网络核心调度层，整合**心跳服务**、**任务状态机**和**任务分发**三大能力。负责节点生命周期管理、任务状态流转控制、以及从任务创建到结果提交的完整调度流程。

对应 Service:
- `HeartbeatService` (`backend/p2p_app/services/heartbeat_service.py`)
- `TaskStateMachine` (`backend/p2p_app/services/task_state_machine.py`)
- `TaskDispatchView` / `TaskCancelView` etc. (`backend/p2p_app/views.py`)

## API 端点总览

### 节点管理

#### POST `/api/p2p/v1/nodes/register`
注册新节点。

**请求体**:
```json
{
  "node_type": "desktop_windows",
  "capabilities": ["python", "code_execution", "text_processing"],
  "resources": { "cpu_cores": 8, "memory_gb": 16, "gpu_available": true },
  "location": "cn-east",
  "client_version": "1.0.0",
  "public_key_fingerprint": "SHA256:abc123..."
}
```

`node_type` 可选值: `browser` | `desktop_windows` | `desktop_mac` | `mobile` | `enterprise` | `self_hosted`

**响应 (HTTP 201)**:
```json
{
  "node_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "node_type": "desktop_windows",
  "status": "online",
  "created_at": "2024-06-07T10:00:00",
  "platform_certificate": "YJD-CERT-A1B2C3D4E5F6G7H8"
}
```

#### GET `/api/p2p/v1/nodes`
获取节点列表（支持分页和筛选）。

**查询参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| status | string | online/offline/busy/maintenance/banned |
| node_type | string | 节点类型筛选 |
| location | string | 地域模糊匹配 |
| min_reputation | float | 最低信誉分 |
| page | int | 页码(默认1) |
| size | int | 每页数量(默认20，最大100) |

#### GET `/api/p2p/v1/nodes/{node_id}`
获取单个节点详情（含信誉信息）。

**响应**:
```json
{
  "success": true,
  "data": {
    "node_id": "...",
    "node_type": "desktop_windows",
    "capabilities": ["python", "code_execution"],
    "resources": { "cpu_cores": 8, "memory_gb": 16 },
    "location": "cn-east",
    "status": "online",
    "last_heartbeat": "2024-06-07T10:05:00",
    "reputation_score": 95.5,
    "total_tasks_completed": 128,
    "total_compute_hours": 256.5,
    "created_at": "2024-01-01T00:00:00"
  }
}
```

#### PUT `/api/p2p/v1/nodes/{node_id}/heartbeat`
节点心跳上报。

**请求体** (HeartbeatSerializer):
```json
{
  "timestamp": "2024-06-07T10:05:00",
  "metrics": {
    "cpu_usage": 35.5,
    "memory_usage": 60.0,
    "gpu_usage": null,
    "disk_io_usage": 12.3,
    "network_bandwidth_usage": 5.0
  },
  "active_tasks": ["TASK-001", "TASK-002"]
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "server_time": "2024-06-07T10:05:01",
    "pending_tasks": [
      {
        "shard_id": "TASK-XXX-SHARD-0003",
        "task_id": "TASK-XXX",
        "sequence": 3,
        "required_capabilities": ["python"]
      }
    ],
    "next_heartbeat_in_seconds": 10,
    "idle_state": "PARTIAL_BUSY"
  }
}
```

心跳内部处理流程:
1. 校验节点存在性及封禁状态
2. 调用 `IdleDetectionService.evaluate_idle_state()` 评估空闲状态
3. 创建 NodeHeartbeat 记录
4. 检测资源异常(CPU≥95%/内存≥95%/GPU≥98%)
5. 更新节点状态(online/busy)与信誉评分(+0.1正常/-1.0异常)
6. 返回待领取任务列表

#### DELETE `/api/p2p/v1/nodes/{node_id}/offline`
节点主动下线。

**请求体** (可选):
```json
{ "reason": "用户主动下线" }
```

**响应**:
```json
{ "success": true, "data": { "ack": true, "status": "offline" } }
```

#### GET `/api/p2p/v1/nodes/{node_id}/reputation`
查询节点信誉详情。

**响应**:
```json
{
  "success": true,
  "data": {
    "score": 95.5,
    "success_rate": 0.98,
    "avg_response_time_ms": 150,
    "malicious_flags": 0,
    "rank": "S"   // S(≥95) A(≥85) B(≥70) C(≥60) D(≥30) F(<30)
  }
}
```

### 任务管理

#### POST `/api/p2p/v1/tasks/dispatch`
分发任务（创建 TaskDispatch + TaskShards）。详见 eihm-router SKILL。

#### GET `/api/p2p/v1/tasks/{task_id}`
查询任务详情（含所有分片）。

#### GET `/api/p2p/v1/tasks/{task_id}/status`
查询任务进度（轻量级）。

**响应**:
```json
{
  "success": true,
  "data": {
    "task_id": "TASK-XXX",
    "status": "executing",
    "progress": { "completed": 3, "total": 5, "percentage": 60.0 }
  }
}
```

#### POST `/api/p2p/v1/tasks/{task_id}/cancel`
取消任务。

**请求体**: `{ "reason": "用户取消" }`

**响应**:
```json
{ "success": true, "data": { "ack": true, "status": "aborted", "task_id": "TASK-XXX" } }
```
> 注意：已完成/已失败/已取消的任务无法再次取消。

#### GET `/api/p2p/v1/tasks/{task_id}/transitions`
查询任务当前状态及合法的状态转换目标。

**响应**:
```json
{
  "success": true,
  "data": {
    "task_id": "TASK-XXX",
    "current_state": "executing",
    "valid_transitions": ["aggregating", "failed", "aborted"],
    "all_transitions": {
      "created": ["sharding", "aborted"],
      "sharding": ["dispatching", "failed", "aborted"],
      "dispatching": ["executing", "failed", "aborted"],
      "executing": ["aggregating", "failed", "aborted"],
      "aggregating": ["verifying", "failed"],
      "verifying": ["completed", "failed"],
      "completed": [],
      "failed": ["dispatching"],
      "aborted": []
    }
  }
}
```

#### GET `/api/p2p/v1/tasks`
任务列表（分页）。

**查询参数**: status, task_type, priority, page, size

#### POST `/api/p2p/v1/tasks/{task_id}/shards/{shard_id}/result`
提交分片执行结果。详见 sandbox-executor SKILL。

### 节点发现

#### POST `/api/p2p/v1/nodes/discover`
按条件发现匹配节点。

**请求体**:
```json
{
  "node_type": "desktop_windows",
  "required_capabilities": ["python", "code_execution"],
  "min_resources": { "cpu_cores": 4, "memory_gb": 8 },
  "location": "cn-east",
  "min_reputation": 80.0,
  "max_results": 20
}
```

**响应**:
```json
{ "success": true, "data": [...], "count": 5 }
```

#### GET `/api/p2p/v1/network/topology`
获取网络拓扑概览。

**响应**:
```json
{
  "success": true,
  "data": {
    "total_nodes": 50,
    "online_count": 35,
    "offline_count": 10,
    "busy_count": 5,
    "by_type": { "desktop_windows": 20, "browser": 15, ... },
    "by_location": { "cn-east": 25, "us-west": 10, ... },
    "avg_reputation": 82.5,
    "total_compute_hours": 1024.5
  }
}
```

## 任务状态机 (TaskStateMachine)

完整状态流转图:

```
created → sharding → dispatching → executing → aggregating → verifying → completed
   ↓         ↓           ↓            ↓           ↓          ↓
 aborted   aborted     aborted      aborted     failed    failed
                        failed       failed
                                     (可重试→dispatching)
```

**合法状态转换表 (VALID_TRANSITIONS)**:

| 当前状态 | 可转换到 |
|---------|---------|
| created | sharding, **aborted** |
| sharding | dispatching, failed, **aborted** |
| dispatching | executing, failed, **aborted** |
| executing | aggregating, failed, **aborted** |
| aggregating | verifying, failed |
| verifying | **completed**, failed |
| **completed** | — (终态) |
| failed | dispatching (重试) |
| **aborted** | — (终态) |

## 心跳服务参数

| 参数 | 值 | 说明 |
|------|-----|------|
| HEARTBEAT_INTERVAL | 10s | 建议心跳间隔 |
| TIMEOUT_THRESHOLD | 30s | 超时判定阈值 |
| 正常心跳信誉加成 | +0.1/次 | REPUTATION_BONUS_PER_HEARTBEAT |
| 异常心跳信誉扣分 | -1.0/次 | REPUTATION_ANOMALY_PENALTY |
| 离线信誉扣分 | -5.0/次 | REPUTATION_PENALTY_OFFLINE |
| 信誉范围 | [0, 150] | REPUTATION_MIN ~ REPUTATION_MAX |
| CPU过载阈值 | ≥95% | ANOMALY_THRESHOLDS |
| 内存过载阈值 | ≥95% | ANOMALY_THRESHOLDS |
| GPU过载阈值 | ≥98% | ANOMALY_THRESHOLDS |

## Python SDK 示例

```python
import requests

BASE = "http://localhost:8000/api/p2p/v1"

# ── 注册节点 ──
reg = requests.post(f"{BASE}/nodes/register", json={
    "node_type": "self_hosted",
    "capabilities": ["python", "text_processing"],
    "resources": {"cpu_cores": 4, "memory_gb": 8},
}).json()
node_id = reg["node_id"]
print(f"节点注册成功: {node_id}")

# ── 上报心跳 ──
hb = requests.put(f"{BASE}/nodes/{node_id}/heartbeat", json={
    "metrics": {"cpu_usage": 20.0, "memory_usage": 45.0, "disk_io_usage": 5.0, "network_bandwidth_usage": 2.0},
    "active_tasks": [],
}).json()
print(f"心跳状态: {hb['data']['status']}, 空闲: {hb['data']['idle_state']}")
print(f"待领取任务: {len(hb['data']['pending_tasks'])} 个")

# ── 发现节点 ──
nodes = requests.post(f"{BASE}/nodes/discover", json={
    "required_capabilities": ["python"],
    "min_reputation": 70.0,
}).json()
for n in nodes["data"]:
    print(f"  节点 {n['node_id']} ({n['node_type']}) 信誉={n.get('reputation_score', 'N/A')}")

# ── 查询任务状态机 ──
trans = requests.get(f"{BASE}/tasks/TASK-XXX/transitions").json()
print(f"当前状态: {trans['data']['current_state']}")
print(f"可转换到: {trans['data']['valid_transitions']}")
```

## curl 示例

```bash
# 注册节点
curl -X POST http://localhost:8000/api/p2p/v1/nodes/register \
  -H "Content-Type: application/json" \
  -d '{"node_type":"browser","capabilities":["ai_detection"],"location":"cn-east"}'

# 心跳上报
curl -X PUT http://localhost:8000/api/p2p/v1/nodes/{node_id}/heartbeat \
  -H "Content-Type: application/json" \
  -d '{"metrics":{"cpu_usage":30,"memory_usage":50,"disk_io_usage":10,"network_bandwidth_usage":5}}'

# 节点下线
curl -X DELETE http://localhost:8000/api/p2p/v1/nodes/{node_id}/offline \
  -H "Content-Type: application/json" \
  -d '{"reason":"维护升级"}'

# 取消任务
curl -X POST http://localhost:8000/api/p2p/v1/tasks/TASK-XXX/cancel \
  -H "Content-Type: application/json" \
  -d '{"reason":"不再需要"}'
```

## 触发词
"任务分发", "节点心跳", "任务调度", "状态机转换", "节点注册",
"P2P调度", "任务取消", "节点发现", "网络拓扑", "信誉查询",
"dispatch task", "heartbeat", "node register", "task cancel",
"state machine", "offline detection", "pending tasks"

## 错误码说明
| 错误码 | HTTP状态 | 含义 |
|-------|---------|------|
| P2P_0001 | 401 | 节点认证失败或令牌过期 |
| P2P_0002 | 403 | 节点已被封禁或信誉不足 |
| P2P_0003 | 404 | 节点不存在或任务不存在 |
| P2P_0004 | 409 | 节点重复注册 |
| P2P_0005 | 422 | 请求参数校验失败 |
| P2P_0006 | 429 | 节点请求频率超限 |
| P2P_0007 | 503 | 无可用节点满足调度要求 |
| P2P_0008 | 504 | 任务执行超时 |
| P2P_0009 | 500 | 内部服务错误 |
