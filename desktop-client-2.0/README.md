# 一鉴到底

**AI 操作行为校验工具**

---

## 📖 项目简介

**一鉴到底** 是一款基于 Electron 的桌面应用，专注于 AI Agent 操作行为的安全审计与校验。通过实时监控文件、剪贴板、进程和网络，检测 SQL 注入、XSS 攻击、API Key 泄露等安全风险。

---

## ✨ 核心功能

### 🔍 四维实时监控
- **文件监控** - 检测文件内容中的安全风险
- **剪贴板监控** - 实时检测剪贴板敏感信息
- **进程监控** - 识别 AI Agent 进程（Cursor、VS Code 等）
- **网络监控** - 检测 AI API 调用行为

### 🛡️ 多维度安全检测
- **SQL 注入检测** - 准确率 90%+
- **XSS 攻击检测** - 准确率 90%+
- **API Key 识别** - OpenAI/GitHub/AWS/Google 等
- **敏感信息检测** - 密码、密钥、令牌等
- **危险代码检测** - eval/exec/系统命令等

### 🐾 智能桌宠提示
- 🟢 **绿色** - 正常状态
- 🟡 **黄色** - 检测到中风险
- 🔴 **红色** - 检测到高风险
- 智能提醒，不打扰工作流

### 📊 完整审计系统
- 操作记录持久化存储
- 支持数据导出（JSON 格式）
- 审计哈希防篡改

---

## 🚀 快速开始

### 系统要求
- **Node.js**: >= 18.0
- **npm**: >= 9.0
- **操作系统**: Windows 10/11, macOS 10.14+, Ubuntu 18.04+

### 安装步骤

#### Windows 用户
```powershell
# 方式1: 一键安装
.\install.ps1

# 方式2: 手动安装
npm install
npm run build
npm run electron:dev
```

#### Mac/Linux 用户
```bash
# 方式1: 一键安装
chmod +x install.sh
./install.sh

# 方式2: 手动安装
npm install
npm run build
npm run electron:dev
```

---

## 📦 项目结构

```
desktop-client-2.0/
├── electron/                 # 主进程代码
│   ├── main.ts              # 应用入口
│   ├── monitoring/          # 监控模块
│   │   ├── autoDetector.ts  # 自动化检测
│   │   ├── smartAlerter.ts  # 智能提示
│   │   ├── fileMonitor.ts   # 文件监控
│   │   ├── clipboardMonitor.ts # 剪贴板监控
│   │   ├── processMonitor.ts # 进程监控
│   │   └── networkMonitor.ts # 网络监控
│   └── services/            # 业务服务
│
├── src/                     # 前端代码（React）
│   ├── App.tsx              # 主应用
│   ├── pages/               # 页面组件
│   ├── components/          # UI 组件
│   └── services/            # 前端服务
│
├── public/                  # 静态资源
├── docs/                    # 文档目录
├── install.ps1              # Windows 安装脚本
├── install.sh               # Mac/Linux 安装脚本
└── QUICK_START.md           # 快速开始指南
```

---

## 🎯 使用方法

### 1. 启动应用
```bash
npm run electron:dev
```

### 2. 观察桌宠
- 桌宠会在右下角显示
- 根据风险等级改变颜色

### 3. 查看审计记录
- 点击桌宠打开主窗口
- 在"实时审计"页面查看所有记录

### 4. 导出报告
- 在审计详情页点击"导出报告"
- 选择 JSON 格式保存

---

## 🧪 测试功能

### 生成测试文件
```bash
node test-detection.js
```

### 测试内容
- SQL 注入测试（6 个用例）
- XSS 攻击测试（5 个用例）
- API Key 测试（5 个用例）
- 敏感信息测试（5 个用例）
- 危险代码测试（5 个用例）

### 测试方法
1. 启动应用
2. 打开测试文件（`test-detection-files/` 目录）
3. 观察桌宠状态变化
4. 查看审计记录

---

## 📚 详细文档

- **[QUICK_START.md](QUICK_START.md)** - 快速开始指南
- **[README_FIRST.md](README_FIRST.md)** - 首先阅读
- **[docs/AUTO_DETECTOR_GUIDE.md](docs/AUTO_DETECTOR_GUIDE.md)** - 用户手册
- **[docs/TEST_PLAN.md](docs/TEST_PLAN.md)** - 测试方案
- **[docs/SKILL_INTEGRATION_STATUS.md](docs/SKILL_INTEGRATION_STATUS.md)** - Skill 接入说明

---

## 🔧 开发命令

```bash
# 开发模式
npm run dev                 # 前端开发
npm run electron:dev        # Electron + 前端联动

# 构建
npm run build               # 构建前端
npm run electron:build      # 构建主进程

# 打包
npm run electron:build:win  # 打包 Windows 版
npm run electron:build:mac  # 打包 Mac 版
npm run electron:build:linux # 打包 Linux 版
```

---

## 🛠️ 技术栈

| 类别 | 技术 |
|------|------|
| **桌面框架** | Electron 28 |
| **前端框架** | React 18 + TypeScript |
| **构建工具** | Vite 5 |
| **路由** | React Router DOM 6 |
| **状态管理** | Zustand |
| **打包** | electron-builder 24 |

---

## ⚠️ 重要说明

### 无需额外依赖

**本项目所有功能均为自研实现，无需安装额外的 skill 环境或依赖。**

```
✅ SQL 注入检测 - 自研实现
✅ XSS 攻击检测 - 自研实现
✅ API Key 识别 - 自研实现
✅ 敏感信息检测 - 自研实现
✅ 危险代码检测 - 自研实现
```

用户只需：
```bash
npm install
npm run electron:dev
```

---

## 🐛 常见问题

### Q: npm install 报错？
```bash
# 清理缓存
npm cache clean --force

# 删除依赖重新安装
rm -rf node_modules package-lock.json
npm install
```

### Q: Node.js 版本不满足？
- 下载：https://nodejs.org
- 推荐：LTS 版本（长期支持版）

### Q: 应用启动失败？
- 检查 Node.js 版本：`node --version`（应该 >= 18.0）
- 查看控制台错误日志
- 参考：[QUICK_START.md](QUICK_START.md)

---

## 📝 更新日志

### v2.0 (2026-08-01)

#### 新增功能
- ✅ 自动化检测引擎（autoDetector）
- ✅ 智能提示系统（smartAlerter）
- ✅ 桌宠状态指示器
- ✅ 审计记录系统
- ✅ 数据导出功能

#### 检测能力
- ✅ SQL 注入检测（准确率 90%+）
- ✅ XSS 攻击检测（准确率 90%+）
- ✅ API Key 识别（准确率 95%+）
- ✅ 敏感信息检测
- ✅ 危险代码检测

#### 用户体验
- ✅ 静默监控，不打扰工作
- ✅ 智能提示，仅高风险通知
- ✅ 完整审计记录
- ✅ 一键安装脚本

---

## 📄 许可证

本项目仅供学习和研究使用。

---

## 🙏 致谢

感谢所有为 AI 安全领域做出贡献的开发者和研究人员。

---

**最后更新**: 2026-08-01
**版本**: 2.0