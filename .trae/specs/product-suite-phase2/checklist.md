# 产品套件优化验收清单 (Checklist)

## 验收标准
每个检查项必须通过后才可标记为完成。未通过项需创建新任务修复。

---

## Sprint 1 验收 (Day 5)

### Task 1: #57 Originality.ai UI优化
- [ ] 批量上传组件支持拖拽排序，文件可重试
- [ ] 检测报告支持"全文高亮模式"切换，AI/抄袭标注清晰可见
- [ ] AI概率热力图正确渲染（段落背景色渐变符合分数）
- [ ] 时间轴滑块回放功能正常（播放/暂停/进度拖拽）
- [ ] 移动端下仪表盘不溢出，触摸操作流畅
- [ ] Lighthouse Performance Score ≥ 90 (Mobile + Desktop)

### Task 2: #62 Grammarly 性能优化
- [ ] 输入时无卡顿感（防抖300ms生效，不会每次按键都调API）
- [ ] SVG下划线渲染正确（4种样式区分明显：波浪/虚线/双线/实线）
- [ ] 错误类型图标前缀显示正常（🔴🟡🔵 或 lucide图标）
- [ ] 移动端侧边栏自动收起为底部抽屉
- [ ] 桌面端侧边栏可拖拽调节宽度（200px-500px范围）
- [ ] API调用次数降低50%以上（对比优化前，相同文本量）

### Task 3: #74 Buy Me a Coffee 增强
- [ ] 支付成功后撒花粒子动画流畅（50个粒子，2秒持续时间）
- [ ] 咖啡杯蒸汽动画循环播放（CSS animation或SVG animate）
- [ ] 分享卡片图片生成成功（html-to-image导出PNG，尺寸800x400）
- [ ] 微博分享链接预填充文案正确（含打赏金额和接收者名称）
- [ ] CoffeeButton在深色/浅色背景下都清晰可见（6种主题色测试通过）

### Task 4: #59 Copyscale 前端补全
- [ ] `/copyscape` 路由可访问，页面加载无报错
- [ ] URL输入框能正确获取favicon（输入baidu.com后左侧显示百度icon）
- [ ] 点击"开始检测"调用 `POST /api/copyscape/scan-url/` 成功
- [ ] 6步进度条正确显示当前步骤和预估时间
- [ ] 来源匹配列表展示完整（favicon+标题+相似度%+匹配片段）
- [ ] 批量上传CSV解析正确（10个URL的CSV文件导入成功）

### Task 5: #63 Resume Worded 前端补全
- [ ] `/resume-optimizer` 路由可访问
- [ ] PDF简历上传后结构化预览正确（5个章节导航可用）
- [ ] 六维雷达图动画效果流畅（从0展开到实际得分，2秒缓动）
- [ ] 点击维度展开详细建议（至少3条/维度，内容相关）
- [ ] "一键优化"按钮触发API调用并返回结果
- [ ] Diff对比视图绿红标注正确（新增=绿、删除=红、修改=黄）
- [ ] 导出PDF/Word功能正常（下载文件可打开，格式正确）

### Sprint 1 集成测试
- [ ] 所有5个产品页面路由注册正确（router/index.tsx已更新）
- [ ] TypeScript编译零错误 (`npx tsc --noEmit`)
- [ ] ESLint零error（warning可接受）
- [ ] 前端dev server启动无报错 (`npm run dev`)
- [ ] 跨产品跳转链接存在且可点击（Grammarly→Originality等）

---

## Sprint 2 验收 (Day 10)

### Task 6: #58/#61 学术检测增强
- [ ] 引用格式选择器下拉菜单工作正常（选择APA后报告更新规则）
- [ ] 视角切换按钮组功能正确（学生版/导师版/审稿人版UI不同）
- [ ] 学术报告PDF包含机构Logo水印（或默认Logo）
- [ ] 报告防伪码可见（唯一ID + 时间戳 + 校验码字符串）
- [ ] PDF目录可点击跳转（书签超链接有效）

### Task 7: #56 Flowise + #55 AgentBuilder ⭐ 核心验收
- [ ] WorkflowEditor画布可拖拽节点（从左侧面板拖到中央画布）
- [ ] 节点间可连线连接（贝塞尔曲线显示，端口高亮）
- [ ] 右侧属性面板随选中节点变化（不同节点类型显示不同表单）
- [ ] 底部控制台实时输出日志（运行workflow时看到节点执行顺序）
- [ ] AgentBuilder 4步向导流程顺畅（Step1→2→3→4无卡顿）
- [ ] Prompt编辑器Monaco Editor加载成功（语法高亮+自动补全）
- [ ] 模板库侧边栏展示20+模板（点击模板填充编辑器）
- [ ] 工具编排画布与WorkflowEditor复用一致
- [ ] 测试沙箱对话功能正常（发送消息→收到Agent回复）
- [ ] "发布应用"按钮生成API密钥（密钥格式: app_xxxxxxxxxxxxxxxx）
- [ ] 应用列表页显示已发布应用（卡片含名称/状态/调用量）

### Task 8: 定价与支付打通
- [ ] Admin后台ProductPricing模型存在且可在Admin界面增删改查
- [ ] PaymentOrder包含tip/agent_call/plagiarism_check等新订单类型
- [ ] 新类型订单支付流程走通（创建订单→模拟支付→回调→状态更新为paid）
- [ ] Stripe SDK集成(如启用): 测试环境使用test key，真实环境使用prod key

### Task 9: 用户引导与联动
- [ ] 首次访问自动弹出Onboarding引导(检查localStorage)
- [ ] 5步引导流程完整（欢迎→产品介绍→功能演示→试用提示→注册奖励）
- [ ] 引导完成后localStorage写入'onboarding_completed=true'
- [ ] Grammarly页底部有"跳转Originality"按钮，点击后携带文本跳转
- [ ] Originality页底部有"跳转Grammarly"按钮，点击后携带文本跳转
- [ ] 目标页面自动填充来自其他产品的文本（URL参数或sessionStorage读取成功）

### Task 10: CreatorPlatform仪表盘
- [ ] `/api/creator/dashboard/stats` 接口返回数据格式正确
- [ ] 月收入趋势折线图渲染正确（X轴月份，Y轴金额，带面积填充）
- [ ] 收入来源饼图三色分区正确（橙tips/蓝订阅/绿单次）
- [ ] Top内容排行柱状图数据正确（水平排列，标题+收入）
- [ ] 快捷操作卡片数字准确（今日收入/新增粉丝/客单价/复购率）

### Sprint 2 集成测试
- [ ] AgentBuilder创建的应用可通过API调用（curl测试返回正确响应）
- [ ] 支付闭环验证：浏览产品 → 使用功能 → 触发付费 → 支付成功 → 查看报告/解锁功能
- [ ] 产品间联动验证：Grammarly纠错→Originality检测 全流程无数据丢失
- [ ] 移动端Safari + Android Chrome兼容性测试通过（主要页面无布局错乱）

---

## Sprint 3 验收 (Day 12)

### Task 11: 前端性能优化
- [ ] Chrome DevTools Network面板显示多个chunk文件(非单一bundle)
- [ ] 首屏LCP < 2.5秒（Lighthouse Performance audit通过）
- [ ] 图片懒加载生效（滚动到视口内才发起请求，Network面板可见）
- [ ] Grammarly重复文本检测命中缓存（第二次调用<100ms，首次>2s）
- [ ] Bundle Size分析：主bundle < 500KB (gzip后)，每个lazy chunk < 200KB

### Task 12: 后端性能优化
- [ ] DualEngineScan列表查询 < 200ms（Django Debug Toolbar或自定义计时）
- [ ] RAG热门查询命中Redis缓存（第二次<50ms，首次>1s）
- [ ] Celery任务队列运行正常(如启用)：`celery -A fangdudu_backend worker -l info` 无报错
- [ ] 数据库slow query log无新增慢查询（>1秒的查询）
- [ ] 并发测试：ab -n 1000 -c 10 测试首页API，错误率 < 1%

---

## 最终验收清单 (全部Sprint完成后)

### 功能完整性
- [ ] 13个已有产品全部可访问且核心功能正常（对照spec.md实现现状表逐个验证）
- [ ] 2个新产品(Copyscale/Resume)前端上线并可使用
- [ ] Agent低代码平台(AgentBuilder)可用（创建→配置→测试→发布全流程）
- [ ] 支付流程至少2种订单类型走通

### 代码质量
- [ ] TypeScript strict mode编译零错误
- [ ] Python flake8/pylint检查通过（或等效linter）
- [ ] 前端ESLint error=0, warning<20
- [ ] Git commit message规范（conventional commits格式）
- [ ] 无console.log残留（生产代码中）
- [ ] 无硬编码的API URL（统一使用api/*.ts封装）

### 性能指标
- [ ] Lighthouse Performance Score ≥ 90 (所有主要页面)
- [ ] First Contentful Paint (FCP) < 1.8s
- [ ] Time to Interactive (TTI) < 3.5s
- [ ] Total Blocking Time (TBT) < 200ms
- [ ] Cumulative Layout Shift (CLS) < 0.1
- [ ] API P95延迟 < 2秒（所有接口）
- [ ] 数据库查询 P99 < 500ms

### 安全性
- [ ] 所有API接口需JWT认证（公开接口白名单明确标注）
- [ ] 用户输入经过sanitize（XSS防护，DOMPurify或等效）
- [ ] SQL注入防护（Django ORM参数化查询，无raw SQL拼接）
- [ ] 文件上传限制生效（类型白名单+大小限制<50MB）
- [ ] Rate Limiting配置正确（100次/分钟/用户）
- [ ] CORS设置仅允许前端域名
- [ ] 敏感信息不在前端代码中（API Key用环境变量）

### 文档与部署
- [ ] README.md更新（新增产品说明、快速开始、环境变量列表）
- [ ] API文档更新（Swagger/OpenAPI schema包含新接口）
- [ ] 数据库迁移文件完整（makemigrations生成的.py文件）
- [ ] requirements.txt / package.json依赖版本锁定
- [ ] Docker/docker-compose.yml可正常构建启动（如有）
- [ ] 生产环境配置示例(.env.example)提供

### 商业化就绪度
- [ ] 定价策略文档完成（每个产品的价格/套餐/免费额度明确定义）
- [ ] 用户引导流程引导至付费转化点（非强制但路径清晰）
- [ ] 支付失败有友好提示和重试机制
- [ ] 退款流程说明（即使当前是mock也要有UI入口）
- [ ] 联系方式/客服入口可见（Footer或Help菜单）

---

## 签字确认

**开发负责人**: _______________ 日期: _________  
**QA测试**: _______________ 日期: _________  
**产品经理**: _______________ 日期: _________

---

*文档版本: v1.0 | 创建日期: 2026-06-01*
*共52个检查项，覆盖12个Task的全部交付物*
