# Phase 2：EIHM-P2P-CS 算力网络层技术方案

## 文档信息

| 项目 | 内容 |
|------|------|
| 版本 | v1.0 |
| 阶段 | Phase 2（第31-90天） |
| 核心目标 | 实现 EIHM-P2P-CS 算力网络层 |
| 父规范 | [platform-architecture-full/spec.md](./spec.md) |
| 业务来源 | [和豆包的对话_0602.txt](../../和豆包的对话_0602.txt) 第五部分 |

---

## 1. Phase 2 概述

### 1.1 时间范围与里程碑

| 周次 | 时间范围 | 核心主题 | 关键交付物 |
|------|----------|----------|------------|
| 第5周 | 第31-40天 | P2P网络基础 | 节点注册/心跳/发现、任务分片/分发/容错 |
| 第6周 | 第41-50天 | 成本路由+客户端 | 路由引擎、Windows/Mac桌面客户端 |
| 第7-8周 | 第51-70天 | 技能接入 | 100个核心技能接入P2P调度系统 |
| 第9周 | 第71-80天 | 网络优化+测试 | 传输优化、压力测试、安全测试 |
| 第10周 | 第81-90天 | 上线公测 | 生产部署、积分系统、外部公测 |

### 1.2 核心目标

Phase 2 的核心目标是**跑通「节点注册 → 闲时检测 → 任务分片 → 分发执行 → 结果验证」全链路**，实现 EIHM-P2P-CS 三级算力网络的基础能力：

- **Task 7**：P2P 节点管理子系统（注册、心跳、发现、闲时检测）
- **Task 8**：任务分片与分布式执行引擎（分片策略、调度、结果聚合）
- **Task 9**：成本路由引擎（多因子加权调度决策）
- **Task 10**：桌面客户端（Electron + Python 子进程）

### 1.3 与 Phase 1 的关系

Phase 1 已完成的基础底座是 Phase 2 的前提条件：

```
Phase 1 产出                          Phase 2 消费
─────────────────────────────────    ─────────────────────────────
ASS 安全网关（输入层+输出层巡检） ─→  P2P 任务分发前必须经过 ASS 签名
智能编排层（Agent 执行中心）     ─→  编排层拆解后的原子任务进入成本路由
统一执行引擎（技能插件框架）     ─→  技能插件在 P2P 节点上分布式执行
API 网关 + 双写同步              ─→  新增 /api/p2p/* 路由，走同一网关
SQLite 本地存储                  ─→  P2P 数据使用独立存储（PostgreSQL/TiKV）
老骇心法 UI 组件库               ─→  客户端复用相同设计语言
```

**关键集成点**：
- 所有分发到 P2P 节点的任务必须经过 **ASS 静态层巡检签名**
- 节点只执行带有平台签名的任务指令，拒绝任何未签名请求
- 任务执行过程中受 **ASS 动态层巡检** 监控
- 返回结果经过 **ASS 输出层巡检** 后才返回用户

### 1.4 验收标准

- [ ] 1000 个以上测试节点能自动组网、心跳正常
- [ ] 能调度闲时算力执行任务，任务执行成功率 > 99%
- [ ] 成本比传统云方案低 10 倍以上
- [ ] 100 个核心技能全部接入 P2P 调度系统
- [ ] Windows/Mac 桌面客户端可安装运行并贡献算力
- [ ] NAT 穿透成功率 ≥ 99%，平均网络延迟 ≤ 100ms

---

## 2. 技术架构设计

### 2.1 Task 7：P2P 节点管理

#### 2.1.1 架构总览

```
┌──────────────────────────────────────────────────────────────┐
│                    P2P 节点管理层                              │
├──────────┬──────────┬──────────┬──────────┬──────────────────┤
│ 节点注册  │ 心跳服务  │ 发现服务  │ 闲时检测  │   信誉评分       │
│ Service  │ Service  │ Service  │ Service  │   Service        │
└────┬─────┴────┬─────┴────┬─────┴────┬─────┴────────┬─────────┘
     │          │          │          │              │
     ▼          ▼          ▼          ▼              ▼
┌──────────────────────────────────────────────────────────────┐
│                    节点数据层 (PostgreSQL)                     │
│  p2p_node │ node_heartbeat │ node_capability │ node_reputation│
└──────────────────────────────────────────────────────────────┘
```

#### 2.1.2 前端节点类型

| 节点类型 | 接入方式 | 算力类型 | 接入技术栈 | Phase 2 范围 |
|----------|----------|----------|-----------|-------------|
| 浏览器端 TF 推理节点 | 打开网页自动注册 | GPU (WebGPU/WebGL) | TensorFlow.js + Web Worker | 基础注册（完整 TF 推理在 Phase 3） |
| 桌面客户端节点（Windows/Mac） | 安装 Electron 客户端 | CPU/GPU | Electron + React + Python 子进程 | **核心交付物** |
| 移动端轻量节点 | WebView 内嵌 | CPU | React Native / WebView | Phase 3 |
| 企业私有化节点 | 企业部署 | CPU/GPU/NPU | Docker/K8s | Phase 3 |
| 平台自营节点 | 平台部署 | CPU/GPU/NPU | K8s + GPU 集群 | 兜底节点 |

#### 2.1.3 后端服务设计

**节点注册服务（NodeRegistryService）**

```python
class NodeRegistryService:
    def register_node(self, request: NodeRegisterRequest) -> NodeRegisterResponse:
        """
        节点注册流程：
        1. 验证请求签名（防伪造注册）
        2. 生成唯一 node_id（UUID v4）
        3. 生成节点密钥对（RSA-2048），私钥返回给节点
        4. 记录节点基本信息到数据库
        5. 返回注册成功 + 节点凭证
        """

    def validate_node_capability(self, node_id: str, capability_report: dict) -> bool:
        """校验节点上报的能力是否真实可信"""
```

**心跳服务（HeartbeatService）**

```python
class HeartbeatService:
    HEARTBEAT_INTERVAL = 10  # 秒
    TIMEOUT_THRESHOLD = 30   # 3次心跳超时判定离线

    def process_heartbeat(self, node_id: str, payload: HeartbeatPayload):
        """
        心跳处理流程：
        1. 更新 last_heartbeat 时间戳
        2. 更新实时资源状态（CPU/内存/GPU/网络）
        3. 更新节点位置信息（IP地域）
        4. 判断闲时状态
        5. 如果有待处理任务，随心跳响应下发
        6. 通过 WebSocket 推送实时事件
        """

    def check_offline_nodes(self):
        """定时任务：标记超时未心跳的节点为 offline，迁移其上的任务"""
```

**节点发现服务（NodeDiscoveryService）**

Phase 2 采用**简化版中心化发现**方案（非纯 DHT），原因：
- 初期节点规模 < 10K，中心化足够
- 降低开发复杂度和调试难度
- 后续可平滑升级为混合拓扑

```python
class NodeDiscoveryService:
    def discover_nodes(self, criteria: DiscoveryCriteria) -> list[P2PNode]:
        """
        节点发现流程：
        1. 根据 criteria 过滤候选节点：
           - node_type 匹配
           - capabilities 包含所需技能
           - resources 满足最低资源要求
           - location 符合地域约束
           - status == online
           - reputation_score >= 最低门槛
        2. 按 latency 升序排列
        3. 返回 Top-N 候选节点列表
        """

    def get_network_topology(self) -> NetworkTopology:
        """返回当前网络拓扑概览（用于监控面板）"""
```

#### 2.1.4 闲时检测机制

```python
class IdleDetectionService:
    IDLE_THRESHOLDS = {
        "cpu_usage": 0.30,      # CPU < 30%
        "memory_usage": 0.40,   # 内存 < 40%
        "disk_io": 0.20,        # 磁盘 IO < 20%
        "network_bandwidth": 0.30,  # 网络 < 30%
    }

    def evaluate_idle_state(self, metrics: NodeMetrics) -> IdleState:
        """
        判定节点是否处于空闲状态
        
        规则（来自豆包对话 5.5 节）：
        - 全部指标低于阈值 → IDLE（可接收任务）
        - 任一指标超过阈值但 < 80% → PARTIAL_BUSY（仅接收轻量任务）
        - 任一指标超过 80% → BUSY（不接收新任务）
        
        关键要求：一旦用户本地占用飙升，
        100ms内立刻迁移任务、释放算力
        """

    def handle_resource_contention(self, node_id: str):
        """资源争用时的紧急处理：立即迁移任务"""
```

#### 2.1.5 数据模型

```python
from django.db import models
from django.contrib.postgres.fields import JSONField


class P2PNode(models.Model):
    node_id = models.CharField(max_length=64, unique=True, primary_key=True)
    node_type = models.CharField(
        max_length=32,
        choices=[
            ("browser", "浏览器端TF推理节点"),
            ("desktop_windows", "Windows桌面客户端"),
            ("desktop_mac", "Mac桌面客户端"),
            ("mobile", "移动端轻量节点"),
            ("enterprise", "企业私有化节点"),
            ("self_hosted", "平台自营节点"),
        ],
    )
    capabilities = JSONField(default=list)
    resources = JSONField(default=dict)
    location = models.CharField(max_length=128)
    status = models.CharField(
        max_length=16,
        choices=[
            ("online", "在线"),
            ("offline", "离线"),
            ("busy", "忙碌"),
            ("maintenance", "维护中"),
            ("banned", "已封禁"),
        ],
        default="offline",
    )
    last_heartbeat = models.DateTimeField(auto_now=True)
    public_key = models.TextField()
    reputation_score = models.FloatField(default=100.0)
    total_tasks_completed = models.IntegerField(default=0)
    total_compute_hours = models.FloatField(default=0.0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "p2p_node"
        indexes = [
            models.Index(fields=["status", "node_type"]),
            models.Index(fields=["location"]),
            models.Index(fields=["reputation_score"]),
            models.Index(fields=["last_heartbeat"]),
        ]


class NodeHeartbeat(models.Model):
    node_id = models.ForeignKey(P2PNode, on_delete=models.CASCADE, related_name="heartbeats")
    timestamp = models.DateTimeField(auto_now_add=True)
    cpu_usage = models.FloatField()
    memory_usage = models.FloatField()
    gpu_usage = models.FloatField(null=True)
    disk_io_usage = models.FloatField()
    network_bandwidth_usage = models.FloatTensor()
    idle_state = models.CharField(max_length=16)
    active_task_count = models.IntegerField(default=0)

    class Meta:
        db_table = "node_heartbeat"
        ordering = ["-timestamp"]


class NodeReputation(models.Model):
    node_id = models.OneToOneField(P2PNode, on_delete=models.CASCADE, related_name="reputation")
    score = models.FloatField(default=100.0)
    success_rate = models.FloatField(default=1.0)
    avg_response_time_ms = models.FloatField(default=0)
    malicious_flags = models.IntegerField(default=0)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "node_reputation"
```

#### 2.1.6 WebSocket 实时事件通道

```python
# consumers/p2p_events.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer

class P2PEventConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.node_id = self.scope["url_route"]["kwargs"]["node_id"]
        await self.channel_layer.group_add(f"p2p_node_{self.node_id}", self.channel_name)
        await self.accept()

    async def receive(self, text_data):
        data = json.loads(text_data)
        event_type = data.get("type")

        if event_type == "heartbeat":
            await self.handle_heartbeat(data["payload"])
        elif event_type == "task_result":
            await self.handle_task_result(data["payload"])
        elif event_type == "idle_state_change":
            await self.handle_idle_change(data["payload"])

    async def task_dispatched(self, event):
        """服务端向节点推送新任务"""
        await self.send(json.dumps({
            "type": "task_dispatched",
            "task_id": event["task_id"],
            "payload": event["payload"],
            "signature": event["ass_signature"],
            "timeout": event["timeout"],
        }))

    async def force_migrate(self, event):
        """紧急任务迁移通知"""
        await self.send(json.dumps({
            "type": "force_migrate",
            "task_ids": event["task_ids"],
            "reason": event["reason"],
        }))
```

---

### 2.2 Task 8：任务分片与分布式执行

#### 2.2.1 架构总览

```
┌────────────────────────────────────────────────────────────────┐
│                    任务分片与分布式执行引擎                       │
├──────────────┬──────────────┬──────────────┬───────────────────┤
│ 分片策略引擎  │  任务调度器   │  结果聚合器  │   容错控制器       │
│ ShardingEngine│ Dispatcher  │ Aggregator   │ FaultController   │
└──────┬───────┴──────┬───────┴──────┬───────┴────────┬─────────┘
       │              │              │                │
       ▼              ▼              ▼                ▼
┌──────────────┐ ┌──────────┐ ┌──────────────┐ ┌────────────────┐
│ 分片元数据存储 │ 任务队列   │ 结果暂存区     │ 重试/重分配队列  │
│ PostgreSQL   │ Redis     │ Redis/缓存    │ Dead Letter Queue│
└──────────────┘ └──────────┘ └──────────────┘ └────────────────┘
```

#### 2.2.2 分片策略

**分片粒度原则**：所有分片大小 ≤ 1MB（来自豆包对话 5.6.1 节）

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum


class TaskType(Enum):
    TEXT = "text"
    IMAGE = "IMAGE"
    CODE = "code"
    FILE = "file"
    MIXED = "mixed"


@dataclass
class Shard:
    shard_id: str
    task_id: str
    sequence: int
    total_shards: int
    payload: bytes
    payload_hash: str          # SHA-256，用于完整性校验
    dependencies: list[str]    # 依赖的前序 shard_id 列表
    required_capabilities: list[str]
    estimated_resources: dict  # {cpu_cores, memory_mb, gpu_required}
    security_level: str        # normal / high / critical
    data_sensitivity: str      # public / internal / confidential


class ShardingStrategy(ABC):
    @abstractmethod
    def shard(self, task: Task) -> list[Shard]:
        """将任务拆分为多个分片"""


class TextShardingStrategy(ShardingStrategy):
    """文本类任务：按段落/句子分片"""

    MAX_SHARD_SIZE = 1024 * 1024  # 1MB

    def shard(self, task: Task) -> list[Shard]:
        """
        分片规则：
        1. 按段落边界切分（\n\n 或 \n）
        2. 单段超过阈值则按句子切分（。！？.!?)
        3. 每个分片附带上下文窗口（前后各 200 字符）
        4. 记录分片间的顺序依赖关系
        5. 对每个分片计算 SHA-256 哈希
        """


class ImageShardingStrategy(ShardingStrategy):
    """图片类任务：按分辨率分块"""

    def shard(self, task: Task) -> list[Shard]:
        """
        分片规则：
        1. 大图按网格切分为 1024x1024 的 tile
        2. 每个 tile 可独立处理
        3. 无依赖关系，支持完全并行
        4. 记录原始坐标用于重组
        """


class CodeShardingStrategy(ShardingStrategy):
    """代码类任务：按函数/模块分片"""

    def shard(self, task: Task) -> list[Shard]:
        """
        分片规则：
        1. 基于 AST 解析，按函数/类/模块边界切分
        2. 有调用关系的分片建立依赖边
        3. 构建 DAG（有向无环图）确定执行顺序
        4. 无依赖的分片可并行执行
        """


class FileShardingStrategy(ShardingStrategy):
    """大文件任务：固定大小分片 + 哈希校验"""

    CHUNK_SIZE = 512 * 1024  # 512KB per chunk

    def shard(self, task: Task) -> list[Shard]:
        """
        分片规则：
        1. 固定 512KB 分块
        2. 每块 SHA-256 校验
        3. 支持断点续传
        4. 全部无依赖，完全并行
        """


class ShardingEngine:
    STRATEGY_MAP = {
        TaskType.TEXT: TextShardingStrategy,
        TaskType.IMAGE: ImageShardingStrategy,
        TaskType.CODE: CodeShardingStrategy,
        TaskType.FILE: FileShardingStrategy,
    }

    def shard_task(self, task: Task) -> list[Shard]:
        strategy_class = self.STRATEGY_MAP.get(task.task_type)
        if not strategy_class:
            raise UnsupportedTaskTypeError(task.task_type)
        return strategy_class().shard(task)
```

#### 2.2.3 调度算法

采用 **SJF（最短作业优先）变种 + 多因子加权**：

```python
import heapq
from dataclasses import dataclass, field


@dataclass(order=True)
class SchedulableShard:
    priority_score: float  # 越小越优先
    shard: Shard = field(compare=False)
    candidate_nodes: list[str] = field(compare=False, default_factory=list)


class TaskDispatcher:
    REDUNDANCY_FACTOR = 3  # 同一分片分发到 3 个节点（来自豆包对话 5.7 节）

    def dispatch(self, shards: list[Shard], available_nodes: list[P2PNode]) -> DispatchPlan:
        """
        调度流程：
        1. 为每个分片筛选有能力执行的候选节点
        2. 计算每个 (分片, 节点) 对的匹配得分
        3. 使用 SJF 变种进行全局最优分配
        4. 高安全级别任务增加冗余度
        5. 生成 DispatchPlan
        """

    def calculate_match_score(self, shard: Shard, node: P2PNode) -> float:
        """
        多因子匹配得分（来自豆包对话 5.8.1 节）：
        
        score = cost_weight * normalized_cost
              + latency_weight * normalized_latency
              + reliability_weight * (1 - reliability)
              + security_weight * security_risk
              + geo_weight * geo_violation
        
        权重：cost=0.4, latency=0.25, reliability=0.2, security=0.1, geo=0.05
        """

    def handle_node_failure(self, node_id: str, running_shards: list[Shard]):
        """
        故障转移流程：
        1. 标记该节点上所有运行中分片为 FAILED
        2. 从候选备选中重新选择节点
        3. 重新分发分片
        4. 更新故障节点的信誉评分
        5. 若连续失败 > 3 次，标记任务为异常，触发人工审核
        """
```

#### 2.2.4 结果聚合

```python
class ResultAggregator:
    def aggregate(self, task_id: str, shard_results: list[ShardResult]) -> TaskResult:
        """
        MapReduce 式聚合流程：
        
        1. 收集所有分片结果
        2. 对冗余执行的结果做一致性校验（来自豆包对话 5.7 节）：
           - 3 个节点结果一致 → 直接采信
           - 2/3 一致 → 采信多数，标记异常节点
           - 3 个都不一致 → 标记异常，人工审核
        3. 按分片序列号排序合并
        4. 处理有依赖关系的分片（DAG 拓扑排序）
        5. 生成最终 TaskResult
        6. 触发 ASS 输出层巡检
        """

    def resolve_conflict(self, results: list[ShardResult]) -> ShardResult:
        """
        冲突解决策略：
        1. 多数投票（2/3 以上一致即采信）
        2. 最高置信度优先（若平票）
        3. 信誉加权投票（高信誉节点结果权重更高）
        """
```

#### 2.2.5 任务状态机

```
                    ┌─────────────┐
                    │   CREATED   │
                    └──────┬──────┘
                           │ 编排层拆解完成
                           ▼
                    ┌─────────────┐
                    │   SHARDING  │
                    └──────┬──────┘
                           │ 分片完成
                           ▼
              ┌────────────────────────┐
         ┌───▶│   DISPATCHING         │◀──┐
         │    └───────────┬────────────┘   │
         │                │                 │
         │                ▼                 │
         │    ┌──────────────────────┐      │
         │    │   EXECUTING          │      │
         │    │  (各分片并行执行)      │      │
         │    └──────────┬───────────┘      │
         │               │                    │
         │      ┌────────┴────────┐          │
         │      ▼                 ▼          │
         │  ┌─────────┐    ┌──────────┐     │
         │  │AGGREGATING│   │  FAILED  │─────┘
         │  └────┬─────┘    └────┬─────┘   重试
         │       │               │
         │       ▼               ▼
         │  ┌─────────┐    ┌──────────┐
         │  │VERIFYING │   │ ABORTED  │
         │  └────┬─────┘    └──────────┘
         │       │
         │       ▼
         │  ┌──────────┐
         └──│ COMPLETED │
            └──────────┘
```

---

### 2.3 Task 9：成本路由引擎

#### 2.3.1 架构定位

成本路由引擎位于**第4层（成本路由与调度层）**，是连接上层编排层和下层算力网络层的核心决策中枢：

```
智能编排层（第6层）
      │ 输出：原子任务列表 + 任务属性
      ▼
┌─────────────────────────────┐
│     成本路由引擎（第4层）      │
│  ┌───────────────────────┐  │
│  │ 路由因子采集           │  │
│  │ - 执行成本             │  │
│  │ - 网络延迟 (RTT)       │  │
│  │ - 能耗因素             │  │
│  │ - 数据隐私等级         │  │
│  ├───────────────────────┤  │
│  │ 加权打分 + 约束过滤    │  │
│  ├───────────────────────┤  │
│  │ 路由决策矩阵          │  │
│  └───────────────────────┘  │
└──────────────┬──────────────┘
               │ 输出：(分片, 目标节点) 映射表
               ▼
EIHM-P2P-CS 算力网络层（第3层）
```

#### 2.3.2 路由因子定义

```python
@dataclass
class RoutingFactors:
    execution_cost: float       # GPU/CPU 时长 × 单价（权重 40%）
    network_latency_ms: float   # RTT 往返延迟（权重 25%）
    energy_factor: float        # 绿色计算偏好评分（隐含在 cost 中）
    privacy_level: int          # 1=公共 2=内部 3=机密（权重 10%）
    data_residency: str         # 数据属地要求（权重 5%）
    node_reliability: float     # 节点历史可靠性（权重 20%）


class CostRoutingEngine:
    WEIGHTS = {
        "execution_cost": 0.40,
        "network_latency": 0.25,
        "node_reliability": 0.20,
        "privacy_security": 0.10,
        "data_residency": 0.05,
    }

    def route(self, task: Task, candidates: list[P2PNode]) -> RoutingDecision:
        """
        目标函数（来自豆包对话 5.8.2 节）：
        
        Minimize (
            cost * 0.4
            + latency * 0.25
            + (1 - reliability) * 0.2
            + security_risk * 0.1
            + geo_violation * 0.05
        )
        
        约束条件（来自豆包对话 5.8.3 节）：
        1. node.reputation_score >= task.min_reputation
        2. node.available_resources >= task.required_resources
        3. node.location in task.allowed_regions
        4. estimated_duration <= task.max_wait_time
        """

    def apply_routing_matrix(self, task: Task) -> RoutingDecision:
        """应用路由决策矩阵快速路由"""
```

#### 2.3.3 路由决策矩阵

| 场景特征 | 优选路径 | 备选路径 | 触发条件 |
|----------|---------|---------|---------|
| 小文本 (<1KB) | 本地浏览器 TF 推理 | 云端 API | task_size < 1024 AND type=text |
| 中文本 (1KB-100KB) | P2P 桌面节点 | 本地+云端混合 | 1024 <= task_size <= 102400 |
| 大文本 (>100KB) | 企业私有节点 | 分布式 P2P 并行 | task_size > 102400 |
| 高隐私需求 (level=3) | 纯本地执行 | 加密 P2P | privacy_level == "confidential" |
| 高速度需求 | GPU 云节点 | 多节点并行 | user_preference == "speed" |
| 代码执行 | 桌面客户端沙箱 | 自营容器 | task_type == "code" |
| AI 推理 | 浏览器 TF 节点 | 桌面 GPU 节点 | task_type in ("inference", "detection") |
| 批量处理 | 分布式 P2P 并行 | 企业集群 | shard_count > 10 |

```python
ROUTING_MATRIX = {
    "small_text_local_first": {
        "conditions": {"max_size_bytes": 1024, "types": ["text"]},
        "primary": ["browser_tf", "local_desktop"],
        "fallback": ["cloud_api"],
    },
    "medium_text_p2p_preferred": {
        "conditions": {"min_size_bytes": 1024, "max_size_bytes": 102400},
        "primary": ["desktop_p2p"],
        "fallback": ["hybrid_local_cloud"],
    },
    "large_text_enterprise": {
        "conditions": {"min_size_bytes": 102400},
        "primary": ["enterprise_private"],
        "fallback": ["distributed_p2p"],
    },
    "high_privacy_local_only": {
        "conditions": {"privacy_level": "confidential"},
        "primary": ["local_execution"],
        "fallback": ["encrypted_p2p"],
    },
    "high_speed_gpu_first": {
        "conditions": {"user_preference": "speed"},
        "primary": ["gpu_cloud"],
        "fallback": ["multi_node_parallel"],
    },
}
```

#### 2.3.4 地域路由与数据不出域

```python
class GeoRouter:
    REGION_NODE_MAP: dict[str, list[str]]  # 地域 -> 节点ID列表

    def route_by_region(self, task: Task, preferred_region: str = None) -> list[P2PNode]:
        """
        地域路由逻辑：
        1. 若任务指定了 data_residency，强制限定在该地域
        2. 否则选择距用户最近的可用节点
        3. 同地域内按延迟排序
        4. 支持多地域冗余（高可靠场景）
        """
```

---

### 2.4 Task 10：桌面客户端（Electron）

#### 2.4.1 技术栈

| 层级 | 技术选型 | 说明 |
|------|---------|------|
| 框架 | Electron 28+ | 跨平台桌面应用框架 |
| 前端 | React 18 + TypeScript + Vite | UI 渲染层 |
| 状态管理 | Zustand | 轻量状态管理 |
| 样式 | Tailwind CSS | 快速样式开发 |
| 本地运行时 | Python 子进程（venv 管理） | 技能执行环境 |
| 进程通信 | IPC（主进程↔渲染进程）+ stdio（↔Python） | 进程间通信 |
| 打包 | electron-builder | 多平台打包 |
| 自动更新 | electron-updater | OTA 更新 |

#### 2.4.2 目录结构

```
desktop-client/
├── electron/
│   ├── main.ts                 # 主进程入口
│   ├── preload.ts              # preload 脚本
│   ├── ipc/                    # IPC 处理器
│   │   ├── node-handler.ts     # P2P 节点相关 IPC
│   │   ├── task-handler.ts     # 任务执行相关 IPC
│   │   └── system-handler.ts   # 系统相关 IPC
│   ├── services/
│   │   ├── p2p-node.service.ts # P2P 节点服务
│   │   ├── heartbeat.service.ts # 心跳服务
│   │   ├── task-executor.service.ts # 任务执行器
│   │   ├── idle-detector.service.ts # 闲时检测
│   │   └── crypto.service.ts   # 加密通信服务
│   └── tray.ts                 # 系统托盘
├── src/                        # React 前端
│   ├── App.tsx
│   ├── pages/
│   │   ├── Dashboard.tsx       # 主仪表盘
│   │   ├── Settings.tsx        # 设置页
│   │   └── Tasks.tsx           # 任务列表
│   ├── components/
│   │   ├── TrayMenu.tsx        # 托盘菜单组件
│   │   ├── StatusIndicator.tsx # 节点状态指示器
│   │   └── FileDropZone.tsx    # 文件拖拽区域
│   └── stores/                 # Zustand stores
│       ├── node.store.ts
│       └── task.store.ts
├── python-runtime/             # Python 运行时
│   ├── venv/                   # 自动创建的虚拟环境
│   ├── executor.py             # 任务执行入口
│   ├── sandbox.py              # 沙箱隔离
│   └── requirements.txt        # Python 依赖
├── package.json
├── electron-builder.yml        # 打包配置
└── tsconfig.json
```

#### 2.4.3 核心功能模块

**P2P 节点服务（核心）**

```typescript
// electron/services/p2p-node.service.ts
import { net } from 'electron';
import CryptoService from './crypto.service';
import HeartbeatService from './heartbeat.service';
import IdleDetectorService from './idle-detector.service';

export class P2PNodeService {
  private nodeId: string;
  private nodeKeyPair: CryptoKeyPair;
  private serverUrl: string;

  async register(): Promise<RegisterResponse> {
    /**
     * 注册流程：
     * 1. 生成 RSA-2048 密钥对
     * 2. 采集硬件信息（CPU核数、内存、GPU型号、磁盘空间）
     * 3. 采集已安装的 Python 环境/技能列表
     * 4. 获取本机公网 IP 和地域
     * 5. POST /api/p2p/nodes/register
     * 6. 保存返回的 node_id 和平台证书
     * 7. 启动心跳循环
     */
  }

  async startHeartbeat(): Promise<void> {
    // 每 10 秒发送一次心跳
    // 携带实时资源使用率
    // 通过 WebSocket 维持长连接
  }

  async shutdown(): Promise<void> {
    // 发送 offline 通知
    // 清理本地临时文件
    // 停止心跳
  }
}
```

**任务执行器**

```typescript
// electron/services/task-executor.service.ts
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

export class TaskExecutorService {
  private activeTasks: Map<string, ChildProcess> = new Map();
  private pythonVenvPath: string;

  async executeTask(shard: Shard): Promise<TaskResult> {
    /**
     * 任务执行流程：
     * 1. 验证 ASS 签名（拒绝未签名任务）
     * 2. 在 Python venv 中启动隔离子进程
     * 3. 通过 stdin 传入任务 payload
     * 4. 设置资源限制（cgroups / job object）
     * 5. 设置超时计时器
     * 6. 收集 stdout/stderr 作为结果
     * 7. 对结果签名后返回
     */
  }

  async handleForceMigrate(taskIds: string[]): Promise<void> {
    /**
     * 紧急迁移（来自闲时检测触发）：
     * 1. 终止指定任务的子进程
     * 2. 保存当前执行进度（断点）
     * 3. 通知服务端任务需要重新分配
     * 4. 要求 < 100ms 内释放资源
     */
  }

  private createSandboxEnv(shard: Shard): object {
    // 构建沙箱环境变量
    // 限制文件系统访问路径
    // 限制网络访问白名单
  }
}
```

**闲时检测器**

```typescript
// electron/services/idle-detector.service.ts
import { cpus, freemem, totalmem } from 'os';
import systemInformation from 'systeminformation';

export class IdleDetectorService {
  private readonly THRESHOLDS = {
    cpuUsage: 0.30,
    memoryUsage: 0.40,
    diskIoUsage: 0.20,
    networkBandwidth: 0.30,
  };

  private monitoringInterval: NodeJS.Timer;

  startMonitoring(callback: (state: IdleState) => void): void {
    /**
     * 每 1 秒采集一次系统指标：
     * - CPU 使用率（所有核心平均值）
     * - 内存使用率
     * - 磁盘 I/O 使用率
     * - 网络带宽使用率
     * 
     * 判定空闲状态后回调通知：
     * - IDLE → 可以接收新任务
     * - PARTIAL_BUSY → 仅接收轻量任务
     * - BUSY → 不接收新任务，考虑迁移现有任务
     */
  }

  private async collectMetrics(): Promise<SystemMetrics> {
    // 使用 systemInformation 库跨平台采集
  }
}
```

**系统托盘**

```typescript
// electron/tray.ts
import { Tray, Menu, nativeImage } from 'electron';

export function createTray(mainWindow: BrowserWindow): Tray {
  const tray = new Tray(nativeImage.createFromPath('assets/icon.png'));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '节点状态：在线',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: '今日贡献算力：2.3 核·小时',
      enabled: false,
    },
    {
      label: '当前积分：1,250',
      enabled: false,
    },
    { type: 'separator' },
    {
      label: '打开仪表盘',
      click: () => mainWindow.show(),
    },
    {
      label: '设置',
      click: () => openSettingsWindow(),
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => gracefulShutdown(),
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip('一鉴到底 · P2P 算力节点');

  return tray;
}
```

#### 2.4.4 Python 子进程沙箱

```python
# python-runtime/sandbox.py
import subprocess
import resource
import tempfile
import os
import json
import sys
import hashlib
import signal


class TaskSandbox:
    MAX_MEMORY_MB = 512
    MAX_CPU_SECONDS = 30
    MAX_FILE_SIZE_MB = 10
    ALLOWED_NETWORK_HOSTS = []  # 默认禁止网络访问

    def __init__(self, task_payload: dict, work_dir: str):
        self.payload = task_payload
        self.work_dir = work_dir
        self.result_file = os.path.join(work_dir, "result.json")

    def execute(self) -> dict:
        """
        沙箱执行流程：
        1. 创建临时工作目录
        2. 写入任务输入文件
        3. 设置资源限制（Linux: resource 模块, Windows: Job Object）
        4. 启动子进程执行任务代码
        5. 超时自动终止
        6. 读取结果文件
        7. 清理临时目录
        8. 返回结构化结果
        """

    def _set_resource_limits(self):
        """设置操作系统级别的资源限制"""

    def _validate_output(self, result: dict) -> bool:
        """验证输出结果的完整性和安全性"""
```

#### 2.4.5 文件拖拽与右键菜单集成

```tsx
// src/components/FileDropZone.tsx
import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

interface FileDropZoneProps {
  onFileAccepted: (files: File[]) => void;
}

export const FileDropZone: React.FC<FileDropZoneProps> = ({ onFileAccepted }) => {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    onFileAccepted(acceptedFiles);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/*': ['.txt', '.md', '.json', '.csv'],
      'application/pdf': ['.pdf'],
      'image/*': ['.png', '.jpg', '.jpeg', '.webp'],
    },
  });

  return (
    <div
      {...getRootProps()}
      className={`
        border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
        transition-colors duration-200
        ${isDragActive ? 'border-red-500 bg-red-50' : 'border-gray-300 hover:border-gray-400'}
      `}
    >
      <input {...getInputProps()} />
      {isDragActive ? (
        <p className="text-gray-700">松手即可开始检测</p>
      ) : (
        <div>
          <p className="text-lg font-medium text-gray-700">
            拖拽文件到此处，或点击选择
          </p>
          <p className="text-sm text-gray-500 mt-2">
            支持 PDF、TXT、MD、图片等格式
          </p>
        </div>
      )}
    </div>
  );
};
```

#### 2.4.6 本地缓存管理

```typescript
// electron/services/cache.service.ts
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export class CacheService {
  private cacheDir: string;
  private maxCacheSizeMB: number = 2048; // 最大缓存 2GB

  async cacheModel(modelId: string, modelData: Buffer): Promise<string> {
    /**
     * 模型缓存策略：
     * 1. 按 model_id 的 hash 值组织目录
     * 2. 存储模型文件 + 元数据（版本、下载时间、大小）
     * 3. LRU 淘汰策略
     * 4. 缓存命中时直接从本地加载
     */
  }

  async cacheTaskResult(taskId: string, result: TaskResult): Promise<void> {
    // 任务结果缓存，支持离线查看
  }

  async cleanup(): Promise<{ freedBytes: number }> {
    // 当缓存超过上限时清理最久未使用的条目
  }
}
```

---

## 3. 新增依赖清单

### 3.1 前端新增依赖（Web 端）

| 包名 | 版本 | 用途 | 引入阶段 |
|------|------|------|---------|
| `@tensorflow/tfjs` | ^4.x | 浏览器端 TF 推理（Phase 3 完整引入，Phase 2 先做基础注册） | Phase 2-3 |
| `@xenova/transformers` | ^2.x | 替代方案：浏览器端 Transformers 推理 | Phase 3 |
| `simple-peer` | ^9.x | WebRTC P2P 数据通道（简化封装） | Phase 2 |
| `wrtc` | ^0.5.x | WebRTC Native 绑定（备用方案） | Phase 2 |
| `react-dropzone` | ^14.x | 文件拖拽上传 | Phase 2 |
| `zustand` | ^4.x | 客户端状态管理 | Phase 2 |

### 3.2 后端新增依赖（Django）

| 包名 | 版本 | 用途 | 引入阶段 |
|------|------|------|---------|
| `channels` | ^4.x | Django WebSocket 支持 | Phase 2 |
| `channels-redis` | ^4.x | Channel Layer Redis 后端 | Phase 2 |
| `cryptography` | ^42.x | RSA/AES 加密通信 | Phase 2 |
| `pydantic` | ^2.x | 请求/响应模型校验 | Phase 2 |
| `celery` | ^5.x | 分布式任务队列（可选，视规模引入） | Phase 2 |
| `redis` | ^5.x | Redis 客户端（任务队列/缓存） | Phase 2 |
| `psycopg2-binary` | ^2.x | PostgreSQL 驱动 | Phase 2 |
| `django-rest-framework` | ^3.x | REST API 框架 | Phase 2 |

### 3.3 桌面客户端新增依赖

| 包名 | 版本 | 用途 | 引入阶段 |
|------|------|------|---------|
| `electron` | ^28.x | 桌面应用框架 | Phase 2 |
| `electron-builder` | ^24.x | 应用打包构建 | Phase 2 |
| `@electron/remote` | ^2.x | 主进程远程调用 | Phase 2 |
| `electron-updater` | ^6.x | 自动更新 | Phase 2 |
| `systeminformation` | ^5.x | 跨平台系统信息采集 | Phase 2 |
| `react` | ^18.x | UI 框架 | Phase 2 |
| `typescript` | ^5.x | 类型安全 | Phase 2 |
| `tailwindcss` | ^3.x | 样式框架 | Phase 2 |
| `vite` | ^5.x | 构建工具 | Phase 2 |

### 3.4 Python 子进程依赖

| 包名 | 版本 | 用途 |
|------|------|------|
| `psutil` | ^5.x | 系统资源监控 |
| `cryptography` | ^42.x | 签名校验 |
| `requests` | ^2.x | HTTP 通信 |
| `websocket-client` | ^1.x | WebSocket 客户端 |

---

## 4. API 设计草案

### 4.1 RESTful API

```
基础路径：/api/p2p/v1
认证方式：Bearer Token（JWT）+ 节点签名
```

#### 节点管理 API

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/nodes/register` | 注册节点 | NodeRegisterRequest | NodeRegisterResponse |
| GET | `/nodes/{node_id}` | 获取节点详情 | - | P2PNodeDetail |
| PUT | `/nodes/{node_id}/heartbeat` | 发送心跳 | HeartbeatPayload | HeartbeatAck |
| DELETE | `/nodes/{node_id}/offline` | 下线通知 | OfflineReason | Ack |
| GET | `/nodes` | 节点列表查询 | NodeQueryParams | PaginatedNodeList |
| GET | `/nodes/{node_id}/reputation` | 查询信誉评分 | - | ReputationInfo |
| GET | `/network/topology` | 获取网络拓扑 | - | NetworkTopology |

**POST /api/p2p/v1/nodes/register 请求示例**

```json
{
  "node_type": "desktop_windows",
  "capabilities": [
    "ai_detection",
    "code_execution",
    "text_processing",
    "ocr"
  ],
  "resources": {
    "cpu_cores": 8,
    "memory_gb": 16,
    "gpu_available": true,
    "gpu_model": "NVIDIA RTX 3060",
    "gpu_vram_gb": 12,
    "disk_free_gb": 500
  },
  "location": "CN-East",
  "client_version": "1.0.0",
  "public_key_fingerprint": "sha256:abc123..."
}
```

**PUT /api/p2p/v1/nodes/{node_id}/heartbeat 请求示例**

```json
{
  "timestamp": "2026-06-02T10:00:00Z",
  "metrics": {
    "cpu_usage": 0.15,
    "memory_usage": 0.35,
    "gpu_usage": 0.0,
    "disk_io_usage": 0.05,
    "network_bandwidth_usage": 0.10
  },
  "idle_state": "idle",
  "active_tasks": ["task_001", "task_002"],
  "signature": "rsa-sha256:base64payload..."
}
```

#### 任务管理 API

| 方法 | 路径 | 描述 | 请求体 | 响应 |
|------|------|------|--------|------|
| POST | `/tasks/dispatch` | 分发任务分片 | DispatchRequest | DispatchResponse |
| GET | `/tasks/{task_id}` | 查询任务详情 | - | TaskDetail |
| GET | `/tasks/{task_id}/status` | 查询任务状态 | - | TaskStatus |
| POST | `/tasks/{task_id}/shards/{shard_id}/result` | 提交分片结果 | ShardResultSubmission | ResultAck |
| GET | `/tasks` | 任务列表查询 | TaskQueryParams | PaginatedTaskList |
| POST | `/tasks/{task_id}/cancel` | 取消任务 | CancelReason | Ack |

**POST /api/p2p/v1/tasks/dispatch 请求示例**

```json
{
  "task_type": "text",
  "priority": "normal",
  "security_level": "standard",
  "privacy_level": "internal",
  "preferred_region": "CN-East",
  "max_wait_seconds": 300,
  "shards": [
    {
      "shard_id": "shard_001",
      "sequence": 0,
      "total_shards": 5,
      "payload_hash": "sha256:def456...",
      "required_capabilities": ["ai_detection"],
      "estimated_resources": {
        "cpu_cores": 1,
        "memory_mb": 256,
        "gpu_required": false
      }
    }
  ],
  "ass_signature": "rsa-sha256:base64payload..."
}
```

**POST /api/p2p/v1/tasks/{task_id}/shards/{shard_id}/result 请求示例**

```json
{
  "shard_id": "shard_001",
  "exit_code": 0,
  "stdout": "检测结果：AI含量32%",
  "stderr": "",
  "execution_time_ms": 1250,
  "resource_usage": {
    "cpu_ms": 800,
    "memory_peak_mb": 128
  },
  "result_signature": "rsa-sha256:base64payload..."
}
```

### 4.2 WebSocket API

```
WS 路径：/ws/p2p/v1/{node_id}/events
协议：JSON over WebSocket
```

**服务端 → 节点推送事件**

| 事件类型 | 方向 | 描述 | Payload 结构 |
|----------|------|------|-------------|
| `task_dispatched` | S→C | 新任务下发 | `{task_id, payload, signature, timeout}` |
| `force_migrate` | S→C | 紧急迁移通知 | `{task_ids[], reason}` |
| `config_update` | S→C | 配置更新 | `{config_key, config_value}` |
| `maintenance_notice` | S→C | 维护通知 | `{scheduled_at, duration_min}` |

**节点 → 服务端事件**

| 事件类型 | 方向 | 描述 | Payload 结构 |
|----------|------|------|-------------|
| `heartbeat` | C→S | 心跳上报 | `{metrics, idle_state, active_tasks[]}` |
| `task_result` | C→S | 分片结果提交 | `{shard_id, result, signature}` |
| `idle_state_change` | C→S | 闲时状态变更 | `{old_state, new_state, reason}` |
| `error` | C→S | 错误报告 | `{code, message, details}` |

### 4.3 API 错误码

| 错误码 | HTTP 状态码 | 描述 |
|--------|------------|------|
| `P2P_0001` | 401 | 节点认证失败或令牌过期 |
| `P2P_0002` | 403 | 节点已被封禁或信誉不足 |
| `P2P_0003` | 404 | 节点不存在或任务不存在 |
| `P2P_0004` | 409 | 节点重复注册 |
| `P2P_0005` | 422 | 请求参数校验失败 |
| `P2P_0006` | 429 | 节点请求频率超限 |
| `P2P_0007` | 503 | 无可用节点满足调度要求 |
| `P2P_0008` | 504 | 任务执行超时 |
| `P2P_0009` | 500 | 内部服务错误 |

---

## 5. 风险与缓解

### 5.1 NAT 穿透问题

**风险描述**：大部分端侧节点位于 NAT/防火墙之后，无法直接建立 P2P 连接。

**缓解方案**（来自豆包对话 5.9.1 节）：

```
┌──────────┐     STUN      ┌──────────┐     STUN      ┌──────────┐
│  节点 A   │ ──────────▶ │ STUN服务器│ ◀────────── │  节点 B   │
│ (NAT后)  │ ◀────────── │ (公网)    │ ──────────▶ │ (NAT后)  │
└─────┬─────┘              └─────┬────┘              └─────┬─────┘
      │                         │                         │
      │    尝试直连（ICE）        │                         │
      │ ◄──────────────────────► │                         │
      │                                                         │
      │          直连失败时                                   │
      │ ──────────────────────────────────────────────────▶    │
      │                    TURN 中继                            │
      └───────────────────────────────────────────────────────┘
```

**分层穿透策略**：

| 层级 | 技术 | 适用场景 | 成本 |
|------|------|---------|------|
| 第一优先 | STUN + ICE | Cone NAT（Full/Restricted/Port-Restricted） | 免费 |
| 第二优先 | 自建 TURN 中继 | Symmetric NAT / 防火墙严格环境 | 带宽成本 |
| 第三备选 | 中继服务器转发 | TURN 也不可用时 | 服务端成本 |

**量化目标**：
- NAT 穿透成功率 ≥ 99%
- 中继流量占比 ≤ 10%（控制成本）
- 平均连接建立时间 ≤ 2s

**技术选型**：Phase 2 使用 `simple-peer`（基于 `wrtc`），内置 ICE/STUN/TURN 支持。

### 5.2 节点信任问题

**风险描述**：恶意节点可能返回篡改结果、窃取数据、拒绝服务。

**缓解方案**：

```
┌─────────────────────────────────────────────────────────┐
│                   节点信任体系                             │
├──────────────┬──────────────┬───────────────────────────┤
│ 信誉评分系统  │ 任务沙箱隔离  │ 多数投票验证               │
│              │              │                           │
│ • 基准分 100  │ • 资源限制    │ • 同一分片 3 节点并行      │
│ • 成功 +1    │ • 文件系统隔离│ • 2/3 一致采信            │
│ • 失败 -10   │ • 网络白名单  │ • 异常节点扣分             │
│ • 恶意 -50   │ • 时间限制    │ • 3次异常永久封禁          │
│              │              │                           │
│ < 60 分拒接  │ 内存≤512MB   │ 高安全任务仅自营节点        │
│ < 30 分封禁  │ CPU≤1核      │ 机密任务仅本地执行          │
└──────────────┴──────────────┴───────────────────────────┘
```

**恶意节点处置阶梯**（来自豆包对话 5.7 节）：

| 次数 | 行为 | 处置措施 |
|------|------|---------|
| 第 1 次 | 返回异常结果 | 扣除积分，信誉 -10 |
| 第 2 次 | 再次异常 | 临时封禁 7 天，信誉 -30 |
| 第 3 次 | 持续异常 | 永久拉黑，清除所有积分 |

### 5.3 数据安全问题

**风险描述**：P2P 传输过程中数据可能被窃取或篡改。

**缓解方案**：

| 安全层级 | 措施 | 技术实现 |
|---------|------|---------|
| 传输加密 | 端到端 AES-256-GCM 加密 | `cryptography` 库 |
| 身份认证 | RSA-2048 签名验证 | 节点密钥对 + 平台 CA |
| 完整性校验 | SHA-256 哈希 | 每个分片附带 payload_hash |
| 任务签名 | ASS 数字签名 | 所有任务经 ASS 签名后才分发 |
| 结果签名 | 节点对结果签名 | 防止结果被中间人篡改 |
| 零知识（可选） | 同态加密 / MPC | Phase 3 引入，Phase 2 用加密传输兜底 |

**加密通信流程**：

```
1. 注册阶段：节点生成 RSA 密钥对，公钥上传平台
2. 任务分发：平台用节点公钥加密任务 payload + ASS 签名
3. 节点执行：用私钥解密，在沙箱中执行
4. 结果回传：节点对结果签名，平台用节点公钥验签
5. 传输层：WebSocket over TLS 1.3 + 应用层 AES-GCM
```

### 5.4 法律合规风险

**风险描述**：P2P 网络涉及跨境数据传输、用户数据处理等合规问题。

**缓解方案**：

| 合规领域 | 法规要求 | 技术措施 |
|---------|---------|---------|
| GDPR / 个人信息保护法 | 用户数据知情同意 | 注册时明确告知算力共享范围 |
| 数据本地化 | 敏感数据不出境 | 地域路由强制约束 + 数据标签 |
| 网络安全法 | 日志留存 180 天 | 全链路审计日志 + 不可篡改存储 |
| 等保 2.0 | 三级认证要求 | ASS 四层巡检 + 访问控制 + 审计追踪 |
| 用户授权 | 明确授权机制 | 用户可随时关闭算力贡献 + 一键下线 |

### 5.5 节点规模风险

**风险描述**：初期节点数量少导致算力不足，影响用户体验。

**缓解方案**：

| 阶段 | 节点数量目标 | 兜底策略 |
|------|------------|---------|
| Phase 2（第31-90天） | 1000 测试节点 | 自营节点兜底 + 云 API 降级 |
| 公测期（第91-120天） | 10,000 节点 | 自营节点 + 企业合作节点 |
| 正式运营（121天+） | 100,000+ 节点 | 三级网络自然平衡 |

**激励驱动增长**（来自豆包对话 5.10 节）：
- 邀请好友奖励：获得好友收益 20%，永久有效
- 节点排行榜：Top 100 额外奖励 + 专属标识
- 积分兑换：会员抵扣、现金提现、GPU 算力券

### 5.6 性能风险

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 心跳风暴（万级节点） | DB/Redis 压力大 | 心跳批量写入 + Redis 管道聚合 |
| 任务调度延迟 | 用户感知慢 | 预调度 + 本地缓存热点分片 |
| 结果聚合瓶颈 | 大任务合并慢 | 流式聚合 + 增量合并 |
| WebSocket 连接数 | 服务器 fd 耗尽 | 多实例水平扩展 + 连接池 |

---

## 附录 A：与七层架构的映射关系

```
Phase 2 模块              所在层级          对接的上游              对接的下游
─────────────────────────────────────────────────────────────────────────
P2P 节点管理 (Task 7)     第3层 算力网络层   第4层 成本路由引擎       第2层 执行引擎
任务分片执行 (Task 8)     第3层+第4层        第6层 智能编排层         第2层 执行引擎
成本路由引擎 (Task 9)     第4层 路由调度层    第6层 智能编排层         第3层 算力网络层
桌面客户端 (Task 10)      第3层+第7层        第3层 节点管理服务       第2层 本地执行引擎
```

## 附录 B：Phase 2 各周详细任务拆解索引

详见父规范 [spec.md](./spec.md) 中「10.3 第二阶段」部分（第5周到第10周），以及豆包对话文档第五部分对应章节。

## 附录 C：术语表

| 术语 | 全称 | 定义 |
|------|------|------|
| EIHM-P2P-CS | End-side Idle Heterogeneous Micro-computing P2P Collaborative Scheduling | 端侧闲时异构微算力P2P协同调度 |
| ASS | Agent Security System | Agent安全系统（全链路四层巡检内核） |
| DHT | Distributed Hash Table | 分布式哈希表（节点发现协议） |
| NAT | Network Address Translation | 网络地址转换 |
| STUN | Session Traversal Utilities for NAT | NAT会话穿越工具 |
| TURN | Traversal Using Relays around NAT | 中继NAT穿越 |
| ICE | Interactive Connectivity Establishment | 交互式连接建立协议 |
| SJF | Shortest Job First | 最短作业优先调度算法 |
| DAG | Directed Acyclic Graph | 有向无环图（任务依赖建模） |

---

*文档版本: v1.0 | 创建日期: 2026-06-02 | 作者: AI Assistant*
*基于: platform-architecture-full/spec.md + 和豆包的对话_0602.txt*
