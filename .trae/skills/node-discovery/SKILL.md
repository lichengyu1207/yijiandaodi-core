---
name: "node-discovery"
description: "节点发现服务 Skill。当需要按条件搜索节点、获取网络拓扑、校验节点能力、为分片匹配最优节点时调用。"
---

# 节点发现服务 (NodeDiscoveryService)

## 概述
P2P 网络的节点检索与匹配引擎，提供多维度的节点发现能力：按类型/能力/资源/地域/信誉筛选，网络拓扑概览，以及智能的分片-节点最优匹配。

对应 Service: `NodeDiscoveryService` (`backend/p2p_app/services/discovery_service.py`)

核心能力:
- **多维度筛选**: 节点类型 + 能力集合 + 资源门槛 + 地域 + 信誉 + 状态
- **网络拓扑**: 全局节点分布统计（按类型/地域/在线率/平均信誉）
- **能力校验**: 验证节点上报的能力是否在已知列表中
- **最优匹配**: 为分片自动找到最合适的 N 个节点（空闲优先 + 信誉排序）

## 已知能力列表 (KNOWN_CAPABILITIES)

| 能力标识 | 说明 |
|---------|------|
| `ai_detection` | AI 内容检测 |
| `code_execution` | 代码执行 |
| `text_processing` | 文本处理 |
| `ocr` | OCR 文字识别 |
| `image_analysis` | 图像分析 |
| `file_scanning` | 文件扫描 |
| `nlp_inference` | NLP 推理 |
| `plagiarism_check` | 查重检测 |

## API 端点

### POST `/api/p2p/v1/nodes/discover`
按条件发现匹配节点。

**请求体**:
```json
{
  "node_type": "desktop_windows",
  "required_capabilities": ["python", "code_execution"],
  "min_resources": { "cpu_cores": 4, "memory_gb": 8 },
  "location": "cn-east",
  "min_reputation": 80.0,
  "status": "online",
  "max_results": 20
}
```

**所有参数均为可选**，省略则不做该维度过滤。

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "node_id": "a1b2c3d4...",
      "node_type": "desktop_windows",
      "status": "online",
      "location": "cn-east",
      "reputation_score": 95.5,
      "last_heartbeat": "2024-06-07T10:05:00"
    }
  ],
  "count": 1
}
```

### GET `/api/p2p/v1/network/topology`
获取 P2P 网络拓扑概览。

**响应**:
```json
{
  "success": true,
  "data": {
    "total_nodes": 50,
    "online_count": 35,
    "offline_count": 10,
    "busy_count": 5,
    "by_type": {
      "desktop_windows": 20,
      "browser": 15,
      "mobile": 8,
      "enterprise": 5,
      "self_hosted": 2
    },
    "by_location": {
      "cn-east": 25,
      "us-west": 12,
      "eu-central": 8,
      "unknown": 5
    },
    "avg_reputation": 82.5,
    "total_compute_hours": 1024.5
  }
}
```

### GET `/api/p2p/v1/nodes`
节点列表（分页，支持筛选）。详见 p2p-scheduler SKILL。

### GET `/api/p2p/v1/nodes/{node_id}`
单个节点详情。详见 p2p-scheduler SKILL。

## Python SDK 调用示例

```python
from p2p_app.services.discovery_service import NodeDiscoveryService

# ── 1. 按条件发现节点 ──
nodes = NodeDiscoveryService.discover_nodes({
    'required_capabilities': ['python', 'code_execution'],
    'min_resources': {'cpu_cores': 4, 'memory_gb': 8},
    'location': 'cn-east',
    'min_reputation': 70.0,
    'max_results': 10,
})
print(f"找到 {len(nodes)} 个匹配节点:")
for n in nodes:
    print(f"  {n['node_id']} | {n['node_type']} | {n['location']} | 信誉={n.get('reputation_score', 'N/A')}")

# ── 2. 获取网络拓扑 ──
topo = NodeDiscoveryService.get_network_topology()
print(f"\n网络拓扑:")
print(f"  总节点: {topo['total_nodes']}")
print(f"  在线: {topo['online_count']} | 离线: {topo['offline_count']} | 忙碌: {topo['busy_count']}")
print(f"  平均信誉: {topo['avg_reputation']}")
print(f"  总算力: {topo['total_compute_hours']}h")
print(f"  按类型分布: {topo['by_type']}")
print(f"  按地域分布: {topo['by_location']}")

# ── 3. 校验节点能力 ──
is_valid = NodeDiscoveryService.validate_node_capability(
    node_id="node-001",
    capability_report={
        "code_execution": "1.0.0",
        "text_processing": "1.0.0",
        "unknown_capability": "1.0",  # ← 这个不在已知列表中
    },
)
# is_valid: False (因为 unknown_capability 不在 KNOWN_CAPABILITIES 中)

is_valid2 = NodeDiscoveryService.validate_node_capability(
    node_id="node-002",
    capability_report={"code_execution": "1.0.0", "text_processing": "1.0.0"},
)
# is_valid2: True

# ── 4. 为分片找最优节点 ──
best_nodes = NodeDiscoveryService.find_best_nodes_for_shard(
    shard_requirements={
        'required_capabilities': ['python', 'nlp_inference'],
        'min_resources': {'cpu_cores': 2, 'memory_gb': 4},
        'location': 'cn-east',
        'min_reputation': 60.0,
        'security_level': 'high',
    },
    count=3,
)
print(f"\n为分片匹配的最优节点 (前3个):")
for n in best_nodes:
    print(f"  {n['node_id']} | 空闲={n.get('idle_state', '?')} | 信誉={n.get('reputation_score', '?')}")
```

## 最优匹配算法 (find_best_nodes_for_shard)

**两阶段策略**:

**第一阶段 — 过滤**: 通过 `discover_nodes()` 按硬性条件筛选候选节点

**第二阶段 — 排序**: 按以下优先级排序:
1. **空闲状态** (主要排序): IDLE(0) > PARTIAL_BUSY(1) > BUSY(2)
2. **信誉分数** (次要排序, 降序): 分越高越优先

返回前 `count` 个节点（默认从 3×count 的候选中选取）。

## 筛选逻辑详解

### 能力过滤 (_filter_by_capabilities)
- 节点的 `capabilities` JSON 字段必须**包含** `required_capabilities` 中的**每一个**
- 即: `all(cap in node.capabilities for cap in required_capabilities)`
- SQLite 兼容实现: Python 层逐条检查

### 资源过滤 (_filter_by_resources)
- 节点的 `resources` JSON 字段必须满足**最低资源要求**
- 支持 `cpu_cores` 和 `memory_gb` 两个维度
- 要求: `node.cpu >= min_cpu AND node.memory >= min_memory`

### 排序规则 (discover_nodes 内部)
- 默认按 `last_heartbeat` **降序排列**（最近活跃的排前面）

## curl 示例

```bash
# 发现能执行 Python 的桌面节点
curl -X POST http://localhost:8000/api/p2p/v1/nodes/discover \
  -H "Content-Type: application/json" \
  -d '{"required_capabilities":["python"],"node_type":"desktop_windows","max_results":10}'

# 发现高信誉节点
curl -X POST http://localhost:8000/api/p2p/v1/nodes/discover \
  -H "Content-Type: application/json" \
  -d '{"min_reputation":90,"status":"online"}'

# 获取网络拓扑
curl http://localhost:8000/api/p2p/v1/network/topology
```

## 触发词
"节点发现", "节点搜索", "网络拓扑", "能力匹配",
"node discovery", "find nodes", "network topology",
"最优节点选择", "节点能力校验", "P2P网络视图",
"地域匹配", "资源筛选", "信誉过滤"

## 注意事项与限制
- `discover_nodes()` 在查询参数异常时抛出 `P2PServiceError`
- 能力过滤使用 Python 层逐条检查（SQLite JSONField 限制），大量节点时性能需关注
- `validate_node_capability()` 只做已知能力列表校验，不做版本兼容性检查
- `find_best_nodes_for_shard()` 内部会请求 3×count 的候选节点以留出排序余地
- 网络拓扑数据实时从数据库聚合查询，非缓存
- `discover_nodes` 默认排除 `status='banned'` 的节点
- `max_results` 默认值为 20，最大建议不超过 100

## 错误码说明
| 错误码 | HTTP状态 | 含义 |
|-------|---------|------|
| P2P_0007 | 503 | 无可用节点满足调度要求（discover_nodes 无结果时不报错，返回空数组） |
| P2P_0009 | 500 | 内部服务错误（数据库查询异常等） |
