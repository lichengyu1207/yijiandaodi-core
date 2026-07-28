---
name: "result-aggregator"
description: "结果聚合器 Skill。当需要收集多个分片执行结果、解决结果冲突(共识机制)、合并有序输出、生成聚合报告时调用。"
---

# 结果聚合器 (ResultAggregator)

## 概述
任务执行的最终阶段组件，负责将分布式节点上并行执行的多个分片结果**收集、共识裁决、有序合并**为最终输出。采用多数投票(majority voting)+信誉加权+拓扑排序的三层策略确保结果一致性。

对应 Service: `ResultAggregator` (`backend/p2p_app/services/aggregator.py`)

**注意**: ResultAggregator 主要通过 Service 层调用，也可通过 `SandboxExecutor.ResultCollector` 收集结果。不提供独立 HTTP 端点，但相关数据可通过 Task Detail API 查看。

## 核心流程

```
TaskDispatch (N个Shard)
  │
  ├─ Shard 1 → [Result@NodeA, Result@NodeB, Result@NodeC] ──┐
  ├─ Shard 2 → [Result@NodeD, Result@NodeE]                  │
  ├─ Shard 3 → [Result@NodeF]                                │
  └─ Shard 4 → [Result@NodeG, Result@NodeH]                 │
                                                             │
                                              ResultAggregator│
                                              .aggregate()    │
                                                             ▼
                                    TaskAggregationResult
                                    ├── overall_status: completed/partial/failed
                                    ├── merged_output: 合并后的最终结果
                                    ├── conflict_shards: 冲突分片列表
                                    └── shard_details: 每片共识详情
```

## 共识机制 (ConsensusStatus)

| 共识状态 | 条件 | 处理策略 |
|---------|------|---------|
| **unanimous** (全票一致) | 所有结果的 stdout 完全相同 | 直接接受 |
| **majority** (多数一致) | ≥50% 结果相同 | 接受多数方，标记异见节点 |
| **conflict** (冲突) | 无绝对多数 | 进入冲突解决流程 |

## 冲突解决策略 (resolve_conflict)

当出现 conflict 时，按以下优先级逐步尝试:

1. **多数投票**: stdout 相同数 ≥ ceil(total/2)，取该组最优节点
2. **响应时间排序**: 平局时选择 `execution_time_ms` 最小的结果
3. **信誉分排序**: 仍平局时选择 `reputation_score` 最高的结果

**每组内最优节点选择** (`_select_best_from_group`):
- 优先比较信誉分（越高越好）
- 信誉相同时比较响应时间（越短越好）

## 结果合并策略 (_merge_ordered_results)

按分片的 **拓扑顺序**（依赖关系）合并，而非简单的序列号顺序:

| 推断的任务类型 | 合并策略 | 输出格式 |
|--------------|---------|---------|
| `text` | 换行连接各分片 stdout | `"merged_output": "...\n..."` |
| `code` | 模块化组装 | `"merged_output": {"modules": [...]}` |
| `file` | 分片偏移记录 | `"merged_output": {"total_length": N, "parts": [...]}` |
| `mixed` (默认) | 字典形式 | `"merged_output": {shard_id: result, ...}` |

**任务类型推断** (`_infer_task_type`): 取前 3 个分片的 stdout 样本，统计 code/text 指示词占比。

## 数据结构

### ShardResultSummary (单分片聚合结果)
```python
@dataclass
class ShardResultSummary:
    shard_id: str                    # 分片ID
    consensus_status: ConsensusStatus # unanimous/majority/conflict
    accepted_result: Optional[dict]   # 被接受的结果 {stdout, exit_code, node_id}
    flagged_node_ids: list[str]       # 被标记的可疑节点ID列表
    all_results: list[dict]           # 该分片的所有结果列表
```

### TaskAggregationResult (任务聚合结果)
```python
@dataclass
class TaskAggregationResult:
    task_id: str                      # 任务ID
    status: str                       # completed/partial/failed
    total_shards: int                 # 总分片数
    completed_shards: int             # 已完成分片数
    failed_shards: int                # 失败分片数
    result_summary: dict              # 合并后的最终结果
    conflict_shards: list[str]        # 存在冲突的分片ID列表
```

## Python SDK 调用示例

```python
from p2p_app.services.aggregator import ResultAggregator, ConsensusStatus
from p2p_app.services.execution_engine import ResultCollector

# ── 1. 聚合整个任务的所有分片结果 ──
aggregator = ResultAggregator()
result = aggregator.aggregate("TASK-A1B2C3D4E5F6")

print(f"任务状态: {result.status}")           # completed / partial / failed
print(f"分片: {result.completed_shards}/{result.total_shards}")
print(f"冲突分片: {result.conflict_shards}")  # 有冲突的分片列表

# ── 2. 查看最终合并结果 ──
merged = result.result_summary
print(f"推断的任务类型: {merged.get('inferred_task_type')}")
print(f"合并输出: {merged.get('merged_output')}")
print(f"分片详情数: {merged.get('shard_count')}")

for detail in merged.get('shard_details', []):
    flag_info = f" 标记节点: {detail['flagged_nodes']}" if detail['flagged_nodes'] else ""
    print(f"  {detail['shard_id']}: {detail['consensus']}{flag_info}")

# ── 3. 仅收集结果（不做共识裁决）──
collector = ResultCollector()
collected = collector.collect(task_dispatch_obj)
print(f"总耗时: {collected['total_execution_time_ms']}ms")
print(f"聚合输出:\n{collected['aggregated_stdout']}")

# ── 4. 生成人类可读摘要 ──
summary = collector.generate_result_summary(task_dispatch_obj)
print(summary['human_readable'])
# 输出示例:
# 任务 TASK-XXX 执行报告
# ==================================================
# 总状态: 全部完成
# 分片统计: 4/4 完成, 0 失败, 0 待处理
# 总耗时: 350ms
#
# 分片明细:
#   ✅ 分片#1 | 节点=node-a | 耗时=80ms | 退出码=0
#   ✅ 分片#2 | 节点=node-b | 耗时=120ms | 退出码=0
#   ✅ 分片#3 | 节点=node-c | 耗时=90ms | 退出码=0
#   ✅ 分片#4 | 节点=node-d | 耗时=60ms | 退出码=0
#
# --- 输出 ---
# [Shard-1] result from shard 1
# [Shard-2] result from shard 2
# ...

# ── 5. 验证结果签名防篡改 ──
is_valid = ResultCollector.validate_result_signature(shard_result_obj)
print(f"签名有效: {is_valid}")
```

## 聚合状态判断逻辑

```python
completed_count = 有结果且状态正常的分片数
failed_count = status=='failed' 的分片数
pending_count = 既无结果也未失败的分片数
total = 总分片数

if pending_count > 0 and completed_count > 0:
    status = "partial"        # 部分完成
elif completed_count == total:
    status = "completed"       # 全部完成
elif failed_count >= total or completed_count == 0:
    status = "failed"          # 全部失败或无有效结果
else:
    status = "partial"         # 其他情况
```

## 触发词
"结果聚合", "共识机制", "分片合并", "冲突解决", "多数投票",
"result aggregation", "consensus", "shard merge",
"output collection", "结果汇总", "最终结果生成",
"拓扑排序合并", "信誉加权裁决"

## 注意事项与限制
- **原子性保证**: 聚合过程在 `transaction.atomic()` 中执行
- **状态更新**: 聚合完成后自动更新 `TaskDispatch.status` 和 `result_summary`
- **拓扑排序**: 依赖 DAG 中声明的分片依赖关系，无依赖时按 sequence 排序
- **内存操作**: 当前版本所有数据在内存中处理，超大任务可能需要分批聚合
- **不可重入**: 同一任务的重复聚合会覆盖之前的 result_summary
- 冲突节点的 `flagged_node_ids` 会影响该节点的后续信誉评估

## 错误码说明
| 异常 | 说明 |
|------|------|
| Task.DoesNotExist | `aggregate()` 时任务不存在，抛出 `P2PServiceError` |
| No results available | `aggregate_shard()` 时某分片无结果，抛出 `P2PServiceError` |
| Topological sort mismatch | 拓扑排序结果与预期不一致（可能有环），记录 warning 日志 |
