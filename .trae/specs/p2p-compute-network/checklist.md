# Phase 2：P2P 算力网络 - 验收清单

## Batch 1: P2P 节点管理后端

### Task 7.1: p2p_app 数据模型
- [ ] `backend/p2p_app/__init__.py` 已创建
- [ ] `backend/p2p_app/models.py` 包含 P2PNode 模型（node_id/node_type/capabilities/resources/location/status/public_key/reputation_score/total_tasks/total_compute_hours/时间戳）
- [ ] `backend/p2p_app/models.py` 包含 NodeHeartbeat 模型（node_id外键/timestamp/cpu/memory/gpu/disk_io/network/idle_state/active_task_count）
- [ ] `backend/p2p_app/models.py` 包含 NodeReputation 模型（score/success_rate/avg_response_time/malicious_flags）
- [ ] P2PNode 模型包含 status/node_type/location/reputation/last_heartbeat 索引
- [ ] 数据库迁移文件已生成且可执行（`python manage.py makemigrations p2p_app` + `migrate` 成功）
- [ ] `config/settings.py` 的 INSTALLED_APPS 已添加 `'p2p_app'`

### Task 7.2: 节点注册与认证 API
- [ ] `backend/p2p_app/serializers.py` 已创建，包含 NodeRegisterRequest/Response 序列化器
- [ ] `POST /api/p2p/v1/nodes/register` 返回 201 + node_id + 平台证书
- [ ] `GET /api/p2p/v1/nodes/{node_id}` 返回节点完整详情
- [ ] `GET /api/p2p/v1/nodes?page=1&size=20&status=online` 支持分页和筛选
- [ ] `DELETE /api/p2p/v1/nodes/{node_id}/offline` 将节点标记为 offline
- [ ] `GET /api/p2p/v1/nodes/{node_id}/reputation` 返回信誉评分详情
- [ ] 所有 API 返回标准错误码（P2P_0001-P2P_0009）
- [ ] 路由已注册到 `config/urls.py`

### Task 7.3: 心跳服务与闲时检测
- [ ] `services/heartbeat_service.py` HeartbeatService 类已实现
- [ ] `PUT /api/p2p/v1/nodes/{node_id}/heartbeat` 接收并更新心跳数据
- [ ] 心跳间隔配置为 10 秒，超时阈值为 30 秒（3次间隔）
- [ ] `check_offline_nodes()` 定时任务能正确标记超时节点为 offline
- [ ] `services/idle_detection_service.py` IdleDetectionService 类已实现
- [ ] 闲时阈值：CPU<30%/内存<40%/磁盘IO<20%/网络<30%
- [ ] 闲时状态输出三态：IDLE / PARTIAL_BUSY / BUSY

### Task 7.4: 节点发现服务
- [ ] `services/discovery_service.py` NodeDiscoveryService 类已实现
- [ ] `discover_nodes(criteria)` 支持按 node_type/capabilities/resources/location/status/reputation 过滤
- [ ] 结果按 latency 升序排列，返回 Top-N
- [ ] `GET /api/p2p/v1/network/topology` 返回当前网络拓扑概览
- [ ] `validate_node_capability()` 能校验节点上报能力真实性

### Task 7.5: WebSocket 实时事件通道
- [ ] Django Channels 已安装并配置（settings.py CHANNEL_LAYERS 使用 Redis）
- [ ] `config/asgi.py` 已添加 WebSocket 路由
- [ ] `consumers/p2p_events.py` P2PEventConsumer AsyncWebsocketConsumer 已实现
- [ ] WS 连接 `/ws/p2p/v1/{node_id}/events` 可成功建立
- [ ] 客户端发送 heartbeat/task_result/idle_state_change/error 事件被正确处理
- [ ] 服务端推送 task_dispatched/force_migrate/config_update/maintenance_notice 事件成功到达客户端

## Batch 2: 任务分片与分布式执行引擎

### Task 8.1: 分片策略引擎
- [ ] `sharding/` 包目录结构完整
- [ ] Shard dataclass 定义完整（shard_id/task_id/sequence/total/payload_hash/dependencies/capabilities/resources/security_level/data_sensitivity）
- [ ] TextShardingStrategy 按段落切分，单分片≤1MB，附200字符上下文窗口
- [ ] ImageShardingStrategy 按1024x1024 tile切分，无依赖完全并行
- [ ] CodeShardingStrategy 基于AST按函数/类切分，构建DAG依赖图
- [ ] FileShardingStrategy 按512KB固定分块，SHA-256校验
- [ ] ShardingEngine 工厂方法根据 TaskType 自动选择策略

### Task 8.2: 任务数据模型与 API
- [ ] TaskShard 模型已创建并迁移
- [ ] TaskDispatch 模型已创建并迁移
- [ ] ShardResult 模型已创建并迁移
- [ ] POST /api/p2p/v1/tasks/dispatch 可分发任务分片
- [ ] GET /api/p2p/v1/tasks/{task_id} 返回任务详情
- [ ] GET /api/p2p/v1/tasks/{task_id}/status 返回当前状态
- [ ] POST /api/p2p/v1/tasks/{task_id}/shards/{shard_id}/result 可提交分片结果
- [ ] POST /api/p2p/v1/tasks/{task_id}/cancel 可取消任务

### Task 8.3: 任务调度器
- [ ] TaskDispatcher 类使用 heapq 优先级队列
- [ ] dispatch() 方法实现冗余因子=3（同一分片分发到3个节点）
- [ ] calculate_match_score() 实现5因子加权打分
- [ ] handle_node_failure() 实现故障转移（重标记→重新选节点→重分发→扣信誉）

### Task 8.4: 结果聚合器
- [ ] ResultAggregator.aggregate() 实现 MapReduce 式聚合
- [ ] 一致性校验：3一致直接采信、2/3多数投票采信、全不一致标记异常
- [ ] resolve_conflict() 支持多数投票+置信度优先+信誉加权
- [ ] DAG 拓扑排序合并有依赖的分片结果

### Task 8.5: 任务状态机
- [ ] 状态枚举定义完整：CREATED→SHARDING→DISPATCHING→EXECUTING→AGGREGATING/FAILED→VERIFYING→COMPLETED/ABORTED
- [ ] 状态转换合法性验证矩阵已实现
- [ ] 状态变更事件通过 Channel Layer 广播

## Batch 3: 成本路由引擎

### Task 9.1: 路由因子采集与加权打分
- [ ] routing/ 包已创建
- [ ] RoutingFactors dataclass 定义完整
- [ ] CostRoutingEngine 权重常量：cost=0.4, latency=0.25, reliability=0.2, security=0.1, geo=0.05
- [ ] route() 方法返回最优 RoutingDecision
- [ ] 约束过滤：信誉门槛/资源最低要求/地域限制/最大等待时间

### Task 9.2: 路由决策矩阵
- [ ] ROUTING_MATRIX 包含8个场景规则
- [ ] apply_routing_matrix() 根据任务特征自动匹配路由路径
- [ ] 场景特征自动识别准确率验证通过

### Task 9.3: 地域路由器
- [ ] GeoRouter 类已实现
- [ ] route_by_region() 强制地域约束生效
- [ ] 同地域内按延迟排序选择最近节点
- [ ] 多地域冗余模式可用

## Batch 4: 桌面客户端（Electron）

### Task 10.1: Electron 项目初始化
- [ ] desktop-client/package.json 已创建，依赖版本正确
- [ ] electron/main.ts 主进程入口可启动窗口
- [ ] electron/preload.ts 安全桥接配置正确
- [ ] electron-builder.yml Windows/Mac 打包配置就绪
- [ ] Vite + Electron 构建流程可运行（`npm run dev` 或等价命令）

### Task 10.2: P2P 节点服务
- [ ] P2PNodeService.register() 完成注册全流程
- [ ] HeartbeatService 每10秒通过WS发送心跳
- [ ] CryptoService RSA密钥对生成和加解密正常工作
- [ ] shutdown() 发送offline通知并清理资源

### Task 10.3: 闲时检测器
- [ ] IdleDetectorService 跨平台采集 CPU/内存/磁盘IO/网络带宽
- [ ] 三态判定 IDLE/PARTIAL_BUSY/BUSY 正确
- [ ] 采样频率为1秒
- [ ] 资源争用时 <100ms 触发迁移回调

### Task 10.4: 任务执行器与 Python 沙箱
- [ ] TaskExecutorService.executeTask() 验证ASS签名后启动子进程
- [ ] handleForceMigrate() 100ms内终止子进程并保存断点
- [ ] TaskSandbox 内存限制≤512MB、CPU≤1核、超时30s 生效
- [ ] 文件系统隔离和网络白名单限制生效
- [ ] executor.py 从 stdin 读取 payload 并输出 result.json 到 stdout
- [ ] python-runtime/requirements.txt 依赖完整

### Task 10.5: React 前端界面
- [ ] Dashboard 页面显示节点状态卡片+实时指标+算力贡献统计+积分收益
- [ ] Settings 页面支持算力开关/资源配置/隐私设置/自动更新
- [ ] Tasks 页面显示历史任务列表+执行状态+结果查看
- [ ] StatusIndicator 组件显示在线/离线/忙碌状态
- [ ] FileDropZone 组件支持拖拽上传 PDF/TXT/MD/图片
- [ ] Zustand store 管理节点和任务状态

### Task 10.6: 系统托盘与本地缓存
- [ ] 系统托盘显示节点状态/算力贡献/积分信息
- [ ] 托盘菜单功能完整（打开仪表盘/设置/退出）
- [ ] CacheService LRU淘汰策略生效，最大缓存2GB
- [ ] 模型缓存按hash组织目录+元数据
- [ ] IPC 处理器（node/task/system handler）全部注册

---

## 集成验收

### 全链路冒烟测试
- [ ] 桌面客户端启动 → 自动注册 → 心跳正常 → 标记为 online
- [ ] 通过 API 创建检测任务 → 分片 → 调度到桌面客户端节点 → 执行 → 结果回传 → 聚合 → 返回用户
- [ ] 模拟节点离线 → 服务端30秒内标记offline → 上面的任务故障转移成功
- [ ] 模拟闲时→忙碌切换 → 客户端触发迁移通知 → 服务端收到并处理
- [ ] WebSocket 双向通信稳定（心跳推送+任务下发+结果回传）

### 安全验收
- [ ] 未签名的任务请求被拒绝（HTTP 401/403）
- [ ] 节点信誉低于60分不再接收新任务
- [ ] 加密通信链路完整（RSA签名+AES加密+TLS传输）

### 不影响范围确认
- [ ] Phase 1 所有功能正常运行（Home页面/Agent中心/各检测结果页/会员系统）
- [ ] 前端信息流首页内容未修改
- [ ] Sprint 1 功能未回退（Copyscape/ResumeOptimizer/Academic/TipModal）

---

*文档版本: v1.0 | 创建日期: 2026-06-02 | 共计: ~90 个检查点*
