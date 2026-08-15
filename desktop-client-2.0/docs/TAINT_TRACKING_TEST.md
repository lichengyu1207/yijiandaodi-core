# 🧪 污点追踪系统测试方案

## 📋 测试目的

验证污点追踪系统是否正确激活并能检测敏感数据传播。

---

## ✅ 测试步骤

### 测试1：文件污点追踪

**步骤**：
1. 创建一个包含敏感信息的文件
2. 观察系统是否创建污点标记
3. 检查日志中的污点ID

**测试数据**：
```
创建文件: test_sensitive.txt
内容: 
password=admin123
api_key=sk-proj-abc123
secret=my-secret-key
```

**预期结果**：
```
[污点激活] 文件污点已创建
  taintId: taint_1234567890_abc
  source: /path/to/test_sensitive.txt
  type: credential
```

---

### 测试2：剪贴板污点传播检测

**步骤**：
1. 先创建包含敏感信息的文件（触发污点）
2. 复制文件内容到剪贴板
3. 观察是否检测到污点传播

**测试数据**：
```
步骤1: 创建 test_api_key.txt
内容: api_key=sk-proj-abcdef123456

步骤2: 复制整个文件内容

步骤3: 观察日志
```

**预期结果**：
```
[污点激活] 检测到污点数据传播！
  taintId: taint_1234567890_abc
  source: /path/to/test_api_key.txt
  
[污点激活] 触发高风险告警
  propagationId: prop_1234567890_def
  riskLevel: high
```

---

### 测试3：高风险告警触发

**步骤**：
1. 创建包含API Key的文件
2. 复制到剪贴板
3. 检查是否触发系统通知

**预期结果**：
- ✅ 桌宠变红灯
- ✅ 系统通知弹出
- ✅ 告警历史记录

---

## 🔍 日志检查

### 成功日志示例

```log
[污点激活] 开始激活污点追踪系统
[污点激活] 文件监控监听器已注册
[污点激活] 剪贴板监控监听器已注册
[污点激活] 污点追踪系统已完全激活

[污点激活] 文件污点已创建
  taintId: taint_1234567890_abc
  source: C:\Users\Test\Documents\secret.txt
  type: credential

[污点激活] 检测到污点数据传播！
  taintId: taint_1234567890_abc
  source: C:\Users\Test\Documents\secret.txt
  type: credential

[污点激活] 触发高风险告警
  propagationId: prop_1234567890_def
  riskLevel: critical
```

### 失败日志示例

```log
[污点激活] 文件监控事件总线未初始化
[污点激活] 剪贴板监控事件总线未初始化
```

**如果看到失败日志，说明**：
- 监控模块未正确启动
- 需要检查 main.ts 中的监控初始化顺序

---

## 🛠️ 故障排查

### 问题1：污点追踪未激活

**症状**：
```
[污点激活] 文件监控事件总线未初始化
```

**解决方案**：
```typescript
// 检查 main.ts 中是否有：
global.fileMonitorEvents = new EventEmitter()
global.clipboardMonitorEvents = new EventEmitter()

// 确保在监控模块启动后激活
```

---

### 问题2：没有创建污点标记

**症状**：
- 日志中没有 "文件污点已创建"

**解决方案**：
```bash
# 检查文件监控是否正常工作
# 创建测试文件
echo "password=test123" > test_sensitive.txt

# 查看日志
# 应该看到文件监控触发
```

---

### 问题3：剪贴板传播未检测

**症状**：
- 复制敏感内容后没有告警

**解决方案**：
```bash
# 1. 确认剪贴板监控已启动
# 日志应该显示: [剪贴板监控] 启动...

# 2. 确认污点已创建
# 日志应该显示: [污点激活] 文件污点已创建

# 3. 测试复制
cat test_sensitive.txt | clip
```

---

## 📊 性能检查

### 内存使用

```bash
# 查看污点数量
# 应该 < 5000
[污点激活] 污点统计
  totalTaints: 50
  totalPropagations: 120
```

### CPU影响

- 污点追踪应该是异步的
- 不应该影响文件监控性能
- 内存占用应该 < 50MB

---

## ✅ 成功标准

1. **日志验证**
   - ✅ 看到激活成功日志
   - ✅ 看到污点创建日志
   - ✅ 看到传播追踪日志

2. **功能验证**
   - ✅ 敏感文件创建触发污点
   - ✅ 复制操作触发传播检测
   - ✅ 高风险操作触发告警

3. **性能验证**
   - ✅ 内存占用正常
   - ✅ CPU占用正常
   - ✅ 不影响系统响应速度

---

## 🎯 下一步

测试成功后：

1. **查看污点流图**
   ```typescript
   // 在代码中调用
   const graph = generateTaintFlowGraph(taintId)
   console.log(graph)
   ```

2. **导出审计数据**
   ```typescript
   const data = exportTaintData()
   // 保存到文件
   fs.writeFileSync('taint_audit.json', JSON.stringify(data))
   ```

3. **集成到Dashboard**
   - 显示活跃污点数量
   - 显示传播路径图
   - 显示高风险传播告警

---

**测试完成后，你的污点追踪系统就正式激活了！** 🎉