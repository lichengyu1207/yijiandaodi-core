# 海马体记忆系统架构方案

## 一、系统定位

### 1.1 核心理念
将一鉴到底从"安全功能"升级为"Agent安全治理体系"——提供包括身份认证、权限管控、行为审计、合规存证在内的完整治理能力，通过**海马体记忆系统**实现持续反馈迭代。

### 1.2 海马体类比
人类大脑海马体负责：
- 短期记忆转化为长期记忆
- 记忆巩固和检索
- 空间导航和情境关联
- 学习和情感记忆

对应到AI Agent安全系统：
- **短期记忆**：实时行为监控数据
- **长期记忆**：历史审计记录和知识库
- **情境关联**：Agent身份、权限、行为上下文
- **持续学习**：安全策略自适应优化

## 二、技术栈选择（零新增依赖）

### 2.1 现有技术栈
- **后端**：Django 4.2 + Django REST Framework
- **数据库**：SQLite（开发）/ PostgreSQL（生产）
- **前端**：React 18 + TypeScript
- **桌面端**：Electron 28
- **认证**：JWT Token + Cookie

### 2.2 为什么不引入Redis/分布式系统？
1. **用户明确反对重依赖**
2. **SQLite性能足够**：单机审计场景，日活请求<10万，SQLite完全够用
3. **Django ORM强大**：支持复杂查询、聚合、事务
4. **部署简单**：无需额外中间件维护

### 2.3 性能优化策略（不依赖Redis）
```python
# 1. 数据库索引优化
class AuditRecord(models.Model):
    class Meta:
        indexes = [
            models.Index(fields=['timestamp']),
            models.Index(fields=['agent_name', 'timestamp']),
            models.Index(fields=['risk_level']),
        ]

# 2. 分页查询 + 懒加载
# 3. Django缓存框架（内存缓存）
# 4. 异步任务处理（Celery可选）
```

## 三、三层记忆模型设计

### 3.1 短期记忆层（Working Memory）

**作用**：实时行为监控，毫秒级响应

**数据结构**：
```python
class ShortTermMemory(models.Model):
    """短期记忆：实时行为缓存"""
    agent_id = models.CharField(max_length=100)
    operation_type = models.CharField(max_length=50)
    operation_content = models.TextField()
    risk_score = models.FloatField()
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    # 自动过期机制（30分钟）
    expires_at = models.DateTimeField()

    class Meta:
        indexes = [
            models.Index(fields=['-timestamp']),
            models.Index(fields=['agent_id', 'expires_at']),
        ]

    def save(self, *args, **kwargs):
        from django.utils import timezone
        from datetime import timedelta
        self.expires_at = timezone.now() + timedelta(minutes=30)
        super().save(*args, **kwargs)
```

**清理机制**：
```python
# Django定时任务（Django-extensions或Celery）
@shared_task
def clean_expired_memories():
    """清理过期短期记忆"""
    ShortTermMemory.objects.filter(
        expires_at__lt=timezone.now()
    ).delete()
```

### 3.2 长期记忆层（Long-term Memory）

**作用**：历史审计存证，知识库积累

**数据结构**：
```python
class LongTermMemory(models.Model):
    """长期记忆：历史审计记录"""
    agent_id = models.CharField(max_length=100, db_index=True)
    operation_type = models.CharField(max_length=50)
    operation_content = models.TextField()
    risk_level = models.CharField(max_length=20)
    risk_score = models.FloatField()
    risk_tags = models.JSONField(default=list)  # 风险标签

    # 五元组链式存证
    record_hash = models.CharField(max_length=64, unique=True)
    prev_hash = models.CharField(max_length=64)
    chain_index = models.IntegerField()

    # 决策结果
    decision = models.CharField(max_length=20)  # allow/block/ask_user

    # 时间戳
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['-timestamp']),
            models.Index(fields=['agent_id', 'timestamp']),
            models.Index(fields=['risk_level']),
        ]
```

### 3.3 策略记忆层（Strategic Memory）

**作用**：安全策略自适应，持续迭代优化

**数据结构**：
```python
class StrategicMemory(models.Model):
    """策略记忆：安全策略知识库"""
    strategy_id = models.CharField(max_length=100, unique=True)
    strategy_type = models.CharField(max_length=50)  # detection_rule/threshold/whitelist

    # 策略内容
    rule_name = models.CharField(max_length=100)
    rule_condition = models.JSONField()  # 规则条件（JSON Schema）
    rule_action = models.CharField(max_length=20)  # allow/block/ask

    # 学习参数
    confidence = models.FloatField(default=0.5)  # 置信度
    sample_count = models.IntegerField(default=0)  # 样本数量
    success_rate = models.FloatField(default=0.0)  # 成功率

    # 迭代版本
    version = models.IntegerField(default=1)
    parent_strategy = models.ForeignKey('self', null=True, on_delete=models.SET_NULL)

    # 生效状态
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['strategy_type', 'is_active']),
        ]
```

## 四、反馈闭环流程

### 4.1 检测→存证→记忆→迭代闭环

```
┌─────────────────────────────────────────────────────────────┐
│  1. Agent行为触发                                             │
│     └─> 用户操作 / API调用 / 文件访问                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  2. 实时安全检测                                              │
│     ├─> 加载策略记忆（StrategicMemory）                        │
│     ├─> 四官协同校验（规则引擎）                                │
│     └─> 存入短期记忆（ShortTermMemory）                        │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  3. 风险决策执行                                              │
│     ├─> Allow：放行 + 存入长期记忆                             │
│     ├─> Block：阻断 + 存入长期记忆                             │
│     └─> Ask User：询问用户 → 反馈到策略记忆                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  4. 记忆巩固（定时任务）                                        │
│     ├─> 短期记忆 → 长期记忆（重要事件）                         │
│     ├─> 清理过期短期记忆                                        │
│     └─> 统计分析（日/周/月报告）                                │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  5. 策略迭代优化                                              │
│     ├─> 分析长期记忆数据                                       │
│     ├─> 提取安全模式（机器学习）                                │
│     ├─> 生成新策略 / 调整阈值                                  │
│     └─> 更新策略记忆（版本演进）                                │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      └─────────────> 回到步骤2，持续迭代
```

### 4.2 数据流设计

```python
# API: /api/v1/memory/short-term/
class ShortTermMemoryViewSet(viewsets.ModelViewSet):
    """短期记忆API"""
    queryset = ShortTermMemory.objects.all()
    serializer_class = ShortTermMemorySerializer

    def create(self, request):
        """存入短期记忆"""
        serializer = self.get_serializer(data=request.data)
        serializer.save()

        # 实时检测
        risk_score = detect_risk(serializer.data)
        if risk_score > 0.8:
            # 高风险：立即存入长期记忆
            LongTermMemory.objects.create(**serializer.data)

        return Response(serializer.data, status=201)

# API: /api/v1/memory/long-term/
class LongTermMemoryViewSet(viewsets.ReadOnlyModelViewSet):
    """长期记忆查询"""
    queryset = LongTermMemory.objects.all().order_by('-timestamp')
    serializer_class = LongTermMemorySerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['agent_id', 'risk_level', 'operation_type']

# API: /api/v1/memory/strategic/
class StrategicMemoryViewSet(viewsets.ModelViewSet):
    """策略记忆管理"""
    queryset = StrategicMemory.objects.filter(is_active=True)
    serializer_class = StrategicMemorySerializer

    @action(detail=False, methods=['post'])
    def iterate(self, request):
        """策略迭代"""
        # 1. 分析长期记忆
        patterns = analyze_patterns()

        # 2. 生成新策略
        new_strategy = generate_strategy(patterns)

        # 3. 创建新版本
        StrategicMemory.objects.create(
            strategy_id=new_strategy['id'],
            parent_strategy=request.data.get('parent_id'),
            version=F('version') + 1,
            **new_strategy
        )

        return Response(new_strategy)
```

## 五、数据打通方案

### 5.1 Web端 ↔ 桌面端数据同步

**现状**：
- Web端：`http://localhost:3000` → 后端API `/api/...`
- 桌面端：`http://localhost:9092/api` → 同一后端

**打通方案**：
```typescript
// desktop-client-2.0/src/services/memoryApi.ts
import { authService } from './authService';

const API_BASE = 'http://localhost:9092/api/v1';

export const memoryApi = {
  // 获取短期记忆（实时监控）
  getShortTermMemory: async (params?: any) => {
    const response = await authService.authenticatedFetch(
      `${API_BASE}/memory/short-term/?${new URLSearchParams(params)}`
    );
    return response.json();
  },

  // 查询长期记忆（历史审计）
  getLongTermMemory: async (params?: any) => {
    const response = await authService.authenticatedFetch(
      `${API_BASE}/memory/long-term/?${new URLSearchParams(params)}`
    );
    return response.json();
  },

  // 获取策略记忆
  getStrategicMemory: async () => {
    const response = await authService.authenticatedFetch(
      `${API_BASE}/memory/strategic/`
    );
    return response.json();
  },

  // 策略迭代
  iterateStrategy: async (strategyId: string) => {
    const response = await authService.authenticatedFetch(
      `${API_BASE}/memory/strategic/iterate/`,
      {
        method: 'POST',
        body: JSON.stringify({ parent_id: strategyId })
      }
    );
    return response.json();
  }
};
```

### 5.2 本地缓存策略（离线可用）

```typescript
// desktop-client-2.0/src/services/cacheService.ts
export class CacheService {
  private static CACHE_KEY = 'memory_cache';
  private static CACHE_DURATION = 5 * 60 * 1000; // 5分钟

  static async getWithCache(key: string, fetcher: () => Promise<any>) {
    const cached = localStorage.getItem(this.CACHE_KEY);
    const now = Date.now();

    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (now - timestamp < this.CACHE_DURATION) {
        return data;
      }
    }

    // 缓存失效，重新获取
    const data = await fetcher();
    localStorage.setItem(this.CACHE_KEY, JSON.stringify({
      data,
      timestamp: now
    }));

    return data;
  }
}
```

## 六、四层架构实现路径

### 6.1 层级对比表

| 层级 | 能力 | 当前状态 | 优先级 | 预计工作量 |
|------|------|----------|--------|-----------|
| 身份可信层 | Agent身份认证与权限管理 | 🔴 待开发 | P0 | 3天 |
| 行为控制层 | 四官协同校验 | ✅ 已完成 | - | - |
| 审计存证层 | 五元组链式存证 | ✅ 已完成 | - | - |
| 合规治理层 | 治理健康度监控、策略热加载 | 🔴 待开发 | P1 | 2天 |

### 6.2 身份可信层实现（P0）

**核心功能**：
1. Agent身份注册（DID）
2. 权限分配（RBAC）
3. 身份验证（JWT + 签名）

**技术方案**：
```python
# backend/identity/models.py
class AgentIdentity(models.Model):
    """Agent身份"""
    did = models.CharField(max_length=100, unique=True)  # 去中心化ID
    name = models.CharField(max_length=100)
    public_key = models.TextField()  # Ed25519公钥

    # 权限级别
    permission_level = models.CharField(max_length=20, choices=[
        ('admin', '管理员'),
        ('editor', '编辑者'),
        ('viewer', '查看者'),
        ('guest', '访客')
    ])

    # 状态
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

class AgentCredential(models.Model):
    """Agent凭证（VC）"""
    agent = models.ForeignKey(AgentIdentity, on_delete=models.CASCADE)
    credential_type = models.CharField(max_length=50)  # api_access/file_read/file_write
    credential_data = models.JSONField()
    signature = models.TextField()  # 签名证明
    expires_at = models.DateTimeField()
```

### 6.3 合规治理层实现（P1）

**核心功能**：
1. 治理健康度监控（实时Dashboard）
2. 策略热加载（无需重启服务）
3. 合规报告生成

**技术方案**：
```python
# backend/governance/models.py
class GovernanceHealth(models.Model):
    """治理健康度"""
    metric_type = models.CharField(max_length=50)  # detection_rate/false_positive_rate/audit_coverage
    metric_value = models.FloatField()
    threshold = models.FloatField()
    status = models.CharField(max_length=20)  # healthy/warning/critical

    timestamp = models.DateTimeField(auto_now_add=True)

class PolicyHotReload(models.Model):
    """策略热加载"""
    policy_id = models.CharField(max_length=100)
    policy_type = models.CharField(max_length=50)
    policy_content = models.JSONField()

    version = models.IntegerField()
    is_active = models.BooleanField(default=True)
    loaded_at = models.DateTimeField(auto_now=True)
```

## 七、参考项目适配性分析

### 7.1 TAISE-Agent认证框架

**可借鉴点**：
- ✅ 跨五个行为域评估机制（网络/文件/进程/内存/用户）
- ✅ 行为风险评估模型
- ✅ 可信度量化指标

**适配方案**：
```python
# 移植TAISE的五域评估到四官协同校验
class FiveDomainEvaluation:
    def evaluate_network_behavior(self, operation):
        """网络域评估"""
        pass

    def evaluate_file_behavior(self, operation):
        """文件域评估"""
        pass

    # ... 其他域
```

### 7.2 esign-agent-trust

**可借鉴点**：
- ✅ 四可信闭环：身份可信、工作负载可信、数据可信、行为可信
- ✅ SPIFFE/SPIRE工作负载身份

**适配方案**：
```python
# 简化版SPIRE实现
class WorkloadIdentity:
    """工作负载身份"""
    spiffe_id = models.CharField(max_length=200)
    svid = models.TextField()  # SVID证书
    trust_domain = models.CharField(max_length=100)
```

### 7.3 trusted-agent-engine

**可借鉴点**：
- ✅ 主权意识与自我演进能力
- ✅ 物理脱钩的规则热加载
- ✅ Ed25519签名校验

**适配方案**：
```python
# 引入Ed25519签名（Python库）
from cryptography.hazmat.primitives.asymmetric import ed25519

class SignatureVerifier:
    def verify_operation(self, operation, signature, public_key):
        """验证操作签名"""
        public_key = ed25519.Ed25519PublicKey.from_public_bytes(
            bytes.fromhex(public_key)
        )
        public_key.verify(signature, operation.encode())
```

## 八、实施计划

### 8.1 第一阶段（1周）- 身份可信层
- [ ] AgentIdentity模型开发
- [ ] DID生成与验证API
- [ ] RBAC权限分配系统
- [ ] 桌面端身份管理界面

### 8.2 第二阶段（1周）- 海马体记忆系统
- [ ] 三层记忆模型数据库设计
- [ ] 记忆存取API开发
- [ ] 记忆巩固定时任务
- [ ] Web端/桌面端数据打通

### 8.3 第三阶段（3天）- 合规治理层
- [ ] 治理健康度监控Dashboard
- [ ] 策略热加载机制
- [ ] 合规报告生成

### 8.4 第四阶段（持续）- 策略迭代优化
- [ ] 长期记忆数据分析
- [ ] 安全模式提取
- [ ] 自适应策略生成
- [ ] A/B测试与效果评估

## 九、性能保障（无Redis）

### 9.1 数据库优化
```sql
-- 创建索引
CREATE INDEX idx_short_memory_timestamp ON short_term_memory(timestamp DESC);
CREATE INDEX idx_long_memory_agent_time ON long_term_memory(agent_id, timestamp DESC);

-- 分区表（可选，日活>100万时启用）
CREATE TABLE long_term_memory_2024_01 PARTITION OF long_term_memory
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### 9.2 查询优化
```python
# 分页查询
records = LongTermMemory.objects.filter(
    agent_id=agent_id
).select_related('agent').only(
    'operation_type', 'risk_level', 'timestamp'
).order_by('-timestamp')[:100]

# 批量插入
LongTermMemory.objects.bulk_create([record1, record2, ...])

# 异步任务
from django.db import transaction

@transaction.atomic
def create_with_hash(record_data):
    """原子操作：创建记录 + 生成哈希"""
    record = LongTermMemory.objects.create(**record_data)
    record.record_hash = generate_hash(record)
    record.save()
    return record
```

## 十、总结

本方案基于**现有Django+SQLite技术栈**，零新增中间件，实现完整的海马体记忆系统：

1. **三层记忆模型**：短期/长期/策略记忆，模拟人类海马体功能
2. **反馈闭环流程**：检测→存证→记忆→迭代，持续优化安全策略
3. **数据完全打通**：Web端与桌面端共享同一后端，实时同步
4. **四层架构完整**：身份可信 + 行为控制 + 审计存证 + 合规治理
5. **参考项目适配**：借鉴TAISE/esign/trusted-engine核心思想，简化实现

**核心优势**：
- ✅ 无需Redis/分布式系统
- ✅ 部署简单，维护成本低
- ✅ 性能足够，日活<10万完全够用
- ✅ 持续迭代，策略自适应优化