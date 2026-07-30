---
name: "eihm-router"
description: "EIHM-P2P-CS 成本路由器 Skill。当需要进行算力成本估算、节点-分片最优路由分配、综合评分调度时调用。"
---

# EIHM 成本路由器 (EIHMCostRouter + ComputeCostEstimator)

## 概述
L4 层成本路由引擎，全称 **Execution Intelligence Hybrid Management P2P Cost Scheduling**。提供算力成本估算和基于综合评分的节点-分片路由分配能力。

对应 Service: `ComputeCostEstimator` + `EIHMCostRouter` (`backend/p2p_app/services/cost_router.py`)

核心算法流程:
1. **过滤** → 按能力/状态/信誉筛选可用节点
2. **评分** → 综合评分 = 0.4×成本优势 + 0.3×信誉 + 0.2×响应速度 + 0.1×地理位置
3. **分配** → 贪心+回溯为每个 Shard 分配最优节点集合（默认每分片3个节点）
4. **估算** → 基于节点类型单价 × 资源消耗 × 安全/隐私级别加成

## 节点类型基准单价 (元/小时)

| 节点类型 | 单价 | 说明 |
|---------|------|------|
| browser | ¥0.01/h | 浏览器节点 |
| desktop_windows | ¥0.05/h | Windows桌面 |
| desktop_mac | ¥0.06/h | macOS桌面 |
| mobile | ¥0.02/h | 移动端 |
| enterprise | ¥0.50/h | 企业级 |
| self_hosted | ¥0.03/h | 自托管 |

## 安全/隐私级别加成系数

| 级别 | 安全加成 | 隐私加成 |
|------|---------|---------|
| normal/public | 1.0× | 1.0× |
| high/internal | 1.5× | 1.3× |
| critical/confidential | 2.5× | 1.8× |

## API 端点

### POST `/api/p2p/v1/tasks/dispatch`
任务分发（创建 TaskDispatch + TaskShards），是成本路由的前置步骤。

**请求体**:
```json
{
  "task_type": "code",
  "priority": "high",
  "security_level": "high",
  "privacy_level": "internal",
  "preferred_region": "cn-east",
  "max_wait_seconds": 300,
  "shards": [
    {
      "sequence": 0,
      "payload_hash": "a1b2c3d4e5f6...SHA256哈希",
      "payload_size": 10240,
      "dependencies": [],
      "required_capabilities": ["python", "code_execution"],
      "estimated_resources": { "cpu_cores": 2, "memory_gb": 1 }
    },
    {
      "sequence": 1,
      "payload_hash": "f6e5d4c3b2a1...",
      "payload_size": 5120,
      "dependencies": ["TASK-XXX-SHARD-0000"],
      "required_capabilities": ["text_processing"],
      "estimated_resources": { "cpu_cores": 1, "memory_gb": 512 }
    }
  ]
}
```

**响应 (HTTP 201)**:
```json
{
  "success": true,
  "data": {
    "task_id": "TASK-A1B2C3D4E5F6",
    "task_type": "code",
    "status": "dispatching",
    "priority": "high",
    "total_shards": 2,
    "shards": [
      {
        "shard_id": "TASK-A1B2C3D4E5F6-SHARD-0001",
        "sequence": 0,
        "status": "pending",
        "required_capabilities": ["python", "code_execution"],
        "security_level": "high"
      }
    ]
  }
}
```

### GET `/api/p2p/v1/tasks/{task_id}`
查询任务详情（含所有分片信息），用于后续成本估算和路由。

**响应**:
```json
{
  "success": true,
  "data": {
    "task_id": "TASK-A1B2C3D4E5F6",
    "task_type": "code",
    "status": "dispatching",
    "security_level": "high",
    "privacy_level": "internal",
    "total_shards": 2,
    "shards": [...]
  }
}
```

## Service 层调用方式 (Python SDK)

成本路由主要通过 Service 层调用，以下为内部使用方式:

```python
from p2p_app.services.cost_router import EIHMCostRouter, ComputeCostEstimator
from p2p_app.models import TaskDispatch, P2PNode

# ── 1. 成本估算 ──
estimator = ComputeCostEstimator()

# 估算单个分片在指定节点的成本
shard_cost = estimator.estimate_shard_cost(shard, node)
# 返回值: float (元), 公式: unit_cost × resource_factor × security_mult × privacy_mult × size_factor

# 估算整个任务的总成本
total_cost = estimator.estimate_total_cost(task, assignments)
# assignments 格式: {shard_id: [node_ids]}
# 返回值: float (元), 所有分片在各自分配节点的成本总和

# ── 2. EIHM 路由分配 ──
router = EIHMCostRouter()

available_nodes = list(P2PNode.objects.filter(status='online'))
routing_result = router.route(task=task, available_nodes=available_nodes)

# routing_result 结构:
# {
#   'shard_assignments': {
#     'SHARD-0001': ['node-a', 'node-b', 'node-c'],  # 每分片默认3节点
#     'SHARD-0002': ['node-d', 'node-e'],
#   },
#   'estimated_cost': 0.023456,       # 总估算成本(元)
#   'score_matrix': {                  # 每分片的节点评分矩阵
#     'SHARD-0001': [('node-a', 0.85), ('node-b', 0.78), ...],
#   },
#   'routed_at': '2024-06-07T10:00:00',
#   'nodes_considered': 15,            # 候选节点数
#   'nodes_filtered': 8,               # 过滤后可用节点数
# }

assignments = routing_result['shard_assignments']
cost = routing_result['estimated_cost']
```

## 综合评分公式详解

```
score = 0.4 × cost_advantage          # 成本优势(越便宜分数越高, 归一化到[0,1])
     + 0.3 × reputation               # 信誉分(reputation_score/100, 归一化到[0,1])
     + 0.2 × response_speed           # 响应速度(心跳间隔<300s得分高)
     + 0.1 × geo_location             # 地理位置(匹配preferred_region得满分1.0)
```

## 过滤条件
- 排除状态: offline / banned / maintenance
- 最低信誉阈值: 30.0 (`MIN_REPUTATION`)
- 能力匹配: 节点 capabilities 与 shard required_capabilities 有交集即可

## curl 示例

```bash
# 创建分发任务(成本路由前置步骤)
curl -X POST http://localhost:8000/api/p2p/v1/tasks/dispatch \
  -H "Content-Type: application/json" \
  -d '{
    "task_type": "code",
    "priority": "high",
    "security_level": "critical",
    "privacy_level": "confidential",
    "shards": [
      {
        "sequence": 0,
        "payload_hash": "abc123hash",
        "payload_size": 2048,
        "dependencies": [],
        "required_capabilities": ["python"],
        "estimated_resources": {"cpu_cores": 2, "memory_gb": 1}
      }
    ]
  }'

# 查询任务详情
curl http://localhost:8000/api/p2p/v1/tasks/TASK-A1B2C3D4E5F6
```

## 触发词
"成本估算", "路由选择", "算力成本", "节点分配", "分片调度", "EIHM路由",
"cost estimate", "route select", "最优节点", "综合评分", "资源调度",
"费用计算", "性价比分析", "负载均衡"

## 注意事项与限制
- 成本估算基于模型参数，实际费用以计费系统为准
- 路由结果中若无可用节点，`shard_assignments` 为空且包含 `warning: no_available_nodes`
- 同一节点被过多分片选中时会触发过载惩罚因子 `1/(1+usage×0.3)`
- 默认每个分片分配 3 个节点 (`DEFAULT_NODES_PER_SHARD=3`)
- 最大合理成本上限 10 元/分片（用于归一化评分）
- 节点列表需从 Node Discovery 或 Node List API 获取

## 错误码说明
| 错误码 | HTTP状态 | 含义 |
|-------|---------|------|
| P2P_0003 | 404 | 节点不存在或任务不存在 |
| P2P_0005 | 422 | 请求参数校验失败 |
| P2P_0007 | 503 | 无可用节点满足调度要求 |
