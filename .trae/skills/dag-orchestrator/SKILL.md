---
name: "dag-orchestrator"
description: "DAG 工作流编排引擎 Skill。当需要创建、执行、管理工作流(DAG)、提交多Agent协作任务时调用。支持模板创建和自定义DAG。"
---

# DAG 工作流编排器 (Workflow Orchestrator)

## 概述
L2 层核心编排引擎，基于 DAG（有向无环图）实现 Multi-Agent 任务编排。支持预设模板一键创建和自定义 DAG 定义，内置 Kahn's algorithm 环路检测。

对应 Service: `WorkflowOrchestrator` (`backend/p2p_app/services/orchestrator.py`)

核心能力:
- **DAG 工作流定义与执行**: 创建、启动、取消、完成/失败标记
- **Multi-Agent 协作**: auditor(审计员)/verifier(校验者)/archiver(归档者)/judge(裁决者)/executor(执行者)/guard(守卫)
- **任务自动拆分**: 将工作流节点自动拆分为 TaskShard 并对接 TaskDispatch
- **优先级队列管理**: critical > high > normal > low
- **环路检测**: Kahn's BFS 拓扑排序算法确保无环

## 预设工作流模板

| 模板名 | 步骤 | 适用场景 |
|--------|------|---------|
| `code_audit` | input_guard → static_scan → dynamic_scan → audit_report | 代码审计流水线 |
| `content_verify` | extractor → auditor → verifier → judge → archiver | 内容核验流水线 |
| `ai_execute` | security_check → sandbox_exec → result_collect → audit_log | AI 执行流水线 |

每个模板步骤都有预定义的 `agent_role`、`security_level` 和 `estimated_resources`。

## API 端点

### POST `/api/p2p/v1/workflows`
创建工作流（支持模板或自定义 DAG）。

**模板创建请求**:
```json
{
  "template": "ai_execute",
  "payload_overrides": {
    "sandbox_exec": { "input": "用户代码" }
  },
  "priority": "high",
  "metadata": { "created_by": "agent_001" },
  "auto_start": true,
  "auto_shard": true,
  "task_type": "mixed",
  "security_level": "normal",
  "privacy_level": "public"
}
```

**自定义 DAG 创建请求**:
```json
{
  "name": "custom_analysis_pipeline",
  "tasks": [
    {
      "node_id": "step1_parse",
      "agent_role": "executor",
      "payload": { "file_path": "/data/input.txt" },
      "dependencies": [],
      "security_level": "normal",
      "estimated_resources": { "cpu_cores": 1, "memory_mb": 512 },
      "priority": "high"
    },
    {
      "node_id": "step2_analyze",
      "agent_role": "auditor",
      "payload": {},
      "dependencies": ["step1_parse"],
      "security_level": "high",
      "estimated_resources": { "cpu_cores": 2, "memory_mb": 1024 }
    },
    {
      "node_id": "step3_report",
      "agent_role": "archiver",
      "payload": {},
      "dependencies": ["step2_analyze"],
      "security_level": "normal"
    }
  ],
  "priority": "normal",
  "auto_start": true,
  "auto_shard": true
}
```

**创建成功响应 (HTTP 201)**:
```json
{
  "success": true,
  "data": {
    "workflow_id": "WF-A1B2C3D4E5F6",
    "status": "running",
    "total_tasks": 4,
    "completed": 0,
    "failed": 0,
    "pending": 4,
    "percentage": 0.0,
    "ready_task_ids": ["security_check"],
    "task_dispatch": {
      "task_id": "TASK-G7H8I9J0K1L2",
      "task_type": "mixed",
      "status": "dispatching",
      "total_shards": 4,
      "shards": [...]
    }
  }
}
```

### GET `/api/p2p/v1/workflows/list`
列出所有工作流。

**查询参数**:
| 参数 | 类型 | 说明 |
|------|------|------|
| status | string | 可选过滤: pending/running/completed/failed/cancelled |

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "workflow_id": "WF-A1B2C3D4E5F6",
      "name": "template:ai_execute",
      "status": "running",
      "priority": "high",
      "total_tasks": 4,
      "completed": 2,
      "failed": 0,
      "percentage": 50.0
    }
  ],
  "count": 1
}
```

### GET `/api/p2p/v1/workflows/{workflow_id}`
查询工作流详情（含每个节点状态）。

**响应**:
```json
{
  "success": true,
  "data": {
    "workflow_id": "WF-A1B2C3D4E5F6",
    "status": "running",
    "total_tasks": 4,
    "completed": 1,
    "failed": 0,
    "percentage": 25.0,
    "nodes": [
      {
        "node_id": "security_check",
        "agent_role": "guard",
        "status": "completed",
        "dependencies": [],
        "security_level": "critical",
        "error": null
      },
      {
        "node_id": "sandbox_exec",
        "agent_role": "executor",
        "status": "running",
        "dependencies": ["security_check"],
        "security_level": "critical"
      }
    ],
    "metadata": { "template": "ai_execute" }
  }
}
```

### POST `/api/p2p/v1/workflows/{workflow_id}`
工作流操作（启动/取消/标记任务完成或失败）。

**操作请求**:
```json
// 启动工作流
{ "action": "start" }

// 取消工作流
{ "action": "cancel", "reason": "用户主动取消" }

// 标记任务完成
{ "action": "complete_task", "task_id": "sandbox_exec", "result": { "output": "..." } }

// 标记任务失败
{ "action": "fail_task", "task_id": "sandbox_exec", "error": "执行超时" }
```

**响应**:
```json
{
  "success": true,
  "data": {
    "message": "Task sandbox_exec marked completed",
    "workflow": { /* 工作流最新状态 */ }
  }
}
```

### GET `/api/p2p/v1/workflows/{workflow_id}/ready-tasks`
获取当前可执行的（所有依赖已完成）就绪任务列表。

**响应**:
```json
{
  "success": true,
  "data": {
    "workflow_id": "WF-A1B2C3D4E5F6",
    "ready_count": 2,
    "tasks": [
      {
        "node_id": "static_scan",
        "agent_role": "auditor",
        "dependencies": ["input_guard"],
        "security_level": "normal",
        "estimated_resources": { "cpu_cores": 2, "memory_mb": 1024 },
        "priority": "normal"
      }
    ]
  }
}
```

## Python SDK 调用示例

```python
import requests

BASE = "http://localhost:8000/api/p2p/v1"

# 1. 从模板创建并自动启动工作流
resp = requests.post(f"{BASE}/workflows", json={
    "template": "ai_execute",
    "payload_overrides": {"sandbox_exec": {"input": "print('hello')"}},
    "priority": "high",
    "auto_start": True,
    "auto_shard": True,
})
wf = resp.json()["data"]
print(f"工作流创建: {wf['workflow_id']} | 状态: {wf['status']}")

# 2. 查询进度
detail = requests.get(f"{BASE}/workflows/{wf['workflow_id']}").json()["data"]
print(f"进度: {detail['completed']}/{detail['total_tasks']} ({detail['percentage']}%)")

# 3. 获取就绪任务
ready = requests.get(f"{BASE}/workflows/{wf['workflow_id']}/ready-tasks").json()
for task in ready["data"]["tasks"]:
    print(f"  就绪: {task['node_id']} (role={task['agent_role']})")

# 4. 标记任务完成
requests.post(f"{BASE}/workflows/{wf['workflow_id']}", json={
    "action": "complete_task",
    "task_id": "sandbox_exec",
    "result": {"exit_code": 0, "stdout": "hello"},
})

# 5. 列出所有工作流
list_resp = requests.get(f"{BASE}/workflows/list?status=running").json()
for w in list_resp["data"]:
    print(f"  {w['workflow_id']} | {w['status']} | {w['percentage']}%")
```

## curl 示例

```bash
# 创建 ai_execute 模板工作流
curl -X POST http://localhost:8000/api/p2p/v1/workflows \
  -H "Content-Type: application/json" \
  -d '{
    "template": "ai_execute",
    "priority": "high",
    "auto_start": true,
    "auto_shard": true
  }'

# 查询工作流详情
curl http://localhost:8000/api/p2p/v1/workflows/WF-A1B2C3D4E5F6

# 取消工作流
curl -X POST http://localhost:8000/api/p2p/v1/workflows/WF-A1B2C3D4E5F6 \
  -H "Content-Type: application/json" \
  -d '{"action": "cancel", "reason": "测试取消"}'
```

## Agent 角色 (AgentRole)
| 角色 | 说明 | 典型场景 |
|------|------|---------|
| `executor` | 执行者 | 代码运行、数据处理 |
| `auditor` | 审计者 | 静态扫描、安全审计 |
| `verifier` | 校验者 | 结果验证、一致性检查 |
| `archiver` | 归档者 | 报告生成、结果存储 |
| `judge` | 裁决者 | 冲突仲裁、最终判定 |
| `guard` | 守卫者 | 输入安检、权限控制 |

## 工作流状态流转
```
pending → running → completed
                ↘ cancelled
                ↘ failed (任一节点失败后下游被阻塞)
```

## 触发词
"工作流编排", "DAG", "多Agent协作", "任务编排", "workflow execute",
"创建工作流", "orchestrator", "流水线", "模板任务", "自定义DAG",
"任务依赖", "拓扑排序", "代码审计流程", "内容核验流程"

## 注意事项与限制
- 自定义 DAG 必须无环，否则返回 `DAGCycleError`
- 已完成/已取消的工作流无法再次启动
- 已终态(completed/failed/skipped)的节点无法重复标记
- `auto_shard=True` 时会自动创建 TaskDispatch 记录
- 工作流数据存储在内存中，服务重启后丢失
- 可通过 `cleanup_workflow()` 手动释放内存

## 错误码说明
| 错误码 | HTTP状态 | 含义 |
|-------|---------|------|
| P2P_0003 | 404 | 工作流不存在 |
| P2P_0005 | 422 | 参数校验失败(如缺少 tasks 字段/DAG有环) |
| P2P_0009 | 500 | 内部服务错误 |
| DAGCycleError | 422 | DAG 中存在环路 |
| InvalidTransitionError | 409 | 非法状态转换(如对 running 的 workflow 再次 start) |
| WorkflowNotFoundError | 404 | 工作流 ID 不存在 |
