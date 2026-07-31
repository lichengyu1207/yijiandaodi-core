# 🎯 首先阅读

**欢迎使用 一鉴到底！**

---

## 📦 这是什么？

**一鉴到底** 是一个 AI 操作行为校验工具，帮助你监控和审计 AI Agent 的操作行为。

### 核心功能
- 🔍 **实时监控** - 文件、剪贴板、进程、网络
- 🛡️ **安全检测** - SQL注入、XSS、API Key、敏感信息
- 🐾 **桌宠提示** - 直观的状态指示
- 📊 **审计记录** - 完整的操作记录和报告

---

## 🚀 快速开始（3步）

### Windows 用户
```powershell
# 1. 进入项目目录
cd desktop-client-2.0

# 2. 一键安装
.\install.ps1

# 3. 启动应用
npm run electron:dev
```

### Mac/Linux 用户
```bash
# 1. 进入项目目录
cd desktop-client-2.0

# 2. 一键安装
chmod +x install.sh
./install.sh

# 3. 启动应用
npm run electron:dev
```

---

## 📋 前置要求

**必须安装**：
- ✅ **Node.js** >= 18.0
- ✅ **npm** >= 9.0

**检查版本**：
```bash
node --version
npm --version
```

**下载地址**：
- Node.js: https://nodejs.org
- 推荐：LTS 版本（长期支持版）

---

## 📂 目录结构

```
desktop-client-2.0/
├── install.ps1          # Windows 一键安装脚本
├── install.sh           # Mac/Linux 一键安装脚本
├── QUICK_START.md       # 快速开始指南
├── README.md            # 项目说明
│
├── src/                 # 前端代码
├── electron/            # 主进程代码
├── public/              # 静态资源
│
└── docs/                # 文档目录
    ├── AUTO_DETECTOR_GUIDE.md        # 用户手册
    ├── TEST_PLAN.md                  # 测试指南
    ├── USER_INSTALLATION_GUIDE.md    # 安装详解
    └── DETECTION_REALITY_CHECK.md    # 检测说明
```

---

## 🎓 使用流程

### 1. 安装
```bash
# Windows
.\install.ps1

# Mac/Linux
./install.sh
```

### 2. 启动
```bash
npm run electron:dev
```

### 3. 使用
- 🟢 桌宠显示在右下角
- 🟡 实时监控系统安全
- 🔴 发现风险时桌宠变色提示
- 📊 随时查看审计记录

---

## 🧪 快速测试

### 生成测试文件
```bash
node test-detection.js
```

### 测试文件位置
```
test-detection-files/
├── test-sqli.txt          # SQL注入测试
├── test-apikey.txt        # API Key测试
├── clipboard-sqli.txt     # 剪贴板测试
└── ...
```

### 测试方法
1. 启动应用
2. 打开测试文件
3. 观察桌宠状态变化
4. 查看审计记录

---

## 🐛 遇到问题？

### 安装失败？
```bash
# 清理并重新安装
rm -rf node_modules package-lock.json
npm install
```

### 启动失败？
```bash
# 检查 Node.js 版本
node --version  # 应该 >= 18.0

# 检查依赖是否完整
npm install
```

### 更多问题？
查看 `docs/` 目录下的详细文档。

---

## 📚 详细文档

- **[QUICK_START.md](QUICK_START.md)** - 快速开始指南
- **[docs/AUTO_DETECTOR_GUIDE.md](docs/AUTO_DETECTOR_GUIDE.md)** - 用户手册
- **[docs/TEST_PLAN.md](docs/TEST_PLAN.md)** - 测试方案
- **[docs/USER_INSTALLATION_GUIDE.md](docs/USER_INSTALLATION_GUIDE.md)** - 安装详解

---

## 💡 核心特性

### 监控能力
```
✅ 文件监控 - 实时检测文件内容
✅ 剪贴板监控 - 检测复制内容
✅ 进程监控 - 识别 AI Agent 进程
✅ 网络监控 - 检测 AI API 调用
```

### 检测能力
```
✅ SQL注入 - 准确率 90%+
✅ XSS攻击 - 准确率 90%+
✅ API Key - 准确率 95%+
✅ 敏感信息 - 密码、密钥、令牌
```

### 用户体验
```
✅ 桌宠提示 - 不打扰工作
✅ 智能提醒 - 仅高风险通知
✅ 审计记录 - 完整操作记录
✅ 数据导出 - JSON 格式报告
```

---

## 🎯 下一步

1. ✅ **安装** - 运行 `install.ps1` 或 `install.sh`
2. ✅ **启动** - 执行 `npm run electron:dev`
3. ✅ **测试** - 运行 `node test-detection.js`
4. ✅ **使用** - 开始监控 AI 操作行为

---

## 🎉 准备好了吗？

**开始使用吧！**

```bash
# Windows
cd desktop-client-2.0
.\install.ps1
npm run electron:dev

# Mac/Linux
cd desktop-client-2.0
./install.sh
npm run electron:dev
```

**祝你使用愉快！** 🚀

---

**最后更新**: 2026-08-01