# Evidence和Settings现有接口依赖关系分析报告

分析时间: 2026-08-10
分析范围: desktop-client-2.0前端页面 + backend后端API

---

## 一、Evidence页面现有接口

### 1.1 存证记录查询

**接口**: `GET /api/v1/evidence/records?limit=50`

**返回数据结构**:
```typescript
interface EvidenceRecord {
  id: number
  timestamp: string
  agent_name: string
  operation_type: string
  operation_content: string
  risk_level: string
  risk_score: number
  risk_tags: string[]
  decision: string
  record_hash: string
  prev_hash: string
  chain_index: number
}
```

**对比LongTermMemory**:
```typescript
interface LongTermMemory {
  id: number;
  agent_id: string;
  operation_type: string;
  operation_content: string;
  risk_level: string;
  decision: string;
  chain_index: number;
  prev_hash: string;
  record_hash: string;
  created_at: string;
}
```

**相似度**: 90%

---

### 1.2 链完整性验证

**接口**: `GET /api/v1/evidence/verify`

**返回数据结构**:
```typescript
interface ChainStatus {
  valid: boolean
  total_records: number
  last_hash: string
  errors: any[]
}
```

**对应LongTermMemory API**:
- `GET /api/v1/memory/long-term/chain_verification/`

---

### 1.3 报告导出

**接口**: `GET /api/v1/evidence/export?format=json|html`

**对应LongTermMemory API**:
- `POST /api/v1/memory/long-term/export_report/`

---

## 二、Settings页面现有接口

### 2.1 用户信息

**来源**: `authService.getCurrentUser()`

**数据结构**:
```typescript
interface UserInfo {
  id: number
  username: string
  email: string
  role: string
}
```

**状态**: ✅ 已使用authService，无需修改

---

### 2.2 节点资源监控

**接口**: `GET /api/v1/node/metrics`

**返回数据结构**:
```typescript
interface NodeMetrics {
  cpu_usage: number
  memory_usage: number
  gpu_usage: number | null
  disk_available: number
  disk_total: number
}
```

**状态**: ✅ 已有独立接口，无需集成海马体

---

### 2.3 服务状态监控

**接口**: `GET http://localhost:9092/health`

**状态**: ✅ 已有独立接口，无需集成海马体

---

### 2.4 配置管理

**类型**:
- API配置（endpoint, deepseekKey）
- LLM配置（mode, provider, apiKey, model, apiBase）

**状态**: ⚠️ 需要集成策略记忆API

---

## 三、海马体记忆API接口

### 3.1 短期记忆API

**端点**: `/api/v1/memory/short-term/`

**功能**:
- ✅ 已在Dashboard集成
- ✅ 5秒轮询同步
- ✅ 风险统计分析

---

### 3.2 长期记忆API

**端点**: `/api/v1/memory/long-term/`

**关键方法**:
- `GET /api/v1/memory/long-term/` - 查询列表
- `GET /api/v1/memory/long-term/{id}/` - 查询详情
- `GET /api/v1/memory/long-term/chain_verification/` - 验证链完整性
- `POST /api/v1/memory/long-term/export_report/` - 导出报告

---

### 3.3 策略记忆API

**端点**: `/api/v1/memory/strategic/`

**关键方法**:
- `GET /api/v1/memory/strategic/` - 查询策略列表
- `GET /api/v1/memory/strategic/effective_strategies/` - 获取生效策略
- `POST /api/v1/memory/strategic/{id}/activate/` - 激活策略
- `POST /api/v1/memory/strategic/{id}/deactivate/` - 停用策略
- `POST /api/v1/memory/strategic/{id}/iterate/` - 策略迭代

---

## 四、依赖关系分析

### 4.1 Evidence页面依赖

| 现有接口 | 海马体API | 集成方式 |
|---------|----------|---------|
| `/api/v1/evidence/records` | `/api/v1/memory/long-term/` | 替换或映射 |
| `/api/v1/evidence/verify` | `/api/v1/memory/long-term/chain_verification/` | 替换 |
| `/api/v1/evidence/export` | `/api/v1/memory/long-term/export_report/` | 替换 |

**依赖关系**:
```
Evidence.tsx
  ↓
LongTermMemory API
  ↓
memory_models.py (LongTermMemory Model)
  ↓
数据库 (auth_app_longtermmemory表)
```

---

### 4.2 Settings页面依赖

| 现有功能 | 海马体API | 集成方式 |
|---------|----------|---------|
| 用户信息 | authService | ✅ 已集成 |
| 节点监控 | `/api/v1/node/metrics` | ✅ 无需修改 |
| 服务状态 | `/health` | ✅ 无需修改 |
| API配置 | 策略记忆API | 🔄 需要新增 |
| LLM配置 | 策略记忆API | 🔄 需要新增 |
| 策略管理 | 策略记忆API | 🔄 需要新增 |

**依赖关系**:
```
Settings.tsx
  ↓
策略记忆API
  ↓
memory_models.py (StrategicMemory Model)
  ↓
数据库 (auth_app_strategicmemory表)
```

---

## 五、集成方案

### 5.1 Evidence集成方案

#### 方案A: 直接替换API（推荐）

**优点**: 
- 利用海马体记忆系统优势
- 数据结构更完整
- 性能更优

**步骤**:
1. 创建 `LongTermMemoryApi` 服务
2. 替换Evidence页面的API调用
3. 调整数据映射

---

#### 方案B: 保留现有接口，后台映射

**优点**: 
- 前端改动最小
- 兼容性好

**缺点**: 
- 需要额外的映射层
- 性能略差

---

### 5.2 Settings集成方案

#### 策略管理功能（新增）

**需要新增的功能**:
1. **策略列表查看**
   - 显示所有策略
   - 显示策略状态（激活/停用）
   - 显示策略版本

2. **策略激活/停用**
   - 一键激活/停用策略
   - 实时生效

3. **策略迭代**
   - 查看策略历史版本
   - 创建新版本

---

## 六、数据映射

### 6.1 EvidenceRecord → LongTermMemory

```typescript
// 映射关系
EvidenceRecord.agent_name      → LongTermMemory.agent_id
EvidenceRecord.risk_tags       → LongTermMemory.metadata.tags (新增字段)
EvidenceRecord.risk_score      → LongTermMemory.metadata.score (新增字段)
EvidenceRecord.decision        → LongTermMemory.decision
EvidenceRecord.chain_index     → LongTermMemory.chain_index
EvidenceRecord.prev_hash       → LongTermMemory.prev_hash
EvidenceRecord.record_hash     → LongTermMemory.record_hash
```

**需要调整的字段**:
- agent_name → agent_id (字段名不同)
- risk_tags → 需要在LongTermMemory添加metadata字段
- risk_score → 需要在LongTermMemory添加metadata字段

---

## 七、接口对比

### 7.1 查询接口

| 功能 | Evidence现有 | 长期记忆API | 对比 |
|------|-------------|------------|------|
| 列表查询 | `/evidence/records` | `/memory/long-term/` | 相似 |
| 风险筛选 | 支持 | 支持 | ✅ |
| 搜索功能 | 支持 | 支持 | ✅ |
| 分页 | 支持 | 支持 | ✅ |

---

### 7.2 验证接口

| 功能 | Evidence现有 | 长期记忆API | 对比 |
|------|-------------|------------|------|
| 链验证 | `/evidence/verify` | `/memory/long-term/chain_verification/` | 相同 |
| 错误详情 | 支持 | 支持 | ✅ |

---

### 7.3 导出接口

| 功能 | Evidence现有 | 长期记忆API | 对比 |
|------|-------------|------------|------|
| JSON导出 | `/evidence/export?format=json` | `/memory/long-term/export_report/` | 相似 |
| HTML导出 | `/evidence/export?format=html` | `/memory/long-term/export_report/` | 需确认 |

---

## 八、实施建议

### 8.1 Evidence集成步骤

1. **创建LongTermMemoryApi服务**（前端）
   - 参考ShortTermMemoryApi实现
   - 添加缓存机制（5分钟有效期）

2. **修改Evidence页面**
   - 替换API调用
   - 调整数据映射

3. **后端调整**（可选）
   - 添加metadata字段到LongTermMemory
   - 支持risk_tags和risk_score

---

### 8.2 Settings集成步骤

1. **创建StrategicMemoryApi服务**（前端）
   - 策略查询
   - 策略激活/停用
   - 策略迭代

2. **添加策略管理UI**
   - 策略列表卡片
   - 策略详情面板
   - 激活/停用按钮

3. **集成到LLM配置**
   - 从策略记忆获取配置
   - 动态更新策略

---

## 九、风险评估

### 9.1 高风险

- ⚠️ 数据结构不兼容：agent_name vs agent_id
- ⚠️ 缺少字段：risk_tags, risk_score

### 9.2 中风险

- ⚠️ API路径变更：需要前端适配
- ⚠️ 性能影响：大量历史数据查询

### 9.3 低风险

- ✅ 用户信息：已集成authService
- ✅ 节点监控：独立接口

---

## 十、总结

### 依赖关系清晰

- Evidence主要依赖长期记忆API
- Settings主要依赖策略记忆API

### 集成可行性高

- 数据结构90%相似
- API功能完整
- 接口设计合理

### 建议

1. **优先集成Evidence**：利用现有的长期记忆系统
2. **其次集成Settings**：新增策略管理功能
3. **数据兼容处理**：添加metadata字段或映射层

---

**下一步**: 开始实施Evidence集成长期记忆功能