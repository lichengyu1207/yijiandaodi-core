# 🚀 一鉴到底 - AI Agent 安全检测平台

<div align="center">

![版本](https://img.shields.io/badge/版本-v2.1.0-blue)
![状态](https://img.shields.io/badge/状态-活跃开发中-green)
![开源](https://img.shields.io/badge/开源-MIT-orange)
![平台](https://img.shields.io/badge/平台-Windows%20%7C%20Web%20%7C%20硬件-purple)

**让 AI 应用更安全、更可靠**

[快速开始](#-快速开始) · [功能特性](#-功能特性) · [技术架构](#-技术架构) · [文档](#-文档)

</div>

---

## 📖 项目简介

**一鉴到底** 是一个基于多智能体协同的 AI 安全检测平台，提供内容安全检测、代码沙箱执行、合规审计等核心功能。

### 🎯 核心定位
- **AI Agent 安全检测**: 实时检测 AI 应用的安全风险
- **多智能体协同**: 基于 DAG 的工作流编排，支持分片计算
- **硬件生态集成**: ESP32 指示灯、桌宠交互等硬件扩展
- **开放开源**: 核心安全库和多智能体框架完全开源

---

## ✨ 功能特性

### 🔒 核心安全功能
- **内容安全检测**: XSS/HTML 标签清理、敏感词检测、内容分级
- **代码沙箱执行**: 支持 Python/JS/TS/Bash/HTML 多语言沙箱
- **ASS 签名验证**: 防篡改验证、签名生成与验签
- **合规审计日志**: 哈希链审计、完整日志追溯

### 🤖 多智能体协同
- **DAG 工作流编排**: 可视化任务编排，支持复杂依赖关系
- **P2P 网络通信**: 节点发现、心跳管理、任务分发
- **分片计算**: 大任务自动分片，多节点并行执行
- **结果聚合**: 自动合并分片结果，共识机制保障一致性

### 🖥️ 多端支持
- **Web 平台**: 响应式设计，支持移动端访问
- **桌面客户端**: Electron 打包，Windows/macOS/Linux 支持
- **硬件扩展**: ESP32 RGB 指示灯、桌宠交互

### 🐾 桌宠系统
- **实时交互**: 桌面宠物与用户实时互动
- **状态展示**: 安全检测结果可视化
- **硬件联动**: 与 ESP32 指示灯状态同步

---

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────┐
│                   前端层 (Frontend)                  │
│  React + TypeScript + Vite + Ant Design + Electron  │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│                  网关层 (Gateway)                    │
│      API Gateway + Rate Limiting + Auth Guard       │
└─────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│                 应用层 (Application)                 │
│   Django REST Framework + ViewSets + Serializers    │
└─────────────────────────────────────────────────────┘
                          ↓
┌──────────────────┬──────────────────┬───────────────┐
│   数据层(Data)    │  中间件(Middleware) │  安全层(Sec)  │
│   PostgreSQL     │   Redis + Celery   │  ASS + Hash  │
│   SQLite(开发)    │   RabbitMQ        │  Chain Audit │
└──────────────────┴──────────────────┴───────────────┘
                          ↓
┌─────────────────────────────────────────────────────┐
│                基础设施 (Infrastructure)             │
│      Docker + Nginx + PM2 + Systemd + 宝塔面板      │
└─────────────────────────────────────────────────────┘
```

---

## 🚀 快速开始

### 前置要求
- Node.js >= 18.0.0
- Python >= 3.10
- PostgreSQL >= 13（生产环境）
- SQLite（开发环境）

### 1. 克隆项目
```bash
git clone https://github.com/your-username/yijiandaodi.git
cd yijiandaodi
```

### 2. 后端安装
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

### 3. 前端安装
```bash
cd frontend
npm install
npm run dev
```

### 4. 桌面端启动
```bash
cd desktop-client-2.0
npm install
npm run dev
```

### 5. ESP32 硬件（可选）
```bash
# 使用 PlatformIO IDE 打开项目
cd esp32_rgb_controller
# 修改 src/main.cpp 中的 Wi-Fi 配置
# 上传到 ESP32-S3 开发板
```

---

## 📦 开源组件

### NPM 包
```bash
# 多智能体协同框架
npm install @yijiandaodi/multi-agent-framework

# 核心安全库
npm install @yijiandaodi/core-security
```

### 核心功能
- **DAG 工作流编排**: `dag-orchestrator` skill
- **节点发现服务**: `node-discovery` skill
- **P2P 任务调度**: `p2p-scheduler` skill
- **沙箱执行引擎**: `sandbox-executor` skill
- **安全网关**: `ass-gateway` skill
- **内容审核**: `content-moderator` skill

---

## 📚 文档

- [部署架构文档](docs/DEPLOYMENT_ARCHITECTURE.md)
- [数据同步计划](docs/DATA_SYNCHRONIZATION_PLAN.md)
- [桌宠集成指南](docs/PET_INTEGRATION_REPORT.md)
- [桌面端测试计划](docs/DESKTOP_TEST_PLAN.md)
- [ESP32 快速开始](esp32_rgb_controller/QUICK_START.md)

---

## 🛠️ 开发进展

### 最新版本: v2.1.0 (2026-07-31)

#### ✅ 已完成
- 前端移动端适配优化
- 桌面端下载系统完善
- ESP32 RGB 指示灯集成
- 多智能体框架开源
- 核心安全库开源
- 网站↔桌面端数据同步

#### ⚠️ 进行中
- 生产环境数据库迁移（SQLite → PostgreSQL）
- 记忆系统重构
- 内容策略优化

#### 📝 详细日志
查看 [CHANGELOG.md](CHANGELOG.md) 了解每日开发进展

---

## 🤝 贡献指南

欢迎社区贡献！请查看以下指南：

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 提交 Pull Request

### 开源组件贡献
- **多智能体框架**: 提交到 `multi-agent-framework` 分支
- **核心安全库**: 提交到 `core-security` 分支

---

## 📊 项目状态

- **活跃开发中** 🚀
- **每日更新**: 开发日志每日更新
- **社区支持**: GitHub Discussions
- **技术栈成熟**: Django + React + Electron + ESP32

---

## 📞 联系方式

- **技术支持**: lichengyu@fangsuanyun.cn
- **官方网站**: [yijiandaodi.com](https://yijiandaodi.com)
- **GitHub**: [github.com/your-username/yijiandaodi](https://github.com/your-username/yijiandaodi)

---

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

---

<div align="center">

**如果这个项目对你有帮助，请给一个 ⭐ Star！**

Made with ❤️ by 一鉴到底团队

</div>