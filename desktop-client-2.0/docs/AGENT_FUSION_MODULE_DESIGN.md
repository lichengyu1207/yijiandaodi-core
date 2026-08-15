# 一鉴到底 · 治理型 Agent 融合 — 模块级设计（可落地）

> 定位：本文件是 [AGENT_FUSION_ARCHITECTURE.md](./AGENT_FUSION_ARCHITECTURE.md) 的下沉实现设计。
> 架构文档回答"从哪拿、拿什么"；本文件回答"建哪些文件、接口长什么样、怎么接现有代码"。
> 目标：把三份源码的"执行能力"装进 `desktop-client-2.0`，让四官协同从"被动等请求"变"事件驱动自动规划"，且所有执行动作必经四官 + 五元组存证。

---

## 0. 研读深化结论（相对架构文档的新增信息）

三份源码的关键接口已精读，以下是后续设计直接引用的"原样签名"：

### 0.1 Claude Code Tool 接口（`claude-code-main/src/Tool.ts`）
现代版 Tool 是"鸭子类型对象"（非 class）：

```ts
export type Tool<Input = AnyObject, Output = unknown> = {
  name: string
  aliases?: string[]
  searchHint?: string
  call(args, context: ToolUseContext, canUseTool, parentMessage, onProgress?): Promise<ToolResult<Output>>
  description(input, options): Promise<string>
  readonly inputSchema: Input              // Zod schema
  readonly inputJSONSchema?: ToolInputJSONSchema
  outputSchema?: z.ZodType<unknown>
  isEnabled(): boolean
  isConcurrencySafe(input): boolean        // true=并发安全（只读）可批量并行
  isReadOnly(input): boolean               // 决定是否走 permission
  isDestructive?(input): boolean           // 删除/覆盖/发送 等不可逆操作
  maxResultSizeChars: number               // 输出超限落盘，模型只收 preview
  interruptBehavior?(): 'cancel' | 'block'
  strict?: boolean
}
export type Tools = readonly Tool[]
```

`TOOL_DEFAULTS` 兜底：`isEnabled→true`、`isConcurrencySafe→false`（默认不并行）、`isReadOnly→false`（默认写）、`isDestructive→false`、`checkPermissions→{ behavior:'allow' }`。
→ **这套接口就是事件总线里 `ToolCallRequestData`（readonly/permission 字段）的完整来源。**

### 0.2 Grok ToolBridge（`xai-grok-tools/src/bridge.rs`）
```rust
struct ToolBridge { registry: Arc<FinalizedToolset>, terminal: Option<Arc<dyn TerminalBackend>> }
call(client_function_name, client_params, tool_call_id) -> Result<ToolRunResult, ToolError>  // 唯一分发入口
tool_definitions() -> Vec<ToolDefinition>      // 由注册表生成 schema 暴露给模型（.to_json_schema()）
register_mcp_tools(mcp_name, tool, input_schema) -> Result<()>   // 动态注册
unregister_tool_by_name(name) -> bool          // 动态注销
unregister_tools_by_prefix(prefix) -> usize
ToolBridgeResult { output: ToolOutput, prompt_text: String }     // 双通道：干净JSON + 喂模型文本
```
`retry.rs`：`BackoffConfig { max_retries, base_delay_ms, max_delay_ms }`，`calculate_delay(attempt)=min(base*2^(attempt-1), max_delay_ms)`，`execute_with_backoff(config, execute, on_retry)`。
输出上限常量 `DEFAULT_TOOL_OUTPUT_BYTES=40_000`。

### 0.3 OpenClaw 事件总线 + 插件运行时（`src/infra/agent-events.ts` / `src/plugins/runtime.ts`）
```ts
AgentEventPayload { runId, seq, stream, ts, data, lifecycleGeneration?, sessionKey?, sessionId?, agentId? }
onAgentEvent(listener) -> unsubscribe          // 订阅，返回退订函数
emitAgentEvent(event)                          // 发布（分配 seq/ts + 上下文戳）
state = { seqByRun: Map, listeners: Set, auditListeners: Set }
PluginRegistry：activeRegistry / setActivePluginRegistry / getActivePluginRegistry
syncPluginAgentEventBridge(): onAgentEvent → dispatchPluginAgentEventSubscriptions   // 事件桥接插件
markPluginRegistryActive / markPluginRegistryRetired（loaded/retired 生命周期）
withPluginRegistrationContext(registry, pluginId, run)          // 注册期上下文
runOncePerAgentRun(runId, operation, run)      // 单飞去重（一次 run 只执行一次操作）
```
→ 事件模型已被本项目的 `agentEventBus.ts` 完整移植；**插件运行时（M7）是本次新增。**

### 0.4 后端四官 API（对接点，现有核心不动）
`fangdudu_backend/urls.py` 挂载 `api/agent/`：
| 端点 | 视图 | 职责 |
|---|---|---|
| `POST /api/agent/flow/` | AgentFlowView | 顺序工作流 `[auditor→verifier→archiver→judge]`（四官） |
| `POST /api/agent/public/<action>/` | AgentPublicViewSet | 单官执行（agent_code: auditor/verifier/archiver/judge） |
| `POST /api/agent/verification/` | AgentVerificationViewSet | 文件篡改校验（`_verify_file`） |
| `GET/POST /api/agent/tools/` | GrokToolsViewSet | 后端工具调用桥 |
| `GET/POST /api/agent/memory/` + `/memory/search/` | GrokMemoryViewSet | 五元组链式存证（LongTermMemory） |

---

## 1. 现状盘点

| 能力 | 现状 | 缺口 |
|---|---|---|
| 感知层监控 | file/clipboard/process/network/api_call/memory/cpu 全部就绪 | 仍是"回调式"（`setRiskDetectedCallback`），**未 publish 到事件总线** |
| 事件总线 | `agentEventBus.ts`（OpenClaw 模型）已建，生产配置已应用 | 无消费者接入、无插件订阅 |
| 治理日志 | `governanceLogger.ts` + 节流已建 | — |
| 执行层 | 只有 `拦截/放行`（showRiskConfirmDialog / smartAlerter） | **无 ToolRegistry / ToolBridge**（核心缺口） |
| 决策层 | `riskDetectedCallback` 里硬编码"解析→评分→告警" | **无 GovernanceEngine 主循环**，四官不在桌面端 |
| 四官协同 | 在后端（agent-flow API） | 桌面端未调用 |
| 五元组存证 | 后端 LongTermMemory / 本地 storageService | 桌面端执行结果未回写 |
| Skill 插件化 | 无 | 无 PluginRegistry |

---

## 2. 新增模块树

```
desktop-client-2.0/electron/
├── agent/                        # ← 本次新增：执行层 + 决策层 + 插件化
│   ├── types.ts                  # 统一类型：Tool / ToolResult / ToolContext / Planner / AgentAction
│   ├── toolRegistry.ts           # M1 工具注册表（Grok registry 思路）
│   ├── toolBridge.ts             # M2 执行分发桥（Grok bridge.call + tool_definitions）
│   ├── retryWithBackoff.ts       # M3 指数退避重试（Grok retry.rs）
│   ├── planner.ts                # M5a 规划接口 + RulePlanner（LLMPlanner 预留）
│   ├── governanceEngine.ts       # M5b 决策层主循环（Claude queryLoop 三件套的轻量版）
│   ├── pluginRegistry.ts         # M7 Skill 插件注册表（OpenClaw plugin runtime）
│   └── tools/                    # 内置治理工具
│       ├── file.ts               #   file.read / file.write / file.search
│       ├── verify.ts             #   verify.run（调后端四官 verification/flow）
│       ├── evidence.ts           #   evidence.commit（五元组存证）
│       ├── report.ts             #   report.generate（审计报告）
│       ├── risk.ts               #   risk.mark（标记风险文件）
│       └── backend.ts            #   backend.call（后端 grok-tools / flow 桥）
└── events/
    └── monitorEventAdapter.ts    # M6 监控器事件化适配层（回调→publish）
```

---

## 3. 模块详细设计

### M1 `toolRegistry.ts` — 工具注册表
- **来源**：Grok `FinalizedToolset` 注册表 + Claude `Tool`/`TOOL_DEFAULTS` 接口。
- **职责**：登记工具、按名查找、动态增删、生成 schema 清单（`toolDefinitions`）。
- **接口**：

```ts
// agent/types.ts —— 统一工具定义（Claude 风格，含 Grok 分发所需字段）
export interface GovTool<Input = Record<string, unknown>, Output = unknown> {
  name: string
  description: string                       // 暴露给规划层/模型的说明
  inputSchema?: Record<string, unknown>     // JSON Schema（对齐 Grok ToolDefinition）
  isConcurrencySafe(input?: Input): boolean // 默认 false
  isReadOnly(input?: Input): boolean        // 默认 false
  isDestructive?(input?: Input): boolean
  maxResultSizeChars?: number               // 默认 40_000（对齐 Grok 常量）
  run(input: Input, ctx: ToolContext): Promise<ToolResult<Output>>
}

export interface ToolContext {
  runId: string
  agentId?: string
  canUseTool?: (tool: string, input: unknown) => Promise<boolean>  // 权限钩子（对齐 Claude canUseTool）
  onProgress?: (p: { tool: string; detail: string }) => void
}

export interface ToolResult<Output = unknown> {
  output: Output        // 干净 JSON（对齐 Grok ToolBridgeResult.output，供验证/存证）
  content: string       // prompt_text（对齐 Grok ToolBridgeResult.prompt_text，供规划层消费）
  is_error?: boolean
}
```

```ts
// toolRegistry.ts
export class ToolRegistry {
  register(tool: GovTool): void                       // 对齐 registry.register_tool
  unregisterByName(name: string): boolean             // 对齐 unregister_tool_by_name
  unregisterByPrefix(prefix: string): number          // 对齐 unregister_tools_by_prefix
  get(name: string): GovTool | undefined
  has(name: string): boolean
  toolDefinitions(): { name: string; description: string; inputSchema?: unknown }[]  // 对齐 tool_definitions()
  size: number
}
```
- **对接**：`main.ts` 初始化时 `registry.register(...内置工具)`；Skill 插件（M7）用 `register` 动态注入。

### M2 `toolBridge.ts` — 执行分发桥
- **来源**：Grok `ToolBridge.call / try_parse / tool_definitions`。
- **职责**：唯一执行入口。`call(name, params, toolCallId)` 做"查找→权限→执行→产出双通道结果"。它同时是事件总线 `tool` 流的**消费者**（消费 `ToolCallRequestData`）与**生产者**（产出 `ToolCallResultData`）。
- **接口**：

```ts
// toolBridge.ts
export class ToolBridge {
  constructor(registry: ToolRegistry, opts: { onProgress?: (p) => void })
  // 对齐 Grok bridge.call(client_function_name, client_params, tool_call_id)
  async call(name: string, params: unknown, toolCallId: string): Promise<ToolResult>
  // 对齐 Grok try_parse：只校验不执行
  async tryParse(name: string, params: unknown): Promise<{ ok: boolean; error?: string }>
  toolDefinitions(): ReturnType<ToolRegistry['toolDefinitions']>
}
```
- **实现要点**：
  1. 找不到工具 → `ToolError('tool_not_found')`
  2. `canUseTool` 权限钩子（对接现有 `showRiskConfirmDialog` 二次确认 + 四官裁决）
  3. 结果超 `maxResultSizeChars` 截断/落盘（对齐 Grok 输出上限治理）
  4. 执行全程向 `tool` 流发布 `ToolCallRequestData`/`ToolCallResultData`（复用事件总线已有类型，`id` 三端贯通）

### M3 `retryWithBackoff.ts` — 指数退避重试
- **来源**：Grok `retry.rs`（直接逐行移植，纯函数）。
- **接口**（与 Rust 一一对应）：

```ts
export interface BackoffConfig { maxRetries: number; baseDelayMs: number; maxDelayMs: number }
export const DEFAULT_BACKOFF: BackoffConfig = { maxRetries: 10, baseDelayMs: 1000, maxDelayMs: 30000 }
export function calculateDelay(config: BackoffConfig, attempt: number): number // min(base*2^(attempt-1), maxDelayMs)
export async function executeWithBackoff<T, E = unknown>(
  config: BackoffConfig,
  execute: () => Promise<T>,
  onRetry?: (attempt: number, maxRetries: number, delayMs: number) => void | Promise<void>,
): Promise<T>   // 最后一次错误上抛
```
- **对接**：`verify.run`、`evidence.commit`、`backend.call` 等网络型工具统一包一层。

### M4 内置治理工具（`agent/tools/`）
| 工具 | 名称 | 只读 | 并发安全 | 对接 |
|---|---|---|---|---|
| 读文件 | `file.read` | ✅ | ✅ | `fs` 流式读（遵循 >5MB 异步 + 哈希流式约束） |
| 写文件 | `file.write` | ❌ | ❌ | `fs`，写前过 `canUseTool`（二次确认） |
| 搜文件 | `file.search` | ✅ | ✅ | glob/grep 封装 |
| 修复文件 | `file.restore` | ❌ | ❌ | 从 hashchain 快照还原（预留，接存证） |
| 四官校验 | `verify.run` | ✅ | ✅ | `POST /api/agent/verification/`（带 JWT） |
| 四官工作流 | `verify.flow` | ✅ | ✅ | `POST /api/agent/flow/`（auditor→…→judge） |
| 五元组存证 | `evidence.commit` | ❌ | ❌ | `POST /api/agent/memory/`（LongTermMemory 链式哈希）或本地 storageService |
| 审计报告 | `report.generate` | ✅ | ✅ | 聚合事件流 + 存证链 |
| 风险标记 | `risk.mark` | ❌ | ❌ | 写本地风险标签（taintTracking 联动） |
| 后端工具桥 | `backend.call` | 看工具 | 看工具 | `GET/POST /api/agent/tools/`（Grok 工具后透传） |

> 设计约束：**写类工具（file.write / evidence.commit / risk.mark）默认 `isConcurrencySafe=false`，串行执行**，与 Claude `toolOrchestration` 的 readonly 分区一致；且写类工具强制过 `canUseTool`（四官裁决 + 二次确认），保证"执行层不可越权"（继承 Grok 沙箱思想）。

### M5 `governanceEngine.ts` + `planner.ts` — 决策层主循环
- **来源**：Claude `queryLoop` 三件套（收集→行动→验证）的事件流轻量版。
- **关键决策**：桌面端无本地 LLM，"规划"不依赖模型——用**可插拔 Planner** 解耦：
  - `RulePlanner`（默认）：风险事件 → 规则路由 → 拆解子任务（调哪个官/走哪条路径）→ 产出 `AgentAction[]`
  - `LLMPlanner`（预留）：调后端 `POST /api/agent/chat/`（AgentChatView）做真实规划，接口不变
- **接口**：

```ts
// planner.ts
export interface AgentAction {
  tool: string                  // 工具名
  input: Record<string, unknown>
  readonly?: boolean            // 并发安全（对齐 ToolCallRequestData）
  agentId?: string              // 子代理：auditor/verifier/archiver/judge
  runId: string
}

export interface Planner {
  plan(event: AgentEventEnvelope, risk?: RiskEventData): Promise<AgentAction[]>
}
export class RulePlanner implements Planner { ... }
```

```ts
// governanceEngine.ts —— 主循环
export class GovernanceEngine {
  constructor(deps: { bus: AgentEventBus; bridge: ToolBridge; planner: Planner; logger: GovernanceLoggerLike })
  start(): void      // 订阅感知流（file/process/network/clipboard/api_call/resource）
  stop(): void
  private async handleEvent(env: AgentEventEnvelope): Promise<void>
  // 三件套（对齐 queryLoop）：
  //  ① plan()    事件/风险 → 拆解成 AgentAction[]（规则路由；可选 LLM）
  //  ② run()     bridge.call(...) 执行；readonly 批量并行 / 非 readonly 串行
  //  ③ followUp() 结果验证（verify.run/verify.flow）→ 是否续轮（存证/裁决/告警）
}
```
- **接线**：`handleEvent` 内按 severity/riskScore 分级：info→只发事件；warning→`verify.run`；critical→`verify.flow`（四官全流程）+ `evidence.commit` + `smartAlerter`。
- **子代理（四官）**：以"工具 + agentId"形式参与，`agentId` 落在事件信封上，天然进入五元组存证链（对齐 Claude AgentTool 子代理思想，但子代理=后端四官 API）。

### M6 `events/monitorEventAdapter.ts` — 监控器事件化适配层
- **来源**：OpenClaw 事件模型（已落地）；作用是把现有"回调"改成"发事件"，**不动监控器检测逻辑**。
- **职责**：持有各 monitor 的 `setXxxCallback`，回调里 `bus.publish(stream, data)`；同时保留现有 `showRiskAlert / updatePetState` 作为事件**消费者**（兼容现有 UI）。
- **映射**：`fileMonitor→file`、`processMonitor→process`、`networkMonitor→network`、`clipboardMonitor→clipboard`、`apiCallMonitor→api_call`、`memory/cpu→resource`、服务生命周期→`lifecycle`。
- **接入点**：`main.ts` 里把 `riskDetectedCallback` 等改成"先 publish 再消费"，与 `GovernanceEngine.start()` 的订阅对接。

### M7 `pluginRegistry.ts` — Skill 插件化
- **来源**：OpenClaw `plugins/runtime.ts`（activeRegistry + 事件桥 + 生命周期 + 单飞）。
- **职责**：把 Skill 模板注册成插件，插件订阅事件流，无需改主进程。
- **接口**（对齐 OpenClaw 命名）：

```ts
// pluginRegistry.ts
export interface GovPlugin {
  id: string
  version?: string
  subscribe?: (bus: AgentEventBus) => (() => void)[]   // 返回退订数组
  registerTools?: (registry: ToolRegistry) => void     // 插件可注入工具
  status?: 'loaded' | 'retired'
}
export class PluginRegistry {
  setActive(registry: PluginRegistry): void   // markPluginRegistryActive
  install(plugin: GovPlugin, bus: AgentEventBus, tools: ToolRegistry): void
  uninstall(id: string): void                 // markPluginRegistryRetired + cleanup
  list(): GovPlugin[]
  // 事件桥：bus.onAgentEvent → dispatchPluginAgentEventSubscriptions（单飞去重 runOncePerAgentRun）
}
```
- **单飞去重**：同一 `runId` 同一操作只执行一次（对齐 OpenClaw `runOncePerAgentRun`），防止重复触发多轮治理。

### M8 接线（`main.ts` + `di/container.ts` + `events/index.ts` 导出扩展）
1. `events/index.ts` 增加导出：`ToolRegistry`、`ToolBridge`、`GovernanceEngine`、`PluginRegistry`、`retryWithBackoff`、内置工具工厂。
2. `main.ts` 组装顺序：
   ```
   governanceLogger → agentEventBus（已有）
   → ToolRegistry（注册内置工具）
   → ToolBridge(registry)
   → RulePlanner + GovernanceEngine(bus, bridge, planner)
   → PluginRegistry（安装 Skill 插件，可选）
   → MonitorEventAdapter（把 6 个 monitor 回调改为 publish）
   → GovernanceEngine.start()
   → 现有 showRiskAlert/updatePetState 改为事件消费者（保留）
   ```
3. 生命周期：`cleanup()` 里 `governanceEngine.stop()` + `pluginRegistry.uninstallAll()`。

---

## 4. 数据流打通（感知→规划→执行→四官→存证）

```
[感知] fileMonitor 检测到篡改
   │ bus.publish('file', RiskEventData)
   ▼
[决策] GovernanceEngine.handleEvent
   │ RulePlanner.plan() → AgentAction[]
   │  ├─ verify.run { path, hashBefore, hashAfter }        (readonly, 并发)
   │  └─ verify.flow { sessionId }                          (readonly, 并发)
   ▼
[执行] ToolBridge.call(name, params, toolCallId)
   │  ├─ 权限钩子 canUseTool（四官裁决 + 二次确认）
   │  ├─ 发布 tool 流 ToolCallRequestData / ToolCallResultData
   │  └─ 超限截断（40_000）+ 失败指数退避
   ▼
[四官] 后端 POST /api/agent/flow/  → auditor→verifier→archiver→judge
   │  ├─ 审计官：复核文件操作上下文
   │  ├─ 验证官：哈希/交叉验证（_verify_file）
   │  ├─ 存证官：写五元组链
   │  └─ 裁决官：allow / block / ask_user
   ▼
[存证] evidence.commit → POST /api/agent/memory/（LongTermMemory 链式哈希）
   ▼
[消费] smartAlerter / showRiskAlert / updatePetState / 审计报告（保留现有 UI）
```

关键点：**所有执行动作（写类工具）都经过 ToolBridge.canUseTool**，而 `canUseTool` 内部走"四官裁决 + 用户二次确认"，保证"能看、能干、干了还能查"且"不可越权"。

---

## 5. 实施顺序与验收

| 阶段 | 内容 | 验收标准 |
|---|---|---|
| B-1 | `types.ts` + `toolRegistry.ts` + `toolBridge.ts` + `retryWithBackoff.ts` | 单测：注册/查/注销/definitions；`call` 分发、`tryParse` 校验、退避重试次数正确 |
| B-2 | 内置工具（file/verify/evidence/report/risk/backend） | 单测：file.read/search 只读并发；file.write 过权限钩子；verify/evidence 调后端 mock 通过 |
| A-收尾 | `monitorEventAdapter.ts` + main.ts 接线 | 冒烟：触发文件改动 → `file` 流有事件；现有告警/桌宠不回归 |
| C-1 | `planner.ts`（RulePlanner）+ `governanceEngine.ts` | 单测：info/warning/critical 分级路由正确；写操作串行、只读并发 |
| C-2 | 四官子代理接通（verify.flow/verify.run）+ `evidence.commit` | 集成：篡改场景走完"感知→规划→执行→四官→存证"闭环 |
| D | `pluginRegistry.ts` + Skill 插件示例 | 单测：插件 install/uninstall、事件订阅、工具注入、runOnce 去重 |

---

## 6. 风险与边界
- **权限安全（最高优先级）**：`canUseTool` 是所有写操作的唯一闸门。写类工具默认 `isDestructive` 语义，走四官裁决 + 二次确认；`file.restore` 仅能从存证快照还原，不直接放开 fs 权限。
- **上下文上限**：`maxResultSizeChars=40_000`（对齐 Grok），工具结果/事件洪峰不撑爆规划层输入。
- **后端可用性降级**：四官/存证在后端，桌面端断网时 `verify.run/evidence.commit` 走 `retryWithBackoff`，仍失败则降级为本地 `storageService` 记录 + 告警，不静默失败。
- **单飞去重**：同 runId 同操作只执行一次（`runOncePerAgentRun`），防事件风暴重复触发多轮治理。
- **渐进替换**：M6 只加"发布"，保留现有回调消费，可逐步灰度，不回退风险。
