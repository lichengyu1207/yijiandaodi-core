# 开源技术栈集成 - 任务清单

## 任务总览
- **目标**：将用户筛选的 20 个开源项目集成到现有技术栈
- **核心原则**：npm/pip 直接引入、有降级 Fallback、不引入新语言到主项目
- **优先级排序**：IDE > ASS安全升级 > 前端推理引擎 > 沙箱 > 存储

---

# Tasks

## 第一批：高价值快速集成（立即执行）

- [ ] **Task 1: Monaco Editor IDE 页面** [1天]
  - [ ] 1.1 安装依赖
    - `npm install monaco-editor @monaco-editor/react`
  - [ ] 1.2 创建 IDE 页面 `frontend/src/pages/IDE/index.tsx`
    - 路由: `/ide`
    - 布局: 文件树(左) + 编辑器(中) + 终端(底) + AI面板(右)
    - 多 Tab 支持，语言自动检测
  - [ ] 1.3 集成 ASS 输入层巡检
    - 编辑器内容变更时调用 guardInput()
    - 危险代码实时标红（Monaco decoration API）
  - [ ] 1.4 基础功能
    - 语法高亮 + 自动补全 + 快捷键映射(VS Code)
    - 文件新建/打开/保存/重命名
    - 暗色主题适配（匹配平台深色风格）

- [ ] **Task 2: Presidio 脱敏引擎集成** [0.5天]
  - [ ] 2.1 安装依赖
    - `npm install presidio @microsoft/presidio-analyzer-nodejs-bundle` 或后端 `pip install presidio-analyzer presidio-anonymizer`
  - [ ] 2.2 创建 Presidio 适配器 `frontend/src/utils/presidioAdapter.ts`
    - 封装 Presidio Analyzer 接口，输出格式兼容现有 MaskResult
    - 支持的实体类型: PERSON, PHONE_NUMBER, EMAIL_ADDRESS, IBAN_CODE, CREDIT_CARD, IP_ADDRESS, LOCATION, DATE_TIME
  - [ ] 2.3 升级 dataMask.ts
    - 新增 `usePresidio` 开关
    - 开启时走 Presidio NLP 引擎，关闭时走原有正则实现
    - CDN 加载失败自动降级

- [ ] **Task 3: localForage 存储增强** [0.3天]
  - [ ] 3.1 安装依赖
    - `npm install localforage`
  - [ ] 3.2 升级 quotaManager.ts
    - 新增 `localForageQuotaManager` 导出
    - 使用 IndexedDB 替代 localStorage 存储配额数据
    - 保持接口兼容，支持渐进式迁移

- [ ] **Task 4: transformers.js 浏览器端推理** [0.5天]
  - [ ] 4.1 安装依赖
    - `npm install @xenova/transformers`
  - [ ] 4.2 创建推理模块 `frontend/src/utils/browserInference.ts`
    - 封装 pipeline() 调用（文本分类、命名实体识别、零样本分类）
    - Web Worker 中运行模型推理（不阻塞 UI）
    - comlink 实现 Worker RPC 通信
  - [ ] 4.3 集成到 Agent 执行中心
    - 新增「本地推理」模式选项
    - 模型加载进度条显示
    - 推理结果与云端结果对比展示

## 第二批：ASS 安全内核专业级升级

- [ ] **Task 5: textfilter 敏感词库集成** [0.5天]
  - [ ] 5.1 安装/集成 textfilter
    - 后端: `pip install textfilter` 或前端直接内嵌词库 JSON
  - [ ] 5.2 升级 inputGuard.ts
    - 用 textfilter 的多级词库替换硬编码 SENSITIVE_WORD_CATEGORIES
    - 支持动态更新词库（从服务器拉取）
    - 分级返回（政治/暴力/色情/违法 各独立计数）

- [ ] **Task 6: Pyodide 浏览器 Python 沙箱** [1天]
  - [ ] 6.1 安装依赖
    - 通过 CDN 加载 pyodide.js（~10MB，懒加载）
  - [ ] 6.2 创建沙箱模块 `frontend/src/utils/pyodideSandbox.ts`
    - Python 代码执行环境初始化
    - 标准库限制（禁止 os.system / subprocess 等）
    - 输出捕获（stdout/stderr 重定向）
    - 执行超时控制（默认 30s）
  - [ ] 6.3 集成到 IDE 和 Agent 执行中心
    - IDE 底部终端可执行 Python 代码
    - Agent 代码类任务可选浏览器端沙箱执行

## 第三批：P2P 与通信基础设施

- [ ] **Task 7: wrtc P2P 通信层** [1天]
  - [ ] 7.1 安装依赖
    - `npm install wrtc` 或使用原生 RTCPeerConnection API
  - [ ] 7.2 创建 P2P 模块 `frontend/src/p2p/p2pConnection.ts`
    - 信令服务器连接（STUN/TURN 配置）
    - DataChannel 建立（可靠/不可靠双模式）
    - 文件分片传输协议
  - [ ] 7.3 集成到算力网络架构
    - 节点发现与连接管理
    - 任务分发 DataChannel
    - 结果回传聚合

- [ ] **Task 8: onnxruntime-web 备选推理引擎** [0.5天]
  - [ ] 8.1 安装依赖
    - `npm install onnxruntime-web`
  - [ ] 8.2 创建 ONNX 运行时适配器
    - 模型加载与 Session 创建
    - 与 transformers.js 的统一抽象层
    - WebGPU 加速（如浏览器支持）

## 第四批：后端增强（可选，低优先级）

- [ ] **Task 9: Semgrep 代码扫描** [待定]
  - [ ] 9.1 后端安装 `pip install semgrep`
  - [ ] 9.2 创建 Semgrep 服务封装
  - [ ] 9.3 对接 inputGuard 代码类输入

- [ ] **Task 10: Trivy 依赖漏洞扫描** [待定]
  - [ ] 10.1 后端安装 Trivy CLI
  - [ ] 10.2 创建文件上传→Trivy扫描→结果解析流水线

- [ ] **Task 11: FastAPI 异步网关** [待定]
  - [ ] 11.1 后端安装 `pip install fastapi uvicorn`
  - [ ] 11.2 创建异步 API 网关服务（补充 Django 同步瓶颈）
  - [ ] 11.3 Django + FastAPI 共存架构

---

# Task Dependencies
```
第一批（可并行）:
├── Task 1 (Monaco IDE) ────────────── 独立
├── Task 2 (Presidio) ──────────────── 独立
├── Task 3 (localForage) ──────────── 独立
└── Task 4 (transformers.js) ─────── 需要 comlink（内置在 Task 4 内）

第二批:
├── Task 5 (textfilter) ───────────── 依赖 Task 2 完成后的 inputGuard 架构
└── Task 6 (Pyodide) ─────────────── 可集成到 Task 1 的 IDE 中

第三批:
└── Task 7 (wrtc) ────────────────── 独立，但需要 STUN/TURN 服务器配置

第四批（低优先级）:
├── Task 9 (Semgrep)
├── Task 10 (Trivy)
└── Task 11 (FastAPI)
```

---

*文档版本: v1.0 | 创建日期: 2026-06-02*
