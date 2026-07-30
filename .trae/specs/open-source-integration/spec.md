# 开源技术栈集成规范

## Why
Phase 1 基底座已全部完成（ASS输入/输出巡检、ResultCard统一模板、Agent编排层、免费额度机制），但当前实现多为**自研轻量版本**（如 inputGuard.ts 的正则敏感词、dataMask.ts 的简单正则脱敏）。用户提供了经过筛选的**可直接 npm/pip 引入**的开源项目清单，用于替换或增强现有自研模块，提升检测精度和系统能力。

## What Changes
分 6 大类、20 个开源项目的渐进式集成：

### 类别 A：ASS 安全内核层增强（4项）
| # | 项目 | 替换/增强目标 | 集成方式 |
|---|------|--------------|---------|
| 01 | **Semgrep** | 增强 inputGuard 的静态代码扫描能力 | 后端 pip + AST 规则 |
| 02 | **Trivy** | 增强依赖包漏洞扫描 | 后端 CLI 集成 |
| 08 | **textfilter (NLP-Sensitive-Words)** | 替换 inputGuard 的硬编码敏感词库 | 前端 npm 或后端 pip |
| 09 | **Presidio (Microsoft)** | 替换 dataMask.ts 的简单正则脱敏 | 前端 npm 或后端 pip |

### 类别 B：前端 TF 推理 & WebGPU 层（8项）
| # | 项目 | 用途 | 集成方式 |
|---|------|------|---------|
| 25 | **TensorFlow.js** | 浏览器端 AI 推理引擎 | 前端 npm |
| 26 | **onnxruntime-web** | 跨平台模型推理（备选） | 前端 npm |
| 27 | **webgpu-samples** | WebGPU 能力探测与示例 | 前端参考实现 |
| 28 | **modelscope.js** | 模型即服务 SDK | 前端 npm |
| 29 | **comlink (GoogleChromeLabs)** | Web Worker RPC 通信 | 前端 npm |
| 30 | **localForage** | 替代 localStorage 的离线存储 | 前端 npm |
| 31 | **transformers.js (Xenova)** | 浏览器端 NLP 模型运行 | 前端 npm |
| 32 | **wrtc** | 浏览器端 WebRTC P2P 通信 | 前端 npm |

### 类别 C：代码沙箱 & 隔离执行层（2项）
| # | 项目 | 用途 | 集成方式 |
|---|------|------|---------|
| 36 | **Pyodide** | 浏览器内 Python 运行时 | 前端 CDN/npm |
| 37 | **node-sandbox** | 后端代码隔离执行 | 后端 npm |

### 类别 D：任务编排 & API 层（1项）
| # | 项目 | 用途 | 集成方式 |
|---|------|------|---------|
| 43 | **FastAPI** | 高性能异步 API 网关（可选，补充 Django） | 后端 pip |

### 类别 E：数据库 & 运维工具层（3项）
| # | 项目 | 用途 | 集成方式 |
|---|------|------|---------|
| 48 | **litefs** | SQLite 分布式同步 | Go 二进制（独立部署） |
| 49 | **SQLAlchemy** | ORM 增强（可选） | 后端 pip |
| 50 | **restic** | 增量备份工具 | Go 二进制（独立部署） |

### 类别 F：网页 IDE（5项）⭐ 重点
| # | 项目 | 用途 | 集成方式 |
|---|------|------|---------|
| 01 | **Monaco Editor** | 轻量在线 IDE 核心 | 前端 npm + react-monaco-editor |
| 02 | **CodeMirror 6** | 轻量代码编辑器（备选） | 前端 npm |
| 03 | **Code-Server** | 完整 VS Code 网页版 | Docker 独立部署 |
| 04 | **Open Web IDE** | 轻量云 IDE（参考） | 参考架构 |
| 05 | **react-monaco-editor** | Monaco React 封装 | 前端 npm |

## Impact
- Affected specs: `platform-architecture-full`（本规范的父级规划）
- Affected code:
  - `frontend/src/middleware/inputGuard.ts` → 被 Semgrep + textfilter 增强
  - `frontend/src/utils/dataMask.ts` → 被 Presidio 替换
  - `frontend/src/utils/quotaManager.ts` → 被 localForage 增强
  - 新增：前端 TF 推理模块、Monaco IDE 页面、Web Worker 通信层
- 不影响: 已完成的 ResultCard 迁移、Agent 编排层、官方化文案

---

## ADDED Requirements

### Requirement: ASS 安全内核升级路径
系统 SHALL 支持从自研轻量实现到专业开源引擎的平滑升级：

#### 路径 1: 敏感词检测升级（inputGuard → textfilter/presidio）
- **WHEN** 用户启用「高级安全模式」
- **THEN** 系统优先使用 Presidio NLP 引擎进行实体识别和脱敏，降级使用 textfilter 词库兜底
- **Fallback**: 如果 CDN 加载失败，回退到现有的 dataMask.ts 正则实现

#### 路径 2: 代码安全扫描升级（inputGuard → Semgrep）
- **WHEN** 用户提交代码类内容
- **THEN** 后端调用 Semgrep AST 分析引擎进行深度扫描（SQL注入/XSS/命令注入等）
- **结果格式**: 与现有 InputGuardResult 结构兼容，追加 semgrep-specific 字段

#### 路径 3: 依赖漏洞扫描（新增 → Trivy）
- **WHEN** 用户上传包含 package.json / requirements.txt 的项目文件
- **THEN** 后端调用 Trivy 进行依赖漏洞扫描
- **输出**: CVE 编号 + 严重等级 + 修复建议

### Requirement: 前端 AI 推理引擎集成
系统 SHALL 在浏览器端支持本地模型推理：

#### 场景 A: 文本分类（transformers.js + TensorFlow.js）
- **WHEN** 用户选择「本地执行」模式
- **THEN** 使用 transformers.js 加载预训练模型（如 Xenova/distilbert-base-uncased-finetuned-sst-2-english）在浏览器端进行情感分析/文本分类
- **性能约束**: 首次加载 < 5s（模型缓存后），单次推理 < 500ms

#### 场景 B: P2P 通信层（wrtc + comlink）
- **WHEN** 启用 P2P 分布式模式
- **THEN** 使用 wrtc 建立 WebRTC 连接，使用 comlink 实现 Web Worker 间 RPC 调用
- **数据通道**: 基于 DataChannel 传输分片任务和结果

#### 场景 C: 本地持久化（localForage）
- **WHEN** 存储用户偏好设置、检测结果缓存、离线队列
- **THEN** 使用 localForage（IndexedDB 封装），替代部分 localStorage
- **容量**: 无 5MB 限制，支持二进制存储

### Requirement: Monaco IDE 集成
系统 SHALL 提供基于 Monaco Editor 的在线代码编辑+执行环境：

#### IDE 页面路由: `/ide`
- **布局**: 左侧文件树 + 中央编辑器(多Tab) + 底部终端/输出 + 右侧面板(AI助手)
- **语言支持**: Python / JavaScript / TypeScript / SQL / Markdown / JSON
- **功能**: 语法高亮 + 智能补全 + 错误提示 + 格式化 + 多光标 + 快捷键映射(VS Code)
- **安全**: 编辑器内容经 ASS 输入层巡检后才允许执行
- **执行**: Pyodide（Python）/ QuickJS（JS）沙箱内执行

---

## MODIFIED Requirements

### Requirement: inputGuard 中间件升级
现有 `guardInput()` 函数 SHALL 扩展为**多引擎级联模式**：
```
用户输入
  → Level 1: 正则快速过滤（现有实现，<1ms）
  → Level 2: textfilter NLP 分词匹配（新增，<10ms）
  → Level 3: Presidio 实体识别（新增，<50ms，可选）
  → Level 4: Semgrep 代码分析（新增，后端，<500ms，仅代码类）
→ 综合判定结果
```

### Requirement: dataMask 脱敏引擎升级
现有 `maskSensitiveData()` 函数 SHALL 支持**双引擎切换**：
- 默认: Presidio Analyzer（NLP 实体识别，更高准确率）
- 降级: 现有正则实现（无网络/CDNA 失败时）

### Requirement: quotaManager 存储升级
现有 `localStorage` 计数器 SHALL 可选迁移至 `localForage`：
- 支持更大存储容量
- 支持跨标签页同步
- 支持离线队列（离线操作排队，上线后同步）

---

## 技术约束

1. **纯 npm/pip 集成**: 所有前端包通过 `npm install`，后端包通过 `pip install`
2. **不引入新语言**: 不引入 Go/Java/Rust 到主项目（litefs/restic 为独立部署工具）
3. **向后兼容**: 每个新引擎必须有 Fallback 到现有实现的降级路径
4. **Monaco Editor 优先**: IDE 功能优先使用 monaco-editor + @monaco-editor/react
5. **CDN 优先**: 大型模型/引擎优先使用 CDN 加载（减小打包体积）

---

*文档版本: v1.0 | 创建日期: 2026-06-02*
*基于用户提供的开源技术选型清单*
