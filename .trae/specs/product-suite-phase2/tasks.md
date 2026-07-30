# 产品套件优化任务清单 (基于现有实现的增强)

## 任务总览
- **总任务数**: 12个主任务 + 32个子任务
- **预估总工时**: 12天（原计划30天，降低60%）
- **并行策略**: Sprint 1的5个任务可完全并行

---

# Tasks

## Sprint 1: 核心产品体验提升 (Day 1-5)

- [ ] **Task 1: #57 Originality.ai UI优化** [2天]
  - [ ] 1.1 批量上传组件重构
    - 引入WebSocket实时进度推送(替代轮询)
    - 添加拖拽排序功能(react-dnd)
    - 单文件重试按钮 + 失败原因气泡提示
    - 文件类型图标显示(PDF/Word/TXT不同颜色)
  
  - [ ] 1.2 报告可视化增强
    - 新增"全文高亮模式"切换(类似Word修订模式，直接在原文标注AI/抄袭)
    - 添加AI概率热力图组件(段落级别背景色渐变: 绿→黄→红)
    - 实现时间轴滑块回放检测过程(5秒动画展示引擎工作流程)
    - 导出报告增强(支持Word格式、添加自定义封面)
  
  - [ ] 1.3 移动端响应式适配
    - 双引擎仪表盘改为竖向堆叠(手机上上下排列而非左右)
    - 逐句分析卡片改为手风琴折叠模式
    - 触摸友好的手势操作(左滑删除、右滑收藏)

- [ ] **Task 2: #62 Grammarly 性能与交互优化** [2天]
  - [ ] 2.1 实时检测性能优化
    - 实现防抖机制(300ms延迟，避免每次按键都调API)
    - 本地LRU缓存(最近10次检测结果，相同文本直接返回)
    - 增量检测逻辑(只对新增/修改的段落重新调用API)
    - 显示"正在检测..."微光动画(loading skeleton)
  
  - [ ] 2.2 下划线渲染系统升级
    - 替换CSS text-decoration为自定义SVG下划线组件
    - 支持4种下划线样式:
      - 红色波浪线 = 语法错误
      - 橙色虚线 = 拼写错误
      - 蓝色双线 = 风格建议
      - 绿色实线 = 已接受修改
    - 错误类型图标前缀(🔴🟡🔵 emoji或lucide-react图标)
  
  - [ ] 2.3 侧边栏智能折叠
    - 移动端(<768px)默认收起为底部抽屉
    - 桌面端支持拖拽调节宽度(最小200px, 最大500px)
    - 折叠时显示悬浮按钮(点击展开)

- [ ] **Task 3: #74 Buy Me a Coffee 仪式感增强** [1天]
  - [ ] 3.1 支付成功动画系统
    - 使用framer-motion实现撒花粒子效果(50个彩色纸片从中心爆发)
    - 咖啡杯SVG动画(蒸汽缓缓上升 + 杯子轻微晃动)
    - 打赏者头像飞入动画(从屏幕边缘飞入接收者头像旁)
    - "感谢您的支持!"文字打字机效果逐字显示
  
  - [ ] 3.2 社交分享卡片生成
    - 集成html-to-image库生成精美分享卡片图片
    - 卡片内容: 打赏金额大字 + 留言引用 + 二维码(链接到support页) + 平台Logo
    - 一键分享到:
      - 微博(预填充文案: "我刚刚支持了{creator_name}一杯咖啡☕ {url}")
      - 微信(生成二维码弹窗)
      - Twitter(预填充英文文案)
      - 复制通用文案到剪贴板

  - [ ] 3.3 CoffeeButton主题适配
    - 实现6种预设主题色(跟随父容器background自动选择明暗)
    - 新增size="mini"变体(用于文章列表等紧凑场景)
    - hover状态: 轻微scale(1.05) + 阴影加深 + 咖啡杯图标旋转15°

- [ ] **Task 4: #59 Copyscale 前端补全** [2天] ⭐ 高优先级
  - [ ] 4.1 创建Copyscape页面 (`frontend/src/pages/Copyscape/index.tsx`)
    - Hero区域: 标题"全网抄袭检测 | Plagiarism Scanner"
    
    - URL输入区域:
      - 输入框带自动favicon获取(输入URL后左侧显示网站icon)
      - URL预览卡片(标题+域名+描述，来自Open Graph meta标签)
      - "开始检测"大按钮(调用POST /api/copyscape/scan-url/)
    
    - 进度可视化:
      - 6步进度条(DNS解析 → HTML下载 → 正文提取 → 文本分段 → 向量化 → 相似度检索)
      - 每步完成后打勾动画 + 预估剩余时间
    
    - 结果展示区:
      - 总体唯一性分数圆环(0-100%)
      - 来源匹配列表(复用SourceComparisonView组件)
      - 每个来源卡片: favicon + 标题 + 相似度% + 匹配片段引用 + "访问来源"外部链接
    
    - 批量检测Tab:
      - CSV文件上传(格式: url, label)
      - 批量进度表格(状态列: 待处理/检测中/完成/失败)
      - 批量结果汇总(平均唯一性 + 直方图分布)
    
    - 监控设置(可选):
      - "定期复查"开关(每周/每月)
      - 邮件通知阈值(发现新相似内容时告警)

  - [ ] 4.2 创建Copyscale API对接层 (`frontend/src/api/copyscapeApi.ts`)
    - scanUrl(url: string) - 单URL检测
    - scanBatch(urls: string[]) - 批量检测
    - getScanHistory(params) - 检测历史
    - getReport(scanId) - 获取报告详情
    - setMonitor(scanId, config) - 设置监控

- [ ] **Task 5: #63 Resume Worded 前端补全** [2天] ⭐ 高优先级
  - [ ] 5.1 创建ResumeOptimizer页面 (`frontend/src/pages/ResumeOptimizer/index.tsx`)
    - Hero区域: "AI简历优化 | Resume Optimizer"
    
    - 上传/粘贴区域(Tabs切换):
      - Tab1 PDF上传(拖拽区域 + 文件选择器，支持.pdf/.docx/.txt)
      - Tab2 文本粘贴(大textarea，支持自动识别简历结构)
    
    - 简历结构化预览(上传后显示):
      - 左侧导航栏(5个章节): 个人信息 / 工作经历 / 教育背景 / 技能 / 项目经验
      - 中央内容区(选中章节的详细内容，高亮关键字段)
      - 右侧快速评分(每个章节一个圆形进度条)
    
    - 六维雷达图(使用recharts库):
      - 维度: 影响力 / 技能匹配度 / 格式规范性 / ATS友好度 / 关键词覆盖 / 总体得分
      - 动画效果(从0分展开到实际得分，2秒缓动)
      - 点击维度展开详细问题和改进建议列表(至少3条/维度)
    
    - AI优化工作区:
      - "一键优化此章节"按钮(每章独立，不覆盖整篇)
      - Diff对比视图(并排两栏: 左=原文 右=优化后)
        - 绿色背景 = 新增/改进的内容
        - 红色背景 = 删除的内容
        - 黄色背景 = 修改的内容
      - "接受全部"/"接受此段"/"拒绝"操作按钮
    
    - 导出区域:
      - 下载优化后的简历(PDF/Word格式)
      - 下载评分报告(PDF含雷达图和详细建议)

  - [ ] 5.2 创建Resume API对接层 (`frontend/src/api/resumeApi.ts`)
    - uploadResume(file: File) - 上传简历文件
    - parseResume(text: string) - 解析简历结构
    - analyzeResume(resumeId: string) - 六维评分
    - optimizeSection(resumeId, sectionId, mode) - AI优化指定章节
    - exportResume(resumeId, format) - 导出简历

## Sprint 2: 战略产品+商业闭环 (Day 6-10)

- [ ] **Task 6: #58/#61 学术检测增强** [1.5天]
  - [ ] 6.1 CAcademicIntegrity页面功能补充
    - 新增引用格式选择器下拉菜单(APA 7th / MLA 9th / Chicago 17th / Harvard / GB7714 2015)
    - 选择后自动更新报告中的引用检查规则
    - 新增视角切换按钮组(学生版 / 导师版 / 审稿人版)
      - 学生版: 突出显示"需要修改的地方"(红色标注)
      - 导师版: 突出显示"高风险段落"(橙色警告)
      - 审稿人版: 显示完整技术细节(AI模型置信度、特征向量距离)
    
  - [ ] 6.2 学术报告PDF增强
    - 添加机构Logo上传(Admin后台配置默认Logo)
    - 防伪水印(报告ID + 生成时间戳 + 校验码)
    - 页眉页脚(机构名称 + 页码)
    - 目录自动生成(跳转到对应章节)

- [ ] **Task 7: #56 Flowise 工作流编辑器重构** [3天] ⭐ 战略级
  - [ ] 7.1 WorkflowEditor画布系统
    - 安装依赖: `npm install @xyflow/react` (React Flow v12)
    
    - 左侧节点面板(NodePalette):
      - 分类展示: Agent节点 / 工具节点 / 逻辑节点 / 触发器节点
      - 每个节点显示图标+名称+简短描述
      - 拖拽节点到画布(使用React Flow的onDrop事件)
    
    - 中央画布(Canvas):
      - 网格背景(点阵网格，辅助对齐)
      - 节点可拖拽移动位置
      - 连接端口(左侧=input,右侧=output)
      - 拖拽连线连接节点(贝塞尔曲线)
      - 缩放和平移(鼠标滚轮+右键拖拽)
      - 迷你地图(右下角小地图显示整体布局)
    
    - 右侧属性面板(PropertyPanel):
      - 未选中节点时: 显示画布全局设置(名称、描述、变量定义)
      - 选中节点时: 显示该节点的参数配置表单
        - Agent节点: 选择Agent角色、temperature、max_tokens
        - 工具节点: 配置工具参数(API endpoint、认证信息)
        - 条件节点: 编写条件表达式(支持变量引用)
    
    - 底部控制台(Console):
      - 运行日志实时输出(时间戳 + 节点名称 + 状态)
      - 变量监视器(查看当前流程中所有变量的值)
      - "运行" / "暂停" / "停止" 控制按钮

  - [ ] 7.2 AgentBuilder页面 (`frontend/src/pages/AgentBuilder/index.tsx`)
    - 这是#55 Dify的核心界面！基于现有AgentConfig扩展
    
    - 应用列表页(/agent-builder):
      - 我的应用卡片列表(名称/状态/创建时间/调用量)
      - "新建应用"按钮 → 进入创建向导
    
    - 4步创建向导(Wizard):
      - Step1 基础信息: 名称/描述/分类选择/图标上传(color picker选颜色)
      - Step2 Prompt配置:
        - 大型Monaco Editor代码编辑器(支持语法高亮+自动补全)
        - 变量插入工具栏按钮(点击插入{{variable}}占位符)
        - Markdown实时预览(分屏显示编辑区和预览区)
        - 模板库侧边栏(20+模板，点击即用):
          - 分类: 客服/翻译/写作/分析/编程/摘要/问答/创作/审核/总结
          - 每个模板显示名称+描述+示例输入输出
        - 参数滑块(temperature: 0-2, max_tokens: 100-8000, top_p: 0-1)
      
      - Step3 工具编排(复用WorkflowEditor的画布):
        - 从工具市场拖拽工具到画布
        - 内置工具: WebSearch / RAG检索 / 代码执行 / 图像生成 / 数据分析 / 发送邮件
        - 自定义工具: 填写API endpoint + JSON Schema定义参数
      
      - Step4 发布设置:
        - 访问权限(公开/私有/密码保护)
        - 定价方案(免费额度N次/月 + 超出按¥X/次 或 包月¥XX)
        - API密钥自动生成(显示密钥 + 复制按钮 + "重新生成")
        - "发布应用"按钮
    
    - 测试沙箱(Test Playground):
      - 对话式测试界面(类似AIChatCenter)
      - 实时显示token消耗和费用估算
      - 测试用例管理(保存输入→预期输出对，批量回归测试)
      - 性能指标面板(响应时间P50/P95/P99、成功率、错误分布)

- [ ] **Task 8: 定价与支付打通** [2天]
  - [ ] 8.1 Admin定价配置界面
    - 在Django Admin添加ProductPricing模型(如不存在则新建)
    - 字段: product_code(如'originality') / name / price / currency / unit(次/月/年) / description
    - 前端设置页(/admin/pricing): 表格展示所有产品定价，支持在线编辑保存
    
  - [ ] 8.2 PaymentOrder新订单类型激活
    - 检查PaymentOrder.ORDER_TYPE_CHOICES是否包含: 'tip', 'agent_call', 'plagiarism_check', 'academic_report', 'resume_optimization'
    - 如缺失则在migration中添加(数据迁移，不影响已有数据)
    - 前端支付流程集成(确保这些类型的订单能正常走完支付回调)

  - [ ] 8.3 Stripe SDK集成(可选，生产环境)
    - 安装: `npm install @stripe/stripe-js stripe`
    - 创建StripeService封装类(仅在生产环境加载真实API key，开发环境用mock)
    - 支付流程: 创建订单 → 调用Stripe.js创建PaymentIntent → 确认支付 → 回调验证 → 更新订单状态

- [ ] **Task 9: 用户引导与产品联动** [1.5天]
  - [ ] 9.1 Onboarding引导流程
    - 安装: `npm install react-joyride` (或driver.js)
    
    - 5步引导脚本定义:
      1. 欢迎页("欢迎使用一鉴到底，您的AI内容鉴别助手") + "开始之旅"按钮
      2. 产品介绍(展示3个核心产品的卡片: Originality/Grammarly/BuyCoffee)
      3. 功能演示(高亮导航栏"引导用户点击第一个产品")
      4. 免费试用提示("新用户赠送10次免费检测额度")
      5. 注册奖励("注册即可解锁高级功能 + 领取优惠券")
    
    - 引导触发条件:
      - 首次访问(检查localStorage是否有'onboarding_completed'标记)
      - 可在任意时间通过Help菜单重新播放引导
    
  - [ ] 9.2 产品间跳转联动
    - Grammarly页面底部添加:"✨ 检测完语法？试试原创性检测 →"[跳转Originality]
    - Originality报告页添加:"⚠️ AI含量过高？用Grammarly改写一下 →"[跳转Grammarly]
    - CAcademicIntegrity页面添加:"📄 导出PDF报告供导师审阅"
    
    - 跳转时传递数据:
      - 使用URL query参数(?text=encoded_text) 或 sessionStorage传递当前文本
      - 目标页面自动填充文本并提示"已从XXX页面导入文本"

- [ ] **Task 10: CreatorPlatform仪表盘完善** [2天]
  - [ ] 10.1 收入数据整合
    - 后端新建聚合API: GET /api/creator/dashboard/stats
    - 返回数据:
      ```json
      {
        "total_revenue": 12580.00,
        "monthly_trend": [1200, 1500, 1800, 2100, 2400, 2800, ...],
        "revenue_by_source": {
          "tips": 5000,
          "subscriptions": 4000,
          "one_time_purchases": 3580
        },
        "top_content": [
          {"title": "如何写出高质量论文", "views": 1200, "revenue": 560},
          ...
        ],
        "user_demographics": {
          "regions": [{"name": "北京", "count": 350}, ...],
          "devices": {"desktop": 700, "mobile": 300}
        }
      }
      ```
    
  - [ ] 10.2 仪表盘UI实现
    - 使用recharts绘制:
      - 月收入趋势折线图(LineChart, 带面积填充)
      - 收入来源饼图(PieChart, 三色: 橙色tips/蓝色订阅/绿色单次)
      - Top内容排行柱状图(BarChart, 水平排列)
      - 用户地域分布地图(中国地图热力图，可选)
    
    - 快捷操作卡片:
      - 今日收入(大数字 + 昨日对比↑↓)
      - 本月新增粉丝数
      - 平均客单价
      - 复购率

## Sprint 3: 性能+收尾 (Day 11-12)

- [ ] **Task 11: 前端性能优化** [1.5天]
  - [ ] 11.1 代码分割(Code Splitting)
    - 修改router/index.tsx:
      ```tsx
      // 替换静态import为动态import
      const Originality = React.lazy(() => import('@/pages/Originality'));
      const Grammarly = React.lazy(() => import('@/pages/Grammarly'));
      // ... 所有页面都改lazy loading
      ```
    - 包裹Suspense fallback(loading spinner或skeleton)
    - 验证: Chrome DevTools → Network查看是否生成多个chunk文件
  
  - [ ] 11.2 图片懒加载
    - ArticleCover组件: 添加`loading="lazy"`属性
    - 用户头像: 添加Intersection Observer(进入视口再加载)
    - Hero Banner: 预加载(critical image, 不懒加载)
  
  - [ ] 11.3 API缓存层
    - Grammarly检测结果缓存(内存LRU, TTL=5分钟)
    - 使用SWR或React Query实现stale-while-revalidate策略
    - 离线缓存(Service Worker + IndexedDB, 可选PWA预备)

- [ ] **Task 12: 后端性能优化** [1.5天]
  - [ ] 12.1 数据库查询优化
    - DualEngineScan列表视图:
      - 添加select_related('user')减少用户信息查询
      - 添加prefetch_related('sentence_analyses', 'source_matches')
      - 只返回列表需要的字段(only()限制)
    
    - RAG检索优化:
      - 热门查询Redis缓存(前1000个查询hash → 结果JSON)
      - 缓存TTL=1小时，写入时主动失效
    
  - [ ] 12.2 异步任务队列(可选)
    - 安装Celery + Redis(如果尚未安装)
    - Copyscale批量检测改为异步任务:
      - 提交任务 → 返回task_id → 前端轮询/task/{id}/status → 完成后获取结果
    - Grammarly长文本检测(>5000字)也改为异步

---

# Task Dependencies

```
Sprint 1 (可完全并行):
├── Task 1 (#57 Originality优化) ──────────────┐
├── Task 2 (#62 Grammarly优化) ─────────────────┤
├── Task 3 (#74 BuyMeACoffee增强) ──────────────┤──→ Day 5: 集成测试
├── Task 4 (#59 Copyscale前端) ─────────────────┤
└── Task 5 (#63 Resume前端) ────────────────────┘

Sprint 2 (有依赖关系):
├── Task 6 (#58学术增强) ← 无依赖
├── Task 7 (#56 Flowise重构) ← 无依赖(但最复杂，需最早启动)
├── Task 8 (定价支付) ← 依赖Task 3(打赏支付验证)
├── Task 9 (引导联动) ← 依赖Task 1,2,4,5(需要产品页面稳定)
└── Task 10 (仪表盘) ← 依赖Task 3,8(收入数据源)

Sprint 3 (最后执行):
├── Task 11 (前端性能) ← 依赖Sprint 1+2所有前端改动完成
└── Task 12 (后端性能) ← 依赖Sprint 1+2所有后端改动完成
```

---

# 并行执行策略

## Day 1-2 (4个Task并行)
- Agent A: Task 1 (#57 Originality)
- Agent B: Task 2 (#62 Grammarly)  
- Agent C: Task 4 (#59 Copyscale)
- Agent D: Task 5 (#63 Resume)

## Day 3
- Agent A: Task 3 (#74 BuyMeACoffee) - 最快，1天完成
- Agent B: 继续Task 1/2的收尾工作

## Day 4
- 全员: 集成测试 + Bug修复

## Day 5
- QA: 性能基准测试(Lighthouse audit)
- 准备Sprint 2环境

## Day 6-8 (2-3个Task并行)
- Agent A: Task 7 (#56 Flowise) - 最复杂，需3天
- Agent B: Task 6 (#58学术) + Task 8(定价)
- Agent C: Task 9(引导联动) + Task 10(仪表盘)

## Day 9-10
- 全员: Sprint 2联调 + 支付流程端到端测试

## Day 11-12
- Agent A: Task 11(前端性能)
- Agent B: Task 12(后端性能)
- 全员: 最终验收 + 部署准备

---

*文档版本: v1.0 | 创建日期: 2026-06-01*
*基于spec.md v2.0(优化版)，工作量从30天压缩至12天*
