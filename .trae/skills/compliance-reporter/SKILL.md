---
name: "compliance-reporter"
description: "合规报告生成器 Skill。当需要生成任务合规报告、节点行为报告、系统安全快照、审计链完整性证明时调用。基于 ComplianceReporter + AuditLogger 实现。"
---

# 合规报告生成器 (ComplianceReporter)

## 概述
基于白盒审计日志链的合规报告生成引擎，提供三种维度的合规证明：**任务级**（单任务全生命周期）、**节点级**（单个节点行为轨迹）、**系统级**（全局安全态势快照）。

对应 Service: `ComplianceReporter` (`backend/p2p_app/services/audit_trail.py`)

**注意**: 本组件主要通过 Python SDK 调用，相关数据也可通过 Pipeline Audit API 获取部分信息。

## 报告类型

### 1. 任务合规报告 (generate_task_report)
为单个 TaskDispatch 生成完整的合规性证明文档。

**包含内容**:
- 任务基本信息 (ID/类型/状态/安全级别/隐私级别/创建者/时间戳)
- 安全检查记录总数及拦截次数
- 执行过程事件追踪
- 成本路由决策记录
- **哈希链完整性证明** (4 条链的状态)

**输出结构**:
```json
{
  "report_type": "task_compliance",
  "generated_at": "2024-06-07T10:00:00",
  "task_info": {
    "task_id": "TASK-A1B2C3D4E5F6",
    "task_type": "code",
    "status": "completed",
    "security_level": "high",
    "privacy_level": "internal",
    "created_by": "user-001",
    "created_at": "2024-06-07T09:55:00",
    "completed_at": "2024-06-07T10:00:00"
  },
  "security_checks": {
    "total_checks": 3,
    "blocked_count": 0,
    "details": [/* SecurityCheck 审计记录 */]
  },
  "execution_trace": {
    "total_events": 8,
    "events": [/* Started/Completed/Failed 事件 */]
  },
  "cost_records": [/* COST_ROUTED 事件 */],
  "integrity_proof": {
    "task_lifecycle": { "length": 12, "head_hash": "...", "integrity_ok": true },
    "execution_log": { "length": 8, "head_hash": "...", "integrity_ok": true },
    "security_events": { "length": 3, "head_hash": "...", "integrity_ok": true },
    "cost_tracking": { "length": 1, "head_hash": "...", "integrity_ok": true }
  },
  "total_audit_entries": 24
}
```

### 2. 节点行为报告 (generate_node_report)
分析指定节点在时间窗口内的所有行为。

**包含内容**:
- 节点基本信息 (ID/类型/状态/信誉/算力贡献/地域)
- 时间范围
- 相关审计事件数量及明细 (最多 200 条)

**输出结构**:
```json
{
  "report_type": "node_behavior",
  "generated_at": "2024-06-07T10:00:00",
  "node_info": {
    "node_id": "node-abc123",
    "node_type": "desktop_windows",
    "status": "online",
    "reputation_score": 95.5,
    "total_tasks_completed": 128,
    "location": "cn-east"
  },
  "time_range": {
    "start": "2024-05-08T00:00:00",
    "end": "2024-06-07T23:59:59"
  },
  "related_audit_events": 45,
  "events": [/* 该节点相关的审计记录 */]
}
```

### 3. 系统安全快照 (generate_system_snapshot)
全局实时状态一览。

**包含内容**:
- 活跃任务列表 (最近 50 个，非终态)
- 在线节点列表 (全部)
- 统计摘要 (活跃任务数/在线节点数/安全拦截数/审计总条数)
- 最近安全拦截事件 (最近 20 条)
- 全部哈希链完整性状态

**输出结构**:
```json
{
  "snapshot_type": "system_snapshot",
  "generated_at": "2024-06-07T10:00:00",
  "active_tasks": [
    { "task_id": "...", "status": "executing", "task_type": "code", "total_shards": 4, "completed_shards": 2 }
  ],
  "online_nodes": [
    { "node_id": "...", "node_type": "browser", "reputation_score": 88.0, "location": "us-west" }
  ],
  "statistics": {
    "active_task_count": 12,
    "online_node_count": 35,
    "security_block_event_count": 3,
    "total_audit_entries": 1024
  },
  "recent_security_blocks": [/* 最近20条 SECURITY_BLOCKED 事件 */],
  "audit_chain_integrity": { /* 4条链的完整性 */ }
}
```

## API 端点关联

### GET `/api/p2p/v1/pipeline/audit/{task_id}`
获取任务的审计日志（ComplianceReporter 的数据来源之一）。

响应格式参见 hashchain-audit SKILL。

## Python SDK 调用示例

```python
from p2p_app.services.audit_trail import ComplianceReporter, AuditLogger, AuditEvent
from datetime import datetime, timedelta

reporter = ComplianceReporter()

# ── 1. 生成任务合规报告 ──
task_report = reporter.generate_task_report("TASK-A1B2C3D4E5F6")

if 'error' in task_report:
    print(f"❌ {task_report['error']}")
else:
    info = task_report['task_info']
    print(f"📋 任务合规报告")
    print(f"   ID: {info['task_id']}")
    print(f"   类型: {info['task_type']} | 状态: {info['status']}")
    print(f"   安全级别: {info['security_level']} | 隐私级别: {info['privacy_level']}")

    sec = task_report['security_checks']
    print(f"   安全检查: {sec['total_checks']}次 (拦截{sec['blocked_count']}次)")

    chains = task_report['integrity_proof']
    for chain_name, chain_info in chains.items():
        icon = '✅' if chain_info['integrity_ok'] else '❌'
        print(f"   链 [{chain_name}]: {icon} {chain_info['length']}条")

    print(f"   总审计条目: {task_report['total_audit_entries']}")

# ── 2. 生成节点行为报告 ──
now = datetime.now()
node_report = reporter.generate_node_report(
    node_id="node-abc123",
    start_time=now - timedelta(days=30),
    end_time=now,
)

print(f"\n📋 节点行为报告: {node_report['node_info']['node_id']}")
print(f"   类型: {node_report['node_info']['node_type']} | 状态: {node_report['node_info']['status']}")
print(f"   信誉: {node_report['node_info']['reputation_score']}")
print(f"   相关事件: {node_report['related_audit_events']}条")

# ── 3. 生成系统安全快照 ──
snapshot = reporter.generate_system_snapshot()

stats = snapshot['statistics']
print(f"\n📋 系统安全快照 ({snapshot['generated_at']})")
print(f"   活跃任务: {stats['active_task_count']}")
print(f"   在线节点: {stats['online_node_count']}")
print(f"   安全拦截: {stats['security_block_event_count']}")
print(f"   审计总条目: {stats['total_audit_entries']}")

for block in snapshot.get('recent_security_blocks', []):
    print(f"   ⚠️ 拦截: {block.get('event_type')} @ {block.get('logged_at')}")

# ── 4. 结合 AuditLogger 手动查询补充 ──
audit = AuditLogger()
recent_blocks = audit.query_logs(event_type=AuditEvent.SECURITY_BLOCKED, limit=10)
print(f"\n最近安全拦截事件:")
for event in recent_blocks:
    payload = event.get('payload', {})
    gw = payload.get('gateway_result', {})
    print(f"   [{event['logged_at']}] 风险={gw.get('risk_score')} 原因={gw.get('blocked_reason')}")
```

## 哈希链完整性作为合规证据

每份合规报告都包含 `integrity_proof` 字段，提供四条哈希链的不可篡改证明:

| 链名 | 存储内容 | 合规价值 |
|------|---------|---------|
| task_lifecycle | 任务创建→分发→分片分配→心跳→注册 | 证明任务操作链完整 |
| execution_log | 执行开始→完成/失败→结果验证 | 证明执行过程可追溯 |
| security_events | 安全检查通过/拦截→审计报告 | 证明安全策略执行 |
| cost_tracking | 成本路由决策 | 证明费用计算可审计 |

**完整性验证方法**: 对每条链从第一条记录顺序验证 `prev_hash == 前一条hash` 且重算 SHA256 匹配存储值。

## curl 示例

```bash
# 获取任务审计日志 (合规报告的数据基础)
curl http://localhost:8000/api/p2p/v1/pipeline/audit/TASK-A1B2C3D4E5F6

# 获取流水线概览统计
curl http://localhost:8000/api/p2p/v1/pipeline/summary
```

## 触发词
"合规报告", "任务合规", "节点行为报告", "系统快照",
"compliance report", "audit evidence", "integrity proof",
"安全态势", "审计链证明", "合规检查", "监管报告"

## 注意事项与限制
- 报告生成本身会产生一条 `AUDIT_REPORT` 类型审计记录（自指引用）
- 任务报告依赖 `TaskDispatch.objects.get()`，不存在的任务返回 error 字段而非异常
- 节点报告的时间范围查询在内存中的 `_all_entries` 列表进行线性扫描
- 系统快照仅返回非终态活跃任务（created/sharding/dispatching/executing/aggregating）
- 哈希链数据存储在内存中，服务重启后清空（生产环境需对接持久化）
- `generate_system_snapshot()` 不接受参数，始终返回当前时刻的全局状态

## 错误码说明
| 场景 | 返回值 |
|------|--------|
| 任务不存在 | `{ "error": "Task {id} not found", "task_id": "..." }` |
| 节点不存在 | `{ "error": "Node {id} not found", "node_id": "..." }` |
