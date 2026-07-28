# 开源技术栈集成 - 验收清单

## 第一批：高价值快速集成

### Task 1: Monaco Editor IDE 页面
- [ ] monaco-editor 和 @monaco-editor/react 已安装（package.json）
- [ ] `/ide` 路由已配置（router/index.tsx）
- [ ] IDE 页面文件已创建（pages/IDE/index.tsx）
- [ ] 左侧文件树面板正常显示
- [ ] 中央编辑器区域支持多 Tab 切换
- [ ] 底部终端/输出面板存在
- [ ] 右侧 AI 助手面板占位
- [ ] 语法高亮正常工作（至少 Python/JS/TS/SQL）
- [ ] 自动补全功能可用
- [ ] 快捷键映射与 VS Code 一致
- [ ] 暗色主题匹配平台风格
- [ ] 编辑器内容变更时触发 ASS 输入层巡检
- [ ] 危险代码实时标红（Monaco decoration）
- [ ] 文件新建/打开/保存/重命名功能正常

### Task 2: Presidio 脱敏引擎
- [ ] presidio 相关依赖已安装
- [ ] presidoAdapter.ts 已创建
- [ ] Presidio Analyzer 接口封装完成
- [ ] 支持的实体类型 ≥ 8 种（PERSON/PHONE/EMAIL/IBAN/CREDIT_CARD/IP/LOCATION/DATE_TIME）
- [ ] 输出格式兼容现有 MaskResult 接口
- [ ] dataMask.ts 新增 usePresidio 开关
- [ ] Presidio 模式下走 NLP 引擎，关闭时走正则降级
- [ ] CDN 加载失败时自动 Fallback 到原实现
- [ ] TypeScript 类型正确

### Task 3: localForage 存储增强
- [ ] localforage 已安装（package.json）
- [ ] quotaManager.ts 新增 localForage 导出
- [ ] 使用 IndexedDB 存储配额数据
- [ ] 接口与原有 localStorage 版本兼容
- [ ] 跨标签页数据同步正常（可选）

### Task 4: transformers.js 浏览器推理
- [ ] @xenova/transformers 已安装（package.json）
- [ ] browserInference.ts 已创建
- [ ] pipeline() 封装完成（文本分类/NER/零样本分类）
- [ ] Web Worker 中运行模型推理（不阻塞 UI）
- [ ] comlink Worker RPC 通信正常
- [ ] Agent 执行中心新增「本地推理」模式选项
- [ ] 模型加载进度条显示正确
- [ ] 推理结果可展示并与云端对比

## 第二批：ASS 安全内核升级

### Task 5: textfilter 敏感词库
- [ ] textfilter 已安装或词库 JSON 已内嵌
- [ ] inputGuard.ts 的 SENSITIVE_WORD_CATEGORIES 被 textfilter 替换
- [ ] 敏感词分级返回（政治/暴力/色情/违法独立计数）
- [ ] 支持动态更新词库（服务器拉取）

### Task 6: Pyodide 浏览器 Python 沙箱
- [ ] pyodide.js CDN 加载机制就绪（懒加载）
- [ ] pyodideSandbox.ts 已创建
- [ ] Python 运行环境初始化成功
- [ ] 标准库限制生效（禁止 os.system/subprocess 等）
- [ ] stdout/stderr 输出捕获正常
- [ ] 执行超时控制有效（默认 30s）
- [ ] IDE 底部终端可执行 Python 代码
- [ ] Agent 代码类任务可选浏览器端沙箱执行

## 第三批：P2P 与通信基础设施

### Task 7: wrtc P2P 通信层
- [ ] wrtc 或原生 RTCPeerConnection API 已集成
- [ ] p2pConnection.ts 已创建
- [ ] STUN/TURN 信令服务器连接正常
- [ ] DataChannel 建立（可靠+不可靠模式）
- [ ] 文件分片传输协议实现
- [ ] 节点发现与连接管理功能正常
- [ ] 任务分发 DataChannel 可用
- [ ] 结果回传聚合逻辑正确

### Task 8: onnxruntime-web 备选引擎
- [ ] onnxruntime-web 已安装
- [ ] ONNX 运行时适配器已创建
- [ ] 模型加载与 Session 创建正常
- [ ] 与 transformers.js 统一抽象层兼容
- [ ] WebGPU 加速路径可用（浏览器支持时）

## 通用验收标准

### 包管理
- [ ] 所有新增 npm 包记录在 package.json
- [ ] 所有新增 pip 包记录在 requirements.txt
- [ ] 无版本冲突（npm audit / pip check 通过）

### 降级保障
- [ ] Presidio 有 Fallback → dataMask 正则
- [ ] transformers.js 有 Fallback → 云端 API
- [ ] Pyodide 有 Fallback → 后端执行
- [ ] wrtc 有 Fallback → HTTP 轮询
- [ ] localForage 有 Fallback → localStorage
- [ ] Monaco 有 Fallback → 纯文本 textarea

### 不影响范围确认
- [ ] Phase 1 已有功能未回退
- [ ] 5 个 ResultCard 页面正常
- [ ] Agent 编排层正常
- [ ] 免费额度机制正常
- [ ] 官方化文案未被修改

---

*文档版本: v1.0 | 创建日期: 2026-06-02*
