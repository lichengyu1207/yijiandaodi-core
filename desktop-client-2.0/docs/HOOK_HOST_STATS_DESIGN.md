# HookHostStats 插件性能统计接口设计文档

> 定位：本文件是 [AGENT_FUSION_MODULE_DESIGN.md](./AGENT_FUSION_MODULE_DESIGN.md) §3 M7（插件注册表）/ §6（单飞去重）的性能观测下沉设计。
> 回答：插件钩子系统"跑得快不快、丢没丢、卡没卡"——指标怎么定义、在哪里埋点、怎么取、怎么验证。
> 关联代码：`electron/agent/hooks/types.ts`（接口定义）、`electron/agent/hooks/runtime.ts`（埋点）、`electron/agent/pluginRegistry.ts`（注册表/单飞统计）、`electron/ipc/handlers.ts`（IPC）、`src/pages/Settings.tsx`（展示）、`electron/agent/hooks/runtime.perf.test.ts`（压测）。

---

## 1. 背景与目标

插件钩子系统（P1 契约）允许任意 Skill 插件在 8 个决策链路钩子点（onPercept / beforePlan / onRunStart / onRiskAssessed / beforeAlert / beforeToolCall / afterToolCall / onRunEnd）挂载逻辑。插件数量增多后，需要量化观测：

- **丢不丢**：高并发 emit 下钩子是否全部执行（无丢失）；
- **卡不卡**：单钩子耗时、超时、被熔断跳过的比例；
- **拦没拦**：short-circuit 短路丢弃/抑制的触发频次；
- **省没省**：单飞去重（runOnce）实际避免了多少次重复执行。

`HookHostStats` 即为此提供**进程内累计**的性能统计快照，支撑高并发表现评估与后续治理性能报告（perfLogAnalyzer）。

## 2. 总体数据流

```
HooksHost 内部埋点（statsData 累加）
        │  stats() 取快照（avg 在此派生）
        ▼
PluginRegistry.stats() + getRunOnceStats()   ← 注册表运维 + 单飞去重
        │  ipcMain.handle('get-plugin-stats')
        ▼
preload.getPluginStats() → window.electronAPI.getPluginStats()
        ▼
Settings.tsx「性能概览」卡片（前端展示）
```

三个数据源各司其职：

| 数据源 | 类型 | 内容 |
|---|---|---|
| `HooksHost.stats()` | `HookHostStats` | emit / 钩子执行 / 超时 / 熔断 / 跳过 / 短路 |
| `PluginRegistry.stats()` | `{ installCount, uninstallCount, enableCount, disableCount }` | 插件运维次数 |
| `getRunOnceStats()` | `{ firstHit, reuseHit }` | 单飞去重命中统计 |

## 3. 接口定义（types.ts）

```ts
/**
 * HooksHost 性能统计快照（HooksHost.stats() 返回）。
 *
 * 【产生方】HooksHost 内部埋点：每次 emit / 钩子执行 / 超时 / 熔断 / 跳过 / 短路时累加。
 * 【消费方】主进程 IPC get-plugin-stats 汇总给前端，设置页「性能概览」展示；
 *          后续可接入 perfLogAnalyzer 生成治理性能报告。
 * 【口径约定】
 *  - 计数器均为进程内累计值，观察窗口内可用 resetStats() 清零后重测；
 *  - 钩子执行耗时按"正常完成"计入（hookExecMs），超时/异常不计入耗时但计入 timeoutCount；
 *  - hookExecAvgMs 为派生值（hookExecMs / hookExecTotal），仅在 stats() 取快照时计算，避免每次累加做除法；
 *  - emitByPoint 与 emitTotal 满足：Σ emitByPoint = emitTotal（无丢钩子，可作自洽校验）。
 * 【测试参考】runtime.perf.test.ts 的 6 个压测场景以此快照断言计数自洽。
 */
export interface HookHostStats {
  /** emit 调用总次数（全钩子点累计） */
  emitTotal: number
  /** 各钩子点 emit 次数；Σ(值) === emitTotal，用于并发丢钩子自洽校验 */
  emitByPoint: Partial<Record<PluginHookPoint, number>>
  /** 钩子实际执行总次数（含 observe 异步派发；disabled/熔断跳过的不计入） */
  hookExecTotal: number
  /** 钩子执行累计耗时（ms；仅正常完成计入，超时/异常不计入） */
  hookExecMs: number
  /** 钩子执行平均耗时（ms；派生 = hookExecMs / hookExecTotal，stats() 时计算） */
  hookExecAvgMs: number
  /** 单次钩子执行最大耗时（ms；观测慢钩子） */
  hookExecMaxMs: number
  /** 钩子执行超时次数（每钩子超时上限 HOOK_DEFAULTS.timeoutMs） */
  timeoutCount: number
  /** 熔断触发次数（errorCount 连续达 circuitBreakerThreshold → 该插件钩子被跳过） */
  trippedCount: number
  /** 因 disabled / 熔断被跳过的钩子执行次数（emit 到但未真正执行） */
  skippedCount: number
  /** 短路触发次数（short-circuit 丢弃/抑制：onPercept / beforeAlert 返回 null） */
  shortCircuitCount: number
  /** 最近一次 emit 的时间戳（ms；0 = 尚未触发任何钩子） */
  lastEmitAt: number
}
```

## 4. 字段语义与口径约定

### 4.1 计数型字段（进程内单调递增）

| 字段 | 递增时机 | 说明 |
|---|---|---|
| `emitTotal` | 每次 `emit()` 进入（含 0 个参与钩子的空 emit） | 全钩子点合计 |
| `emitByPoint[point]` | 每次 `emit()` 进入 | 分点计数，便于按钩子点分析热点 |
| `hookExecTotal` | 每个钩子实际被调用 `runWithTimeout` 时 | observe 异步派发也计入；disabled/熔断跳过不计入 |
| `timeoutCount` | 钩子执行超时（`runWithTimeout` 的定时器触发） | 超时按异常处理：不阻塞链路、不计耗时、`errorCount++` |
| `trippedCount` | `bumpError` 中判定 `errorCount >= threshold` 的当次 | 熔断触发后该插件所有钩子被跳过，直到 `reset()` |
| `skippedCount` | 每次 `emit()` 过滤 disabled/熔断钩子时 | 增量 = `hooks.length - active.length` |
| `shortCircuitCount` | short-circuit 钩子返回 `null` 的当次 | 丢弃/抑制事件数 |

### 4.2 派生字段

| 字段 | 计算方式 | 说明 |
|---|---|---|
| `hookExecAvgMs` | `hookExecMs / hookExecTotal`（`hookExecTotal === 0` 时为 0） | **不在埋点处累加**，仅在 `stats()` 取快照时计算，避免每次除法 |
| `lastEmitAt` | `Date.now()`（每次 emit 更新） | 前端用于展示"最近 emit 时间"；0 = 尚未触发 |

### 4.3 关键口径约定（维护必读）

1. **耗时只算"正常完成"**：`hookExecMs` / `hookExecMaxMs` 仅在 `Promise.race` 正常返回时累加；超时与异常走 `bumpError`，不计耗时但计 `timeoutCount` / `trippedCount`。
2. **`hookExecTotal` 的含 async 口径**：observe 钩子是 fire-and-forget 派发，但其执行仍计入 `hookExecTotal`，因此该字段反映"真正执行过的钩子总量"，可用于与 `emitTotal` 对比推算跳过/丢失。
3. **跳过与丢失的区分**：`skippedCount` 统计"emit 到但被 disabled/熔断挡下"的钩子；已被 `active` 过滤后进入执行的钩子若再异常，只影响 `errorCount` / `trippedCount`，不再计入 `skippedCount`。
4. **avg 为快照派生值**：任何时候都不应手动写入 `hookExecAvgMs` 字段，避免与 `stats()` 的派生逻辑冲突。

## 5. 计数埋点位置（runtime.ts 源码对照）

| 计数 | 位置（函数） | 关键逻辑 |
|---|---|---|
| `emitTotal` / `emitByPoint` / `skippedCount` / `lastEmitAt` | `emit()` 开头 | 进入即累加；`skippedCount += hooks.length - active.length` |
| `shortCircuitCount` | `emitShortCircuit()` | 插件返回 `null` 的分支内 `++` 后短路返回 |
| `hookExecTotal` / `hookExecMs` / `hookExecMaxMs` | `runWithTimeout()` | 调用前 `hookExecTotal++`；正常返回后累加耗时与峰值 |
| `timeoutCount` | `runWithTimeout()` 定时器回调 | reject 前 `++` |
| `trippedCount` | `bumpError()` | `errorCount >= threshold` 的当次 `++` |
| 快照 / 重置 | `stats()` / `resetStats()` | `stats()` 浅拷贝 + 派生 avg；`resetStats()` 全量清零（不影响钩子注册与熔断状态） |

> 注意：`statsData` 为实例私有字段，命名刻意与 `stats()` 方法区分，避免实例字段遮蔽原型方法导致 `host.stats is not a function`。

## 6. 配套统计（pluginRegistry.ts）

### 6.1 注册表运维计数

`PluginRegistry.counters`（`{ install, uninstall, enable, disable }`）在对应方法（`install()` / `uninstall()` / `enable()` / `disable()`）成功后递增，`stats()` 返回浅拷贝快照。

### 6.2 单飞去重统计（runOnce）

`runOncePerAgentRun(key, operation)` 按 `runId + operation` 缓存已发起 Promise：

| 字段 | 递增时机 |
|---|---|
| `firstHit` | 首次发起执行（`runOnceRegistry` 无此 key） |
| `reuseHit` | 命中已有执行（事件风暴并发时直接复用 Promise） |

提供 `getRunOnceStats()` / `resetRunOnceStats()` / `clearRunOnceRegistry()` 供取数与测试重置。**指标意义**：`reuseHit` 越大，说明去重节省的重复治理越多。

## 7. 自洽性校验规则

压测与线上诊断时可依赖以下不变量：

1. `Σ emitByPoint === emitTotal` —— 无丢 emit；
2. `hookExecTotal ≤ Σ(active 钩子数)`，与 `skippedCount` 互补覆盖；
3. `hookExecAvgMs = hookExecMs / hookExecTotal`（`hookExecTotal > 0`）—— 派生一致性；
4. `hookExecMaxMs ≥ hookExecAvgMs`；
5. 正常负载下 `timeoutCount` 与 `trippedCount` 应为 0，出现则代表插件钩子执行卡顿或插件有缺陷。

## 8. 压测验证（runtime.perf.test.ts）

6 个场景，全部以 `HookHostStats` / `getRunOnceStats` 快照断言：

| 场景 | 验证点 |
|---|---|
| 场景1 pipeline 高并发吞吐 | 1000 并发 × 10 钩子：`emitTotal=1000`、`emitByPoint.beforeToolCall=1000`、`hookExecTotal=10000`（无丢钩子）、`timeoutCount=0`、`avg>0`、`max≥avg` |
| 场景2 事件风暴单飞去重 | 同 runId 并发 1000 次：操作仅执行 1 次，`firstHit=1`、`reuseHit=999` |
| 场景3 observe 零阻塞 | 主链路 emit 耗时远小于钩子总工作量（后台异步最终全部执行） |
| 场景4 高频异常熔断 | 异常累计达阈值后钩子被跳过，`trippedCount` / `skippedCount` 递增 |
| 场景5 超时控制 | 慢钩子超时按异常处理，`timeoutCount` 递增、链路不中断 |
| 场景6 混合压测 | 三种合并策略混合并发下的计数自洽 |

## 9. 前端消费（IPC / UI）

### 9.1 IPC 通道

- 主进程：[handlers.ts](`registerPluginHandlers`) 注册 `ipcMain.handle('get-plugin-stats')`，返回 `{ registry, hooks, runOnce }` 三元组；
- Preload：[preload.ts](`contextBridge`) 暴露 `getPluginStats()`；
- 类型：[electron.d.ts](`PluginStatsData` / `PluginHookStats` / `PluginRegistryStats` / `RunOnceStats`) 保证前端类型安全。

### 9.2 UI（Settings.tsx「性能概览」）

展示字段：emit 总数、钩子执行、平均/最大耗时、超时、熔断、跳过、短路、单飞首次/复用、安装/卸载；超时与熔断数值 > 0 时红色高亮，`lastEmitAt` 展示最近 emit 时间。

## 10. 使用与维护指南

### 10.1 取数示例

```ts
import { HooksHost } from '../electron/agent/hooks/runtime'
import { getRunOnceStats } from '../electron/agent/pluginRegistry'

const host = new HooksHost({ logger })
const s = host.stats()          // HookHostStats 快照
const r = getRunOnceStats()     // { firstHit, reuseHit }
host.resetStats()               // 开启新的观察窗口
```

### 10.2 扩展指引（后续 perfLogAnalyzer 集成预留）

- `HookHostStats` 已具备 avg/max/超时/熔断等关键观测维度，可直接作为 perfLogAnalyzer 治理性能报告的输入之一；
- 若需按插件维度细分，可在 `RegisteredHook` 侧按 `pluginId` 维护耗时累计（当前为全局合计），或在快照中新增 `byPlugin` 字段；
- 新增钩子点计数时：在 `emit()` / `emitShortCircuit()` / `runWithTimeout()` / `bumpError()` 的既有计数分支后追加，并同步更新 runtime.perf.test.ts 的自洽断言。

### 10.3 陷阱提醒

- 不要把 `hookExecAvgMs` 当埋点字段写累加（它是派生值）；
- 不要用 `statsData` 这个名字新增公共方法（保留给私有字段）；
- 观察窗口测试务必先 `resetStats()` / `resetRunOnceStats()` 清空，避免与既有累计值混淆断言。
