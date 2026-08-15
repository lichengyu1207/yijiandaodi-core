# 一鉴到底 · 治理型 Agent 融合架构

> 定位转变：从"检测工具"（别人干活，你看着）→ "治理型 Agent"（能看、能干、干了还能查）。
> 本文档基于对三份源码的实际研读，标注"从哪拿、拿什么、怎么对接现有四官协同"。

---

## 一、研读结论速览（行动清单 1-3 完成）

### 1.1 Claude Code（Cloud Code）——"怎么想"（规划层）

研读对象：`claude-code-main/src/QueryEngine.ts`、`src/query.ts`、`src/Tool.ts`、`src/services/tools/*`

核心机制（任务拆解→执行→验证闭环）：

- **主入口** `QueryEngine.submitMessage()`（[QueryEngine.ts](file:///c:/MsSafeData/Desktop/yijiandaodi/claude-code-main/src/QueryEngine.ts#L209-L232)）：一次提交 = 一轮对话。先 `processUserInput` 处理用户输入，再进入主循环。
- **主循环** `queryLoop()`（[query.ts](file:///c:/MsSafeData/Desktop/yijiandaodi/claude-code-main/src/query.ts#L241-L307)）：`while(true)` 三件套——
  1. `deps.callModel()` 流式调模型（[query.ts:659](file:///c:/MsSafeData/Desktop/yijiandaodi/claude-code-main/src/query.ts#L659)）
  2. 解析出 `tool_use` 块 → `runTools()` 执行
  3. 结果回填 messages，判断 `needsFollowUp` 决定是否续轮
- **工具执行编排** `runTools()`（[toolOrchestration.ts](file:///c:/MsSafeData/Desktop/yijiandaodi/claude-code-main/src/services/tools/toolOrchestration.ts#L19-L82)）：把工具调用分区为"并发安全（只读批量并行）/ 非安全（串行）"两批。
- **单工具执行** `runToolUse()`（[toolExecution.ts](file:///c:/MsSafeData/Desktop/yijiandaodi/claude-code-main/src/services/tools/toolExecution.ts)）：权限检查（`canUseTool`）→ 执行 → 结果处理 → hook 链（pre/post tool use）。
- **任务拆解**：没有独立的"planner"，拆解是靠 system prompt（`fetchSystemPromptParts`）+ 工具循环 + 子代理（AgentTool）实现的。子代理可独立起上下文（`utils/worktree.ts` 的 subagent 工作区隔离）。

**可抽取**：主循环（收集→行动→验证）+ 工具分区执行 + 权限钩子链。

### 1.2 Grok Build——"怎么做"（执行层）

研读对象：`grok/grok-build-main/crates/codegen/xai-grok-tools/src/bridge.rs`、`lib.rs`、`retry.rs`、`crates/codegen/xai-grok-agent/src/agent.rs`

核心机制（系统级工具调用分发）：

- **ToolBridge**（[bridge.rs](file:///c:/MsSafeData/Desktop/yijiandaodi/grok/grok-build-main/crates/codegen/xai-grok-tools/src/bridge.rs#L59-L95)）：把 `ToolRegistry` 桥接到会话层。三个职责：
  1. `tool_definitions()` 暴露工具 schema 给模型
  2. `call(name, params, tool_call_id)` 分发执行（[bridge.rs:193](file:///c:/MsSafeData/Desktop/yijiandaodi/grok/grok-build-main/crates/codegen/xai-grok-tools/src/bridge.rs#L193-L200)）
  3. `register_mcp_tools` / `unregister_tool_by_name` 动态增删工具
- **工具注册表**（`xai-grok-tools` lib.rs）：统一入口 + 输出字节/字符上限常量（`DEFAULT_TOOL_OUTPUT_BYTES=40_000`，防止工具结果撑爆上下文）。
- **重试机制** `execute_with_backoff`（[retry.rs](file:///c:/MsSafeData/Desktop/yijiandaodi/grok/grok-build-main/crates/codegen/xai-grok-tools/src/retry.rs#L47-L95)）：指数退避 `base*2^attempt`，可配 `on_retry` 回调。
- **Agent 结构**（[agent.rs](file:///c:/MsSafeData/Desktop/yijiandaodi/grok/grok-build-main/crates/codegen/xai-grok-agent/src/agent.rs#L25-L51)）：definition（名字/描述/权限模式/完成要求）+ ToolBridge + system prompt + 压缩策略，构造后不可变，状态都锁在 registry 内部。

**可抽取**：工具注册/分发/动态增删 + 指数退避重试 + 输出上限治理。

### 1.3 OpenClaw——"怎么感知"（事件驱动层）

研读对象：`openclaw/openclaw-main/src/infra/agent-events.ts`、`src/gateway/server.ts`、`src/gateway/events.ts`、`src/plugins/runtime.ts`、`src/agents/`

核心机制（网关中心化 + 事件驱动 + 插件化）：

- **Agent 事件总线** `agent-events.ts`（[agent-events.ts](file:///c:/MsSafeData/Desktop/yijiandaodi/openclaw/openclaw-main/src/infra/agent-events.ts#L57-L73)）：统一事件载荷 `AgentEventPayload = { runId, seq, stream, ts, data, sessionId, agentId }`。`stream` 有 `lifecycle/tool/assistant/usage/error/item/plan/approval/command_output/patch/compaction/thinking` 等命名流。
- **发布订阅**：`registerListener / notifyListeners` + `AsyncLocalStorage` 传递执行上下文（[agent-events.ts:110](file:///c:/MsSafeData/Desktop/yijiandaodi/openclaw/openclaw-main/src/infra/agent-events.ts#L110-L115)），`seqByRun` 保证单 run 内事件有序。
- **插件运行时** `plugins/runtime.ts`（[runtime.ts](file:///c:/MsSafeData/Desktop/yijiandaodi/openclaw/openclaw-main/src/plugins/runtime.ts#L1-L16)）：`onAgentEvent` 桥接事件总线 → `dispatchPluginAgentEventSubscriptions`，插件订阅 Agent 事件。注册表有 `activeRegistry` + 生命周期（loaded/retired）。
- **网关** `gateway/server.ts`：懒加载入口，所有渠道/会话统一走网关（GatewayServer），WebSocket 广播 `gateway.*` 事件（如 `update.available`）。

**可抽取**：统一事件模型（runId/seq/stream/ts）+ 发布订阅总线 + 插件注册表与事件订阅钩子。

---

## 二、融合架构图（行动清单 4）

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    一鉴到底 · 治理型 Agent                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌────────────── 感知层（取自 OpenClaw 事件模型）─────────────────────┐  │
│  │  AgentEventBus  <openclaw infra/agent-events.ts 移植>              │  │
│  │  Event = { runId, seq, stream, ts, data }                          │  │
│  │  ├─ stream: "file"       ← FileMonitor（文件变动/哈希/篡改）        │  │
│  │  ├─ stream: "process"    ← ProcessMonitor（工具进程会话）           │  │
│  │  ├─ stream: "network"    ← NetworkMonitor（AI API 请求）           │  │
│  │  ├─ stream: "clipboard"  ← ClipboardMonitor                        │  │
│  │  ├─ stream: "api_call"   ← ApiCallMonitor（代理模式）              │  │
│  │  ├─ stream: "resource"   ← Memory/CPU/Health 监控                  │  │
│  │  └─ stream: "system"     ← 服务生命周期/错误                       │  │
│  └───────────────────────────────┬─────────────────────────────────────┘  │
│                                  │ 事件注入（原"轮询+回调"改为事件流）      │
│  ┌───────────────────────────────▼─────────────────────────────────────┐  │
│  │  决策层（取自 Claude Code 主循环）                                    │  │
│  │  GovernanceQueryEngine  <query.ts queryLoop 移植>                    │  │
│  │                                                                      │  │
│  │  while(true):                                                        │  │
│  │    callPlanner()  ← 事件/风险 → 拆解成子任务（审计/验证/存证/裁决）    │  │
│  │    runTools()     ← 四官以"子代理 + 工具"形式参与                    │  │
│  │    needsFollowUp? ← 验证结果决定是否续轮                              │  │
│  └───────────────────────────────┬─────────────────────────────────────┘  │
│                                  │ 工具调用请求（标准 schema + 权限钩子）   │
│  ┌───────────────────────────────▼─────────────────────────────────────┐  │
│  │  执行层（取自 Grok ToolBridge）                                      │  │
│  │  GovToolBridge  <xai-grok-tools bridge.rs 移植>                      │  │
│  │  ├─ tool_definitions()  暴露可执行能力给规划层                       │  │
│  │  ├─ call()              分发执行（读/改/搜/修复/审计报告/标记）        │  │
│  │  ├─ retry()             指数退避重试                                 │  │
│  │  └─ 输出上限治理（防止工具结果撑爆上下文）                            │  │
│  └───────────────────────────────┬─────────────────────────────────────┘  │
│                                  │ 所有执行动作必经（不可绕过）             │
│  ┌───────────────────────────────▼─────────────────────────────────────┐  │
│  │  四官协同治理层（已有核心，保持不变）                                   │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐               │  │
│  │  │ 审计官     │ │ 验证官    │ │ 存证官    │ │ 裁决官    │               │  │
│  │  │ auditor  │ │ verifier │ │ archiver │ │ judge    │               │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘               │  │
│  │  <agent_flow_urls.py: _handle_verify 等>                             │  │
│  └───────────────────────────────┬─────────────────────────────────────┘  │
│                                  ▼                                        │
│  ┌───────────────────────────────▼─────────────────────────────────────┐  │
│  │  五元组存证层（已有核心，保持不变）                                    │  │
│  │  LongTermMemory 链式哈希：record_hash + prev_hash + chain_index      │  │
│  │  <memory_models.py LongTermMemory>                                   │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 三、模块来源对照表

| 目标能力 | 取自哪个项目 | 关键文件 | 对接现有四官协同的方式 |
|---|---|---|---|
| 事件驱动感知 | OpenClaw | `src/infra/agent-events.ts` | 各监控器的"回调"改为发事件；风险事件作为决策层的输入 |
| 任务拆解主循环 | Claude Code | `src/query.ts` queryLoop | 四官从"被动等请求"变"事件驱动自动规划路径" |
| 工具分区执行 | Claude Code | `src/services/tools/toolOrchestration.ts` | 并行跑只读校验，串行跑写操作 |
| 工具权限钩子链 | Claude Code | `src/services/tools/toolExecution.ts` | 执行前过审计官权限判定，执行后过验证官 |
| 工具注册/分发 | Grok Build | `xai-grok-tools/src/bridge.rs` | 把"四官校验/文件修复/审计报告"注册成可调用工具 |
| 指数退避重试 | Grok Build | `xai-grok-tools/src/retry.rs` | 后端校验/存证调用失败时可靠重试 |
| 插件注册表 | OpenClaw | `src/plugins/runtime.ts` | Skill 从"静态导入"变"事件订阅插件" |

---

## 四、事件总线消息结构设计（行动清单前置）

> 设计目标：一份消息结构同时兼容三套契约——
> ① OpenClaw 的扁平有序事件信封；② Claude Code 的 `tool_use`/`tool_result` 消息块；
> ③ Grok 的 `call(name, params, tool_call_id)` 分发签名。
> 贯通三者的是**同一个调用 ID**：`tool_use.id == Grok tool_call_id == tool_result.tool_use_id`。

### 4.1 事件信封（Envelope）——取 OpenClaw

```ts
// electron/events/agentEventBus.ts
export type AgentEventStream =
  | 'lifecycle' | 'tool' | 'assistant' | 'usage'
  | 'error' | 'approval' | 'plan' | 'thinking'
  | 'file' | 'process' | 'network' | 'clipboard' | 'api_call' | 'resource'
  | (string & {})

export interface AgentEventEnvelope {
  runId: string          // 一次治理 run（跨多轮）
  seq: number            // run 内单调递增，seqByRun 保证有序
  stream: AgentEventStream
  ts: number
  data: unknown          // 按 stream 区分载荷，见 4.2/4.3/4.4
  sessionId?: string
  agentId?: string       // 子代理：审计官/验证官/存证官/裁决官
  lifecycleGeneration?: string
}
```

发布/订阅：`eventBus.publish(envelope)` / `eventBus.subscribe(stream, handler)`，内部用 `seqByRun: Map<runId, number>` 自增，保证单 run 内消费者按 `seq` 有序重放（对齐 OpenClaw `agent-events.ts`）。

### 4.2 工具调用载荷——同时兼容 Grok 分发 + Claude 消息块

**请求事件**（`stream: 'tool'`）：

```ts
// data 载荷 = Grok bridge.call 入参（name/input/id）+ Claude tool_use 块
export interface ToolCallRequestData {
  type: 'tool_use'                 // Claude Code 兼容
  id: string                       // 贯通键 == Grok tool_call_id == Claude tool_use.id
  name: string                     // Grok client_function_name
  input: Record<string, unknown>   // Grok client_params
  parentId?: string                // 子代理/嵌套工具链
  agentId?: string                 // 由哪个官发出
  // 分发元信息（对齐 Claude toolUseContext）
  readonly?: boolean               // true=并发安全，可批量并行；false=串行
  permission?: 'allow' | 'ask' | 'deny'
}
```

**结果事件**（`stream: 'tool'`）：

```ts
// data 载荷 = Grok ToolRunResult 三字段 + Claude tool_result 块
export interface ToolCallResultData {
  type: 'tool_result'              // Claude Code 兼容
  tool_use_id: string              // 关联回请求 id
  content: string                  // Grok prompt_text（喂回模型的提示文本）
  output: unknown                  // Grok ToolRunResult.output（干净 JSON，不携带改动）
  effective_tool_name?: string     // Grok：use_tool 元工具转发后的真实工具名
  is_error?: boolean
  // 重试信息（对齐 Grok retry.rs BackoffConfig）
  attempt?: number
  backoff?: { max_retries: number; base_delay_ms: number; max_delay_ms: number }
}
```

**Grok ToolBridge 接入**：`GovToolBridge.call(name, params, toolCallId)` 直接消费 `ToolCallRequestData`，把 `ToolRunResult` 映射成 `ToolCallResultData` 回填。`tool_definitions()` 从 `registerTool(name, schema, handler)` 注册表中生成（对齐 `xai-grok-tools/src/bridge.rs`）。

### 4.3 主循环消息流——取 Claude Code 三件套

事件总线不保存完整消息数组，只承载流；主循环（`governanceEngine.ts`）把事件流**投影**回 Claude 风格消息数组喂给模型：

```ts
// assistant stream：模型输出的消息（含 tool_use 块）
export interface AssistantData {
  role: 'assistant'
  content: Array<
    | { type: 'text'; text: string }
    | ToolCallRequestData            // type === 'tool_use'
    | { type: 'thinking'; thinking: string }
  >
}

// assistant stream：工具结果回填（Claude 协议中 tool_result 在 user 侧）
export interface UserToolResultData {
  role: 'user'
  content: Array<{ type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }>
}
```

三件套在事件流上的对应：

| 主循环步骤（query.ts queryLoop） | 事件流产出 |
|---|---|
| ① `callModel()` 流式采样 | `assistant` stream 的 `AssistantData`，持续 yield |
| ② 解析出 `tool_use` 块 → `runTools()` | `tool` stream 的 `ToolCallRequestData`（readonly 批量并行 / 非 readonly 串行） |
| ③ 结果回填 → 判断 `needsFollowUp` | `tool` stream 的 `ToolCallResultData` + 投影成 `UserToolResultData` 回填消息 |

**readonly 分区**沿用 Claude `toolOrchestration.ts`：`readonly: true` 的只读工具（审计官检测、哈希校验）合并并发执行；写操作（修复文件、存证）标记 `readonly: false` 串行执行。

### 4.4 感知事件载荷——各监控器上报

```ts
// 统一风险事件，作为决策层的触发输入
export interface RiskEventData {
  source: 'file' | 'process' | 'network' | 'clipboard' | 'api_call' | 'resource'
  severity: 'info' | 'warning' | 'critical'
  riskScore?: number                // 来自 BehaviorRiskScorer
  // 按 source 扩展的载荷，示例：
  file?: { path: string; operation: 'create'|'modify'|'delete'|'rename'; hashBefore?: string; hashAfter?: string }
  process?: { tool: string; sessionId: string; relatedFiles?: string[] }
  apiCall?: { url: string; method: string; target: string }
  evidence: {                     // 天然对齐五元组存证
    operation: string             // 操作指令
    result: string                // 校验结果
    confirmation: string          // 确认凭证
    timestamp: number             // 时间戳
    prevFingerprint: string       // 前次指纹
  }
}
```

### 4.5 消息结构与三套代码的对照表

| 消息结构 | 取自 | 兼容点 |
|---|---|---|
| `AgentEventEnvelope{runId,seq,stream,ts,data}` | OpenClaw `agent-events.ts` | 扁平事件、seqByRun 有序、plugin 订阅 |
| `ToolCallRequestData` | Grok `bridge.rs` call 签名 + Claude `tool_use` 块 | `id` 三端贯通，`name/input` 即 `client_function_name/client_params` |
| `ToolCallResultData` | Grok `ToolRunResult` + Claude `tool_result` 块 | `content`=prompt_text，`output`=干净 JSON |
| `AssistantData`/`UserToolResultData` | Claude `query.ts` 消息流 | 投影回消息数组喂模型，`needsFollowUp` 判定 |
| `RiskEventData.evidence` | 已有五元组存证 | 事件载荷直接携带五元组字段，无需二次映射 |

### 4.6 关键设计决策

1. **一个调用 ID 三端贯通**：`tool_use.id == Grok tool_call_id == tool_result.tool_use_id`。Grok 分发、Claude 回填、事件配对全部靠它，无额外映射表。
2. **事件流 vs 消息数组分离**：总线只流式承载事件（OpenClaw 风格）；主循环按需投影成 Claude 消息数组。既满足实时订阅，又不牺牲模型上下文形状。
3. **ToolRunResult 双通道**：`output`（干净 JSON，供验证/存证）与 `content`（prompt_text，供模型消费）分离——执行结果对"官"可见、对"模型"经裁剪后可见，避免工具输出污染推理。
4. **readonly 标记驱动并行度**：不引入新的调度器，沿用 Claude 的分区策略，Grok 的并发执行由调用方按 `readonly` 批量触发。

---

## 五、实施路线（落地到现有代码）

### 阶段 A：感知层事件化（不动现有监控器的检测逻辑）
1. 新增 `electron/events/agentEventBus.ts`：移植 `AgentEventPayload` 事件模型 + `publish/subscribe` + `seqByRun` 排序。
2. 在 `electron/main.ts` 的 `riskDetectedCallback` 及各 monitor 回调处，改为 `eventBus.publish({ stream: 'file'|'process'|..., data })`。
3. 保留现有 `showRiskAlert`/`updatePetState` 作为"事件消费者"，不破坏现有 UI。

### 阶段 B：执行层工具化（Grok 桥）
1. 新增 `electron/agent/toolRegistry.ts` + `electron/agent/toolBridge.ts`：`registerTool(name, schema, handler)` / `call(name, params)`。
2. 内置工具：`file.read`、`file.write`、`file.search`、`report.generate`、`risk.mark`、`evidence.commit`。
3. 移植 `retryWithBackoff` 指数退避工具。

### 阶段 C：决策层主循环（Claude Code 循环）
1. 新增 `electron/agent/governanceEngine.ts`：事件 → 拆解（调哪个官/走哪条路径）→ 工具调用 → 结果验证 → 存证。
2. 四官以"子代理"形式接入：审计官=先跑只读检测工具，验证官=哈希/交叉验证，存证官=写 `LongTermMemory` 五元组链，裁决官=综合决策（allow/block/ask_user）。
3. 替换后端 `file_watch_views.py: _verify_file` 中"模拟校验"的 TODO，接通真实四官协同。

### 阶段 D：Skill 插件化（OpenClaw）
1. 现有 Skill 模板注册为插件，`plugin.subscribe(eventStream, handler)`。
2. 开发者可按 OpenClaw 插件规范扩展，无需改主进程代码。

---

## 五、风险与边界
- **权限安全**：Grok 的沙箱（`xai-grok-sandbox`）思想必须保留——"执行层"只能通过四官决策后放行的工具路径操作，不允许越权。
- **上下文上限**：借鉴 Grok 输出上限常量，防止工具结果/事件洪峰撑爆上下文。
- **单飞模式**：沿用项目已有的 single-flight 刷新思想，事件总线订阅去重，防止同一事件重复触发多轮治理。
- **渐进替换**：本方案不重写现有监控器，只在回调出口加事件化适配层，可逐步灰度。
