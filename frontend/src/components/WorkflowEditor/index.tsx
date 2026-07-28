import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  NodeProps,
  Panel,
  ReactFlowProvider,
  ReactFlowInstance,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  MessageSquare,
  Database,
  GitBranch,
  Repeat,
  Wrench,
  Code2,
  Globe,
  Variable,
  FileText,
  Play,
  Save,
  Copy,
  Trash2,
  Plus,
  Sparkles,
  Shield,
  Search,
  Coffee,
  Bell,
  Zap,
  ChevronDown,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  Maximize,
  Undo2,
  Redo2,
  X,
  Settings2,
  CircleDot,
  AlertCircle,
  Loader2,
  LayoutGrid,
  SlidersHorizontal,
  Type,
  Hash,
  Link as LinkIcon,
  Terminal,
  Send,
  UserCheck,
  MessageCircle,
  Eye,
  Timer,
  Coins,
  FileCode,
  Bot,
  Cpu,
  Network,
  Filter,
  Braces,
  KeyRound,
  Palette,
  GripVertical,
} from 'lucide-react';
import {
  message,
  Modal,
  Button,
  Input,
  Select,
  Tag,
  Tooltip,
  Card,
  Slider,
  Switch,
  Form,
  Tabs,
  Space,
  Divider,
  Typography,
  Badge,
  Collapse,
  Empty,
  Spin,
} from 'antd';
import { InputNumber, ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import workflowApi, {
  WorkflowNodeData,
  WorkflowEdgeData,
  WorkflowItem,
  WorkflowTemplateItem,
  WorkflowExecutionItem,
  getWorkflowDetail,
  duplicateWorkflow,
  getWorkflowTemplates,
} from '@/api/workflowApi';

const { Text, Title } = Typography;
const { TextArea } = Input;

const NODE_TYPES = [
  { type: 'start', label: '开始', icon: Play, color: '#10B981', bg: '#ECFDF5', category: 'trigger', desc: '工作流的入口节点' },
  { type: 'end', label: '结束', icon: CheckCircle2, color: '#EF4444', bg: '#FEF2F2', category: 'trigger', desc: '工作流的终止节点' },
  { type: 'llm', label: 'LLM 调用', icon: MessageSquare, color: '#8B5CF6', bg: '#F5F3FF', category: 'core', desc: '调用大语言模型进行智能处理' },
  { type: 'knowledge_retrieval', label: '知识库检索', icon: Database, color: '#3B82F6', bg: '#EFF6FF', category: 'core', desc: '从知识库中检索相关内容' },
  { type: 'condition', label: '条件分支', icon: GitBranch, color: '#F59E0B', bg: '#FFFBEB', category: 'core', desc: '根据条件进行分支判断' },
  { type: 'iteration', label: '迭代循环', icon: Repeat, color: '#EC4899', bg: '#FDF2F8', category: 'core', desc: '对数据进行循环迭代处理' },
  { type: 'tool', label: '工具调用', icon: Wrench, color: '#6366F1', bg: '#EEF2FF', category: 'tool', desc: '调用外部工具或服务' },
  { type: 'code', label: '代码执行', icon: Code2, color: '#14B8A6', bg: '#F0FDFA', category: 'tool', desc: '执行自定义代码逻辑' },
  { type: 'http_request', label: 'HTTP 请求', icon: Globe, color: '#F97316', bg: '#FFF7ED', category: 'tool', desc: '发送HTTP请求获取数据' },
  { type: 'variable_assigner', label: '变量赋值', icon: Variable, color: '#84CC16', bg: '#F7FEE7', category: 'tool', desc: '对变量进行赋值操作' },
  { type: 'tipping', label: '打赏处理', icon: Coffee, color: '#FF6B35', bg: '#FFF7F2', category: 'business', desc: '处理用户打赏相关业务' },
  { type: 'notification', label: '通知推送', icon: Bell, color: '#06B6D4', bg: '#ECFEFF', category: 'business', desc: '发送各类通知消息' },
];

const NODE_CATEGORIES = [
  { key: 'trigger', label: '触发/终止', icon: CircleDot, color: '#10B981' },
  { key: 'core', label: '核心处理', icon: Cpu, color: '#8B5CF6' },
  { key: 'tool', label: '工具集成', icon: Wrench, color: '#3B82F6' },
  { key: 'business', label: '业务能力', icon: BriefcaseIcon, color: '#F97316' },
];

function BriefcaseIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect width="20" height="14" x="2" y="7" rx="2" ry="2"/>
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
    </svg>
  );
}

interface CustomNodeData {
  nodeType: string;
  title?: string;
  desc?: string;
  config_data?: Record<string, any>;
  status?: 'ready' | 'running' | 'error';
}

const CustomNode = ({ data, id, selected }: NodeProps<Node<CustomNodeData>>) => {
  const nodeType = NODE_TYPES.find(n => n.type === data.nodeType) || NODE_TYPES[0];
  const IconComp = nodeType.icon;

  const statusColors = {
    ready: '#10B981',
    running: '#F59E0B',
    error: '#EF4444',
  };

  const statusLabels = {
    ready: '就绪',
    running: '运行中',
    error: '错误',
  };

  return (
    <div
      style={{
        padding: 0,
        borderRadius: 12,
        background: '#fff',
        border: `2px solid ${selected ? nodeType.color : '#E5E7EB'}`,
        boxShadow: selected
          ? `0 0 0 3px ${nodeType.color}25, 0 8px 24px ${nodeType.color}15`
          : '0 2px 8px rgba(0,0,0,0.08)',
        minWidth: 220,
        maxWidth: 280,
        transition: 'all 0.2s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
        background: nodeType.color,
        borderRadius: '12px 0 0 12px',
      }} />

      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: nodeType.color,
          border: '3px solid #fff',
          width: 12,
          height: 12,
          left: -6,
        }}
      />

      <div style={{ padding: '16px 16px 16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: nodeType.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            border: `1.5px solid ${nodeType.color}30`,
          }}>
            <IconComp size={20} color={nodeType.color} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 4,
            }}>
              <Text strong style={{
                fontSize: 14,
                color: '#111827',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 160,
              }}>
                {data.title || nodeType.label}
              </Text>

              {data.status && (
                <Tooltip title={statusLabels[data.status]}>
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: statusColors[data.status],
                    flexShrink: 0,
                    boxShadow: `0 0 6px ${statusColors[data.status]}`,
                  }} />
                </Tooltip>
              )}
            </div>

            {data.desc && (
              <Text type="secondary" style={{
                fontSize: 12,
                lineHeight: 1.4,
                display: '-webkit-box',
                WebkitLineClamp: 1,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {data.desc}
              </Text>
            )}
          </div>
        </div>

        {(data.nodeType === 'llm' || data.nodeType === 'code') && data.config_data?.prompt && (
          <div style={{
            marginTop: 12,
            padding: '10px 12px',
            background: '#F9FAFB',
            borderRadius: 8,
            border: '1px solid #E5E7EB',
            fontSize: 11,
            color: '#6B7280',
            fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
            lineHeight: 1.6,
            maxHeight: 56,
            overflow: 'hidden',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}>
            {String(data.config_data.prompt).slice(0, 100)}...
          </div>
        )}

        {data.nodeType === 'http_request' && data.config_data?.url && (
          <div style={{
            marginTop: 12,
            padding: '8px 12px',
            background: '#FEF3C7',
            borderRadius: 6,
            fontSize: 11,
            color: '#92400E',
            fontFamily: 'monospace',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <Badge
              count={data.config_data.method?.toUpperCase() || 'GET'}
              style={{
                backgroundColor: data.config_data.method === 'POST' ? '#EF4444' :
                               data.config_data.method === 'PUT' ? '#F59E0B' : '#3B82F6',
                fontSize: 10,
                padding: '0 6px',
                lineHeight: '16px',
              }}
            />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {data.config_data.url.slice(0, 50)}
            </span>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: nodeType.color,
          border: '3px solid #fff',
          width: 12,
          height: 12,
          right: -6,
        }}
      />
    </div>
  );
};

const nodeTypes = {
  custom: CustomNode,
};

interface WorkflowEditorProps {
  workflowId?: string;
  onSave?: (workflowId: string) => void;
}

const WorkflowEditorContent: React.FC<WorkflowEditorProps> = ({ workflowId, onSave }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [name, setName] = useState('未命名工作流');
  const [desc, setDesc] = useState('');
  const [wfType, setWfType] = useState<'chatflow' | 'workflow' | 'agent'>('chatflow');
  const [saving, setSaving] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState<WorkflowTemplateItem[]>([]);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [showNodePanel, setShowNodePanel] = useState(true);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['trigger', 'core']);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [executionResult, setExecutionResult] = useState<WorkflowExecutionItem | null>(null);
  const [showExecutionModal, setShowExecutionModal] = useState(false);

  useEffect(() => {
    if (workflowId) {
      loadWorkflow(workflowId);
    }
  }, [workflowId]);

  const loadWorkflow = async (id: string) => {
    try {
      const res = await getWorkflowDetail(id) as any;
      if (res.success && res.data) {
        setName(res.data.name || '未命名工作流');
        setDesc(res.data.description || '');
        setWfType(res.data.workflow_type || 'chatflow');

        if (res.data.graph_data?.nodes) {
          const flowNodes: Node[] = res.data.graph_data.nodes.map((n: any) => ({
            id: n.id,
            type: 'custom',
            position: { x: n.position_x, y: n.position_y },
            data: {
              nodeType: n.node_type,
              title: n.title,
              desc: n.desc,
              config_data: n.config_data,
            },
          }));
          setNodes(flowNodes);
        }

        if (res.data.graph_data?.edges) {
          const flowEdges: Edge[] = res.data.graph_data.edges.map((e: any) => ({
            id: e.id,
            source: e.source_node_id,
            target: e.target_node_id,
            sourceHandle: e.source_handle,
            targetHandle: e.target_handle,
            type: 'smoothstep',
            animated: true,
            style: { stroke: '#6366f1', strokeWidth: 2 },
            data: { condition_data: e.condition_data, label: e.label },
          }));
          setEdges(flowEdges);
        }
      }
    } catch (error) {
      console.error('加载工作流失败:', error);
    }
  };

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: 'smoothstep',
            animated: true,
            style: { stroke: '#818CF8', strokeWidth: 2 },
            data: {},
          },
          eds
        )
      ),
    []
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');

      if (!type) return;

      const rect = reactFlowWrapper.current?.getBoundingClientRect();
      if (!rect) return;

      const nodeType = NODE_TYPES.find(n => n.type === type);
      if (!nodeType) return;

      const position = reactFlowInstance?.screenToFlowPosition({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      }) || {
        x: event.clientX - rect.left - 110,
        y: event.clientY - rect.top - 40,
      };

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type: 'custom',
        position,
        data: {
          nodeType: type,
          title: nodeType.label,
          desc: '',
          config_data: getDefaultConfig(type),
          status: 'ready',
        },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [reactFlowInstance]
  );

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleSave = async () => {
    if (nodes.length === 0) {
      message.warning('请至少添加一个节点');
      return;
    }

    setSaving(true);
    try {
      const res = await workflowApi.saveWorkflowGraph({
        workflow_id: workflowId,
        create_new: !workflowId,
        name,
        description: desc,
        workflow_type: wfType,
        nodes: nodes.map(n => ({
          id: n.id,
          type: n.data.nodeType,
          position: n.position,
          data: n.data,
        })),
        edges: edges.map(e => ({
          id: e.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          targetHandle: e.targetHandle,
          data: e.data,
        })),
      });

      if ((res as any).success) {
        message.success('保存成功！');
        onSave?.((res as any).data?.id || '');
      }
    } catch (e) {
      message.error('保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleExecute = async () => {
    if (!workflowId) {
      message.warning('请先保存工作流');
      return;
    }

    setExecuting(true);
    try {
      const res = await workflowApi.executeWorkflow(workflowId, {});

      if ((res as any).success) {
        setExecutionResult((res as any).data);
        setShowExecutionModal(true);
      }
    } catch (e: any) {
      message.error(e?.response?.data?.message || '执行失败');
    } finally {
      setExecuting(false);
    }
  };

  const loadTemplates = async () => {
    setShowTemplates(true);
    try {
      const res = await getWorkflowTemplates();
      setTemplates((res as any)?.data || []);
    } catch {}
  };

  const applyTemplate = async (template: WorkflowTemplateItem) => {
    if (!template.base_workflow_id) {
      const templateConfigs: Record<string, { nodes: Node[]; edges: Edge[] }> = {
        'builtin-001': {
          nodes: [
            { id: 'start-1', type: 'custom', position: { x: 80, y: 200 }, data: { nodeType: 'start', title: '开始', desc: '接收输入文本', config_data: {}, status: 'ready' } },
            { id: 'llm-1', type: 'custom', position: { x: 280, y: 200 }, data: { nodeType: 'llm', title: 'LLM 安全分析', desc: '分析内容风险等级', config_data: { model: 'deepseek-chat', temperature: 0.3, prompt: '请分析以下内容的安全风险等级（高/中/低）：\n\n{{input}}\n\n给出风险评估理由。', output_variable: 'risk_analysis' }, status: 'ready' } },
            { id: 'condition-1', type: 'custom', position: { x: 480, y: 200 }, data: { nodeType: 'condition', title: '风险等级判断', desc: '根据分析结果分流', config_data: { conditions: [{ variable: 'risk_analysis', operator: 'contains', value: '高风险', label: '高风险' }, { variable: 'risk_analysis', operator: 'contains', value: '中风险', label: '中风险' }] }, status: 'ready' } },
            { id: 'notification-1', type: 'custom', position: { x: 680, y: 120 }, data: { nodeType: 'notification', title: '发送告警通知', desc: '通知管理员处理', config_data: { channel: 'system', template: 'high_risk_alert', recipients: [] }, status: 'ready' } },
            { id: 'end-1', type: 'custom', position: { x: 680, y: 280 }, data: { nodeType: 'end', title: '结束', desc: '流程完成', config_data: {}, status: 'ready' } },
          ],
          edges: [
            { id: 'e-start-llm', source: 'start-1', target: 'llm-1', type: 'smoothstep', animated: true, style: { stroke: '#818CF8', strokeWidth: 2 }, data: {} },
            { id: 'e-llm-condition', source: 'llm-1', target: 'condition-1', type: 'smoothstep', animated: true, style: { stroke: '#818CF8', strokeWidth: 2 }, data: {} },
            { id: 'e-condition-notification', source: 'condition-1', target: 'notification-1', type: 'smoothstep', animated: true, style: { stroke: '#818CF8', strokeWidth: 2 }, data: {} },
            { id: 'e-condition-end', source: 'condition-1', target: 'end-1', type: 'smoothstep', animated: true, style: { stroke: '#818CF8', strokeWidth: 2 }, data: {} },
          ],
        },
        'builtin-002': {
          nodes: [
            { id: 'start-1', type: 'custom', position: { x: 80, y: 200 }, data: { nodeType: 'start', title: '用户提问', desc: '接收用户问题', config_data: {}, status: 'ready' } },
            { id: 'knowledge-1', type: 'custom', position: { x: 280, y: 200 }, data: { nodeType: 'knowledge_retrieval', title: '知识库检索', desc: '搜索相关知识', config_data: { query: '{{input}}', category_slug: '', top_k: 5, score_threshold: 0.5 }, status: 'ready' } },
            { id: 'llm-1', type: 'custom', position: { x: 480, y: 200 }, data: { nodeType: 'llm', title: '生成回答', desc: '基于知识生成回复', config_data: { model: 'deepseek-chat', temperature: 0.7, prompt: '基于以下知识库内容回答用户问题：\n\n知识库内容：{{knowledge_1_context}}\n\n用户问题：{{input}}\n\n请给出专业、友好的回答。', output_variable: 'answer' }, status: 'ready' } },
            { id: 'code-1', type: 'custom', position: { x: 680, y: 200 }, data: { nodeType: 'code', title: '满意度收集', desc: '询问用户是否满意', config_data: { language: 'python', code: 'result = "您对回答满意吗？(满意/不满意)"\nprint(result)' }, status: 'ready' } },
            { id: 'end-1', type: 'custom', position: { x: 880, y: 200 }, data: { nodeType: 'end', title: '结束', desc: '对话结束', config_data: {}, status: 'ready' } },
          ],
          edges: [
            { id: 'e-start-knowledge', source: 'start-1', target: 'knowledge-1', type: 'smoothstep', animated: true, style: { stroke: '#818CF8', strokeWidth: 2 }, data: {} },
            { id: 'e-knowledge-llm', source: 'knowledge-1', target: 'llm-1', type: 'smoothstep', animated: true, style: { stroke: '#818CF8', strokeWidth: 2 }, data: {} },
            { id: 'e-llm-code', source: 'llm-1', target: 'code-1', type: 'smoothstep', animated: true, style: { stroke: '#818CF8', strokeWidth: 2 }, data: {} },
            { id: 'e-code-end', source: 'code-1', target: 'end-1', type: 'smoothstep', animated: true, style: { stroke: '#818CF8', strokeWidth: 2 }, data: {} },
          ],
        },
        'builtin-003': {
          nodes: [
            { id: 'start-1', type: 'custom', position: { x: 40, y: 200 }, data: { nodeType: 'start', title: '文本输入', desc: '接收待检测文本', config_data: {}, status: 'ready' } },
            { id: 'llm-1', type: 'custom', position: { x: 240, y: 200 }, data: { nodeType: 'llm', title: 'AI 概率检测', desc: '检测AI生成概率', config_data: { model: 'deepseek-chat', temperature: 0.1, prompt: '请分析以下文本的AI生成概率（0-100%），并给出判断依据：\n\n{{input}}\n\n格式：概率 | 判断依据', output_variable: 'ai_probability' }, status: 'ready' } },
            { id: 'http-1', type: 'custom', position: { x: 440, y: 120 }, data: { nodeType: 'http_request', title: '抄袭比对API', desc: '调用抄袭检测服务', config_data: { method: 'POST', url: 'https://api.example.com/plagiarism/check', headers: {}, body: {}, timeout: 30 }, status: 'ready' } },
            { id: 'llm-2', type: 'custom', position: { x: 440, y: 280 }, data: { nodeType: 'llm', title: '深度伪造检测', desc: '检测Deepfake痕迹', config_data: { model: 'deepseek-chat', temperature: 0.2, prompt: '检测以下文本是否存在深度伪造（Deepfake）痕迹：\n\n{{input}}\n\n给出详细分析报告。', output_variable: 'deepfake_result' }, status: 'ready' } },
            { id: 'condition-1', type: 'custom', position: { x: 640, y: 200 }, data: { nodeType: 'condition', title: '综合风险评估', desc: '汇总所有检测结果', config_data: { conditions: [{ variable: 'ai_probability', operator: 'greater_than', value: '80%', label: '高风险' }, { variable: 'ai_probability', operator: 'less_than', value: '50%', label: '低风险' }] }, status: 'ready' } },
            { id: 'code-1', type: 'custom', position: { x: 840, y: 200 }, data: { nodeType: 'code', title: '生成报告', desc: '输出综合检测报告', config_data: { language: 'python', code: 'report = f"""\nAI检测报告\n===========\nAI生成概率: {{ai_probability}}\n抄袭检测结果: {{http_1_response}}\nDeepfake分析: {{deepfake_result}}\n"""\nresult = report\nprint(result)' }, status: 'ready' } },
            { id: 'end-1', type: 'custom', position: { x: 1040, y: 200 }, data: { nodeType: 'end', title: '输出报告', desc: '流程结束', config_data: {}, status: 'ready' } },
          ],
          edges: [
            { id: 'e-start-llm1', source: 'start-1', target: 'llm-1', type: 'smoothstep', animated: true, style: { stroke: '#818CF8', strokeWidth: 2 }, data: {} },
            { id: 'e-llm1-http', source: 'llm-1', target: 'http-1', type: 'smoothstep', animated: true, style: { stroke: '#818CF8', strokeWidth: 2 }, data: {} },
            { id: 'e-llm1-llm2', source: 'llm-1', target: 'llm-2', type: 'smoothstep', animated: true, style: { stroke: '#818CF8', strokeWidth: 2 }, data: {} },
            { id: 'e-http-condition', source: 'http-1', target: 'condition-1', type: 'smoothstep', animated: true, style: { stroke: '#818CF8', strokeWidth: 2 }, data: {} },
            { id: 'e-llm2-condition', source: 'llm-2', target: 'condition-1', type: 'smoothstep', animated: true, style: { stroke: '#818CF8', strokeWidth: 2 }, data: {} },
            { id: 'e-condition-code', source: 'condition-1', target: 'code-1', type: 'smoothstep', animated: true, style: { stroke: '#818CF8', strokeWidth: 2 }, data: {} },
            { id: 'e-code-end', source: 'code-1', target: 'end-1', type: 'smoothstep', animated: true, style: { stroke: '#818CF8', strokeWidth: 2 }, data: {} },
          ],
        },
        'builtin-004': {
          nodes: [
            { id: 'http-1', type: 'custom', position: { x: 80, y: 200 }, data: { nodeType: 'http_request', title: 'API数据采集', desc: '定时获取外部数据', config_data: { method: 'GET', url: 'https://api.example.com/data', headers: {}, timeout: 30 }, status: 'ready' } },
            { id: 'code-1', type: 'custom', position: { x: 280, y: 200 }, data: { nodeType: 'code', title: '数据清洗转换', desc: '处理原始数据', config_data: { language: 'python', code: 'import json\nraw_data = {{http_1_response}}\ncleaned = [item for item in raw_data if item.get("status") == "active"]\nresult = cleaned\nprint(f"清洗后记录数: {len(cleaned)}")' }, status: 'ready' } },
            { id: 'condition-1', type: 'custom', position: { x: 480, y: 200 }, data: { nodeType: 'condition', title: '条件筛选', desc: '根据规则过滤', config_data: { conditions: [{ variable: 'cleaned_count', operator: 'greater_than', value: '100', label: '符合要求' }, { variable: 'cleaned_count', operator: 'less_than', value: '100', label: '数量不足' }] }, status: 'ready' } },
            { id: 'variable-1', type: 'custom', position: { x: 680, y: 120 }, data: { nodeType: 'variable_assigner', title: '存储到数据库', desc: '保存有效数据', config_data: { variable_name: 'stored_data', expression: '{{cleaned_data}}' }, status: 'ready' } },
            { id: 'notification-1', type: 'custom', position: { x: 680, y: 280 }, data: { nodeType: 'notification', title: '发送异常通知', desc: '提醒数据不足', config_data: { channel: 'system', template: 'data_warning', recipients: [] }, status: 'ready' } },
          ],
          edges: [
            { id: 'e-http-code', source: 'http-1', target: 'code-1', type: 'smoothstep', animated: true, style: { stroke: '#818CF8', strokeWidth: 2 }, data: {} },
            { id: 'e-code-condition', source: 'code-1', target: 'condition-1', type: 'smoothstep', animated: true, style: { stroke: '#818CF8', strokeWidth: 2 }, data: {} },
            { id: 'e-condition-variable', source: 'condition-1', target: 'variable-1', type: 'smoothstep', animated: true, style: { stroke: '#818CF8', strokeWidth: 2 }, data: {} },
            { id: 'e-condition-notification', source: 'condition-1', target: 'notification-1', type: 'smoothstep', animated: true, style: { stroke: '#818CF8', strokeWidth: 2 }, data: {} },
          ],
        },
        'builtin-005': {
          nodes: [
            { id: 'start-1', type: 'custom', position: { x: 40, y: 200 }, data: { nodeType: 'start', title: '行为数据采集', desc: '收集用户行为事件', config_data: {}, status: 'ready' } },
            { id: 'code-1', type: 'custom', position: { x: 240, y: 200 }, data: { nodeType: 'code', title: '特征提取', desc: '提取关键特征值', config_data: { language: 'python', code: 'features = {\n    "login_frequency": len([e for e in events if e.type == "login"]),\n    "device_count": len(set(e.device_id for e in events)),\n    "ip_changes": count_ip_changes(events),\n}\nresult = features\nprint(features)' }, status: 'ready' } },
            { id: 'tool-1', type: 'custom', position: { x: 440, y: 200 }, data: { nodeType: 'tool', title: '规则引擎', desc: '应用风控规则', config_data: { tool_name: 'rule_engine', params: { rules_file: 'fraud_rules.json' } }, status: 'ready' } },
            { id: 'llm-1', type: 'custom', position: { x: 640, y: 200 }, data: { nodeType: 'llm', title: 'AI 风险评分', desc: '智能评估风险等级', config_data: { model: 'deepseek-chat', temperature: 0.2, prompt: '基于以下特征进行风控评分（0-100）：\n\n特征数据：{{features}}\n\n规则引擎结果：{{tool_1_result}}\n\n输出格式：分数 | 风险等级 | 建议', output_variable: 'risk_score' }, status: 'ready' } },
            { id: 'condition-1', type: 'custom', position: { x: 840, y: 200 }, data: { nodeType: 'condition', title: '处置决策', desc: '根据评分决定操作', config_data: { conditions: [{ variable: 'risk_score', operator: 'greater_than', value: '80', label: '自动拦截' }, { variable: 'risk_score', operator: 'greater_than', value: '60', label: '人工审核' }] }, status: 'ready' } },
            { id: 'notification-1', type: 'custom', position: { x: 1040, y: 120 }, data: { nodeType: 'notification', title: '拦截通知', desc: '通知安全团队', config_data: { channel: 'system', template: 'block_alert', recipients: [] }, status: 'ready' } },
            { id: 'variable-1', type: 'custom', position: { x: 1040, y: 280 }, data: { nodeType: 'variable_assigner', title: '加入审核队列', desc: '等待人工处理', config_data: { variable_name: 'review_queue', expression: '{{user_id}}' }, status: 'ready' } },
          ],
          edges: [
            { id: 'e-start-code', source: 'start-1', target: 'code-1', type: 'smoothstep', animated: true, style: { stroke: '#818CF8', strokeWidth: 2 }, data: {} },
            { id: 'e-code-tool', source: 'code-1', target: 'tool-1', type: 'smoothstep', animated: true, style: { stroke: '#818CF8', strokeWidth: 2 }, data: {} },
            { id: 'e-tool-llm', source: 'tool-1', target: 'llm-1', type: 'smoothstep', animated: true, style: { stroke: '#818CF8', strokeWidth: 2 }, data: {} },
            { id: 'e-llm-condition', source: 'llm-1', target: 'condition-1', type: 'smoothstep', animated: true, style: { stroke: '#818CF8', strokeWidth: 2 }, data: {} },
            { id: 'e-condition-notification', source: 'condition-1', target: 'notification-1', type: 'smoothstep', animated: true, style: { stroke: '#818CF8', strokeWidth: 2 }, data: {} },
            { id: 'e-condition-variable', source: 'condition-1', target: 'variable-1', type: 'smoothstep', animated: true, style: { stroke: '#818CF8', strokeWidth: 2 }, data: {} },
          ],
        },
        'builtin-006': {
          nodes: [
            { id: 'start-1', type: 'custom', position: { x: 80, y: 200 }, data: { nodeType: 'start', title: '主题输入', desc: '接收创作主题', config_data: {}, status: 'ready' } },
            { id: 'llm-1', type: 'custom', position: { x: 280, y: 200 }, data: { nodeType: 'llm', title: '大纲生成', desc: 'LLM生成文章大纲', config_data: { model: 'deepseek-chat', temperature: 0.9, prompt: '基于主题「{{input}}」创作一个详细的文章大纲，包含：\n1. 标题建议（3个）\n2. 章节结构（5-7个章节）\n3. 每章核心观点\n4. 关键论据方向', output_variable: 'outline' }, status: 'ready' } },
            { id: 'iteration-1', type: 'custom', position: { x: 480, y: 200 }, data: { nodeType: 'iteration', title: '逐段扩写', desc: '迭代生成各段落', config_data: { iterate_variable: 'outline_sections', max_iterations: 5, break_condition: '' }, status: 'ready' } },
            { id: 'llm-2', type: 'custom', position: { x: 680, y: 200 }, data: { nodeType: 'llm', title: '质量评估', desc: '评估文章质量', config_data: { model: 'deepseek-chat', temperature: 0.3, prompt: '从以下维度评估这篇文章质量（1-10分）：\n\n文章内容：{{expanded_content}}\n\n评估维度：\n- 内容深度\n- 逻辑性\n- 可读性\n- 创新性\n- 完整度\n\n给出总分和改进建议。', output_variable: 'quality_score' }, status: 'ready' } },
            { id: 'tipping-1', type: 'custom', position: { x: 880, y: 200 }, data: { nodeType: 'tipping', title: '打赏激励', desc: '鼓励读者打赏', config_data: { creator_id: '', amount: 10, message: '感谢您的支持！您的打赏将激励创作者产出更多优质内容。' }, status: 'ready' } },
            { id: 'end-1', type: 'custom', position: { x: 1080, y: 200 }, data: { nodeType: 'end', title: '发布完成', desc: '创作流程结束', config_data: {}, status: 'ready' } },
          ],
          edges: [
            { id: 'e-start-llm1', source: 'start-1', target: 'llm-1', type: 'smoothstep', animated: true, style: { stroke: '#818CF8', strokeWidth: 2 }, data: {} },
            { id: 'e-llm1-iteration', source: 'llm-1', target: 'iteration-1', type: 'smoothstep', animated: true, style: { stroke: '#818CF8', strokeWidth: 2 }, data: {} },
            { id: 'e-iteration-llm2', source: 'iteration-1', target: 'llm-2', type: 'smoothstep', animated: true, style: { stroke: '#818CF8', strokeWidth: 2 }, data: {} },
            { id: 'e-llm2-tipping', source: 'llm-2', target: 'tipping-1', type: 'smoothstep', animated: true, style: { stroke: '#818CF8', strokeWidth: 2 }, data: {} },
            { id: 'e-tipping-end', source: 'tipping-1', target: 'end-1', type: 'smoothstep', animated: true, style: { stroke: '#818CF8', strokeWidth: 2 }, data: {} },
          ],
        },
      };

      const config = templateConfigs[template.id];
      if (config) {
        setNodes(config.nodes);
        setEdges(config.edges);
        setName(template.name);
        setDesc(template.description);
        message.success(`已应用内置模板「${template.name}」`);
        setShowTemplates(false);
        return;
      }
    }

    try {
      const res = await duplicateWorkflow(template.base_workflow_id, template.name + ' (我的)');
      if ((res as any).success) {
        message.success(`已应用模板「${template.name}」`);
        setShowTemplates(false);
        window.location.href = `/workflow/editor?id=${(res as any).data?.new_workflow_id}`;
      }
    } catch {
      message.error('应用模板失败');
    }
  };

  const addNodeFromPanel = (type: string) => {
    const nodeType = NODE_TYPES.find(n => n.type === type);
    if (!nodeType) return;

    const viewport = reactFlowInstance?.getViewport();
    const centerX = (window.innerWidth / 2 - (viewport?.x || 0)) / (viewport?.zoom || 1);
    const centerY = (window.innerHeight / 2 - (viewport?.y || 0)) / (viewport?.zoom || 1);

    const newNode: Node = {
      id: `${type}-${Date.now()}`,
      type: 'custom',
      position: {
        x: centerX - 110 + Math.random() * 200 - 100,
        y: centerY - 40 + Math.random() * 200 - 100,
      },
      data: {
        nodeType: type,
        title: nodeType.label,
        desc: '',
        config_data: getDefaultConfig(type),
        status: 'ready',
      },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const updateNodeData = (nodeId: string, newData: Partial<CustomNodeData>) => {
    setNodes(nds =>
      nds.map(node => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: { ...node.data, ...newData },
          };
        }
        return node;
      })
    );
  };

  const deleteSelectedNode = () => {
    if (!selectedNode) return;

    Modal.confirm({
      title: '确认删除',
      content: '确定要删除该节点吗？此操作不可撤销。',
      okText: '删除',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => {
        setNodes(nds => nds.filter(n => n.id !== selectedNode));
        setEdges(eds => eds.filter(e => e.source !== selectedNode && e.target !== selectedNode));
        setSelectedNode(null);
      },
    });
  };

  const filteredNodes = useMemo(() => {
    if (!searchKeyword) return NODE_TYPES;
    return NODE_TYPES.filter(n =>
      n.label.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      n.desc.toLowerCase().includes(searchKeyword.toLowerCase())
    );
  }, [searchKeyword]);

  const currentSelectedNode = useMemo(() => {
    if (!selectedNode) return null;
    return nodes.find(n => n.id === selectedNode);
  }, [selectedNode, nodes]);

  const handleZoomIn = () => {
    reactFlowInstance?.zoomIn();
  };

  const handleZoomOut = () => {
    reactFlowInstance?.zoomOut();
  };

  const handleFitView = () => {
    reactFlowInstance?.fitView({ padding: 0.2 });
  };

  const toggleCategory = (categoryKey: string) => {
    setExpandedCategories(prev =>
      prev.includes(categoryKey)
        ? prev.filter(k => k !== categoryKey)
        : [...prev, categoryKey]
    );
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', background: '#0f0f23' }}>
      {/* 左侧节点面板 */}
      <div style={{
        width: showNodePanel ? 260 : 48,
        background: '#fff',
        borderRight: '1px solid #E5E7EB',
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 10,
      }}>
        <div style={{
          padding: '16px 12px',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 56,
        }}>
          {showNodePanel && (
            <>
              <Text strong style={{ fontSize: 14, color: '#111827' }}>节点库</Text>
              <button
                onClick={() => setShowNodePanel(!showNodePanel)}
                style={{
                  background: '#F3F4F6',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 6,
                  borderRadius: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#E5E7EB'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#F3F4F6'}
              >
                <ChevronDown size={16} color="#6B7280" style={{ transform: 'rotate(-90deg)' }} />
              </button>
            </>
          )}
        </div>

        {showNodePanel && (
          <>
            <div style={{ padding: '12px' }}>
              <Input
                placeholder="搜索节点..."
                prefix={<Search size={14} color="#9CA3AF" />}
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                allowClear
                size="middle"
                style={{
                  borderRadius: 8,
                  background: '#F9FAFB',
                }}
              />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 12px' }}>
              {NODE_CATEGORIES.map(category => {
                const categoryNodes = filteredNodes.filter(n => n.category === category.key);
                if (categoryNodes.length === 0) return null;

                const isExpanded = expandedCategories.includes(category.key);
                const CategoryIcon = category.icon;

                return (
                  <div key={category.key} style={{ marginBottom: 12 }}>
                    <button
                      onClick={() => toggleCategory(category.key)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 10px',
                        background: 'transparent',
                        border: 'none',
                        borderRadius: 8,
                        cursor: 'pointer',
                        marginBottom: 6,
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#F3F4F6';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <ChevronDown
                        size={14}
                        color="#6B7280"
                        style={{
                          transform: isExpanded ? '' : 'rotate(-90deg)',
                          transition: 'transform 0.2s ease',
                          flexShrink: 0,
                        }}
                      />
                      <CategoryIcon size={14} color={category.color} style={{ flexShrink: 0 }} />
                      <Text style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: '#374151',
                        flex: 1,
                        textAlign: 'left',
                      }}>
                        {category.label}
                      </Text>
                      <Tag
                        color={category.color}
                        style={{
                          margin: 0,
                          fontSize: 11,
                          padding: '0 6px',
                          lineHeight: '18px',
                          borderRadius: 10,
                        }}
                      >
                        {categoryNodes.length}
                      </Tag>
                    </button>

                    {isExpanded && (
                      <div style={{ paddingLeft: 8 }}>
                        {categoryNodes.map(t => (
                          <NodePaletteItem
                            key={t.type}
                            {...t}
                            onClick={() => addNodeFromPanel(t.type)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {!showNodePanel && (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            paddingTop: 12,
            gap: 8,
          }}>
            <button
              onClick={() => setShowNodePanel(true)}
              style={{
                writingMode: 'vertical-rl',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '8px 4px',
                color: '#6B7280',
                fontSize: 13,
                letterSpacing: 2,
              }}
            >
              节点库
            </button>
          </div>
        )}
      </div>

      {/* 中间主区域 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* 顶部工具栏 */}
        <div style={{
          height: 56,
          background: '#fff',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          zIndex: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Tooltip title="返回">
              <Button
                type="text"
                icon={<ArrowLeft size={18} />}
                onClick={() => window.history.back()}
                style={{
                  width: 36,
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
            </Tooltip>

            <Divider type="vertical" style={{ height: 24, margin: 0 }} />

            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="工作流名称"
              variant="borderless"
              style={{
                width: 220,
                fontWeight: 600,
                fontSize: 16,
                color: '#111827',
              }}
            />

            <Select
              value={wfType}
              onChange={(v: any) => setWfType(v)}
              options={[
                { value: 'chatflow', label: '对话型' },
                { value: 'workflow', label: '自动化流程' },
                { value: 'agent', label: '智能体编排' },
              ]}
              style={{ width: 130 }}
              size="middle"
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Space size={4}>
              <Tooltip title="撤销">
                <Button
                  type="text"
                  icon={<Undo2 size={16} />}
                  size="small"
                  disabled
                  style={{ color: '#D1D5DB' }}
                />
              </Tooltip>
              <Tooltip title="重做">
                <Button
                  type="text"
                  icon={<Redo2 size={16} />}
                  size="small"
                  disabled
                  style={{ color: '#D1D5DB' }}
                />
              </Tooltip>
            </Space>

            <Divider type="vertical" style={{ height: 24, margin: '0 8px' }} />

            <Space size={2}>
              <Tooltip title="放大">
                <Button
                  type="text"
                  icon={<ZoomIn size={16} />}
                  size="small"
                  onClick={handleZoomIn}
                />
              </Tooltip>
              <Tooltip title="缩小">
                <Button
                  type="text"
                  icon={<ZoomOut size={16} />}
                  size="small"
                  onClick={handleZoomOut}
                />
              </Tooltip>
              <Tooltip title="适应画布">
                <Button
                  type="text"
                  icon={<Maximize size={16} />}
                  size="small"
                  onClick={handleFitView}
                />
              </Tooltip>
            </Space>

            <Divider type="vertical" style={{ height: 24, margin: '0 8px' }} />

            <Button
              icon={<Sparkles size={14} />}
              onClick={loadTemplates}
              style={{
                borderRadius: 8,
                height: 36,
                fontWeight: 500,
              }}
            >
              模板库
            </Button>

            <Tooltip title="复制为JSON">
              <Button
                icon={<Copy size={14} />}
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify({ name, nodes, edges }, null, 2));
                  message.success('已复制到剪贴板');
                }}
                style={{
                  borderRadius: 8,
                  height: 36,
                }}
              />
            </Tooltip>

            <Button
              type="primary"
              icon={<Save size={14} />}
              loading={saving}
              onClick={handleSave}
              style={{
                background: '#2563EB',
                borderRadius: 8,
                height: 36,
                fontWeight: 500,
                boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
              }}
            >
              保存
            </Button>

            <Button
              type="primary"
              icon={<Play size={14} />}
              loading={executing}
              onClick={handleExecute}
              style={{
                background: '#10B981',
                borderRadius: 8,
                height: 36,
                fontWeight: 500,
                boxShadow: '0 2px 8px rgba(16,185,129,0.3)',
              }}
            >
              运行测试
            </Button>
          </div>
        </div>

        {/* Flow 编辑器 */}
        <div ref={reactFlowWrapper} style={{
          flex: 1,
          position: 'relative',
          background: 'radial-gradient(ellipse at 50% 0%, rgba(99, 102, 241, 0.12) 0%, transparent 60%), radial-gradient(ellipse at 80% 80%, rgba(139, 92, 246, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 20% 90%, rgba(59, 130, 246, 0.06) 0%, transparent 40%), #0a0a1a'
        }}>
          <style>{`
            .react-flow__node {
              transition: transform 0.2s ease, box-shadow 0.2s ease;
            }
            .react-flow__node.selected {
              z-index: 10 !important;
            }
            .react-flow__edge-path {
              stroke-dasharray: 8 4;
              animation: flowLine 0.8s linear infinite;
            }
            @keyframes flowLine {
              to { stroke-dashoffset: -12; }
            }
            .react-flow__handle {
              width: 12px !important;
              height: 12px !important;
              border: 2px solid #fff !important;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3) !important;
              transition: all 0.15s ease !important;
            }
            .react-flow__handle:hover {
              transform: scale(1.3) !important;
              box-shadow: 0 0 0 4px rgba(99,102,241,0.3) !important;
            }
            .react-flow__minimap {
              overflow: hidden !important;
            }
            .react-flow__controls-button {
              background: #1e1e3a !important;
              border-color: rgba(255,255,255,0.15) !important;
              fill: #9CA3AF !important;
            }
            .reactflow-wrapper .react-flow__background {
              background: transparent !important;
            }
          `}</style>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            onInit={setReactFlowInstance}
            fitView
            snapToGrid
            snapGrid={[15, 15]}
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            minZoom={0.1}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
          >
            <Controls
              showInteractive={false}
              style={{
                background: '#fff',
                borderRadius: 10,
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                border: '1px solid #E5E7EB',
              }}
            />

            <MiniMap
              nodeStrokeColor={(node) => {
                const nt = NODE_TYPES.find(n => n.type === (node.data as any)?.nodeType);
                return nt?.color || '#6366f1';
              }}
              nodeColor={(node) => {
                const nt = NODE_TYPES.find(n => n.type === (node.data as any)?.nodeType);
                return nt?.bg || '#f3f4f6';
              }}
              nodeStrokeWidth={2}
              maskColor="rgba(15, 15, 35, 0.8)"
              style={{
                background: '#1a1a2e',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.1)',
              }}
            />

            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1.5}
              color="rgba(255,255,255,0.06)"
            />

            <Panel
              position="top-left"
              style={{
                background: 'rgba(255,255,255,0.95)',
                backdropFilter: 'blur(10px)',
                padding: '10px 16px',
                borderRadius: 10,
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                border: '1px solid rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <LayoutGrid size={14} color="#6B7280" />
                <Text style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>
                  节点: <Text strong>{nodes.length}</Text>
                </Text>
              </div>
              <Divider type="vertical" style={{ height: 16, margin: 0 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <LinkIcon size={14} color="#6B7280" />
                <Text style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>
                  连线: <Text strong>{edges.length}</Text>
                </Text>
              </div>
            </Panel>

            {nodes.length === 0 && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none',
                zIndex: 5,
              }}>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 20,
                  padding: '48px 56px',
                  textAlign: 'center',
                  pointerEvents: 'auto',
                  animation: 'emptyStateBreathe 3s ease-in-out infinite',
                }}>
                  <div style={{
                    width: 80,
                    height: 80,
                    margin: '0 auto 24px',
                    borderRadius: 20,
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    animation: 'iconPulse 2s ease-in-out infinite',
                    border: '2px solid rgba(99, 102, 241, 0.3)',
                  }}>
                    <Zap size={40} color="#818CF8" />
                  </div>

                  <div style={{
                    fontSize: 20,
                    fontWeight: 600,
                    color: '#E2E8F0',
                    marginBottom: 12,
                    letterSpacing: '-0.02em',
                  }}>
                    开始创建你的工作流
                  </div>

                  <div style={{
                    fontSize: 14,
                    color: '#94A3B8',
                    lineHeight: 1.6,
                    marginBottom: 28,
                    maxWidth: 320,
                    margin: '0 auto 28px',
                  }}>
                    拖拽左侧节点到此处开始创建，或从模板库快速开始
                  </div>

                  <button
                    onClick={loadTemplates}
                    style={{
                      background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 10,
                      padding: '12px 28px',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      transition: 'all 0.2s ease',
                      boxShadow: '0 4px 16px rgba(99, 102, 241, 0.4)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 8px 24px rgba(99, 102, 241, 0.5)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(99, 102, 241, 0.4)';
                    }}
                  >
                    <Sparkles size={16} />
                    从模板库快速开始 →
                  </button>
                </div>
              </div>
            )}
          </ReactFlow>
        </div>
      </div>

      {/* 右侧属性面板 */}
      {currentSelectedNode && (
        <div style={{
          width: 320,
          background: '#fff',
          borderLeft: '1px solid #E5E7EB',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideInRight 0.3s ease',
        }}>
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid #E5E7EB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#FAFBFC',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Settings2 size={18} color="#6B7280" />
              <Text strong style={{ fontSize: 15, color: '#111827' }}>节点配置</Text>
            </div>
            <Space size={4}>
              <Tooltip title="删除节点">
                <Button
                  type="text"
                  danger
                  icon={<Trash2 size={16} />}
                  size="small"
                  onClick={deleteSelectedNode}
                />
              </Tooltip>
              <Button
                type="text"
                icon={<X size={16} />}
                size="small"
                onClick={() => setSelectedNode(null)}
              />
            </Space>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
            <PropertyPanel
              node={currentSelectedNode}
              onUpdate={(newData) => updateNodeData(currentSelectedNode.id, newData)}
            />
          </div>
        </div>
      )}

      {/* 模板弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sparkles size={22} color="#F59E0B" />
            <Text strong style={{ fontSize: 17 }}>工作流模板库</Text>
          </div>
        }
        open={showTemplates}
        onCancel={() => setShowTemplates(false)}
        footer={null}
        width={1100}
        centered
        styles={{
          body: { padding: '24px 24px 16px' },
          mask: { backdropFilter: 'blur(4px)' },
        }}
      >
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 20,
          marginTop: 8,
        }}>
          {templates.length === 0 ? (
            <Empty description="暂无模板" style={{ gridColumn: '1/-1' }} />
          ) : (
            templates.map(t => (
              <TemplateCard key={t.id} template={t} onApply={() => applyTemplate(t)} />
            ))
          )}
        </div>
      </Modal>

      {/* 执行结果弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Terminal size={22} color="#10B981" />
            <Text strong style={{ fontSize: 17 }}>执行结果</Text>
            {executionResult && (
              <Badge
                status={
                  executionResult.status === 'succeeded' ? 'success' :
                  executionResult.status === 'failed' ? 'error' : 'processing'
                }
                text={
                  executionResult.status === 'succeeded' ? '成功' :
                  executionResult.status === 'failed' ? '失败' : '运行中'
                }
                style={{ marginLeft: 8 }}
              />
            )}
          </div>
        }
        open={showExecutionModal}
        onCancel={() => setShowExecutionModal(false)}
        footer={[
          <Button key="close" onClick={() => setShowExecutionModal(false)}>
            关闭
          </Button>,
          <Button key="rerun" type="primary" icon={<Play size={14} />} onClick={handleExecute}>
            重新运行
          </Button>,
        ]}
        width={900}
        centered
        styles={{
          body: { padding: '20px 24px' },
        }}
      >
        {executionResult && (
          <Tabs
            defaultActiveKey="output"
            items={[
              {
                key: 'output',
                label: (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Eye size={14} /> 输出结果
                  </span>
                ),
                children: (
                  <div style={{
                    background: '#1E1E2E',
                    borderRadius: 10,
                    padding: 16,
                    maxHeight: 400,
                    overflow: 'auto',
                    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
                    fontSize: 13,
                    lineHeight: 1.6,
                    color: '#CDD6F4',
                  }}>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {JSON.stringify(executionResult.outputs, null, 2)}
                    </pre>
                  </div>
                ),
              },
              {
                key: 'stats',
                label: (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Coins size={14} /> Token消耗
                  </span>
                ),
                children: (
                  <div style={{ padding: '20px 0' }}>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: 16,
                    }}>
                      <StatCard
                        label="总Token消耗"
                        value={executionResult.total_tokens || 0}
                        icon={<Hash size={20} />}
                        color="#8B5CF6"
                      />
                      <StatCard
                        label="执行步骤数"
                        value={executionResult.total_steps || 0}
                        icon={<GitBranch size={20} />}
                        color="#3B82F6"
                      />
                      <StatCard
                        label="执行耗时"
                        value={`${((executionResult.elapsed_time_ms || 0) / 1000).toFixed(2)}s`}
                        icon={<Timer size={20} />}
                        color="#10B981"
                      />
                      <StatCard
                        label="状态"
                        value={
                          executionResult.status === 'succeeded' ? '成功' :
                          executionResult.status === 'failed' ? '失败' :
                          executionResult.status === 'running' ? '运行中' : '未知'
                        }
                        icon={
                          executionResult.status === 'succeeded' ? <CheckCircle2 size={20} /> :
                          executionResult.status === 'failed' ? <XCircle size={20} /> :
                          <Loader2 size={20} />
                        }
                        color={
                          executionResult.status === 'succeeded' ? '#10B981' :
                          executionResult.status === 'failed' ? '#EF4444' :
                          '#F59E0B'
                        }
                      />
                    </div>
                  </div>
                ),
              },
              {
                key: 'logs',
                label: (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FileText size={14} /> 执行日志
                  </span>
                ),
                children: (
                  <div style={{
                    background: '#0D0D0D',
                    borderRadius: 10,
                    padding: 16,
                    maxHeight: 350,
                    overflow: 'auto',
                    fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
                    fontSize: 12,
                    lineHeight: 1.8,
                    color: '#A0AEC0',
                  }}>
                    <div style={{ color: '#68D391' }}>
                      [{new Date(executionResult.started_at).toLocaleString()}] 工作流开始执行
                    </div>
                    <div style={{ color: '#63B3ED', marginLeft: 16 }}>
                      → 正在初始化节点...
                    </div>
                    <div style={{ color: '#63B3ED', marginLeft: 16 }}>
                      → 执行步骤 1/{executionResult.total_steps || 0}
                    </div>
                    <div style={{ color: '#68D391', marginLeft: 16 }}>
                      ✓ 所有步骤执行完成
                    </div>
                    <div style={{ color: '#F6AD55' }}>
                      [{executionResult.finished_at ? new Date(executionResult.finished_at).toLocaleString() : '...'}] 工作流执行结束，耗时 {((executionResult.elapsed_time_ms || 0) / 1000).toFixed(2)}s
                    </div>
                  </div>
                ),
              },
            ]}
          />
        )}
      </Modal>

      <style>{`
        @keyframes slideInRight {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes emptyStateBreathe {
          0%, 100% {
            opacity: 0.85;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.02);
          }
        }

        @keyframes iconPulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.4);
          }
          50% {
            box-shadow: 0 0 20px 10px rgba(99, 102, 241, 0.2);
          }
        }

        .ant-modal-content {
          border-radius: 16px !important;
          overflow: hidden;
        }

        .ant-modal-header {
          border-bottom: 1px solid #F3F4F6 !important;
          padding: 20px 24px !important;
        }

        .react-flow__controls-button {
          background: #F9FAFB !important;
          border-color: #E5E7EB !important;
          color: #6B7280 !important;
        }

        .react-flow__controls-button:hover {
          background: #F3F4F6 !important;
          color: #111827 !important;
        }

        .react-flow__minimap {
          background: #1a1a2e !important;
        }
      `}</style>
    </div>
  );
};

function StatCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) {
  return (
    <div style={{
      padding: 20,
      background: '#F9FAFB',
      borderRadius: 12,
      border: '1px solid #E5E7EB',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <Text type="secondary" style={{ fontSize: 13 }}>{label}</Text>
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: `${color}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: color,
        }}>
          {icon}
        </div>
      </div>
      <Text strong style={{ fontSize: 24, color: '#111827' }}>{value}</Text>
    </div>
  );
}

function PropertyPanel({
  node,
  onUpdate,
}: {
  node: Node<CustomNodeData>;
  onUpdate: (data: Partial<CustomNodeData>) => void;
}) {
  const nodeType = NODE_TYPES.find(n => n.type === node.data.nodeType);
  const [localData, setLocalData] = useState<CustomNodeData>(node.data);

  useEffect(() => {
    setLocalData(node.data);
  }, [node.data]);

  const handleApply = () => {
    onUpdate(localData);
    message.success('配置已更新');
  };

  const handleCancel = () => {
    setLocalData(node.data);
  };

  const updateConfig = (key: string, value: any) => {
    setLocalData(prev => ({
      ...prev,
      config_data: { ...(prev.config_data || {}), [key]: value },
    }));
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <label style={{
          display: 'block',
          fontSize: 13,
          fontWeight: 600,
          color: '#374151',
          marginBottom: 8,
        }}>
          节点名称
        </label>
        <Input
          value={localData.title || ''}
          onChange={(e) => setLocalData(prev => ({ ...prev, title: e.target.value }))}
          placeholder="输入节点名称"
          size="large"
          style={{ borderRadius: 8 }}
        />
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={{
          display: 'block',
          fontSize: 13,
          fontWeight: 600,
          color: '#374151',
          marginBottom: 8,
        }}>
          节点描述
        </label>
        <TextArea
          value={localData.desc || ''}
          onChange={(e) => setLocalData(prev => ({ ...prev, desc: e.target.value }))}
          placeholder="输入节点描述（可选）"
          rows={3}
          style={{ borderRadius: 8 }}
        />
      </div>

      <Divider style={{ margin: '24px 0' }} />

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 20,
        paddingBottom: 12,
        borderBottom: '2px solid #F3F4F6',
      }}>
        <div style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: nodeType?.bg || '#F3F4F6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {nodeType && React.createElement(nodeType.icon, { size: 16, color: nodeType.color })}
        </div>
        <Text strong style={{ fontSize: 14, color: '#111827' }}>
          {nodeType?.label || '配置选项'}
        </Text>
      </div>

      {node.data.nodeType === 'llm' && (
        <LLMConfig config={localData.config_data || {}} onChange={updateConfig} />
      )}

      {node.data.nodeType === 'knowledge_retrieval' && (
        <KnowledgeConfig config={localData.config_data || {}} onChange={updateConfig} />
      )}

      {node.data.nodeType === 'condition' && (
        <ConditionConfig config={localData.config_data || {}} onChange={updateConfig} />
      )}

      {node.data.nodeType === 'http_request' && (
        <HTTPConfig config={localData.config_data || {}} onChange={updateConfig} />
      )}

      {node.data.nodeType === 'code' && (
        <CodeConfig config={localData.config_data || {}} onChange={updateConfig} />
      )}

      {node.data.nodeType === 'tool' && (
        <ToolConfig config={localData.config_data || {}} onChange={updateConfig} />
      )}

      {node.data.nodeType === 'tipping' && (
        <TippingConfig config={localData.config_data || {}} onChange={updateConfig} />
      )}

      {node.data.nodeType === 'notification' && (
        <NotificationConfig config={localData.config_data || {}} onChange={updateConfig} />
      )}

      {node.data.nodeType === 'variable_assigner' && (
        <VariableConfig config={localData.config_data || {}} onChange={updateConfig} />
      )}

      {['start', 'end', 'iteration'].includes(node.data.nodeType) && (
        <div style={{
          textAlign: 'center',
          padding: '32px 0',
          color: '#9CA3AF',
        }}>
          <Settings2 size={40} style={{ marginBottom: 12, opacity: 0.5 }} />
          <div style={{ fontSize: 13 }}>该节点暂无额外配置项</div>
        </div>
      )}

      <Divider style={{ margin: '24px 0' }} />

      <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
        <Button onClick={handleCancel}>取消</Button>
        <Button type="primary" onClick={handleApply} style={{ background: '#2563EB' }}>
          应用更改
        </Button>
      </Space>
    </div>
  );
}

function LLMConfig({ config, onChange }: { config: Record<string, any>; onChange: (key: string, value: any) => void }) {
  return (
    <div>
      <FormField label="模型选择">
        <Select
          value={config.model || 'deepseek-chat'}
          onChange={(v) => onChange('model', v)}
          style={{ width: '100%' }}
          options={[
            { value: 'deepseek-chat', label: 'DeepSeek Chat' },
            { value: 'gpt-4', label: 'GPT-4' },
            { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
            { value: 'claude-3', label: 'Claude 3' },
            { value: 'qwen-turbo', label: '通义千问 Turbo' },
          ]}
        />
      </FormField>

      <FormField label={`Temperature (${config.temperature || 0.7})`}>
        <Slider
          min={0}
          max={2}
          step={0.1}
          value={config.temperature || 0.7}
          onChange={(v) => onChange('temperature', v)}
          marks={{
            0: '精确',
            1: '平衡',
            2: '创意',
          }}
        />
      </FormField>

      <FormField label="最大Token数">
        <InputNumber
          value={config.max_tokens || 2000}
          onChange={(v) => onChange('max_tokens', v)}
          min={100}
          max={8000}
          step={100}
          style={{ width: '100%' }}
        />
      </FormField>

      <FormField label="Prompt 模板">
        <TextArea
          value={config.prompt || ''}
          onChange={(e) => onChange('prompt', e.target.value)}
          rows={6}
          placeholder="输入你的提示词模板..."
          style={{
            fontFamily: '"SFMono-Regular", Consolas, monospace',
            fontSize: 12,
            lineHeight: 1.6,
          }}
        />
      </FormField>

      <FormField label="输出变量名">
        <Input
          value={config.output_variable || ''}
          onChange={(e) => onChange('output_variable', e.target.value)}
          placeholder="llm_output"
          prefix={<Variable size={14} />}
        />
      </FormField>
    </div>
  );
}

function KnowledgeConfig({ config, onChange }: { config: Record<string, any>; onChange: (key: string, value: any) => void }) {
  return (
    <div>
      <FormField label="查询模板">
        <TextArea
          value={config.query || ''}
          onChange={(e) => onChange('query', e.target.value)}
          rows={3}
          placeholder="{{input}}"
        />
      </FormField>

      <FormField label="分类标识">
        <Input
          value={config.category_slug || ''}
          onChange={(e) => onChange('category_slug', e.target.value)}
          placeholder="例如: faq, docs"
        />
      </FormField>

      <FormField label="返回数量 (Top-K)">
        <InputNumber
          value={config.top_k || 5}
          onChange={(v) => onChange('top_k', v)}
          min={1}
          max={20}
          style={{ width: '100%' }}
        />
      </FormField>

      <FormField label={`相似度阈值 (${config.score_threshold || 0.5})`}>
        <Slider
          min={0}
          max={1}
          step={0.05}
          value={config.score_threshold || 0.5}
          onChange={(v) => onChange('score_threshold', v)}
        />
      </FormField>
    </div>
  );
}

function ConditionConfig({ config, onChange }: { config: Record<string, any>; onChange: (key: string, value: any) => void }) {
  const conditions = config.conditions || [
    { variable: '', operator: 'equals', value: '', label: '条件1' },
    { variable: '', operator: 'equals', value: '', label: '默认' },
  ];

  const updateCondition = (index: number, field: string, value: string) => {
    const newConditions = [...conditions];
    newConditions[index] = { ...newConditions[index], [field]: value };
    onChange('conditions', newConditions);
  };

  const addCondition = () => {
    onChange('conditions', [...conditions, { variable: '', operator: 'equals', value: '', label: `条件${conditions.length + 1}` }]);
  };

  const removeCondition = (index: number) => {
    if (conditions.length <= 2) {
      message.warning('至少保留两个条件分支');
      return;
    }
    onChange('conditions', conditions.filter((_, i) => i !== index));
  };

  return (
    <div>
      <Text style={{ fontSize: 13, color: '#6B7280', marginBottom: 12, display: 'block' }}>
        配置条件分支规则
      </Text>

      {conditions.map((cond: any, index: number) => (
        <div
          key={index}
          style={{
            padding: 16,
            background: '#F9FAFB',
            borderRadius: 10,
            marginBottom: 12,
            border: '1px solid #E5E7EB',
            position: 'relative',
          }}
        >
          <div style={{
            position: 'absolute',
            top: -10,
            left: 12,
            background: '#6366F1',
            color: '#fff',
            padding: '2px 10px',
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 600,
          }}>
            {cond.label || `分支${index + 1}`}
          </div>

          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Input
              placeholder="变量名"
              value={cond.variable}
              onChange={(e) => updateCondition(index, 'variable', e.target.value)}
              prefix={<Variable size={14} />}
              size="small"
            />
            <Select
              value={cond.operator}
              onChange={(v) => updateCondition(index, 'operator', v)}
              options={[
                { value: 'equals', label: '等于' },
                { value: 'not_equals', label: '不等于' },
                { value: 'contains', label: '包含' },
                { value: 'greater_than', label: '大于' },
                { value: 'less_than', label: '小于' },
                { value: 'exists', label: '存在' },
              ]}
              size="small"
            />
            <Input
              placeholder="比较值"
              value={cond.value}
              onChange={(e) => updateCondition(index, 'value', e.target.value)}
              size="small"
            />
          </div>

          {index > 1 && (
            <Button
              type="text"
              danger
              icon={<X size={14} />}
              size="small"
              onClick={() => removeCondition(index)}
              style={{ position: 'absolute', top: -10, right: 8 }}
            />
          )}
        </div>
      ))}

      <Button
        type="dashed"
        icon={<Plus size={14} />}
        onClick={addCondition}
        block
        style={{ borderRadius: 8, borderColor: '#6366F1', color: '#6366F1' }}
      >
        添加条件分支
      </Button>
    </div>
  );
}

function HTTPConfig({ config, onChange }: { config: Record<string, any>; onChange: (key: string, value: any) => void }) {
  return (
    <div>
      <FormField label="请求方法">
        <Select
          value={config.method || 'GET'}
          onChange={(v) => onChange('method', v)}
          style={{ width: '100%' }}
          options={[
            { value: 'GET', label: 'GET' },
            { value: 'POST', label: 'POST' },
            { value: 'PUT', label: 'PUT' },
            { value: 'DELETE', label: 'DELETE' },
            { value: 'PATCH', label: 'PATCH' },
          ]}
        />
      </FormField>

      <FormField label="请求URL">
        <Input
          value={config.url || ''}
          onChange={(e) => onChange('url', e.target.value)}
          placeholder="https://api.example.com/endpoint"
          prefix={<Globe size={14} />}
        />
      </FormField>

      <FormField label="Headers (JSON)">
        <TextArea
          value={typeof config.headers === 'string' ? config.headers : JSON.stringify(config.headers || {}, null, 2)}
          onChange={(e) => {
            try {
              onChange('headers', JSON.parse(e.target.value));
            } catch {
              onChange('headers', e.target.value);
            }
          }}
          rows={4}
          placeholder='{"Authorization": "Bearer xxx"}'
          style={{ fontFamily: 'monospace', fontSize: 12 }}
        />
      </FormField>

      {(config.method === 'POST' || config.method === 'PUT' || config.method === 'PATCH') && (
        <FormField label="Request Body (JSON)">
          <TextArea
            value={typeof config.body === 'string' ? config.body : JSON.stringify(config.body || {}, null, 2)}
            onChange={(e) => {
              try {
                onChange('body', JSON.parse(e.target.value));
              } catch {
                onChange('body', e.target.value);
              }
            }}
            rows={4}
            placeholder='{"key": "value"}'
            style={{ fontFamily: 'monospace', fontSize: 12 }}
          />
        </FormField>
      )}

      <FormField label="超时时间 (秒)">
        <InputNumber
          value={config.timeout || 30}
          onChange={(v) => onChange('timeout', v)}
          min={5}
          max={120}
          style={{ width: '100%' }}
        />
      </FormField>
    </div>
  );
}

function CodeConfig({ config, onChange }: { config: Record<string, any>; onChange: (key: string, value: any) => void }) {
  return (
    <div>
      <FormField label="编程语言">
        <Select
          value={config.language || 'python'}
          onChange={(v) => onChange('language', v)}
          style={{ width: '100%' }}
          options={[
            { value: 'python', label: 'Python' },
            { value: 'javascript', label: 'JavaScript' },
            { value: 'typescript', label: 'TypeScript' },
            { value: 'java', label: 'Java' },
            { value: 'go', label: 'Go' },
          ]}
        />
      </FormField>

      <FormField label="代码编辑器">
        <div style={{
          position: 'relative',
          border: '1px solid #D1D5DB',
          borderRadius: 8,
          overflow: 'hidden',
        }}>
          <div style={{
            background: '#1E1E2E',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #313244',
          }}>
            <Tag color={config.language === 'python' ? '#3776AB' : '#F7DF1E'} style={{ margin: 0 }}>
              {config.language || 'python'}
            </Tag>
            <Text style={{ fontSize: 11, color: '#A6ADC8' }}>代码执行</Text>
          </div>
          <TextArea
            value={config.code || ''}
            onChange={(e) => onChange('code', e.target.value)}
            rows={12}
            style={{
              fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
              fontSize: 12,
              lineHeight: 1.6,
              background: '#1E1E2E',
              color: '#CDD6F4',
              border: 'none',
              resize: 'vertical',
            }}
            placeholder="# 在此编写代码..."
          />
        </div>
      </FormField>
    </div>
  );
}

function ToolConfig({ config, onChange }: { config: Record<string, any>; onChange: (key: string, value: any) => void }) {
  return (
    <div>
      <FormField label="工具名称">
        <Select
          value={config.tool_name || ''}
          onChange={(v) => onChange('tool_name', v)}
          style={{ width: '100%' }}
          options={[
            { value: 'web_search', label: '网页搜索' },
            { value: 'calculator', label: '计算器' },
            { value: 'weather', label: '天气查询' },
            { value: 'email_sender', label: '邮件发送' },
            { value: 'file_processor', label: '文件处理' },
          ]}
          placeholder="选择要调用的工具"
        />
      </FormField>

      <FormField label="参数配置 (JSON)">
        <TextArea
          value={typeof config.params === 'string' ? config.params : JSON.stringify(config.params || {}, null, 2)}
          onChange={(e) => {
            try {
              onChange('params', JSON.parse(e.target.value));
            } catch {
              onChange('params', e.target.value);
            }
          }}
          rows={5}
          placeholder='{"query": "搜索关键词"}'
          style={{ fontFamily: 'monospace', fontSize: 12 }}
        />
      </FormField>
    </div>
  );
}

function TippingConfig({ config, onChange }: { config: Record<string, any>; onChange: (key: string, value: any) => void }) {
  return (
    <div>
      <FormField label="创作者ID">
        <Input
          value={config.creator_id || ''}
          onChange={(e) => onChange('creator_id', e.target.value)}
          placeholder="输入创作者ID"
          prefix={<UserCheck size={14} />}
        />
      </FormField>

      <FormField label="打赏金额">
        <InputNumber
          value={config.amount || 5}
          onChange={(v) => onChange('amount', v)}
          min={1}
          max={10000}
          prefix="¥"
          style={{ width: '100%' }}
        />
      </FormField>

      <FormField label="留言消息">
        <TextArea
          value={config.message || ''}
          onChange={(e) => onChange('message', e.target.value)}
          rows={3}
          placeholder="感谢您的支持！"
        />
      </FormField>
    </div>
  );
}

function NotificationConfig({ config, onChange }: { config: Record<string, any>; onChange: (key: string, value: any) => void }) {
  return (
    <div>
      <FormField label="通知渠道">
        <Select
          value={config.channel || 'system'}
          onChange={(v) => onChange('channel', v)}
          style={{ width: '100%' }}
          options={[
            { value: 'system', label: '系统通知' },
            { value: 'email', label: '邮件通知' },
            { value: 'sms', label: '短信通知' },
            { value: 'wechat', label: '微信通知' },
            { value: 'webhook', label: 'Webhook' },
          ]}
        />
      </FormField>

      <FormField label="消息模板">
        <Input
          value={config.template || ''}
          onChange={(e) => onChange('template', e.target.value)}
          placeholder="notification_template_001"
        />
      </FormField>

      <FormField label="接收者列表">
        <Select
          mode="tags"
          value={config.recipients || []}
          onChange={(v) => onChange('recipients', v)}
          style={{ width: '100%' }}
          placeholder="输入接收者ID，按回车添加"
        />
      </FormField>
    </div>
  );
}

function VariableConfig({ config, onChange }: { config: Record<string, any>; onChange: (key: string, value: any) => void }) {
  return (
    <div>
      <FormField label="变量名">
        <Input
          value={config.variable_name || ''}
          onChange={(e) => onChange('variable_name', e.target.value)}
          placeholder="my_variable"
          prefix={<Variable size={14} />}
        />
      </FormField>

      <FormField label="表达式/值">
        <TextArea
          value={config.expression || ''}
          onChange={(e) => onChange('expression', e.target.value)}
          rows={4}
          placeholder="支持变量引用: {{node_output.variable}}"
          style={{ fontFamily: 'monospace', fontSize: 12 }}
        />
      </FormField>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{
        display: 'block',
        fontSize: 13,
        fontWeight: 600,
        color: '#374151',
        marginBottom: 8,
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function NodePaletteItem({ type, label, icon: Icon, color, bg, desc, onClick }: typeof NODE_TYPES[0] & { onClick: () => void }) {
  const onDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/reactflow', type);
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        background: '#fff',
        border: '1px solid #E5E7EB',
        borderRadius: 8,
        cursor: 'grab',
        marginBottom: 8,
        transition: 'all 0.2s ease',
        userSelect: 'none',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = color;
        e.currentTarget.style.boxShadow = `0 4px 12px ${color}20`;
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#E5E7EB';
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div style={{
        width: 32,
        height: 32,
        borderRadius: 8,
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        border: `1.5px solid ${color}30`,
      }}>
        <Icon size={16} color={color} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13,
          fontWeight: 500,
          color: '#111827',
          marginBottom: 2,
        }}>
          {label}
        </div>
        <div style={{
          fontSize: 11,
          color: '#9CA3AF',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {desc}
        </div>
      </div>
    </div>
  );
}

function TemplateCard({ template, onApply }: { template: WorkflowTemplateItem; onApply: () => void }) {
  return (
    <Card
      hoverable
      onClick={onApply}
      style={{
        borderRadius: 14,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
      }}
      styles={{ body: { padding: 0 } }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.12)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
      }}
    >
      <div style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: `${template.icon_color || '#6366F1'}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            border: `2px solid ${template.icon_color || '#6366F1'}30`,
          }}>
            <Zap size={26} color={template.icon_color || '#6366F1'} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Title level={5} style={{ margin: 0, marginBottom: 6, fontSize: 16 }}>
              {template.name}
            </Title>
            <Text type="secondary" style={{
              fontSize: 13,
              lineHeight: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>
              {template.description}
            </Text>
          </div>
        </div>

        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 16,
        }}>
          <Tag
            color={
              template.difficulty === 'beginner' ? 'green' :
              template.difficulty === 'intermediate' ? 'orange' : 'red'
            }
            style={{
              borderRadius: 12,
              padding: '2px 10px',
              fontSize: 12,
            }}
          >
            {template.difficulty === 'beginner' ? '入门级' :
             template.difficulty === 'intermediate' ? '进阶级' : '专家级'}
          </Tag>
          <Tag style={{ borderRadius: 12, padding: '2px 10px', fontSize: 12 }}>
            <LayoutGrid size={12} style={{ marginRight: 4 }} />
            {template.node_count} 个节点
          </Tag>
          <Tag style={{ borderRadius: 12, padding: '2px 10px', fontSize: 12 }}>
            <Send size={12} style={{ marginRight: 4 }} />
            {template.use_count} 次使用
          </Tag>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 16,
          borderTop: '1px solid #F3F4F6',
        }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            类型: {template.workflow_type || '通用'}
          </Text>
          <Button
            type="primary"
            ghost
            size="small"
            icon={<Plus size={14} />}
            style={{
              borderRadius: 8,
              color: template.icon_color || '#6366F1',
              borderColor: template.icon_color || '#6366F1',
            }}
          >
            使用模板
          </Button>
        </div>
      </div>
    </Card>
  );
}

function getDefaultConfig(type: string): Record<string, any> {
  switch (type) {
    case 'llm':
      return {
        model: 'deepseek-chat',
        temperature: 0.7,
        max_tokens: 2000,
        prompt: '请根据以下内容进行智能分析：\n\n{{input}}\n\n请给出专业、详细的回答。',
        output_variable: 'llm_output',
      };
    case 'knowledge_retrieval':
      return {
        query: '{{input}}',
        category_slug: '',
        top_k: 5,
        score_threshold: 0.5,
      };
    case 'condition':
      return {
        conditions: [
          { variable: '', operator: 'equals', value: '', label: '是' },
          { variable: '', operator: 'equals', value: '', label: '否' },
        ],
      };
    case 'iteration':
      return {
        iterate_variable: '',
        max_iterations: 10,
        break_condition: '',
      };
    case 'http_request':
      return {
        method: 'GET',
        url: '',
        headers: {},
        body: {},
        timeout: 30,
      };
    case 'code':
      return {
        language: 'python',
        code: '# 在此编写 Python 代码\nresult = "hello world"\nprint(result)',
      };
    case 'tool':
      return {
        tool_name: '',
        params: {},
      };
    case 'tipping':
      return {
        creator_id: '',
        amount: 5,
        message: '感谢支持！',
      };
    case 'notification':
      return {
        channel: 'system',
        template: '',
        recipients: [],
      };
    case 'variable_assigner':
      return {
        variable_name: '',
        expression: '',
      };
    case 'start':
      return {
        input_schema: {},
      };
    case 'end':
      return {
        output_mapping: {},
      };
    default:
      return {};
  }
}

const WorkflowEditor: React.FC<WorkflowEditorProps> = (props) => {
  return (
    <ReactFlowProvider>
      <WorkflowEditorContent {...props} />
    </ReactFlowProvider>
  );
};

export default WorkflowEditor;
