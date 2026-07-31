# 快速测试指南

**生成时间**: 2026-08-01

---

## 🚀 快速开始

### 1. 启动应用
```powershell
cd c:\MsSafeData\Desktop\yijiandaodi\desktop-client-2.0
npm run electron:dev
```

### 2. 查看测试文件
测试文件已生成在：
```
C:\MsSafeData\Desktop\yijiandaodi\desktop-client-2.0\test-detection-files\
```

包含以下测试文件：
- `test-sqli.txt` - SQL注入检测（6个用例）
- `test-xss.txt` - XSS攻击检测（5个用例）
- `test-apikey.txt` - API Key检测（5个用例）
- `test-sensitive.txt` - 敏感信息检测（5个用例）
- `test-dangerous_code.txt` - 危险代码检测（5个用例）
- `test-mixed.txt` - 混合风险检测（3个用例）

剪贴板测试文件：
- `clipboard-sqli.txt`
- `clipboard-apikey.txt`
- `clipboard-password.txt`

---

## 🧪 测试方法

### 方法1: 文件监控测试
```
1. 用任意编辑器打开测试文件
2. 保存到桌面或文档目录
3. 观察应用反应
```

### 方法2: 剪贴板测试
```
1. 打开剪贴板测试文件
2. 复制内容（Ctrl+C）
3. 等待 500ms
4. 观察应用反应
```

---

## 🔍 观察要点

### 1. 桌宠状态
```
🟢 绿色 = 正常，无风险
🟡 黄色 = 检测到中风险
🔴 红色 = 检测到高风险
```

### 2. 控制台日志
```
[文件监控] 开始自动检测: xxx.txt
[文件监控] 检测结果: { safe: false, risk_level: 'high', ... }
[文件] 发现安全风险: { total: 6, high: 4, medium: 2, ... }
```

### 3. 系统通知
```
仅高风险才会发送系统通知：
⚠️ 安全警告
发现high风险: 文件 xxx.txt 中发现6个安全风险...
```

### 4. 审计记录
```
打开主窗口 → 实时审计页面
查看所有检测记录
```

---

## 📊 预期结果

| 测试文件 | 预期检测项 | 预期风险等级 |
|---------|-----------|-------------|
| test-sqli.txt | SQL注入Payload | high |
| test-xss.txt | XSS攻击Payload | high |
| test-apikey.txt | API Key模式 | high |
| test-sensitive.txt | 敏感关键词 | medium |
| test-dangerous_code.txt | 危险代码模式 | high |
| test-mixed.txt | 多种风险 | high |

---

## 🐛 故障排查

### 问题1: 桌宠不显示
```
检查：是否启动成功？
控制台应该输出：[系统] ✅ 桌宠窗口创建成功
```

### 问题2: 文件监控不工作
```
检查：文件是否保存到监控目录？
默认监控：Documents 和 Desktop 目录
```

### 问题3: 剪贴板监控不工作
```
检查：是否真正复制到剪贴板？
等待时间：500ms
```

### 问题4: 没有通知
```
检查：是否是高风险？
仅 critical/high 才会发送系统通知
中低风险仅更新桌宠状态
```

---

## 🧹 清理测试文件

测试完成后，可以删除测试文件：
```powershell
node test-detection.js --clean
```

或手动删除：
```
删除目录：test-detection-files\
```

---

## 📝 测试记录

请在测试后记录结果：

```markdown
## 测试结果

**测试时间**: 2026-08-01
**测试环境**: Windows 11, Node.js 18.x

### 通过的测试
- [x] SQL注入检测
- [x] API Key检测
- [x] XSS攻击检测
- [x] 敏感信息检测
- [x] 危险代码检测
- [x] 混合风险检测

### 准确率
- SQL注入: 6/6 (100%)
- API Key: 5/5 (100%)
- XSS: 5/5 (100%)
- 敏感信息: 5/5 (100%)
- 危险代码: 5/5 (100%)

### 用户体验
- 提示频率: 合理，不烦人
- 桌宠状态: 清晰直观
- 系统通知: 仅高风险，恰到好处
```

---

## 📞 获取帮助

如果遇到问题，请查看：
1. [TEST_PLAN.md](./TEST_PLAN.md) - 完整测试方案
2. [DETECTION_REALITY_CHECK.md](./DETECTION_REALITY_CHECK.md) - 检测能力说明
3. [AUTO_DETECTOR_GUIDE.md](./AUTO_DETECTOR_GUIDE.md) - 使用指南

---

**祝测试顺利！** 🎉