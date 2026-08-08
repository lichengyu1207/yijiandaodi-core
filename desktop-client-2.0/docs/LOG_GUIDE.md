# 日志输出详细说明

## 📋 日志分类

### 1. 监控回调日志
```typescript
[监控回调] 触发检测
├─ source: 来源（文件/剪贴板）
├─ riskCount: 风险总数
├─ highRiskCount: 高风险数量
└─ hasDetectionResult: 是否有检测结果

[监控回调] 风险详情
└─ risks: 前5个风险的详细信息
```

### 2. 进程监控日志
```typescript
[进程监控] 检测到进程
├─ processName: 进程名称
├─ pid: 进程ID
└─ command: 命令行（前100字符）
```

### 3. 网络监控日志
```typescript
[网络监控] 检测到请求
├─ domain: 域名
├─ port: 端口
├─ method: 方法
└─ isAIProvider: 是否为AI提供商
```

### 4. 主动监控日志
```typescript
[主动监控] 开始解析行为
├─ source: 来源
├─ contentType: 内容类型
└─ riskLevel: 风险等级

[主动监控] 行为解析完成
├─ agentType: Agent类型
├─ action: 动作类型
├─ riskScore: 风险分数
└─ riskLevel: 风险等级

[主动监控] 风险评估完成
├─ overallScore: 综合分数
├─ riskLevel: 风险等级
├─ shouldAlert: 是否需要告警
└─ recommendations: 建议列表
```

### 5. 风险提示日志
```typescript
[风险提示] 触发
├─ riskLevel: 风险等级
└─ descriptionLength: 描述长度

[风险提示] 智能提示器结果
├─ shouldNotify: 是否需要通知
└─ shouldUpdatePet: 是否需要更新桌宠

[风险提示] 系统通知已发送
└─ title: 通知标题
```

### 6. 桌宠状态日志
```typescript
[桌宠状态] 更新
├─ newState: 新状态（green/yellow/red）
└─ message: 状态消息

[桌宠状态] 窗口状态已更新
└─ state: 当前状态
```

---

## 📊 日志级别

| 级别 | 说明 | 使用场景 |
|------|------|---------|
| **info** | 普通信息 | 正常流程记录 |
| **debug** | 调试信息 | 详细数据记录 |
| **warn** | 警告信息 | 潜在问题 |
| **error** | 错误信息 | 异常情况 |

---

## 🔍 查看日志的方式

### 方式1: 控制台输出
应用启动后，所有日志会输出到控制台。

### 方式2: 日志文件
日志会保存到以下位置：
- Windows: `%USERPROFILE%\.yijiandaodi\logs\`
- macOS: `~/.yijiandaodi/logs/`
- Linux: `~/.yijiandaodi/logs/`

### 方式3: 日志查询API
```typescript
// 查询最近100条日志
const logs = await window.electronAPI.queryLogs({
  level: 'info',
  module: 'ProactiveMonitor',
  limit: 100
})
```

---

## 📝 典型场景的日志流

### 场景1: 文件包含SQL注入

```
1. [监控回调] 触发检测 - 文件 test.txt, riskCount: 3
2. [监控回调] 风险详情 - SQL注入、XSS等
3. [主动监控] 开始解析行为 - source: 文件
4. [主动监控] 行为解析完成 - riskScore: 85
5. [主动监控] 风险评估完成 - overallScore: 88, shouldAlert: true
6. [主动监控] 告警处理完成 - alerted: true
7. [风险提示] 触发 - riskLevel: high
8. [风险提示] 智能提示器结果 - shouldNotify: true
9. [风险提示] 系统通知已发送
10. [桌宠状态] 更新 - newState: red
```

### 场景2: 剪贴板包含API Key

```
1. [监控回调] 触发检测 - 剪贴板, riskCount: 1
2. [主动监控] 开始解析行为 - source: 剪贴板
3. [主动监控] 行为解析完成 - riskScore: 75
4. [主动监控] 风险评估完成 - overallScore: 78, shouldAlert: true
5. [风险提示] 触发 - riskLevel: medium
6. [风险提示] 智能提示器结果 - shouldUpdatePet: true
7. [桌宠状态] 更新 - newState: yellow
```

### 场景3: 检测到AI Agent进程

```
1. [进程监控] 检测到进程 - processName: Cursor.exe
2. [主动监控] 开始解析进程行为
3. [主动监控] 进程行为解析完成 - agentType: cursor
4. [主动监控] 进程风险评估完成 - overallScore: 30
5. [桌宠状态] 更新 - newState: yellow
```

---

## 🛠️ 调试技巧

### 1. 过滤特定模块
```bash
# 只看主动监控日志
grep "[主动监控]" app.log

# 只看错误日志
grep "error" app.log
```

### 2. 查看特定时间段
```bash
# 查看最近1小时的日志
tail -f app.log | grep "$(date +%Y-%m-%d)"
```

### 3. 导出日志
```typescript
// 导出最近1000条日志
await window.electronAPI.exportLogs({
  format: 'json',
  limit: 1000
})
```

---

## ⚠️ 常见问题排查

### 问题1: 监控没有触发
**排查步骤**:
1. 查看 `[监控回调] 触发检测` 是否出现
2. 如果没有，检查监控服务是否启动
3. 查看是否有 `hasDetectionResult: false`

### 问题2: 告警没有发送
**排查步骤**:
1. 查看 `[主动监控] 风险评估完成` 中的 `shouldAlert`
2. 如果为 false，检查风险分数是否低于阈值
3. 查看 `[风险提示] 智能提示器结果` 中的 `shouldNotify`

### 问题3: 桌宠状态没有更新
**排查步骤**:
1. 查看 `[桌宠状态] 更新` 日志
2. 检查是否有错误日志 `[桌宠状态] 更新失败`
3. 查看 `[风险提示] 智能提示器结果` 中的 `shouldUpdatePet`

---

## 📈 性能监控

### 关键指标
```
[主动监控] 行为解析完成
└─ 解析时间: < 5ms (通常)

[主动监控] 风险评估完成
└─ 评估时间: < 10ms (通常)

[风险提示] 系统通知已发送
└─ 通知延迟: < 100ms (通常)
```

### 性能异常检测
如果日志中出现以下情况，可能存在性能问题：
- 解析时间 > 100ms
- 评估时间 > 200ms
- 告警延迟 > 1s

---

## 📞 技术支持

如果遇到问题，请提供以下日志信息：
1. 完整的日志文件
2. 问题发生的时间点
3. 相关的模块名称
4. 预期行为 vs 实际行为

---

**日志输出已完善，方便你快速排查问题！** 🎯