# P0 统一控制面（M1 MVP）接口与数据结构

> 对应《产品需求梳理与优化规格说明书》P0 里程碑：四平台能力的统一控制面
> 目标：聚合桌面端本地 + 云端各能力单元的运行状态，支持全局动态调整日志级别与查看消费预算闸门额度
> 定位：**内部运维/诊断通道**——能力完全透明、用户无感知、无品牌名、无模块管理面板；数据仅供日志/调试/故障排查消费
> 版本：v2.0 · 2026-08-17（能力透明融合架构）

---

## 1. 范围与设计原则

### 1.1 定位（能力透明融合）

- 四平台（Cloud / Grok / OpenClaw / DSH）能力**吸收为产品内部能力单元**，用户无感知、无品牌名、无模块管理面板
- 本控制面是**内部运维/诊断通道**：仅供日志、调试、故障排查使用，不出现在设置页 UI
- 用户可见的仅有：消费额度（作为独立"用量/费用"功能展示，不并入本通道）、日志级别（作为"高级/开发者选项"）

### 1.2 设计原则

- **单模版**：桌面端与云端共用同一 `ModuleStatus` JSON Schema，便于一套诊断组件渲染
- **复用优先**：桌面端复用现有 `get/set-governance-log-level`、`get-health-*`；云端复用 `health_summary`、`health_monitor`
- **新增收敛**：仅新增 1 个统一聚合 IPC（`modules:get-status`）、3 个 HTTP 端点（云端模块状态 / 日志级别 / 预算额度）
- **降级不阻塞**：云端不可达时，桌面端仍显示本地能力单元状态，云端部分标记 `unhealthy`
- **日志规范**：统一 `[控制面]` 前缀 + 三参调用（message/context/metadata）+ camelCase metadata；不打印 token/密钥，品牌名只出现在内部 `moduleId` 字段

---

## 2. 通用数据结构（两端共用 Schema）

### 2.1 能力单元标识（内部 moduleId 枚举）

> 能力单元 = 四平台能力被吸收后的内部标识，**只出现在内部 context/日志字段，不对外展示品牌名**。

桌面端能力单元（kind = `desktop`）：

| moduleId | 名称 | 对应实现 |
|----------|------|----------|
| `desktop.agent` | 智能体引擎（插件生态，吸收插件化能力） | `electron/events/agentEventBus.ts`、`governanceEngine.ts`、`pluginRegistry.ts` |
| `desktop.mcp` | MCP 服务 | `electron/services/mcpServerService.ts`（127.0.0.1:39876/mcp） |
| `desktop.sandbox` | 沙箱执行器 | `electron/services/apiService.ts`（sandbox_api.py 进程） |
| `desktop.api-proxy` | API 调用监控代理 | `electron/services/apiCallMonitor` |
| `desktop.monitor.cpu` | CPU 监控器 | `electron/services/cpuMonitor` |
| `desktop.monitor.memory` | 内存监控器 | `electron/services/memoryMonitor` |
| `desktop.backend` | 内置后端 | `electron/services/backendService`（localhost:8000） |

云端能力单元（kind = `cloud`）：

| moduleId | 名称 | 对应实现 |
|----------|------|----------|
| `cloud.api` | 云端后端 | `backend/fangdudu_backend` |
| `cloud.celery` | 异步任务 | `health_monitor` 检查 |
| `cloud.redis` | 缓存服务 | `health_monitor` 检查 |
| `cloud.db` | 数据存储 | `health_monitor` 检查 |
| `cloud.budget-gate` | 消费预算闸门 | `backend/auth_app/deepseek_service.py`（DeepSeekBudgetGate） |
| `cloud.inference-engine` | 推理引擎（预留，吸收 Grok 能力） | 未集成，状态恒为 `unknown` |
| `cloud.compute-cluster` | 推理集群（预留，吸收 DSH 能力） | 未集成，状态恒为 `unknown` |

### 2.2 ModuleStatus（核心对象）

```typescript
/** 统一模块状态对象（桌面端 TS 与云端 JSON 结构一致） */
interface ModuleStatus {
  moduleId: string                              // 见 ModuleId 枚举
  name: string                                  // 显示名称
  kind: 'desktop' | 'cloud' | 'plugin'
  state: 'running' | 'stopped' | 'starting' | 'error' | 'unknown'
  health: 'healthy' | 'degraded' | 'unhealthy' | 'unknown'
  version: string                               // 语义化版本，未知为 ''
  lastHeartbeat: number | null                  // 最近心跳 epoch ms
  uptimeSec: number | null                      // 已运行秒数
  metrics: Record<string, number | string>      // 模块相关指标（见 2.3）
  detail?: string                               // 错误信息 / 说明
}
```

### 2.3 各模块 metrics 约定

| moduleId | metrics 键 | 含义 |
|----------|-----------|------|
| `desktop.mcp` | `port` | 监听端口（39876） |
| | `tools` | 已注册工具数 |
| `desktop.sandbox` | `activeJobs` | 运行中任务数 |
| | `totalJobs` | 累计任务数 |
| `desktop.api-proxy` | `enabled` | 是否启用 |
| | `port` | 代理端口 |
| | `captured` | 捕获调用数 |
| `desktop.monitor.cpu` | `usage` | 当前 CPU 使用率 % |
| `desktop.monitor.memory` | `usageMb` | 当前内存 MB |
| | `usagePct` | 当前内存占用 % |
| `desktop.agent` | `events` | 事件总线累计事件数 |
| | `plugins` | 已加载插件数 |
| `desktop.backend` | `port` | 后端端口（8000） |
| `cloud.budget-gate` | `globalUsed` / `globalQuota` | 当日全局调用次数（非金额） |
| | `userUsed` / `userQuota` | 当日用户调用次数 |
| | `circuitOpen` / `circuitOpenedAt` | 熔断是否开启 / 开启时间 epoch ms |
| | `failureRate` / `warnThreshold` / `criticalThreshold` | 失败率 0~1 / 预警阈值%/熔断阈值% |

### 2.4 汇总 ModuleSummary

```typescript
interface ModuleSummary {
  total: number
  healthy: number
  degraded: number
  unhealthy: number
  unknown: number
  // 便捷聚合：全部运行 = healthy，全部正常
  allHealthy: boolean
  lastUpdated: number   // 聚合时间 epoch ms
}
```

### 2.5 日志级别 LogLevel（复用现有枚举）

```typescript
/** 已有实现：electron/services/loggerService.ts 导出 */
enum LogLevel {
  TRACE = 'TRACE',
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}
```

> 注意：枚举成员是 `WARN`，不是 `WARNING`（历史踩坑，见 governanceLogger.test.ts 用例）。

### 2.6 模块日志级别状态

```typescript
interface ModuleLogLevelState {
  defaultLevel: LogLevel        // 全局默认（当前 GovernanceLogger 的 currentLevel）
  overrides: Record<string, LogLevel>   // 按 moduleId 覆盖；缺省表示跟随 defaultLevel
}
```

### 2.7 DeepSeek 额度实时状态

```typescript
interface DeepSeekQuotaStatus {
  globalUsed: number
  globalQuota: number
  userUsed: number
  userQuota: number
  circuitOpen: boolean
  circuitOpenedAt: number | null
  failureRate: number           // 0~1
  warnThreshold: number         // 预警阈值（默认 0.8）
  criticalThreshold: number     // 严重阈值（默认 0.95）
}
```

---

## 3. 桌面端接口（Electron IPC）

### 3.1 `modules:get-status`（新增，统一聚合）

请求：无参数。

响应：

```typescript
interface ModulesGetStatusResponse {
  summary: ModuleSummary
  modules: ModuleStatus[]          // 本地模块 + 云端模块（云端不可达时标记 unhealthy）
}
```

实现要点：
- 本地模块状态取自各服务持有对象（main.ts 中 mcpServerService / apiCallMonitor / cpuMonitor / backendService 的启动状态）
- 云端模块通过 HTTP 拉取 `GET /api/modules/status`（见 §4.1），失败时对应项置 `state='unknown', health='unhealthy'`
- 复用现有 `get-health-metrics` 获取 cpu/memory 指标；`get-plugins` 获取插件数

### 3.2 `modules:get-log-level`（新增强化，复用底层）

请求：无参数。

响应：

```typescript
interface ModulesGetLogLevelResponse {
  state: ModuleLogLevelState
}
```

实现：直接复用现有 `get-governance-log-level`（handlers.ts:421）读取 `GovernanceLogger.getLevel()`。

### 3.3 `modules:set-log-level`（新增强化）

请求：

```typescript
interface ModulesSetLogLevelRequest {
  level: LogLevel                 // 目标级别
  moduleId?: string               // 为空 = 全局；否则仅对该模块覆盖
}
```

响应：

```typescript
interface ModulesSetLogLevelResponse {
  ok: true
  state: ModuleLogLevelState      // 设置后的完整状态
}
```

实现：
- 无 `moduleId`：调用现有 `set-governance-log-level`（handlers.ts:433）→ `GovernanceLogger.setLevel(level)`，全桌面模块共享实例即全局生效（依赖项目硬约束：所有模块注入共享 governanceLoggerInstance）
- 有 `moduleId`：写入 overrides 映射（持久化到配置文件 `getGovernanceLogConfigPath()`）

### 3.4 `modules:get-deepseek-quota`（新增）

请求：无参数。

响应：

```typescript
interface ModulesGetDeepSeekQuotaResponse {
  quota: DeepSeekQuotaStatus
}
```

实现：代理转发 `GET /api/deepseek/quota`（见 §4.3）；云端不可达时返回 `error` 字段。

### 3.5 新增 IPC 注册位置

统一收敛到 `electron/ipc/handlers.ts`，与现有 `get-governance-log-level` / `get-health-metrics` 并列注册。

---

## 4. 云端接口（Django REST）

### 4.1 `GET /api/modules/status`（新增，已实现 ✅）

返回云端各能力单元状态，供桌面端控制面内部诊断通道拉取。summary 由桌面端本地计算，云端不重复返回。

响应：

```json
{
  "modules": [
    {
      "moduleId": "cloud.api", "name": "云端后端", "kind": "cloud",
      "state": "running", "health": "healthy", "version": "1.0.0",
      "lastHeartbeat": 1786970000000, "uptimeSec": null, "metrics": { "debug": 1 }
    },
    {
      "moduleId": "cloud.celery", "name": "异步任务", "kind": "cloud",
      "state": "running", "health": "healthy", "version": "", "lastHeartbeat": 1786970000000, "uptimeSec": null, "metrics": { "workers": 1 }
    },
    {
      "moduleId": "cloud.redis", "name": "缓存服务", "kind": "cloud",
      "state": "running", "health": "healthy", "version": "", "lastHeartbeat": 1786970000000, "uptimeSec": null, "metrics": { "pingMs": 0 }
    },
    {
      "moduleId": "cloud.db", "name": "数据存储", "kind": "cloud",
      "state": "running", "health": "healthy", "version": "", "lastHeartbeat": 1786970000000, "uptimeSec": null, "metrics": {}
    },
    {
      "moduleId": "cloud.budget-gate", "name": "消费预算闸门", "kind": "cloud",
      "state": "running", "health": "healthy", "version": "", "lastHeartbeat": 1786970000000, "uptimeSec": null,
      "metrics": { "globalUsed": 0, "globalQuota": 100, "circuitOpen": 0 }
    },
    {
      "moduleId": "cloud.inference-engine", "name": "推理引擎（预留）", "kind": "cloud",
      "state": "unknown", "health": "unknown", "version": "", "lastHeartbeat": 1786970000000, "uptimeSec": null, "metrics": {}
    },
    {
      "moduleId": "cloud.compute-cluster", "name": "推理集群（预留）", "kind": "cloud",
      "state": "unknown", "health": "unknown", "version": "", "lastHeartbeat": 1786970000000, "uptimeSec": null, "metrics": {}
    }
  ]
}
```

实现要点：
- 视图：`content_app/control_plane_views.py` → `modules_status`（AllowAny，内部诊断读接口）
- 直接健康检查：Redis `ping()`（1s 超时）、数据库 `connection.ensure_connection()`、Celery `control.ping(timeout=1)`；任一项失败回退 `stopped/unhealthy` 并带 `detail`，不抛异常
- `cloud.api` 状态即请求自身成功
- `cloud.budget-gate` 的额度/熔断从 `DeepSeekBudgetGate.get_quota_status()` 读取
- `cloud.inference-engine` / `cloud.compute-cluster` 未集成：`state='unknown', health='unknown'`

### 4.2 `GET/PUT /api/settings/log-level`（新增，已实现 ✅，云端日志级别）

**GET** 响应（需登录 JWT）：

```json
{
  "module": "content_app.deepseek_service",
  "level": "DEBUG",
  "persisted": "DEBUG"
}
```

**PUT** 请求：

```json
{ "level": "DEBUG" }
```

响应：设置后的完整状态（同 GET）。

实现要点：
- 视图：`content_app/control_plane_views.py` → `log_level`（IsAuthenticated；GET/PUT 均需登录）
- 运行时调用 `logging.getLogger('content_app.deepseek_service').setLevel()`，并持久化到 Django cache（90 天 TTL）
- `WARN` 自动归一为 Python 标准级别 `WARNING`；非法级别返回 400
- 语义对齐桌面端 `set-governance-log-level`（全局默认）；后续如需按单 logger 覆盖，在 `VALID_LEVELS` 基础上扩展 `logger` 字段即可

### 4.3 `GET /api/deepseek/quota`（新增，已实现 ✅）

返回消费预算闸门实时状态，供桌面端控制面与消费预警 UI 使用。

响应：

```json
{
  "quota": {
    "day": "20260817",
    "globalUsed": 12, "globalQuota": 100,
    "userUsed": 0, "userQuota": 20,
    "circuitOpen": false, "circuitOpenedAt": null,
    "failureRate": 0.0,
    "warnThreshold": 70, "criticalThreshold": 90
  }
}
```

字段说明：
- `globalUsed`/`globalQuota`：当日全局调用次数 / 全局配额（调用次数据不是金额元）
- `userUsed`/`userQuota`：当日当前用户调用次数 / 用户配额（不展开多个用户，聚合态仅返回总计数）
- `circuitOpen`：熔断门是否打开（`true` → 该时间段不再放行请求）
- `failureRate`：`failures / break_threshold`，最近失败率 0~1
- `warnThreshold`/`criticalThreshold`：配置的预警/临界使用率阈值（百分比）

实现要点：
- 视图：`content_app/control_plane_views.py` → `deepseek_quota`（AllowAny，内部诊断读接口）
- 在 `deepseek_service.py` 的 `DeepSeekBudgetGate` 增加 `get_quota_status()`：从 Django cache（Redis/内存）读取当日全局消耗计数、熔断状态、失败统计
- 阈值从 `settings.DEEPSEEK_BUDGET_WARN_THRESHOLD` / `DEEPSEEK_BUDGET_CRITICAL_THRESHOLD` 读取，默认 70/90%
- 鉴权：AllowAny（因为状态读取不修改，额度聚合无需写入权限，仅内部诊断使用）

---

## 5. 与现有实现复用映射

| 目标接口 | 复用现有 | 新增 |
|----------|----------|------|
| 桌面 `modules:get-status` | `get-health-metrics`、`get-plugins`、各服务持有对象 | 聚合逻辑 + `modules:get-status` 通道 |
| 桌面 `modules:get/set-log-level` | `get/set-governance-log-level`（handlers.ts:421/433）、`GovernanceLogger.setLevel/getLevel` | overrides 按模块覆盖 |
| 桌面 `modules:get-deepseek-quota` | — | 转发 `GET /api/deepseek/quota` |
| 云端 `GET /api/modules/status` | Redis `ping()` / DB `ensure_connection()` / Celery `control.ping()` | `control_plane_views.modules_status`（已实现 ✅） |
| 云端 `GET/PUT /api/settings/log-level` | `logging.getLogger('content_app.deepseek_service').setLevel()` | `control_plane_views.log_level`（已实现 ✅） |
| 云端 `GET /api/deepseek/quota` | `DeepSeekBudgetGate`（Django cache 计数） | `get_quota_status()` 只读方法 + `deepseek_quota` 视图（已实现 ✅） |

---

## 6. 内部诊断消费映射

> 数据仅供日志/调试/故障排查消费，不出现在设置页 UI 模块面板。

| 诊断数据 | 数据来源 | 消费方式 |
|---------|----------|----------|
| 能力单元一览（ID/名称/状态/健康/版本） | `modules:get-status` | 开发者调试工具 / 诊断日志 |
| 每单元 metrics（端口/工具数/CPU/内存/额度） | `modules:get-status`（metrics 字段） | 同上 |
| 日志级别下拉（全局） | `modules:get-log-level` / `modules:set-log-level` | 设置页高级选项 |
| 日志级别按模块覆盖 | `modules:set-log-level`（带 moduleId） | 设置页高级选项 |
| 额度进度条 + 熔断状态 | `modules:get-deepseek-quota` | 作为独立"用量/费用"功能展示，不并入本通道 |
| 汇总卡片（healthy/unhealthy 计数） | `modules:get-status`（summary） | 诊断日志摘要 |

---

## 7. 验收要点

1. ✅ `tsc --noEmit` 零错误；`modules:*` 四个新通道在 `handlers.ts` 注册
2. ✅ 桌面端 `modules:get-status` 返回本地 7 个能力单元 + 云端 7 个能力单元；关闭后端时 `desktop.backend` 与全部 `cloud.*` 显示 `unhealthy`，本地单元不受影响
3. ✅ `modules:set-log-level({ level: 'WARN' })` 后：桌面 debug 埋点（`[事件存储]`/`[事件总线]`）被过滤，warn/error 保留（复用 governanceLogger.test.ts 验证用例）
4. ✅ 云端 `GET/PUT /api/settings/log-level` 运行时调整 `content_app.deepseek_service` 级别（`test_control_plane.py` 验证）
5. ✅ `GET /api/deepseek/quota` 返回与 `DeepSeekBudgetGate` 熔断测试一致的计数（`get_quota_status()` + 视图测试）
6. ✅ 云端 `GET /api/modules/status` 返回 7 个云端能力单元，结构完整、无品牌名
7. ✅ 能力单元命名无品牌名（Grok/DSH/OpenClaw/Cloud 不出现在任何对外展示层）；`[控制面]` 日志遵循三参 + camelCase 规范，无 token/密钥泄漏

---

## 8. 相关文件索引

| 文件 | 用途 |
|------|------|
| `desktop-client-2.0/electron/ipc/handlers.ts` | 新增 `modules:*` 通道注册处 |
| `desktop-client-2.0/electron/events/governanceLogger.ts` | `setLevel/getLevel/loadGovernanceLogLevel/saveGovernanceLogLevel` |
| `desktop-client-2.0/electron/services/loggerService.ts` | `LogLevel` 枚举定义 |
| `desktop-client-2.0/electron/main.ts` | 各服务持有对象（mcpServerService/apiCallMonitor/cpuMonitor/backendService） |
| `desktop-client-2.0/electron/services/moduleControlService.ts` | 桌面端统一控制面（本地 + 云端聚合） |
| `backend/content_app/control_plane_views.py` | 云端三视图：`modules_status` / `deepseek_quota` / `log_level` |
| `backend/content_app/deepseek_service.py` | `DeepSeekBudgetGate.get_quota_status()` 新增 |
| `backend/content_app/test_control_plane.py` | 云端控制面单元测试（7 用例） |
| `backend/fangdudu_backend/urls.py` | 注册 `/api/modules/status`、`/api/deepseek/quota`、`/api/settings/log-level` |
| `backend/fangdudu_backend/settings.py` | `DEEPSEEK_DAILY_CALL_LIMIT`、`DEEPSEEK_CIRCUIT_BREAKER_*`、`LOGGING` 配置 |