---
name: "idle-detector"
description: "闲时检测服务 Skill。当需要评估节点资源空闲状态、判断是否触发任务迁移、获取各资源使用等级描述时调用。嵌入在 HeartbeatService 的心跳处理流程中。"
---

# 闲时检测服务 (IdleDetectionService)

## 概述
嵌入在心跳处理流程中的资源状态评估器，根据节点的 CPU/内存/磁盘IO/网络带宽四维指标，实时判定节点当前处于 **IDLE（空闲）/ PARTIAL_BUSY（部分忙碌）/ BUSY（忙碌）** 三种状态之一，并支持迁移触发判断和资源等级描述。

对应 Service: `IdleDetectionService` (`backend/p2p_app/services/idle_detection_service.py`)

**重要说明**: 本服务**无独立 HTTP 端点**，其能力通过以下方式暴露：
1. **PUT `/api/p2p/v1/nodes/{node_id}/heartbeat`** — 心跳响应中包含 `idle_state` 字段
2. **GET `/api/p2p/v1/nodes/{node_id}`** — 节点详情中可通过最新心跳推断
3. **Python SDK 直接调用** — `IdleDetectionService.evaluate_idle_state()`

## 状态评估算法

### 三态判定逻辑

```
                    任一指标 ≥ 0.80 (EMERGENCY_THRESHOLDS)
                           │
                      ┌────┴────┐
                      │  BUSY   │  (紧急阈值: 有任一资源接近满载)
                      └─────────┘

              所有指标均低于各自 IDLE 阈值?
                     │
           ┌─────────┴──────────┐
           │ Yes                 │ No
     ┌─────┴─────┐       ┌──────┴──────┐
     │   IDLE    │       │ PARTIAL_BUSY│
     │ (完全空闲) │       │ (部分忙碌)   │
     └───────────┘       └─────────────┘
```

### 各指标阈值 (IDLE_THRESHOLDS)

| 资源指标 | IDLE 阈值 | 含义: 低于此值视为"空闲" |
|---------|----------|------------------------|
| cpu_usage | 0.30 (30%) | CPU 使用率 < 30% |
| memory_usage | 0.40 (40%) | 内存使用率 < 40% |
| disk_io_usage | 0.20 (20%) | 磁盘 IO 使用率 < 20% |
| network_bandwidth_usage | 0.30 (30%) | 网络带宽使用率 < 30% |

### 紧急阈值 (EMERGENCY_THRESHOLDS)
- **统一值**: 0.80 (80%)
- **含义**: 任一资源 ≥ 80% 时直接判定为 BUSY（无论其他指标多低）

### 资源等级描述

| 使用率范围 | 等级描述 | 说明 |
|-----------|---------|------|
| < idle_threshold | 正常 | 资源充裕 |
| ≥ idle_threshold 且 < 0.80 | 偏高 | 有一定负载但未过载 |
| ≥ 0.80 | 极高 | 接近或已达满载 |

## API 关联端点

### PUT `/api/p2p/v1/nodes/{node_id}/heartbeat`
心跳上报后，响应中自动包含闲时检测结果:

**请求体**:
```json
{
  "metrics": {
    "cpu_usage": 25.0,
    "memory_usage": 35.0,
    "gpu_usage": null,
    "disk_io_usage": 15.0,
    "network_bandwidth_usage": 10.0
  },
  "active_tasks": []
}
```

**响应中的 idle_state 字段**:
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "idle_state": "IDLE",
    "server_time": "2024-06-07T10:05:01",
    "pending_tasks": [...],
    "next_heartbeat_in_seconds": 10
  }
}
```

> 心跳内部会将 metrics 中的百分比值除以 100 后传给 IdleDetectionService

### 节点状态联动
闲时检测的结果会影响节点的 `status` 字段:
- `BUSY` → 节点 status 设为 `busy`
- `IDLE` / `PARTIAL_BUSY` → 若原状态不是 busy/maintenance/banned，设为 `online`

## Python SDK 调用示例

```python
from p2p_app.services.idle_detection_service import IdleDetectionService

# ── 1. 评估空闲状态 ──
state = IdleDetectionService.evaluate_idle_state({
    'cpu_usage': 0.25,          # 25%
    'memory_usage': 0.35,       # 35%
    'disk_io_usage': 0.15,      # 15%
    'network_bandwidth_usage': 0.10,  # 10%
})
print(f"状态: {state}")  # "IDLE" — 所有指标都低于阈值

# ── 2. 部分忙碌 ──
state2 = IdleDetectionService.evaluate_idle_state({
    'cpu_usage': 0.50,          # 50% > 30% 阈值
    'memory_usage': 0.60,       # 60% > 40% 阈值
    'disk_io_usage': 0.10,
    'network_bandwidth_usage': 0.05,
})
print(f"状态: {state2}")  # "PARTIAL_BUSY" — 有指标超过 IDLE 阈值但未达紧急阈值

# ── 3. 忙碌状态 ──
state3 = IdleDetectionService.evaluate_idle_state({
    'cpu_usage': 0.85,          # 85% > 80% 紧急阈值!
    'memory_usage': 0.90,
    'disk_io_usage': 0.50,
    'network_bandwidth_usage': 0.30,
})
print(f"状态: {state3}")  # "BUSY" — 触发紧急阈值

# ── 4. 判断是否需要任务迁移 ──
should_migrate = IdleDetectionService.should_trigger_migration(
    current_state='BUSY',
    previous_state='PARTIAL_BUSY',
)
print(f"需要迁移: {should_migrate}")  # True — 从非 BUSY 进入 BUSY

should_migrate2 = IdleDetectionService.should_trigger_migration(
    current_state='BUSY',
    previous_state='BUSY',
)
print(f"需要迁移: {should_migrate2}")  # False — 已经是 BUSY，不需要重复迁移

# ── 5. 获取各资源等级描述 ──
levels = IdleDetectionService.get_resource_contention_level({
    'cpu_usage': 0.85,
    'memory_usage': 0.50,
    'disk_io_usage': 0.15,
    'network_bandwidth_usage': 0.05,
})
# 输出:
# {
#   'cpu': '极高',         # >= 0.80
#   'memory': '偏高',      # >= 0.40 但 < 0.80
#   'disk_io': '正常',     # < 0.20
#   'network': '正常',     # < 0.30
# }

for resource, level in levels.items():
    icon = {'正常': '✅', '偏高': '⚠️', '极高': '❌'}.get(level, '❓')
    print(f"  {icon} {resource}: {level}")
```

## 在心跳服务中的集成位置

```
HeartbeatService.process_heartbeat()
  │
  ├─ 1. 校验节点存在性 & 封禁状态
  │
  ├─ 2. ★ IdleDetectionService.evaluate_idle_state(metrics) ★
  │     └→ 得到 idle_state: IDLE / PARTIAL_BUSY / BUSY
  │
  ├─ 3. 创建 NodeHeartbeat 记录 (含 idle_state)
  │
  ├─ 4. 更新节点状态 (BUSY→busy, 其他→online)
  │
  ├─ 5. 异常检测 (CPU≥95%/内存≥95%/GPU≥98%)
  │
  ├─ 6. 信誉更新 (正常+0.1 / 异常-1.0)
  │
  └─ 7. 返回 ack (含 idle_state + pending_tasks)
```

## 触发词
"闲时检测", "空闲状态", "资源利用率", "任务迁移",
"idle detection", "resource utilization", "load balancing",
"节点繁忙度", "CPU占用", "内存使用", "迁移触发",
"资源竞争等级", "空闲节点查找"

## 注意事项与限制
- **输入范围为 0-1** (归一化百分比)，不是 0-100
- 心跳 API 接收的是 0-100 百分比数值，内部会自动除以 100
- 紧急阈值 (0.80) 优先于 IDLE 阈值判定 — 任一资源超标即 BUSY
- 迁移触发仅检测 **BUSY 状态的首次进入** (previous ≠ BUSY → current == BUSY)
- 所有方法均为 `@classmethod`，无需实例化即可调用
- 本服务为纯计算服务，无副作用（不写数据库），适合高频调用

## 配置参数速查

| 参数 | 值 | 定义位置 |
|------|-----|---------|
| IDLE_THRESHOLDS.cpu_usage | 0.30 | IdleDetectionService.IDLE_THRESHOLDS |
| IDLE_THRESHOLDS.memory_usage | 0.40 | 同上 |
| IDLE_THRESHOLDS.disk_io_usage | 0.20 | 同上 |
| IDLE_THRESHOLDS.network_bandwidth_usage | 0.30 | 同上 |
| EMERGENCY_THRESHOLDS | 0.80 | IdleDetectionService.EMERGENCY_THRESHOLDS |
