# Dashboard数据同步日志使用指南

## 日志概览

Dashboard集成了详细的数据同步日志，用于排查数据不同步问题。

---

## 一、日志分类

### 1. 初始化日志

**位置**：Dashboard组件加载时

**示例**：
```log
[Dashboard] ========================================
[Dashboard] 初始化短期记忆API
[Dashboard] 时间: 2026-08-10T14:30:00.000Z
[Dashboard] ========================================
```

**用途**：确认API初始化成功

---

### 2. 轮询同步日志

**位置**：每5秒轮询一次

**示例**：
```log
[Dashboard] >>>>>> 轮询同步开始 <<<<<<
[Dashboard] 同步时间: 14:30:05
[Dashboard] 同步数据量: 42
[Dashboard] 前次数据量: 40
[Dashboard] 数据变化: 新增 2 条记录
[Dashboard] 风险分布:
  - 低风险: 20
  - 中风险: 15
  - 高风险: 5
  - 严重: 2
[Dashboard] 同步耗时: 125.34ms
[Dashboard] >>>>>> 轮询同步结束 <<<<<<
```

**用途**：
- 确认同步正常工作
- 监控数据变化
- 分析性能指标

---

### 3. API请求日志

**位置**：ShortTermMemoryApi.getMemories()

**示例**：
```log
[短期记忆API] API请求
[短期记忆API] URL: http://localhost:9092/api/v1/memory/short-term/
[短期记忆API] 参数: 无
[短期记忆API] 响应状态: 200
[短期记忆API] 请求耗时: 85.23ms
[短期记忆API] 解析数据: 42 条
```

**用途**：
- 排查API请求失败
- 分析网络延迟
- 验证数据格式

---

### 4. 组件渲染日志

**位置**：MemoryStatCard组件

**示例**：
```log
[MemoryStatCard] 渲染: 短期记忆 = 42 (default)
[MemoryStatCard]   - 同步状态: 已同步
[MemoryStatCard]   - 上次同步: 5秒前
```

**用途**：
- 确认组件正确渲染
- 验证数据更新
- 排查渲染问题

---

### 5. 图表更新日志

**位置**：RiskDistributionChart组件

**示例**：
```log
[RiskDistributionChart] 图表更新
[RiskDistributionChart] 总数: 42
[RiskDistributionChart] 风险分布:
  - 低风险: 20 (47.6%)
  - 中风险: 15 (35.7%)
  - 高风险: 5 (11.9%)
  - 严重: 2 (4.8%)
```

**用途**：
- 确认图表正确更新
- 验证数据计算
- 排查显示问题

---

## 二、常见问题排查

### 问题1：数据不更新

**排查步骤**：

1. **检查轮询日志**
   ```log
   [Dashboard] >>>>>> 轮询同步开始 <<<<<<
   ```
   - 如果看不到这个日志：轮询未启动
   - 检查API初始化日志

2. **检查API请求日志**
   ```log
   [短期记忆API] API请求
   [短期记忆API] 响应状态: 200
   ```
   - 如果状态码不是200：后端错误
   - 如果看不到请求日志：网络问题

3. **检查渲染日志**
   ```log
   [MemoryStatCard] 渲染: 短期记忆 = 42
   ```
   - 如果数量没变化：数据未更新
   - 如果看不到渲染日志：组件未渲染

---

### 问题2：数据显示错误

**排查步骤**：

1. **检查风险分布日志**
   ```log
   [Dashboard] 风险分布:
     - 低风险: 20
     - 中风险: 15
     - 高风险: 5
     - 严重: 2
   ```
   - 对比总数是否一致
   - 检查百分比计算

2. **检查图表更新日志**
   ```log
   [RiskDistributionChart] 风险分布:
     - 低风险: 20 (47.6%)
   ```
   - 验证百分比计算
   - 对比与Dashboard日志

---

### 问题3：性能问题

**排查步骤**：

1. **检查同步耗时**
   ```log
   [Dashboard] 同步耗时: 125.34ms
   ```
   - 正常：< 200ms
   - 慢：> 500ms

2. **检查请求耗时**
   ```log
   [短期记忆API] 请求耗时: 85.23ms
   ```
   - 正常：< 100ms
   - 慢：> 300ms

3. **检查数据量**
   ```log
   [短期记忆API] 解析数据: 42 条
   ```
   - 正常：< 100条
   - 多：> 500条（考虑分页）

---

## 三、日志分析方法

### 1. 实时监控

**打开浏览器控制台**：
1. 按F12打开开发者工具
2. 切换到Console标签页
3. 观察实时日志输出

**关键指标**：
- 同步间隔：5秒
- 同步耗时：< 200ms
- 请求耗时：< 100ms
- 数据变化：新增/减少

---

### 2. 性能分析

**统计平均耗时**：
```javascript
// 在控制台执行
const logs = [];
// 等待几次同步
// 分析数据
console.log('平均耗时:', logs.reduce((a,b) => a+b, 0) / logs.length);
```

---

### 3. 错误定位

**查看错误日志**：
```log
[短期记忆API] 同步失败
[短期记忆API] 错误: TypeError: Failed to fetch
[短期记忆API] 耗时: 15.23ms
```

**常见错误**：
- `Failed to fetch`：网络问题
- `404 Not Found`：API不存在
- `500 Internal Server Error`：后端错误

---

## 四、日志级别说明

### INFO级别（正常日志）

**示例**：
```log
[Dashboard] 同步时间: 14:30:05
[短期记忆API] API请求
```

**用途**：
- 确认功能正常工作
- 监控性能指标

---

### WARN级别（警告日志）

**示例**：
```log
[Dashboard] 数据变化: 减少 10 条记录（可能过期）
```

**用途**：
- 提示潜在问题
- 需要关注但不影响功能

---

### ERROR级别（错误日志）

**示例**：
```log
[短期记忆API] 同步失败
[短期记忆API] 错误: TypeError: Failed to fetch
```

**用途**：
- 功能异常
- 需要立即处理

---

## 五、日志清理建议

### 开发环境

**建议**：保留所有日志

**原因**：
- 方便调试
- 快速定位问题

---

### 生产环境

**建议**：减少日志输出

**方法**：
```typescript
// 只输出错误日志
if (process.env.NODE_ENV === 'production') {
  // 移除console.log，保留console.error
}
```

---

## 六、日志文件导出

### 导出控制台日志

**步骤**：
1. 右键点击控制台
2. 选择"Save as..."
3. 保存为.log文件

**用途**：
- 离线分析
- 分享给其他开发者

---

## 七、常见场景日志示例

### 场景1：正常同步

```log
[Dashboard] >>>>>> 轮询同步开始 <<<<<<
[Dashboard] 同步时间: 14:30:05
[短期记忆API] API请求
[短期记忆API] URL: http://localhost:9092/api/v1/memory/short-term/
[短期记忆API] 响应状态: 200
[短期记忆API] 请求耗时: 85.23ms
[短期记忆API] 解析数据: 42 条
[短期记忆API] 同步成功
[短期记忆API] 数据量: 42 条
[短期记忆API] 耗时: 125.34ms
[Dashboard] 同步数据量: 42
[Dashboard] 前次数据量: 40
[Dashboard] 数据变化: 新增 2 条记录
[Dashboard] 风险分布:
  - 低风险: 20
  - 中风险: 15
  - 高风险: 5
  - 严重: 2
[Dashboard] 同步耗时: 125.34ms
[MemoryStatCard] 渲染: 短期记忆 = 42
[MemoryStatCard]   - 同步状态: 已同步
[MemoryStatCard]   - 上次同步: 0秒前
[RiskDistributionChart] 图表更新
[RiskDistributionChart] 总数: 42
[Dashboard] >>>>>> 轮询同步结束 <<<<<<
```

---

### 场景2：网络错误

```log
[Dashboard] >>>>>> 轮询同步开始 <<<<<<
[Dashboard] 同步时间: 14:30:10
[短期记忆API] API请求
[短期记忆API] URL: http://localhost:9092/api/v1/memory/short-term/
[短期记忆API] 响应状态: ERR_CONNECTION_REFUSED
[短期记忆API] 同步失败
[短期记忆API] 错误: TypeError: Failed to fetch
[短期记忆API] 耗时: 15.23ms
[Dashboard] >>>>>> 轮询同步结束 <<<<<<
```

**解决方法**：检查后端服务是否启动

---

### 场景3：数据过期

```log
[Dashboard] >>>>>> 轮询同步开始 <<<<<<
[Dashboard] 同步时间: 14:35:00
[Dashboard] 同步数据量: 35
[Dashboard] 前次数据量: 42
[Dashboard] 数据变化: 减少 7 条记录（可能过期）
[Dashboard] 风险分布:
  - 低风险: 18
  - 中风险: 12
  - 高风险: 4
  - 严重: 1
[Dashboard] >>>>>> 轮询同步结束 <<<<<<
```

**说明**：短期记忆自动过期（30分钟）

---

## 八、总结

✅ **日志作用**：
- 快速定位问题
- 监控系统健康
- 分析性能瓶颈

**使用建议**：
- 开发环境：保留所有日志
- 生产环境：只保留错误日志
- 定期检查：每周分析一次日志

**常见问题**：
- 数据不更新：检查轮询日志和API请求日志
- 数据显示错误：检查风险分布日志和图表更新日志
- 性能问题：检查耗时日志

---

**相关文档**：
- [Dashboard集成短期记忆实施总结](file:///c:/MsSafeData/Desktop/yijiandaodi/docs/DASHBOARD_MEMORY_INTEGRATION_SUMMARY.md)
- [海马体记忆系统架构方案](file:///c:/MsSafeData/Desktop/yijiandaodi/docs/HIPPOCAMPUS_ARCHITECTURE.md)