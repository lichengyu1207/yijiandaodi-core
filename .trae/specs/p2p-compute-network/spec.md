# Phase 2：EIHM-P2P-CS 算力网络层实施规范

## Why

Phase 1 已完成基础底座（ASS 安全网关、统一结果页、Agent 编排层、强筛选机制）。根据豆包对话文档第五部分，平台核心差异化能力在于 **EIHM-P2P-CS 端侧闲时异构微算力 P2P 协同调度网络**，这是实现「成本比传统云方案低 10 倍」的关键技术路径。当前需要从规划进入实施阶段。

## What Changes

### 新增模块

- **P2P 节点管理后端**（Django App: `p2p_app`）：节点注册、心跳、发现、闲时检测、信誉评分、WebSocket 实时通道
- **任务分片与分布式执行引擎**：文本/图片/代码/文件四类分片策略、SJF 调度器、结果聚合器、容错控制器
- **成本路由引擎**：五因子加权打分（成本40%/延迟25%/可靠性20%/安全10%/地域5%）、八场景路由决策矩阵
- **桌面客户端**（Electron 项目 `desktop-client/`）：P2P 节点服务、Python 子进程沙箱、系统托盘、闲时检测、本地缓存

### 修改范围

- 后端新增 Django app `p2p_app`，注册到 `INSTALLED_APPS`
- 新增 `/api/p2p/v1/*` RESTful API 路由
- 新增 `/ws/p2p/v1/{node_id}/events` WebSocket 端点
- 前端 Agent 执行中心新增 P2P 网络状态面板（可选展示）
- 数据库迁移：新增 `p2p_node`、`node_heartbeat`、`node_reputation`、`task_shard`、`task_dispatch` 等表

### 集成约束

- 所有分发到 P2P 节点的任务必须经过 **ASS 静态层巡检签名**
- 节点只执行带有平台签名的任务指令，拒绝任何未签名请求
- 不修改 Phase 1 已完成的任何功能
- 前端信息流首页内容不变

## Impact

- Affected specs: [platform-architecture-full/spec.md](../platform-architecture-full/spec.md) Phase 2 部分
- Affected code:
  - 后端：新建 `backend/p2p_app/` 全部模块
  - 后端：修改 `backend/config/settings.py`（INSTALLED_APPS、DATABASES、CHANNEL_LAYERS）
  - 后端：修改 `backend/config/urls.py`（新增 p2p 路由）
  - 后端：修改 `backend/config/asgi.py`（WebSocket 路由）
  - 客户端：新建 `desktop-client/` 整个项目
  - 前端：可选性扩展 Agent 执行中心 P2P 展示组件

---

## ADDED Requirements

### Requirement: P2P 节点注册与生命周期管理

系统 SHALL 提供完整的节点注册、心跳保活、在线发现、离线检测、信誉评分能力。

#### Scenario: 桌面客户端首次注册
- **WHEN** 用户安装并启动桌面客户端
- **THEN** 客户端自动采集硬件信息（CPU/内存/GPU/磁盘）并生成 RSA 密钥对
- **THEN** POST `/api/p2p/v1/nodes/register` 完成注册，获得唯一 node_id 和平台证书
- **THEN** 客户端启动每 10 秒一次的心跳循环

#### Scenario: 心跳超时自动离线
- **WHEN** 节点连续 30 秒（3次心跳间隔）未上报
- **THEN** 服务端自动将该节点标记为 offline 状态
- **THEN** 该节点上运行中的任务触发故障转移流程

#### Scenario: 节点发现与筛选
- **WHEN** 编排层发起节点发现请求
- **THEN** 返回满足条件（类型/能力/资源/地域/状态/信誉）的候选节点列表
- **THEN** 按 latency 升序排列，返回 Top-N 结果

### Requirement: 闲时检测与算力抢占保护

系统 SHALL 实时监测节点资源占用，在用户本地需求飙升时 100ms 内释放算力。

#### Scenario: 节点空闲判定
- **WHEN** CPU < 30% 且 内存 < 40% 且磁盘IO < 20% 且 网络 < 30%
- **THEN** 节点状态为 IDLE，可接收新任务

#### Scenario: 用户本地占用飙升
- **WHEN** 任一资源指标超过 80%
- **THEN** 立即触发 force_migrate 事件，100ms 内终止或迁移任务
- **THEN** 通知服务端重新分配受影响任务

### Requirement: 任务分片与分布式调度

系统 SHALL 支持文本/图片/代码/文件四种类型的智能分片，采用 SJF 变种算法调度到最优节点。

#### Scenario: 文本任务分片
- **WHEN** 接收到 >1MB 的文本检测任务
- **THEN** 按段落边界切分，单段超阈值则按句子切分
- **THEN** 每个分片 ≤ 1MB，附带上下文窗口（前后各200字符）
- **THEN** 记录 SHA-256 哈希和 DAG 依赖关系

#### Scenario: 冗余分发与一致性校验
- **WHEN** 分片被调度执行
- **THEN** 同一分片分发到 3 个节点（冗余因子=3）
- **THEN** 收集结果后进行一致性校验：3节点一致→采信；2/3一致→采信多数并标记异常；全不一致→人工审核

### Requirement: 成本路由引擎多因子决策

系统 SHALL 基于五因子加权评分和场景化路由矩阵，为每个原子任务选择最优执行路径。

#### Scenario: 小文本快速路由
- **WHEN** 文本大小 < 1KB 且类型为 text
- **THEN** 优先路由到本地浏览器 TF 推理或桌面节点
- **THEN** 备选路径为云端 API

#### Scenario: 高隐私数据路由
- **WHEN** 任务隐私等级为 confidential
- **THEN** 强制路由到纯本地执行路径
- **THEN** 备选路径为加密 P2P 通道

#### Scenario: 地域合规路由
- **WHEN** 任务指定 data_residency 为 CN-East
- **THEN** 仅选择 CN-East 地域内的可用节点
- **THEN** 同地域内按延迟排序

### Requirement: 桌面客户端 P2P 节点

系统 SHALL 提供跨平台（Windows/Mac）桌面客户端，作为 P2P 算力网络的贡献节点。

#### Scenario: 客户端启动与注册
- **WHEN** 用户启动桌面客户端
- **THEN** 显示系统托盘图标和主仪表盘窗口
- **THEN** 自动完成节点注册和心跳连接
- **THEN** 仪表盘实时显示节点状态、算力贡献、积分收益

#### Scenario: Python 沙箱任务执行
- **WHEN** 客户端接收到经 ASS 签名的任务分片
- **THEN** 在隔离的 Python venv 子进程中执行
- **THEN** 资源限制：内存≤512MB、CPU≤1核、超时30秒
- **THEN** 执行完成后对结果签名并回传

#### Scenario: 一键下线
- **WHEN** 用户点击托盘菜单「退出」或关闭客户端
- **THEN** 发送 offline 通知到服务端
- **THEN** 清理本地临时文件和缓存
- **THEN** 优雅停止所有运行中的任务

### Requirement: WebSocket 实时事件通道

系统 SHALL 通过 WebSocket 维持服务端与节点的长连接，支持双向实时通信。

#### Scenario: 服务端推送新任务
- **WHEN** 有新的分片需要分发到某节点
- **THEN** 通过 WS 推送 `task_dispatched` 事件，携带任务 payload、ASS 签名、超时时间

#### Scenario: 节点上报心跳
- **WHEN** 节点定时发送心跳
- **THEN** 通过 WS 发送 `heartbeat` 事件，携带实时指标和闲时状态
- **THEN** 服务端更新节点状态并在有任务时随响应下发

### Requirement: 节点信任与安全体系

系统 SHALL 通过信誉评分、沙箱隔离、多数投票三重机制保障 P2P 网络安全。

#### Scenario: 恶意节点处置阶梯
- **WHEN** 节点第 1 次返回异常结果
- **THEN** 扣除积分，信誉 -10
- **WHEN** 节点第 2 次返回异常结果
- **THEN** 临时封禁 7 天，信誉 -30
- **WHEN** 节点第 3 次持续异常
- **THEN** 永久拉黑，清除所有积分

#### Scenario: 加密通信全链路
- **WHEN** 节点注册时生成 RSA 密钥对
- **THEN** 公钥上传平台，私钥本地安全存储
- **WHEN** 任务分发时用节点公钥加密 + ASS 签名
- **WHEN** 结果回传时节点对结果签名，平台验签

---

## MODIFIED Requirements

无。Phase 2 为纯新增模块，不修改 Phase 1 已完成的任何功能。

---

## REMOVED REQUIREMENTS

无。

---

## 实施优先级与批次

| 批次 | 内容 | 依赖 | 可并行 |
|------|------|------|--------|
| Batch 1 | Task 7: P2P 节点管理后端（数据模型+REST API+WebSocket） | 无 | - |
| Batch 2 | Task 8: 任务分片与分布式执行引擎 | Batch 1 | - |
| Batch 3 | Task 9: 成本路由引擎 | Batch 1 + Batch 2 | - |
| Batch 4 | Task 10: 桌面客户端（Electron） | Batch 1 | 与 Batch 2/3 并行 |

*注：Batch 4（桌面客户端）仅依赖 Batch 1 的 API 定义，可与 Batch 2/3 同时开发*

---

*文档版本: v1.0 | 创建日期: 2026-06-02 | 基于: platform-architecture-full/phase2-plan.md + 和豆包的对话_0602.txt*
