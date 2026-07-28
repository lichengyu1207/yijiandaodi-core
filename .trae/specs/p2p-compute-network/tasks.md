# Phase 2：P2P 算力网络 - 实施任务清单

## 任务总览
- **目标**：实现 EIHM-P2P-CS 算力网络层四核心模块
- **父规范**: [spec.md](./spec.md)
- **技术方案详情**: [platform-architecture-full/phase2-plan.md](../platform-architecture-full/phase2-plan.md)

---

# Tasks

## Batch 1: P2P 节点管理后端（基础层）✅ 已完成

- [x] **Task 7.1: 创建 p2p_app Django 应用与数据模型**
  - [x] 7.1.1 创建 `backend/p2p_app/` 目录结构（models/views/urls/serializers/consumers/services/migrations）
  - [x] 7.1.2 实现 P2PNode 模型 + NodeHeartbeat 模型 + NodeReputation 模型
  - [x] 1.1.3 生成数据库迁移文件 0001_initial.py
  - [x] 1.1.4 将 p2p_app 注册到 settings.py 的 INSTALLED_APPS

- [x] **Task 7.2: 节点注册与认证 API**
  - [x] 7.2.1 创建 serializers.py（8个序列化器）
  - [x] 7.2.2 实现 POST /nodes/register + GET /nodes/{id} + GET /nodes + DELETE /nodes/{id}/offline + GET /nodes/{id}/reputation
  - [x] 7.2.3 统一错误码 P2P_0001-P2P_0009
  - [x] 7.2.4 注册路由到 fangdudu_backend/urls.py

- [x] **Task 7.3: 心跳服务与闲时检测**
  - [x] 7.3.1 创建 services/heartbeat_service.py（HeartbeatService 类，10秒间隔，30秒超时判定离线）
  - [x] 7.3.2 创建 services/idle_detection_service.py（IdleDetectionService 三态判定 IDLE/PARTIAL_BUSY/BUSY）
  - [x] 7.3.3 实现 PUT /nodes/{node_id}/heartbeat 视图
  - [x] 7.3.4 实现 check_offline_nodes() 定时任务方法

- [x] **Task 7.4: 节点发现服务**
  - [x] 7.4.1 创建 services/discovery_service.py（NodeDiscoveryService 类，多维度过滤+延迟排序Top-N）
  - [x] 7.4.2 实现 GET /network/topology 网络拓扑端点
  - [x] 7.4.3 实现 POST /nodes/discover 节点发现端点
  - [x] 7.4.4 实现 validate_node_capability() 能力校验

- [x] **Task 7.5: WebSocket 实时事件通道**
  - [x] 7.5.1 配置 Django Channels（settings.py CHANNEL_LAYERS InMemoryChannelLayer）
  - [x] 7.5.2 修改 asgi.py 为 ProtocolTypeRouter（HTTP + WebSocket）
  - [x] 7.5.3 创建 consumers/p2p_events.py（P2PEventConsumer AsyncWebsocketConsumer）
  - [x] 7.5.4 WS 路由 ws/p2p/v1/{node_id}/events
  - [x] 7.5.5 双向事件：heartbeat/task_result/idle_state_change/error ← → task_dispatched/force_migrate/config_update/maintenance_notice

## Batch 2: 任务分片与分布式执行引擎 ✅ 已完成

- [x] **Task 8.1: 分片策略引擎**
  - [x] 8.1.1 创建 sharding/ 包 + strategies.py
  - [x] 8.1.2 Shard dataclass + TaskType 枚举 + ShardingStrategy ABC
  - [x] 8.1.3 TextShardingStrategy（段落切分 ≤1MB + 200字符上下文窗口 + 有序依赖）
  - [x] 8.1.4 ImageShardingStrategy（1024x1024 tile 切分 + 无依赖并行）
  - [x] 8.1.5 CodeShardingStrategy（函数/类边界切分 + DAG依赖）
  - [x] 8.1.6 FileShardingStrategy（512KB 固定分块 + SHA-256校验 + 断点续传）
  - [x] 8.1.7 ShardingEngine 工厂类 + compute_payload_hash()

- [x] **Task 8.2: 任务数据模型与 API**
  - [x] 8.2.1 TaskDispatch 模型（状态机 + 安全/隐私级别 + 分片统计）+ 迁移 0002_task_models.py
  - [x] 8.2.2 TaskShard 模型（依赖关系 + 能力需求 + 冗余分配节点列表）
  - [x] 8.2.3 ShardResult 模型（执行结果 + 资源使用 + 签名验证）
  - [x] 8.2.4 6个任务 REST API 视图（dispatch/detail/status/result/list/cancel）

- [x] **Task 8.3: 任务调度器（SJF 变种）**
  - [x] 8.3.1 创建 services/dispatcher.py（SchedulableShard + DispatchPlan + TaskDispatcher）
  - [x] 8.3.2 heapq 优先队列 + calculate_match_score 五因子加权打分
  - [x] 8.3.3 select_candidate_nodes 冗余因子=3 + handle_node_failure 故障转移

- [x] **Task 8.4: 结果聚合器**
  - [x] 8.4.1 创建 services/aggregator.py（ResultAggregator 类）
  - [x] 8.4.2 aggregate_shard 多数投票一致性校验（3一致/2-3多数/全不一致）
  - [x] 8.4.3 resolve_conflict 冲突解决（多数投票+置信度+信誉加权）
  - [x] 8.4.4 _merge_ordered_results + _topological_sort DAG 排序合并

- [x] **Task 8.5: 任务状态机**
  - [x] 8.5.1 创建 services/task_state_machine.py（9态枚举 + 合法转换矩阵 + 钩子系统）
  - [x] 8.5.2 TaskStateMachine 类（transition_to/can_transition_to/register_hook/from_task）
  - [x] 8.5.3 GET /tasks/{task_id}/transitions 视图

## Batch 3: 成本路由引擎（实施中）

- [x] **Task 9.1: 路由因子采集与加权打分**
  - [x] 9.1.1 创建 routing/ 包 + engine.py
  - [x] 9.1.2 RoutingFactors/RoutingDecision 数据类 + CostRoutingEngine 类
  - [x] 9.1.3 五因子归一化打分（cost=0.4/latency=0.25/reliability=0.2/security=0.1/geo=0.05）
  - [x] 9.1.4 route() 核心方法：约束过滤→加权打分→排序选优→生成决策

- [ ] **Task 9.2: 路由决策矩阵**
  - [ ] 9.2.1 创建 routing/matrix.py（ROUTING_MATRIX 8场景常量定义）
  - [ ] 9.2.2 RoutingMatrixEngine.match_scenario() 场景匹配
  - [ ] 9.2.3 apply_routing_matrix() 路径映射到 node_type 过滤

- [ ] **Task 9.3: 地域路由器**
  - [ ] 9.3.1 创建 routing/geo_router.py（GeoRouter 类 + REGION_GROUPS 映射表）
  - [ ] 9.3.2 route_by_region() 地域强制约束路由
  - [ ] 9.3.3 get_multi_region_candidates() 多地域冗余选择

## Batch 4: 桌面客户端（Electron）（待开始）

- [ ] **Task 10.1: Electron 项目初始化与主进程**
  - [ ] 10.1.1 创建 desktop-client/ 目录结构（electron/main.ts/preload.ts/tray.ts + src/ + python-runtime/）
  - [ ] 10.1.2 初始化 package.json（electron^28 + electron-builder + react + typescript + vite + tailwindcss + zustand + systeminformation）
  - [ ] 10.1.3 实现 electron/main.ts 主进程入口
  - [ ] 10.1.4 实现 electron/preload.ts 安全桥接
  - [ ] 10.1.5 配置 electron-builder.yml + Vite + Electron 构建流程

- [ ] **Task 10.2: P2P 节点服务（Electron 主进程）**
  - [ ] 10.2.1 创建 electron/services/p2p-node.service.ts（注册/心跳/关闭全流程）
  - [ ] 10.2.2 创建 electron/services/heartbeat.service.ts（10秒WS心跳循环）
  - [ ] 10.2.3 创建 electron/services/crypto.service.ts（RSA/AES加解密+签名验签）

- [ ] **Task 10.3: 闲时检测器**
  - [ ] 10.3.1 创建 electron/services/idle-detector.service.ts（跨平台系统指标采集）
  - [ ] 10.3.2 三态判定 IDLE/PARTIAL_BUSY/BUSY + <100ms 紧急迁移回调

- [ ] **Task 10.4: 任务执行器与 Python 沙箱**
  - [ ] 10.4.1 创建 electron/services/task-executor.service.ts（ASS签名验证→venv子进程→结果签名回传）
  - [ ] 10.4.2 创建 python-runtime/sandbox.py（TaskSandbox 内存≤512MB/CPU≤1核/超时30s）
  - [ ] 10.4.3 创建 python-runtime/executor.py（stdin读取payload→执行→stdout输出result.json）
  - [ ] 10.4.4 创建 python-runtime/requirements.txt（psutil+cryptography+requests+websocket-client）

- [ ] **Task 10.5: React 前端界面**
  - [ ] 10.5.1 Dashboard 页面（节点状态卡片+实时指标+算力贡献+积分收益）
  - [ ] 10.5.2 Settings 页面（算力开关/资源配置/隐私设置/自动更新）
  - [ ] 10.5.3 Tasks 页面（历史任务列表+执行状态+结果查看）
  - [ ] 10.5.4 StatusIndicator/FileDropZone 组件 + Zustand stores

- [ ] **Task 10.6: 系统托盘与本地缓存**
  - [ ] 10.6.1 electron/tray.ts 托盘菜单（状态/算力/积分/打开仪表盘/设置/退出）
  - [ ] 10.6.2 electron/services/cache.service.ts（LRU淘汰 最大2GB缓存 + 模型缓存 + 结果缓存）
  - [ ] 10.6.3 IPC 处理器（node/task/system handler 全部注册）

---

# Task Dependencies
```
Batch 1 (✅ 完成) ──→ Batch 2 (✅ 完成) ──→ Batch 3 (🔄 进行中) ──→ Batch 4 (⏳ 待开始)
   7.1→7.2→7.3→7.4→7.5      8.1→8.2→8.3→8.4→8.5      9.1✅ → 9.2 → 9.3          10.1 → 10.2-10.6
```

*文档版本: v1.1 | 恢复日期: 2026-06-02 | 总计: 4批次 / 22主任务 / ~120子任务*
