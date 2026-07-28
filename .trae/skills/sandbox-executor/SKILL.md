---
name: "sandbox-executor"
description: "沙箱执行引擎 Skill。当需要在隔离环境中执行代码、运行沙箱任务、收集分片执行结果时调用。支持 Python/JS/TS/Bash/HTML 多语言。"
---

# 沙箱执行引擎 (SandboxExecutor)

## 概述
L6 层核心执行组件，提供隔离沙箱环境中的代码执行能力。包含三阶段处理: **CodeAnalyzer 预检 → 子进程隔离执行 → ResultCollector 结果聚合**。

对应 Service: `SandboxExecutor` + `CodeAnalyzer` + `ResultCollector` (`backend/p2p_app/services/execution_engine.py`)

核心能力:
- **多语言执行**: Python / JavaScript / TypeScript / Bash / HTML
- **安全预检**: 语言白名单 + 危险模式匹配 + 复杂度评估
- **资源限制**: 内存 512MB / CPU 300s / 磁盘 256MB / 输出 10MB
- **结果签名**: SHA256 数字签名防篡改
- **结果聚合**: 多分片结果收集、合并、人类可读报告生成

## 沙箱配置常量 (SandboxConfig)

| 配置项 | 值 | 说明 |
|-------|-----|------|
| MAX_MEMORY_MB | 512 | 最大内存限制 |
| MAX_CPU_SECONDS | 300 | 最大 CPU 时间(秒) |
| MAX_DISK_MB | 256 | 最大磁盘使用(MB) |
| MAX_OUTPUT_SIZE | 10MB | stdout/stderr 最大截断大小 |
| ALLOWED_LANGUAGES | python/javascript/typescript/bash/html | 语言白名单 |

## 危险模式检测 (BLOCKED_PATTERNS)
`import os.system`, `import subprocess`, `eval(`, `exec(`, `__import__`,
`open("/etc`, `open("/proc`, `rm -rf /`, `chmod 777`, `.env"`, `socket.socket`

## API 端点

### POST `/api/p2p/v1/pipeline/execute`
统一执行流水线入口（L3→L2→L4→L5→L6→L7 全链路），内部会调用 SandboxExecutor。

**请求体**:
```json
{
  "workflow_type": "ai_execute",
  "input_content": "print('hello world')",
  "security_level": "normal",
  "priority": "normal"
}
```

**响应**:
```json
{
  "success": true,
  "task_id": "TASK-A1B2C3D4E5F6",
  "stages": [
    {
      "stage": "L3",
      "stage_name": "ASS安全网关",
      "status": "completed",
      "duration_ms": 15,
      "summary": "风险评分: 5.0, 威胁数: 0"
    },
    {
      "stage": "L2",
      "stage_name": "任务编排引擎",
      "status": "completed",
      "summary": "工作流: WF-xxx, 任务: TASK-xxx, 分片数: 4"
    },
    {
      "stage": "L4+L5",
      "stage_name": "成本路由 + P2P调度",
      "status": "completed",
      "summary": "已分配 4 个分片"
    },
    {
      "stage": "L6",
      "stage_name": "沙箱执行引擎",
      "status": "completed",
      "duration_ms": 125,
      "summary": "exit_code=0, 耗时=125ms",
      "details": {
        "exit_code": 0,
        "stdout": "hello world\n",
        "stderr": "",
        "execution_time_ms": 125,
        "resource_usage": {
          "language": "python",
          "timeout_seconds": 30,
          "analysis_warnings": []
        }
      }
    },
    {
      "stage": "L7",
      "stage_name": "白盒审计存证",
      "status": "completed",
      "summary": "审计ID: abc123..."
    }
  ],
  "result": { /* L6 阶段 details */ },
  "total_duration_ms": 280,
  "created_at": "2024-06-07T10:00:00"
}
```

### POST `/api/p2p/v1/tasks/{task_id}/shards/{shard_id}/result`
提交单个分片的执行结果（节点端调用）。

**请求体**:
```json
{
  "shard_id": "TASK-XXX-SHARD-0001",
  "exit_code": 0,
  "stdout": "执行结果输出",
  "stderr": "",
  "execution_time_ms": 150,
  "resource_usage": { "memory_mb": 64, "cpu_seconds": 0.5 },
  "result_signature": "sha256-hash-of-result"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "ack": true,
    "shard_status": "completed",
    "task_completed_shards": 3
  }
}
```

## Python SDK 调用示例

```python
from p2p_app.services.execution_engine import SandboxExecutor, CodeAnalyzer, ResultCollector

# ── 1. 代码预检 ──
analyzer = CodeAnalyzer()
analysis = analyzer.analyze(code="print('hello')", language="python")
# 返回: {'safe': True, 'risk_level': 'low', 'warnings': [], 'estimated_resources': {...}}

if not analysis['safe']:
    print(f"❌ 预检未通过: {analysis['warnings']}")
else:
    print(f"✅ 风险等级: {analysis['risk_level']}")

# ── 2. 沙箱执行 ──
executor = SandboxExecutor()
result = executor.execute(
    code="print('hello world')\nresult = 2 + 3\nprint(result)",
    language="python",
    timeout=30,
)
# 返回:
# {
#   'exit_code': 0,
#   'stdout': 'hello world\n5\n',
#   'stderr': '',
#   'execution_time_ms': 45,
#   'resource_usage': {...},
# }

print(f"退出码: {result['exit_code']}")
print(f"输出: {result['stdout']}")
if result['exit_code'] != 0:
    print(f"错误: {result['stderr']}")

# ── 3. 执行完整分片 ──
exec_result = executor.execute_shard(shard, node_id="node-001")
# 自动更新 ShardResult + 更新 TaskShard 状态

# ── 4. 收集聚合结果 ──
collector = ResultCollector()
collected = collector.collect(task)  # 聚合所有分片结果
summary = collector.generate_result_summary(task)  # 人类可读摘要
print(summary['human_readable'])

# ── 5. 验证结果签名 ──
is_valid = ResultCollector.validate_result_signature(shard_result_obj)
```

## 代码复杂度评估指标
| 指标 | 低风险 | 中风险阈值 | 说明 |
|------|-------|-----------|------|
| 代码行数 | ≤500 | >500 行 | 可能影响效率 |
| 循环嵌套深度 | ≤5 | >5层 | 可能长时间运行 |
| 导入数量 | ≤20 | >20个 | 依赖安全性确认 |

## 风险等级
| 等级 | 含义 | 是否可执行 |
|------|------|-----------|
| low | 安全 | ✅ 允许 |
| medium | 有警告 | ⚠️ 允许(记录警告) |
| high | 检测到危险模式 | ❌ 拒绝执行 |
| critical | 不支持的语言 | ❌ 拒绝执行 |

## curl 示例

```bash
# 通过统一流水线执行代码
curl -X POST http://localhost:8000/api/p2p/v1/pipeline/execute \
  -H "Content-Type: application/json" \
  -d '{
    "input_content": "print(42 * 17)",
    "workflow_type": "python",
    "security_level": "normal"
  }'

# 提交分片结果
curl -X POST http://localhost:8000/api/p2p/v1/tasks/TASK-XXX/shards/TASK-XXX-SHARD-0001/result \
  -H "Content-Type: application/json" \
  -d '{
    "exit_code": 0,
    "stdout": "714",
    "execution_time_ms": 25
  }'
```

## 触发词
"代码执行", "沙箱运行", "sandbox execute", "代码预检", "安全执行",
"隔离执行", "结果收集", "分片执行", "代码分析", "run code",
"execute task", "output collection", "结果签名验证"

## 注意事项与限制
- **不支持的语言直接返回 exit_code=-1**，不会尝试执行
- **危险模式检测到即拒绝** (exit_code=-1)，不进入子进程
- **超时默认 30s**，超时后进程被 kill (exit_code=-9)
- **输出截断 10MB**，超出部分自动截断并附加提示
- **临时目录自动清理**，无论执行成功与否
- **结果签名基于 SHA256**，用于防篡改检测
- 子进程使用 `shell=False`，防止 shell 注入

## 错误码说明
| 错误码 | HTTP状态 | 含义 |
|-------|---------|------|
| P2P_0003 | 404 | 任务或分片不存在 |
| P2P_0005 | 422 | 结果提交参数校验失败 |
| exit_code=-1 | N/A | 安全预检未通过 |
| exit_code=-2 | N/A | 沙箱内部异常 |
| exit_code=-9 | N/A | 执行超时(SIGKILL) |
