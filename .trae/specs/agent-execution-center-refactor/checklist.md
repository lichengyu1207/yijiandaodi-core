# Agent 执行中心重构 - 验收清单

## 文案官方化
- [x] AIChatCenter.tsx 中 AGENT_ROLES 数组的 name 字段已改为「安全审计/真实性核验/数据存证/智能裁决」
- [x] AIChatCenter.tsx 页面标题已改为「AI 内容安全检测平台」
- [x] AIChatCenter.tsx 副标题已去除个人化表达，使用产品级描述语
- [x] 「四官联动」相关文案已替换为「多维协同」或「多模块协同」
- [x] 欢迎区域流程说明已更新为标准操作指引（安全审计→真实性核验→数据存证→智能裁决）
- [x] 执行结果区域无「老骇帮你搞定」等个人化表达
- [x] 输入区域 placeholder 无拟人化角色名称
- [x] AgentRoles.tsx 标题已改为「多维协同安全检测体系」
- [x] AgentRoles.tsx 副标题和卡片描述已同步更新
- [x] AgentAssistant.tsx DEFAULT_AGENTS 的 name 和 description 已同步
- [x] AgentAssistant.tsx 欢迎语模板已标准化为模块就绪提示
- [x] AgentAssistant.tsx MOCK_REPLIES 已全部重写为官方回复
- [x] AgentAssistant.tsx 侧边栏标题已改为「模块选择」
- [x] AgentConfig/index.tsx DEFAULT_AGENT_CONFIGS name 字段已更新
- [x] AgentConfig/index.tsx system_prompt 已去除拟人化前缀
- [x] AgentConfig/index.tsx welcome_msg 已标准化

## 功能完整性
- [x] /agent 页面正常加载，布局三栏结构正确（代码逻辑未改动）
- [x] 左侧边栏：新建任务按钮、会话列表、设置入口正常（代码逻辑未改动）
- [x] 中央欢迎区：场景选择、快速任务、多Agent预设、工作流入口正常显示（文案已更新）
- [x] 输入区：文本框、附件上传、技能选择、发送按钮正常工作（文案已更新）
- [x] 执行流程：四模块顺序执行进度条正常展示（代码逻辑未改动，仅文案更新）
- [x] 执行结果：综合评级横幅、各模块结果卡片、详细分析、建议列表正常（代码逻辑未改动）
- [x] 多Agent预设套餐可点击执行（文案已更新）
- [x] 快速任务可点击自动填充并执行（文案已更新）
- [x] 场景切换后检测类型正确（代码逻辑未改动）

## 一致性检查
- [x] 全局搜索「老骇」无 .tsx 用户可见残留（仅 mock/articles.ts 模拟数据中存在）
- [x] 全局搜索「四官」无 .tsx 用户可见残留
- [x] 全局搜索「白嫖」无 .tsx 用户可见残留（仅 mock/articles.ts 模拟数据中存在）
- [x] 全局搜索「翻车」无 .tsx 用户可见残留（仅 mock/articles.ts 模拟数据中存在）
- [x] 全局搜索「别瞎搞」无残留
- [x] 全局搜索「帮你搞定」无残留
- [x] agent_code 传参值未改变（auditor/verifier/archiver/judge 保持原值）

## 不影响范围确认
- [x] 首页 Home/index.tsx 信息流内容未修改
- [x] Originality 页面未受影响
- [x] Grammarly 页面未受影响
- [x] Copyscape 页面未受影响
- [x] ResumeOptimizer 页面未受影响
- [x] CAcademicIntegrity 页面未受影响
- [x] agentApi.ts 接口调用方式未改变
- [x] 后端 agent 相关模型和 API 未修改
