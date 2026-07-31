# 快速开始指南

**一鉴到底** - AI 操作行为校验工具

---

## 📋 系统要求

- **Node.js**: >= 18.0
- **npm**: >= 9.0
- **操作系统**: Windows 10/11, macOS 10.14+, Ubuntu 18.04+

---

## 🚀 快速安装

### Windows 用户

**方式1: 一键安装**
```powershell
# 双击运行 install.ps1
# 或在 PowerShell 中执行：
.\install.ps1
```

**方式2: 手动安装**
```powershell
# 1. 安装依赖
npm install

# 2. 构建项目
npm run build

# 3. 启动应用
npm run electron:dev
```

---

### Mac/Linux 用户

**方式1: 一键安装**
```bash
# 添加执行权限
chmod +x install.sh

# 运行安装脚本
./install.sh
```

**方式2: 手动安装**
```bash
# 1. 安装依赖
npm install

# 2. 构建项目
npm run build

# 3. 启动应用
npm run electron:dev
```

---

## 🎯 启动应用

### 开发模式
```bash
npm run electron:dev
```

**预期效果**：
- 主窗口打开，显示登录页面
- 桌宠出现在右下角
- 系统托盘图标出现

---

## 🧪 测试功能

### 快速测试
```bash
# 生成测试文件
node test-detection.js

# 测试文件位置
# test-detection-files/
```

### 测试步骤
1. 启动应用
2. 打开测试文件
3. 观察桌宠状态变化
4. 查看审计记录

---

## 📦 打包应用

### Windows
```powershell
npm run electron:build:win
```

### Mac
```bash
npm run electron:build:mac
```

### Linux
```bash
npm run electron:build:linux
```

---

## 🐛 常见问题

### Q1: npm install 报错？

**解决方法**：
```powershell
# 清理缓存
npm cache clean --force

# 删除依赖重新安装
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
```

---

### Q2: Node.js 版本不满足？

**检查版本**：
```powershell
node --version  # 应该 >= 18.0
```

**安装新版本**：
- 下载：https://nodejs.org
- 推荐：LTS 版本（长期支持版）

---

### Q3: 构建失败？

**检查 TypeScript 错误**：
```powershell
npx tsc --noEmit
```

**查看详细错误**：
```powershell
npm run build -- --debug
```

---

### Q4: 应用启动失败？

**检查日志**：
```powershell
# Windows
%APPDATA%\yijiandaodi-desktop\logs\

# Mac/Linux
~/.config/yijiandaodi-desktop/logs/
```

---

## 📚 更多文档

- **用户手册**: `docs/AUTO_DETECTOR_GUIDE.md`
- **测试指南**: `docs/TEST_PLAN.md`
- **安装详解**: `docs/USER_INSTALLATION_GUIDE.md`
- **检测说明**: `docs/DETECTION_REALITY_CHECK.md`

---

## 💡 功能说明

### 核心功能
- ✅ **文件监控** - 实时检测文件内容风险
- ✅ **剪贴板监控** - 检测剪贴板敏感信息
- ✅ **进程监控** - 识别 AI Agent 进程
- ✅ **网络监控** - 检测 AI API 调用

### 检测能力
- ✅ **SQL 注入** - 准确率 90%+
- ✅ **XSS 攻击** - 准确率 90%+
- ✅ **API Key** - 准确率 95%+
- ✅ **敏感信息** - 密码、密钥、令牌

### 用户体验
- ✅ **桌宠提示** - 三态指示（绿/黄/红）
- ✅ **智能提醒** - 不打扰工作流
- ✅ **审计记录** - 完整操作记录
- ✅ **数据导出** - JSON 格式报告

---

## 🎓 使用技巧

### 1. 桌宠状态
```
🟢 绿色 = 正常，无风险
🟡 黄色 = 检测到中风险
🔴 红色 = 检测到高风险
```

### 2. 查看审计记录
```
点击桌宠 → 打开主窗口 → 实时审计
```

### 3. 导出报告
```
审计详情页 → 导出报告 (JSON)
```

---

## 📞 获取帮助

### 遇到问题？

1. **查看文档** - 先看 `docs/` 目录下的文档
2. **检查日志** - 查看控制台输出或日志文件
3. **提交 Issue** - GitHub Issues

---

## 🎉 开始使用

现在你已经准备好开始了！

```bash
# 启动应用
npm run electron:dev

# 开始监控
# 桌宠会在右下角显示，实时监控系统安全
```

**祝你使用愉快！** 🚀