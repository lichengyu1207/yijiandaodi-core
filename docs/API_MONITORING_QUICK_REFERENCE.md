# API监控日志快速参考

## 监控覆盖范围

### ✅ ShortTermMemoryApi（已完成）

| 接口方法 | 文件位置 | 监控内容 |
|---------|---------|---------|
| getMemories() | [memoryApi.ts:154-227](file:///c:/MsSafeData/Desktop/yijiandaodi/desktop-client-2.0/src/services/memoryApi.ts#L154) | 获取记忆列表，带参数查询 |
| cleanupExpired() | [memoryApi.ts:229-291](file:///c:/MsSafeData/Desktop/yijiandaodi/desktop-client-2.0/src/services/memoryApi.ts#L229) | 清理过期记忆，POST请求 |
| getRiskStatistics() | [memoryApi.ts:293-364](file:///c:/MsSafeData/Desktop/yijiandaodi/desktop-client-2.0/src/services/memoryApi.ts#L293) | 获取风险统计，数据聚合 |

### ⏳ LongTermMemoryApi（待实施）

| 接口方法 | 用途 | 优先级 |
|---------|------|--------|
| getMemories() | 获取长期记忆列表 | 高 |
| verifyChain() | 验证链完整性 | 高 |
| exportReport() | 导出审计报告 | 中 |

### ⏳ StrategicMemoryApi（待实施）

| 接口方法 | 用途 | 优先级 |
|---------|------|--------|
| getStrategies() | 获取策略列表 | 高 |
| activateStrategy() | 激活策略 | 高 |
| deactivateStrategy() | 停用策略 | 高 |
| loadEffectiveStrategies() | 加载生效策略 | 中 |

---

## 监控日志格式标准

### 日志结构

```
[API名称] ════════════════════════════════════
[API名称] 开始<操作>: <时间戳>
[API名称] URL: <请求URL>
[API名称] 阶段1(请求准备)耗时: <毫秒>ms
[API名称] 阶段2(网络请求)开始...
[API名称] 阶段2(网络请求)耗时: <毫秒>ms
[API名称] 响应状态: <状态码>
[API名称] 阶段3(数据解析)开始...
[API名称] 阶段3(数据解析)耗时: <毫秒>ms
[API名称] <业务数据>
[API名称] ✓ 总耗时: <毫秒>ms
[API名称]   - 请求准备: <毫秒>ms (<百分比>%)
[API名称]   - 网络请求: <毫秒>ms (<百分比>%)
[API名称]   - 数据解析: <毫秒>ms (<百分比>%)
[API名称] ════════════════════════════════════
```

### 性能指标

| 阶段 | 理想值 | 警告阈值 | 错误阈值 |
|------|--------|---------|---------|
| 请求准备 | < 1ms | > 5ms | > 10ms |
| 网络请求 | < 100ms | > 500ms | > 1000ms |
| 数据解析 | < 10ms | > 50ms | > 100ms |
| **总耗时** | **< 150ms** | **> 600ms** | **> 1200ms** |

---

## 快速监控启用

### 在页面中使用

```typescript
// 1. 导入API
import { ShortTermMemoryApi } from '../services/memoryApi';

// 2. 获取API实例
const api = ShortTermMemoryApi.getInstance();

// 3. 调用接口（自动输出监控日志）
const memories = await api.getMemories({ limit: 10 });
// 控制台会自动输出详细的性能监控日志
```

### 在Dashboard中使用

```typescript
// Dashboard页面会自动进行5秒轮询
// 每次轮询都会输出完整的监控日志

useEffect(() => {
  const api = ShortTermMemoryApi.getInstance();

  // 启动5秒轮询，自动输出监控日志
  api.startSync((memories) => {
    console.log(`收到${memories.length}条记忆`);
  });

  return () => api.stopSync();
}, []);
```

---

## 日志分析脚本

### 提取性能数据

```javascript
// 从控制台日志中提取性能数据
const logs = `
[短期记忆API] 阶段2(网络请求)耗时: 45.23ms
[短期记忆API] ✓ 总耗时: 46.24ms
`;

const networkMatch = logs.match(/阶段2\(网络请求\)耗时: ([\d.]+)ms/);
const totalMatch = logs.match(/✓ 总耗时: ([\d.]+)ms/);

if (networkMatch && totalMatch) {
  const networkTime = parseFloat(networkMatch[1]);
  const totalTime = parseFloat(totalMatch[1]);
  const networkPercentage = (networkTime / totalTime * 100).toFixed(1);

  console.log(`网络请求占比: ${networkPercentage}%`);
}
```

### 性能趋势分析

```javascript
// 收集多次请求的性能数据
const performanceData = [];

function collectPerformance(logs) {
  const match = logs.match(/✓ 总耗时: ([\d.]+)ms/);
  if (match) {
    performanceData.push({
      timestamp: new Date(),
      duration: parseFloat(match[1])
    });
  }
}

// 计算平均耗时
const avgDuration = performanceData.reduce((sum, item) => 
  sum + item.duration, 0) / performanceData.length;

console.log(`平均请求耗时: ${avgDuration.toFixed(2)}ms`);
```

---

## 常见问题排查

### Q1: 日志没有输出？

**检查项**:
1. 确认控制台已打开（F12）
2. 检查日志级别是否被过滤
3. 确认API实例是否正确初始化

### Q2: 网络请求耗时过长？

**排查步骤**:
1. 检查网络连接状态
2. 验证后端服务响应时间
3. 检查请求参数是否合理
4. 考虑添加请求缓存

### Q3: 数据解析耗时过长？

**优化建议**:
1. 减少返回数据量（使用limit参数）
2. 后端优化数据结构
3. 前端增加数据过滤

---

## 监控数据可视化

### 推荐图表类型

1. **折线图**: 展示耗时趋势
2. **柱状图**: 对比各阶段耗时
3. **饼图**: 显示各阶段占比
4. **仪表盘**: 实时性能监控

### 集成示例（Chart.js）

```typescript
import { Chart } from 'chart.js';

// 创建性能监控图表
const ctx = document.getElementById('performanceChart');
new Chart(ctx, {
  type: 'bar',
  data: {
    labels: ['请求准备', '网络请求', '数据解析'],
    datasets: [{
      label: '耗时(ms)',
      data: [phase1Duration, phase2Duration, phase3Duration],
      backgroundColor: ['#36A2EB', '#FF6384', '#FFCE56']
    }]
  }
});
```

---

## 相关文档

- [Dashboard网络监控报告](file:///c:/MsSafeData/Desktop/yijiandaodi/docs/DASHBOARD_NETWORK_MONITORING_REPORT.md)
- [ShortTermMemoryApi监控同步报告](file:///c:/MsSafeData/Desktop/yijiandaodi/docs/SHORT_TERM_MEMORY_API_MONITORING_SYNC_REPORT.md)
- [测试脚本](file:///c:/MsSafeData/Desktop/yijiandaodi/desktop-client-2.0/test_all_short_term_memory_apis.js)

---

## 更新日志

| 日期 | 内容 | 状态 |
|------|------|------|
| 2026-08-10 | ShortTermMemoryApi全部接口监控完成 | ✅ 完成 |
| 2026-08-10 | Dashboard轮询监控增强 | ✅ 完成 |
| 待定 | LongTermMemoryApi监控实施 | ⏳ 计划中 |
| 待定 | StrategicMemoryApi监控实施 | ⏳ 计划中 |