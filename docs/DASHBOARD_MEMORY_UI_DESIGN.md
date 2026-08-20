# Dashboard集成短期记忆实时监控界面设计方案

## 设计时间
2026-08-10

---

## 一、界面布局设计

### 1.1 整体布局

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户信息卡片                              │
└─────────────────────────────────────────────────────────────────┘
┌──────────┬──────────┬──────────┬──────────┐
│ 审计总数 │ 正常操作 │ 风险操作 │ 已阻断   │  ← 现有统计卡片
└──────────┴──────────┴──────────┴──────────┘
┌──────────┬──────────┬──────────┬──────────┐
│ 短期记忆 │ 低风险   │ 中风险   │ 高风险   │  ← 新增：短期记忆统计
└──────────┴──────────┴──────────┴──────────┘
┌─────────────────────────────────────────────────────────────────┐
│  实时审计流                            [同步状态: ● 正常]        │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Agent: GPT-4     操作: 访问文件系统     风险: 低          │  │
│  │ 时间: 14:30:25   决策: 已放行                              │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Agent: Claude    操作: 执行系统命令     风险: 高          │  │
│  │ 时间: 14:30:20   决策: 已拦截                              │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 二、新增组件设计

### 2.1 短期记忆统计卡片

**位置**：在现有统计卡片下方

**样式**：
```typescript
<div className="memory-stats-card">
  <div className="stat-value">{memoryStats.total}</div>
  <div className="stat-label">短期记忆</div>
  <div className="sync-indicator">
    <span className={`dot ${isSyncing ? 'syncing' : 'synced'}`} />
    <span className="sync-text">
      {isSyncing ? '同步中...' : `${syncInterval}秒前同步`}
    </span>
  </div>
</div>
```

**颜色方案**：
- 短期记忆：默认蓝色（#667eea）
- 低风险：绿色（#3FB950）
- 中风险：橙色（#FFA500）
- 高风险：红色（#F85149）

---

### 2.2 同步状态指示器

**位置**：实时审计流卡片头部右侧

**样式**：
```typescript
<div className="sync-status">
  <span className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
  <span className="status-text">
    {isOnline ? '同步正常' : '离线模式'}
  </span>
  {isSyncing && <span className="sync-icon">🔄</span>}
</div>
```

**状态说明**：
- `在线 - 同步正常`：5秒轮询正在运行
- `在线 - 同步中...`：正在从服务器获取数据
- `离线 - 离线模式`：网络断开，使用缓存数据

---

### 2.3 记忆风险分布图

**位置**：统计卡片下方，审计流上方（可选）

**类型**：简单的横向条形图

**样式**：
```typescript
<div className="risk-distribution">
  <div className="risk-bar">
    <div className="risk-low" style={{ width: `${lowPercent}%` }} />
    <div className="risk-medium" style={{ width: `${mediumPercent}%` }} />
    <div className="risk-high" style={{ width: `${highPercent}%` }} />
    <div className="risk-critical" style={{ width: `${criticalPercent}%` }} />
  </div>
  <div className="risk-labels">
    <span className="risk-label low">低风险: {lowCount}</span>
    <span className="risk-label medium">中风险: {mediumCount}</span>
    <span className="risk-label high">高风险: {highCount}</span>
    <span className="risk-label critical">严重: {criticalCount}</span>
  </div>
</div>
```

---

## 三、交互设计

### 3.1 实时同步动画

**场景**：每5秒同步一次数据

**动画效果**：
1. 同步图标旋转（🔄 360度旋转）
2. 统计卡片数字闪烁（高亮效果）
3. 新记录淡入（opacity: 0 → 1）

**实现方式**：
```css
@keyframes sync {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.syncing .sync-icon {
  animation: sync 1s linear infinite;
}

@keyframes flash {
  0%, 100% { background: inherit; }
  50% { background: rgba(102, 126, 234, 0.1); }
}

.stat-card.updating {
  animation: flash 0.5s ease-in-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

.audit-item.new {
  animation: fadeIn 0.3s ease-in-out;
}
```

---

### 3.2 点击交互

**场景1：点击统计卡片**

**效果**：筛选审计流
- 点击"短期记忆"：显示所有短期记忆
- 点击"低风险"：筛选风险等级为low的记录
- 点击"中风险"：筛选风险等级为medium的记录
- 点击"高风险"：筛选风险等级为high/critical的记录

---

**场景2：点击同步状态**

**效果**：显示同步详情弹窗
- 上次同步时间
- 同步数据量
- 网络延迟
- 缓存命中率

---

**场景3：点击风险分布条**

**效果**：展开详细统计
- 各风险等级的具体数量
- 占比百分比
- 趋势图表（可选）

---

## 四、数据流设计

### 4.1 数据获取流程

```
Dashboard组件加载
    ↓
初始化短期记忆API
    ↓
开始5秒轮询同步 ←───┐
    ↓               │
获取短期记忆数据      │
    ↓               │
更新state            │
    ↓               │
渲染UI              │
    ↓               │
等待5秒 ─────────────┘
```

---

### 4.2 状态管理

```typescript
interface MemoryState {
  // 短期记忆数据
  memories: ShortTermMemory[];

  // 统计数据
  stats: {
    total: number;
    low: number;
    medium: number;
    high: number;
    critical: number;
  };

  // 同步状态
  syncStatus: {
    isSyncing: boolean;
    lastSyncTime: Date;
    syncInterval: number; // 秒
    isOnline: boolean;
  };

  // 筛选状态
  filter: 'all' | 'low' | 'medium' | 'high' | 'critical';
}
```

---

## 五、组件代码结构

### 5.1 主组件结构

```typescript
export default function Dashboard() {
  // ===== 状态定义 =====
  const [records, setRecords] = useState<AuditRecord[]>([]);
  const [memoryStats, setMemoryStats] = useState<MemoryStats>({
    total: 0,
    low: 0,
    medium: 0,
    high: 0,
    critical: 0
  });
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isSyncing: false,
    lastSyncTime: new Date(),
    syncInterval: 5,
    isOnline: true
  });

  // ===== 初始化短期记忆同步 =====
  useEffect(() => {
    const shortTermApi = ShortTermMemoryApi.getInstance();

    // 开始5秒轮询同步
    shortTermApi.startSync(async (memories) => {
      // 更新记忆数据
      setRecords(memories);

      // 更新统计数据
      const stats = await shortTermApi.getRiskStatistics();
      setMemoryStats(stats);

      // 更新同步状态
      setSyncStatus(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncTime: new Date()
      }));
    });

    // 清理函数
    return () => {
      shortTermApi.stopSync();
    };
  }, []);

  // ===== 渲染UI =====
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 24 }}>
      {/* 用户信息卡片 */}
      <UserInfoCard />

      {/* 审计统计卡片 */}
      <div className="stats-grid">
        <StatCard value={stats.total} label="今日审计总数" />
        <StatCard value={stats.success} label="正常操作" color="success" />
        <StatCard value={stats.warning} label="风险操作" color="warning" />
        <StatCard value={stats.error} label="已阻断" color="error" />
      </div>

      {/* 短期记忆统计卡片（新增） */}
      <div className="memory-stats-grid">
        <MemoryStatCard
          value={memoryStats.total}
          label="短期记忆"
          syncStatus={syncStatus}
        />
        <MemoryStatCard value={memoryStats.low} label="低风险" color="low" />
        <MemoryStatCard value={memoryStats.medium} label="中风险" color="medium" />
        <MemoryStatCard value={memoryStats.high} label="高风险" color="high" />
      </div>

      {/* 风险分布图（可选） */}
      <RiskDistributionChart stats={memoryStats} />

      {/* 实时审计流 */}
      <AuditStream
        records={records}
        syncStatus={syncStatus}
        onFilterChange={setFilter}
      />
    </div>
  );
}
```

---

## 六、样式设计

### 6.1 统计卡片样式

```css
/* 短期记忆统计卡片 */
.memory-stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.memory-stat-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  transition: all 0.3s ease;
}

.memory-stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.memory-stat-card.updating {
  animation: flash 0.5s ease-in-out;
}

.stat-value {
  font-size: 32px;
  font-weight: 600;
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
  color: var(--text-secondary);
}

/* 同步状态指示器 */
.sync-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 12px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.sync-indicator .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--status-success);
}

.sync-indicator .dot.syncing {
  background: var(--primary-color);
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

---

### 6.2 风险分布图样式

```css
.risk-distribution {
  padding: 20px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
}

.risk-bar {
  display: flex;
  height: 12px;
  border-radius: 6px;
  overflow: hidden;
  background: var(--bg-tertiary);
}

.risk-low {
  background: #3FB950;
  transition: width 0.3s ease;
}

.risk-medium {
  background: #FFA500;
  transition: width 0.3s ease;
}

.risk-high {
  background: #F85149;
  transition: width 0.3s ease;
}

.risk-critical {
  background: #DA3633;
  transition: width 0.3s ease;
}

.risk-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 12px;
  font-size: 13px;
}

.risk-label {
  display: flex;
  align-items: center;
  gap: 6px;
}

.risk-label::before {
  content: '';
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.risk-label.low::before { background: #3FB950; }
.risk-label.medium::before { background: #FFA500; }
.risk-label.high::before { background: #F85149; }
.risk-label.critical::before { background: #DA3633; }
```

---

## 七、性能优化

### 7.1 渲染优化

**策略**：
1. 使用React.memo避免不必要的重渲染
2. 使用useMemo缓存计算结果
3. 使用useCallback缓存回调函数

**示例**：
```typescript
// 使用React.memo优化统计卡片
const MemoryStatCard = React.memo(function MemoryStatCard({
  value,
  label,
  color,
  syncStatus
}: MemoryStatCardProps) {
  return (
    <div className="memory-stat-card">
      <div className={`stat-value ${color || ''}`}>{value}</div>
      <div className="stat-label">{label}</div>
      {syncStatus && (
        <div className="sync-indicator">
          <span className={`dot ${syncStatus.isSyncing ? 'syncing' : ''}`} />
          <span>{syncStatus.isSyncing ? '同步中...' : '已同步'}</span>
        </div>
      )}
    </div>
  );
});

// 使用useMemo缓存统计数据
const memoryStats = useMemo(() => {
  return {
    total: memories.length,
    low: memories.filter(m => m.risk_level === 'low').length,
    medium: memories.filter(m => m.risk_level === 'medium').length,
    high: memories.filter(m => m.risk_level === 'high').length,
    critical: memories.filter(m => m.risk_level === 'critical').length,
  };
}, [memories]);
```

---

### 7.2 数据更新优化

**策略**：
1. 批量更新数据，避免频繁setState
2. 使用不可变数据更新
3. 虚拟滚动（大量数据时）

**示例**：
```typescript
// 批量更新
const handleSync = useCallback((newMemories: ShortTermMemory[]) => {
  // 使用函数式更新，避免依赖外部状态
  setRecords(prev => {
    // 合并新旧数据，去重
    const merged = [...newMemories, ...prev];
    const unique = merged.filter((mem, index, self) =>
      index === self.findIndex(m => m.id === mem.id)
    );

    // 按时间排序（最新的在前）
    return unique.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  });
}, []);
```

---

## 八、实施计划

### 8.1 实施步骤

**第一步：创建统计卡片组件**
- 创建MemoryStatCard组件
- 添加同步状态指示器
- 添加样式

**第二步：集成短期记忆API**
- 初始化ShortTermMemoryApi
- 实现5秒轮询同步
- 处理同步数据

**第三步：创建风险分布图**
- 创建RiskDistributionChart组件
- 实现动态更新
- 添加交互效果

**第四步：优化性能**
- 添加React.memo
- 添加useMemo/useCallback
- 测试性能

**第五步：测试验证**
- 测试5秒同步是否正常
- 测试离线缓存是否工作
- 测试性能是否达标

---

### 8.2 预期效果

**视觉效果**：
- ✅ 实时更新的统计卡片
- ✅ 同步状态实时显示
- ✅ 风险分布一目了然

**性能指标**：
- ✅ 渲染时间 < 100ms
- ✅ 内存占用 < 10MB
- ✅ CPU占用 < 5%

---

## 九、总结

### 设计要点

1. **实时性**：5秒轮询同步，数据实时更新
2. **可视化**：风险分布图，一目了然
3. **状态反馈**：同步状态实时显示
4. **交互友好**：点击筛选，详情弹窗
5. **性能优化**：React.memo，虚拟滚动

---

### 技术栈

- React 18（Hooks）
- TypeScript
- CSS Modules
- 海马体记忆API

---

### 下一步

1. 创建MemoryStatCard组件
2. 集成ShortTermMemoryApi
3. 创建RiskDistributionChart组件
4. 测试验证功能

---

**设计方案已完成，可以开始实施！**