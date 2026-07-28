import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Shield,
  GitBranch,
  Route,
  Terminal,
  Link,
  Network,
  Bug,
  ScanLine,
  EyeOff,
  Layers,
  FileCheck,
  Radar,
  Clock,
  Fingerprint,
  ArrowLeft,
  Star,
  Download,
  CalendarDays,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  Sparkles,
  AlertCircle,
  ChevronRight,
  CheckCircle2,
  Copy,
  Check,
  Package,
  Bot,
  User,
  FileArchive,
} from 'lucide-react';
import {
  Rate,
  Tag,
  Tabs,
  Button,
  Avatar,
  Badge,
  Collapse,
  Timeline,
  Space,
} from 'antd';

const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  Shield,
  GitBranch,
  Route,
  Terminal,
  Link,
  Network,
  Bug,
  ScanLine,
  EyeOff,
  Layers,
  FileCheck,
  Radar,
  Clock,
  Fingerprint,
};

interface Agent {
  id: string;
  name: string;
  nameEn: string;
  desc: string;
  category: string;
  rating: number;
  reviews: number;
  calls: number;
  icon: string;
  gradient: string;
  tags: string[];
  isNew?: boolean;
  isHot?: boolean;
  coverImage: string;
}

interface AgentDetail extends Agent {
  version: string;
  author: string;
  updatedAt: string;
  installCount: number;
  longDesc: string;
  features: string[];
  techSpecs: { label: string; value: string }[];
  usageExample: string;
  changelog: { version: string; date: string; items: string[] }[];
  relatedAgents: string[];
  faq: { q: string; a: string }[];
  triggerMethod: string;
  aiReviewSummary: {
    overall: string;
    highlights: string[];
    caveats: string[];
    suitability: string;
  };
  securityStatus: 'safe' | 'warning' | 'danger';
  securityChecks: { name: string; status: 'pass' | 'warn' | 'fail'; detail?: string }[];
  reviewsList: {
    user: string;
    avatar: string;
    rating: number;
    date: string;
    content: string;
  }[];
}

const agentsData: AgentDetail[] = [
  {
    id: 'ass-gateway',
    name: 'ASS 安全网关',
    nameEn: 'ASS Security Gateway',
    desc: '零信任架构下的统一安全入口，Prompt 注入检测、输入净化、内容分类、签名验签四重防线',
    category: '安全防护',
    rating: 4.9,
    reviews: 2341,
    calls: 12300,
    icon: 'Shield',
    gradient: 'from-teal-500 to-emerald-600',
    tags: ['零信任', '注入检测', '签名验证'],
    isNew: true,
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Digital%20security%20gateway%20with%20glowing%20shield%20icon%2C%20teal%20and%20emerald%20gradient%20background%2C%20cybersecurity%20concept%2C%20modern%20tech%20illustration%2C%20clean%20minimalist%20design&image_size=landscape_16_9',
    version: 'v3.1.0',
    author: '一鉴到底安全团队',
    updatedAt: '2026-06-05',
    installCount: 8920,
    longDesc:
      `ASS（Adaptive Security Shield）安全网关是一鉴到底系统的第一道防线，采用零信任架构设计。它不信任任何输入，对所有进入系统的数据进行四重安全检测：Prompt 注入检测、输入净化处理、内容分类识别、签名验签确认。\n\n该模块位于 L3 层（安全网关层），是整个七层架构执行引擎的核心守门人。无论来自用户输入、API 调用还是其他 Agent 的数据流，都必须经过 ASS 网关的校验才能进入后续处理流程。\n\n核心能力包括：\n\n• **Prompt 注入检测**: 基于 AI 模型的语义分析，识别隐藏在正常文本中的恶意指令注入\n• **输入净化**: 自动移除或转义 XSS、SQL 注入等危险字符序列\n• **内容分类**: 将输入自动分类为代码/文本/结构化数据等类型，路由到对应处理器\n• **签名验签**: 对关键操作进行 HMAC-SHA256 签名验证，确保来源可信`,
    features: [
      '四重安全防线：检测→净化→分类→验签',
      '基于语义分析的 Prompt 注入识别',
      '支持自定义安全策略规则库',
      '实时威胁情报同步更新',
      '低于 5ms 的平均响应延迟',
      '完整的审计日志与告警通知',
    ],
    techSpecs: [
      { label: '架构层级', value: 'L3 安全网关' },
      { label: '检测模型', value: 'DeepSeek + 自研规则引擎' },
      { label: '平均延迟', value: '< 5ms' },
      { label: '吞吐量', value: '10,000 req/s' },
      { label: '误报率', value: '< 0.01%' },
      { label: '支持协议', value: 'HTTP/gRPC/WebSocket' },
    ],
    usageExample: `# 接入 ASS 安全网关
from p2p_app.services.security_gateway import ASSSecurityGateway

gateway = ASSSecurityGateway()
result = gateway.inspect({
    "content": user_input,
    "source": "web_form",
    "context": {"user_id": "u123"}
})

if result.is_safe:
    process(result.sanitized_content)
else:
    alert_security_team(result.threat_type)`,
    changelog: [
      {
        version: 'v3.1.0',
        date: '2026-06-05',
        items: ['新增 Prompt 注入深度语义检测', '优化批量请求性能 +40%', '新增自定义规则 DSL'],
      },
      {
        version: 'v3.0.0',
        date: '2026-05-15',
        items: ['全面重构为零信任架构', '新增签名验签模块', '新增实时威胁情报'],
      },
      {
        version: 'v2.5.0',
        date: '2026-04-01',
        items: ['新增 XSS 检测引擎升级', '优化内存占用 -30%'],
      },
    ],
    relatedAgents: ['sandbox-executor', 'hashchain-audit', 'output-verifier'],
    faq: [
      { q: 'ASS 会影响正常使用体验吗？', a: '不会。平均延迟 < 5ms，对用户体验几乎无感知。且支持白名单机制，已验证的安全来源可跳过检测。' },
      { q: '如何自定义安全规则？', a: '通过 Rule DSL 配置文件定义自定义检测模式，支持正则表达式、关键词匹配和 AI 语义三种规则类型。' },
      { q: '支持哪些类型的注入检测？', a: '目前覆盖 Prompt Injection、XSS、SQL Injection、Command Injection、Path Traversal 等 12 类常见攻击向量。' },
    ],
    triggerMethod: '一鉴到底安全网关 /inspect 接口调用',
    aiReviewSummary: {
      overall: '高质量的零信任安全网关型 Agent Skill，四重防线设计完善，在 Prompt 注入检测场景表现尤为突出。作为系统第一道防线，其架构设计值得深入研究。',
      highlights: [
        '四重安全防线架构设计精妙，从检测→净化→分类→验签形成完整闭环',
        '基于语义分析的 Prompt 注入识别准确率极高，实战中拦截了大量高级攻击',
        '低于 5ms 的延迟对业务几乎无侵入，白名单机制灵活易用',
        '文档详尽，包含完整的 Rule DSL 自定义指南和最佳实践',
      ],
      caveats: [
        '纯网关型 Skill，不含可执行脚本，需配合下游执行引擎使用',
        '自定义规则 DSL 有一定学习成本，新手可能需要参考官方模板',
        '视频生成等非文本类内容的检测能力相对较弱',
      ],
      suitability: '最需要对输入数据进行多层安全过滤的 Agent 开发者，特别是处理用户生成内容（UGC）或 API 对接场景的用户。',
    },
    securityStatus: 'safe',
    securityChecks: [
      { name: '代码注入风险', status: 'pass', detail: '无危险函数调用' },
      { name: '数据泄露风险', status: 'pass', detail: '不收集外部数据' },
      { name: '权限滥用风险', status: 'pass', detail: '仅读取权限' },
      { name: '依赖安全性', status: 'pass', detail: '依赖均为官方维护' },
      { name: '输出完整性', status: 'warn', detail: '签名验证为可选配置' },
    ],
    reviewsList: [
      { user: 'dev_zhang', avatar: '张', rating: 5, date: '2026/6/5', content: '非常好用的安全网关，零信任架构设计很棒！四重防线帮我们拦住了好几次 Prompt 注入尝试，接入也简单，强烈推荐。' },
      { user: 'sec_expert', avatar: '李', rating: 4, date: '2026/6/4', content: 'Prompt 注入检测效果不错，基于语义分析的识别率比预期高。自定义规则 DSL 功能强大但学习曲线稍陡，建议出更多示例模板。' },
      { user: 'ai_researcher', avatar: '王', rating: 5, date: '2026/6/3', content: '集成简单，文档清晰，5个星！延迟控制在 5ms 以内对业务几乎零影响。白名单机制让已验证来源可以跳过检测，很贴心。' },
      { user: 'cto_chen', avatar: '陈', rating: 5, date: '2026/6/2', content: '企业级安全方案的首选。四重防线的设计思路非常清晰，从检测到验签形成完整闭环。我们已经在生产环境跑了两个月，稳定性很好。' },
      { user: 'fullstack_liu', avatar: '刘', rating: 4, date: '2026/5/30', content: '功能全面但配置项较多，初次接入需要花些时间理解各层的作用。不过一旦配好后基本不用管了，省心。' },
      { user: 'ops_wang', avatar: '赵', rating: 5, date: '2026/5/28', content: '审计日志功能太有用了，每次安全事件都能追溯到具体哪条规则触发的。告警通知也很及时，运维友好度满分。' },
    ],
  },
  {
    id: 'dag-orchestrator',
    name: 'DAG 工作流编排',
    nameEn: 'Workflow Orchestrator',
    desc: '基于 DAG 有向无环图的智能任务编排引擎，支持条件分支、并行执行与容错重试',
    category: '流程编排',
    rating: 4.8,
    reviews: 1876,
    calls: 8700,
    icon: 'GitBranch',
    gradient: 'from-cyan-500 to-blue-600',
    tags: ['DAG', '并行', '容错'],
    isHot: true,
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=DAG%20workflow%20orchestration%20with%20connected%20nodes%20and%20arrows%2C%20cyan%20and%20blue%20gradient%2C%20abstract%20network%20graph%2C%20modern%20tech%20illustration&image_size=landscape_16_9',
    version: 'v2.8.2',
    author: '一鉴到底核心团队',
    updatedAt: '2026-06-03',
    installCount: 6540,
    longDesc:
      `DAG 工作流编排器是一鉴到底系统 L2 编排层的核心组件，负责将用户提交的校验任务拆解为有向无环图（DAG）形式的有依赖关系子任务序列。\n\n作为整个七层架构的大脑，编排器接收来自前端或 API 的任务请求后，会进行智能的任务分解与拓扑排序，生成最优执行计划。支持复杂的条件分支逻辑、并行流水线执行、以及基于策略的容错与重试机制。\n\n编排器的核心设计理念是「声明式任务定义 + 自适应执行调度」，开发者只需描述"做什么"，编排器负责决定"怎么做"。`,
    features: [
      'DAG 拓扑排序与循环依赖检测',
      '条件分支与动态路由决策',
      '并行流水线执行（最多 64 路并发）',
      '指数退避重试与熔断机制',
      '可视化工作流编辑与调试',
      '任务级快照与断点续跑',
    ],
    techSpecs: [
      { label: '架构层级', value: 'L2 编排层' },
      { label: 'DAG 引擎', value: '自研拓扑排序算法' },
      { label: '最大并发度', value: '64 路并行' },
      { label: '任务粒度', value: '亚秒级调度' },
      { label: '支持节点数', value: '单 DAG ≤ 512 节点' },
      { label: '持久化', value: 'SQLite + Redis 双写' },
    ],
    usageExample: `# 定义一个代码校验 DAG 工作流
from p2p_app.services.orchestrator import DAGOrchestrator

orchestrator = DAGOrchestrator()

# 声明式定义任务流程
workflow = orchestrator.define({
    "name": "code_review_pipeline",
    "tasks": [
        {"id": "security_check", "agent": "ass-gateway", "deps": []},
        {"id": "static_analysis", "agent": "code-detector", "deps": ["security_check"]},
        {"id": "sandbox_run", "agent": "sandbox-executor", "deps": ["security_check"]},
        {"id": "result_aggregate", "agent": "result-aggregator",
         "deps": ["static_analysis", "sandbox_run"]},
    ]
})

# 提交执行
run = workflow.submit({"code": user_code})
print(run.status)  # running | completed | failed`,
    changelog: [
      {
        version: 'v2.8.2',
        date: '2026-06-03',
        items: ['新增可视化 DAG 编辑器预览', '优化大图拓扑排序性能 O(n²)→O(n log n)', '修复并行任务竞态问题'],
      },
      {
        version: 'v2.7.0',
        date: '2026-05-10',
        items: ['引入动态条件分支', '新增任务超时熔断', '支持嵌套子工作流'],
      },
    ],
    relatedAgents: ['eihm-router', 'p2p-scheduler', 'result-aggregator'],
    faq: [
      { q: 'DAG 支持多少个节点？', a: '单个 DAG 最多支持 512 个任务节点。如需更大规模，建议拆分为多个子工作流串联执行。' },
      { q: '如何处理循环依赖？', a: '编排器在构建阶段会自动检测循环依赖并抛出明确的错误提示，包含形成环路的具体节点链路。' },
      { q: '任务失败后会怎样？', a: '支持配置重试策略（默认 3 次，指数退避），超过阈值后标记为 FAILED 并触发告警回调。下游依赖该任务的节点会被自动跳过或标记为 SKIPPED。' },
    ],
    triggerMethod: 'DAG 工作流 /submit 接口提交任务',
    aiReviewSummary: {
      overall: '优秀的声明式工作流编排引擎，DAG 模型天然适合复杂的多步骤校验场景。并行执行能力和容错机制在同类产品中处于领先水平。',
      highlights: [
        '声明式 API 设计优雅，开发者只需描述意图无需关心调度细节',
        '64 路并行执行能力强劲，实测复杂流水线吞吐量提升明显',
        '自动循环依赖检测避免了运行时的死锁陷阱',
        '断点续跑功能极大提升了长任务链的可靠性体验',
      ],
      caveats: [
        '512 节点的单 DAG 上限在大规模场景可能需要拆分子图',
        '可视化编辑器目前仍为预览版，部分高级功能需通过 API 配置',
        '嵌套子工作流的调试相对复杂，建议先用简单流程熟悉后再上生产',
      ],
      suitability: '需要构建多步骤自动化处理流程的开发者，尤其是代码审查、数据处理管道等有明确依赖关系的场景。',
    },
    securityStatus: 'safe',
    securityChecks: [
      { name: '代码注入风险', status: 'pass', detail: '仅做编排不执行代码' },
      { name: '数据泄露风险', status: 'pass', detail: '任务数据内部流转' },
      { name: '权限滥用风险', status: 'pass', detail: '最小权限原则设计' },
      { name: '依赖安全性', status: 'pass', detail: '核心依赖自研可控' },
      { name: '资源耗尽风险', status: 'warn', detail: '需合理设置并发上限' },
    ],
    reviewsList: [
      { user: 'architect_lin', avatar: '林', rating: 5, date: '2026/6/3', content: 'DAG 编排模型选对了！我们的代码审查流水线从串行改并行后效率提升 3 倍多。声明式 API 写起来真的很舒服。' },
      { user: 'devops_wu', avatar: '吴', rating: 4, date: '2026/6/1', content: '容错机制做得不错，某个节点挂了能自动重试并跳过不影响整体流程。就是嵌套子工作流的调试工具还需要加强。' },
      { user: 'ml_engineer', avatar: '孙', rating: 5, date: '2026/5/29', content: '用来编排 ML 数据预处理 pipeline 非常合适。64 路并行跑批量特征工程，速度起飞。断点续跑功能救了我好几次。' },
      { user: 'team_lead_zhao', avatar: '郑', rating: 4, date: '2026/5/25', content: '功能强大但上手门槛不低，建议先看官方教程再动手。可视化编辑器的预览版已经能看到雏形了，期待正式版。' },
      { user: 'backend_dev', avatar: '周', rating: 5, date: '2026/5/20', content: '循环依赖检测这个功能太实用了，之前手写工作流经常踩死循环的坑，现在构建阶段就能发现。好评！' },
      { user: 'platform_eng', avatar: '钱', rating: 4, date: '2026/5/15', content: '整体满意，512 节点限制对我们来说够用了。希望未来能支持跨 DAG 的任务共享状态，减少重复计算。' },
    ],
  },
  {
    id: 'eihm-router',
    name: 'EIHM 成本路由',
    nameEn: 'EIHM Cost Router',
    desc: '多维度成本估算与最优节点选择，P2P 网络中智能调度至性价比最高的计算资源',
    category: '资源调度',
    rating: 4.7,
    reviews: 1205,
    calls: 6200,
    icon: 'Route',
    gradient: 'from-amber-500 to-orange-600',
    tags: ['成本优化', 'P2P路由', '负载均衡'],
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Intelligent%20cost%20routing%20with%20multiple%20pathways%2C%20amber%20and%20orange%20gradient%2C%20network%20optimization%20concept%2C%20modern%20tech%20illustration&image_size=landscape_16_9',
    version: 'v2.4.1',
    author: '一鉴到底调度团队',
    updatedAt: '2026-06-01',
    installCount: 4890,
    longDesc:
      `EIHM（Economic Intelligence Hash-based Multicast）成本路由器是 L4 路由层的关键决策组件，负责在 P2P 计算网络中为每个任务找到最优执行节点。\n\n它综合考虑节点的算力等级、当前负载、网络延迟、信誉评分和价格因素，使用多目标优化算法计算出全局最优的分配方案。相比传统的轮询或随机分配，EIHM 能将整体计算成本降低约 35%，同时保证服务质量 SLA。\n\n路由器还内置了节点健康评估模型，能提前识别即将过载或故障的节点，实现主动流量迁移。`,
    features: [
      '五维成本模型：算力×负载×延迟×信誉×价格',
      'Pareto 最优解多目标优化',
      '主动式节点健康预测',
      '区域感知就近路由',
      '实时成本报表与趋势分析',
      '支持自定义权重策略',
    ],
    techSpecs: [
      { label: '架构层级', value: 'L4 路由层' },
      { label: '路由算法', value: 'EIHM 多目标优化' },
      { label: '决策维度', value: '5 维加权评分' },
      { label: '路由延迟', value: '< 2ms' },
      { label: '成本节省', value: '约 35%' },
      { label: '节点池规模', value: '支持 1000+ 节点' },
    ],
    usageExample: `# 使用 EIHM 成本路由选择最优节点
from p2p_app.services.cost_router import EIHMCostRouter

router = EIHMCostRouter()

# 查询最优执行节点
best_node = router.select({
    "task_type": "code_execution",
    "required_memory": "2GB",
    "max_latency_ms": 100,
    "priority_cost_weights": {
        "performance": 0.4,
        "cost": 0.35,
        "reliability": 0.25
    }
})

print(f"选中节点: {best_node.node_id}")
print(f"预估成本: ¥{best_node.estimated_cost:.2f}")
print(f"预计延迟: {best_node.estimated_latency}ms")`,
    changelog: [
      {
        version: 'v2.4.1',
        date: '2026-06-01',
        items: ['新增区域感知路由策略', '优化 Pareto 前沿计算效率', '新增成本预算硬限制功能'],
      },
      {
        version: 'v2.3.0',
        date: '2026-04-20',
        items: ['引入五维成本模型 v2', '新增节点健康预测', '支持动态权重调整'],
      },
    ],
    relatedAgents: ['dag-orchestrator', 'p2p-scheduler', 'node-discovery'],
    faq: [
      { q: '成本路由会增加额外延迟吗？', a: '路由决策本身 < 2ms，且结果有缓存机制（TTL 30s），对高频调用几乎无影响。' },
      { q: '如何设置预算上限？', a: '可在 select() 调用时传入 max_budget 参数，路由器会在满足条件的最低成本节点中选择最优解。' },
      { q: '节点故障时如何处理？', a: '路由器每 10 秒刷新一次节点状态，结合心跳服务的实时推送，能在 5 秒内识别故障节点并将流量切换到备选节点。' },
    ],
    triggerMethod: 'EIHM 成本路由 /select 接口查询最优节点',
    aiReviewSummary: {
      overall: '一款构思精巧的多目标优化路由组件，五维成本模型在 P2P 场景下展现出显著的成本节约效果。适合对计算成本敏感的中大型部署环境。',
      highlights: [
        'Pareto 最优解算法在成本和质量之间找到了很好的平衡点',
        '区域感知路由有效降低了跨地域调度的网络延迟',
        '五维权重可自定义，适应不同业务的优先级偏好',
        '实时成本报表让运营团队能清晰追踪每一笔开销',
      ],
      caveats: [
        '小规模集群（< 10 节点）下优化效果不明显，更适合百级以上节点池',
        'Pareto 计算在高频调用时有轻微 CPU 开销，建议配合缓存使用',
        '预算硬限制可能导致无可用节点的边缘情况，需做好降级预案',
      ],
      suitability: '运行 P2P 分布式计算集群且关注成本优化的技术团队，特别是有多地域节点部署的企业用户。',
    },
    securityStatus: 'safe',
    securityChecks: [
      { name: '代码注入风险', status: 'pass', detail: '纯路由决策无代码执行' },
      { name: '数据泄露风险', status: 'pass', detail: '不存储用户数据' },
      { name: '权限滥用风险', status: 'pass', detail: '只读节点元信息' },
      { name: '依赖安全性', status: 'pass', detail: '核心算法自研' },
      { name: '路由劫持风险', status: 'warn', detail: '需确保节点认证机制启用' },
    ],
    reviewsList: [
      { user: 'finops_mgr', avatar: '冯', rating: 5, date: '2026/6/1', content: '用了三个月，整体计算成本降了约 32%！五维模型的权重调节很灵活，我们可以根据业务优先级动态调整策略。' },
      { user: 'infra_lead', avatar: '褚', rating: 4, date: '2026/5/28', content: '区域感知路由效果显著，跨区延迟从平均 80ms 降到 25ms。Pareto 算法偶尔在高并发时会有轻微抖动，但不影响整体。' },
      { user: 'cloud_arch', avatar: '卫', rating: 5, date: '2026/5/22', content: '成本报表功能太棒了，终于能把每一笔计算开销都看清楚了。给老板汇报的时候直接截图就行，数据一目了然。' },
      { user: 'dev_sun', avatar: '蒋', rating: 4, date: '2026/5/18', content: 'API 设计简洁，集成很快。预算限制功能帮我们控制住了月末超支的问题。希望能增加更多维度的历史趋势图表。' },
      { user: 'platform_owner', avatar: '沈', rating: 4, date: '2026/5/12', content: '1000+ 节点的池子跑得很稳。节点健康预测准确率大概 85% 左右，提前迁移流量避免了好几次故障。' },
      { user: 'startup_cto', avatar: '韩', rating: 4, date: '2026/5/5', content: '对我们这种中小规模集群来说功能略有过剩，但预留的扩展性很好。等节点数上来后价值会更明显。' },
    ],
  },
  {
    id: 'sandbox-executor',
    name: 'Pyodide 沙箱执行',
    nameEn: 'Sandbox Executor',
    desc: '浏览器端 Python/WASM 沙箱，代码静态分析 + 隔离执行 + 结果收集全链路安全可控',
    category: '代码执行',
    rating: 4.9,
    reviews: 3102,
    calls: 15100,
    icon: 'Terminal',
    gradient: 'from-violet-500 to-purple-600',
    tags: ['WASM沙箱', 'Pyodide', '隔离执行'],
    isNew: true,
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Secure%20sandbox%20code%20execution%20environment%2C%20violet%20and%20purple%20gradient%2C%20terminal%20window%20with%20code%2C%20modern%20tech%20illustration&image_size=landscape_16_9',
    version: 'v3.2.0',
    author: '一鉴到底执行引擎团队',
    updatedAt: '2026-06-04',
    installCount: 11200,
    longDesc:
      `Pyodide 沙箱执行器是 L6 执行层的主力引擎之一，利用 WebAssembly 技术在浏览器端运行完整的 Python 运行环境，实现了真正的客户端侧代码执行。\n\n所有用户提交的代码都会在此沙箱中运行，与宿主环境完全隔离。沙箱限制了文件系统访问、网络请求和系统调用，即使代码包含恶意行为也无法逃逸。执行前还会经过静态分析阶段，拦截已知的危险模式。\n\n这是一鉴到底"零信任执行"理念的核心落地——不信任任何一段用户代码，但仍然提供完整的功能体验。`,
    features: [
      'WASM 隔离执行环境，完全脱离宿主系统',
      'Pyodide Python 3.11 完整运行时',
      '执行前 AST 静态分析与危险模式拦截',
      '可配置的资源限额（CPU/内存/时间）',
      '标准输出/错误流实时捕获与展示',
      '执行结果结构化返回（含覆盖率数据）',
    ],
    techSpecs: [
      { label: '架构层级', value: 'L6 执行层' },
      { label: '运行时', value: 'Pyodide (Python 3.11 on WASM)' },
      { label: '内存限制', value: '默认 512MB (可配)' },
      { label: '执行超时', value: '默认 30s (可配)' },
      { label: '启动延迟', value: '< 200ms (热缓存)' },
      { label: '安全级别', value: 'Sandbox Level 3 (最高)' },
    ],
    usageExample: `# 在 Pyodide 沙箱中安全执行用户代码
from p2p_app.services.execution_engine import SandboxExecutor

executor = SandboxExecutor()
result = executor.run(
    code='''
def analyze_text(text):
    words = text.split()
    return len(words), len(text)

count, length = analyze_text("Hello World")
print(f"字数:{count}, 字符长度:{length}")
''',
    timeout_seconds=30,
    memory_limit_mb=256
)

if result.success:
    print("输出:", result.stdout)
    print("执行时间:", f"{result.duration_ms}ms")
else:
    print("错误:", result.stderr)
    print("是否被安全拦截:", result.blocked_by_policy)`,
    changelog: [
      {
        version: 'v3.2.0',
        date: '2026-06-04',
        items: ['升级至 Pyodide 0.26 + Python 3.11', '新增 WASM 多线程支持', '优化冷启动速度 -45%'],
      },
      {
        version: 'v3.1.0',
        date: '2026-05-08',
        items: ['新增 NumPy/Pandas 预装包', '增强危险函数检测规则集', '新增执行覆盖率采集'],
      },
      {
        version: 'v3.0.0',
        date: '2026-03-15',
        items: ['全面重构为 WASM 沙箱架构', '新增资源配额管理', '新增执行快照回放'],
      },
    ],
    relatedAgents: ['ass-gateway', 'code-detector', 'result-aggregator'],
    faq: [
      { q: '沙箱里可以安装第三方库吗？', a: '预装了常用科学计算库（NumPy, Pandas, requests 等）。特殊需求可通过 micropip 在沙箱内按需安装，安装的包仅存在于本次会话。' },
      { q: '执行超时了怎么办？', a: '超时后进程会被强制终止，返回 timeout 错误信息。用户可根据提示优化代码后重新提交。' },
      { q: 'WASM 沙箱的性能如何？', a: '对于典型计算任务，WASM 性能达到原生 Python 的 60%-80%。对于 IO 密集型任务差异更小。我们持续通过 AOT 编译优化提升性能。' },
    ],
    triggerMethod: 'Pyodide 沙箱 /run 接口提交代码执行',
    aiReviewSummary: {
      overall: '业界领先的浏览器端 WASM 沙箱执行方案，安全性达到 Sandbox Level 3 最高等级。Pyodide 3.11 完整运行时的支持使其成为在线编程教育、代码评审等场景的理想选择。',
      highlights: [
        'WASM 隔离真正做到与宿主系统完全隔离，安全边界清晰',
        '预装 NumPy/Pandas 等科学计算库覆盖了大部分数据分析场景',
        'AST 静态分析前置拦截了大量已知危险模式，防御纵深充足',
        '冷启动优化到 200ms 以内的体验非常流畅',
      ],
      caveats: [
        'WASM 性能为原生的 60%-80%，重度计算任务可能感觉明显变慢',
        '沙箱内无法进行真正的网络请求和文件系统操作',
        'micropip 安装第三方包会增加执行时间和内存占用',
      ],
      suitability: '需要在前端/浏览器环境中安全执行用户代码的场景，包括在线 IDE、代码评测平台、AI 编程助手等产品。',
    },
    securityStatus: 'safe',
    securityChecks: [
      { name: '代码注入风险', status: 'pass', detail: 'WASM 完全隔离' },
      { name: '数据泄露风险', status: 'pass', detail: '无网络/文件访问' },
      { name: '权限滥用风险', status: 'pass', detail: 'Sandbox Level 3' },
      { name: '依赖安全性', status: 'pass', detail: 'Pyodide 官方维护' },
      { name: '资源耗尽风险', status: 'warn', detail: '需合理设置超时和内存限制' },
    ],
    reviewsList: [
      { user: 'edu_platform', avatar: '杨', rating: 5, date: '2026/6/4', content: '我们在线编程课用的就是这个！学生写的代码全部在浏览器里跑，服务器零负担。WASM 性能比想象的好很多。' },
      { user: 'code_judge', avatar: '朱', rating: 5, date: '2026/6/2', content: '做了个 OJ 平台，沙箱安全性让人放心。NumPy/Pandas 预装太方便了，数据科学题直接就能跑。覆盖率采集功能也很实用。' },
      { user: 'ai_coding_asst', avatar: '秦', rating: 5, date: '2026/5/30', content: 'AI 编程助手的完美搭档！用户生成的代码直接丢进沙箱执行看结果，反馈循环完整。冷启动 200ms 以内用户体验很丝滑。' },
      { user: 'security_auditor', avatar: '许', rating: 4, date: '2026/5/26', content: 'Sandbox Level 3 的安全评级通过了我们的内部审计。AST 静态分析拦截了不少危险代码。唯一遗憾是不能做真正的 IO 操作。' },
      { user: 'fullstack_dev', avatar: '何', rating: 5, date: '2026/5/20', content: '集成超级简单，几行代码就接上了。资源限额配置灵活，可以根据不同用户等级分配不同的 CPU/内存配额。' },
      { user: 'data_scientist', avatar: '吕', rating: 4, date: '2026/5/15', content: 'Pandas 在 WASM 里跑起来速度还行，大数据集稍微吃力。总体来说是在浏览器里做数据分析的最佳方案了。' },
    ],
  },
  {
    id: 'hashchain-audit',
    name: 'HashChain 审计存证',
    nameEn: 'HashChain Audit Trail',
    desc: '基于哈希链的不可篡改审计日志，每条操作记录链式关联，支持合规报告一键导出',
    category: '合规审计',
    rating: 4.8,
    reviews: 1543,
    calls: 9800,
    icon: 'Link',
    gradient: 'from-emerald-500 to-teal-600',
    tags: ['HashChain', '存证', '合规'],
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Blockchain%20hash%20chain%20audit%20trail%2C%20emerald%20and%20teal%20gradient%2C%20linked%20blocks%20with%20digital%20signatures%2C%20modern%20tech%20illustration&image_size=landscape_16_9',
    version: 'v2.6.0',
    author: '一鉴到底合规团队',
    updatedAt: '2026-06-02',
    installCount: 7350,
    longDesc:
      `HashChain 审计存证服务是 L7 审计层的基石，为系统中每一个关键操作生成不可篡改的链式存证记录。\n\n每条审计日志都包含前一条记录的哈希值，形成密码学意义上的链式结构。任何对历史记录的篡改都会导致后续所有哈希值失效，从而被立即发现。这种设计满足了等保 2.0 三级要求中的审计追踪条款，同时也符合 GDPR 的数据处理记录义务。\n\n存证数据支持一键导出为多种合规报告格式，包括等保测评报告模板、GDPR 数据处理活动记录（RoPA）、个人信息保护影响评估（PIA）报告等。`,
    features: [
      'SHA-256 链式哈希，防篡改密码学保证',
      '全量操作留痕：谁、何时、做了什么、结果如何',
      '支持等保/GDPR/个保法多法规模板导出',
      '审计数据不可删除，仅可追加',
      '支持 Merkle Tree 批量证明与高效验证',
      '定时自动备份与异地容灾',
    ],
    techSpecs: [
      { label: '架构层级', value: 'L7 审计层' },
      { label: '哈希算法', value: 'SHA-256 (链式)' },
      { label: '存储方式', value: 'SQLite + 异地备份' },
      { label: '导出格式', value: 'PDF / JSON / CSV / XML' },
      { label: '保留期限', value: '≥ 180 天 (可配置)' },
      { label: '合规认证', value: '等保三级 / GDPR Art.30' },
    ],
    usageExample: `# 使用 HashChain 记录操作审计
from p2p_app.services.audit_trail import HashChainAudit

audit = HashChainAudit()

# 记录一次完整的安全检查操作
record = audit.log(
    operator="system",
    action="security_inspect",
    target=f"user_input_{request_id}",
    details={
        "input_length": len(user_input),
        "threat_detected": False,
        "processing_time_ms": 3.2,
        "rules_applied": ["prompt_injection", "xss", "sql_injection"]
    },
    result="PASS"
)

# 验证链完整性
is_valid = audit.verify_chain()
print(f"审计链完整性: {'✅ 有效' if is_valid else '❌ 已被篡改'}")

# 导出合规报告
audit.export_report(format="pdf", standard="djbz_3")`,
    changelog: [
      {
        version: 'v2.6.0',
        date: '2026-06-02',
        items: ['新增 Merkle Tree 批量验证', '优化存储空间 -40%（增量压缩）', '新增 PIPL 合规报告模板'],
      },
      {
        version: 'v2.5.0',
        date: '2026-04-18',
        items: ['新增审计数据可视化仪表盘', '支持自定义字段扩展', '新增异常操作实时告警'],
      },
      {
        version: 'v2.0.0',
        date: '2026-02-10',
        items: ['从简单日志升级为 HashChain 架构', '新增密码学完整性验证', '支持多格式合规导出'],
      },
    ],
    relatedAgents: ['ass-gateway', 'compliance-reporter', 'output-verifier'],
    faq: [
      { q: '审计数据可以被删除吗？', a: '不可以。HashChain 设计原则是只追加、不删除、不修改。过期的数据仅可归档转移，原始链始终保持完整。' },
      { q: '如何证明审计数据没有被篡改？', a: '每条记录都包含前一条的哈希值，可通过 verify_chain() 方法一键验证整条链的完整性。任何篡改都会导致哈希不匹配。' },
      { q: '支持哪些合规标准？', a: '目前支持等保 2.0（二级/三级）、GDPR（Art.30 RoPA）、个人信息保护法（PIA）、SOC 2 Type II 等主流合规框架的报告模板。' },
    ],
    triggerMethod: 'HashChain 审计 /log 接口记录操作',
    aiReviewSummary: {
      overall: '企业级合规审计的优秀实现，SHA-256 链式哈希设计在防篡改方面提供了密码学级别的保证。多法规模板导出功能大幅降低了合规报告编制的人力成本。',
      highlights: [
        '链式哈希结构简洁而有效，任何篡改行为都会被立即发现',
        'Merkle Tree 批量验证让大规模审计数据的完整性检查变得高效',
        '等保/GDPR/PIPL 多法规模板覆盖面广，导出一键完成',
        '只追加不删除的设计哲学符合审计行业的最佳实践',
      ],
      caveats: [
        '链式结构意味着早期数据的修改会影响整条链，需谨慎初始化',
        '长期运行的系统审计数据量增长较快，需规划好存储扩容策略',
        '自定义字段的扩展虽然支持但格式校验相对宽松',
      ],
      suitability: '需要满足等保、GDPR、个人信息保护法等合规要求的企业用户，以及金融、医疗、政务等高监管行业的技术团队。',
    },
    securityStatus: 'safe',
    securityChecks: [
      { name: '代码注入风险', status: 'pass', detail: '仅做日志记录' },
      { name: '数据泄露风险', status: 'pass', detail: '审计数据加密存储' },
      { name: '权限滥用风险', status: 'pass', detail: '审计操作独立审计' },
      { name: '依赖安全性', status: 'pass', detail: 'SHA-256 标准算法' },
      { name: '存储安全', status: 'warn', detail: '需定期异地备份' },
    ],
    reviewsList: [
      { user: 'compliance_officer', avatar: '施', rating: 5, date: '2026/6/2', content: '等保测评时审计追踪这块拿了满分！HashChain 的链式证明让测评专家都很认可。一键导出 PDF 报告省了我们好多事。' },
      { user: 'fintech_arch', avatar: '张', rating: 5, date: '2026/5/29', content: '金融行业对审计的要求极其严格，这套方案完美满足了我们的需求。verify_chain() 一键验证的功能在内部审计中反复使用。' },
      { user: 'dpo_europe', avatar: '孔', rating: 5, date: '2026/5/24', content: 'GDPR Art.30 的 RoPA 报告模板质量很高，直接就能用于年度合规申报。Merkle Tree 验证效率也比预期的快。' },
      { user: 'gov_it_mgr', avatar: '曹', rating: 4, date: '2026/5/18', content: '政务项目用的，等保三级要求全部满足。唯一建议是希望能增加更多国产密码算法（SM3/SM4）的支持选项。' },
      { user: 'healthcare_cio', avatar: '严', rating: 5, date: '2026/5/12', content: '医疗数据审计必不可少，这套方案的不可篡改性让我们在患者隐私保护方面更有底气。异常操作告警也很及时。' },
      { user: 'startup_founder', avatar: '华', rating: 4, date: '2026/5/6', content: '对我们创业公司来说合规成本是个大头，这套工具把审计和报告的工作量压缩了很多。就是初期配置需要仔细阅读文档。' },
    ],
  },
  {
    id: 'p2p-scheduler',
    name: 'P2P 任务调度器',
    nameEn: 'P2P Task Scheduler',
    desc: '分布式任务状态机管理，心跳检测 + 节点发现 + 闲时调度三位一体的智能调度系统',
    category: '资源调度',
    rating: 4.6,
    reviews: 987,
    calls: 5400,
    icon: 'Network',
    gradient: 'from-blue-500 to-indigo-600',
    tags: ['状态机', '心跳', '分布式'],
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Distributed%20P2P%20task%20scheduler%20with%20network%20nodes%2C%20blue%20and%20indigo%20gradient%2C%20connected%20devices%20and%20tasks%2C%20modern%20tech%20illustration&image_size=landscape_16_9',
    version: 'v2.3.0',
    author: '一鉴到底调度团队',
    updatedAt: '2026-05-28',
    installCount: 4200,
    longDesc:
      `P2P 任务调度器是 L5 调度层的核心，管理分布式环境中所有任务的生命周期。它采用有限状态机（FSM）模型来跟踪每个任务从创建到完成的全过程状态转换。\n\n调度器与心跳服务深度集成，通过实时心跳检测掌握各节点的在线状态与健康程度。当某节点失联或性能下降时，调度器能自动将任务迁移到健康的备用节点上，确保任务执行的连续性和可靠性。\n\n此外，调度器还能识别集群中的空闲时段，配合闲时检测服务将低优先级的后台任务安排在空闲窗口执行，最大化资源利用率。`,
    features: [
      '12 态 FSM 任务生命周期管理（pending→running→success/failed/cancelled...）',
      '心跳驱动的节点健康实时监控',
      '故障自动迁移与任务接管',
      '优先级队列 + 抢占式调度',
      '闲时窗口智能填充',
      '分布式锁防重复调度',
    ],
    techSpecs: [
      { label: '架构层级', value: 'L5 调度层' },
      { label: '状态机', value: '12 态 FSM (Finite State Machine)' },
      { label: '心跳间隔', value: '5s (可配置 1-30s)' },
      { label: '故障迁移', value: '< 10s 自动接管' },
      { label: '并发任务', value: '单节点 ≤ 200' },
      { label: '通信协议', value: 'WebSocket + gRPC' },
    ],
    usageExample: `# 创建并调度一个 P2P 分布式任务
from p2p_app.services.task_scheduler import P2PTaskScheduler

scheduler = P2PTaskScheduler()

# 提交任务到调度队列
task = scheduler.submit(
    task_type="code_analysis",
    payload={"file_path": "/tmp/user_code.py"},
    priority="high",
    timeout=120,
    retry_policy={"max_retries": 3, "backoff": "exponential"}
)

# 监听任务状态变化
while not task.is_terminal:
    task.refresh()
    print(f"[{task.status}] 进度: {task.progress}%")
    time.sleep(2)

if task.status == "SUCCESS":
    print("结果:", task.result)
elif task.status == "FAILED":
    print("失败原因:", task.error_message)
    # 可查看在哪台节点上执行
    print("执行节点:", task.executed_on_node_id)`,
    changelog: [
      {
        version: 'v2.3.0',
        date: '2026-05-28',
        items: ['重构状态机为 12 态模型', '新增抢占式高优任务调度', '优化心跳检测灵敏度'],
      },
      {
        version: 'v2.2.0',
        date: '2026-04-05',
        items: ['新增任务依赖图调度', '支持批量任务提交', '新增调度看板 API'],
      },
    ],
    relatedAgents: ['eihm-router', 'node-discovery', 'idle-detector'],
    faq: [
      { q: '任务调度失败怎么办？', a: '调度器会根据配置的重试策略自动重试（默认 3 次，指数退避）。所有节点均不可用时会进入等待队列，待节点恢复后自动执行。' },
      { q: '如何查看任务执行在哪里？', a: '每个 task 对象都有 executed_on_node_id 字段，可追踪具体在哪个 P2P 节点上执行，以及该节点的详细状态信息。' },
      { q: '支持任务优先级吗？', a: '支持 low / normal / high / critical 四级优先级。高优任务可抢占低优任务的资源，critical 级别拥有最高调度权。' },
    ],
    triggerMethod: 'P2P 调度器 /submit 接口提交任务',
    aiReviewSummary: {
      overall: '稳健的分布式任务调度解决方案，12 态 FSM 模型覆盖了任务生命周期的各种边缘情况。心跳驱动的健康监控和故障自动迁移是其核心竞争力。',
      highlights: [
        '12 态 FSM 状态机设计完备，覆盖了 pending/running/success/failed/cancelled/timed_out 等全部状态',
        '< 10 秒的故障自动迁移速度在同类产品中属于优秀水平',
        '抢占式调度让高优任务能够及时获得资源保障',
        '四级优先级队列设计灵活，适配不同业务场景的需求',
      ],
      caveats: [
        '单节点 200 并发任务的上限在高密度场景可能需要横向扩展',
        '抢占式调度可能导致低优任务频繁被中断，需合理设置优先级策略',
        '分布式锁在网络分区时可能出现短暂的不一致窗口',
      ],
      suitability: '运行 P2P 分布式计算集群且需要精细控制任务生命周期的团队，特别是对任务可靠性和故障恢复有严格要求的生产环境。',
    },
    securityStatus: 'safe',
    securityChecks: [
      { name: '代码注入风险', status: 'pass', detail: '仅做调度不执行代码' },
      { name: '数据泄露风险', status: 'pass', detail: '任务数据端到端加密' },
      { name: '权限滥用风险', status: 'pass', detail: 'RBAC 权限控制' },
      { name: '依赖安全性', status: 'pass', detail: 'gRPC + WebSocket 标准' },
      { name: 'DDoS 风险', status: 'warn', detail: '需配置请求限流' },
    ],
    reviewsList: [
      { user: 'distributed_sys', avatar: '姜', rating: 5, date: '2026/5/28', content: '12 态 FSM 太专业了，之前用简单的三态机总遇到状态丢失的问题，现在每种边缘情况都有对应的处理路径。' },
      { user: 'sre_team', avatar: '谢', rating: 4, date: '2026/5/24', content: '故障迁移确实快，测试过模拟节点宕机的场景，8 秒左右就完成了任务接管。心跳检测灵敏度可调这点很好。' },
      { user: 'batch_processor', avatar: '邹', rating: 5, date: '2026/5/19', content: '批量任务提交功能帮我们每天处理上万条数据处理任务。四级优先级队列让紧急任务不再排队等待。' },
      { user: 'infra_ops', avatar: '窦', rating: 4, date: '2026/5/14', content: '调度看板 API 很好用，可以在 Grafana 里直接对接展示集群状态。希望能增加更多自定义指标的支持。' },
      { user: 'game_backend', avatar: '章', rating: 4, date: '2026/5/9', content: '游戏服的后台任务调度用的这个，抢占式调度保证了战斗结算这类高优任务的及时性。低优任务偶尔被中断但在接受范围内。' },
      { user: 'ml_platform', avatar: '苏', rating: 5, date: '2026/5/3', content: 'ML 训练任务调度完美匹配！分布式锁防止了重复训练的问题。任务状态追踪从提交到完成全程可见，调试很方便。' },
    ],
  },
  {
    id: 'code-detector',
    name: '代码风险检测',
    nameEn: 'Code Risk Detector',
    desc: '多语言代码静态分析，危险函数识别、SQL注入/XSS/命令注入等安全漏洞扫描',
    category: '代码检测',
    rating: 4.9,
    reviews: 2890,
    calls: 18200,
    icon: 'Bug',
    gradient: 'from-red-500 to-rose-600',
    tags: ['静态分析', '漏洞扫描', '多语言'],
    isHot: true,
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Code%20security%20vulnerability%20scanner%2C%20red%20and%20rose%20gradient%2C%20bug%20detection%20with%20magnifying%20glass%2C%20modern%20tech%20illustration&image_size=landscape_16_9',
    version: 'v3.5.1',
    author: '一鉴到底安全团队',
    updatedAt: '2026-06-05',
    installCount: 10500,
    longDesc:
      `代码风险检测器是系统中最活跃的 Agent 之一，专门针对用户提交的代码进行深度的静态安全分析。它支持 Python、JavaScript、TypeScript、Java、Go 等主流编程语言，能在代码执行前识别出潜在的安全漏洞。\n\n检测引擎内置了超过 500 条安全规则，涵盖 OWASP Top 10 中所有常见的代码级漏洞类别：SQL 注入、XSS 跨站脚本、命令注入、路径遍历、不安全的反序列化、硬编码密钥等。每条检测结果都会给出具体的漏洞位置、风险等级和修复建议。\n\n该检测器在 L6 执行层之前运行，属于「预执行安检」环节，与 ASS 网关形成前后两道防线。`,
    features: [
      '支持 8+ 编程语言的 AST 级静态分析',
      '500+ 内置安全规则（OWASP Top 10 全覆盖）',
      '漏洞分级：Critical / High / Medium / Low / Info',
      '精确到行号的漏洞定位与修复建议',
      '自定义规则 DSL，支持团队安全规范扩展',
      'SARIF 格式输出，兼容主流 DevSecOps 工具链',
    ],
    techSpecs: [
      { label: '架构层级', value: 'L6 执行层 (预检)' },
      { label: '分析方法', value: 'AST + 控制流 + 数据流' },
      { label: '支持语言', value: 'Python/JS/TS/Java/Go/Ruby/C#' },
      { label: '规则数量', value: '500+ 条' },
      { label: '分析速度', value: '< 500ms / 1000 行' },
      { label: '输出格式', value: 'SARIF / JSON / HTML Report' },
    ],
    usageExample: `# 对代码进行全面安全扫描
from p2p_app.services.code_detector import CodeRiskDetector

detector = CodeRiskDetector()

scan_result = detector.scan(
    language="python",
    code=user_submitted_code,
    ruleset="owasp_top10_extended"
)

print(f"发现 {len(scan_result.vulnerabilities)} 个安全问题")
for vuln in scan_result.vulnerabilities:
    print(f"""
  [{vuln.severity.upper()}] 第{vuln.line}行: {vuln.title}
  → {vuln.description}
  → 修复建议: {vuln.remediation}
""")

# 导出 SARIF 报告（兼容 GitHub Code Scanning）
scan_result.export_sarif("security_scan.sarif")`,
    changelog: [
      {
        version: 'v3.5.1',
        date: '2026-06-05',
        items: ['新增 Rust 语言支持', '增强供应链依赖漏洞检测', '优化大型文件分析性能 +50%'],
      },
      {
        version: 'v3.4.0',
        date: '2026-05-20',
        items: ['新增 AI 辅助修复建议', '支持 SARIF 2.1.0 标准', '新增自定义规则市场'],
      },
      {
        version: 'v3.0.0',
        date: '2026-03-01',
        items: ['全面升级为多语言 AST 分析引擎', '从正则匹配升级为语义分析', '新增数据流追踪能力'],
      },
    ],
    relatedAgents: ['ass-gateway', 'sandbox-executor', 'content-moderator'],
    faq: [
      { q: '误报率怎么样？', a: '综合误报率控制在 5% 以内。对于 Info 和 Low 级别可能存在少量误报，High 和 Critical 级别的准确率 > 98%。' },
      { q: '可以添加自己的检测规则吗？', a: '可以。通过 Rule DSL 定义自定义模式，支持 AST 模式匹配、数据流追踪和正则表达式三种编写方式。' },
      { q: '扫描会影响代码执行速度吗？', a: '扫描在代码进入沙箱前完成，通常耗时 200-500ms（取决于代码长度），对整体流程的影响可控。' },
    ],
    triggerMethod: '代码风险检测 /scan 接口扫描代码',
    aiReviewSummary: {
      overall: '顶级的静态代码安全分析工具，500+ 规则覆盖 OWASP Top 10 全部类别。AST 级别的语义分析远超传统正则方案，SARIF 输出无缝对接 DevSecOps 工具链。',
      highlights: [
        '8 种语言的 AST 级分析能力在同类产品中罕见，尤其对 Python/JS/TS 支持最成熟',
        'AI 辅助修复建议功能让开发者不再只是看到问题还能知道怎么修',
        'SARIF 2.1.0 输出可直接导入 GitHub Code Scanning，CI/CD 集成零摩擦',
        '供应链依赖检测补齐了现代软件安全的最后一块拼图',
      ],
      caveats: [
        'Info/Low 级别的误报率约 5%，需要团队建立忽略规则的白名单习惯',
        '超大型单体文件（> 10000 行）的分析耗时可能超过 1 秒',
        '自定义 Rule DSL 的数据流追踪模式编写难度较高',
      ],
      suitability: '需要进行代码安全扫描的开发和安全团队，特别是使用 GitHub Actions/GitLab CI 做 DevSecOps 的现代化研发组织。',
    },
    securityStatus: 'safe',
    securityChecks: [
      { name: '代码注入风险', status: 'pass', detail: '仅分析不执行' },
      { name: '数据泄露风险', status: 'pass', detail: '代码不上传外部' },
      { name: '权限滥用风险', status: 'pass', detail: '只读分析权限' },
      { name: '依赖安全性', status: 'pass', detail: '核心引擎自研' },
      { name: '规则篡改风险', status: 'warn', detail: '自定义规则需审核' },
    ],
    reviewsList: [
      { user: 'sec_lead', avatar: '鲁', rating: 5, date: '2026/6/5', content: 'OWASP Top 10 全覆盖，我们安全团队的日常必备工具。AI 修复建议功能上线后开发同学的采纳率明显提高了。' },
      { user: 'github_power', avatar: '韦', rating: 5, date: '2026/6/3', content: 'SARIF 直接推到 GitHub Code Scanning，PR 里自动显示安全问题。CI/CD 集成一行命令搞定，DevSecOps 的标杆产品。' },
      { user: 'python_dev', avatar: '昌', rating: 5, date: '2026/5/29', content: 'Python 的 AST 分析做得太细了，连隐式的类型混淆都能抓出来。500ms 内扫完 1000 行代码，速度完全可以接受。' },
      { user: 'java_arch', avatar: '马', rating: 4, date: '2026/5/24', content: 'Java 支持也不错，Spring 相关的安全规则很全。Info 级别的误报稍多但可以通过白名单管理。Rust 支持是新亮点！' },
      { user: 'startup_ciso', avatar: '苗', rating: 5, date: '2026/5/18', content: '创业公司没有专职安全工程师也能用这个做基础防护。规则市场里的社区规则质量很高，拿来即用。' },
      { user: 'consultant_firm', avatar: '方', rating: 4, date: '2026/5/12', content: '给客户做代码审计时用的主力工具之一。报告格式专业，漏洞定位精确到行号。供应链检测是加分项。' },
    ],
  },
  {
    id: 'content-moderator',
    name: '内容安全审核',
    nameEn: 'Content Moderator',
    desc: '文本/HTML 内容过滤与净化，XSS 防护、敏感信息脱敏、输出完整性校验一站式处理',
    category: '安全防护',
    rating: 4.7,
    reviews: 1654,
    calls: 11200,
    icon: 'ScanLine',
    gradient: 'from-pink-500 to-rose-600',
    tags: ['内容过滤', 'XSS防护', '脱敏'],
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Content%20moderation%20and%20filtering%20system%2C%20pink%20and%20rose%20gradient%2C%20shield%20with%20filter%20icons%2C%20modern%20tech%20illustration&image_size=landscape_16_9',
    version: 'v2.5.0',
    author: '一鉴到底安全团队',
    updatedAt: '2026-05-30',
    installCount: 6890,
    longDesc:
      `内容安全审核 Agent 负责对所有进出系统的文本和 HTML 内容进行过滤与净化处理。它是 ASS 安全网关在内容层面的补充，专注于输出侧的安全保障。\n\n审核器的工作范围包括：检测并清理 HTML 中的 XSS 攻击向量、识别并脱敏敏感个人信息（手机号、身份证、银行卡等）、过滤违规关键词和不良内容、以及验证输出数据的格式完整性。\n\n它与数据脱敏引擎（Data Masker）协同工作——内容审核负责识别敏感信息的上下文边界，脱敏引擎负责具体的遮蔽替换操作。两者组合构成了完整的「输入→处理→输出」全链路内容安全保障。`,
    features: [
      'HTML DOM 级别 XSS 向量深度清理',
      '基于 NLP 的敏感信息上下文识别',
      '多级关键词过滤（政治/色情/暴力/广告等）',
      '输出格式完整性校验（JSON Schema / HTML 结构）',
      '自定义过滤词库与白名单机制',
      '审核结果可追溯，支持人工复审流程',
    ],
    techSpecs: [
      { label: '架构层级', value: 'L3 网关层 + L6 输出层' },
      { label: 'HTML 解析', value: 'DOM 树递归清洗' },
      { label: 'NLP 模型', value: '自研 BERT-CRF 序列标注' },
      { label: '词库规模', value: '50,000+ 敏感词' },
      { label: '处理延迟', value: '< 15ms (文本 < 10KB)' },
      { label: '准确率', value: '召回率 96.5% / 精确率 94.2%' },
    ],
    usageExample: `# 内容安全审核与净化
from p2p_app.services.content_moderator import ContentModerator

moderator = ContentModerator()

# 审核用户生成的 HTML 内容
result = moderator.inspect(
    content=user_html_content,
    mode="strict",           # strict / normal / relaxed
    check_xss=True,
    check_pii=True,
    check_keywords=True,
    allowed_tags=["p", "br", "strong", "em", "a"]
)

if result.is_clean:
    safe_html = result.sanitized_content
    print(f"✅ 内容安全，已净化 {len(result.removals)} 处风险")
else:
    print(f"⚠️ 发现 {len(result.violations)} 个违规项:")
    for v in result.violations:
        print(f"  - [{v.type}] {v.detail} (位置: {v.position})")`,
    changelog: [
      {
        version: 'v2.5.0',
        date: '2026-05-30',
        items: ['新增 BERT-CRF 敏感信息识别模型', '优化 HTML 清洗算法，减少过度过滤', '新增人工复审工作流接口'],
      },
      {
        version: 'v2.4.0',
        date: '2026-04-12',
        items: ['新增图片 OCR 文字审核', '支持 Markdown 格式解析', '优化长文本分块处理'],
      },
      {
        version: 'v2.0.0',
        date: '2026-02-20',
        items: ['从简单正则升级为 NLP 智能审核', '新增 HTML DOM 解析清洗', '新增多级审核策略'],
      },
    ],
    relatedAgents: ['ass-gateway', 'data-masker', 'output-verifier'],
    faq: [
      { q: '会不会把正常内容误判为违规？', a: '存在一定概率的误报（约 5.8%）。支持白名单机制，可将已知的安全内容加入免审列表。同时提供人工复审通道纠正误判。' },
      { q: '支持哪些语言的内容审核？', a: '目前主要支持中文和英文的高精度审核。其他语言使用通用规则兜底，准确率相对较低。' },
      { q: 'HTML 审核会破坏原有样式吗？', a: '不会。审核器只会移除危险标签和属性（如 script、onclick），保留允许的白名单标签及其合法属性不变。' },
    ],
    triggerMethod: '内容审核 /inspect 接口过滤内容',
    aiReviewSummary: {
      overall: '功能全面的 NLP 内容安全审核方案，BERT-CRF 模型在中文场景下的敏感信息识别效果突出。DOM 级 XSS 清洗比传统的正则方案更彻底，适合 UGC 密集型平台。',
      highlights: [
        'BERT-CRF 序列标注模型对中文 PII 的识别准确率达到行业领先水平',
        'DOM 级 HTML 清洗能处理嵌套标签和事件属性等复杂 XSS 向量',
        '三档审核策略（strict/normal/relaxed）适应不同风险等级的业务场景',
        '人工复审工作流弥补了自动化审核的不足，形成人机协作闭环',
      ],
      caveats: [
        '英文内容的审核精度略低于中文，多语言场景需额外配置规则',
        '50 万词库的维护更新需要持续投入，过期词汇可能产生漏判',
        '严格模式下存在约 5.8% 的误报率，白名单管理需要运营配合',
      ],
      suitability: '运营 UGC 平台、社交应用、论坛社区等内容密集型产品的技术团队，特别是对中文内容安全有强需求的场景。',
    },
    securityStatus: 'safe',
    securityChecks: [
      { name: '代码注入风险', status: 'pass', detail: '仅做内容过滤' },
      { name: '数据泄露风险', status: 'pass', detail: '不上传外部服务' },
      { name: '权限滥用风险', status: 'pass', detail: '只读审核权限' },
      { name: 'NLP 模型安全', status: 'pass', detail: '本地推理无外传' },
      { name: '过度过滤风险', status: 'warn', detail: 'Strict 模式可能误伤正常内容' },
    ],
    reviewsList: [
      { user: 'community_mgr', avatar: '俞', rating: 5, date: '2026/5/30', content: '社区平台的内容审核主力工具！BERT-CRF 对中文敏感信息的识别太准了，手机号身份证号基本一抓一个准。' },
      { user: 'social_app_lead', avatar: '任', rating: 4, date: '2026/5/26', content: 'DOM 级 XSS 清洗比之前的正则方案靠谱多了，那种嵌套好几层的攻击向量都能处理。人工复审流程帮我们降低了客诉率。' },
      { user: 'forum_admin', avatar: '袁', rating: 5, date: '2026/5/21', content: '三档策略设计得很好，普通帖子用 relaxed 就够了，敏感话题自动切 strict。白名单机制让已审核的大 V 内容不会被误杀。' },
      { user: 'ecommerce_pm', avatar: '柳', rating: 4, date: '2026/5/16', content: '商品评论的违规词过滤效果不错。Markdown 解析支持是意外之喜，富文本评论也能正确处理了。' },
      { user: 'content_ops', avatar: '酆', rating: 4, date: '2026/5/10', content: '50 万词库覆盖面广，但新出现的网络热词有时会漏掉。希望词库更新的频率能更高一些。' },
      { user: 'edu_platform_sec', avatar: '鲍', rating: 5, date: '2026/5/4', content: '在线教育平台的作业批注内容审核用的这个，对学生生成内容的过滤既不过度也不遗漏。家长满意度提升了。' },
    ],
  },
  {
    id: 'data-masker',
    name: '数据脱敏引擎',
    nameEn: 'Data Masking Engine',
    desc: '手机号/身份证/银行卡/IP等敏感数据自动识别与遮蔽，支持自定义正则规则扩展',
    category: '隐私保护',
    rating: 4.8,
    reviews: 1321,
    calls: 7600,
    icon: 'EyeOff',
    gradient: 'from-slate-500 to-gray-600',
    tags: ['脱敏', 'PII保护', '正则'],
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Data%20masking%20and%20privacy%20protection%20engine%2C%20slate%20and%20gray%20gradient%2C%20blurred%20sensitive%20data%20with%20lock%20icon%2C%20modern%20tech%20illustration&image_size=landscape_16_9',
    version: 'v2.4.0',
    author: '一鉴到底隐私团队',
    updatedAt: '2026-05-25',
    installCount: 5670,
    longDesc:
      `数据脱敏引擎是隐私保护体系的核心组件，专门负责识别和遮蔽文本中的各类敏感个人信息（PII）。它在数据进入系统存储或展示之前进行自动化脱敏处理，确保即使数据被意外泄露也无法直接关联到具体个人。\n\n引擎内置了对中国境内常见 PII 类型的精准识别：手机号码（11位）、身份证号（18位）、银行卡号（16-19位）、邮箱地址、IP 地址、车牌号等。每种类型都采用针对性的脱敏策略——手机号保留前3后4、身份证隐藏出生日期段、银行卡显示后4位等。\n\n除了内置规则外，还支持通过正则表达式自定义新的敏感数据模式，适应不同业务场景的特殊需求。`,
    features: [
      '15 种内置 PII 类型精准识别（中文场景优化）',
      '针对性脱敏策略：不同数据类型不同遮蔽规则',
      '正则表达式自定义规则扩展',
      '支持部分遮蔽、全遮蔽、替换 token 三种模式',
      '批量文本高效处理（>10,000条/秒）',
      '脱敏操作全程审计记录（联动 HashChain）',
    ],
    techSpecs: [
      { label: '架构层级', value: 'L3 网关层 (数据处理)' },
      { label: '识别方法', value: '正则 + NLP 联合识别' },
      { label: '内置类型', value: '15 种 PII 类型' },
      { label: '处理吞吐', value: '> 10,000 条/秒' },
      { label: '识别准确率', value: '手机号 99.2% / 身份证 98.7%' },
      { label: '脱敏模式', value: '部分遮蔽 / 全遮蔽 / Token 替换' },
    ],
    usageExample: `# 自动识别并脱敏文本中的敏感信息
from p2p_app.services.data_masker import DataMaskingEngine

masker = DataMaskingEngine()

text = """
用户张三的手机号是13812345678，
身份证号110101199001011234，
招商银行卡6225880123456789。
"""

masked = masker.mask(
    text=text,
    modes={
        "phone": "partial",     # 138****5678
        "id_card": "partial",   # 110101********1234
        "bank_card": "partial", # ************6789
        "email": "partial",
    },
    custom_rules=[
        {"pattern": r"\\b张三\\b", "replacement": "***", "name": "姓名"}
    ]
)

print(masked)
# 用户***的手机号是138****5678，
# 身份证号110101********1234，
# 招商银行************6789。`,
    changelog: [
      {
        version: 'v2.4.0',
        date: '2026-05-25',
        items: ['新增地址信息识别与脱敏', '优化身份证号校验算法（含校验码验证）', '新增批量处理流式接口'],
      },
      {
        version: 'v2.3.0',
        date: '2026-04-08',
        items: ['新增 Token 替换脱敏模式', '支持自定义正则规则', '新增脱敏效果预览'],
      },
      {
        version: 'v2.0.0',
        date: '2026-02-15',
        items: ['从简单替换升级为智能识别+策略化脱敏', '新增 15 种内置 PII 类型', '联动审计存证'],
      },
    ],
    relatedAgents: ['content-moderator', 'hashchain-audit', 'compliance-reporter'],
    faq: [
      { q: '脱敏后的数据还能恢复吗？', a: '不能。脱敏是不可逆的操作。如果业务需要保留原始数据用于统计分析，应在脱敏前先保存一份加密副本。' },
      { q: '如何添加新的敏感数据类型？', a: '通过 custom_rules 参数传入正则表达式即可。也支持在配置文件中注册全局规则，所有调用自动生效。' },
      { q: '脱敏会影响系统性能吗？', a: '单次处理延迟 < 1ms（< 1KB 文本），批处理模式下可达万条/秒级别，对整体系统性能影响微乎其微。' },
    ],
    triggerMethod: '数据脱敏 /mask 接口遮蔽敏感信息',
    aiReviewSummary: {
      overall: '专注于中文 PII 识别的数据脱敏引擎，15 种内置类型覆盖了中国境内绝大多数隐私数据场景。联合 NLP 的识别方式比纯正则方案在上下文理解上有明显优势。',
      highlights: [
        '手机号 99.2%、身份证 98.7% 的识别准确率在中文场景下表现优异',
        '针对性脱敏策略（不同类型不同遮蔽规则）兼顾了隐私保护和数据可用性',
        '万条/秒的处理吞吐满足大数据量的实时脱敏需求',
        '联动 HashChain 审计让每一次脱敏操作都可追溯',
      ],
      caveats: [
        '脱敏是不可逆操作，务必在脱敏前确认是否需要保留原文备份',
        '自定义正则规则的编写需要一定的经验，错误规则可能导致过度脱敏',
        '对非标准格式的 PII（如带空格、特殊分隔符的手机号）识别率略有下降',
      ],
      suitability: '涉及用户个人信息处理的各类应用，特别是金融、电商、社交、政务等对数据隐私合规有强要求的行业。',
    },
    securityStatus: 'safe',
    securityChecks: [
      { name: '代码注入风险', status: 'pass', detail: '仅做文本替换' },
      { name: '数据泄露风险', status: 'pass', detail: '脱敏后数据不可还原' },
      { name: '权限滥用风险', status: 'pass', detail: '仅读取待处理文本' },
      { name: '正则 ReDoS', status: 'warn', detail: '自定义规则需防范 ReDoS' },
      { name: '日志残留', status: 'warn', detail: '确保原始数据不留入日志' },
    ],
    reviewsList: [
      { user: 'privacy_officer', avatar: '史', rating: 5, date: '2026/5/25', content: '个保法合规的利器！15 种 PII 类型基本覆盖了我们业务中所有的隐私数据。联动 HashChain 审计让每次脱敏都有据可查。' },
      { user: 'fintech_dev', avatar: '唐', rating: 5, date: '2026/5/21', content: '银行卡号的脱敏策略很专业，保留后 4 位既能满足业务查询又不暴露完整信息。身份证含校验码验证这个细节点赞。' },
      { user: 'ecommerce_data', avatar: '费', rating: 4, date: '2026/5/17', content: '订单详情页的用户信息脱敏用的这个，万条/秒的性能完全扛得住大促流量。Token 替换模式在做数据共享时特别有用。' },
      { user: 'social_dpo', avatar: '廉', rating: 5, date: '2026/5/12', content: '社交媒体的用户主页信息脱敏全覆盖。自定义正则规则让我们能快速适配新的业务字段，扩展性很好。' },
      { user: 'gov_data_team', avatar: '岑', rating: 4, date: '2026/5/7', content: '政务数据开放前的脱敏处理主力。地址信息识别是新加的功能，对街道门牌号的识别还不错。希望能增加更多行政区划相关的规则。' },
      { user: 'saas_plat', avatar: '薛', rating: 5, date: '2026/5/1', content: 'SaaS 多租户场景下每个租户可能有不同的脱敏需求，自定义规则 + 全局配置的组合完美解决了这个问题。' },
    ],
  },
  {
    id: 'result-aggregator',
    name: '结果聚合分发',
    nameEn: 'Result Aggregator',
    desc: '多节点执行结果的智能聚合，多数投票 + 延迟权重 + 分片排序三策略自适应选优',
    category: '结果处理',
    rating: 4.5,
    reviews: 756,
    calls: 4300,
    icon: 'Layers',
    gradient: 'from-lime-500 to-green-600',
    tags: ['聚合', '多数投票', '去重'],
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Result%20aggregation%20and%20distribution%20system%2C%20lime%20and%20green%20gradient%2C%20multiple%20data%20streams%20merging%2C%20modern%20tech%20illustration&image_size=landscape_16_9',
    version: 'v2.2.0',
    author: '一鉴到底核心团队',
    updatedAt: '2026-05-20',
    installCount: 3450,
    longDesc:
      `结果聚合分发器负责收集来自多个 P2P 节点的并行执行结果，并通过智能算法选出最可信的最终结果。在一鉴到底的多节点冗余执行架构中，同一任务可能被分发到多个节点并行执行以提升可靠性，聚合器就是决定"最终答案"的关键角色。\n\n它内置了三种可选的聚合策略：\n\n**多数投票（Majority Vote）**：适用于确定性输出的场景，取出现次数最多的结果作为最终答案。\n\n**延迟权重（Latency Weighted）**：综合考虑结果的正确性信号和响应速度，加权打分选出最优解。\n\n**分片排序（Shard Ranking）**：对于需要排序或去重的结果集，合并多个节点的分片结果并进行全局排序。\n\n聚合器会自动根据任务类型选择最适合的策略，也可由编排器显式指定。`,
    features: [
      '三策略自适应聚合：多数投票 / 延迟权重 / 分片排序',
      '多源结果冲突检测与一致性校验',
      '结果置信度量化评分',
      '支持结构化数据（JSON）和文本的统一聚合',
      '异常结果自动剔除（偏离均值 > 3σ）',
      '聚合过程完整审计（联动 HashChain）',
    ],
    techSpecs: [
      { label: '架构层级', value: 'L6 执行层 (结果汇聚)' },
      { label: '聚合策略', value: 'Majority / Weighted / Rank' },
      { label: '最大源数', value: '16 个并行节点结果' },
      { label: '聚合延迟', value: '< 10ms (≤ 8 源)' },
      { label: '冲突检测', value: '3σ 偏离剔除' },
      { label: '置信度', value: '0.0 ~ 1.0 量化评分' },
    ],
    usageExample: `# 收集多节点执行结果并智能聚合
from p2p_app.services.aggregator import ResultAggregator

aggregator = ResultAggregator()

# 模拟收到 3 个节点的并行执行结果
results = [
    {"node_id": "node_a", "output": "代码无安全风险", "latency_ms": 120, "confidence": 0.95},
    {"node_id": "node_b", "output": "代码无安全风险", "latency_ms": 95, "confidence": 0.92},
    {"node_id": "node_c", "output": "发现低风险: 未使用参数化查询", "latency_ms": 150, "confidence": 0.88},
]

# 使用延迟权重策略聚合
final = aggregator.aggregate(
    results=results,
    strategy="weighted",       # majority / weighted / rank
    confidence_threshold=0.85
)

print(f"最终结果: {final.output}")
print(f"置信度: {final.confidence:.2f}")
print(f"参与节点: {final.source_count} 个")
print(f"是否有冲突: {'是' if final.has_conflict else '否'}")`,
    changelog: [
      {
        version: 'v2.2.0',
        date: '2026-05-20',
        items: ['新增延迟权重聚合策略', '优化冲突检测算法', '新增置信度可视化'],
      },
      {
        version: 'v2.1.0',
        date: '2026-04-01',
        items: ['新增分片排序策略', '支持 JSON 结构化数据聚合', '新增异常结果自动剔除'],
      },
      {
        version: 'v2.0.0',
        date: '2026-02-28',
        items: ['从简单取首结果升级为多策略聚合', '新增多数投票基础策略', '新增冲突检测机制'],
      },
    ],
    relatedAgents: ['p2p-scheduler', 'sandbox-executor', 'dag-orchestrator'],
    faq: [
      { q: '如果所有节点结果都不一致怎么办？', a: '当置信度低于阈值时，聚合器会标记结果为 UNDECIDED 并触发人工审核流程，同时记录详细的分歧报告供参考。' },
      { q: '聚合会增加多少延迟？', a: '聚合本身 < 10ms（8 个以内结果源）。主要延迟来自等待最慢的节点返回结果，可通过设置超时来控制。' },
      { q: '可以自定义聚合策略吗？', a: '可以。支持通过插件机制注册自定义聚合函数，只需实现统一的 AggregatorStrategy 接口即可。' },
    ],
    triggerMethod: '结果聚合 /aggregate 接口合并多源结果',
    aiReviewSummary: {
      overall: '实用的多源结果聚合组件，三策略自适应设计让它能应对确定性输出、时效敏感型和排序类等多种场景。3σ 异常剔除机制有效提升了聚合结果的可靠性。',
      highlights: [
        '三种聚合策略覆盖了大多数分布式执行的结果合并需求',
        '置信度量化评分让上层系统能根据结果可信度做出差异化决策',
        '3σ 统计剔除机制自动过滤明显的异常结果节点',
        'JSON 结构化数据和文本的统一聚合接口减少了集成复杂度',
      ],
      caveats: [
        '16 个结果源的上限在超大规模集群中可能不够用',
        '分片排序策略对内存消耗较大，大批量结果集需注意 OOM 风险',
        '当所有源结果分歧较大时 UNDECIDED 状态需要额外的人工介入逻辑',
      ],
      suitability: '采用多节点冗余执行架构的分布式系统，特别是在代码审查、AI 推理等需要多方验证结果一致性的场景。',
    },
    securityStatus: 'safe',
    securityChecks: [
      { name: '代码注入风险', status: 'pass', detail: '仅做结果聚合' },
      { name: '数据泄露风险', status: 'pass', detail: '结果内部流转' },
      { name: '权限滥用风险', status: 'pass', detail: '只读聚合操作' },
      { name: '依赖安全性', status: 'pass', detail: '核心算法自研' },
      { name: '结果投毒', status: 'warn', detail: '依赖上游节点可信度' },
    ],
    reviewsList: [
      { user: 'dist_sys_arch', avatar: '雷', rating: 4, date: '2026/5/20', content: '多节点冗余执行后的结果合并一直是个痛点，这个聚合器解决了我们的问题。三种策略切换很方便，多数投票用在确定性的场景很稳。' },
      { user: 'ml_infra', avatar: '贺', rating: 5, date: '2026/5/16', content: 'ML 模型推理的多节点结果聚合用的 weighted 策略，综合考虑延迟和置信度的打分方式比简单取均值效果好很多。' },
      { user: 'code_review_plat', avatar: '倪', rating: 4, date: '2026/5/11', content: '代码审查多引擎结果的聚合，3σ 剔除帮我们过滤掉了几个总是给出奇怪结果的坏节点。置信度评分对后续决策很有参考价值。' },
      { user: 'search_eng', avatar: '汤', rating: 4, date: '2026/5/6', content: '分片排序策略在搜索结果合并场景下表现出色。16 源上限对我们来说暂时够用，希望未来能扩展到 32 或更多。' },
      { user: 'fintech_risk', avatar: '滕', rating: 5, date: '2026/5/1', content: '风控模型多版本 A/B 测试的结果聚合神器！UNDECIDED 状态触发人工审核的机制符合金融合规要求。' },
      { user: 'game_server', avatar: '殷', rating: 4, date: '2026/4/25', content: '游戏逻辑校验的多服结果聚合，延迟权重策略让快的节点结果优先被采信。聚合延迟 < 10ms 在实时场景下完全可接受。' },
    ],
  },
  {
    id: 'compliance-reporter',
    name: '合规报告生成',
    nameEn: 'Compliance Reporter',
    desc: '等保/GDPR/个人信息保护法等多法规模板，审计轨迹可视化 + 报告自动生成导出',
    category: '合规审计',
    rating: 4.6,
    reviews: 892,
    calls: 5100,
    icon: 'FileCheck',
    gradient: 'from-teal-600 to-cyan-600',
    tags: ['等保', 'GDPR', '报告'],
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Compliance%20report%20generation%20with%20documents%2C%20teal%20and%20cyan%20gradient%2C%20checklist%20and%20certificate%20icons%2C%20modern%20tech%20illustration&image_size=landscape_16_9',
    version: 'v2.1.0',
    author: '一鉴到底合规团队',
    updatedAt: '2026-05-18',
    installCount: 3980,
    longDesc:
      `合规报告生成器是企业级用户最常用的工具之一，它能将 HashChain 审计存证积累的海量操作记录，自动转化为符合各种法规要求的正式合规报告。\n\n支持的合规框架涵盖国内外主流标准：\n\n• **国内**：网络安全法、数据安全法、个人信息保护法（PIPL）、等保 2.0（二级/三级）\n• **国际**：欧盟 GDPR（含 DPA/ROPA/PIA 模板）、SOC 2 Type II、ISO 27001\n\n报告生成过程完全自动化——选择合规标准 → 设定时间范围 → 选择数据源 → 一键生成 PDF/Word/Excel 格式的专业报告。报告中包含审计轨迹的时间线可视化图表、统计数据摘要、以及合规差距分析的改进建议。\n\n对于等保测评场景，报告可直接用于测评机构的现场核查材料准备。`,
    features: [
      '10+ 国内外合规框架模板（等保/GDPR/SOC2/ISO27001/PIPL）',
      '审计轨迹时间线可视化（交互式图表）',
      '一键导出 PDF / Word / Excel 格式',
      '合规差距分析与整改建议自动生成',
      '支持自定义报告模板与企业品牌定制',
      '报告版本管理与数字签名',
    ],
    techSpecs: [
      { label: '架构层级', value: 'L7 审计层 (报告出口)' },
      { label: '支持标准', value: '等保2.0 / GDPR / SOC2 / ISO27001 / PIPL' },
      { label: '报告格式', value: 'PDF / DOCX / XLSX / HTML' },
      { label: '生成速度', value: '< 5s (月度报告)' },
      { label: '数据可视化', value: 'ECharts 交互式图表' },
      { label: '签名支持', value: 'CA 数字签名 / 时间戳' },
    ],
    usageExample: `# 生成等保三级合规报告
from p2p_app.services.compliance_reporter import ComplianceReporter

reporter = ComplianceReporter()

# 生成等保 2.0 三级测评准备报告
report = reporter.generate(
    standard="djbz_level_3",
    period_start="2026-01-01",
    period_end="2026-06-30",
    data_sources=["hashchain_audit", "access_logs", "security_events"],
    include_charts=True,
    include_gap_analysis=True,
    company_info={
        "name": "示例科技有限公司",
        "report_no": "YJD-2026-Q2-001"
    }
)

# 导出为带数字签名的 PDF
report.export_pdf(
    output_path="./compliance_report_q2.pdf",
    with_digital_signature=True,
    ca_cert_path="./company_ca.pem"
)

print(f"报告已生成: 共 {report.total_pages} 页")`,
    changelog: [
      {
        version: 'v2.1.0',
        date: '2026-05-18',
        items: ['新增 PIPL 个人信息保护法报告模板', '优化 ECharts 图表渲染性能', '新增 CA 数字签名集成'],
      },
      {
        version: 'v2.0.0',
        date: '2026-03-20',
        items: ['从单一等保报告升级为多框架支持', '新增交互式时间线可视化', '新增合规差距分析引擎'],
      },
    ],
    relatedAgents: ['hashchain-audit', 'data-masker', 'ass-gateway'],
    faq: [
      { q: '生成的报告可以直接用于等保测评吗？', a: '报告内容覆盖等保 2.0 三级的大部分测评项，可作为现场核查的支撑材料。但最终仍需配合测评机构的人工访谈和技术测试。' },
      { q: '可以自定义报告模板吗？', a: '支持。提供 Jinja2 模板引擎，企业可上传自己的 Word/PDF 模板，系统会自动填入数据和图表。' },
      { q: '报告数据从哪里来？', a: '默认读取 HashChain 审计存证的数据。也可以指定额外的数据源（如访问日志、安全事件库等）来丰富报告内容。' },
    ],
    triggerMethod: '合规报告 /generate 接口生成报告',
    aiReviewSummary: {
      overall: '面向企业合规团队的实用工具，将繁琐的报告编制工作自动化到了极致。10+ 法规模板覆盖国内外主流合规框架，时间线可视化和差距分析功能具备专业水准。',
      highlights: [
        '等保/GDPR/SOC2/ISO27001/PIPL 五大框架一站搞定，免去了多工具切换的痛苦',
        'ECharts 交互式时间线让审计轨迹一目了然，汇报演示效果出色',
        '合规差距分析自动生成整改建议，节省了大量人工梳理的时间',
        'CA 数字签名集成让报告具备了法律效力层面的可信度',
      ],
      caveats: [
        '报告模板虽多但定制化程度有限，特殊行业需求可能仍需手动调整',
        '月度报告 5 秒生成但年度大数据量报告耗时可能更长',
        '差距分析基于规则引擎，复杂场景的建议可能需要人工复核',
      ],
      suitability: '承担等保测评、GDPR 合规、ISO 认证等工作的企业合规团队、法务部门和信息安全管理人员。',
    },
    securityStatus: 'safe',
    securityChecks: [
      { name: '代码注入风险', status: 'pass', detail: '仅做报告生成' },
      { name: '数据泄露风险', status: 'pass', detail: '报告本地生成' },
      { name: '权限滥用风险', status: 'pass', detail: '报告权限独立管控' },
      { name: '模板安全', status: 'pass', detail: 'Jinja2 沙箱渲染' },
      { name: '签名密钥', status: 'warn', detail: '需妥善保管 CA 证书' },
    ],
    reviewsList: [
      { user: 'djbz_manager', avatar: '毕', rating: 5, date: '2026/5/18', content: '等保三级测评准备的神器！以前编报告要一周，现在选好时间范围一键生成。时间线图表在测评现场演示效果炸裂。' },
      { user: 'gdpr_dpo', avatar: '郝', rating: 5, date: '2026/5/14', content: 'GDPR Art.30 RoPA 报告模板完全符合要求，直接提交给数据保护局没被打回。差距分析的整改建议质量出乎意料地高。' },
      { user: 'enterprise_compliance', avatar: '邬', rating: 4, date: '2026/5/9', content: 'ISO 27001 年审用的这个，A.18 控制措施的审计证据整理效率提升明显。CA 签名功能让报告正式感拉满。' },
      { user: 'pipl_lawyer', avatar: '安', rating: 5, date: '2026/5/4', content: '个保法 PIA 报告模板太及时了！影响评估的各个维度都覆盖到了。律师团队审核后认为报告的专业程度达标。' },
      { user: 'soc2_auditor', avatar: '常', rating: 4, date: '2026/4/28', content: 'SOC 2 Type II 报告的证据收集自动化程度很高。自定义模板功能让我们能加入公司特有的控制措施说明。' },
      { user: 'midsize_ciso', avatar: '乐', rating: 4, date: '2026/4/20', content: '中小企业没有专门的合规团队，这个工具让我们一个人就能应付多种合规要求。就是首次配置需要仔细研究文档。' },
    ],
  },
  {
    id: 'node-discovery',
    name: '节点发现服务',
    nameEn: 'Node Discovery Service',
    desc: 'P2P 网络中节点的动态注册、健康检查与能力广播，支持节点分组与区域感知',
    category: '网络服务',
    rating: 4.4,
    reviews: 543,
    calls: 3200,
    icon: 'Radar',
    gradient: 'from-indigo-500 to-violet-600',
    tags: ['P2P', '服务发现', '健康检查'],
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=P2P%20node%20discovery%20service%20with%20radar%20scan%2C%20indigo%20and%20violet%20gradient%2C%20network%20nodes%20being%20detected%2C%20modern%20tech%20illustration&image_size=landscape_16_9',
    version: 'v2.2.0',
    author: '一鉴到底网络团队',
    updatedAt: '2026-05-15',
    installCount: 2890,
    longDesc:
      `节点发现服务是 P2P 计算网络的「电话簿」，维护着全网所有可用节点的实时状态信息。每当一个新的计算节点上线时，它会自动向发现服务注册自己的身份、能力清单和网络位置；下线时也会优雅地注销。\n\n发现服务不仅是一个简单的节点目录，它还承担着以下关键职责：\n\n• **健康检查**：定期探测每个节点的存活状态和响应延迟\n• **能力广播**：收集并分发各节点的硬件规格、已安装软件、可用服务等元数据\n• **分组管理**：按区域、用途、信誉等级对节点进行分组，方便上层调度器做精细化路由\n• **区域感知**：基于 IP 地理位置信息，帮助路由器实现就近调度\n\n它是整个 P2P 网络稳定运行的底层基础设施。`,
    features: [
      '节点自动注册与优雅注销（Gossip 协议）',
      '多维度健康检查（TCP/HTTP/gRPC 探活）',
      '节点能力画像（CPU/GPU/内存/软件栈）',
      '区域分组与地理感知定位',
      '节点信誉积分动态计算',
      '服务变更实时推送（WebSocket 长连接）',
    ],
    techSpecs: [
      { label: '架构层级', value: '基础设施层 (P2P 网络)' },
      { label: '发现协议', value: 'Gossip + mDNS 混合' },
      { label: '健康探活', value: 'TCP + HTTP 双协议' },
      { label: '节点容量', value: '支持 5000+ 节点' },
      { label: '状态同步', value: '< 3s 最终一致' },
      { label: '分组策略', value: '区域 / 用途 / 信誉' },
    ],
    usageExample: `# 注册节点并广播能力信息
from p2p_app.services.discovery_service import NodeDiscoveryService

discovery = NodeDiscoveryService()

# 新节点上线注册
node = discovery.register(
    node_id="worker-beijing-07",
    region="cn-north-1",
    capabilities={
        "cpu_cores": 16,
        "memory_gb": 64,
        "gpu": "RTX 4090 x 2",
        "supported_tasks": ["code_execution", "ml_inference"],
        "software_stack": ["python3.11", "cuda12.1", "docker"]
    }
)

# 查询特定区域的可用节点
beijing_nodes = discovery.query(
    region="cn-north-1",
    min_reputation=4.0,
    required_capability="gpu"
)

print(f"北京区域 GPU 节点: {len(beijing_nodes)} 个可用")

# 监听网络拓扑变化
discovery.on_topology_change(callback=lambda event: print(f"节点事件: {event}"))`,
    changelog: [
      {
        version: 'v2.2.0',
        date: '2026-05-15',
        items: ['新增 Gossip 协议状态同步', '优化大规模节点注册性能', '新增 WebSocket 实时推送'],
      },
      {
        version: 'v2.1.0',
        date: '2026-04-01',
        items: ['新增区域感知与地理定位', '新增节点信誉积分系统', '优化健康检查策略'],
      },
      {
        version: 'v2.0.0',
        date: '2026-02-20',
        items: ['从中心化注册表升级为 Gossip 分布式发现', '新增能力画像与分组管理', '新增 mDNS 局域网发现'],
      },
    ],
    relatedAgents: ['p2p-scheduler', 'eihm-router', 'idle-detector'],
    faq: [
      { q: '节点发现服务挂了怎么办？', a: '采用 Gossip 协议的去中心化设计，没有单点故障。即使部分节点离线，其余节点仍可通过本地缓存和 Gossip 消息维持网络连通。' },
      { q: '新节点多久能被发现？', a: '注册后 1-3 秒内即可被全网感知（取决于 Gossip 消息传播延迟）。关键变更通过 WebSocket 推送，可实现亚秒级通知。' },
      { q: '如何防止恶意节点注册？', a: '节点注册需要有效的认证令牌（JWT），且初始信誉积分为 0。只有通过足够多的成功任务执行才能逐步建立信誉。低信誉节点不会被调度器选中。' },
    ],
    triggerMethod: '节点发现 /register 注册 + /query 查询',
    aiReviewSummary: {
      overall: '可靠的 P2P 服务发现方案，Gossip 协议的去中心化设计消除了单点故障风险。能力画像和区域感知功能为上层调度提供了丰富的决策依据。',
      highlights: [
        'Gossip 协议的去中心化架构在节点故障时展现了出色的容错能力',
        '节点能力画像（CPU/GPU/软件栈）让调度器能做到精准匹配',
        'WebSocket 实时推送让拓扑变化的感知延迟降到亚秒级',
        '信誉积分系统有效遏制了恶意节点的注册滥用',
      ],
      caveats: [
        '5000 节点规模下 Gossip 消息的网络带宽开销需要关注',
        '初始信誉积分为 0 的新节点可能面临较长的"冷启动"期',
        'mDNS 仅适用于局域网场景，公网部署依赖 Gossip 协议',
      ],
      suitability: '搭建或运营 P2P 分布式计算网络的团队，特别是需要动态管理大量异构计算节点的云原生/边缘计算环境。',
    },
    securityStatus: 'safe',
    securityChecks: [
      { name: '代码注入风险', status: 'pass', detail: '仅做节点目录管理' },
      { name: '未授权注册', status: 'pass', detail: 'JWT 认证 + 信誉门槛' },
      { name: 'Sybil 攻击', status: 'warn', detail: '依赖信誉积累机制' },
      { name: '信息泄露', status: 'pass', detail: '节点元信息脱敏' },
      { name: 'Gossip 泛洪', status: 'warn', detail: '需控制消息传播范围' },
    ],
    reviewsList: [
      { user: 'p2p_infra', avatar: '于', rating: 5, date: '2026/5/15', content: 'Gossip 协议真的稳！模拟过砍掉一半节点的极端场景，剩下的节点靠 Gossip 消息很快重建了拓扑。没有单点故障的感觉太好了。' },
      { user: 'edge_compute', avatar: '顾', rating: 4, date: '2026/5/11', content: '边缘计算集群用的这个，节点上下线频繁但发现服务总能及时同步。能力画像功能让 GPU 节点和 CPU 节点的调度区分变得很简单。' },
      { user: 'cloud_native', avatar: '孟', rating: 4, date: '2026/5/6', content: 'WebSocket 推送的实时性很棒，节点状态变化几乎是瞬间就能在上层 UI 上反映出来。3000 节点规模下运行稳定。' },
      { user: 'blockchain_node', avatar: '黄', rating: 5, date: '2026/5/1', content: '区块链验证节点管理的理想选择。信誉积分系统和 Sybil 攻击防护的思路跟区块链的共识机制很搭。区域分组也很有用。' },
      { user: 'game_server_ops', avatar: '穆', rating: 4, date: '2026/4/25', content: '游戏服节点发现用的，mDNS 在同机房内的局域网发现速度极快。跨区走 Gossip 也还行，1-2 秒就能同步完。' },
      { user: 'research_lab', avatar: '萧', rating: 4, date: '2026/4/18', content: '实验室的异构计算集群管理用的，GPU/CPU/TPU 不同类型的节点分组后调度效率提升明显。新节点冷启动期稍长但可以接受。' },
    ],
  },
  {
    id: 'idle-detector',
    name: '闲时检测服务',
    nameEn: 'Idle Detection Service',
    desc: '利用节点空闲算力执行低优先级后台任务，最大化集群资源利用率',
    category: '资源调度',
    rating: 4.3,
    reviews: 421,
    calls: 2800,
    icon: 'Clock',
    gradient: 'from-yellow-500 to-amber-600',
    tags: ['空闲利用', '后台任务', '节能'],
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Idle%20resource%20detection%20with%20clock%20and%20efficiency%20meter%2C%20yellow%20and%20amber%20gradient%2C%20green%20computing%20concept%2C%20modern%20tech%20illustration&image_size=landscape_16_9',
    version: 'v2.0.0',
    author: '一鉴到底调度团队',
    updatedAt: '2026-05-10',
    installCount: 2340,
    longDesc:
      `闲时检测服务是 P2P 集群的「节能管家」，它的使命是挖掘网络中被浪费的计算资源。在传统调度模型中，节点要么忙碌要么闲置——而闲置就意味着资源的白白浪费。\n\n闲时检测器持续监控每个节点的 CPU、GPU、内存和网络 I/O 利用率。当检测到某个节点的综合负载低于设定阈值（默认 30%）持续超过一定时间（默认 60 秒），就会将其标记为「空闲」状态，并通知调度器为其分配低优先级的后台任务。\n\n这些后台任务包括但不限于：模型预热、数据预处理、日志归档、统计报表生成、安全扫描等非紧急但对算力有一定需求的任务。通过这种方式，集群的整体资源利用率可以从典型的 40%-50% 提升到 80% 以上。`,
    features: [
      '多维负载监控：CPU/GPU/内存/IO 综合评估',
      '可配置的空闲阈值与持续时间',
      '低优先级任务队列自动填充',
      '支持任务抢占（高优任务到达时暂停后台任务）',
      '资源利用率统计与趋势分析面板',
      '绿色计算指标：等效 CO₂ 减排量估算',
    ],
    techSpecs: [
      { label: '架构层级', value: 'L5 调度层 (辅助)' },
      { label: '采样频率', value: '每 5 秒采集一次' },
      { label: '空闲阈值', value: '综合负载 < 30% (可配)' },
      { label: '确认时长', value: '持续 60s 低负载 (可配)' },
      { label: '利用率提升', value: '40% → 80%+' },
      { label: '抢占延迟', value: '< 2s 暂停后台任务' },
    ],
    usageExample: `# 配置闲时检测并注册后台任务
from p2p_app.services.idle_detection_service import IdleDetectionService

idle = IdleDetectionService()

# 配置空闲检测参数
idle.configure(
    cpu_threshold=30,          # CPU < 30% 视为空闲
    memory_threshold=40,       # 内存 < 40%
    idle_duration_sec=60,      # 持续 60s 后确认空闲
    sample_interval_sec=5      # 每 5 秒检测一次
)

# 注册可在闲时执行的后台任务
idle.register_background_task(
    name="nightly_security_scan",
    priority="low",
    required_resources={"cpu": 2, "memory_gb": 4},
    handler="security_batch_scan",
    schedule="idle_only",       # 仅在空闲时执行
    preemptible=True            # 允许被高优任务抢占
)

# 查看集群资源利用率统计
stats = idle.get_utilization_stats()
print(f"当前利用率: {stats.current_utilization}%")
print(f"今日闲时回收: {stats.idle_hours_recycled} 小时")
print(f"等效减碳: {stats.co2_saved_kg:.1f} kg CO₂")`,
    changelog: [
      {
        version: 'v2.0.0',
        date: '2026-05-10',
        items: ['全新发布闲时检测服务', '支持多维负载综合评估', '新增绿色计算碳排放指标'],
      },
      {
        version: 'v1.5.0-beta',
        date: '2026-04-01',
        items: ['内部测试版发布', '基础 CPU/Memory 检测', '后台任务队列原型'],
      },
    ],
    relatedAgents: ['p2p-scheduler', 'node-discovery', 'eihm-router'],
    faq: [
      { q: '闲时执行的任务质量有保障吗？', a: '后台任务使用相同的执行环境和质量标准。唯一的区别是可能被高优任务抢占，此时任务会 checkpoint 后暂停，待资源恢复后继续执行。' },
      { q: '如何避免影响正常用户的任务？', a: '闲时任务严格限制在低优先级队列，且设置了 CPU/内存使用上限（默认不超过节点总资源的 70%）。一旦正常任务到来，闲时任务会在 2 秒内释放资源。' },
      { q: '碳排放是怎么计算的？', a: '基于节点所在地区电网的平均碳强度因子（gCO₂/kWh），结合实际节约的算力消耗换算而来。数据来源于公开的电力碳排放因子数据库。' },
    ],
    triggerMethod: '闲时检测 /configure 配置 + /register 注册后台任务',
    aiReviewSummary: {
      overall: '独具匠心的资源回收方案，将传统调度中被浪费的空闲算力转化为有价值的生产力。绿色计算指标的引入更是契合了当下 ESG 发展的趋势方向。',
      highlights: [
        '多维负载综合评估比单一 CPU 使用率更能准确判断节点真实空闲状态',
        '< 2 秒的抢占延迟保证了对正常任务的零干扰',
        'CO₂ 减排量估算为企业 ESG 报告提供了可量化的绿色计算数据',
        'Checkpoint 机制让被抢占的后台任务能够无损恢复',
      ],
      caveats: [
        '闲时窗口不可预测，不适合有严格截止时间的任务',
        '频繁的抢占/恢复可能对有状态的长时间后台任务造成影响',
        '碳排放因子的精度依赖于公开数据库的更新频率',
      ],
      suitability: '拥有大规模计算集群且关注资源利用率和绿色计算指标的企业，特别是训练/推理混布的 AI 基础设施团队。',
    },
    securityStatus: 'safe',
    securityChecks: [
      { name: '代码注入风险', status: 'pass', detail: '仅做检测与调度' },
      { name: '数据泄露风险', status: 'pass', detail: '不接触业务数据' },
      { name: '资源竞争', status: 'warn', detail: '需合理设置闲时任务资源上限' },
      { name: '依赖安全性', status: 'pass', detail: '轻量级监控组件' },
      { name: '抢占公平性', status: 'warn', detail: '需防止高优任务饿死闲时任务' },
    ],
    reviewsList: [
      { user: 'green_it_lead', avatar: '易', rating: 5, date: '2026/5/10', content: 'ESG 报告里终于有了绿色计算的量化数据！CO₂ 减排量估算功能直接被我们写进了可持续发展报告。利用率从 42% 提升到 81%。' },
      { user: 'ml_platform_ops', avatar: '姚', rating: 4, date: '2026/5/6', content: 'ML 集群的 GPU 空闲时间太多了，用闲时检测跑模型预热和数据预处理，训练启动速度提升了一倍。抢占延迟确实在 2 秒以内。' },
      { user: 'data_eng', avatar: '邵', rating: 5, date: '2026/5/1', content: 'ETL 管道以前只能半夜跑，现在白天有空闲窗口就能插空执行。多维负载评估比单纯看 CPU 准确多了，内存密集型的任务也不会误判。' },
      { user: 'cost_optimizer', avatar: '汪', rating: 4, date: '2026/4/26', content: '云成本优化的重要手段！把 Spot 实例的空闲时间利用起来跑批处理任务，等效于免费增加了 30% 的算力。' },
      { user: 'research_cluster', avatar: '祁', rating: 4, date: '2026/4/20', content: '科研计算集群用的，跑模拟实验的间隙时间可以自动填充参数扫描任务。Checkpoint 恢复机制让长任务不怕被抢占了。' },
      { user: 'startup_devops', avatar: '毛', rating: 4, date: '2026/4/14', content: '初创公司资源有限，这个服务帮我们把每台机器的价值榨干了。配置简单，5 分钟就能跑起来。就是文档还可以再详细一些。' },
    ],
  },
  {
    id: 'output-verifier',
    name: '输出签名验签',
    nameEn: 'Output Verifier',
    desc: '执行结果 HMAC-SHA256 签名与验签，防篡改 + 完整性校验确保输出可信可追溯',
    category: '安全防护',
    rating: 4.7,
    reviews: 1102,
    calls: 6900,
    icon: 'Fingerprint',
    gradient: 'from-fuchsia-500 to-pink-600',
    tags: ['HMAC', '防篡改', '签名'],
    coverImage: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=Digital%20signature%20verification%20with%20fingerprint%20scan%2C%20fuchsia%20and%20pink%20gradient%2C%20HMAC%20security%20seal%2C%20modern%20tech%20illustration&image_size=landscape_16_9',
    version: 'v2.6.0',
    author: '一鉴到底安全团队',
    updatedAt: '2026-06-04',
    installCount: 5870,
    longDesc:
      `输出签名验签器是数据可信链条的最后一道关卡。它确保从执行引擎产出的每一个结果都带有密码学签名，使得任何人在接收到结果时都能独立验证其完整性和来源真实性。\n\n工作流程如下：\n\n1. **签名阶段**：执行完成后，Verifier 对结果内容计算 HMAC-SHA256 摘要，并将签名附加到输出中\n2. **传输阶段**：签名随结果一起传输，中间人无法在不破坏签名的情况下篡改内容\n3. **验签阶段**：接收方（无论是另一个 Agent 还是终端用户）使用共享密钥重新计算摘要并与签名比对\n\n这种机制与 HashChain 审计存证形成了互补——HashChain 保证操作的不可篡改性，Output Verifier 保证结果数据的不可篡改性。两者共同构成了一鉴到底「端到端可信」承诺的技术基础。`,
    features: [
      'HMAC-SHA256 结果签名，抗碰撞抗伪造',
      '签名绑定执行节点 ID + 时间戳，防重放攻击',
      '公开展示验签入口，任何人可独立验证',
      '签名结果联动 HashChain 存证',
      '支持批量验签（一次验证多个结果）',
      '密钥轮换机制，定期自动更新签名密钥',
    ],
    techSpecs: [
      { label: '架构层级', value: 'L6 输出层 + L7 审计层' },
      { label: '签名算法', value: 'HMAC-SHA256' },
      { label: '密钥管理', value: 'KMS 自动轮换 (90天)' },
      { label: '签名大小', value: '64 bytes (hex 128字符)' },
      { label: '验签延迟', value: '< 1ms' },
      { label: '抗重放', value: '时间戳 + Nonce 双重防护' },
    ],
    usageExample: `# 对执行结果进行签名和验签
from p2p_app.services.output_verifier import OutputVerifier

verifier = OutputVerifier()

# === 发送方：签名 ===
execution_result = {"status": "pass", "score": 95, "details": [...]}

signed_output = verifier.sign(
    data=execution_result,
    node_id="worker-shanghai-03",
    context={"task_id": "task_abc123", "user_id": "u456"}
)

print(f"结果: {signed_output.data}")
print(f"签名: {signed_output.signature}")

# === 接收方：验签 ===
is_valid = verifier.verify(
    signed_output=signed_output,
    expected_node_id="worker-shanghai-03"
)

if is_valid:
    print("✅ 验签通过 — 数据未被篡改，来源可信")
    print(f"执行节点: {signed_output.metadata.node_id}")
    print(f"签名时间: {signed_output.metadata.timestamp}")
else:
    print("❌ 验签失败 — 数据可能已被篡改！")`,
    changelog: [
      {
        version: 'v2.6.0',
        date: '2026-06-04',
        items: ['新增 KMS 密钥自动轮换', '优化批量验签性能 +60%', '新增签名状态公开查询 API'],
      },
      {
        version: 'v2.5.0',
        date: '2026-05-12',
        items: ['新增 Anti-Replay 时间戳+Nonce 机制', '签名结果联动 HashChain 存证', '新增验签失败告警'],
      },
      {
        version: 'v2.0.0',
        date: '2026-03-05',
        items: ['从简单 checksum 升级为 HMAC-SHA256 签名', '新增节点身份绑定', '新增公开展示验签入口'],
      },
    ],
    relatedAgents: ['ass-gateway', 'hashchain-audit', 'sandbox-executor'],
    faq: [
      { q: '签名会增加多大的开销？', a: 'HMAC-SHA256 计算非常轻量，签名 < 0.5ms，验签 < 1ms。对整体性能的影响可以忽略不计。' },
      { q: '密钥泄露了怎么办？', a: '密钥由 KMS（密钥管理服务）托管，支持 90 天自动轮换。即使某个密钥泄露，历史签名仍可通过旧密钥验证，新签名使用新密钥。' },
      { q: '用户如何自行验签？', a: '每个签名结果都附带验签所需的所有元数据（不含私钥相关的）。我们提供公开的验签 SDK 和 Web 工具，任何人都可以独立验证。' },
    ],
    triggerMethod: '输出验签 /sign 签名 + /verify 验签',
    aiReviewSummary: {
      overall: '构建端到端数据可信链的关键组件，HMAC-SHA256 签名与 HashChain 审计形成互补的防篡改体系。KMS 密钥自动轮换和 Anti-Replay 机制体现了专业的安全工程设计。',
      highlights: [
        'HMAC-SHA256 签名的计算开销极低（< 0.5ms），适合高频调用场景',
        'KMS 90 天自动轮换密钥，即使单个密钥泄露影响范围也有限',
        '时间戳 + Nonce 双重防重放设计堵住了中间人的常见攻击向量',
        '公开验签入口增强了透明度，任何人都能独立验证结果真实性',
      ],
      caveats: [
        '验签需要接收方拥有正确的共享密钥，密钥分发是额外的运维工作',
        '128 字符的十六进制签名会增加传输数据量（约 128 bytes/次）',
        '批量验签在高并发场景下可能成为性能瓶颈点',
      ],
      suitability: '对数据完整性和来源真实性有严格要求的安全敏感场景，特别是金融交易、医疗记录、法律文书等不可篡改数据领域。',
    },
    securityStatus: 'safe',
    securityChecks: [
      { name: '代码注入风险', status: 'pass', detail: '仅做签名验签' },
      { name: '密钥安全', status: 'pass', detail: 'KMS 托管 + 自动轮换' },
      { name: '重放攻击', status: 'pass', detail: 'Timestamp + Nonce 双防' },
      { name: '碰撞攻击', status: 'pass', detail: 'HMAC-SHA256 抗碰撞' },
      { name: '密钥分发', status: 'warn', detail: '需安全渠道分发共享密钥' },
    ],
    reviewsList: [
      { user: 'fintech_security', avatar: '明', rating: 5, date: '2026/6/4', content: '金融交易结果的可信验证核心组件！HMAC-SHA256 签名满足监管对数据完整性的要求。KMS 自动轮换让我们不用手动管密钥了。' },
      { user: 'healthcare_it', avatar: '姜', rating: 5, date: '2026/5/30', content: '电子病历的输出签名用的这个，患者数据的不可篡改性是合规红线。公开验签入口让患者也能自己验证记录真伪。' },
      { user: 'legal_tech', avatar: '谈', rating: 5, date: '2026/5/25', content: '法律文书的数字化签名方案！Anti-Replay 机制防止了文档被截获后重复提交。和 HashChain 联动后整个证据链完整了。' },
      { user: 'supply_chain', avatar: '侯', rating: 4, date: '2026/5/19', content: '供应链溯源数据的签名验签，< 1ms 的验签延迟在物流高频场景下毫无压力。批量验签性能提升 60% 后处理效率更好了。' },
      { user: 'iot_security', avatar: '余', rating: 4, date: '2026/5/13', content: 'IoT 设备上报数据的完整性校验用的这个。签名大小 128 字符对窄带宽设备来说稍微有点大，但安全性值得。' },
      { user: 'government_audit', avatar: '元', rating: 5, date: '2026/5/8', content: '政务数据交换的信任基座！跨部门之间的数据互认靠的就是这个验签机制。签名状态公开查询 API 让监督部门随时可查。' },
    ],
  },
];

function formatNumber(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + 'w';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toLocaleString();
}

function getGradientColors(gradientStr: string): [string, string] {
  const map: Record<string, [string, string]> = {
    'from-teal-500 to-emerald-600': ['#14B8A6', '#059669'],
    'from-cyan-500 to-blue-600': ['#06B6D4', '#2563EB'],
    'from-amber-500 to-orange-600': ['#F59E0B', '#EA580C'],
    'from-violet-500 to-purple-600': ['#8B5CF6', '#9333EA'],
    'from-emerald-500 to-teal-600': ['#10B981', '#0D9488'],
    'from-blue-500 to-indigo-600': ['#3B82F6', '#4F46E5'],
    'from-red-500 to-rose-600': ['#EF4444', '#E11D48'],
    'from-pink-500 to-rose-600': ['#EC4899', '#E11D48'],
    'from-slate-500 to-gray-600': ['#64748B', '#4B5563'],
    'from-lime-500 to-green-600': ['#84CC16', '#16A34A'],
    'from-teal-600 to-cyan-600': ['#0D9488', '#0891B2'],
    'from-indigo-500 to-violet-600': ['#6366F1', '#8B5CF6'],
    'from-yellow-500 to-amber-600': ['#EAB308', '#D97706'],
    'from-fuchsia-500 to-pink-600': ['#D946EF', '#EC4899'],
  };
  return map[gradientStr] || ['#14B8A6', '#0F766E'];
}

/* ───────────────────────────────── 子组件 ───────────────────────────────── */

/** 校验记录 Tab */
function ReviewsTab({ agent }: { agent: AgentDetail }) {
  const [reviewSort, setReviewSort] = useState<'relevance' | 'latest'>('relevance');
  const sortedReviews = [...agent.reviewsList].sort((a, b) => {
    if (reviewSort === 'latest') return b.date.localeCompare(a.date);
    return b.rating - a.rating;
  });

  const [colors] = getGradientColors(agent.gradient);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      {/* 排序 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['relevance', 'latest'] as const).map((key) => (
          <button
            key={key}
            onClick={() => setReviewSort(key)}
            style={{
              padding: '6px 16px',
              borderRadius: 20,
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: reviewSort === key ? 600 : 400,
              background: reviewSort === key ? '#0F766E' : '#F1F5F9',
              color: reviewSort === key ? '#fff' : '#64748B',
              transition: 'all 0.2s',
            }}
          >
            {key === 'relevance' ? '综合' : '最新'}
          </button>
        ))}
      </div>

      {/* 评价列表 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sortedReviews.map((review, idx) => (
          <motion.div
            key={`${review.user}-${idx}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.06, duration: 0.3 }}
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: '18px 20px',
              border: '1px solid #F1F5F9',
              transition: 'transform 0.2s, box-shadow 0.2s',
              cursor: 'default',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
              (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
              (e.currentTarget as HTMLElement).style.boxShadow = 'none';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar
                  size={36}
                  style={{
                    background: `linear-gradient(135deg, ${colors}, ${colors}dd)`,
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.88rem',
                    flexShrink: 0,
                  }}
                >
                  {review.avatar}
                </Avatar>
                <span style={{ fontWeight: 600, color: '#1E293B', fontSize: '0.92rem' }}>{review.user}</span>
                <Rate disabled defaultValue={review.rating} style={{ fontSize: '0.82rem', color: '#FACC15' }} />
              </div>
              <span style={{ color: '#94A3B8', fontSize: '0.82rem', flexShrink: 0 }}>{review.date}</span>
            </div>
            <p style={{ color: '#475569', lineHeight: 1.7, margin: 0, fontSize: '0.9rem' }}>{review.content}</p>
          </motion.div>
        ))}
      </div>

      {/* 查看全部按钮 */}
      <div style={{ textAlign: 'center', marginTop: 24 }}>
        <Button
          type="link"
          style={{ color: '#0F766E', fontWeight: 600, fontSize: '0.92rem' }}
          icon={<ChevronRight size={16} />}
        >
          查看全部 {agent.reviews.toLocaleString()} 条校验记录
        </Button>
      </div>
    </motion.div>
  );
}

/** 功能文档 Tab */
function DocsTab({ agent }: { agent: AgentDetail }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      {/* Long Desc */}
      {agent.longDesc.split('\n\n').map((para, idx) => (
        <p
          key={`desc-${idx}`}
          style={{ color: '#334155', lineHeight: 1.85, fontSize: '0.93rem', marginBottom: 18, whiteSpace: 'pre-line' }}
        >
          {para}
        </p>
      ))}

      {/* Features */}
      <div style={{ marginTop: 28, marginBottom: 8 }}>
        <h3 style={{ color: '#1E293B', fontSize: '1.05rem', fontWeight: 700, marginBottom: 16 }}>功能特性</h3>
        {agent.features.map((feat, idx) => (
          <motion.div
            key={`feat-${idx}`}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.06, duration: 0.25 }}
            style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: idx < agent.features.length - 1 ? '1px solid #F1F5F9' : 'none' }}
          >
            <CheckCircle2 size={18} color="#14B8A6" style={{ flexShrink: 0, marginTop: 3 }} />
            <span style={{ color: '#334155', lineHeight: 1.65, fontSize: '0.92rem' }}>{feat}</span>
          </motion.div>
        ))}
      </div>

      {/* Tech Specs Table */}
      <div style={{ marginTop: 32, marginBottom: 8 }}>
        <h3 style={{ color: '#1E293B', fontSize: '1.05rem', fontWeight: 700, marginBottom: 16 }}>技术规格</h3>
        <div style={{ background: '#FAFBFC', borderRadius: 12, border: '1px solid #F1F5F9', overflow: 'hidden' }}>
          {agent.techSpecs.map((spec, idx) => (
            <div
              key={`spec-${idx}`}
              style={{
                display: 'flex',
                padding: '12px 20px',
                borderBottom: idx < agent.techSpecs.length - 1 ? '1px solid #F1F5F9' : 'none',
                background: idx % 2 === 0 ? '#fff' : 'transparent',
              }}
            >
              <span style={{ width: 140, flexShrink: 0, color: '#94A3B8', fontSize: '0.88rem', fontWeight: 500 }}>{spec.label}</span>
              <span style={{ color: '#0F766E', fontWeight: 600, fontSize: '0.9rem' }}>{spec.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Usage Example Code Block */}
      <div style={{ marginTop: 32, marginBottom: 8 }}>
        <h3 style={{ color: '#1E293B', fontSize: '1.05rem', fontWeight: 700, marginBottom: 16 }}>使用示例</h3>
        <div
          style={{
            background: '#0F172A',
            borderRadius: 12,
            padding: 20,
            overflow: 'auto',
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
            fontSize: '0.88rem',
            lineHeight: 1.7,
          }}
        >
          {agent.usageExample.split('\n').map((line, i) => {
            const trimmed = line.trimStart();
            let color = '#CBD5E1';
            if (trimmed.startsWith('#') || trimmed.startsWith('//')) color = '#64748B';
            else if (/^(import|from|def|class|return|if|else|elif|for|while|with|try|except|finally|raise|yield|async|await|lambda)\b/.test(trimmed)) color = '#C084FC';
            else if (/^["']|^["'].*["']$/.test(trimmed) || (trimmed.includes('"') && !trimmed.includes('='))) color = '#86EFAC';
            else if (/^\d/.test(trimmed)) color = '#FBBF24';
            else if (trimmed.includes('=') && !trimmed.startsWith('#') && !trimmed.startsWith('//')) color = '#67E8F9';

            return (
              <div key={i} style={{ display: 'flex' }}>
                <span style={{ color: '#334155', minWidth: 40, textAlign: 'right', marginRight: 16, userSelect: 'none', opacity: 0.5 }}>
                  {i + 1}
                </span>
                <span style={{ color, whiteSpace: 'pre' }}>{line || ' '}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* FAQ */}
      <div style={{ marginTop: 32 }}>
        <h3 style={{ color: '#1E293B', fontSize: '1.05rem', fontWeight: 700, marginBottom: 16 }}>常见问题</h3>
        <Collapse
          bordered={false}
          defaultActiveKey={['0']}
          ghost
          items={agent.faq.map((item, idx) => ({
            key: String(idx),
            label: <span style={{ fontWeight: 600, color: '#1E293B', fontSize: '0.92rem' }}>{item.q}</span>,
            children: <p style={{ color: '#475569', lineHeight: 1.75, margin: 0, fontSize: '0.9rem' }}>{item.a}</p>,
          }))}
        />
      </div>
    </motion.div>
  );
}

/** 版本历史 Tab */
function VersionsTab({ agent }: { agent: AgentDetail }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <Timeline
        items={agent.changelog.map((entry, idx) => ({
          color: idx === 0 ? '#14B8A6' : '#94A3B8',
          children: (
            <div key={entry.version}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <Badge
                  count={entry.version}
                  style={{
                    background: idx === 0 ? '#14B8A6' : '#E2E8F0',
                    color: idx === 0 ? '#fff' : '#64748B',
                    fontSize: '0.8rem',
                    padding: '0 10px',
                    borderRadius: 6,
                    fontWeight: 600,
                  }}
                />
                <span style={{ color: '#94A3B8', fontSize: '0.87rem' }}>{entry.date}</span>
                {idx === 0 && (
                  <Badge count="最新" style={{ background: '#14B8A6', fontSize: '0.72rem', padding: '0 8px', borderRadius: 8, marginLeft: 4 }} />
                )}
              </div>
              <ul style={{ margin: 0, paddingLeft: 22, color: '#475569' }}>
                {entry.items.map((item, i) => (
                  <li key={i} style={{ marginBottom: 5, lineHeight: 1.7, fontSize: '0.9rem' }}>{item}</li>
                ))}
              </ul>
            </div>
          ),
        }))}
      />
    </motion.div>
  );
}

/** 安全检测 Tab */
function SecurityTab({ agent }: { agent: AgentDetail }) {
  const statusConfig = {
    safe: { label: '安全', emoji: '🟢', color: '#10B981', bg: 'rgba(16,185,129,0.06)' },
    warning: { label: '警告', emoji: '🟡', color: '#F59E0B', bg: 'rgba(245,158,11,0.06)' },
    danger: { label: '危险', emoji: '🔴', color: '#EF4444', bg: 'rgba(239,68,68,0.06)' },
  };
  const cfg = statusConfig[agent.securityStatus];

  const statusIcon = (s: 'pass' | 'warn' | 'fail') => {
    if (s === 'pass') return <CheckCircle2 size={18} color="#10B981" />;
    if (s === 'warn') return <AlertTriangle size={18} color="#F59E0B" />;
    return <XCircle size={18} color="#EF4444" />;
  };

  const statusLabel = (s: 'pass' | 'warn' | 'fail') => {
    if (s === 'pass') return <span style={{ color: '#10B981', fontWeight: 600 }}>通过</span>;
    if (s === 'warn') return <span style={{ color: '#F59E0B', fontWeight: 600 }}>注意</span>;
    return <span style={{ color: '#EF4444', fontWeight: 600 }}>失败</span>;
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      {/* 大状态指示器 */}
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, type: 'spring' }}
        style={{
          textAlign: 'center',
          padding: '32px 24px',
          borderRadius: 16,
          background: cfg.bg,
          border: `1px solid ${cfg.color}22`,
          marginBottom: 28,
        }}
      >
        <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>{cfg.emoji}</div>
        <div style={{ fontSize: '1.3rem', fontWeight: 800, color: cfg.color }}>安全等级：{cfg.label}</div>
        <p style={{ color: '#64748B', fontSize: '0.9rem', marginTop: 6, margin: '6px 0 0' }}>
          {agent.securityStatus === 'safe' && '该 Agent Skill 通过了全部核心安全检测项，可放心使用。'}
          {agent.securityStatus === 'warning' && '该 Agent Skill 存在少量需要注意的安全项，请在使用前了解相关风险。'}
          {agent.securityStatus === 'danger' && '该 Agent Skill 存在严重安全隐患，建议谨慎使用或联系作者修复。'}
        </p>
      </motion.div>

      {/* 检测项列表 */}
      <h3 style={{ color: '#1E293B', fontSize: '1.05rem', fontWeight: 700, marginBottom: 16 }}>检测明细</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {agent.securityChecks.map((check, idx) => (
          <motion.div
            key={`sec-${idx}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.06, duration: 0.25 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 18px',
              borderRadius: 10,
              background: '#fff',
              border: '1px solid #F1F5F9',
            }}
          >
            {statusIcon(check.status)}
            <span style={{ flex: 1, fontWeight: 600, color: '#1E293B', fontSize: '0.91rem' }}>{check.name}</span>
            {statusLabel(check.status)}
            {check.detail && (
              <span style={{ color: '#94A3B8', fontSize: '0.82rem', flexShrink: 0, maxWidth: 220, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={check.detail}>
                {check.detail}
              </span>
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

/* ─────────────────────────── 安装指引组件 ─────────────────────────── */

function InstallGuide({ agentId }: { agentId: string }) {
  const [copied, setCopied] = useState(false);
  const [copiedZip, setCopiedZip] = useState(false);

  const handleCopyCmd = async () => {
    try {
      await navigator.clipboard.writeText(`/yijiandaodi-skill install ${agentId}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyZip = async () => {
    try {
      await navigator.clipboard.writeText(`https://yijiandaodi.com/api/p2p/v1/skills/${agentId}/download`);
      setCopiedZip(true);
      setTimeout(() => setCopiedZip(false), 2000);
    } catch {
      setCopiedZip(true);
      setTimeout(() => setCopiedZip(false), 2000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
      style={{
        background: '#fff',
        borderRadius: 16,
        padding: '28px 28px',
        marginBottom: 20,
        border: '1px solid rgba(15,118,110,0.08)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      {/* 标题 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        <Package size={20} color="#0F766E" />
        <h2 style={{ color: '#1E293B', fontSize: '1.12rem', fontWeight: 800, margin: 0 }}>安装指引</h2>
      </div>

      {/* 方式一：Agent 自动安装 */}
      <div
        style={{
          background: 'rgba(15,118,110,0.03)',
          borderRadius: 12,
          padding: '20px',
          marginBottom: 16,
          border: '1px solid rgba(15,118,110,0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Bot size={18} color="#0F766E" />
          <span style={{ fontWeight: 700, color: '#1E293B', fontSize: '0.95rem' }}>方式一：Agent 自动安装</span>
        </div>
        <p style={{ color: '#64748B', fontSize: '0.85rem', margin: '0 0 14px', lineHeight: 1.6 }}>
          复制下方命令喂给 Agent，即可自动完成注册与配置
        </p>

        {/* 步骤 1 */}
        <div style={{ marginBottom: 10 }}>
          <span style={{ color: '#64748B', fontSize: '0.82rem', fontWeight: 600 }}>
            1. 阅读指南:
          </span>
        </div>
        <div
          onClick={() => {
            navigator.clipboard.writeText('https://yijiandaodi.com/skill.md').catch(() => {});
          }}
          style={{
            background: '#0F172A',
            borderRadius: 8,
            padding: '10px 14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
            transition: 'border-color 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#14B8A6'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; }}
        >
          <code style={{ color: '#E0F2FE', fontSize: '0.84rem', fontFamily: "'JetBrains Mono','Consolas',monospace" }}>
            curl -sL https://yijiandaodi.com/skill.md
          </code>
          <Copy size={14} color="#64748B" />
        </div>

        {/* 步骤 2 */}
        <div style={{ marginBottom: 12 }}>
          <span style={{ color: '#64748B', fontSize: '0.82rem', fontWeight: 600 }}>
            2. 根据指南请求 Skill 包:
          </span>
        </div>
        <div
          onClick={handleCopyCmd}
          style={{
            background: '#0F172A',
            borderRadius: 8,
            padding: '10px 14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: copied ? '1px solid #14B8A6' : '1px solid transparent',
            transition: 'all 0.25s',
          }}
          onMouseEnter={(e) => { if (!copied) e.currentTarget.style.borderColor = 'rgba(20,184,166,0.3)'; }}
          onMouseLeave={(e) => { if (!copied) e.currentTarget.style.borderColor = 'transparent'; }}
        >
          <code style={{ color: '#14B8A6', fontSize: '0.84rem', fontFamily: "'JetBrains Mono','Consolas',monospace", fontWeight: 600 }}>
            /yijiandaodi-skill install {agentId}
          </code>
          {copied ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#10B981', fontSize: '0.82rem', fontWeight: 600 }}>
              <Check size={14} /> 已复制
            </span>
          ) : (
            <Copy size={14} color="#64748B" />
          )}
        </div>
      </div>

      {/* 分隔线 + OR */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <div style={{ flex: 1, height: 1, background: 'rgba(15,118,110,0.1)' }} />
        <span style={{ color: '#94A3B8', fontSize: '0.78rem', fontWeight: 600, whiteSpace: 'nowrap' }}>或</span>
        <div style={{ flex: 1, height: 1, background: 'rgba(15,118,110,0.1)' }} />
      </div>

      {/* 方式二：人类手动安装 */}
      <div
        style={{
          background: 'rgba(100,116,139,0.03)',
          borderRadius: 12,
          padding: '20px',
          border: '1px solid rgba(100,116,139,0.1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <User size={18} color="#64748B" />
          <span style={{ fontWeight: 700, color: '#1E293B', fontSize: '0.95rem' }}>方式二：人类手动安装</span>
        </div>
        <p style={{ color: '#64748B', fontSize: '0.85rem', margin: '0 0 14px', lineHeight: 1.6 }}>
          下载 ZIP 文件到本地，按照 README 手动配置
        </p>
        <div
          onClick={handleCopyZip}
          style={{
            background: '#fff',
            borderRadius: 8,
            padding: '12px 16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            border: copiedZip ? '1px solid #0F766E' : '1px dashed #CBD5E1',
            transition: 'all 0.25s',
          }}
          onMouseEnter={(e) => { if (!copiedZip) { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.borderColor = '#94A3B8'; } }}
          onMouseLeave={(e) => { if (!copiedZip) { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#CBD5E1'; } }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileArchive size={18} color="#0F766E" />
            <div>
              <div style={{ fontWeight: 600, color: '#1E293B', fontSize: '0.88rem' }}>
                {agentId.replace(/-/g, '-')}.zip
              </div>
              <div style={{ color: '#94A3B8', fontSize: '0.76rem' }}>
                包含 SKILL.md + 配置模板 + 示例代码
              </div>
            </div>
          </div>
          {copiedZip ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#10B981', fontSize: '0.82rem', fontWeight: 600 }}>
              <Check size={14} /> 链接已复制
            </span>
          ) : (
            <Download size={16} color="#64748B" />
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ───────────────────────────────── 主组件 ───────────────────────────────── */

export default function AgentSkillDetail() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const [reviewSort, setReviewSort] = useState<'relevance' | 'latest'>('relevance');

  const agent = agentsData.find((a) => a.id === agentId);

  if (!agent) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 24px' }}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <div style={{ fontSize: '3.5rem', marginBottom: 16 }}>🔍</div>
          <h2 style={{ color: '#1E293B', fontSize: '1.5rem', fontWeight: 700, marginBottom: 10 }}>
            Agent 未找到
          </h2>
          <p style={{ color: '#64748B', marginBottom: 28, fontSize: '0.95rem' }}>
            未找到 ID 为 &quot;{agentId}&quot; 的 Agent Skill
          </p>
          <Button
            type="primary"
            onClick={() => navigate('/xialia')}
            style={{ background: '#0F766E', borderColor: '#0F766E', height: 40, paddingLeft: 24, paddingRight: 24, borderRadius: 8, fontWeight: 600 }}
          >
            ← 返回虾聊
          </Button>
        </motion.div>
      </div>
    );
  }

  const IconComponent = iconMap[agent.icon];
  const [colors] = getGradientColors(agent.gradient);

  const tabItems = [
    {
      key: 'reviews',
      label: `校验记录(${agent.reviews})`,
      children: <ReviewsTab agent={agent} />,
    },
    {
      key: 'docs',
      label: '功能文档',
      children: <DocsTab agent={agent} />,
    },
    {
      key: 'versions',
      label: `版本历史(${agent.changelog.length})`,
      children: <VersionsTab agent={agent} />,
    },
    {
      key: 'security',
      label: '安全检测',
      children: <SecurityTab agent={agent} />,
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  };

  return (
    <div className="skill-detail-page" style={{ background: '#FAFBFC', minHeight: '100vh', paddingTop: 80 }}>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px 60px' }}
      >
        {/* 返回按钮 */}
        <motion.div variants={itemVariants}>
          <button
            onClick={() => navigate('/xialia')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#0F766E',
              fontSize: '0.92rem',
              fontWeight: 600,
              fontFamily: 'inherit',
              padding: '8px 0',
              marginBottom: 20,
            }}
          >
            <ArrowLeft size={18} />
            返回虾聊
          </button>
        </motion.div>

        {/* 头部区域 */}
        <motion.div
          variants={itemVariants}
          style={{
            background: '#fff',
            borderRadius: 16,
            padding: '32px 28px',
            marginBottom: 20,
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          {/* Icon + 名称 */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 16 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 14,
                background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {IconComponent && <IconComponent size={28} color="#fff" strokeWidth={1.8} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{ color: '#1E293B', fontSize: '1.6rem', fontWeight: 800, margin: 0, lineHeight: 1.3, letterSpacing: '-0.01em' }}>
                #{agent.name}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                <span style={{ color: '#64748B', fontSize: '0.88rem' }}>{agent.author}</span>
                <span style={{ color: '#CBD5E1' }}>·</span>
                <span style={{ color: '#94A3B8', fontSize: '0.85rem' }}>{agent.updatedAt}</span>
              </div>
            </div>
            {(agent.isNew || agent.isHot) && (
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {agent.isNew && <Badge count="NEW" style={{ background: '#14B8A6', fontSize: '0.7rem', padding: '0 8px', borderRadius: 6 }} />}
                {agent.isHot && <Badge count="HOT" style={{ background: '#EF4444', fontSize: '0.7rem', padding: '0 8px', borderRadius: 6 }} />}
              </div>
            )}
          </div>

          {/* 分类 + 标签 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
            <span style={{ color: '#94A3B8', fontSize: '0.84rem' }}>分类:</span>
            <Tag color="teal" style={{ borderRadius: 6 }}>{agent.category}</Tag>
            <span style={{ color: '#94A3B8', fontSize: '0.84rem', marginLeft: 4 }}>标签:</span>
            {agent.tags.map((tag) => (
              <Tag key={tag} style={{ borderRadius: 12, border: '1px solid #E2E8F0', color: '#475569' }}>{tag}</Tag>
            ))}
          </div>

          {/* 触发方式 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, padding: '10px 14px', background: '#F8FAFC', borderRadius: 8, border: '1px solid #F1F5F9' }}>
            <Terminal size={15} color="#0F766E" />
            <span style={{ color: '#64748B', fontSize: '0.84rem' }}>触发方式:</span>
            <span style={{ color: '#0F766E', fontWeight: 600, fontSize: '0.86rem', fontFamily: "'JetBrains Mono','Consolas',monospace" }}>{agent.triggerMethod}</span>
          </div>

          {/* 信息条 */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: 4,
              paddingTop: 18,
              borderTop: '1px solid #F1F5F9',
            }}
          >
            {[
              { icon: <Star size={16} color="#FACC15" />, label: `${agent.rating}/5`, sub: `(${agent.reviews.toLocaleString()})` },
              { icon: <Download size={16} color="#0F766E" />, label: formatNumber(agent.installCount), sub: '安装' },
              { icon: <GitBranch size={16} color="#8B5CF6" />, label: agent.version, sub: '' },
              { icon: <CalendarDays size={16} color="#06B6D4" />, label: agent.updatedAt.slice(5), sub: '更新' },
              { icon: <ShieldCheck size={16} color="#10B981" />, label: '🟢 安全', sub: '' },
            ].map((item, idx) => (
              <div
                key={idx}
                style={{
                  textAlign: 'center',
                  padding: '10px 4px',
                  borderRadius: 8,
                  transition: 'background 0.2s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>{item.icon}</div>
                <div style={{ fontWeight: 700, color: '#1E293B', fontSize: '0.92rem' }}>{item.label}</div>
                {item.sub && <div style={{ color: '#94A3B8', fontSize: '0.75rem', marginTop: 1 }}>{item.sub}</div>}
              </div>
            ))}
          </div>
        </motion.div>

        {/* ★ 安装指引 */}
        <InstallGuide agentId={agent.id} />

        {/* ★ AI 校验总结 */}
        <motion.div
          variants={itemVariants}
          style={{
            background: 'rgba(20,184,166,0.04)',
            borderRadius: 16,
            padding: '28px 28px',
            marginBottom: 20,
            borderLeft: '4px solid #14B8A6',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Sparkles size={20} color="#14B8A6" />
            <h2 style={{ color: '#1E293B', fontSize: '1.12rem', fontWeight: 800, margin: 0 }}>AI 校验总结</h2>
          </div>
          <p style={{ color: '#94A3B8', fontSize: '0.82rem', margin: '0 0 18px' }}>
            基于 {agent.reviewsList.length} 条校验记录 · 2 天前生成
          </p>

          {/* 总体评价 */}
          <p style={{ color: '#334155', lineHeight: 1.75, fontSize: '0.93rem', marginBottom: 20 }}>
            {agent.aiReviewSummary.overall}
          </p>

          {/* ✨ 亮点 */}
          <div
            style={{
              borderLeft: '3px solid #10B981',
              paddingLeft: 16,
              padding: '14px 16px',
              borderRadius: '0 10px 10px 0',
              background: 'rgba(16,185,129,0.03)',
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Sparkles size={16} color="#10B981" />
              <span style={{ fontWeight: 700, color: '#10B981', fontSize: '0.9rem' }}>亮点</span>
            </div>
            {agent.aiReviewSummary.highlights.map((h, i) => (
              <p key={i} style={{ color: '#334155', lineHeight: 1.7, fontSize: '0.89rem', margin: '0 0 6px' }}>
                • {h}
              </p>
            ))}
          </div>

          {/* ⚠️ 需注意 */}
          <div
            style={{
              borderLeft: '3px solid #F59E0B',
              paddingLeft: 16,
              padding: '14px 16px',
              borderRadius: '0 10px 10px 0',
              background: 'rgba(245,158,11,0.03)',
              marginBottom: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <AlertCircle size={16} color="#F59E0B" />
              <span style={{ fontWeight: 700, color: '#D97706', fontSize: '0.9rem' }}>需注意</span>
            </div>
            {agent.aiReviewSummary.caveats.map((c, i) => (
              <p key={i} style={{ color: '#334155', lineHeight: 1.7, fontSize: '0.89rem', margin: '0 0 6px' }}>
                • {c}
              </p>
            ))}
          </div>

          {/* 最适合 */}
          <p style={{ color: '#475569', lineHeight: 1.7, fontSize: '0.89rem', margin: 0 }}>
            <span style={{ fontWeight: 600, color: '#334155' }}>最适合：</span>{agent.aiReviewSummary.suitability}
          </p>
        </motion.div>

        {/* Tab 区域 */}
        <motion.div variants={itemVariants}>
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              overflow: 'hidden',
            }}
          >
            <Tabs
              defaultActiveKey="reviews"
              size="large"
              items={tabItems}
              onChange={() => {}}
              style={{
                '--ant-color-primary': '#0F766E',
              } as React.CSSProperties}
              tabBarStyle={{ padding: '0 20px', marginBottom: 0 }}
            />
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}