# Evidence和Settings接口依赖关系分析报告（更新版）

分析时间: 2026-08-10
分析范围: desktop-client-2.0前端页面 + backend后端API

---

## 一、Evidence页面接口分析

### 1.1 当前状态

✅ **已完成集成**

**集成API**: LongTermMemoryApi

**已使用方法**:
- `getMemories()` - 查询长期记忆列表
- `verifyChain()` - 验证链完整性
- `exportReport()` - 导出审计报告

**数据类型**: LongTermMemory

---

### 1.2 API端点映射

| Evidence接口 | LongTermMemory API | 方法 |
|-------------|-------------------|------|
| 列表查询 | `/api/v1/memory/long-term/` | `getMemories()` |
| 链验证 | `/api/v1/memory/long-term/chain_verification/` | `verifyChain()` |
| 导出报告 | `/api/v1/memory/long-term/export_report/` | `exportReport()` |

---

### 1.3 缓存机制

**缓存策略**: 5分钟有效期
- ✅ 列表查询缓存
- ✅ 链验证缓存
- ✅ 手动清除缓存

---

## 二、Settings页面接口分析

### 2.1 当前状态

⚠️ **部分集成，需要完善**

**已集成**:
- ✅ authService（用户信息）
- ✅ fetch（节点监控）

**未集成**:
- ❌ StrategicMemoryApi（策略管理）
- ❌ 策略配置保存逻辑
- ❌ API配置保存逻辑

---

### 2.2 现有功能

#### 功能1: 用户信息 ✅

**来源**: `authService.getCurrentUser()`

**状态**: 已完成，无需修改

---

#### 功能2: 节点资源监控 ✅

**来源**: `fetch('http://localhost:9092/api/v1/node/metrics')`

**状态**: 已完成，独立接口

---

#### 功能3: 服务状态监控 ✅

**来源**: `fetch('http://localhost:9092/health')`

**状态**: 已完成，独立接口

---

#### 功能4: API配置 ⚠️

**当前状态**: 有UI，无保存逻辑

**需要集成**: StrategicMemoryApi

---

#### 功能5: LLM智能分析配置 ⚠️

**当前状态**: 有UI，无保存逻辑

**需要集成**: StrategicMemoryApi

---

#### 功能6: 数据管理 ⚠️

**当前状态**: 有UI，无实际功能

**需要实现**: 备份、清除日志

---

### 2.3 StrategicMemoryApi可用方法

| 方法 | 功能 | 状态 |
|------|------|------|
| `loadEffectiveStrategies()` | 加载生效策略 | ✅ 已实现 |
| `getStrategies()` | 查询策略列表 | ✅ 已实现 |
| `activateStrategy(id)` | 激活策略 | ✅ 已实现 |
| `deactivateStrategy(id)` | 停用策略 | ✅ 已实现 |
| `getEffectiveStrategies()` | 获取本地缓存策略 | ✅ 已实现 |
| `getStrategiesByType(type)` | 按类型筛选策略 | ✅ 已实现 |

---

## 三、依赖关系分析

### 3.1 Evidence页面依赖

```
Evidence.tsx
  ↓
LongTermMemoryApi（已完成）
  ↓
LongTermMemory API
  ↓
LongTermMemory模型
  ↓
数据库（auth_app_longtermmemory表）
```

**状态**: ✅ 已完成

---

### 3.2 Settings页面依赖

#### 用户信息（已完成）

```
Settings.tsx
  ↓
authService.getCurrentUser()
  ↓
JWT Token验证
  ↓
用户信息
```

---

#### 节点监控（已完成）

```
Settings.tsx
  ↓
fetch('/api/v1/node/metrics')
  ↓
NodeMetrics API
  ↓
节点资源数据
```

---

#### 策略管理（待集成）

```
Settings.tsx（待修改）
  ↓
StrategicMemoryApi（已存在）
  ↓
StrategicMemory API
  ↓
StrategicMemory模型
  ↓
数据库（auth_app_strategicmemory表）
```

---

### 3.3 后端API接口清单

#### 长期记忆API（Evidence使用）

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/v1/memory/long-term/` | GET | 查询列表 |
| `/api/v1/memory/long-term/{id}/` | GET | 查询详情 |
| `/api/v1/memory/long-term/chain_verification/` | GET | 验证链 |
| `/api/v1/memory/long-term/export_report/` | POST | 导出报告 |

---

#### 策略记忆API（Settings需要）

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/v1/memory/strategic/` | GET | 查询策略列表 |
| `/api/v1/memory/strategic/effective_strategies/` | GET | 获取生效策略 |
| `/api/v1/memory/strategic/{id}/activate/` | POST | 激活策略 |
| `/api/v1/memory/strategic/{id}/deactivate/` | POST | 停用策略 |
| `/api/v1/memory/strategic/{id}/iterate/` | POST | 策略迭代 |

---

#### 其他API（Settings使用）

| 端点 | 方法 | 功能 |
|------|------|------|
| `/api/v1/node/metrics` | GET | 节点指标 |
| `/health` | GET | 服务状态 |

---

## 四、集成方案

### 4.1 Settings页面集成方案

#### 方案A: 策略管理独立卡片（推荐）

**优点**:
- 功能清晰
- 易于管理
- 用户体验好

**新增内容**:
1. **策略管理卡片**
   - 显示所有策略
   - 显示策略状态（激活/停用）
   - 显示策略类型

2. **策略操作功能**
   - 一键激活/停用
   - 策略详情查看
   - 策略版本历史

---

#### 方案B: 配置集成到策略（备选）

**优点**:
- 配置即策略
- 灵活可扩展

**缺点**:
- 用户理解成本高
- 配置项复杂

---

### 4.2 推荐实施方案A

#### 新增功能模块

**模块1: 策略列表查看**

**UI设计**:
```
┌─────────────────────────────────────┐
│ 策略管理                     [刷新] │
├─────────────────────────────────────┤
│ 策略类型: 检测规则                   │
│ 策略名称: 高风险操作拦截             │
│ 状态: ✅ 已激活                      │
│ 置信度: 95.2%  成功率: 98.1%        │
│ 版本: v2.1                          │
│ 操作: [停用] [详情]                  │
└─────────────────────────────────────┘
```

---

**模块2: API配置保存**

**保存逻辑**:
```typescript
// 保存API配置到策略记忆
const saveApiConfig = async () => {
  const strategy: Partial<StrategicMemory> = {
    strategy_name: 'API配置',
    strategy_type: 'behavior_constraint',
    condition: {
      endpoint: apiConfig.endpoint,
      deepseekKey: apiConfig.deepseekKey
    },
    action: {
      type: 'config_update'
    },
    priority: 100,
    is_active: true
  };

  // 调用StrategicMemoryApi保存
  await strategicApi.createStrategy(strategy);
};
```

---

**模块3: LLM配置保存**

**保存逻辑**:
```typescript
// 保存LLM配置到策略记忆
const saveLLMConfig = async () => {
  const strategy: Partial<StrategicMemory> = {
    strategy_name: 'LLM智能分析配置',
    strategy_type: 'behavior_constraint',
    condition: {
      mode: llmConfig.mode,
      provider: llmConfig.provider,
      apiKey: llmConfig.apiKey,
      model: llmConfig.model,
      apiBase: llmConfig.apiBase
    },
    action: {
      type: 'llm_config_update'
    },
    priority: 100,
    is_active: true
  };

  // 调用StrategicMemoryApi保存
  await strategicApi.createStrategy(strategy);
};
```

---

## 五、实施步骤

### 步骤1: 导入StrategicMemoryApi

**文件**: `Settings.tsx`

```typescript
import { StrategicMemoryApi, StrategicMemory } from '../services/memoryApi'
```

---

### 步骤2: 添加策略状态管理

```typescript
const [strategies, setStrategies] = useState<StrategicMemory[]>([]);
const strategicApi = StrategicMemoryApi.getInstance();
```

---

### 步骤3: 加载策略数据

```typescript
useEffect(() => {
  loadStrategies();
}, []);

const loadStrategies = async () => {
  try {
    const data = await strategicApi.getStrategies();
    setStrategies(data);
  } catch (error) {
    console.error('加载策略失败:', error);
  }
};
```

---

### 步骤4: 实现策略操作

```typescript
const handleActivateStrategy = async (id: number) => {
  try {
    await strategicApi.activateStrategy(id);
    loadStrategies(); // 刷新列表
  } catch (error) {
    console.error('激活策略失败:', error);
  }
};

const handleDeactivateStrategy = async (id: number) => {
  try {
    await strategicApi.deactivateStrategy(id);
    loadStrategies(); // 刷新列表
  } catch (error) {
    console.error('停用策略失败:', error);
  }
};
```

---

### 步骤5: 添加策略管理UI

**新增Section**:
- 策略列表卡片
- 策略状态指示
- 策略操作按钮

---

### 步骤6: 实现配置保存

**API配置保存**:
- 保存endpoint和deepseekKey到策略记忆

**LLM配置保存**:
- 保存mode、provider、apiKey等到策略记忆

---

## 六、测试计划

### 6.1 Evidence页面测试

✅ **已完成**
- 缓存逻辑测试
- 性能测试
- 数据一致性测试

---

### 6.2 Settings页面测试（待执行）

**测试项**:
1. 策略列表加载
2. 策略激活/停用
3. 配置保存
4. 策略同步

---

## 七、总结

### ✅ 已完成

**Evidence页面**:
- ✅ 长期记忆API集成
- ✅ 缓存机制实现
- ✅ 数据结构调整

---

### 📋 待完成

**Settings页面**:
1. 导入StrategicMemoryApi
2. 添加策略管理UI
3. 实现配置保存逻辑
4. 实现策略操作功能

---

### 🎯 下一步

**建议顺序**:
1. 修改Settings.tsx导入StrategicMemoryApi
2. 添加策略管理Section
3. 实现策略激活/停用功能
4. 实现配置保存功能
5. 测试验证

---

**分析状态**: ✅ **完成**
**Evidence集成**: ✅ **已完成**
**Settings集成**: 📋 **待开始**