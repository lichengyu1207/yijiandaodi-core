# 产品需求梳理与优化规格说明书

> 覆盖 6 大需求领域：模块融合 / 界面定制 / 审计统计 / API 消费控制 / 消费趋势 / 账号同步
> 基准版本：基于当前代码库（2026-08-18）实测盘点，标注 ✅ 已实现 / ⚠️ 部分实现 / ❌ 未实现
> 每条需求给出：现状 → 目标 → 实现方案（接口/字段/组件）→ 验收标准，确保可落地、可测试

---

## 一、产品整合需求：四平台能力透明融合

### 1.1 融合本质（能力透明架构）

**融合 = 四平台能力的内部吸收与自动调度，不是品牌拼接、不是目录打通。**

- **能力完全透明**：用户只看到"AI 分析 / 治理决策 / 内容生成"这些产品能力，无感知背后是哪个引擎、哪个集群
- **无品牌名**：Grok / OpenClaw / DSH / Cloud 的名称与 LOGO 不出现在任何对外展示层，能力标识只存在于内部日志/配置
- **无模块管理面板**：不设"四平台状态面板"，统一控制面降级为内部运维/诊断通道（见附录 B）
- **单包部署**：桌面端与云端各自独立打包，能力通过 API / 进程 / 插件协议在内部融合

### 1.2 能力融合现状盘点（2026-08-18 实测）

| 平台 | 吸收的能力 | 内部能力单元 | 当前状态 | 证据 |
|------|-----------|--------------|----------|------|
| **Cloud** | 云端后端（认证/存储/任务/计费） | `cloud.api` / `cloud.db` / `cloud.budget-gate` | ✅ 已运行 | `backend/fangdudu_backend/urls.py`、JWT 认证、DeepSeekBudgetGate |
| **Cloud** | 异步任务/缓存 | `cloud.celery` / `cloud.redis` | ✅ 已封装 | `_check_celery` / `_check_redis` 已挂入 `GET /api/modules/status` 能力单元状态 |
| **Grok** | 大模型推理引擎（可选模型后端） | `cloud.inference-engine` | ✅ 已抽象 | `InferenceProvider` 统一接口（M2），`GrokProvider` 按 `INFERENCE_PROVIDER=grok` 透明切换 |
| **OpenClaw** | 智能体插件化机制 | `desktop.agent`（插件生态） | ✅ 打通 | 插件注册表/管理 + `PluginRegistry.loadFromDir` 目录加载 + 插件市场 UI（M3） |
| **HSH/DSH** | 分布式推理集群 | `cloud.compute-cluster` | ✅ 已接入 | `ComputeProvider` 集群客户端 + 本地优先/过载回退路由（M4） |

> ✅ **能力单元状态已补齐**：`cloud.inference-engine`（`_check_inference_engine`）与 `cloud.compute-cluster`（`_check_compute_cluster`）不再以 `unknown` 占位——
> 推理引擎上报 provider/本地过载原因/并发占用（inFlight/maxConcurrency/maxLocalRatio）；推理集群上报在线/忙碌节点数与执行中任务数。
> 同时修复 `capabilities__contains` 在 SQLite 后端不受支持的隐患（`cluster_gateway.submit` 与集群检查改为 DB 状态过滤 + Python 能力匹配，跨数据库一致）。

> 结论：**当前"融合"处于能力扩展阶段**——云端后端能力已运行、统一诊断通道已完成（M1）、推理引擎抽象已完成（M2）、
> 插件源打通已完成（M3）、推理集群接入已完成（M4），四平台核心能力融合已全部落地。

### 1.3 融合里程碑（能力透明视角）

| 里程碑 | 内容 | 优先级 | 状态 |
|--------|------|--------|------|
| **M1** 统一内部诊断通道 | 桌面 `ModuleControlService` + `modules:*` IPC；后端 `GET /api/modules/status`、`GET/PUT /api/settings/log-level`、`GET /api/deepseek/quota` | P0 | ✅ 已实现（含单测） |
| **M2** 推理引擎统一接口 | 抽象 `InferenceProvider.call(messages, model?)`，实现 `DeepSeekProvider`/`GrokProvider`，按 run 维度透明切换 | P1 | ✅ 已实现（含单测） |
| **M3** 插件源打通 | `PluginRegistry` 支持从插件目录加载（`openclaw.plugin.json` → `GovPlugin` 映射）+ 插件市场 UI | P2 | ✅ 已实现（pluginDirLoader + loadFromDir + 市场 IPC + Settings 插件市场 UI） |
| **M4** 推理集群接入 | `ComputeProvider` 集群客户端 + 本地优先/过载回退路由（`OverloadDetector` + `InferenceRouter` + `ClusterProvider` 复用 p2p_app 管道） | P3 | ✅ 已实现（含单测） |

### 1.4 差距清单与实现方案

#### M2 推理引擎统一接口 ✅ 已实现
- **现状（已落地）**：`backend/content_app/inference/` 下新增 `base.py`（`InferenceProvider` 抽象 + `Completion` 结果类型）、`deepseek_provider.py`、`grok_provider.py`；工厂函数 `get_inference_provider()` 按 `INFERENCE_PROVIDER` 配置（默认 deepseek）选择引擎，`agent_views.py` 推理调用点已迁移至统一接口。
- **验收**：切换 provider 配置后同一 flow 正常返回；`[预算闸门]` 日志同时记录 provider 名；对外无品牌名。✅ 已达成

#### M3 插件源打通 ✅ 已实现
- **现状**：桌面端插件生态仅内置注册表，无外部插件源加载与市场。
- **目标**：支持从插件目录加载社区插件，并提供插件市场 UI（浏览/安装/卸载/更新，对外只叫"插件"）。
- **方案**：`PluginRegistry.loadFromDir(dir)` 扫描 `openclaw.plugin.json` → 映射 `GovPlugin`；插件市场页对接目录索引 API。
- **落地**：`pluginDirLoader.ts`（scanPluginDir / installPluginFromMarket / uninstallPluginFromDir）+ `PluginRegistry.loadFromDir`；IPC `plugins:list-market` / `plugins:scan-installed` / `plugins:install` / `plugins:uninstall`；Settings「插件市场」区（浏览/安装/卸载/扫描插件目录）。
- **验收**：放入插件目录的插件可被识别并启用；市场页可浏览/安装/卸载；无来源品牌名。✅ 已达成

#### M4 推理集群接入 ✅ 已实现
- **现状**：仅 P2P 任务管道（节点/分片/调度/聚合），无统一推理入口，无「本地优先 + 过载回退」调度。
- **目标**：提供统一推理入口，本地优先；本地过载/失败时回退集群，集群不可用时回退公开 API。
- **方案**（`backend/content_app/inference/`）：
  - `exceptions.py`：`InferenceOverloadError`（本地过载） / `ClusterUnavailableError`（集群不可用）
  - `overload_detector.py`：`OverloadDetector` 判定熔断 / 配额比（≥0.9）/ 并发饱和（≥8），进程内并发槽
  - `cluster_gateway.py`：`P2PClusterGateway` 把聊天消息封装为 P2P 文本任务（提交/轮询/中止，复用 `TaskDispatcher` 成本路由选节点）
  - `cluster_provider.py`：`ClusterProvider` 集群客户端（提交→轮询→聚合，超时中止并回退）
  - `router.py`：`InferenceRouter` 路由链 ① 本地 → ② 集群 → ③ 公开 API 兜底（可配置关闭）
  - 工厂 `get_router()`；`settings.INFERENCE_ROUTER` 配置（enabled / local_overload_ratio / max_local_concurrency / cluster_timeout_sec / fallback_enabled）；`agent_views.py` 调用点按 `enabled` 切换路由
- **验收**：本地健康时走本地；本地过载（熔断/配额/并发）→ 集群；集群不可用 → 公开 API；fallback 关闭时上抛。✅ 已达成（后端单测 21/21 通过：overload 9 + cluster 4 + router 8）

---

## 二、桌面端界面定制需求

### 2.1 现状盘点（2026-08-18 实测）

| 功能 | 状态 | 实现方式 |
|------|------|----------|
| 桌面端预设主题（light/dark/deep） | ✅ 已实现 | `desktop-client-2.0/src/styles/themes.ts` 集中定义三套主题变量；`index.css` 通过 `data-theme` 动态注入 |
| 主题切换 UI | ✅ 已实现 | `Settings.tsx` 新增"外观"分区，支持 light/dark/deep 三主题切换 |
| 主题状态持久化 | ✅ 已实现 | `themeService.ts` 持久化 `localStorage.theme`，启动恢复 |
| 自定义背景（上传图片/颜色/渐变/纹理） | ✅ 已实现 | `themeService.ts` 支持 `{type: image|color|gradient|texture, value}`，Settings"外观"分区配置并实时预览 |
| 集中主题配置（theme.ts） | ✅ 已实现 | `desktop-client-2.0/src/styles/themes.ts` 集中管理主题变量与背景类型 |
| CSS 变量体系 | ✅ 已实现 | 全局 `--bg-*`/`--text-*` 等主题变量；新增 `.notice-*` 自适应类，提示条已去除硬编码色值 |

> ✅ **勘误已落实**：原文档标注"主题 light/dark/black ✅ 已实现"不准确——现已补齐桌面端多主题切换（light/dark/deep）与自定义背景功能。

### 2.2 优化需求

#### 2.2.1 预设主题体系（核心新增）✅ 已实现
- **目标**：桌面端提供 `light`（白）/ `dark`（黑）/ `deep`（深色）三套预设主题，全局一致生效。
- **方案**：
  1. 新建 `desktop-client-2.0/src/styles/themes.ts`，集中定义主题变量：
     ```ts
     export const THEMES = {
       light: { bgPrimary: '#FFFFFF', bgSecondary: '#F8FAFC', textPrimary: '#0F172A', borderColor: '#E2E8F0', accent: '#2563EB' },
       dark:  { bgPrimary: '#1E1E1E', bgSecondary: '#2D2D2D', textPrimary: '#E0E0E0', borderColor: '#3D3D3D', accent: '#4A9EFF' },
       deep:  { bgPrimary: '#0D0D0D', bgSecondary: '#1A1A1A', textPrimary: '#E0E0E0', borderColor: '#2A2A2A', accent: '#4A9EFF' },
     }
     ```
  2. `App.tsx` 挂载时读取 `localStorage.theme`（默认 deep），`document.documentElement.dataset.theme = theme`，动态注入 CSS 变量
  3. 清理 `Settings.tsx` 硬编码色值，全部改 `var(--xxx)`
- **验收**：三主题切换后所有页面（Dashboard/存证/设置/统计/审计）背景、文字、边框、强调色一致变化；刷新后主题保持。

#### 2.2.2 自定义背景（新增）✅ 已实现
- **目标**：预设主题之上叠加自定义背景（图片上传 / 颜色 / 渐变 / 纹理）。
- **方案**：
  - `Settings.tsx`"外观"分区新增"自定义背景"区块；选择"自定义"后展开配置面板，实时预览
  - 持久化 `localStorage.customBg`：`{ type: 'image'|'color'|'gradient'|'texture', value: string }`
  - 图片：PNG/JPG/WebP，≤5MB，裁切 1920×1080 预览；渐变：双/三色 + 角度；纹理：6 种内置（噪点/网格/点阵/波浪/对角线/碳纤维）
  - 叠加规则：自定义背景控制背景层，预设主题控制文字/边框/强调色
- **验收**：四种背景类型均可配置并即时生效；上传图片可预览；切换主题时自定义背景不被清除。

---

## 三、审计与数据统计功能优化

### 3.1 现状盘点（2026-08-18 实测）

| 功能 | 状态 | 关键证据 |
|------|------|----------|
| 统计模型与聚合引擎 | ✅ | `auth_app/stats_views.py` `StatsAggregationEngine`（daily/skill/area/revenue 聚合） |
| 统计接口 | ✅ | `stats_urls.py` 共 6 个：`overview` / `skills` / `areas` / `revenue` / `revenue-detail` / `refresh-stats` |
| 时间范围+粒度参数 | ✅ | `overview` 支持 `start_date/end_date` 与 `granularity`；`statsService.ts` 统一时间范围解析并兼容旧 `days` 参数 |
| 区域维度统计 | ✅ | `GET /api/stats/by-region` 按区域聚合调用次数/平均耗时/失败率；`APIKeyUsageLog` 增加 `region` 字段；前端新增区域消费 tab |
| 每小时粒度监控 | ✅ | `GET /api/stats/hourly` + `HourlyRegionStats` 模型 + 前端热力图（P2，含 3σ 异常与 Top10 详情） |
| 趋势统计图表 | ✅ | 后端 `GET /api/stats/trend`（cost/count/error_rate + 分位 + 3σ 异常）；前端消费趋势仪表盘（折线图/成本分解/Top10/建议） |
| 统一 DateRangePicker 组件 | ✅ | `desktop-client-2.0/src/components/DateRangePicker.tsx`（今天/本周/本月/本季度/本年/自定义 + 智能粒度） |
| 桌面端统计页面 | ✅ | Dashboard 集成 DateRangePicker 与区域消费 tab（调用次数/平均耗时/失败率） |

### 3.2 优化需求

#### 3.2.1 时间范围筛选（统一化）✅ 已实现
- **目标**：所有统计视图支持"今天/本周/本月/本季度/本年/自定义"。
- **方案**：
  - 后端：`overview` 已具备 `start_date/end_date/granularity`，补充 `region` 参数（见 3.2.2）
  - 前端：新建 `DateRangePicker` 通用组件（desktop 与 web 复用），预设映射：
    | 预设 | granularity |
    |------|-------------|
    | 今天 | hour |
    | 本周/本月 | day |
    | 本季度 | week |
    | 本年 | month |
    | 自定义 | 智能推测（≤1天=hour，≤30天=day，≤90天=week，>90天=month） |
- **验收**：切换预设后图表与表格同步刷新；自定义区间正确回填日期。

#### 3.2.2 区域维度统计 ⭐ 新增 ✅ 已实现
- **目标**：展示各区域（cn/us/eu/all）额度消耗。
- **方案**：
  - 后端：`stats_models.py` 补 `region` 维度，新增 `GET /api/stats/by-region` 返回 `[{ region, total, count, avg }]`
  - 前端：区域柱状图/占比图 + 对比表格（区域 / 消耗额度 / 调用次数 / 平均耗时 / 失败率）
- **验收**：by-region 返回按区域聚合数据；图表与表格数据一致；支持 region 筛选联动。

#### 3.2.3 每小时粒度区域监控 ⭐ 新增
- **目标**：精确追踪问题发生的时间与程度。
- **方案**：
  - 后端：新增 `HourlyRegionStats` 模型（`hour: datetime, region: str, total_cost, call_count, error_count, avg_latency`）；新增 `GET /api/stats/hourly?region=&hour=2026-08-17T14`
  - 前端：热力图（X=24 小时，Y=区域，颜色深度=消耗额度）；异常标记（>均值+3σ 红色高亮）；点击单元格弹 Top 10 调用详情
- **验收**：热力图正确渲染；异常单元格可点击并展示详情；接口按小时+区域精确过滤。

#### 3.2.4 趋势统计图表 ⭐ 新增 ✅ 已实现
- **目标**：直观展示关键指标变化与异常。
- **方案**：
  - 后端：`GET /api/stats/trend?field=cost|count|error_rate&granularity=day&range=30d` → `[{ date, value, p50, p95, p99, calls, anomaly }]`（`auth_app/stats_views.py` `StatsViewSet.trend`，线性插值分位 + 均值+3σ 异常标记）
  - 前端：消费趋势仪表盘（`pages/TrendAnalysis.tsx`）SVG 折线图，异常点红色标记、悬停显示异常详情；支持时间范围筛选（复用 `DateRangePicker`）
- **验收**：趋势线随筛选刷新；异常点标红可查看详情；对比视图正确。（已实现：后端单测 8/8 通过，前端 tsc/vitest 通过）

---

## 四、API 使用与消费控制需求

### 4.1 现状盘点（2026-08-18 实测）

| 功能 | 状态 | 关键证据 |
|------|------|----------|
| 意向分析调用付费 API | ✅ | `deepseek_service.py` → `DeepSeekClient` 调 deepseek-chat，按 token 计费 |
| 调用明细记录 | ✅ | `APICallLog` 模型记录每次 API 调用的 `tokens/cost/model/run_id` 等计费信息（`billing_models.py`）；`GET /api/usage/cost-breakdown` 费用分解接口（含单测） |
| 每日全局/每用户额度 | ✅ | `DeepSeekBudgetGate`（Redis 计数器），配置在 `settings.py` |
| 熔断机制 | ✅ | `QuotaStatus.circuitOpen` 字段，连续失败达阈值熔断 |
| 实时额度接口 | ✅ | `GET /api/deepseek/quota` + `get_quota_status()` |
| 桌面端消费额度预警 UI | ✅ | `App.tsx` 顶部 `quota-bar`：绿/黄/红三色 + 熔断徽标 + 30s 轮询 + 悬浮详情 + 升级瞬间系统通知/声音 |
| 告警 WebSocket 推送 | ✅ | `alert_service.push_quota_alert`（channels 推送）已与消费额度预警挂钩，`DeepSeekBudgetGate._maybe_push_quota_alert` 在状态升级时推送 |
| 消费预警配置项（开关/阈值/通知方式） | ✅ | 后端 `GET/POST /api/settings/quota-alert`；桌面端 Settings「消费预警」区（开关/预警阈值/临界阈值/桌面弹窗/声音/邮件） |
| 用户自有 API Key | ✅ | `UserProviderKey`（AES 加密）+ `POST /api/api-keys/user-key`、`/status/`、`/delete/`（支持 deepseek/grok 多 provider，含单测）；桌面端 Settings"API 密钥"区（掩码/余额/今日用量/保存自动验证） |
| 平台 API Key 管理 | ✅ | `apikey_views.py`：generate/list/detail/update/regenerate/logs/verify |
| 套餐/计费模型 | ✅ 已挂钩 | `auth_app/billing_service.py` 实时挂钩：`GET /api/billing/summary`（本月已用/套餐剩余/超限挂账/预估费用/建议）+ `GET /api/billing/monthly-detail`（按天账单），消费数据来自 `APICallLog` 真实落库 |
| 月度账单明细页 | ⚠️ 部分 | 后端 `GET /api/billing/monthly-detail` 已完成（含单测），前端账单页完善中 |

> ⚠️ **勘误**：原文档标注"消费额度预警 UI ❌"不准确——桌面端顶部额度进度条已完整实现。

### 4.2 优化需求

#### 4.2.1 意向分析费用机制（明确化）✅ 已实现
- **目标**：明确"分析功能使用指定付费 API + 费用产生机制"，并落库可查。
- **方案**：
  - `IntentAnalysisService` 每次调用后记录 `{ tokens, cost, model, timestamp, userId, runId }` → `APICallLog`
  - 定价参数集中到 `settings.py`（`DEEPSEEK_INPUT_PRICE`/`DEEPSEEK_OUTPUT_PRICE`，默认 ￥0.5/百万输入、￥2/百万输出）
  - 新增 `GET /api/usage/cost-breakdown`：按用户/时间/模型分解费用
- **验收**：每次意向分析产生一条可查询的计费记录；cost 与 token 数、单价计算一致。

#### 4.2.2 消费额度预警（补齐联动）✅ 已实现
- **目标**：全局额度使用达阈值时，桌面端有预警并可选推送。
- **方案**（在已实现的进度条基础上）：
  - 后端：`DeepSeekBudgetGate` 增加 `WARNING_THRESHOLD=0.8`/`CRITICAL_THRESHOLD=0.95`（已有 critical 配置，补 warning）；把消费额度预警接入 `alert_service._push_alert`（channels 推送）
  - 桌面端：阈值超限时右下角系统通知（Notification API）；Settings 新增"消费预警"配置项（开关/阈值/通知方式：弹窗/声音/邮件）
- **验收**：额度>80% 变黄、>95% 变红并弹通知；关闭预警后不再推送。

#### 4.2.3 用户 API 计费模式（明确化）
- **目标**：明确用户使用平台 API 的费用承担方式（官网有开发者中心）。
- **方案**（两级计费）：
  1. **套餐用户**：平台包销套餐内调用，超额度按量计费挂账
  2. **免费用户**：用平台共享 Key（受全局额度限制），或绑定自有 Key 免配额（✅ 已实现）
- **配套**：用户设置页展示"本月已用/套餐剩余/预估费用"；账单页月度明细；超额度引导"购买套餐/绑定自有 Key"
- **验收**：绑定自有 Key 后调用不再消耗平台额度；账单页明细与 APICallLog 一致。

---

## 五、消费趋势分析功能

### 5.1 现状盘点（2026-08-18 实测）

| 功能 | 状态 | 说明 |
|------|------|------|
| 消费趋势反向分析（trend-analysis） | ✅ | `GET /api/usage/trend-analysis`（`auth_app/usage_views.py`：总体趋势/成本分解/Top10/优化建议） |
| 成本分解 / Top N 昂贵调用 / 优化建议 | ✅ | 前端消费趋势仪表盘 `pages/TrendAnalysis.tsx`（SVG 折线图 + 按模型/场景分解 + Top10 列表 + 建议卡片） |
| 用户自有 API Key 管理 | ✅ | 见 §4.1（UserProviderKey + Settings 密钥区） |

### 5.2 优化需求

#### 5.2.1 消费趋势反向分析 ⭐ 新增 ✅ 已实现
- **目标**：帮助用户理解"钱花在哪里"，找出可优化点。
- **方案**：
  - 后端 `GET /api/usage/trend-analysis`（已实现 `auth_app/usage_views.py`）：
    - 总体趋势：每日/每周消费折线（cost/calls/tokens/error_rate + 单次费用 p50/p95/p99 分位 + 3σ 异常标记）
    - 成本分解：按模型（model）与场景（scenario）聚合占比
    - Top 10 昂贵调用：runId/时间/模型/token/费用/场景
    - 优化建议：规则驱动（模型成本集中 / 长尾高额调用 / 异常峰值 / 错误率偏高 / token 效率）
  - 桌面端/Web：消费趋势仪表盘（`pages/TrendAnalysis.tsx`，SVG 折线图 + 成本分解条形 + Top 10 昂贵调用列表 + 优化建议卡片）
- **验收**：趋势图、饼图、Top N 列表数据一致；异常峰值有标记与归因；建议卡片可点击跳转对应设置。（已实现：后端单测 8/8 通过，前端 tsc/vitest 通过）

---

## 六、账号与数据同步机制

### 6.1 现状盘点（2026-08-18 实测）

| 功能 | 状态 | 关键证据 |
|------|------|----------|
| 桌面端与官网共用 JWT | ✅ | 同一 Django 后端，JWT access + refresh |
| 登录态持久化（localStorage） | ✅ | `authService.ts`，refresh 有效期 30 天 |
| **登录态主进程备份（抗强杀）** | ✅ | `save-auth-state`/`get-auth-state` IPC + `auth-state.json` 落盘 + `will-quit` flushStorageData |
| **启动时恢复登录态** | ✅ | `App.tsx` checkAuth 调用 `restoreFromMain()` |
| **并发刷新保护（单飞）** | ✅ | 所有刷新点统一 `refreshTokenGuarded()`，杜绝"旧 token 被拉黑→误清登录态"（已修复） |
| 记住密码 | ✅ | `Auth.tsx` `REMEMBER_KEY` 加密存储用户名+密码，30 天有效期 |
| 首次登录确认（SetupWizard） | ✅ | 首次无账号 → SetupWizard 创建本地账号并写入数据库 |
| 桌面端→官网跳转 + 登录态同步 | ✅ | `openInBrowser.ts` 跳转时申请一次性临时 token（5 分钟、用后销毁）；后端 `POST /api/auth/desktop-login-token/` + `/api/auth/desktop-login/exchange/`；官网 App.tsx 自动检测 `auth_token` 并兑换（含单测） |
| 个性化数据后端同步（UserProfile） | ✅ | `UserProfile` 模型扩展主题/布局/收藏字段；`GET/PUT /api/user/profile`（`profile_views.py`）；桌面端 `profileService.ts` 登录拉取/变更同步（含单测） |
| 登录前后界面差异 | ⚠️ 部分 | 未登录显示 Auth 页，登录后进主界面；无"演示模式"水印 |

### 6.2 优化需求

#### 6.2.1 桌面端与官网账号数据互通 ⭐ 新增 ✅ 已实现
- **目标**：桌面端与官网（Web）登录态互通。
- **方案（推荐：同域 Cookie + Token 传递双保险）**：
  - 后端登录时 `Set-Cookie: auth_token=...; Domain=; Path=/; HttpOnly; SameSite=Lax`
  - 桌面端点击"官网"时，经 `shell.openExternal` 携带一次性临时 token（5 分钟、一次性、用后销毁）
- **验收**：桌面端跳转官网后免登录；临时 token 用后失效。

#### 6.2.2 官网跳转流程 ⭐ 新增 ✅ 已实现
- **目标**：桌面端相关入口直接跳转官网对应页面并保持登录态。
- **方案**：新建 `openInBrowser(url, preserveAuth=true)` 工具；入口映射：
  | 桌面端入口 | 跳转目标 |
  |------------|----------|
  | 设置 → 查看套餐 | `/pricing` |
  | 设置 → 管理账号 | `/account/settings` |
  | 消费预警 → 查看账单 | `/billing` |
  | API Key → 开发者中心 | `/developer` |
- **验收**：各入口可跳转且官网已登录；登录态失效时引导重新登录。

#### 6.2.3 首次登录确认流程（完善）
- **现状**：SetupWizard 自动建号并登录（✅）。
- **优化**：确认前增加"欢迎引导"（功能介绍 → 隐私说明 → 确认建号）；提供"已有账号？登录"入口；按使用场景预填配置。
- **验收**：首次用户完成引导后可进入主界面；已有账号用户可选登录而非重复建号。

#### 6.2.4 官网数据持久化 ⭐ 修复问题 ✅ 已实现
- **目标**：解决重新登录后个性化数据（主题/布局/收藏）丢失。
- **方案**：
  - 后端新增 `UserProfile` 表；`GET/PUT /api/user/profile` 读写主题/布局/收藏
  - 登录成功后前端自动拉取 profile 覆盖 localStorage；修改时同步保存
- **验收**：改主题/布局后登出再登入仍保持；后端 profile 与 localStorage 一致。

#### 6.2.5 记住密码（✅ 已实现，补优化）
- **现状**：`Auth.tsx` 已实现 `REMEMBER_KEY` 加密存储（用户名+密码，30 天）。
- **优化**：复选框默认勾选；未勾选时仅保存用户名；勾选时加密保存密码；启动时若 token 有效直接进主界面（✅ 已具备）。
- **验收**：勾选记住密码登出后再次打开登录页自动回填；未勾选不保存密码。

#### 6.2.6 登录前后界面数据差异化
- **优化**：未登录显示"演示模式"水印 + 演示数据 + 功能按钮标注"登录后可用"；登录后切换真实数据、隐藏水印。
- **验收**：未登录与已登录视图可明显区分；演示数据有明确标识。

---

## 七、边界条件与数据治理

> 目标：每个功能都定义明确的数据/参数/资源边界，防止运行日志无限增长、超大查询拖垮数据库。
> 合规依据：《网络安全法》第 21 条（网络日志留存 ≥ 6 个月）、《个人信息保护法》第 19 条（保存期限为实现目的之最短时间）、
> 《数据安全法》第 21 条（数据分类分级）。保留期均可通过环境变量覆盖，可随运营需要调整。

### 7.1 数据保留策略（自动清理，防止"数据越来越多撑爆"）

| 数据类别 | 涉及表 | 默认保留 | 清理机制 | 合规依据 |
|---------|--------|---------|---------|---------|
| 安全/操作日志（含登录 IP/设备等个人信息） | `auth_login_log` / `auth_api_key_usage_log` / `user_behavior_log` / `agent_activity_log` | **180 天** | `cleanup_old_logs`（每日 02:00）→ `DataCleanupService.run_all_cleanup`，分批删除 | 网安法 ≥ 6 个月 |
| 计费/消费记录 | `auth_app_api_call_log` | **365 天** | 同上（billing 档） | 费用对账周期 |
| 统计聚合快照（聚合数据，非原始个人信息） | `daily_platform_stats` / `skill_daily_stats` / `area_click_stats` / `revenue_daily_stats` / `hourly_region_stats` / `skill_hotness_snapshot` | **730 天** | 同上（stats 档） | 聚合数据、支撑 2 年趋势对比 |
| JWT 黑名单 | `token_blacklist.OutstandingToken` | 过期即清 | `cleanup_expired_tokens`（每 5 分钟） | 最小化原则 |
| Django Session | `django_session` | 过期即清 | `cleanup_expired_sessions`（每小时） | 最小化原则 |

配置项：`settings.DATA_RETENTION_DAYS`（`security_logs` / `billing_logs` / `stats_snapshots`），环境变量 `DATA_RETENTION_SECURITY_LOGS` 等可覆盖。
删除策略：按 id 分批（默认 1000 条/批）删除，避免一次性删除锁表。

### 7.2 接口边界（防超大查询）

| 接口/能力 | 边界 | 行为 |
|----------|------|------|
| 统计接口 `_parse_date_range` | 最大跨度 `STATS_MAX_RANGE_DAYS`（默认 **730 天**）；`days ∈ [1, 730]` | 超限自动收敛 start_date（保留 end_date） |
| `trend` / `hourly` 桶数 | 桶数 ≤ `STATS_MAX_BUCKETS`（默认 **2000**） | 超限返回 400，提示"缩短范围或降低粒度" |
| Top N 明细（trend-analysis / hourly top_calls） | ≤ 10 条 | 截断 |
| 明细列表接口 | page_size 上限 | 截断 |

### 7.3 各功能模块边界一览

| 模块 | 数据来源 | 数据量边界 | 查询边界 |
|------|---------|-----------|---------|
| §3 审计与统计 | 各日志 + 统计快照 | 日志 180 天 / 快照 730 天自动清理 | 查询跨度 ≤ 730 天、桶 ≤ 2000 |
| §3.2.3 每小时热力图 | `APIKeyUsageLog` | 原始日志 180 天清理，聚合快照 730 天 | 整点桶 ≤ 2000 |
| §3.2.4 趋势图表 | `APICallLog` | 计费记录 365 天清理 | 桶 ≤ 2000 |
| §4 消费控制 | `APICallLog` / `APIKeyUsageLog` | 同上 | 明细 Top ≤ 10 |
| §5 消费趋势分析 | `APICallLog` | 计费记录 365 天 | Top10 截断 |
| §6 账号同步（UserProfile） | 单条用户配置 | 不自动清理 | 单条读写 |
| M3 插件目录 | 文件系统 | 插件清单大小/数量受控（≤1MB 清单校验） | 列表分页 |

> 说明：RAG 知识库（`rag_kb_document`/`rag_kb_chunk`）为**用户主动上传的内容数据**，不属于运行日志，**不做自动删除**；
> 由知识库管理界面由用户自行维护。用户账单、套餐等财务主数据同理，仅归档不自动删除。

---

## 附录 A：实施优先级总览（重排）

| 优先级 | 需求领域 | 关键里程碑 | 依赖 |
|--------|----------|------------|------|
| P0 | 四模块融合文档 + 统一控制面 | M1 ✅ 已完成（保持） | 无 |
| P1 | 桌面端预设主题 + 自定义背景 | 一期外观升级 | ✅ 已完成（含深色模式样式修复） |
| P1 | 时间范围筛选 + 区域维度统计 | 统计一期 | ✅ 已完成（stats 后端扩展） |
| P1 | 消费额度预警联动 + 计费落库 | 消费控制一期 | ✅ 已完成（APICallLog + alert 挂钩） |
| P1 | 桌面端→官网跳转 + 登录态同步 | 账号互通一期 | ✅ 已完成（openInBrowser + 临时 token） |
| P1 | 官网数据持久化（UserProfile） | 账号互通二期 | ✅ 已完成（UserProfile 表 + API） |
| P1 | 推理引擎统一接口（M2） | 能力融合一期 | ✅ 已完成（InferenceProvider） |
| P2 | 每小时粒度区域监控热力图 | 统计二期 | ✅ 已完成（HourlyRegionStats + /api/stats/hourly + 前端热力图） |
| P2 | 趋势图表 + 消费趋势分析 | 分析一期 | ✅ 已完成（trend/trend-analysis 接口 + 消费趋势仪表盘 TrendAnalysis.tsx） |
| P2 | 插件源打通（M3） | 插件生态一期 | ✅ 已完成（PluginRegistry.loadFromDir + pluginDirLoader + 插件市场 UI） |
| P3 | 推理集群接入（M4） | 企业部署 | ✅ 已完成（ComputeProvider + 本地优先/过载回退路由） |

## 附录 B：P0 统一内部诊断通道（M1 MVP）登记

> 完整接口/数据结构见 📄 `P0-UNIFIED-CONTROL-PLANE-API.md`（v2.0 · 能力透明融合架构）

### 已实现接口
| 端 | 接口 | 状态 |
|----|------|------|
| 桌面端 | `modules:get-status` | ✅ `moduleControlService.ts` + 单测 |
| 桌面端 | `modules:get-log-level` / `modules:set-log-level` | ✅ |
| 桌面端 | `modules:get-deepseek-quota` | ✅ 转发 `GET /api/deepseek/quota` |
| 云端 | `GET /api/modules/status` | ✅ `content_app/control_plane_views.py` |
| 云端 | `GET/PUT /api/settings/log-level` | ✅ |
| 云端 | `GET /api/deepseek/quota` + `get_quota_status()` | ✅ `deepseek_service.py` |

### 验收要点
- 桌面端 7 本地 + 7 云端能力单元状态聚合，无品牌名 ✅
- 全局 + 按能力单元动态日志级别 ✅
- 消费预算闸门实时额度查询 ✅
- 不出现在设置页 UI、无品牌名、无模块管理面板 ✅
