# 日志系统测试指南

## 📁 测试文件列表

已为你创建5个测试文件，用于验证日志系统是否正常工作：

### 1. `test-malicious-sql.js`
**包含风险**: SQL注入
- `SELECT * FROM users WHERE id='1' OR '1'='1'`
- `admin'; DROP TABLE users; --`
- `UNION SELECT username, password FROM users--`

**预期日志输出**:
```
[监控回调] 触发检测 - source: 文件 test-malicious-sql.js
[监控回调] 风险详情 - risks: [{ type: 'sqli', ... }]
[主动监控] 行为解析完成 - riskLevel: high
[主动监控] 风险评估完成 - overallScore: 80+
[风险提示] 触发 - riskLevel: high
[桌宠状态] 更新 - newState: red
```

---

### 2. `test-malicious-xss.html`
**包含风险**: XSS攻击
- `<script>alert('XSS')</script>`
- `<img src='x' onerror='alert("XSS")'>`
- `<svg onload='alert("XSS")'>`

**预期日志输出**:
```
[监控回调] 触发检测 - source: 文件 test-malicious-xss.html
[监控回调] 风险详情 - risks: [{ type: 'xss', ... }]
[主动监控] 行为解析完成 - riskLevel: high
[主动监控] 风险评估完成 - overallScore: 75+
[风险提示] 触发 - riskLevel: high
[桌宠状态] 更新 - newState: red
```

---

### 3. `test-malicious-apikeys.txt`
**包含风险**: API Key和敏感信息泄露
- OpenAI API Key: `sk-proj-...`
- GitHub Token: `ghp_...`
- AWS Access Key: `AKIAI...`
- 密码和私钥

**预期日志输出**:
```
[监控回调] 触发检测 - source: 文件 test-malicious-apikeys.txt
[监控回调] 风险详情 - risks: [{ type: 'apikey', ... }]
[主动监控] 行为解析完成 - riskLevel: high
[主动监控] 风险评估完成 - overallScore: 85+
[风险提示] 触发 - riskLevel: high
[桌宠状态] 更新 - newState: red
```

---

### 4. `test-malicious-exec.js`
**包含风险**: 危险代码执行
- `eval(userInput)`
- `exec(userInput)`
- `os.system()`
- `subprocess.call()`

**预期日志输出**:
```
[监控回调] 触发检测 - source: 文件 test-malicious-exec.js
[监控回调] 风险详情 - risks: [{ type: 'code_injection', ... }]
[主动监控] 行为解析完成 - riskLevel: high
[主动监控] 风险评估完成 - overallScore: 90+
[风险提示] 触发 - riskLevel: high
[桌宠状态] 更新 - newState: red
```

---

### 5. `test-malicious-combined.sh`
**包含风险**: 综合攻击（SQL注入 + XSS + API Key + 危险代码）
- 包含所有上述风险类型
- 最全面的测试文件

**预期日志输出**:
```
[监控回调] 触发检测 - source: 文件 test-malicious-combined.sh
[监控回调] 风险详情 - risks: [多个风险]
[主动监控] 行为解析完成 - riskLevel: critical
[主动监控] 风险评估完成 - overallScore: 95+
[风险提示] 触发 - riskLevel: critical
[桌宠状态] 更新 - newState: red
```

---

## 🧪 测试步骤

### 步骤1: 启动应用
```bash
cd c:\MsSafeData\Desktop\yijiandaodi\desktop-client-2.0
npm run electron:dev
```

### 步骤2: 观察初始状态
- 桌宠应该是 🟢 绿色（正常状态）
- 控制台应该输出：`[系统] ✅ 性能监控已启动`

### 步骤3: 测试单个文件
打开任意测试文件：
```bash
# 例如：打开SQL注入测试文件
notepad test-malicious-sql.js
```

**观察控制台**，应该看到：
```
[监控回调] 触发检测
[监控回调] 风险详情
[主动监控] 开始解析行为
[主动监控] 行为解析完成
[主动监控] 风险评估完成
[主动监控] 告警处理完成
[风险提示] 触发
[风险提示] 智能提示器结果
[桌宠状态] 更新
```

**观察桌宠**：
- 颜色应该从 🟢 绿色变为 🔴 红色
- 可能会出现气泡提示

### 步骤4: 测试剪贴板
复制测试文件中的内容到剪贴板：
```bash
# 复制SQL注入payload
echo "SELECT * FROM users WHERE id='1' OR '1'='1'" | clip
```

**观察控制台**，应该看到：
```
[监控回调] 触发检测 - source: 剪贴板
[主动监控] 开始解析行为 - source: 剪贴板
[主动监控] 行为解析完成 - riskLevel: high
```

**观察桌宠**：
- 颜色应该变为 🟡 黄色或 🔴 红色

### 步骤5: 测试综合文件
打开 `test-malicious-combined.sh`：
```bash
notepad test-malicious-combined.sh
```

**观察控制台**，应该看到多次触发：
```
[监控回调] 触发检测（第1次）
[监控回调] 触发检测（第2次）
...
[主动监控] 行为解析完成（多次）
[主动监控] 风险评估完成 - overallScore: 95+
```

**观察桌宠**：
- 颜色应该为 🔴 红色
- 应该显示"严重安全风险"提示

---

## ✅ 验证清单

### 文件监控验证
- [ ] 打开测试文件时，控制台输出 `[监控回调] 触发检测`
- [ ] 日志中显示 `source: 文件 xxx`
- [ ] 日志中显示风险详情（type, matched等）
- [ ] 桌宠状态从绿色变为红色或黄色

### 剪贴板监控验证
- [ ] 复制恶意内容时，控制台输出 `[监控回调] 触发检测`
- [ ] 日志中显示 `source: 剪贴板`
- [ ] 桌宠状态变化

### 主动监控验证
- [ ] 日志中显示 `[主动监控] 开始解析行为`
- [ ] 日志中显示 `[主动监控] 行为解析完成`（包含agentType、action、riskScore）
- [ ] 日志中显示 `[主动监控] 风险评估完成`（包含overallScore、riskLevel、shouldAlert）

### 告警验证
- [ ] 日志中显示 `[风险提示] 触发`
- [ ] 日志中显示 `[风险提示] 智能提示器结果`（shouldNotify、shouldUpdatePet）
- [ ] 高风险时显示 `[风险提示] 系统通知已发送`
- [ ] 桌宠状态更新日志：`[桌宠状态] 更新`

---

## 🔍 问题排查

### 如果日志没有输出

**可能原因1**: 监控服务未启动
```bash
# 检查是否有以下日志
[系统] ✅ 性能监控已启动
[一鉴到底] 所有监控服务已启动
```

**可能原因2**: 文件不在监控范围内
- 确保文件在桌面或文档目录
- 或者修改 `fileMonitor.ts` 增加监控路径

**可能原因3**: 日志级别过滤
- 检查日志配置，确保所有级别的日志都输出

### 如果桌宠状态没变化

**可能原因1**: 风险分数低于阈值
- 检查日志中的 `overallScore`
- 如果低于70，可能不会触发告警

**可能原因2**: 频率控制生效
- 检查日志中的 `shouldNotify`
- 如果短时间内多次触发，可能被频率控制拦截

---

## 📊 预期结果总结

### 正常工作的表现

1. **控制台输出**: 看到完整的日志链路
   - 触发检测 → 风险详情 → 行为解析 → 风险评估 → 告警处理 → 状态更新

2. **桌宠状态**: 
   - 打开恶意文件：🟢 → 🔴
   - 复制恶意内容：🟢 → 🟡 或 🔴

3. **系统通知**: 
   - 高风险文件打开时，应该看到系统通知

4. **日志文件**: 
   - 日志被正确保存到 `~/.yijiandaodi/logs/`

---

## 🎯 下一步

测试完成后，如果一切正常：
- ✅ 日志系统工作正常
- ✅ 主动监控已集成
- ✅ 告警机制有效
- ✅ 桌宠状态正确反映风险

如果发现问题：
- 🔍 检查具体的日志输出
- 🐛 对比预期日志和实际日志
- 📝 记录问题并反馈

---

**测试文件已准备好，可以开始测试了！** 🧪