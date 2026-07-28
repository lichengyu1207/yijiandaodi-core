---
name: "hashchain-audit"
description: "白盒审计存证 Skill。当需要记录不可篡改审计日志、查询哈希链、验证链完整性、生成合规报告时调用。"
---

# 哈希链审计日志 (HashChain + AuditLogger + ComplianceReporter)

## 概述
L7 层白盒审计核心，基于 SHA256 哈希链实现不可篡改的日志存储。每条记录包含前一条记录的 hash，形成链式结构，任何篡改都会导致后续所有 hash 断裂。

对应 Service: `HashChain` + `AuditLogger` + `ComplianceReporter` (`backend/p2p_app/services/audit_trail.py`)

核心组件:
- **HashChain** — 轻量级哈希链，创世区块 hash 为全0 (64个'0')
- **AuditLogger** — 审计事件记录器，按事件类型自动路由到不同链
- **ComplianceReporter** — 合规报告生成器（任务级/节点级/系统快照）
- **AuditEvent** — 13 种标准审计事件类型

## 哈希链架构

```
链名称                    用途                  存储的事件类型
─────────────────────────────────────────────────────────────
task_lifecycle     →  任务生命周期    →  TASK_CREATED, TASK_DISPATCHED, SHARD_ASSIGNED,
                                         NODE_HEARTBEAT, NODE_REGISTERED
execution_log      →  执行过程日志    →  EXECUTION_STARTED, COMPLETED, FAILED, RESULT_VERIFIED
security_events    →  安全事件        →  SECURITY_CHECK, SECURITY_BLOCKED, AUDIT_REPORT
cost_tracking      →  成本追踪        →  COST_ROUTED
```

## 审计事件类型 (AuditEvent)

| 事件标识 | 说明 |
|---------|------|
| `task.created` | 任务创建 |
| `task.dispatched` | 任务分发 |
| `shard.assigned` | 分片分配 |
| `execution.started` | 执行开始 |
| `execution.completed` | 执行完成 |
| `execution.failed` | 执行失败 |
| `security.check` | 安全检查通过 |
| `security.blocked` | 安全检查拦截 |
| `cost.routed` | 成本路由决策 |
| `node.heartbeat` | 节点心跳 |
| `node.registered` | 节点注册 |
| `result.verified` | 结果验证 |
| `audit.report` | 审计报告生成 |

## API 端点

### GET `/api/p2p/v1/pipeline/audit/{task_id}`
获取指定任务的审计日志。

**查询参数**: 无额外参数

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "audit_id": "a1b2c3d4e5f6...",
      "event_type": "task.created",
      "entity_id": "TASK-A1B2C3D4E5F6",
      "user_id": null,
      "ip_address": "192.168.1.100",
      "payload": { "action": "created" },
      "logged_at": "2024-06-07T10:00:00",
      "chain": "task_lifecycle"
    },
    {
      "audit_id": "f6e5d4c3b2a1...",
      "event_type": "security.check",
      "entity_id": "TASK-A1B2C3D4E5F6",
      "payload": { "gateway_result": { "passed": true, "risk_score": 5.0 } },
      "logged_at": "2024-06-07T10:00:01",
      "chain": "security_events"
    }
  ]
}
```

## Python SDK 调用示例

```python
from p2p_app.services.audit_trail import AuditLogger, HashChain, ComplianceReporter, AuditEvent
from datetime import datetime, timedelta

audit = AuditLogger()

# ── 1. 记录通用审计日志 ──
audit_id = audit.log(
    event_type=AuditEvent.TASK_CREATED,
    entity_id="TASK-ABC123",
    data={"priority": "high", "task_type": "code"},
    user_id="user-001",
    ip_address="10.0.0.1",
)
print(f"审计ID: {audit_id}")  # SHA256 hash 值

# ── 2. 记录安全网关结果 ──
audit.log_security_gate(
    request_id="req-001",
    gateway_result={"passed": True, "risk_score": 12.5},
)

# ── 3. 记录执行结果 ──
audit.log_execution(
    shard_id="SHARD-0001",
    node_id="node-abc",
    execution_result={
        "exit_code": 0,
        "stdout": "done",
        "execution_time_ms": 120,
    },
)

# ── 4. 记录成本路由决策 ──
audit.log_cost_routing(
    task_id="TASK-ABC123",
    routing_decision={"assigned_nodes": 5, "estimated_cost": 0.05},
)

# ── 5. 查询审计日志（多维度筛选）──
logs = audit.query_logs(
    event_type=AuditEvent.SECURITY_BLOCKED,   # 按事件类型筛选
    # entity_id="TASK-ABC123",                 # 按实体ID筛选
    # start_time=datetime.now() - timedelta(days=7),
    limit=50,
)
for log in logs:
    print(f"[{log['event_type']}] {log['entity_id']} @ {log['logged_at']}")

# ── 6. 获取哈希链状态 ──
chain_status = audit.get_chain_status()
for name, info in chain_status.items():
    print(f"链 {name}: {info['length']} 条 | 完整性: {'✅' if info['integrity_ok'] else '❌断裂'}")
    print(f"  head_hash: {info['head_hash'][:16]}...")

# ── 7. 验证单条链完整性 ──
chain = HashChain("task_lifecycle")
is_valid, count = chain.verify_integrity()
print(f"完整性: {is_valid}, 总条数: {count}")

# ── 8. 生成合规报告 ──
reporter = ComplianceReporter(audit)

# 任务级合规报告
task_report = reporter.generate_task_report("TASK-ABC123")
print(f"报告类型: {task_report['report_type']}")
print(f"安全检查: {task_report['security_checks']['total_checks']}次")
print(f"链完整性证明: {task_report['integrity_proof']}")

# 节点行为报告
node_report = reporter.generate_node_report(
    node_id="node-abc",
    start_time=datetime.now() - timedelta(days=30),
    end_time=datetime.now(),
)

# 系统快照
snapshot = reporter.generate_system_snapshot()
print(f"活跃任务: {snapshot['statistics']['active_task_count']}")
print(f"在线节点: {snapshot['statistics']['online_node_count']}")
print(f"安全拦截事件: {snapshot['statistics']['security_block_event_count']}")
```

## 哈希链数据结构

每条链上记录(entry)的结构:
```json
{
  "seq": 1,
  "chain": "task_lifecycle",
  "prev_hash": "0000...0000",         // 前一条记录的 hash
  "timestamp": "2024-06-07T10:00:00",
  "data": { "event_type": "...", "entity_id": "...", ... },
  "hash": "a1b2c3d4..."              // 当前记录的 SHA256 hash
}
```

**完整性验证逻辑**:
1. 从第一条记录开始，检查 `prev_hash` 是否等于前一条的 `hash`
2. 对每条记录重算 SHA256 hash，比对存储的 `hash` 字段
3. 任一环节不匹配则整条链标记为断裂

## curl 示例

```bash
# 获取任务的审计日志
curl http://localhost:8000/api/p2p/v1/pipeline/audit/TASK-A1B2C3D4E5F6
```

## 触发词
"审计日志", "哈希链", "合规报告", "不可篡改", "audit log", "hash chain",
"白盒审计", "存证", "完整性验证", "安全事件追踪", "成本追踪",
"任务生命周期记录", "节点行为报告", "系统快照", "compliance report"

## 注意事项与限制
- 哈希链数据存储在**内存中**，服务重启后清空
- 生产环境建议对接数据库持久化（当前版本为轻量实现）
- `query_logs` 默认最多返回 100 条，可通过 `limit` 参数调整
- `generate_system_snapshot` 仅返回最近 50 个活跃任务和在线节点
- 合规报告生成本身也会产生一条 `AUDIT_REPORT` 类型审计记录
- 链完整性验证的时间复杂度 O(n)，n 为链长度

## 错误码说明
| 场景 | 说明 |
|------|------|
| Task.DoesNotExist | 任务不存在时 `generate_task_report` 返回 error 字段 |
| P2PNode.DoesNotExist | 节点不存在时 `generate_node_report` 返回 error 字段 |
| 链断裂 | `verify_integrity()` 返回 `(False, n)`，n 为总条数 |
