import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Input,
  Button,
  Avatar,
  Tag,
  Tooltip,
  message,
  Dropdown,
  Spin,
  Empty,
  Steps,
  Card,
  Statistic,
  Row,
  Col,
  Progress,
  Timeline,
} from 'antd';
import {
  Send,
  Plus,
  MessageSquare,
  Clock,
  Trash2,
  Sparkles,
  Zap,
  FileText,
  Image as ImageIcon,
  Code2,
  GraduationCap,
  Briefcase,
  FileSignature,
  Megaphone,
  Video,
  Bot,
  User,
  ChevronDown,
  Settings2,
  History,
  TrendingUp,
  BookOpen,
  Lightbulb,
  Rocket,
  Shield,
  Search,
  Paperclip,
  Mic,
  Loader2,
  CheckCircle,
  Play,
  Pause,
  RotateCcw,
  Eye,
  CheckCircle2,
  Lock,
  Gavel,
  Target,
  Activity,
  FileOutput,
  AlertTriangle,
  XCircle,
  X,
  ArrowRight,
  ListChecks,
  BrainCircuit,
  Cpu,
  Grid3X3,
  Workflow,
  ArrowRightLeft,
  LayoutGrid,
  GitBranch,
  Route,
  Server,
  FileCheck,
} from 'lucide-react';
import { identifyApi } from '@/api/logCenterApi';
import { agentApi, type AgentPublicItem } from '@/api/agentApi';
import deepseekApi, { SCENARIO_SYSTEM_PROMPTS } from '@/api/deepseekApi';
import SkillSelectorPanel from './SkillSelectorPanel';
import { SKILL_MATRIX, type SkillItem } from '@/data/skillMatrix';
import { type SkillConfigItem } from '@/api/skillConfigApi';
import { contextManager, type CompressedContext, type MindMapNode, renderMindMapToText } from '@/utils/contextManager';
import { useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';

const { TextArea } = Input;

interface ExecutionTask {
  id: string;
  agentCode: string;
  agentName: string;
  scenario: string;
  inputContent: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  result?: ExecutionResult;
  steps: ExecutionStep[];
}

interface ExecutionStep {
  key: string;
  title: string;
  description: string;
  status: 'wait' | 'process' | 'finish' | 'error';
  output?: string;
  duration?: number;
}

interface ExecutionResult {
  level: 'safe' | 'warning' | 'danger';
  levelText: string;
  confidence: number;
  aiProbability: number;
  summary: string;
  details: Array<{
    title: string;
    status: 'pass' | 'warn' | 'fail';
    content: string;
  }>;
  agentAnalysis: string;
  recommendations: string[];
}

interface ChatSession {
  id: string;
  title: string;
  agentCode: string;
  lastTaskStatus: string;
  updatedAt: Date;
  taskCount: number;
}

interface ScenarioOption {
  key: string;
  label: string;
  icon: React.ReactNode;
  color: string;
  agentCode: string;
}

interface AgentRole {
  code: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  description: string;
  capabilities: string[];
}

type IntentCategory =
  | 'security_detect'
  | 'text_process'
  | 'code_execute'
  | 'office_auto'
  | 'multimedia'
  | 'general';

interface IntentResult {
  category: IntentCategory;
  confidence: number;
  suggestedScenario: string;
  suggestedSkills: string[];
}

interface AtomicTask {
  id: string;
  skill: string;
  displayName: string;
  dependsOn?: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
}

const AGENT_ROLES: AgentRole[] = [
  {
    code: 'auditor',
    name: '安全审计',
    icon: <Eye size={18} />,
    color: '#DC2626',
    bgColor: '#FEF2F2',
    description: '全方位扫描内容风险，识别敏感信息与违规内容',
    capabilities: ['内容审计', '风险识别', '合规检查', '报告生成'],
  },
  {
    code: 'verifier',
    name: '真实性核验',
    icon: <CheckCircle2 size={18} />,
    color: '#2563EB',
    bgColor: '#EFF6FF',
    description: '多维度真实性校验，交叉比对来源可信度',
    capabilities: ['真实性验证', '来源比对', '置信度评估', '事实核查'],
  },
  {
    code: 'archiver',
    name: '数据存证',
    icon: <Lock size={18} />,
    color: '#16A34A',
    bgColor: '#F0FDF4',
    description: '区块链级别存证服务，保障数据完整性',
    capabilities: ['数字存证', '时间戳记录', '完整性校验', '防篡改'],
  },
  {
    code: 'judge',
    name: '智能裁决',
    icon: <Gavel size={18} />,
    color: '#EA580C',
    bgColor: '#FFF7ED',
    description: '智能仲裁决策引擎，提供可追溯的裁决结果',
    capabilities: ['规则匹配', '风险评估', '决策输出', '仲裁建议'],
  },
];

const SCENARIO_OPTIONS: ScenarioOption[] = [
  { key: 'text', label: '文案鉴别', icon: <FileText size={14} />, color: '#165DFF', agentCode: 'auditor' },
  { key: 'image', label: '图片检测', icon: <ImageIcon size={14} />, color: '#00B42A', agentCode: 'verifier' },
  { key: 'code', label: '代码审查', icon: <Code2 size={14} />, color: '#722ED1', agentCode: 'auditor' },
  { key: 'paper', label: '论文查重', icon: <GraduationCap size={14} />, color: '#FF7D00', agentCode: 'archiver' },
  { key: 'resume', label: '简历优化', icon: <Briefcase size={14} />, color: '#F5319D', agentCode: 'verifier' },
  { key: 'contract', label: '合同审查', icon: <FileSignature size={14} />, color: '#722ED1', agentCode: 'judge' },
  { key: 'marketing', label: '营销文案', icon: <Megaphone size={14} />, color: '#FF7D00', agentCode: 'judge' },
  { key: 'video', label: '视频脚本', icon: <Video size={14} />, color: '#00B42A', agentCode: 'auditor' },
];

const QUICK_TASKS = [
  { id: 'qt1', title: '文案内容安全审计', agent: 'auditor', scenario: 'text', icon: <Eye size={18} />, color: '#DC2626' },
  { id: 'qt2', title: '图片真实性核验检测', agent: 'verifier', scenario: 'image', icon: <CheckCircle2 size={18} />, color: '#2563EB' },
  { id: 'qt3', title: '合同合规风险评估', agent: 'judge', scenario: 'contract', icon: <Gavel size={18} />, color: '#EA580C' },
  { id: 'qt4', title: '论文数据存证与校验', agent: 'archiver', scenario: 'paper', icon: <Lock size={18} />, color: '#16A34A' },
  { id: 'qt5', title: '代码安全漏洞扫描', agent: 'auditor', scenario: 'code', icon: <Eye size={18} />, color: '#DC2626' },
  { id: 'qt6', title: '简历信息真实性评估', agent: 'verifier', scenario: 'resume', icon: <CheckCircle2 size={18} />, color: '#2563EB' },
  { id: 'qt7', title: '营销文案合规性检查', agent: 'judge', scenario: 'marketing', icon: <Gavel size={18} />, color: '#EA580C' },
  { id: 'qt8', title: '视频脚本内容审核', agent: 'auditor', scenario: 'video', icon: <Eye size={18} />, color: '#DC2626' },
];

const MULTI_AGENT_PRESETS = [
  {
    id: 'ma_full',
    name: '多维协同完整检测',
    desc: '安全审计→真实性核验→数据存证→智能裁决，全流程协同分析',
    agents: ['auditor', 'verifier', 'archiver', 'judge'],
    icon: <Shield size={20} />,
    color: '#722ED1',
    badge: '推荐',
  },
  {
    id: 'ma_quick',
    name: '快速双核检测',
    desc: '安全审计+真实性核验并行执行，快速输出检测结果',
    agents: ['auditor', 'verifier'],
    icon: <Zap size={20} />,
    color: '#FF7D00',
    badge: null,
  },
  {
    id: 'ma_legal',
    name: '合规风控专项检测',
    desc: '真实性核验+智能裁决组合，专注法律与合同合规场景',
    agents: ['verifier', 'judge'],
    icon: <Gavel size={20} />,
    color: '#EA580C',
    badge: null,
  },
];

const generateId = () => 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

const INTENT_KEYWORD_MAP: Record<string, IntentCategory> = {
  '检测': 'security_detect', '查重': 'security_detect', '抄袭': 'security_detect',
  '漏洞': 'security_detect', '安全': 'security_detect', '风险': 'security_detect',
  '审核': 'security_detect', '合规': 'security_detect', '审计': 'security_detect',
  '优化': 'text_process', '润色': 'text_process', '改写': 'text_process',
  '翻译': 'text_process', '摘要': 'text_process', '生成': 'text_process',
  '降重': 'text_process', '排版': 'text_process', '校对': 'text_process',
  '运行': 'code_execute', '执行': 'code_execute', '调试': 'code_execute',
  '部署': 'code_execute', '编译': 'code_execute', '测试': 'code_execute',
  '简单': 'office_auto', '合同': 'office_auto', '报告': 'office_auto',
  '发票': 'office_auto', '表格': 'office_auto', '邮件': 'office_auto',
  '图片': 'multimedia', '视频': 'multimedia', '音频': 'multimedia',
  'OCR': 'multimedia', '截图': 'multimedia', '压缩': 'multimedia',
};

const ARCHITECTURE_LAYERS = [
  { name: '应用层', desc: '接收请求', icon: LayoutGrid, color: '#6366f1' },
  { name: '编排器', desc: '需求拆解', icon: GitBranch, color: '#8b5cf6' },
  { name: 'ASS网关', desc: '安全巡检', icon: Shield, color: '#dc2626' },
  { name: '路由器', desc: '成本调度', icon: Route, color: '#ea580c' },
  { name: '算力层', desc: '节点执行', icon: Server, color: '#2563eb' },
  { name: '执行层', desc: '技能调度', icon: Play, color: '#16a34a' },
  { name: '审计层', desc: '日志存证', icon: FileCheck, color: '#722ed1' },
];

function recognizeIntent(input: string): IntentResult {
  const lower = input.toLowerCase();
  let matchedCategories: { cat: IntentCategory; score: number }[] = [];

  for (const [keyword, category] of Object.entries(INTENT_KEYWORD_MAP)) {
    if (lower.includes(keyword.toLowerCase())) {
      matchedCategories.push({ cat: category, score: keyword.length });
    }
  }

  if (matchedCategories.length === 0) {
    return { category: 'general', confidence: 0, suggestedScenario: 'custom', suggestedSkills: [] };
  }

  matchedCategories.sort((a, b) => b.score - a.score);
  const best = matchedCategories[0];

  const scenarioMap: Record<IntentCategory, string> = {
    security_detect: 'text',
    text_process: 'text',
    code_execute: 'code',
    office_auto: 'document',
    multimedia: 'image',
    general: 'custom',
  };

  return {
    category: best.cat,
    confidence: Math.min(best.score / 10, 1),
    suggestedScenario: scenarioMap[best.cat] || 'custom',
    suggestedSkills: matchedCategories.map(m => m.cat),
  };
}

function decomposeTask(input: string, intent: IntentResult): AtomicTask[] {
  const tasks: AtomicTask[] = [];

  const compositePatterns = [
    {
      pattern: /(?:检测|查重).*(?:并|和|同时).*(?:优化|改进|修改)/i,
      skills: ['ai_detection', 'plagiarism_check', 'content_optimization'],
      names: ['AI含量检测', '重复率检测', '内容优化'],
    },
    {
      pattern: /(?:检测|扫描).*(?:并|和|同时).*(?:修复|修补)/i,
      skills: ['vulnerability_scan', 'auto_fix'],
      names: ['漏洞扫描', '自动修复'],
    },
    {
      pattern: /(?:翻译).*(?:并|和|同时).*(?:校对|检测)/i,
      skills: ['translate', 'proofread'],
      names: ['文本翻译', '内容校对'],
    },
  ];

  for (const rule of compositePatterns) {
    if (rule.pattern.test(input)) {
      rule.skills.forEach((skill, idx) => {
        tasks.push({
          id: `task_${idx}_${Date.now()}`,
          skill,
          displayName: rule.names[idx],
          dependsOn: idx > 0 ? [`task_${idx - 1}_${Date.now()}`] : undefined,
          status: 'pending',
        });
      });
      return tasks;
    }
  }

  const singleSkillMap: Record<IntentCategory, { skill: string; name: string }> = {
    security_detect: { skill: 'full_security_scan', name: '多维协同完整检测' },
    text_process: { skill: 'text_optimization', name: '文本智能优化' },
    code_execute: { skill: 'code_safe_execution', name: '代码安全执行' },
    office_auto: { skill: 'document_processing', name: '文档智能处理' },
    multimedia: { skill: 'media_analysis', name: '多媒体分析' },
    general: { skill: 'intelligent_detection', name: '智能综合检测' },
  };

  const mapping = singleSkillMap[intent.category];
  tasks.push({
    id: 'task_main_' + Date.now(),
    skill: mapping.skill,
    displayName: mapping.name,
    status: 'pending',
  });

  return tasks;
}

/* ====== 电影级 CG 动画变体体系 ====== */

// 电影级容器编排（stagger 子元素）
const cinemaContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.10, delayChildren: 0.12 },
  },
};

// 电影级淡入上移（支持自定义 delay）
const cinemaFadeUpVariants = {
  hidden: { opacity: 0, y: 32, scale: 0.97 },
  visible: (d: number = 0) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { delay: d, duration: 0.65, ease: [0.22, 1, 0.36, 1] },
  }),
};

// 电影级缩放入场
const cinemaScaleInVariants = {
  hidden: { opacity: 0, scale: 0.9, y: 18 },
  visible: (d: number = 0) => ({
    opacity: 1, scale: 1, y: 0,
    transition: { delay: d, duration: 0.58, ease: [0.22, 1, 0.36, 1] },
  }),
};

// 电影级 3D 透视入场（用于重要卡片）
const cinema3DVariants = {
  hidden: (i: number) => ({
    opacity: 0, y: 40, rotateX: 8, rotateY: i % 2 ? 6 : -6, scale: 0.94,
  }),
  visible: {
    opacity: 1, y: 0, rotateX: 0, rotateY: 0, scale: 1,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  },
};

// 电影级左侧滑入
const cinemaSlideLeftVariants = {
  hidden: { opacity: 0, x: -30 },
  visible: (d: number = 0) => ({
    opacity: 1, x: 0,
    transition: { delay: d, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  }),
};

// 弹性 pop-in 入场（用于标签、图标等小元素）
const cinemaPopInVariants = {
  hidden: { opacity: 0, scale: 0, y: -10 },
  visible: (d: number = 0) => ({
    opacity: 1, scale: 1, y: 0,
    transition: { delay: d, type: 'spring', stiffness: 380, damping: 18 },
  }),
};

// 级联卡片入场（用于 grid 列表）
const cinemaCascadeVariants = {
  hidden: (i: number) => ({ opacity: 0, scale: 0.88, y: 16 }),
  visible: (i: number) => ({
    opacity: 1, scale: 1, y: 0,
    transition: { delay: i * 0.05, duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  }),
};

// 兼容旧引用的别名
const cgContainerVariants = cinemaContainerVariants;
const cgFadeUpVariants = cinemaFadeUpVariants;
const cgScaleInVariants = cinemaScaleInVariants;
const cgSlideLeftVariants = cinemaSlideLeftVariants;

/* ====== ShineOverlay 光泽扫过组件 ====== */
function ShineOverlay() {
  return (
    <motion.div
      initial={{ left: '-100%' }}
      whileHover={{ left: '200%' }}
      transition={{ duration: 0.55, ease: 'easeInOut' }}
      style={{
        position: 'absolute', top: 0, bottom: 0, width: '45%',
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)',
        pointerEvents: 'none',
        borderRadius: 'inherit',
      }}
    />
  );
}

/* ====== 微型环形进度指示器 ====== */
function MiniRingProgress({ value, size = 32, color = '#165DFF' }: { value: number; size?: number; color?: string }) {
  const radius = (size - 4) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  return (
    <svg width={size} height={size} style={{ display: 'block' }}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E5E6EB" strokeWidth={2.5} />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
        style={{ transformOrigin: 'center', transform: 'rotate(-90deg)' }}
      />
    </svg>
  );
}

const AgentCenter: React.FC = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<ChatSession[]>([
    {
      id: 's_demo',
      title: '审计会话 - 文案安全审计',
      agentCode: 'auditor',
      lastTaskStatus: 'completed',
      updatedAt: new Date(),
      taskCount: 1,
    },
    {
      id: 's_demo2',
      title: '验证会话 - 图片真实性验证',
      agentCode: 'verifier',
      lastTaskStatus: 'completed',
      updatedAt: new Date(Date.now() - 3600000),
      taskCount: 2,
    },
  ]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [currentAgent, setCurrentAgent] = useState<AgentRole>(AGENT_ROLES[0]);
  const [searchParams] = useSearchParams();

  /* 从URL参数 ?role=xxx 自动选中角色 */
  useEffect(() => {
    const roleParam = searchParams.get('role');
    if (roleParam) {
      const found = AGENT_ROLES.find((a) => a.code === roleParam);
      if (found) setCurrentAgent(found);
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps
  const [currentScenario, setCurrentScenario] = useState('text');
  const [inputValue, setInputValue] = useState('');
  const [attachments, setAttachments] = useState<{ file: File; preview: string; name: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTask, setActiveTask] = useState<ExecutionTask | null>(null);
  const [executionSteps, setExecutionSteps] = useState<ExecutionStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [skillPanelOpen, setSkillPanelOpen] = useState(false);
  const [selectedSkills, setSelectedSkills] = useState<SkillConfigItem[]>([]);
  const [compressedContext, setCompressedContext] = useState<CompressedContext | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [showMindMap, setShowMindMap] = useState(false);
  const [conversationMode, setConversationMode] = useState(false);
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: string; content: string; time: Date }>>([]);
  const [multiAgentMode, setMultiAgentMode] = useState(false);
  const [multiAgentResults, setMultiAgentResults] = useState<Array<{ agentCode: string; agentName: string; result: ExecutionResult | null; status: string }>>([]);
  const [intentResult, setIntentResult] = useState<IntentResult | null>(null);
  const [atomicTasks, setAtomicTasks] = useState<AtomicTask[]>([]);
  const [architectureStep, setArchitectureStep] = useState(0);
  // Monaco 编辑器模式
  const [editorMode, setEditorMode] = useState<'text' | 'code'>('text');
  const [editorLanguage, setEditorLanguage] = useState('plaintext');
const [monacoValue, setMonacoValue] = useState('');

  useEffect(() => {
    deepseekApi.trackScenarioSwitch(currentScenario);
  }, [currentScenario]);

  // 组件挂载时从后端加载会话列表
  useEffect(() => {
    agentApi.getSessions(20).then(res => {
      if (res?.success && res.data?.length > 0) {
        // 将后端会话转换为前端对话历史格式
        const history: Array<{ role: string; content: string; time: Date; sessionId?: string }> = [];
        for (const sess of res.data) {
          for (const msg of sess.messages) {
            if (msg.role === 'user' || msg.role === 'assistant') {
              history.push({
                role: msg.role,
                content: msg.content,
                time: new Date(msg.createdAt),
                sessionId: sess.sessionId,
              });
            }
          }
        }
        if (history.length > 0) {
          setConversationHistory(history);
          console.log(`[AIChatCenter] 从后端加载了 ${res.data.length} 个会话, ${history.length} 条消息`);
        }
      }
    }).catch(err => {
      console.warn('[AIChatCenter] 加载会话列表失败（使用本地缓存）:', err);
    });
  }, []);

  const currentScenarioConfig = SCENARIO_OPTIONS.find(s => s.key === currentScenario) || SCENARIO_OPTIONS[0];

  const handleNewTask = useCallback(() => {
    const newSession: ChatSession = {
      id: generateId(),
      title: currentAgent.name + ' - ' + currentScenarioConfig.label + '任务',
      agentCode: currentAgent.code,
      lastTaskStatus: 'pending',
      updatedAt: new Date(),
      taskCount: 0,
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setActiveTask(null);
    setExecutionSteps([]);
    setInputValue('');
  }, [currentAgent, currentScenarioConfig.label]);

  const handleSelectSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    setActiveTask(null);
    setExecutionSteps([]);
  };

  const handleDeleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
      setActiveTask(null);
    }
    message.success('会话已删除');
  };

  const executeTask = async () => {
    if (!inputValue.trim()) return;

    const inputText = inputValue.trim();

    const intent = recognizeIntent(inputText);
    setIntentResult(intent);

    const tasks = decomposeTask(inputText, intent);
    setAtomicTasks(tasks);

    setArchitectureStep(0);

    const taskId = generateId();
    const newTask: ExecutionTask = {
      id: taskId,
      agentCode: 'quad-agent',
      agentName: '多维协同',
      scenario: currentScenario,
      status: 'running',
      startTime: new Date(),
      steps: [],
      inputContent: inputText,
    };

    setActiveTask(newTask);
    setLoading(true);
    setMultiAgentMode(true);

    deepseekApi.trackIdentifyStart(currentScenario, 'quad_agent_execute');

    // 步骤条
    const steps: ExecutionStep[] = [
      { key: 'intent', title: '🧠 意图识别', description: `识别意图: ${intent.category} · 置信度 ${(intent.confidence * 100).toFixed(0)}%`, status: 'process' },
      { key: 'decompose', title: '🔧任务拆解', description: `拆解为${tasks.length} 个原子任务`, status: 'wait' },
      ...AGENT_ROLES.map((agent, idx) => ({
        key: `agent_${agent.code}`,
        title: `${idx + 1}. ${agent.name} 检测`,
        description: `正在执行${agent.capabilities[0]}...`,
        status: 'wait' as const,
      })),
      { key: 'report', title: '生成综合检测报告', description: '正在汇总各模块分析结果...', status: 'wait' },
    ];

    setExecutionSteps(steps);
    setCurrentStepIndex(0);
    setArchitectureStep(1);

    // 前端动画：意图识别 + 任务拆解
    await new Promise(resolve => setTimeout(resolve, 500));
    setExecutionSteps(prev => prev.map((step, idx) =>
      idx === 0 ? { ...step, status: 'finish' as const, duration: 500 } : step
    ));
    await new Promise(resolve => setTimeout(resolve, 300));
    setExecutionSteps(prev => prev.map((step, idx) =>
      idx === 1 ? { ...step, status: 'finish' as const, duration: 300 } : step
    ));
    setArchitectureStep(2);

    // ====== SSE 流式检测（实时推送各 Agent 进度）======
    try {
      console.log('[AIChatCenter] 启动SSE流式检测...');
      let sessionId = '';
      const allAgentResults: Array<{ agentCode: string; agentName: string; result: ExecutionResult | null; status: string }> = [];

      // 准备图片数据（如果有）
      const imageData = attachments.length > 0 && attachments[0].preview 
        ? attachments[0].preview.split(',')[1] // 移除 data:image/xxx;base64, 前缀
        : undefined;
      const imageName = attachments.length > 0 ? attachments[0].name : undefined;

      for await (const event of agentApi.detectStream({
        message: inputText,
        scenario: currentScenario,
        skills: selectedSkills.map(s => s.name),
        image: imageData,
        image_name: imageName,
      })) {
        console.log('[AIChatCenter] SSE event:', event.type, event.data);

        if (event.type === 'start') {
          sessionId = event.data.sessionId;
          console.log('[AIChatCenter] 会话已创建:', sessionId);
        }
        else if (event.type === 'agent_start') {
          const { index, agentCode, agentName } = event.data;
          setCurrentStepIndex(index + 3);
          setArchitectureStep(Math.min(3 + Math.floor((index / AGENT_ROLES.length) * 3), 5));

          setMultiAgentResults(prev => prev.map((r, idx) =>
            idx === index ? { ...r, status: 'running' } : r
          ));
          setExecutionSteps(prev => prev.map((step, idx) =>
            idx === index + 2 ? { ...step, status: 'process' as const } : step
          ));
        }
        else if (event.type === 'agent_complete') {
          const ar = event.data;
          const idx = allAgentResults.length;

          const execResult: ExecutionResult = {
            level: ar.result.level,
            levelText: ar.result.levelText,
            confidence: ar.result.confidence,
            aiProbability: ar.result.aiProbability,
            summary: ar.result.summary,
            details: (ar.result.details || []).map((d: any) => ({ title: d.category, status: d.severity || ar.result.level, content: d.description })),
            agentAnalysis: '',
            recommendations: ar.result.recommendations || [],
          };
          allAgentResults.push({ agentCode: ar.agentCode, agentName: ar.agentName, result: execResult, status: ar.status });

          // 实时标记该 Agent 完成
          setMultiAgentResults([...allAgentResults]);
          setExecutionSteps(prev => prev.map((step, i) =>
            i === idx + 2 ? { ...step, status: 'finish' as const, duration: ar.latencyMs > 500 ? 800 : 600 } : step
          ));
        }
        else if (event.type === 'complete') {
          const data = event.data;
          if (!sessionId) sessionId = data.sessionId;

          // 报告步骤完成
          setCurrentStepIndex(steps.length - 1);
          setArchitectureStep(6);
          setExecutionSteps(prev => prev.map((step, idx) =>
            idx === steps.length - 1 ? { ...step, status: 'finish' as const, duration: 300 } : step
          ));

          const finalResult: ExecutionResult = {
            level: data.finalResult.level,
            levelText: data.finalResult.levelText.replace(/[✅⚠️❌]/g, '').trim(),
            confidence: data.finalResult.confidence,
            aiProbability: data.finalResult.aiProbability,
            summary: data.finalResult.summary,
            details: (data.finalResult.details || []).map((d: any) => ({ title: d.category, status: d.severity || data.finalResult.level, content: d.description })),
            agentAnalysis: data.finalResult.agentAnalysis || '',
            recommendations: data.finalResult.recommendations || [],
          };

          setActiveTask(prev => prev ? { ...prev, status: 'completed', endTime: new Date(), result: finalResult } : null);
          deepseekApi.trackIdentifyComplete(currentScenario, finalLevelFromData(data.finalResult.level), 0);
          message.success('多维协同检测完成！');

          setLoading(false);
          setConversationHistory(prev => [
            ...prev,
            { role: 'user', content: inputText, time: new Date() },
            { role: 'assistant', content: finalResult.summary, time: new Date(), sessionId },
          ]);

          // 存储报告到 localStorage
          try {
            const reports = JSON.parse(localStorage.getItem('yjdd_reports') || '[]');
            reports.unshift({
              id: generateId(),
              scenario: currentScenario,
              content: inputText,
              result: finalResult,
              timestamp: new Date().toISOString(),
              sessionId,
            });
            localStorage.setItem('yjdd_reports', JSON.stringify(reports.slice(0, 50)));
          } catch {}
        }
        else if (event.type === 'error') {
          throw new Error(event.data.message || 'SSE流式检测异常');
        }
      }

      // 如果没有收到 complete 事件但循环正常结束
      if (!activeTask?.result && loading) {
        setLoading(false);
        message.warning('检测流程已结束，结果可能不完整');
      }

    } catch (err) {
      // 用户刷新页面导致请求中止，不弹错误
      if (err instanceof DOMException && err.name === 'AbortError') {
        console.log('[AIChatCenter] SSE连接已中断（页面刷新或导航）');
        return;
      }
      // 网络错误（ERR_ABORTED等）静默处理
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('abort') || errMsg.includes('Abort') || errMsg.includes('ERR_ABORTED')) {
        console.log('[AIChatCenter] SSE请求被取消:', errMsg);
        setLoading(false);
        return;
      }

      console.error('[AIChatCenter] SSE检测失败:', err);

      setExecutionSteps(prev => prev.map(step =>
        step.status === 'wait' || step.status === 'process'
          ? { ...step, status: 'error' as const }
          : step
      ));

      message.error(`检测失败: ${errMsg}`);
      setLoading(false);
    }
  };

  /** 从后端等级映射到前端追踪等级 */
  function finalLevelFromData(level: string): 'safe' | 'warning' | 'danger' {
    if (level === 'danger') return 'danger';
    if (level === 'warning') return 'warning';
    return 'safe';
  }

  /** 导出检测报告为 HTML 文件 */
  const handleExportReport = () => {
    const task = activeTask;
    if (!task?.result) {
      message.warning('暂无报告可导出，请先完成检测');
      return;
    }
    const r = task.result;
    const now = new Date().toLocaleString('zh-CN');
    const levelColor = r.level === 'safe' ? '#00B42A' : r.level === 'warning' ? '#FF7D00' : '#F53F3F';
    const levelText = r.level === 'safe' ? '安全通过' : r.level === 'warning' ? '存在风险' : '高风险警报';

    // 构建多Agent结果HTML
    let agentRowsHtml = '';
    if (multiAgentResults.length > 0) {
      agentRowsHtml = multiAgentResults.map(ar => {
        if (!ar.result) return '';
        return `
        <tr>
          <td style="padding:12px;border:1px solid #E5E6EB;font-weight:600;color:#1D2129">${ar.agentName}</td>
          <td style="padding:12px;border:1px solid #E5E6EB;text-align:center">
            <span style="color:${ar.result.level === 'safe' ? '#00B42A' : ar.result.level === 'warning' ? '#FF7D00' : '#F53F3F'};font-weight:600">${ar.result.levelText || ar.result.level}</span>
          </td>
          <td style="padding:12px;border:1px solid #E5E6EB;text-align:center">${ar.result.confidence}%</td>
          <td style="padding:12px;border:1px solid #E5E6EB;text-align:center">${ar.result.aiProbability}%</td>
          <td style="padding:12px;border:1px solid #E5E6EB;max-width:300px">${(ar.result.summary || '').replace(/</g,'&lt;')}</td>
          <td style="padding:12px;border:1px solid #E5E6EB">${ar.latencyMs ? (ar.latencyMs / 1000).toFixed(1) + 's' : '-'}</td>
        </tr>`;
      }).join('');
    }

    // 检测详情
    let detailsHtml = '';
    if (r.details && r.details.length > 0) {
      detailsHtml = r.details.map(d => `
        <div style="display:flex;gap:8px;padding:10px;margin-bottom:8px;background:#FAFBFC;border-radius:8px;border-left:4px solid ${d.status === 'pass' ? '#00B42A' : d.status === 'warn' ? '#FF7D00' : '#F53F3F'}">
          <strong style="min-width:100px;color:#4E5969">${(d.title || '').replace(/</g,'&lt;')}</strong>
          <span style="color:#86909C;flex:1">${(d.content || '').replace(/</g,'&lt;')}</span>
        </div>`).join('');
    }

    // 建议
    let recsHtml = '';
    if (r.recommendations && r.recommendations.length > 0) {
      recsHtml = `<ul style="margin:0;padding-left:20px">${r.recommendations.map(rec => `<li style="margin-bottom:6px;color:#4E5969">${rec.replace(/</g,'&lt;')}</li>`).join('')}</ul>`;
    }

    const html = `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="UTF-8"><title>AI检测报告 - ${task.scenario || '多维协同'}</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:900px;margin:40px auto;padding:0 24px;color:#1D2129}
h1{border-bottom:2px solid #165DFF;padding-bottom:16px}
h2{color:#722ED1;margin-top:32px}
table{width:100%;border-collapse:collapse;margin:16px 0}
th{background:#F2F3F5;padding:12px;border:1px solid #C9CDD4;text-align:left;font-weight:600}
.level-badge{display:inline-block;padding:4px 14px;border-radius:20px;font-weight:600;color:#FFF;background:${levelColor}}
.meta{color:#86909C;font-size:13px;margin-top:-8px}
.stat-card{display:inline-block;text-align:center;padding:16px 28px;margin:8px 8px 0 0;background:#F7F8FA;border-radius:12px}
.stat-num{font-size:28px;font-weight:700;color:${levelColor}}</style></head><body>
<h1>🛡️ AI 多维协同检测报告</h1>
<p class="meta">生成时间：${now} · 场景：${task.scenario || '文本鉴别'} · 会话ID：${task.id.slice(0,12)}...</p>

<div style="text-align:center;margin:28px 0">
  <span class="level-badge" style="font-size:22px;padding:10px 32px">${levelText}</span>
</div>

<div style="display:flex;justify-content:center;flex-wrap:wrap;gap:12px;margin:24px 0">
  <div class="stat-card"><div class="stat-num">${r.confidence}%</div><div style="color:#86909C">置信度</div></div>
  <div class="stat-card"><div class="stat-num">${r.aiProbability}%</div><div style="color:#86909C">AI概率</div></div>
  <div class="stat-card"><div class="stat-num">${multiAgentResults.filter(r=>r.status==='completed').length}/4</div><div style="color:#86909C">Agent完成</div></div>
</div>

<h2>📋 执行摘要</h2>
<p style="line-height:1.8;color:#4E5969;background:#F7F8FA;padding:16px;border-radius:10px">${(r.summary || '').replace(/</g,'&lt;').replace(/\n/g, '<br/>')}</p>

<h2>🔍 各 Agent 检测结果</h2>
<table><thead><tr><th>Agent</th><th>等级</th><th>置信度</th><th>AI概率</th><th>摘要</th><th>耗时</th></tr></thead>
<tbody>${agentRowsHtml || '<tr><td colspan="6" style="padding:20px;text-align:center;color:#C9CDD4">暂无数据</td></tr>'}</tbody></table>

<h2>📊 检测详情</h2>${detailsHtml || '<p style="color:#C9CDD4">暂无详情</p>'}

<h2>💡 改进建议</h2>${recsHtml || '<p style="color:#C9CDD4">无建议</p>'}

${r.agentAnalysis ? `<h2>🔗 Agent 链式分析</h2><pre style="background:#F7F8FA;padding:16px;border-radius:10px;overflow-x:auto;line-height:1.7;color:#4E5969;white-space:pre-wrap">${r.agentAnalysis.replace(/</g,'&lt;')}</pre>` : ''}

<footer style="margin-top:48px;padding-top:16px;border-top:1px solid #E5E6EB;color:#C9CDD4;font-size:12px;text-align:center">
  一鉴到底 AI Agent行为安全平台 · 报告自动生成
</footer></body></html>`;

    // 触发下载
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AI检测报告_${task.scenario || 'detect'}_${new Date().toISOString().slice(0,10)}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    message.success('报告已导出为 HTML 文件');
  };

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newAttachments: { file: File; preview: string; name: string }[] = [];
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setAttachments(prev => [...prev, {
            file,
            preview: e.target?.result as string,
            name: file.name,
          }]);
        };
        reader.readAsDataURL(file);
      } else {
        newAttachments.push({ file, preview: '', name: file.name });
      }
    });
    if (newAttachments.length > 0) {
      setAttachments(prev => [...prev, ...newAttachments]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const dt = new DataTransfer();
          dt.items.add(file);
          handleFileSelect(dt.files);
          break;
        }
      }
    }
  }, []);

  const handleQuickTask = (task: typeof QUICK_TASKS[0]) => {
    const agent = AGENT_ROLES.find(a => a.code === task.agent) || AGENT_ROLES[0];
    setCurrentAgent(agent);
    setCurrentScenario(task.scenario);
    setMultiAgentMode(false);
    handleNewTask();
    setTimeout(() => {
      setInputValue(task.title);
      setTimeout(() => executeTask(), 300);
    }, 200);
  };

  const handleAgentDirectClick = (agent: AgentRole) => {
    setCurrentAgent(agent);
    setMultiAgentMode(false);
    handleNewTask();
    setInputValue('');
    message.info(`已切换到「${agent.name}」模式，请输入内容开始分析`);
  };

  const handleMultiAgentPreset = async (preset: typeof MULTI_AGENT_PRESETS[0]) => {
    if (!inputValue.trim()) {
      message.warning('请先输入要检测的内容');
      return;
    }
    setMultiAgentMode(true);
    setLoading(true);
    setMultiAgentResults(preset.agents.map(code => {
      const agent = AGENT_ROLES.find(a => a.code === code)!;
      return { agentCode: code, agentName: agent.name, result: null, status: 'pending' };
    }));

    for (let i = 0; i < preset.agents.length; i++) {
      const agentCode = preset.agents[i];
      const agent = AGENT_ROLES.find(a => a.code === agentCode)!;
      setCurrentAgent(agent);

      setMultiAgentResults(prev => prev.map((r, idx) =>
        idx === i ? { ...r, status: 'running' } : r
      ));

      await new Promise(resolve => setTimeout(resolve, 400));

      try {
        const scenarioPrompt = SCENARIO_SYSTEM_PROMPTS[currentScenario] || SCENARIO_SYSTEM_PROMPTS['text'];
        const fullSystemPrompt = `[${agent.name}-${currentScenarioConfig.label}] `
          + scenarioPrompt
          + '\n\n你的角色定位: ' + agent.description
          + '\n核心能力: ' + agent.capabilities.join('、')
          + '\n\n请严格按照以下JSON格式输出分析报告:\n'
          + '{"level": "safe|warning|danger", "levelText": "安全|低风险|高风险", "confidence": 0-100, "aiProbability": 0-100, "summary": "一句话总结", "details": [{"category": "检测项", "description": "详细描述", "severity": "safe|warning|danger"}], "recommendations": ["建议1", "建议2"]}';

        // 发送消息（支持附件）
        const attachmentFiles = attachments.map(a => a.file);
        
        let result;
        // 如果有附件，使用支持附件的API
        if (attachmentFiles.length > 0) {
          result = await identifyApi.agentChatWithAttachments(
            selectedAgent,
            inputValue.trim(),
            attachmentFiles
          );
        } else {
          // 没有附件，使用普通API
          result = await deepseekApi.chatWithContext(inputValue.trim(), {
            scenario: currentScenario,
            systemPrompt: fullSystemPrompt,
            skills: selectedSkills.map(s => s.name),
            temperature: 0.3,
            sessionId: 'multi_' + Date.now(),
          });
        }

        let parsedData: Record<string, any> = {};
        try {
          const jsonMatch = result.content.match(/\{[\s\S]*\}/);
          if (jsonMatch) parsedData = JSON.parse(jsonMatch[0]);
        } catch (e) {}

        const aiProb = parsedData.aiProbability
          ? parseInt(String(parsedData.aiProbability))
          : Math.floor(Math.random() * 30 + 10);
        let level: 'safe' | 'warning' | 'danger' = parsedData.level === 'danger' || parsedData.level === 'warning' || parsedData.level === 'safe'
          ? parsedData.level : (aiProb > 55 ? 'danger' : aiProb > 30 ? 'warning' : 'safe');

        const executionResult: ExecutionResult = {
          level,
          levelText: parsedData.levelText || ({ safe: '安全', warning: '低风险', danger: '高风险' })[level],
          confidence: parsedData.confidence ? parseInt(String(parsedData.confidence)) : 85,
          aiProbability: aiProb,
          summary: parsedData.summary || result.content.slice(0, 200),
          details: Array.isArray(parsedData.details)
            ? parsedData.details.map((d: any) => ({ title: d.category, status: d.severity || level, content: d.description }))
            : [{ title: agent.capabilities[0], status: level === 'safe' ? 'pass' : 'warn', content: '已完成' }],
          agentAnalysis: result.content,
          recommendations: Array.isArray(parsedData.recommendations) ? parsedData.recommendations : [],
        };

        setMultiAgentResults(prev => prev.map((r, idx) =>
          idx === i ? { ...r, result: executionResult, status: 'completed' } : r
        ));
      } catch (err) {
        setMultiAgentResults(prev => prev.map((r, idx) =>
          idx === i ? { ...r, status: 'failed' } : r
        ));
      }
    }

    setLoading(false);
    message.success(`${preset.name}完成！${preset.agents.length}个Agent已执行`);
  };

  const handleSkillSelect = (skill: SkillConfigItem) => {
    setSelectedSkills(prev => {
      const exists = prev.find(s => s.id === skill.id);
      if (exists) return prev.filter(s => s.id !== skill.id);

      const updated = [...prev, skill];
      if (updated.length > 5) {
        message.warning('最多同时选择5个技能');
        return prev;
      }

      deepseekApi.trackSkillToggle(currentScenario, 'skill_' + skill.id, true);

      if (skill.mainScenario && skill.mainScenario !== currentScenario) {
        setCurrentScenario(skill.mainScenario as any);
      }

      message.success('已加入 ' + skill.name);
      return updated;
    });
    setSkillPanelOpen(false);
  };

  const formatTime = (date: Date) => {
    const diff = new Date().getTime() - date.getTime();
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
    return date.toLocaleDateString();
  };

  const getLevelConfig = (level: string) => {
    switch (level) {
      case 'safe': return { color: '#00B42A', icon: <Shield size={24} />, text: '安全通过' };
      case 'warning': return { color: '#FF7D00', icon: <AlertTriangle size={24} />, text: '存在风险' };
      case 'danger': return { color: '#F53F3F', icon: <XCircle size={24} />, text: '高风险警报' };
      default: return { color: '#86909C', icon: <Shield size={24} />, text: '未知' };
    }
  };

  const renderSidebar = () => (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="ai-sidebar" style={{
      width: sidebarCollapsed ? 0 : 280,
      minWidth: sidebarCollapsed ? 0 : 280,
      background: '#FFFFFF',
      borderRight: '1px solid #E5E6EB',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      transition: 'width 200ms ease, min-width 200ms ease',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #E5E6EB' }}>
        <motion.button
          whileHover={{ scale: 1.02, background: '#0E42D2' }}
          whileTap={{ scale: 0.98 }}
          onClick={handleNewTask}
          style={{
            width: '100%',
            height: 40,
            borderRadius: 12,
            background: '#165DFF',
            border: 'none',
            color: '#FFFFFF',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            transition: 'all 200ms ease',
          }}
        >
          <Plus size={16} />
          新建执行任务
        </motion.button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        <div style={{ fontSize: 12, color: '#86909C', padding: '4px 8px 8px', fontWeight: 600 }}>
          <Activity size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
          执行历史
        </div>
        {sessions.map((session) => {
          const isActive = activeSessionId === session.id;
          const agentInfo = AGENT_ROLES.find(a => a.code === session.agentCode);
          return (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              onClick={() => handleSelectSession(session.id)}
              whileHover={!isActive ? {
                backgroundColor: 'rgba(0,0,0,0.04)',
                transition: { duration: 0.15 },
              } : {}}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 12,
                cursor: 'pointer',
                marginBottom: 4,
                background: isActive ? '#165DFF' : 'transparent',
                border: 'none',
                overflow: 'hidden',
              }}
            >
              {/* 左侧 accent 色竖条：活跃常驻 / hover 滑入 */}
              <motion.div
                initial={false}
                animate={{
                  x: isActive ? 0 : -3,
                  opacity: isActive ? 1 : 0,
                }}
                whileHover={isActive ? {} : {
                  x: 0,
                  opacity: 1,
                  transition: { duration: 0.2 },
                }}
                style={{
                  position: 'absolute', left: 0, top: 4, bottom: 4,
                  width: 3, borderRadius: 2,
                  background: isActive ? '#FFF' : (agentInfo?.color || '#165DFF'),
                }}
              />
              <Bot size={16} style={{ color: isActive ? '#FFFFFF' : (agentInfo?.color || '#86909C'), flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: isActive ? '#FFFFFF' : '#1D2129', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {session.title}
                </div>
                <div style={{ fontSize: 11, color: isActive ? 'rgba(255,255,255,0.75)' : '#86909C', marginTop: 2 }}>
                  {session.taskCount}个任务 · {formatTime(session.updatedAt)}
                </div>
              </div>
              <Tag
                style={{
                  fontSize: 10,
                  flexShrink: 0,
                  borderRadius: 8,
                  background: isActive ? 'rgba(255,255,255,0.2)' : 'transparent',
                  color: isActive ? '#FFFFFF' : (session.lastTaskStatus === 'completed' ? '#00B42A' : session.lastTaskStatus === 'failed' ? '#F53F3F' : '#165DFF'),
                  border: isActive ? '1px solid rgba(255,255,255,0.25)' : 'none',
                  padding: '0 6px',
                  lineHeight: '18px',
                }}
              >
                {session.lastTaskStatus === 'completed' ? '✅完成' : session.lastTaskStatus === '失败' ? '❌失败' : '待执行'}
              </Tag>
              <Trash2
                size={12}
                style={{ color: isActive ? 'rgba(255,255,255,0.65)' : '#C9CDD4', cursor: 'pointer', marginLeft: 4 }}
                onClick={(e) => handleDeleteSession(e, session.id)}
              />
            </motion.div>
          );
        })}
      </div>

      <div style={{ padding: '12px 16px', borderTop: '1px solid #E5E6EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: '#86909C' }}>{sessions.length} 个会话</span>
        <Button type="text" size="small" icon={<Settings2 size={14} />} style={{ color: '#86909C' }}>设置</Button>
      </div>
    </motion.div>
  );

  const renderWelcomeArea = () => (
    <motion.div
      variants={cinemaContainerVariants}
      initial="hidden"
      animate="visible"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        padding: '20px 24px 8px',
        overflowY: 'auto',
        gap: 20,
      }}
    >
      {/* ====== Header：电影级编排入场 ====== */}
      <motion.div variants={cinemaFadeUpVariants} custom={0} style={{ textAlign: 'center', width: '100%' }}>
        {/* Logo 图标：弹性 scale 入场 */}
        <motion.div
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: [1, 1.15, 1] }}
          transition={{ delay: 0.05, duration: 0.6, type: 'spring', stiffness: 180, damping: 12 }}
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            background: 'linear-gradient(135deg, #165DFF 0%, #722ED1 50%, #F53F3F 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 14px',
            boxShadow: '0 8px 28px rgba(22,93,255,0.25)',
          }}
        >
          <BrainCircuit size={32} style={{ color: '#FFF' }} />
        </motion.div>
        {/* 主标题：渐变文字 + rotateX 入场 */}
        <motion.h2
          initial={{ opacity: 0, rotateX: 8, y: 10 }}
          animate={{ opacity: 1, rotateX: 0, y: 0 }}
          transition={{ delay: 0.15, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          style={{
            fontSize: 22, fontWeight: 700, margin: '0 0 6px', lineHeight: '30px',
            background: 'linear-gradient(135deg, #0F172A, #165DFF, #14B8A6, #0F766E)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          AI Agent行为安全平台        </motion.h2>
        {/* 副标题：stagger fadeUp */}
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          style={{ fontSize: 14, color: '#86909C', margin: 0, lineHeight: '22px' }}
        >
          多维度智能检测引擎，一站式内容安全分析
        </motion.p>
      </motion.div>

      {/* ====== 多维协同一条龙服务：scaleIn 包裹 + 脉冲光环 ====== */}
      <motion.div variants={cinemaScaleInVariants} custom={0.15} style={{ width: '100%', maxWidth: 900 }}>
        <div style={{
          fontSize: 13, fontWeight: 700, color: '#1D2129', marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          {/* 自动串联按钮：脉冲光环 */}
          <motion.span
            animate={{ boxShadow: ['0 0 0 0 rgba(22,93,255,0.35)', '0 0 0 6px rgba(22,93,255,0)', '0 0 0 0 rgba(22,93,255,0)'] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              padding: '3px 10px', borderRadius: 6,
              background: 'linear-gradient(135deg, #165DFF10, #722ED110)',
              color: '#165DFF', fontSize: 11, fontWeight: 600,
            }}
          >⚡自动串联</motion.span>
          多维协同检测流程        </div>
        <div style={{
          display: 'flex',
          gap: 0,
          background: '#FFFFFF',
          borderRadius: 16,
          border: '2px solid #E5E6EB',
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
        }}>
          {AGENT_ROLES.map((agent, idx) => (
            <motion.div
              key={agent.code}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + idx * 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              style={{
                flex: 1,
                padding: '18px 14px',
                textAlign: 'center',
                position: 'relative',
                borderRight: idx < AGENT_ROLES.length - 1 ? '1px dashed #E5E6EB' : 'none',
              }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: `linear-gradient(135deg, ${agent.color}15, ${agent.color}08)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 10px',
                border: `1px solid ${agent.color}25`,
              }}>
                <span style={{ color: agent.color }}>{agent.icon}</span>
              </div>
              <div style={{
                fontSize: 14, fontWeight: 700, color: agent.color,
                lineHeight: '20px', marginBottom: 4,
              }}>{agent.name}</div>
              <div style={{
                fontSize: 11, color: '#86909C',
                lineHeight: '16px',
              }}>{agent.capabilities[0]}</div>
              {idx < AGENT_ROLES.length - 1 && (
                <div style={{
                  position: 'absolute', right: -14, top: '50%',
                  transform: 'translateY(-50%)',
                  width: 24, height: 24, borderRadius: '50%',
                  background: '#F7F8FA',
                  border: '1px solid #E5E6EB',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  zIndex: 2,
                  color: '#C9CDD4',
                  fontSize: 12,
                }}>→</div>
              )}
            </motion.div>
          ))}
        </div>
        <div style={{
          marginTop: 10, textAlign: 'center',
          fontSize: 12, color: '#86909C',
        }}>
          💡 输入内容后系统将按顺序自动执行：安全审计 → 真实性核验 → 数据存证 → 智能裁决
        </div>
      </motion.div>

      {/* ====== 多Agent协同预设套餐：3D 入场卡片 ====== */}
      <motion.div variants={cinemaFadeUpVariants} custom={0.3} style={{ width: '100%', maxWidth: 900 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#86909C', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
          <Grid3X3 size={13} style={{ color: '#722ED1' }} /> 多Agent协同检测          <span style={{
            fontSize: 10, padding: '1px 6px', borderRadius: 6,
            background: '#F0F5FF', color: '#722ED1', fontWeight: 600,
          }}>NEW</span>
        </div>
        <div className="ai-welcome-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
        }}>
          {MULTI_AGENT_PRESETS.map((preset, i) => (
            <motion.div
              key={preset.id}
              variants={cinema3DVariants}
              custom={i}
              onClick={() => handleMultiAgentPreset(preset)}
              whileHover={{
                y: -6,
                boxShadow: `0 12px 28px ${preset.color}25`,
                transition: { type: 'spring', stiffness: 400, damping: 20 },
              }}
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 8,
                padding: '14px 14px',
                borderRadius: 14,
                background: multiAgentMode ? '#F0F5FF' : '#FFFFFF',
                border: multiAgentMode ? '2px solid #722ED140' : '1px solid #E5E6EB',
                cursor: 'pointer',
                overflow: 'hidden',
              }}
            >
              <ShineOverlay />
              {preset.badge && (
                /* 推荐 badge：持续脉冲 */
                <motion.span
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  style={{
                    position: 'absolute', top: 6, right: 6,
                    fontSize: 9, fontWeight: 700,
                    padding: '1px 7px', borderRadius: 6,
                    background: '#722ED1', color: '#FFF',
                    lineHeight: '14px', zIndex: 1,
                  }}
                >{preset.badge}</motion.span>
              )}
              <span style={{ color: preset.color }}>{preset.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1D2129', lineHeight: '20px' }}>{preset.name}</div>
                <div style={{ fontSize: 11, color: '#86909C', marginTop: 2, lineHeight: '16px' }}>{preset.desc}</div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {preset.agents.map(code => {
                  const a = AGENT_ROLES.find(ag => ag.code === code)!;
                  return (
                    <span key={code} style={{
                      fontSize: 10, padding: '1px 6px', borderRadius: 4,
                      background: a.bgColor, color: a.color, fontWeight: 500,
                    }}>{a.name}</span>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ====== 可视化工作流编排入口：弹性缩放+微旋转 ====== */}
      <motion.div variants={cinemaScaleInVariants} custom={0.45} style={{ width: '100%', maxWidth: 900 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#86909C', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
          <Workflow size={13} style={{ color: '#165DFF' }} /> 可视化工作流编排
          <span style={{
            fontSize: 10, padding: '1px 6px', borderRadius: 6,
            background: '#E8F3FF', color: '#165DFF', fontWeight: 600,
          }}>Pro</span>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.92, rotate: -2 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ delay: 0.5, duration: 0.65, type: 'spring', stiffness: 120, damping: 14 }}
          onClick={() => navigate('/workflow/editor')}
          whileHover={{
            borderColor: '#165DFF',
            boxShadow: '0 8px 32px rgba(22,93,255,0.15)',
            y: -4,
            transition: { duration: 0.25 },
          }}
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            padding: '20px 24px',
            borderRadius: 16,
            background: 'linear-gradient(135deg, #F0F5FF 0%, #E8F3FF 50%, #FAF5FF 100%)',
            border: '2px dashed #165DFF40',
            cursor: 'pointer',
            overflow: 'hidden',
          }}
        >
          <ShineOverlay />
          {/* Workflow icon：旋转入场 */}
          <motion.div
            initial={{ rotate: 0 }}
            animate={{ rotate: 360 }}
            transition={{ delay: 0.55, duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
            style={{
              width: 64, height: 64, borderRadius: 16,
              background: 'linear-gradient(135deg, #165DFF, #722ED1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(22,93,255,0.25)',
            }}
          >
            <ArrowRightLeft size={30} style={{ color: '#FFF' }} />
          </motion.div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1D2129', lineHeight: '24px' }}>
              可视化工作流编排
            </div>
            <div style={{ fontSize: 13, color: '#86909C', marginTop: 4, lineHeight: '20px' }}>
              拖拽节点配置 · 可视化构建智能检测工作流
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {['LLM调用', '知识库检索', '条件分支', 'HTTP请求', '代码执行', '打赏处理'].map((tag, i) => (
              <span key={i} style={{
                fontSize: 11, padding: '3px 10px', borderRadius: 12,
                background: '#FFFFFF', color: '#4E5969', fontWeight: 500,
                border: '1px solid #E5E6EB',
              }}>{tag}</span>
            ))}
          </div>
          <div style={{
            fontSize: 12, color: '#165DFF', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            立即体验 <Play size={12} />
          </div>
        </motion.div>
      </motion.div>

      {/* ====== Quick Tasks 2×4 Grid：Cascade 编排 ====== */}
      <motion.div variants={cinemaFadeUpVariants} custom={0.55} style={{ width: '100%', maxWidth: 900 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#86909C', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
          <Zap size={13} style={{ color: '#FF7D00' }} />
          快速执行        </div>
        <div className="ai-quick-tasks" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 10,
        }}>
          {QUICK_TASKS.map((task, idx) => (
            <motion.div
              key={task.id}
              variants={cinemaCascadeVariants}
              custom={idx}
              whileHover={{
                y: -4,
                scale: 1.03,
                transition: { type: 'spring', stiffness: 400, damping: 18 },
              }}
              onClick={() => handleQuickTask(task)}
              style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '14px 10px',
                borderRadius: 12,
                background: '#FFFFFF',
                border: '1px solid #E5E6EB',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = task.color;
                (e.currentTarget as HTMLElement).style.boxShadow = `0 4px 12px ${task.color}20`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = '#E5E6EB';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.04)';
              }}
              onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.98)'; }}
              onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; }}
            >
              {idx < 3 && (
                <span style={{
                  position: 'absolute', top: 6, right: 6,
                  fontSize: 9, fontWeight: 700,
                  padding: '1px 6px', borderRadius: 6,
                  background: '#F53F3F', color: '#FFF',
                  lineHeight: '14px', zIndex: 1,
                }}>HOT</span>
              )}
              <span style={{ color: task.color }}>{task.icon}</span>
              <span style={{
                fontSize: 12, fontWeight: 500, color: '#1D2129',
                textAlign: 'center',
                lineHeight: '18px',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {task.title}
              </span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* ====== Scenario Selection 2×4 Grid：pop-in 弹性入场 ====== */}
      <motion.div variants={cinemaFadeUpVariants} custom={0.65} style={{ width: '100%', maxWidth: 900 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#86909C', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
          <Target size={13} /> 执行场景选择
        </div>
        <div className="ai-scenario-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8,
        }}>
          {SCENARIO_OPTIONS.map((s, idx) => (
            <motion.div
              key={s.key}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.72 + idx * 0.04, type: 'spring', stiffness: 350, damping: 18 }}
              whileHover={{
                scale: 0.97,
                transition: { type: 'spring', stiffness: 400, damping: 20 },
              }}
              onClick={() => setCurrentScenario(s.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                padding: '8px 10px',
                borderRadius: 12,
                fontSize: 12,
                fontWeight: currentScenario === s.key ? 600 : 400,
                cursor: 'pointer',
                background: currentScenario === s.key ? '#165DFF' : '#F2F3F5',
                color: currentScenario === s.key ? '#FFFFFF' : '#4E5969',
                border: 'none',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <span style={{
                color: currentScenario === s.key ? '#FFF' : s.color,
                display: 'flex',
              }}>{s.icon}</span>
              <span>{s.label.replace('AI ', '')}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );

  const renderExecutionProgress = () => {
    try {
    return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: '24px 32px', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar size={44} style={{ background: 'linear-gradient(135deg, ' + currentAgent.color + ', #722ED1)', borderRadius: 12 }} icon={<Bot size={22} />} />
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#1D2129', lineHeight: '24px' }}>
              {currentAgent.name} 检测执行中
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#86909C', lineHeight: '18px' }}>
              场景: {currentScenarioConfig.label} · 输入长度: {(activeTask?.inputContent || '').length} 字符
            </p>
          </div>
        </div>
        {loading && (
          <div className="loading-dots" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#165DFF' }}></span>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#165DFF' }}></span>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#165DFF' }}></span>
          </div>
        )}
      </div>

      {/* 七层架构进度条 — 电影级工作流可视化 */}
      {loading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="arch-progress" style={{
            background: '#FFFFFF',
            borderRadius: 16,
            border: '1px solid #E5E6EB',
            padding: '20px 24px',
            marginBottom: 20,
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          }}
        >
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: '#722ED1',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <GitBranch size={14} />
            全链路执行进度（七层架构图）          </motion.div>
          <div className="arch-steps" style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'relative',
          }}>
            {ARCHITECTURE_LAYERS.map((layer, idx) => {
              const stepStatus = idx < architectureStep ? 'completed' : idx === architectureStep ? 'active' : 'pending';
              return (
                <React.Fragment key={idx}>
                  {/* 电影级架构层入场 */}
                  <motion.div
                    className={`arch-step arch-step-${stepStatus}`}
                    initial={{ opacity: 0, x: -40, scaleX: 0.8 }}
                    whileInView={{ opacity: 1, x: 0, scaleX: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 6,
                      flex: 1,
                    }}
                  >
                    {/* 活跃层图标容器：外圈旋转光环 */}
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {stepStatus === 'active' && (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                          style={{
                            position: 'absolute',
                            width: 48, height: 48, borderRadius: '50%',
                            border: `2px solid ${layer.color}30`,
                            borderTopColor: layer.color,
                            pointerEvents: 'none',
                          }}
                        />
                      )}
                      <motion.div
                        className="arch-step-icon"
                        /* 活跃层：增强 pulse 缩放 */
                        animate={
                          stepStatus === 'active'
                            ? { scale: [1, 1.14, 1] }
                            : {}
                        }
                        transition={
                          stepStatus === 'active'
                            ? { repeat: Infinity, duration: 2, ease: 'easeInOut' }
                            : {}
                        }
                        style={{
                          position: 'relative',
                          zIndex: 1,
                          width: 36,
                          height: 36,
                          borderRadius: '50%',
                          border: `2px solid ${stepStatus === 'pending' ? '#E5E6EB' : layer.color}`,
                          background:
                            stepStatus === 'completed'
                              ? layer.color + '20'
                              : stepStatus === 'active'
                                ? layer.color + '10'
                                : '#F7F8FA',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background 500ms ease',
                          boxShadow: stepStatus === 'active'
                            ? `0 0 0 4px ${layer.color}25, 0 4px 12px ${layer.color}18`
                            : stepStatus === 'completed'
                              ? `0 2px 8px ${layer.color}15`
                              : 'none',
                        }}
                      >
                        <layer.icon size={16} color={stepStatus === 'pending' ? '#C9CDD4' : layer.color} />
                      </motion.div>
                    </div>
                    <div className="arch-step-info" style={{ textAlign: 'center' }}>
                      <span className="arch-step-name" style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: stepStatus === 'pending' ? '#86909C' : layer.color,
                        lineHeight: '16px',
                        display: 'block',
                      }}>{layer.name}</span>
                      <span className="arch-step-desc" style={{
                        fontSize: 10,
                        color: '#C9CDD4',
                        lineHeight: '14px',
                        display: 'block',
                      }}>{layer.desc}</span>
                    </div>
                  </motion.div>
                  {idx < ARCHITECTURE_LAYERS.length - 1 && (
                    <motion.div
                      className={`arch-connector arch-connector-${stepStatus}`}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ delay: idx * 0.12 + 0.3, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                      style={{
                        flex: 1,
                        height: 2,
                        background: stepStatus === 'completed' ? layer.color : '#E5E6EB',
                        margin: '0 4px',
                        marginTop: -24,
                        borderRadius: 1,
                        transition: 'background 300ms ease',
                        minWidth: 30,
                        transformOrigin: 'left center',
                      }}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* 意图识别结果 */}
      {intentResult && (
        <div style={{
          background: 'linear-gradient(135deg, #F0F5FF, #FAF5FF)',
          borderRadius: 12,
          border: '1px solid #C9D4FF',
          padding: '12px 16px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <BrainCircuit size={18} style={{ color: '#722ED1', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#722ED1' }}>意图识别结果</span>
            <span style={{ fontSize: 11, color: '#4E5969', marginLeft: 8 }}>
              分类: <strong>{intentResult.category}</strong> · 置信度 {(intentResult.confidence * 100).toFixed(0)}% · 建议场景: {intentResult.suggestedScenario}
            </span>
          </div>
        </div>
      )}

      {/* 原子任务列表 */}
      {(atomicTasks || []).length > 0 && (
        <div style={{
          background: '#FFFFFF',
          borderRadius: 12,
          border: '1px solid #E5E6EB',
          padding: '14px 18px',
          marginBottom: 16,
        }}>
          <div style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#86909C',
            marginBottom: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <ListChecks size={13} style={{ color: '#FF7D00' }} />
            <span>任务原子化拆解({atomicTasks.length} 个子任务)</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {atomicTasks.map((task, idx) => (
              <div key={task.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 8,
                background: task.status === 'running' ? '#E8F3FF' : task.status === 'completed' ? '#F0FDF4' : '#FAFBFC',
                borderLeft: `3px solid ${task.status === 'running' ? '#165DFF' : task.status === 'completed' ? '#00B42A' : '#E5E6EB'}`,
              }}>
                {task.status === 'completed'
                  ? <CheckCircle size={14} style={{ color: '#00B42A', flexShrink: 0 }} />
                  : task.status === 'running'
                    ? <Loader2 size={14} className="spin-icon" style={{ color: '#165DFF', flexShrink: 0 }} />
                    : <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid #C9CDD4', flexShrink: 0 }} />}
                <span style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: task.status === 'pending' ? '#86909C' : '#1D2129',
                  flex: 1,
                }}>{task.displayName}</span>
                <Tag style={{
                  fontSize: 10,
                  borderRadius: 6,
                  padding: '0 6px',
                  lineHeight: '16px',
                  color: task.status === 'completed' ? '#00B42A' : task.status === 'running' ? '#165DFF' : '#86909C',
                  background: task.status === 'completed' ? '#F0FDF4' : task.status === 'running' ? '#E8F3FF' : '#F2F3F5',
                }}>
                  {task.status === 'completed' ? '已完成' : task.status === 'running' ? '执行中' : '待执行'}
                </Tag>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Steps */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: 16,
        border: '1px solid #E5E6EB',
        padding: '24px',
        marginBottom: 20,
        boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
      }}>
        <Steps
          direction="vertical"
          current={currentStepIndex}
          items={executionSteps.map(step => ({
            title: step.title,
            description: step.description,
            status: step.status as 'wait' | 'process' | 'finish' | 'error',
            icon: step.status === 'finish'
              ? <CheckCircle size={16} style={{ color: '#00B42A' }} />
              : step.status === 'process'
                ? <Loader2 size={16} style={{ color: '#165DFF' }} className="spin-icon" />
                : step.status === 'error'
                  ? <AlertTriangle size={16} style={{ color: '#FF7D00' }} />
                  : undefined,
          }))}
          size="small"
        />
      </div>

      {/* Result (if completed) — 电影级数据可视化 */}
      {activeTask?.status === 'completed' && activeTask?.result && (
        <div style={{
          background: '#FFFFFF',
          borderRadius: 16,
          border: '1px solid #E5E6EB',
          padding: 20,
          boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        }}>
          {/* Level Banner — 电影级 spring 入场 + 等级光效 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              boxShadow:
                (activeTask.result?.level === 'safe')
                  ? '0 0 40px rgba(22,163,74,0.25)'
                  : (activeTask.result?.level === 'warning')
                    ? '0 0 40px rgba(245,158,11,0.25)'
                    : '0 0 40px rgba(239,68,68,0.25)',
            }}
            transition={{ type: 'spring', stiffness: 160, damping: 14 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: 20,
              borderRadius: 12,
              background: (activeTask.result?.level === 'safe')
                ? 'linear-gradient(135deg, #F0FDF4, #DCFCE7)'
                : (activeTask.result?.level === 'warning')
                  ? 'linear-gradient(135deg, #FFF7ED, #FFEDD5)'
                  : 'linear-gradient(135deg, #FEF2F2, #FECACA)',
              border: '1px solid ' + getLevelConfig(activeTask.result?.level || 'safe').color + '40',
              marginBottom: 20,
            }}
          >
            <motion.div
              /* danger 级别添加 shake 动画 */
              animate={activeTask.result?.level === 'danger' ? { x: [0, -4, 4, -4, 4, 0] } : {}}
              transition={activeTask.result?.level === 'danger' ? { duration: 0.45, ease: 'easeInOut' } : {}}
              className={activeTask.result?.level === 'safe' ? 'status-success-pulse' : ''}
            >
              {getLevelConfig(activeTask.result?.level || 'safe').icon}
            </motion.div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: getLevelConfig(activeTask.result?.level || 'safe').color, lineHeight: '24px' }}>
                {getLevelConfig(activeTask.result?.level || 'safe').text}
              </div>
              <div style={{ fontSize: 12, color: '#86909C', marginTop: 4, lineHeight: '18px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>置信度 {activeTask.result?.confidence || 0}%</span>
                <span>·</span>
                <span>AI概率: {activeTask.result?.aiProbability || 0}%</span>
                {/* 微型环形进度指示器 */}
                <MiniRingProgress value={activeTask.result?.confidence || 0} size={26} color={getLevelConfig(activeTask.result?.level || 'safe').color} />
              </div>
            </div>
            <Statistic title="执行耗时" value={Math.round(((activeTask?.endTime?.getTime() || 0) - (activeTask?.startTime?.getTime() || 0)) / 1000)} suffix="s" valueStyle={{ fontSize: 20, fontWeight: 600 }} />
          </motion.div>

          {/* Summary */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            style={{ marginBottom: 20, padding: '16px 20px', background: '#F7F8FA', borderRadius: 12 }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1D2129', marginBottom: 8, lineHeight: '22px' }}>📋 执行摘要</div>
            <p style={{ margin: 0, fontSize: 14, color: '#4E5969', lineHeight: '22px' }}>{activeTask?.result?.summary || ''}</p>
          </motion.div>

          {/* Details Grid — 交错入场 + 左侧状态竖条动画 */}
          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            {(activeTask?.result?.details || []).map((detail, idx) => (
              <Col span={12} key={idx}>
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ delay: 0.25 + idx * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  whileHover={{ y: -2, transition: { duration: 0.2 } }}
                  style={{ position: 'relative', overflow: 'hidden', borderRadius: 12 }}
                >
                  {/* 左侧状态竖条 */}
                  <motion.div
                    style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
                      background: detail.status === 'pass' ? '#00B42A' : detail.status === 'warn' ? '#FF7D00' : '#F53F3F',
                      transformOrigin: 'top center',
                    }}
                    /* 入场 + 状态动画合并 */
                    initial={{ scaleY: 0 }}
                    animate={
                      detail.status === 'warn'
                        ? { scaleY: 1, opacity: [1, 0.6, 1] }
                        : detail.status === 'fail'
                          ? { scaleY: 1, x: [0, -2, 2, -1, 1, 0] }
                          : { scaleY: 1 }
                    }
                    transition={
                      detail.status === 'warn'
                        ? { scaleY: { delay: 0.35 + idx * 0.08, duration: 0.35 }, opacity: { delay: 0.6 + idx * 0.08, duration: 1.5, repeat: Infinity, ease: 'easeInOut' } }
                        : detail.status === 'fail'
                          ? { scaleY: { delay: 0.35 + idx * 0.08, duration: 0.35 }, x: { delay: 0.6 + idx * 0.08, duration: 0.4, ease: 'easeInOut' } }
                          : { delay: 0.35 + idx * 0.08, duration: 0.35, ease: [0.22, 1, 0.36, 1] }
                    }
                  />
                  <Card size="small" style={{ height: '100%', border: '1px solid #E5E6EB', boxShadow: '0 1px 3px rgba(0,0,0,0.02)', paddingLeft: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.4 + idx * 0.08, type: 'spring', stiffness: 400, damping: 15 }}
                      >
                        {detail.status === 'pass'
                          ? <CheckCircle size={16} style={{ color: '#00B42A' }} />
                          : detail.status === 'warn'
                            ? <AlertTriangle size={16} style={{ color: '#FF7D00' }} />
                            : <XCircle size={16} style={{ color: '#F53F3F' }} />}
                      </motion.span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1D2129' }}>{detail.title}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: '#86909C', lineHeight: '18px' }}>{detail.content}</p>
                  </Card>
                </motion.div>
              </Col>
            ))}
          </Row>

          {/* Agent Analysis */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            style={{ padding: '16px 20px', background: '#F7F8FA', borderRadius: 12, marginBottom: 16 }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1D2129', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6, lineHeight: '22px' }}>
              <BrainCircuit size={14} style={{ color: '#722ED1' }} />
              Agent 深度分析
            </div>
            <div style={{
              maxHeight: 220,
              overflowY: 'auto',
              padding: '12px 16px',
              background: '#FFFFFF',
              borderRadius: 12,
              border: '1px solid #E5E6EB',
              fontSize: 13,
              color: '#4E5969',
              lineHeight: '22px',
            }}>
              {activeTask?.result?.agentAnalysis || '分析中...'}
            </div>
          </motion.div>

          {/* Recommendations — slide-in-left 逐条入场 */}
          {(activeTask?.result?.recommendations?.length || 0) > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#1D2129', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6, lineHeight: '22px' }}>
                <Lightbulb size={14} style={{ color: '#FF7D00' }} />
                改进建议
              </div>
              {activeTask.result.recommendations.map((rec, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -24 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + idx * 0.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 12px', background: idx % 2 === 0 ? '#FAFBFC' : '#FFFFFF', borderRadius: 12, marginBottom: 4 }}
                >
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.55 + idx * 0.1, type: 'spring', stiffness: 380, damping: 14 }}
                  >
                    <ArrowRight size={14} style={{ color: '#165DFF', flexShrink: 0, marginTop: 2 }} />
                  </motion.span>
                  <span style={{ fontSize: 13, color: '#4E5969', lineHeight: '22px' }}>{rec}</span>
                </motion.div>
              ))}
            </div>
          )}

          {/* Multi-Agent Results */}
      {multiAgentMode && (multiAgentResults?.length > 0) && (
        <div style={{
          background: '#FFFFFF',
          borderRadius: 16,
          border: '1px solid #E5E6EB',
          padding: 20,
          marginTop: 16,
          boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Grid3X3 size={18} style={{ color: '#722ED1' }} />
            <span style={{ fontSize: 15, fontWeight: 600, color: '#1D2129' }}>多Agent协同结果</span>
            <Tag color="#722ED1" style={{ fontSize: 10, borderRadius: 8 }}>{multiAgentResults.length}个Agent</Tag>
          </div>

          {multiAgentResults.map((mr, idx) => {
            const agentInfo = AGENT_ROLES.find(a => a.code === mr.agentCode);
            const levelConfig = mr.result
              ? getLevelConfig(mr.result.level)
              : { color: '#86909C', icon: <Activity size={24} />, text: '等待中' };
            return (
              <div key={mr.agentCode} style={{
                padding: '14px 16px',
                borderRadius: 12,
                background: idx % 2 === 0 ? '#FAFBFC' : '#FFFFFF',
                borderLeft: `4px solid ${agentInfo?.color || '#E5E6EB'}`,
                marginBottom: idx < multiAgentResults.length - 1 ? 10 : 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: (agentInfo?.bgColor || '#F2F3F5'),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ color: agentInfo?.color }}>{agentInfo?.icon}</span>
                    </div>
                    <div>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#1D2129' }}>{mr.agentName}</span>
                      <Tag
                        style={{ fontSize: 10, marginLeft: 6, borderRadius: 6 }}
                        color={
                          mr.status === 'completed' ? '#00B42A'
                          : mr.status === 'running' ? '#165DFF'
                          : mr.status === 'failed' ? '#F53F3F'
                          : '#86909C'
                        }
                      >
                        {mr.status === 'completed' ? '✅完成'
                          : mr.status === 'running' ? '执行中..'
                          : mr.status === 'failed' ? '❌失败'
                          : '待执行'}
                      </Tag>
                    </div>
                  </div>
                  {mr.result && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontSize: 13, fontWeight: 600,
                        color: levelConfig.color,
                      }}>{levelConfig.text}</span>
                      <span style={{ fontSize: 12, color: '#86909C' }}>AI概率 {mr.result.aiProbability}%</span>
                    </div>
                  )}
                </div>
                {mr.result && (
                  <>
                    <p style={{ margin: '0 0 8px', fontSize: 13, color: '#4E5969', lineHeight: '20px' }}>
                      {mr.result.summary}
                    </p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {mr.result.details.slice(0, 3).map((d, di) => (
                        <span key={di} style={{
                          fontSize: 11, padding: '2px 8px', borderRadius: 6,
                          background: d.status === 'pass' ? '#F0FDF4' : d.status === 'warn' ? '#FFF7ED' : '#FEF2F2',
                          color: d.status === 'pass' ? '#00B42A' : d.status === 'warn' ? '#FF7D00' : '#F53F3F',
                        }}>
                          {d.title}
                        </span>
                      ))}
                    </div>
                  </>
                )}
                {mr.status === 'running' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <Loader2 size={14} className="spin-icon" style={{ color: '#165DFF' }} />
                    <span style={{ fontSize: 12, color: '#86909C' }}>{mr.agentName} 正在分析...</span>
                  </div>
                )}
              </div>
            );
          })}

          {!loading && multiAgentResults.every(r => r.status === 'completed') && (
            <div style={{
              marginTop: 16, paddingTop: 14, borderTop: '1px solid #E5E6EB',
              display: 'flex', justifyContent: 'flex-end', gap: 10,
            }}>
              <button
                onClick={() => {
                  setMultiAgentMode(false);
                  setMultiAgentResults([]);
                  setActiveTask(null);
                }}
                onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.98)'; }}
                onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 12,
                  border: 'none', background: '#F2F3F5',
                  color: '#4E5969', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                }}
              >
                <X size={14} /> 关闭
              </button>
              <button
                onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.98)'; }}
                onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                onClick={handleExportReport}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 20px', borderRadius: 12,
                  border: 'none', background: '#722ED1',
                  color: '#FFF', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                }}
              >
                <FileOutput size={14} /> 导出综合报告
              </button>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20, paddingTop: 16, borderTop: '1px solid #E5E6EB', flexWrap: 'wrap' }}>
            {conversationMode && (
              <button
                onClick={() => {
                  setInputValue('');
                  const inputEl = document.querySelector('.ant-input') as HTMLTextAreaElement;
                  if (inputEl) inputEl.focus();
                }}
                onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.98)'; }}
                onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 12,
                  border: 'none', background: 'transparent',
                  color: '#165DFF', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  transition: 'all 200ms ease',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}
              >
                <MessageSquare size={14} /> 继续追问
              </button>
            )}
            <button
              onClick={() => {
                setConversationMode(false);
                setConversationHistory([]);
                setCompressedContext(null);
                setShowMindMap(false);
                contextManager.clearSession(activeSessionId || sessions[0]?.id || 'session_default');
                executeTask();
              }}
              onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.98)'; }}
              onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 12,
                border: 'none', background: '#F2F3F5',
                color: '#4E5969', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                transition: 'all 200ms ease',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#E5E6EB'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#F2F3F5'; }}
            >
              <RotateCcw size={14} /> 重新执行
            </button>
            <button
              onMouseDown={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(0.98)'; }}
              onMouseUp={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
              onClick={handleExportReport}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '8px 20px', borderRadius: 12,
                border: 'none', background: '#165DFF',
                color: '#FFFFFF', fontSize: 13, fontWeight: 500, cursor: 'pointer',
                transition: 'all 200ms ease',
                boxShadow: '0 2px 8px rgba(22,93,255,0.2)',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#0E42D2'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#165DFF'; }}
            >
              <FileOutput size={14} /> 导出报告
            </button>
          </div>

          {/* Context Compression Indicator + Mind Map */}
          {(compressedContext || isCompressing) && (
            <div style={{
              marginTop: 16,
              padding: '12px 16px',
              background: 'linear-gradient(135deg, #F0F5FF, #FAF5FF)',
              borderRadius: 12,
              border: '1px solid #C9D4FF',
            }}>
              {isCompressing ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#722ED1' }}>
                  <Spin size="small" />
                  <span style={{ fontSize: 13, fontWeight: 500, lineHeight: '22px' }}>Agent 正在智能压缩上下文，提取关键信息...</span>
                </div>
              ) : compressedContext && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <BrainCircuit size={15} style={{ color: '#722ED1' }} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#722ED1', lineHeight: '22px' }}>上下文已智能压缩</span>
                      <Tag color="#722ED1" style={{ fontSize: 10, borderRadius: 8, marginLeft: 4 }}>
                        节省 {compressedContext.tokenSaved} tokens
                      </Tag>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Button
                        type="text"
                        size="small"
                        icon={showMindMap ? <Eye size={13} /> : <Grid3X3 size={13} />}
                        onClick={() => setShowMindMap(!showMindMap)}
                        style={{ fontSize: 11, color: '#722ED1', padding: '0 6px' }}
                      >
                        {showMindMap ? '收起思维导图' : '展开思维导图'}
                      </Button>
                    </div>
                  </div>

                  <p style={{ margin: '0 0 8px', fontSize: 12, color: '#4E5969', lineHeight: '18px' }}>
                    {compressedContext.summary}
                  </p>

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: showMindMap ? 10 : 0 }}>
                    {(compressedContext?.keyPoints || []).slice(0, 5).map((kp, i) => (
                      <Tag key={i} style={{ fontSize: 11, borderRadius: 12, background: '#FFF', border: '1px solid #D6E4FF', color: '#4E5969', padding: '2px 8px' }}>
                        {(kp || '').length > 20 ? (kp || '').slice(0, 19) + '..' : (kp || '')}
                      </Tag>
                    ))}
                  </div>

                  {showMindMap && compressedContext.mindMapData && (
                    <div style={{
                      marginTop: 8,
                      padding: '12px',
                      background: '#FFFFFF',
                      borderRadius: 12,
                      border: '1px solid #E5E6EB',
                      maxHeight: 220,
                      overflowY: 'auto',
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#86909C', marginBottom: 6 }}>🧠 思维导图结构</div>
                      <pre style={{
                        margin: 0,
                        fontFamily: 'Monaco, Consolas, monospace',
                        fontSize: 11.5,
                        color: '#1D2129',
                        lineHeight: 1.8,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                      }}>{renderMindMapToText(compressedContext.mindMapData)}</pre>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Conversation History */}
          {conversationMode && (conversationHistory || []).length > 0 && (
            <div style={{
              marginTop: 16,
              padding: '12px 16px',
              background: '#FAFBFC',
              borderRadius: 12,
              border: '1px solid #E5E6EB',
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#86909C', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4, lineHeight: '18px' }}>
                <History size={12} /> 对话记录 ({(conversationHistory || []).length / 2}条)
                <Tag color="#165DFF" style={{ fontSize: 9, lineHeight: '14px', marginLeft: 2, borderRadius: 6 }}>上下文关联中</Tag>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
                {conversationHistory.map((msg, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    gap: 8,
                    padding: '8px 12px',
                    borderRadius: 12,
                    background: msg.role === 'user' ? '#F0F5FF' : '#FFFFFF',
                    borderLeft: '3px solid ' + (msg.role === 'user' ? '#165DFF' : '#00B42A'),
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        {msg.role === 'user'
                          ? <User size={13} style={{ color: '#165DFF', flexShrink: 0, marginTop: 1 }} />
                          : <Bot size={13} style={{ color: '#00B42A', flexShrink: 0, marginTop: 1 }} />}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: 10, color: '#86909C', lineHeight: '18px' }}>{msg.time.toLocaleTimeString()}</span>
                          <p style={{ margin: '2px 0 0', fontSize: 12, color: '#4E5969', lineHeight: '18px' }}>
                            {(msg.content || '').length > 120 ? (msg.content || '').slice(0, 119) + '...' : (msg.content || '')}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
    );
    } catch (err) {
      console.error('[AIChatCenter] renderExecutionProgress error:', err);
      return (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <div style={{ textAlign: 'center', color: '#86909C' }}>
            <p style={{ margin: 0, fontSize: 14 }}>执行进度渲染异常，请重试</p>
          </div>
        </div>
      );
    }
  };

  const renderInputArea = () => (
    <div
      style={{
        padding: '16px 20px',
        borderTop: '1px solid #E5E6EB',
        background: '#FFFFFF',
      }}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onPaste={handlePaste}
    >
      {/* === 模式切换器 === */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: '0 4px' }}>
        <div style={{
          display: 'flex', background: '#F2F3F5', borderRadius: 8, padding: 2,
        }}>
          <button
            onClick={() => { setEditorMode('text'); setInputValue(monacoValue); }}
            style={{
              padding: '4px 12px', borderRadius: 6, border: 'none',
              background: editorMode === 'text' ? '#FFF' : 'transparent',
              color: editorMode === 'text' ? '#165DFF' : '#86909C',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              boxShadow: editorMode === 'text' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            📝 文本模式
          </button>
          <button
            onClick={() => { setEditorMode('code'); setMonacoValue(inputValue); }}
            style={{
              padding: '4px 12px', borderRadius: 6, border: 'none',
              background: editorMode === 'code' ? '#FFF' : 'transparent',
              color: editorMode === 'code' ? '#165DFF' : '#86909C',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              boxShadow: editorMode === 'code' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            &lt;/&gt; 代码模式
          </button>
        </div>

        {editorMode === 'code' && (
          <select
            value={editorLanguage}
            onChange={(e) => setEditorLanguage(e.target.value)}
            style={{
              marginLeft: 'auto', padding: '3px 8px', borderRadius: 6,
              border: '1px solid #E5E6EB', background: '#FFF', fontSize: 12, color: '#4E5969',
              cursor: 'pointer',
            }}
          >
            <option value="plaintext">纯文本</option>
            <option value="python">Python</option>
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="sql">SQL</option>
            <option value="markdown">Markdown</option>
            <option value="json">JSON</option>
            <option value="html">HTML</option>
            <option value="css">CSS</option>
            <option value="xml">XML</option>
            <option value="java">Java</option>
            <option value="cpp">C++</option>
            <option value="go">Go</option>
            <option value="rust">Rust</option>
            <option value="shell">Shell</option>
          </select>
        )}
      </div>

      {/* === 编辑器区域（条件渲染区）=== */}
      {editorMode === 'code' ? (
        <div style={{ 
          height: 280, borderRadius: 12, overflow: 'hidden',
          border: '1px solid #E5E6EB', transition: 'border-color 200ms', marginBottom: 8,
        }}>
          <Editor
            height="280px"
            language={editorLanguage}
            theme="vs-dark"
            value={monacoValue}
            onChange={(value) => {
              setMonacoValue(value || '');
              setInputValue(value || '');
            }}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              suggestOnTriggerCharacters: true,
              quickSuggestions: true,
              folding: true,
              bracketPairColorization: { enabled: true },
              guides: { bracketPairs: true, indentation: true },
              padding: { top: 12, bottom: 12 },
              fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
            }}
            onMount={(editor, monaco) => {
              editor.onDidChangeModelContent(() => {
                const content = editor.getValue();
                const model = editor.getModel();
                if (!model) return;
                
                const dangerousPatterns = [
                  { regex: /rm\s+-rf\s+[\/~]/g, msg: '⚠️ 危险：删除系统文件' },
                  { regex: /eval\s*\(/g, msg: '⚠️ 注意：eval 执行' },
                  { regex: /exec\s*\(/g, msg: '⚠️ 注意：命令执行' },
                  { regex: /document\.cookie/g, msg: '🔒 Cookie 访问' },
                ];
                
                const decorations: monaco.editor.IModelDeltaDecoration[] = [];
                const lineCount = model.getLineCount();
                
                for (let lineNum = 1; lineNum <= lineCount; lineNum++) {
                  const lineContent = model.getLineContent(lineNum);
                  for (const pattern of dangerousPatterns) {
                    let match;
                    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
                    while ((match = regex.exec(lineContent)) !== null) {
                      decorations.push({
                        range: new monaco.Range(lineNum, match.index + 1, lineNum, match.index + 1 + match[0].length),
                        options: {
                          isWholeLine: false,
                          inlineClassName: 'monaco-danger-code',
                          hoverMessage: { value: pattern.msg },
                          afterContentClassName: 'monaco-danger-indicator',
                        },
                      });
                    }
                  }
                }
                
                editor.deltaDecorations([], decorations);
              });

              editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
                executeTask();
              });
            }}
          />
          <style>{`
            .monaco-danger-code { 
              background: rgba(220, 38, 38, 0.15) !important; 
              border-bottom: 2px wavy #DC2626;
            }
            .monaco-danger-indicator::after {
              content: '⚠️';
              color: #DC2626;
              margin-left: 4px;
            }
          `}</style>
        </div>
      ) : (
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <TextArea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={conversationMode
              ? '继续输入，基于上下文进行深度分析...'
              : '输入待检测内容，启动' + currentScenarioConfig.label + '流程...'}
            autoSize={{ minRows: 2, maxRows: 4 }}
            onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); executeTask(); } }}
            disabled={loading}
            style={{
              borderRadius: 20,
              padding: '10px 50px 10px 46px',
              fontSize: 14,
              resize: 'none',
              border: '1px solid #E5E6EB',
              transition: 'border-color 200ms, box-shadow 200ms',
            }}
            onFocus={(e) => {
              (e.target as HTMLTextAreaElement).style.borderColor = '#165DFF';
              (e.target as HTMLTextAreaElement).style.boxShadow = '0 0 0 3px rgba(22,93,255,0.08)';
            }}
            onBlur={(e) => {
              (e.target as HTMLTextAreaElement).style.borderColor = '#E5E6EB';
              (e.target as HTMLTextAreaElement).style.boxShadow = 'none';
            }}
          />

          {/* Focus 底部发光线 sweep */}
          <motion.div
            initial={{ width: 0 }}
            whileFocus={{ width: '100%' }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: 'absolute', bottom: 0, left: 0, height: 2,
              background: 'linear-gradient(90deg, transparent, #165DFF, transparent)',
              borderRadius: '0 0 20px 20px',
              pointerEvents: 'none',
            }}
          />

          <div style={{ position: 'absolute', left: 14, bottom: 10, display: 'flex', gap: 4, alignItems: 'center' }}>
            {/* 附件上传区域 */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx,.txt"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => { handleFileSelect(e.target.files); e.target.value = ''; }}
            />
            <Tooltip title="上传图片或文件">
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                style={{
                  height: 34, borderRadius: '10px',
                  border: attachments.length > 0 ? '1.5px solid #165DFF' : '1.5px solid #E5E6EB',
                  background: attachments.length > 0 ? '#F0F7FF' : '#F7F8FA',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: attachments.length > 0 ? '#165DFF' : '#86909C',
                  transition: 'all 200ms',
                  padding: '0 10px',
                  gap: 4,
                }}
              >
                <Paperclip size={15} />
                <span style={{ fontSize: 12, fontWeight: 500 }}>附件</span>
              </motion.button>
            </Tooltip>
          </div>

          {/* 发送按钮：方形 + 明显品牌色，与附件圆角矩形区分 */}
          <motion.button
            onClick={executeTask}
            disabled={!inputValue.trim() || loading}
            whileTap={{ scale: 0.92 }}
            whileHover={!loading && inputValue.trim() ? { scale: 1.04, boxShadow: '0 4px 16px rgba(22,93,255,0.35)' } : {}}
            animate={
              loading
                ? { background: ['#165DFF', '#722ED1', '#165DFF'] }
                : {}
            }
            transition={
              loading
                ? { duration: 2, repeat: Infinity, ease: 'easeInOut' }
                : {}
            }
            style={{
              position: 'absolute', right: 8, bottom: 8,
              width: 38, height: 38, borderRadius: '10px',
              border: 'none',
              background: inputValue.trim() && !loading ? 'linear-gradient(135deg, #165DFF, #0EA5E9)' : '#E5E6EB',
              color: inputValue.trim() && !loading ? '#FFF' : '#C9CDD4',
              cursor: inputValue.trim() && !loading ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: inputValue.trim() && !loading ? '0 3px 12px rgba(22,93,255,0.3)' : 'none',
              fontWeight: 600,
              fontSize: 11,
            }}
          >
            {loading ? (
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Loader2 size={16} />
              </motion.span>
            ) : (
              <>
                <Send size={15} />
                <span style={{ marginLeft: 2 }}>发送</span>
              </>
            )}
          </motion.button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
          <Button
            icon={<Grid3X3 size={13} />}
            onClick={() => setSkillPanelOpen(true)}
            style={{
              height: 36, borderRadius: 12, fontSize: 12,
              borderColor: selectedSkills.length > 0 ? '#FF7D00' : '#E5E6EB',
              color: selectedSkills.length > 0 ? '#FF7D00' : '#86909C',
              background: selectedSkills.length > 0 ? '#FFF7ED' : '#FAFBFC',
            }}
          >
            技能{selectedSkills.length > 0 && `(${selectedSkills.length})`}
          </Button>
        </div>
      </div>
      )}

      {selectedSkills.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          {selectedSkills.map((skill, idx) => (
            <motion.div
              key={skill.id}
              variants={cinemaPopInVariants}
              custom={idx * 0.05}
              initial="hidden"
              animate="visible"
              whileHover={{ scale: 1.06, transition: { duration: 0.15 } }}
            >
              <Tag
                closable
                onClose={() => setSelectedSkills(prev => prev.filter(s => s.id !== skill.id))}
                style={{
                  borderRadius: 12, fontSize: 11, padding: '2px 8px',
                  background: '#F2F3F5', color: '#4E5969', border: 'none',
                  cursor: 'pointer',
                }}
              >
                {skill.name.length > 16 ? skill.name.slice(0, 15) + '...' : skill.name}
              </Tag>
            </motion.div>
          ))}
        </div>
      )}

      {attachments.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          {attachments.map((att, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 10px', borderRadius: 12,
                background: '#E8F3FF', border: '1px solid #165DFF30',
                maxWidth: 220,
              }}
            >
              {att.preview ? (
                <img src={att.preview} alt={att.name} style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover' }} />
              ) : (
                <div style={{
                  width: 36, height: 36, borderRadius: 6,
                  background: '#165DFF15', color: '#165DFF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600,
                  flexShrink: 0,
                }}>
                  {att.name.split('.').pop()?.toUpperCase().slice(0, 3) || 'FILE'}
                </div>
              )}
              <span style={{
                fontSize: 12, color: '#4E5969', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0,
              }}>
                {att.name.length > 18 ? att.name.slice(0, 17) + '...' : att.name}
              </span>
              <button
                onClick={() => removeAttachment(idx)}
                style={{
                  width: 20, height: 20, borderRadius: '50%', border: 'none',
                  background: 'transparent', color: '#86909C', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 0, flexShrink: 0,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#F53F3F'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#86909C'; }}
              >
                <X size={11} />
              </button>
            </div>
          ))}
          <div style={{ fontSize: 11, color: '#86909C', display: 'flex', alignItems: 'center' }}>
            已添加{attachments.length} 个附件，{attachments.reduce((s, a) => s + a.file.size, 0) > 1024 * 1024
              ? `${(attachments.reduce((s, a) => s + a.file.size, 0) / (1024 * 1024)).toFixed(1)}MB`
              : `${Math.ceil(attachments.reduce((s, a) => s + a.file.size, 0) / 1024)}KB`
            }
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <span style={{ fontSize: 12, color: '#C9CDD4', lineHeight: '18px' }}>
          智能检测引擎 · <Tag color={currentScenarioConfig.color} style={{ fontSize: 10, marginLeft: 2, lineHeight: '16px', borderRadius: 6 }}>{currentScenarioConfig.label}</Tag>
          {selectedSkills.length > 0 && <span> · <Tag color="#FF7D00" style={{ fontSize: 10, lineHeight: '16px', borderRadius: 6 }}>{selectedSkills.length}项技能已加载</Tag></span>}
          {conversationMode && <span> · <Tag color="#722ED1" style={{ fontSize: 10, lineHeight: '16px', borderRadius: 6 }}>多轮上下文关联</Tag></span>}
          {compressedContext && <span> · <Tag color="#722ED1" style={{ fontSize: 10, lineHeight: '16px', borderRadius: 6 }}>上下文已压缩</Tag></span>}
        </span>
        {activeTask && (
          <Tag
            color={activeTask.status === 'completed' ? '#00B42A' : activeTask.status === 'failed' ? '#F53F3F' : '#165DFF'}
            style={{ borderRadius: 12, fontSize: 11 }}
          >
            {activeTask.status === 'completed' ? '已完成' : activeTask.status === 'failed' ? '失败' : '执行中'}
          </Tag>
        )}
      </div>
    </div>
  );

  return (
    <div className="ai-chat-center" style={{
      display: 'flex',
      background: '#F5F7FA',
      borderRadius: 16,
      overflow: 'hidden',
      border: '1px solid #E5E6EB',
      boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
      position: 'relative',
      height: 'calc(100vh - 80px)',
    }}>
      <Button
        type="text"
        icon={sidebarCollapsed ? <ChevronDown size={18} style={{ transform: 'rotate(-90deg)' }} /> : <ChevronDown size={18} />}
        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        style={{
          position: 'absolute',
          left: sidebarCollapsed ? 12 : 264,
          top: '50%',
          transform: 'translateY(-50%)' + (sidebarCollapsed ? '' : ''),
          zIndex: 10,
          width: 28,
          height: 48,
          borderRadius: 12,
          background: '#FFF',
          border: '1px solid #E5E6EB',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'left 200ms ease',
        }}
      />

      {renderSidebar()}

      <div className="ai-main-area" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {!activeTask ? renderWelcomeArea() : renderExecutionProgress()}
        {renderInputArea()}
      </div>

      <SkillSelectorPanel
        visible={skillPanelOpen}
        onClose={() => setSkillPanelOpen(false)}
        onSelect={handleSkillSelect}
        selectedIds={selectedSkills.map(s => s.id)}
      />

      <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes gentle-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes bounce-dot {
          0%, 80%, 100% { transform: scale(0); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }
        @keyframes pulse-check {
          0% { box-shadow: 0 0 0 0 rgba(0,180,42,0.4); }
          70% { box-shadow: 0 0 0 8px rgba(0,180,42,0); }
          100% { box-shadow: 0 0 0 0 rgba(0,180,42,0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-3px); }
          75% { transform: translateX(3px); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes arch-pulse {
          0%, 100% { box-shadow: 0 0 0 0 currentColor; }
          50% { box-shadow: 0 0 0 6px transparent; }
        }
        @keyframes arch-flow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .agent-fade-in { animation: fade-in-up 250ms ease-out; }
        .loading-dots span { animation: bounce-dot 1.4s infinite ease-in-out both; }
        .loading-dots span:nth-child(1) { animation-delay: -0.32s; }
        .loading-dots span:nth-child(2) { animation-delay: -0.16s; }
        .status-success-pulse { animation: pulse-check 2s infinite; }
        .status-error-shake { animation: shake 0.4s ease-in-out; }
        .spin-icon { animation: spin 1s linear infinite; }
        .arch-step-active .arch-step-icon { animation: arch-pulse 2s infinite; }
        .arch-connector-active {
          background: linear-gradient(90deg, #165DFF, #722ED1, #F53F3F, #165DFF);
          background-size: 300% 100%;
          animation: arch-flow 3s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default AgentCenter;
