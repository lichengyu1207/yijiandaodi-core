# 一鉴到底 - 代码梳理报告

## 🎯 核心定位回顾

**产品本质**：本地运行的 AI 操作行为校验工具

**核心价值**：
- 不出域（数据不离开用户设备）
- 数据属于用户（用户可导出、可删除）
- 操作白盒化（完整记录操作过程）
- 常态化巡检（持续监控 AI 行为）
- 桌面端 + API（开箱即用）

---

## 📊 代码分类统计

| 分类 | 文件数 | 占比 | 建议 |
|------|--------|------|------|
| 🔴 分岔代码 | 150+ | 60% | 删除/暂停 |
| 🟢 核心代码 | 50 | 20% | 重点优化 |
| 🟡 待定代码 | 50 | 20% | 评估后决定 |

---

## 🟢 核心代码（必须保留）

### 1. 桌面端（核心界面）

```
desktop-client/
├── electron/main.ts          ✅ 核心 - Electron 主进程
├── electron/tray.ts          ✅ 核心 - 系统托盘
├── src/pages/Dashboard.tsx   ✅ 核心 - 主界面
└── src/pages/Settings.tsx    ✅ 核心 - 设置页面
```

**保留原因**：这是产品的唯一用户界面

---

### 2. 后端核心 API

```
backend/auth_app/
├── models.py                 ✅ 核心 - 用户模型
├── authentication.py         ✅ 核心 - JWT 认证
├── views.py                  ✅ 核心 - 登录/注册
├── original_work_urls.py     ✅ 核心 - 原创作品 API
├── original_work_views.py    ✅ 核心 - 原创作品处理
├── timestamp_urls.py         ✅ 核心 - 时间戳 API
└── report_urls.py            ✅ 核心 - 报告生成
```

**保留原因**：这是产品的能力输出

---

### 3. 数据同步核心

```
backend/auth_app/
├── extension_sync_urls.py    ✅ 核心 - 插件同步（可改名为 sync_urls.py）
└── agent_flow_urls.py        ✅ 核心 - Agent 数据流
```

**保留原因**：数据传输的核心管道

---

### 4. 证据链核心

```
backend/auth_app/
├── grok_memory.py            ✅ 核心 - 记忆系统（证据存储）
├── grok_tools.py             ⚠️ 可简化 - 只保留核心工具
└── agent_models.py           ✅ 核心 - Agent 配置
```

**保留原因**：证据生成和存储

---

## 🔴 分岔代码（删除/暂停）

### 1. 功能堆叠 - 鉴别类（偏离核心）

```
backend/content_app/
├── copyscape_models.py       🔴 删除 - 文案鉴别
├── copyscape_urls.py         🔴 删除
├── copyscape_views.py        🔴 删除
├── grammarly_models.py       🔴 删除 - 语法检查
├── grammarly_urls.py         🔴 删除
├── grammarly_views.py        🔴 删除
├── tech_models.py            🔴 删除 - 代码鉴别
├── tech_urls.py              🔴 删除
└── tech_views.py             🔴 删除
```

**删除原因**：偏离"常态化巡检"核心，变成功能堆叠

---

### 2. 功能堆叠 - 场景类（稀释资源）

```
backend/content_app/
├── b_scenario_urls.py        🔴 删除 - B 端场景
├── b_scenario_views.py       🔴 删除
├── c_scenario_urls.py        🔴 删除 - C 端场景
├── c_scenario_views.py       🔴 删除
├── resume_models.py          🔴 删除 - 简历鉴别
├── resume_urls.py            🔴 删除
└── resume_views.py           🔴 删除
```

**删除原因**：功能堆叠，分散开发资源

---

### 3. 企业功能（过度开发）

```
backend/auth_app/
├── enterprise_models.py      🔴 暂停 - 企业版
├── enterprise_urls.py        🔴 暂停
├── enterprise_views.py       🔴 暂停
├── affiliate_models.py       🔴 删除 - 推荐系统
├── affiliate_urls.py         🔴 删除
├── affiliate_views.py        🔴 删除
├── mall_models.py            🔴 暂停 - 积分商城
├── mall_urls.py              🔴 暂停
└── mall_views.py             🔴 暂停
```

**删除原因**：过度开发，超出产品定位

---

### 4. 安全测试系统（分岔）

```
backend/auth_app/
├── security_test_urls.py     🔴 暂停 - 安全测试
├── security_test_views.py    🔴 暂停
├── fp_detector_lite.py       🔴 暂停 - 误报检测
├── fp_urls.py                🔴 暂停
├── fp_views.py               🔴 暂停
├── prompt_defense_urls.py    🔴 暂停 - Prompt 注入
└── automated_judgment.py     🔴 暂停 - 自动化研判
```

**删除原因**：分岔功能，偏离核心定位

---

### 5. P2P 计算网络（无关功能）

```
backend/p2p_app/              🔴 全部删除 - P2P 计算
grok/                         🔴 全部删除 - Grok SDK 转换
.trae/skills/                 🔴 暂停 - Skill 系统（14个skill）
.trae/specs/p2p-compute-network/  🔴 删除 - P2P 规划
```

**删除原因**：完全无关的功能，浪费开发资源

---

### 6. 浏览器插件（分散重心）

```
browser-extension/            ⚠️ 暂停 - 插件开发
browser-extension-pack/       ⚠️ 暂停
```

**暂停原因**：分散开发重心，应该聚焦桌面端

---

### 7. 前端功能页面（过度开发）

```
frontend/src/pages/
├── Copyscape/                🔴 删除 - 文案鉴别
├── Grammarly/                🔴 删除 - 语法检查
├── BScenarios/               🔴 删除 - B 端场景
├── RAGSearch/                🔴 删除 - RAG 搜索
├── AntiFraud/                🔴 删除 - 反欺诈
├── RiskControl/              🔴 删除 - 风控
├── DualEngine/               🔴 删除 - 双引擎
├── UnifiedScan/              🔴 删除 - 统一扫描
├── Mall/                     🔴 暂停 - 积分商城
└── Pricing/                  🔴 暂停 - 定价页
```

**删除原因**：功能堆叠，界面过于复杂

---

## 🟡 待定代码（需评估）

### 1. Agent 系统

```
backend/auth_app/
├── agent_models.py           🟡 待定 - 保留核心 Agent
├── agent_urls.py             🟡 待定 - 简化 API
├── agent_views.py            🟡 待定 - 简化逻辑
├── agent_flow_urls.py        🟡 待定 - 数据流 API
├── grok_tools.py             🟡 待定 - 只保留核心工具
└── grok_memory.py            🟡 待定 - 保留
```

**建议**：只保留 3 个核心 Agent（审计、验证、存证），删除其他

---

### 2. 前端核心页面

```
frontend/src/pages/
├── Dashboard/                🟡 保留 - 主仪表盘
├── Login/                    🟡 保留 - 登录页
├── MyReports/                🟡 保留 - 我的报告
├── Settings/                 🟡 保留 - 设置
├── Home/                     🟡 保留 - 首页
└── About/                    🟡 保留 - 关于页
```

**建议**：保留，简化

---

### 3. 桌面端

```
desktop-client/               🟢 核心 - 重点开发
├── electron/                 🟢 核心 - Electron 主进程
└── src/                      🟢 核心 - 前端界面
```

**建议**：这是产品的核心界面，重点优化

---

## 📋 收拢建议

### 第一阶段：删除分岔代码

```bash
# 删除以下目录
rm -rf backend/content_app/copyscape_*
rm -rf backend/content_app/grammarly_*
rm -rf backend/content_app/tech_*
rm -rf backend/content_app/b_scenario_*
rm -rf backend/content_app/c_scenario_*
rm -rf backend/content_app/resume_*
rm -rf backend/p2p_app/
rm -rf grok/
rm -rf browser-extension/
rm -rf browser-extension-pack/

# 删除前端功能页面
rm -rf frontend/src/pages/Copyscape/
rm -rf frontend/src/pages/Grammarly/
rm -rf frontend/src/pages/BScenarios/
rm -rf frontend/src/pages/RAGSearch/
rm -rf frontend/src/pages/AntiFraud/
rm -rf frontend/src/pages/RiskControl/
rm -rf frontend/src/pages/DualEngine/
rm -rf frontend/src/pages/UnifiedScan/
```

### 第二阶段：简化 Agent 系统

```python
# 只保留 3 个核心 Agent
KEEP_AGENTS = ['auditor', 'verifier', 'archiver']

# 删除其他 Agent
DELETE_AGENTS = ['judge', 'detector', 'grok-build', 'explore', 'plan']
```

### 第三阶段：聚焦桌面端

```
一鉴到底 2.0
├── desktop-client/           ← 唯一界面
│   ├── Dashboard              ← 常态化巡检
│   ├── Reports                ← 证据报告
│   └── Settings               ← 设置
│
└── backend/                   ← 核心 API
    ├── /api/auth/login/       ← 登录
    ├── /api/auth/sync/        ← 数据同步
    ├── /api/auth/verify/      ← 原创验证
    └── /api/auth/report/      ← 报告生成
```

---

## 🎯 最终目标

**产品形态**：
- 一个桌面端应用（Electron）
- 4 个核心 API（登录、同步、验证、报告）
- 3 个核心 Agent（审计、验证、存证）

**核心能力**：
- 本地运行，数据不出域
- 操作白盒化，完整记录
- 常态化巡检，持续监控
- 一键生成证据报告

---

## 📊 预期效果

| 指标 | 现在 | 收拢后 |
|------|------|--------|
| 代码文件数 | 300+ | 100 |
| API 端点数 | 100+ | 10 |
| 功能模块数 | 30+ | 5 |
| 用户认知成本 | 高 | 低 |
| 开发维护成本 | 高 | 低 |

---

**下一步**：选择删除或暂停哪些代码？