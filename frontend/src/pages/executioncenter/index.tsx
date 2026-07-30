import * as React from 'react';
import {
  Statistic,
  Card,
  Button,
  Select,
  Input,
  Table,
  Tag,
  Modal,
  Collapse,
  Space,
  message,
  Spin,
} from 'antd';
import {
  SafetyCertificateOutlined,
  ApiOutlined,
  DollarOutlined,
  CloudServerOutlined,
  CodeOutlined,
  AuditOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  SendOutlined,
  SearchOutlined,
  FileTextOutlined,
  EyeOutlined,
  StopOutlined,
  RocketOutlined,
  StarOutlined,
  ArrowRightOutlined,
  FireOutlined,
  BulbOutlined,
  RiseOutlined,
  PlayCircleOutlined,
} from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import type { ColumnsType } from 'antd/es/table';
import {
  executionApi,
  type ExecutionSummary,
  type PipelineStageResult,
  type ExecuteRequest,
  type ExecutionResponse,
} from '@/api/executionApi';
import {
  getPublicSkillList,
  searchSkills,
  type SkillConfigItem,
} from '@/api/skillConfigApi';
import styles from './index.module.css';

const { TextArea } = Input;
const { Option } = Select;

interface TaskRecord {
  task_id: string;
  workflow_type: string;
  status: string;
  stages_duration: Record<string, number>;
  created_at: string;
}

interface LogEntry {
  time: string;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
}

const PIPELINE_STAGES = [
  { stage: 'L3', name: '安全网关', iconKey: 'SafetyCertificateOutlined', color: '#667eea' },
  { stage: 'L2', name: '编排引擎', iconKey: 'ApiOutlined', color: '#764ba2' },
  { stage: 'L4', name: '成本路由', iconKey: 'DollarOutlined', color: '#f5a623' },
  { stage: 'L5', name: 'P2P调度', iconKey: 'CloudServerOutlined', color: '#00b42a' },
  { stage: 'L6', name: '沙箱执行', iconKey: 'CodeOutlined', color: '#165dff' },
  { stage: 'L7', name: '审计存证', iconKey: 'AuditOutlined', color: '#e02020' },
];

const WORKFLOW_OPTIONS = [
  { value: 'code_audit', label: '代码审核' },
  { value: 'content_verify', label: '内容验证' },
  { value: 'ai_execute', label: 'AI执行' },
];

const MOCK_SUMMARY: ExecutionSummary = {
  pending_count: 12,
  running_count: 5,
  completed_today: 48,
  avg_duration_ms: 3420,
  success_rate: 96.8,
};

const MOCK_STAGES: PipelineStageResult[] = [
  { stage: 'L3', stage_name: '安全网关', status: 'completed', duration_ms: 120, summary: '检测到 0 个威胁', timestamp: '' },
  { stage: 'L2', stage_name: '编排引擎', status: 'completed', duration_ms: 340, summary: '解析 3 个子任务', timestamp: '' },
  { stage: 'L4', stage_name: '成本路由', status: 'running', duration_ms: 890, summary: '分配 3 个节点', timestamp: '' },
  { stage: 'L5', stage_name: 'P2P调度', status: 'pending', duration_ms: 0, summary: '等待调度...', timestamp: '' },
  { stage: 'L6', stage_name: '沙箱执行', status: 'pending', duration_ms: 0, summary: '等待执行...', timestamp: '' },
  { stage: 'L7', stage_name: '审计存证', status: 'pending', duration_ms: 0, summary: '等待存证...', timestamp: '' },
];

const MOCK_TASKS: TaskRecord[] = [
  { task_id: 'TK-20260604-001', workflow_type: '代码审核', status: 'completed', stages_duration: { L3: 120, L2: 340, L4: 890, L5: 1560, L6: 2340, L7: 450 }, created_at: '2026-06-04 10:23:15' },
  { task_id: 'TK-20260604-002', workflow_type: '内容验证', status: 'running', stages_duration: { L3: 98, L2: 280, L4: 650, L5: 0, L6: 0, L7: 0 }, created_at: '2026-06-04 11:05:32' },
  { task_id: 'TK-20260604-003', workflow_type: 'AI执行', status: 'pending', stages_duration: {}, created_at: '2026-06-04 11:12:08' },
  { task_id: 'TK-20260604-004', workflow_type: '代码审核', status: 'completed', stages_duration: { L3: 110, L2: 310, L4: 820, L5: 1420, L6: 2100, L7: 420 }, created_at: '2026-06-04 09:45:20' },
  { task_id: 'TK-20260604-005', workflow_type: '内容验证', status: 'error', stages_duration: { L3: 95, L2: 260, L4: 0, L5: 0, L6: 0, L7: 0 }, created_at: '2026-06-04 09:30:55' },
  { task_id: 'TK-20260603-018', workflow_type: 'AI执行', status: 'completed', stages_duration: { L3: 130, L2: 360, L4: 910, L5: 1680, L6: 2520, L7: 480 }, created_at: '2026-06-03 22:15:40' },
  { task_id: 'TK-202603-017', workflow_type: '代码审核', status: 'warning', stages_duration: { L3: 140, L2: 380, L4: 950, L5: 1720, L6: 2600, L7: 500 }, created_at: '2026-06-03 21:42:18' },
];

const MOCK_LOGS: LogEntry[] = [
  { time: '11:12:08', level: 'info', message: '[TK-20260604-003] 任务已提交，工作流类型：代码审核，安全等级：normal' },
  { time: '11:05:45', level: 'info', message: '[TK-20260604-002] L3 安全网关 - 输入校验通过，未检测到恶意模式' },
  { time: '11:05:46', level: 'success', message: '[TK-20260604-002] L3 安全网关 - 阶段完成 (耗时 98ms)' },
  { time: '11:05:47', level: 'info', message: '[TK-20260604-002] L2 编排引擎 - 解析任务依赖图，发现 2 个并行分支' },
  { time: '11:05:49', level: 'success', message: '[TK-20260604-002] L2 编排引擎 - 阶段完成 (耗时 280ms)' },
  { time: '11:05:52', level: 'info', message: '[TK-20260604-002] L4 成本路由 - 计算最优资源分配方案...' },
  { time: '11:05:58', level: 'warn', message: '[TK-20260604-002] L4 成本路由 - 节点 node-03 响应延迟偏高 (+200ms)' },
  { time: '11:02:30', level: 'success', message: '[TK-20260604-001] 全部阶段执行完毕，总耗时 5640ms，状态：成功' },
  { time: '10:50:12', level: 'error', message: '[TK-20260604-005] L4 成本路由 - 资源不足，任务降级处理失败' },
  { time: '10:23:16', level: 'info', message: '[TK-20260604-001] 任务已创建，开始进入流水线' },
];

// ====== Hero 轮播数据 ======
const HERO_SLIDES = [
  {
    id: 1,
    title: '六层架构流水线',
    subtitle: '从安全网关到审计存证，全链路可视化监控',
    metric: { label: '今日处理', value: `${MOCK_SUMMARY.completed_today}+`, icon: <RiseOutlined /> },
    gradient: 'linear-gradient(135deg, #667eea15, #764ba215)',
    accent: '#667eea',
    tag: '实时运行中',
    tagColor: '#00b42a',
  },
  {
    id: 2,
    title: 'AI 智能调度引擎',
    subtitle: 'P2P 分布式节点 + 成本最优路由算法',
    metric: { label: '平均耗时', value: formatDuration(MOCK_SUMMARY.avg_duration_ms), icon: <ThunderboltOutlined /> },
    gradient: 'linear-gradient(135deg, #f5a62315, #e0202015)',
    accent: '#f5a623',
    tag: '效率优化',
    tagColor: '#165dff',
  },
  {
    id: 3,
    title: '多维协同检测矩阵',
    subtitle: '4 Agent 串行分析 + 200+ 技能灵活组合',
    metric: { label: '成功率', value: `${MOCK_SUMMARY.success_rate}%`, icon: <SafetyCertificateOutlined /> },
    gradient: 'linear-gradient(135deg, #00b42a15, #165dff15)',
    accent: '#00b42a',
    tag: '高可用',
    tagColor: '#722ED1',
  },
];

// ====== 推荐快捷操作 ======
const QUICK_ACTIONS = [
  { icon: <CodeOutlined />, title: '代码安全扫描', desc: '检测漏洞/后门/敏感信息泄露', workflow: 'code_audit', hot: true, color: '#667eea' },
  { icon: <FileTextOutlined />, title: '内容合规审查', desc: '文本/图片/AI生成痕迹多维度检测', workflow: 'content_verify', hot: false, color: '#764ba2' },
  { icon: <RocketOutlined />, title: 'AI 智能执行', desc: '自动拆解任务并分配最优节点', workflow: 'ai_execute', hot: true, color: '#f5a623' },
  { icon: <BulbOutlined />, title: '一键重复上次', desc: '快速复用最近一次成功的配置', workflow: '_repeat', hot: false, color: '#00b42a' },
];

const formatDuration = (ms: number): string => {
  if (ms === 0) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

const getStatusIconKey = (status: string): string => {
  switch (status) {
    case 'pending': return 'ClockCircleOutlined';
    case 'running': return 'SyncOutlined';
    case 'completed': return 'CheckCircleOutlined';
    case 'warning': return 'ExclamationCircleOutlined';
    case 'error': return 'CloseCircleOutlined';
    default: return '';
  }
};

const getStageStatusClass = (status: string) =>
  status as 'pending' | 'running' | 'completed' | 'warning' | 'error';

const ExecutionCenter: React.FC = () => {
  const [summary, setSummary] = React.useState<ExecutionSummary>(MOCK_SUMMARY);
  const [stages, setStages] = React.useState<PipelineStageResult[]>(MOCK_STAGES);
  const [tasks, setTasks] = React.useState<TaskRecord[]>(MOCK_TASKS);
  const [logs, setLogs] = React.useState<LogEntry[]>(MOCK_LOGS);
  const [loading, setLoading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const [workflowType, setWorkflowType] = React.useState<string>('code_audit');
  const [inputContent, setInputContent] = React.useState<string>('');
  const [securityLevel, setSecurityLevel] = React.useState<string>('normal');
  const [priority, setPriority] = React.useState<string>('normal');

  // Skill 选择
  const [skillOptions, setSkillOptions] = React.useState<SkillConfigItem[]>([]);
  const [selectedSkills, setSelectedSkills] = React.useState<number[]>([]);
  const [skillLoading, setSkillLoading] = React.useState(false);
  const [skillSearch, setSkillSearch] = React.useState('');

  // Hero 轮播
  const [heroIndex, setHeroIndex] = React.useState(0);

  const [filterStatus, setFilterStatus] = React.useState<string>('all');
  const [detailVisible, setDetailVisible] = React.useState(false);
  const [detailTask, setDetailTask] = React.useState<TaskRecord | null>(null);

  // Icon maps (inside component to avoid module-level JSX issues)
  const stageIconMap: Record<string, React.ReactNode> = {
    SafetyCertificateOutlined: <SafetyCertificateOutlined />,
    ApiOutlined: <ApiOutlined />,
    DollarOutlined: <DollarOutlined />,
    CloudServerOutlined: <CloudServerOutlined />,
    CodeOutlined: <CodeOutlined />,
    AuditOutlined: <AuditOutlined />,
  };
  const statusIconMap: Record<string, React.ReactNode> = {
    ClockCircleOutlined: <ClockCircleOutlined />,
    SyncOutlined: <SyncOutlined spin />,
    CheckCircleOutlined: <CheckCircleOutlined />,
    ExclamationCircleOutlined: <ExclamationCircleOutlined />,
    CloseCircleOutlined: <CloseCircleOutlined />,
  };

  React.useEffect(() => {
    loadSummary();
    loadSkills();
  }, []);

  // Hero 轮播自动切换（5秒一轮）
  React.useEffect(() => {
    const timer = setInterval(() => {
      setHeroIndex(prev => (prev + 1) % HERO_SLIDES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // 快捷操作：一键填充表单
  const handleQuickAction = (workflow: string) => {
    if (workflow === '_repeat') {
      // 复用最近一次完成的任务配置
      const lastCompleted = tasks.find(t => t.status === 'completed');
      if (lastCompleted) {
        setWorkflowType(lastCompleted.workflow_type === '代码审核' ? 'code_audit' : lastCompleted.workflow_type === '内容验证' ? 'content_verify' : 'ai_execute');
      }
      message.info('已加载上次成功配置');
      return;
    }
    setWorkflowType(workflow);
    // 滚动到提交区域
    document.querySelector(`.${styles.submitSection}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    message.success(`已选择：${QUICK_ACTIONS.find(q => q.workflow === workflow)?.title}`);
  };

  // Skill 选择 — 用 ref 管理 timer 防止泄漏/死循环
  const skillTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadSkills = async (keyword?: string) => {
    setSkillLoading(true);
    try {
      const res = keyword
        ? await searchSkills({ q: keyword, page_size: 50 })
        : await getPublicSkillList({ page: 1, page_size: 50 });
      setSkillOptions(res.results || []);
    } catch {
      // 静默失败，使用空列表
    } finally {
      setSkillLoading(false);
    }
  };

  const handleSkillSearch = React.useCallback((val: string) => {
    setSkillSearch(val);
    if (skillTimerRef.current) clearTimeout(skillTimerRef.current);
    skillTimerRef.current = setTimeout(() => {
      loadSkills(val || undefined);
      skillTimerRef.current = null;
    }, 300);
  }, []);

  const loadSummary = async () => {
    try {
      const data = await executionApi.getSummary();
      if (data) {
        setSummary(data as unknown as ExecutionSummary);
      }
    } catch {
      // mock fallback
    }
  };

  const handleSubmit = React.useCallback(async () => {
    if (!inputContent.trim()) {
      message.warning('请输入任务内容');
      return;
    }
    setSubmitting(true);
    try {
      const payload: ExecuteRequest = {
        workflow_type: workflowType as ExecuteRequest['workflow_type'],
        input_content: inputContent,
        security_level: securityLevel as ExecuteRequest['security_level'],
        priority: priority as ExecuteRequest['priority'],
      } as Record<string, unknown> as ExecuteRequest;
      // 附加选中的技能
      (payload as Record<string, unknown>).skill_ids = selectedSkills;
      await executionApi.submit(payload);
      message.success('任务提交成功！');
      setInputContent('');
      loadSummary();
    } catch {
      message.error('任务提交失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }, [workflowType, inputContent, securityLevel, priority]);

  const handleViewDetail = (record: TaskRecord) => {
    setDetailTask(record);
    setDetailVisible(true);
  };

  const filteredTasks = filterStatus === 'all'
    ? tasks
    : tasks.filter((t) => t.status === filterStatus);

  const columns: ColumnsType<TaskRecord> = [
    {
      title: '任务ID',
      dataIndex: 'task_id',
      key: 'task_id',
      width: 170,
      render: (text: string) => (
        <span style={{ fontFamily: "'SF Mono', monospace", fontSize: 12, color: '#86caff' }}>
          {text}
        </span>
      ),
    },
    {
      title: '工作流类型',
      dataIndex: 'workflow_type',
      key: 'workflow_type',
      width: 110,
      render: (text: string) => (
        <Tag style={{ borderRadius: 12, border: 'none', background: 'rgba(102,126,234,0.12)', color: '#86caff' }}>
          {text}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      filters: [
        { text: '已完成', value: 'completed' },
        { text: '运行中', value: 'running' },
        { text: '待处理', value: 'pending' },
        { text: '警告', value: 'warning' },
        { text: '错误', value: 'error' },
      ],
      onFilter: (value, record) => record.status === value,
      render: (status: string) => (
        <span className={styles[`statusBadge`]}>{statusIconMap[getStatusIconKey(status)]} {status}</span>
      ),
    },
    {
      title: '各层耗时',
      key: 'stages_duration',
      width: 280,
      render: (_: unknown, record: TaskRecord) => (
        <Space size={4} wrap>
          {PIPELINE_STAGES.map((s) => (
            <span
              key={s.stage}
              style={{
                fontSize: 10,
                padding: '1px 6px',
                borderRadius: 4,
                background: `${s.color}15`,
                color: s.color,
              }}
            >
              {s.stage}: {formatDuration(record.stages_duration[s.stage] || 0)}
            </span>
          ))}
        </Space>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: unknown, record: TaskRecord) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          className={styles.actionBtn}
          onClick={() => handleViewDetail(record)}
        >
          详情
        </Button>
      ),
    },
  ];

  const statCards = [
    { label: '待处理任务', value: summary.pending_count, icon: <ClockCircleOutlined />, bg: 'rgba(102,126,234,0.12)', color: '#667eea' },
    { label: '执行中', value: summary.running_count, icon: <SyncOutlined spin />, bg: 'rgba(245,166,35,0.12)', color: '#f5a623' },
    { label: '今日完成', value: summary.completed_today, icon: <CheckCircleOutlined />, bg: 'rgba(0,180,42,0.12)', color: '#00b42a' },
    { label: '平均耗时', value: formatDuration(summary.avg_duration_ms), icon: <ThunderboltOutlined />, bg: 'rgba(118,75,162,0.12)', color: '#764ba2' },
    { label: '成功率', value: `${summary.success_rate}%`, icon: <SafetyCertificateOutlined />, bg: 'rgba(0,180,42,0.12)', color: '#00b42a' },
  ];

  return (
    <div className={styles.executionCenter}>
      {/* ====== Hero 动态轮播区 ====== */}
      <div className={styles.heroSection}>
        <div className={styles.heroBgGlow} />
        <div className={styles.heroContent}>
          {/* 左侧：轮播文字 */}
          <div className={styles.heroLeft}>
            <AnimatePresence mode="wait">
              <motion.div
                key={HERO_SLIDES[heroIndex].id}
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 30 }}
                transition={{ duration: 0.5, ease: 'easeInOut' }}
              >
                <div className={styles.heroTag} style={{ color: HERO_SLIDES[heroIndex].tagColor }}>
                  <span className={styles.heroTagDot} style={{ background: HERO_SLIDES[heroIndex].tagColor }} />
                  {HERO_SLIDES[heroIndex].tag}
                </div>
                <h1 className={styles.heroTitle}>{HERO_SLIDES[heroIndex].title}</h1>
                <p className={styles.heroSubtitle}>{HERO_SLIDES[heroIndex].subtitle}</p>
              </motion.div>
            </AnimatePresence>

            {/* 右侧：关键指标卡片 */}
            <motion.div
              className={styles.heroMetric}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
            >
              <span className={styles.heroMetricIcon}>{HERO_SLIDES[heroIndex].metric.icon}</span>
              <span className={styles.heroMetricValue}>{HERO_SLIDES[heroIndex].metric.value}</span>
              <span className={styles.heroMetricLabel}>{HERO_SLIDES[heroIndex].metric.label}</span>
            </motion.div>
          </div>

          {/* 右侧：操作区 */}
          <div className={styles.heroRight}>
            <Button
              icon={<SearchOutlined />}
              onClick={loadSummary}
              size="middle"
              className={styles.heroRefreshBtn}
            >
              刷新数据
            </Button>
          </div>
        </div>

        {/* 轮播指示器 */}
        <div className={styles.heroIndicators}>
          {HERO_SLIDES.map((_, idx) => (
            <button
              key={idx}
              className={`${styles.heroDot} ${idx === heroIndex ? styles.heroDotActive : ''}`}
              onClick={() => setHeroIndex(idx)}
              aria-label={`切换到第${idx + 1}页`}
            />
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className={styles.statsRow}>
        {statCards.map((card, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08, duration: 0.4 }}
          >
            <div className={styles.statCard}>
              <div className={styles.statCardHeader}>
                <div className={styles.statIconWrap} style={{ background: card.bg, color: card.color }}>{card.icon}</div>
                <span className={styles.statLabel}>{card.label}</span>
              </div>
              <div className={styles.statValue}>{card.value}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ====== 推荐快捷操作 ====== */}
      <div className={styles.quickActionsSection}>
        <div className={styles.quickActionsHeader}>
          <h2 className={styles.sectionTitle} style={{ marginBottom: 0 }}>
            <span className={styles.sectionTitleIcon}><ZapOutlined /></span>
            快捷操作
          </h2>
          <span className={styles.quickActionsHint}>点击快速填充任务配置</span>
        </div>
        <div className={styles.quickActionsGrid}>
          {QUICK_ACTIONS.map((action, idx) => (
            <motion.div
              key={action.workflow}
              className={`${styles.quickActionCard} ${action.hot ? styles.quickActionHot : ''}`}
              onClick={() => handleQuickAction(action.workflow)}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + idx * 0.1, duration: 0.35 }}
              whileHover={{ y: -4, boxShadow: `0 8px 28px ${action.color}25` }}
              whileTap={{ scale: 0.97 }}
            >
              {action.hot && (
                <span className={styles.quickActionHotBadge}><FireOutlined /> 热门</span>
              )}
              <div className={styles.quickActionIcon} style={{ background: `${action.color}18`, color: action.color }}>
                {action.icon}
              </div>
              <div className={styles.quickActionInfo}>
                <span className={styles.quickActionTitle}>{action.title}</span>
                <span className={styles.quickActionDesc}>{action.desc}</span>
              </div>
              <ArrowRightOutlined className={styles.quickActionArrow} />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Pipeline Visualization */}
      <div className={styles.pipelineSection}>
        <h2 className={styles.sectionTitle}><span className={styles.sectionTitleIcon}><FileTextOutlined /></span>流水线执行链路</h2>
        <div className={styles.pipelineSteps}>
          {stages.map((stage, idx) => (
            <div key={stage.stage} className={styles.stepItem}>
              <div className={`${styles.stepIconCircle} ${styles[getStageStatusClass(stage.status)]}`}>
                {stageIconMap[PIPELINE_STAGES[idx]?.iconKey || ''] || <CodeOutlined />}
              </div>
              <div className={styles.stepName}>{stage.stage_name}</div>
              <span className={`${styles.stepStageTag} ${styles[getStageStatusClass(stage.status)]}`}>{stage.status}</span>
              <div className={styles.stepSummary}>{stage.summary}</div>
              <div className={styles.stepDuration}>{formatDuration(stage.duration_ms)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Submit Form */}
      <div className={styles.submitSection}>
        <h2 className={styles.sectionTitle}><span className={styles.sectionTitleIcon}><SendOutlined /></span>提交新任务</h2>
        <div className={styles.submitForm}>
          <div className={styles.formRow}>
            <div className={styles.formItem}>
              <label className={styles.formItemLabel}>工作流模板</label>
              <Select value={workflowType} onChange={setWorkflowType} className={styles.selectWrapper} popupMatchSelectWidth={false}>
                {WORKFLOW_OPTIONS.map((opt) => (<Option key={opt.value} value={opt.value}>{opt.label}</Option>))}
              </Select>
            </div>
            <div className={styles.formItem}>
              <label className={styles.formItemLabel}>安全等级</label>
              <Select value={securityLevel} onChange={setSecurityLevel} className={styles.selectWrapper} popupMatchSelectWidth={false}>
                <Option value="normal">普通</Option><Option value="high">高</Option><Option value="critical">严格</Option>
              </Select>
            </div>
            <div className={styles.formItem}>
              <label className={styles.formItemLabel}>优先级</label>
              <Select value={priority} onChange={setPriority} className={styles.selectWrapper} popupMatchSelectWidth={false}>
                <Option value="normal">普通</Option><Option value="high">高</Option><Option value="critical">紧急</Option>
              </Select>
            </div>
            <div className={styles.formItem}>
              <label className={styles.formItemLabel}>调用技能 <Tag color="purple" style={{ fontSize: 10, marginLeft: 4 }}>{selectedSkills.length}</Tag></label>
              <Select
                mode="multiple"
                showSearch
                allowClear
                placeholder="搜索并选择技能..."
                value={selectedSkills}
                onChange={(vals) => setSelectedSkills(vals as number[])}
                onSearch={handleSkillSearch}
                filterOption={false}
                loading={skillLoading}
                className={styles.skillSelect}
                popupMatchSelectWidth={false}
                maxTagCount={2}
                optionLabelProp="label"
              >
                {skillOptions.map((sk) => (
                  <Option key={sk.id} value={sk.id} label={sk.name}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
                      <span
                        style={{
                          width: 8, height: 8, borderRadius: '50%', background: sk.icon_color || '#667eea',
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontWeight: 500, color: '#d0d8ec' }}>{sk.name}</span>
                      <span style={{ fontSize: 11, color: '#6b768c', marginLeft: 'auto' }}>{sk.category}</span>
                    </div>
                  </Option>
                ))}
              </Select>
            </div>
          </div>
          <div className={styles.formItem} style={{ marginBottom: 16 }}>
            <label className={styles.formItemLabel}>输入内容（支持代码/文本）</label>
            <TextArea className={styles.textareaStyle} value={inputContent} onChange={(e) => setInputContent(e.target.value)}
              placeholder={"// 在此输入代码或文本内容...\n// 示例：function hello() { console.log('Hello World'); }\n\n或粘贴需要验证的内容..."}
              rows={6} />
          </div>
          <Button type="primary" icon={<SendOutlined />} loading={submitting} className={styles.submitBtn} onClick={handleSubmit}>提交执行</Button>
        </div>
      </div>

      {/* History Table */}
      <div className={styles.historySection}>
        <div className={styles.historyHeader}>
          <h2 className={styles.sectionTitle} style={{ marginBottom: 0 }}><span className={styles.sectionTitleIcon}><ClockCircleOutlined /></span>执行历史</h2>
          <div className={styles.filterGroup}>
            {['all', 'running', 'completed', 'pending', 'error'].map((s) => (
              <button key={s} className={`${styles.filterBtn} ${filterStatus === s ? styles.active : ''}`} onClick={() => setFilterStatus(s)}>
                {s === 'all' ? '全部' : s === 'running' ? '运行中' : s === 'completed' ? '已完成' : s === 'pending' ? '待处理' : '错误'}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.tableWrapper}>
          <Table<TaskRecord> className={styles.tableStyle} dataSource={filteredTasks} columns={columns} rowKey="task_id"
            pagination={{ pageSize: 8, size: 'small', showTotal: (total) => `共 ${total} 条记录` }} size="middle" locale={{ emptyText: '暂无执行记录' }}
            scroll={{ x: 800 }}
          />
        </div>
      </div>

      {/* Logs */}
      <div className={styles.logSection}>
        <Collapse ghost defaultActiveKey={['logs']} items={[{
          key: 'logs',
          label: <h2 className={styles.sectionTitle} style={{ margin: 0 }}><span className={styles.sectionTitleIcon}><AuditOutlined /></span>实时审计日志<Tag color="blue" style={{ marginLeft: 8, fontSize: 11 }}>{logs.length} 条</Tag></h2>,
          children: (
            <div className={styles.logContainer}>
              {logs.map((log, i) => (
                <div key={i} className={styles.logEntry}>
                  <span className={styles.logTime}>[{log.time}]</span>
                  <span className={`${styles.logLevel} ${styles[log.level]}`}>[{log.level.toUpperCase()}]</span>
                  <span className={styles.logMsg}>{log.message}</span>
                </div>
              ))}
            </div>
          ),
        }]} />
      </div>

      {/* Detail Modal */}
      <Modal open={detailVisible} onCancel={() => setDetailVisible(false)} footer={null}
        title={detailTask ? (<span><FileTextOutlined /> 任务详情 — {detailTask.task_id}</span>) : undefined}
        width={600} className={styles.detailModal}>
        {detailTask && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div><span style={{ fontSize: 12, color: '#7a8599' }}>工作流类型</span><div style={{ fontWeight: 600, marginTop: 2 }}>{detailTask.workflow_type}</div></div>
              <div><span style={{ fontSize: 12, color: '#7a8599' }}>当前状态</span><div style={{ marginTop: 2 }}><span className={styles[`statusBadge`]}>{statusIconMap[getStatusIconKey(detailTask.status)]} {detailTask.status}</span></div></div>
              <div><span style={{ fontSize: 12, color: '#7a8599' }}>创建时间</span><div style={{ fontWeight: 500, marginTop: 2 }}>{detailTask.created_at}</div></div>
              <div><span style={{ fontSize: 12, color: '#7a8599' }}>总耗时</span><div style={{ fontWeight: 600, marginTop: 2, color: '#667eea' }}>{formatDuration(Object.values(detailTask.stages_duration).reduce((a, b) => a + b, 0))}</div></div>
            </div>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e0e6f0', marginBottom: 12 }}>各层详情</h3>
            <div className={styles.stageDetailList}>
              {PIPELINE_STAGES.map((ps, idx) => {
                const dur = detailTask.stages_duration[ps.stage] || 0;
                const isDone = dur > 0;
                const statusColor = isDone ? '#00b42a' : detailTask.status === 'running' && idx <= Object.keys(detailTask.stages_duration).length ? '#667eea' : '#4a5568';
                return (
                  <div key={ps.stage} className={styles.stageDetailItem}>
                    <div className={styles.stageDetailDot} style={{ background: isDone ? ps.color : 'transparent', border: `2px solid ${isDone ? ps.color : '#4a5568'}` }} />
                    <div className={styles.stageDetailContent}>
                      <div className={styles.stageDetailName}>[{ps.stage}] {ps.name}<span style={{ marginLeft: 8, fontSize: 11, color: statusColor, fontWeight: 400 }}>{isDone ? `OK ${formatDuration(dur)}` : '-- waiting'}</span></div>
                      <div className={styles.stageDetailInfo}>{isDone ? `Stage completed in ${formatDuration(dur)}` : 'Waiting for upstream stages'}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ExecutionCenter;
