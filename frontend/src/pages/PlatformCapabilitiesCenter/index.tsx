import * as React from 'react';
import {
  Card,
  Button,
  Tag,
  Select,
  Input,
  Modal,
  Spin,
  message,
  Space,
  Tooltip,
} from 'antd';
import {
  RobotOutlined,
  ApiOutlined,
  ThunderboltOutlined,
  DatabaseOutlined,
  CompressOutlined,
  CloudServerOutlined,
  ExperimentOutlined,
  EyeOutlined,
  CodeOutlined,
  SendOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  FilterOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
  FileSearchOutlined,
  TeamOutlined,
  DashboardOutlined,
  HistoryOutlined,
  GlobalOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { PLATFORM_CAPABILITIES } from '@/data/skillMatrix';
import { platformApi } from '@/api/platformApi';
import styles from './index.module.css';

const { TextArea } = Input;
const { Option } = Select;

// ====== 类型定义 ======
interface CapabilityItem {
  id: number;
  name: string;
  category: string;
  mainScenario: string;
  keywords: string[];
  weight: number;
  devDays: number;
  monetizationType: string;
  tier: string;
  icon?: string;
  color?: string;
}

// 扩展能力项（用于页面展示）
interface ExtendedCapability extends CapabilityItem {
  nameEn?: string;
  description?: string;
  apiEndpoint?: string;
  version?: string;
  capabilityType?: 'detect' | 'agent' | 'compress' | 'runtime';
  colorHex?: string;
  method?: string;
}

// ====== 分类配置 ======
const CATEGORY_CONFIG = [
  { key: 'all', label: '全部', icon: <DashboardOutlined />, color: '#86caff' },
  { key: 'detect', label: '检测能力', icon: <SafetyCertificateOutlined />, color: '#f5a623' },
  { key: 'agent', label: 'Agent调用', icon: <RobotOutlined />, color: '#667eea' },
  { key: 'compress', label: '压缩服务', icon: <CompressOutlined />, color: '#00b42a' },
  { key: 'runtime', label: '运行时', icon: <CloudServerOutlined />, color: '#c4b5fd' },
];

// ====== API 端点数据 ======
const API_ENDPOINTS = [
  { method: 'GET' as const, path: '/api/platform/v1/capabilities/', desc: '获取所有平台能力列表（含 Schema）', methodColor: 'get' },
  { method: 'POST' as const, path: '/api/platform/v1/capabilities/detect/', desc: '触发四Agent完整检测流程', methodColor: 'post' },
  { method: 'POST' as const, path: '/api/platform/v1/capabilities/call-agent/', desc: '调用单个 Agent（auditor/verifier/archiver/judge）', methodColor: 'post' },
  { method: 'POST' as const, path: '/api/platform/v1/capabilities/compress/', desc: '上下文智能压缩服务', methodColor: 'post' },
  { method: 'GET' as const, path: '/api/platform/v1/capabilities/{id}/', desc: '获取单个能力详情 + 调用示例', methodColor: 'get' },
  { method: 'GET' as const, path: '/api/platform/v1/capabilities/openrath-info/', desc: 'OpenRath 运行时信息（stats/list_agents/graph_info）', methodColor: 'get' },
];

// ====== 场景选项 ======
const SCENARIO_OPTIONS = [
  { value: 'ai_text_detect', label: 'AI文案鉴别' },
  { value: 'ai_image_detect', label: 'AI图片鉴别' },
  { value: 'ai_code_detect', label: 'AI代码鉴别' },
  { value: 'ai_paper_detect', label: 'AI论文鉴别' },
  { value: 'general', label: '通用场景' },
];

const AGENT_OPTIONS = [
  { value: 'auditor', label: 'auditor - 内容审核员' },
  { value: 'verifier', label: 'verifier - 事实核查官' },
  { value: 'archiver', label: 'archiver - 数字取证员' },
  { value: 'judge', label: 'judge - 裁决官' },
];

// ====== 将 PLATFORM_CAPABILITIES 转换为扩展格式 ======
const getExtendedCapabilities = (): ExtendedCapability[] => {
  const typeMap: Record<number, { type: ExtendedCapability['capabilityType']; nameEn: string; desc: string; endpoint: string; version: string; color: string; method: string }> = {
    201: { type: 'detect', nameEn: 'Multi-Agent Detection Engine', desc: '基于 OpenRath Runtime 的四Agent多维协同检测引擎，支持 Session Graph 串行工作流，提供 SSE 流式实时推送能力。通过内容审核员、事实核查官、数字取证员、裁决官四个专业 Agent 协同分析。', endpoint: '/api/platform/v1/capabilities/detect/', version: 'v2.1.0', color: '#f5a623', method: 'POST' },
    202: { type: 'runtime', nameEn: 'SSE Streaming Push', desc: 'Server-Sent Events 流式实时推送检测进度与结果，支持逐 Agent 推送、事件驱动架构，实现毫秒级响应的实时反馈体验。', endpoint: '/api/platform/v1/capabilities/detect/?stream=true', version: 'v1.5.0', color: '#c4b5fd', method: 'POST' },
    203: { type: 'runtime', nameEn: 'Session Persistence', desc: '会话历史持久化管理服务，支持消息检索、Session 持久化存储，确保刷新不丢失对话状态，支持多端同步。', endpoint: '/api/platform/v1/capabilities/sessions/', version: 'v1.3.0', color: '#c4b5fd', method: 'GET' },
    204: { type: 'detect', nameEn: 'HTML Report Export', desc: '一键导出 HTML 格式检测报告，包含安全等级徽章、四Agent 详细分析结果、改进建议等完整信息，支持离线查看。', endpoint: '/api/platform/v1/capabilities/report/{sessionId}/', version: 'v1.8.0', color: '#f5a623', method: 'GET' },
    205: { type: 'runtime', nameEn: 'OpenRath Multi-Agent Runtime', desc: 'OpenRath 多智能体运行时核心引擎，Session 一等公民设计、可插拔沙箱、可插拔记忆系统、动态路由调度、完整复现支持。', endpoint: '/api/platform/v1/capabilities/openrath-info/', version: 'v3.2.0', color: '#c4b5fd', method: 'GET' },
    206: { type: 'agent', nameEn: 'Agent: Auditor', desc: '独立调用内容审核员 Agent，执行敏感词检测、合规审查、内容安全评估等任务，支持自定义审核规则和阈值配置。', endpoint: '/api/platform/v1/capabilities/call-agent/', version: 'v2.0.0', color: '#667eea', method: 'POST' },
    207: { type: 'agent', nameEn: 'Agent: Verifier', desc: '独立调用事实核查官 Agent，进行来源追溯、时间线分析、事实真伪验证，支持多源交叉比对。', endpoint: '/api/platform/v1/capabilities/call-agent/', version: 'v2.0.0', color: '#667eea', method: 'POST' },
    208: { type: 'agent', nameEn: 'Agent: Archiver', desc: '独立调用数字取证员 Agent，执行元数据分析、模式识别、数字指纹提取等取证任务。', endpoint: '/api/platform/v1/capabilities/call-agent/', version: 'v2.0.0', color: '#667eea', method: 'POST' },
    209: { type: 'agent', nameEn: 'Agent: Judge', desc: '独立调用裁决官 Agent，综合四Agent 分析结果进行最终裁决仲裁，输出风险评估报告和建议措施。', endpoint: '/api/platform/v1/capabilities/call-agent/', version: 'v2.0.0', color: '#667eea', method: 'POST' },
    210: { type: 'compress', nameEn: 'Context Compressor', desc: '上下文智能压缩服务（Compressor），自动生成历史摘要、优化 Token 使用量，支持保留最近 N 轮对话策略。', endpoint: '/api/platform/v1/capabilities/compress/', version: 'v1.6.0', color: '#00b42a', method: 'POST' },
    211: { type: 'runtime', nameEn: 'Session Graph Lineage', desc: 'Session Graph 血缘追踪系统，记录 Fork 关系、完整执行链路、支持 JSONL 导出用于离线分析和审计追溯。', endpoint: '/api/platform/v1/capabilities/session-graph/', version: 'v1.4.0', color: '#c4b5fd', method: 'GET' },
    212: { type: 'runtime', nameEn: 'Dynamic Router & Replay', desc: '动态路由与完整复现引擎，支持智能负载均衡、故障转移、全链路复现导出为 JSONL 格式供离线深度分析。', endpoint: '/api/platform/v1/capabilities/replay/', version: 'v1.9.0', color: '#c4b5fd', method: 'POST' },
  };

  return PLATFORM_CAPABILITIES.map((item) => {
    const ext = typeMap[item.id] || { type: 'runtime' as const, nameEn: '', desc: item.name, endpoint: '', version: 'v1.0.0', color: '#c4b5fd', method: 'GET' };
    return {
      ...item,
      nameEn: ext.nameEn,
      description: ext.desc,
      apiEndpoint: ext.endpoint,
      version: ext.version,
      capabilityType: ext.type,
      colorHex: ext.color,
      method: ext.method,
    };
  });
};

// ====== 分类统计数据 ======
const getCategoryStats = () => ({
  detect: getExtendedCapabilities().filter(c => c.capabilityType === 'detect').length,
  agent: getExtendedCapabilities().filter(c => c.capabilityType === 'agent').length,
  compress: getExtendedCapabilities().filter(c => c.capabilityType === 'compress').length,
  runtime: getExtendedCapabilities().filter(c => c.capabilityType === 'runtime').length,
});

// ====== 图标映射 ======
const getIconByCategory = (type?: string): React.ReactNode => {
  switch (type) {
    case 'detect': return <SafetyCertificateOutlined />;
    case 'agent': return <RobotOutlined />;
    case 'compress': return <CompressOutlined />;
    case 'runtime':
    default: return <CloudServerOutlined />;
  }
};

const getIconForStatCard = (key: string): React.ReactNode => {
  switch (key) {
    case 'detect': return <FileSearchOutlined />;
    case 'agent': return <TeamOutlined />;
    case 'compress': return <CompressOutlined />;
    case 'runtime': return <CloudServerOutlined />;
    default: return <DashboardOutlined />;
  }
};

// ====== 主组件 ======
const PlatformCapabilitiesCenter: React.FC = () => {
  const [activeFilter, setActiveFilter] = React.useState<string>('all');
  const [tryItVisible, setTryItVisible] = React.useState(false);
  const [detailVisible, setDetailVisible] = React.useState(false);
  const [selectedCapability, setSelectedCapability] = React.useState<ExtendedCapability | null>(null);

  // Try-It 表单状态
  const [tryItLoading, setTryItLoading] = React.useState(false);
  const [tryItResult, setTryItResult] = React.useState<string>('');
  const [formData, setFormData] = React.useState<Record<string, string>>({
    message: '',
    scenario: 'general',
    agent_code: 'auditor',
    messages: '',
    max_tokens: '4096',
    keep_recent: '5',
  });

  // 数据加载状态
  const [loading, setLoading] = React.useState(false);

  const allCapabilities = React.useMemo(() => getExtendedCapabilities(), []);
  const categoryStats = React.useMemo(() => getCategoryStats(), []);

  const filteredCapabilities = React.useMemo(() => {
    if (activeFilter === 'all') return allCapabilities;
    return allCapabilities.filter(c => c.capabilityType === activeFilter);
  }, [allCapabilities, activeFilter]);

  // 处理在线调试按钮点击
  const handleTryIt = (cap: ExtendedCapability) => {
    setSelectedCapability(cap);
    setTryItResult('');
    setFormData({
      message: '',
      scenario: 'general',
      agent_code: 'auditor',
      messages: '[{"role": "user", "content": "示例消息"}]',
      max_tokens: '4096',
      keep_recent: '5',
    });
    setTryItVisible(true);
  };

  // 处理查看详情按钮点击
  const handleViewDetail = (cap: ExtendedCapability) => {
    setSelectedCapability(cap);
    setDetailVisible(true);
  };

  // 提交调试请求
  const handleSubmitTryIt = async () => {
    if (!selectedCapability) return;

    const capType = selectedCapability.capabilityType;

    // 表单校验
    if (capType === 'detect' && !formData.message.trim()) {
      message.warning('请输入待检测的内容');
      return;
    }
    if (capType === 'agent' && !formData.message.trim()) {
      message.warning('请输入发送给 Agent 的消息');
      return;
    }
    if (capType === 'compress' && !formData.messages.trim()) {
      message.warning('请输入要压缩的消息历史（JSON 格式）');
      return;
    }

    setTryItLoading(true);
    setTryItResult('');

    try {
      let result: unknown;

      switch (capType) {
        case 'detect': {
          result = await platformApi.detect({
            message: formData.message,
            scenario: formData.scenario !== 'general' ? formData.scenario : undefined,
          });
          break;
        }
        case 'agent': {
          result = await platformApi.callAgent({
            agent_code: formData.agent_code as CallAgentRequest['agent_code'],
            message: formData.message,
            scenario: formData.scenario !== 'general' ? formData.scenario : undefined,
          });
          break;
        }
        case 'compress': {
          let parsedMessages: Array<{ role: string; content: string }>;
          try {
            parsedMessages = JSON.parse(formData.messages);
          } catch {
            throw new Error('消息历史 JSON 格式错误');
          }
          result = await platformApi.compress({
            messages: parsedMessages,
            max_tokens: parseInt(formData.max_tokens) || undefined,
            keep_recent: parseInt(formData.keep_recent) || undefined,
          });
          break;
        }
        default:
          result = await platformApi.getOpenRathInfo('stats');
          break;
      }

      setTryItResult(JSON.stringify(result, null, 2));
      message.success('请求成功');
    } catch (err: any) {
      const errMsg = err?.message || err?.response?.data?.message || '请求失败，请稍后重试';
      setTryItResult(JSON.stringify({ error: errMsg }, null, 2));
      message.error(errMsg);
    } finally {
      setTryItLoading(false);
    }
  };

  // 渲染 Try-It 动态表单
  const renderTryItForm = () => {
    if (!selectedCapability) return null;

    const capType = selectedCapability.capabilityType;

    return (
      <div className={styles.tryItForm}>
        {/* detect 类型表单 */}
        {capType === 'detect' && (
          <>
            <div className={styles.formItem}>
              <label className={styles.formItemLabel}>待检测内容</label>
              <TextArea
                className={styles.textareaStyle}
                value={formData.message}
                onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                placeholder="请输入需要检测的文本内容..."
                rows={5}
              />
            </div>
            <div className={styles.formItem}>
              <label className={styles.formItemLabel}>检测场景</label>
              <Select
                value={formData.scenario}
                onChange={(val) => setFormData(prev => ({ ...prev, scenario: val }))}
                className={styles.selectWrapper}
                popupMatchSelectWidth={false}
              >
                {SCENARIO_OPTIONS.map(opt => (
                  <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                ))}
              </Select>
            </div>
          </>
        )}

        {/* agent 类型表单 */}
        {capType === 'agent' && (
          <>
            <div className={styles.formItem}>
              <label className={styles.formItemLabel}>选择 Agent</label>
              <Select
                value={formData.agent_code}
                onChange={(val) => setFormData(prev => ({ ...prev, agent_code: val }))}
                className={styles.selectWrapper}
                popupMatchSelectWidth={false}
              >
                {AGENT_OPTIONS.map(opt => (
                  <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                ))}
              </Select>
            </div>
            <div className={styles.formItem}>
              <label className={styles.formItemLabel}>消息内容</label>
              <TextArea
                className={styles.textareaStyle}
                value={formData.message}
                onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                placeholder="请输入发送给 Agent 的消息..."
                rows={5}
              />
            </div>
            <div className={styles.formItem}>
              <label className={styles.formItemLabel}>应用场景</label>
              <Select
                value={formData.scenario}
                onChange={(val) => setFormData(prev => ({ ...prev, scenario: val }))}
                className={styles.selectWrapper}
                popupMatchSelectWidth={false}
              >
                {SCENARIO_OPTIONS.map(opt => (
                  <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                ))}
              </Select>
            </div>
          </>
        )}

        {/* compress 类型表单 */}
        {capType === 'compress' && (
          <>
            <div className={styles.formItem}>
              <label className={styles.formItemLabel}>消息历史 (JSON)</label>
              <TextArea
                className={styles.textareaStyle}
                value={formData.messages}
                onChange={(e) => setFormData(prev => ({ ...prev, messages: e.target.value }))}
                placeholder='[{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]'
                rows={6}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className={styles.formItem}>
                <label className={styles.formItemLabel}>最大 Token 数</label>
                <Input
                  type="number"
                  className={`${styles.inputNumberStyle}`}
                  value={formData.max_tokens}
                  onChange={(e) => setFormData(prev => ({ ...prev, max_tokens: e.target.value }))}
                  placeholder="4096"
                />
              </div>
              <div className={styles.formItem}>
                <label className={styles.formItemLabel}>保留最近轮次</label>
                <Input
                  type="number"
                  className={`${styles.inputNumberStyle}`}
                  value={formData.keep_recent}
                  onChange={(e) => setFormData(prev => ({ ...prev, keep_recent: e.target.value }))}
                  placeholder="5"
                />
              </div>
            </div>
          </>
        )}

        {/* runtime 类型：显示运行时信息查询 */}
        {capType === 'runtime' && (
          <div className={styles.formItem}>
            <label className={styles.formItemLabel}>操作说明</label>
            <div style={{
              padding: '14px 16px',
              borderRadius: 10,
              background: 'rgba(102, 126, 234, 0.06)',
              border: '1px solid rgba(102, 126, 234, 0.12)',
              fontSize: 13,
              color: '#8892a6',
              lineHeight: 1.7,
            }}>
              运行时能力属于基础设施层，不支持直接参数化调试。
              点击下方按钮将调用 <code style={{ color: '#86caff', background: 'rgba(102,126,234,0.1)', padding: '2px 6px', borderRadius: 4 }}>openrath-info</code> 接口获取当前运行时统计信息，
              包括适配器版本、可用 Agent 列表、支持的场景等。
            </div>
          </div>
        )}

        {/* 提交按钮 */}
        <Button
          type="primary"
          icon={<SendOutlined />}
          loading={tryItLoading}
          className={styles.submitBtn}
          onClick={handleSubmitTryIt}
        >
          发送请求
        </Button>

        {/* 结果展示区 */}
        {(tryItResult || tryItLoading) && (
          <div className={styles.resultSection}>
            <div className={styles.resultLabel}>
              <CodeOutlined /> 响应结果
            </div>
            <Spin spinning={tryItLoading} tip="处理中...">
              <pre className={styles.resultContainer}>
                {tryItLoading ? '正在请求中...' : tryItResult}
              </pre>
            </Spin>
          </div>
        )}
      </div>
    );
  };

  // 统计卡片数据
  const statCards = [
    { key: 'detect', label: '检测能力', value: categoryStats.detect, icon: getIconForStatCard('detect'), bg: 'rgba(245,166,35,0.12)', color: '#f5a623' },
    { key: 'agent', label: 'Agent调用', value: categoryStats.agent, icon: getIconForStatCard('agent'), bg: 'rgba(102,126,234,0.12)', color: '#667eea' },
    { key: 'compress', label: '压缩服务', value: categoryStats.compress, icon: getIconForStatCard('compress'), bg: 'rgba(0,180,42,0.12)', color: '#00b42a' },
    { key: 'runtime', label: '运行时', value: categoryStats.runtime, icon: getIconForStatCard('runtime'), bg: 'rgba(168,85,247,0.12)', color: '#c4b5fd' },
  ];

  return (
    <div className={styles.capabilitiesCenter}>
      {/* ====== Hero 区域 ====== */}
      <div className={styles.heroSection}>
        <div className={styles.heroBgGlow} />
        <div className={styles.heroBgGlowSecondary} />
        <div className={styles.heroContent}>
          <div className={styles.heroLeft}>
            <div className={styles.heroTag}>
              <span className={styles.heroTagDot} />
              OpenRath Runtime 驱动
            </div>
            <h1 className={styles.heroTitle}>平台能力中心</h1>
            <p className={styles.heroSubtitle}>
              基于 OpenRath Runtime 的统一能力调用接口，提供检测、Agent调用、压缩、运行时四大类核心能力
            </p>
          </div>

          {/* 关键指标卡片 */}
          <div className={styles.heroMetrics}>
            <motion.div
              className={styles.heroMetricCard}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
            >
              <div className={styles.heroMetricIconWrap} style={{ background: 'rgba(102,126,234,0.15)', color: '#667eea' }}>
                <ThunderboltOutlined />
              </div>
              <div>
                <div className={styles.heroMetricValue}>{allCapabilities.length}</div>
                <div className={styles.heroMetricLabel}>能力总数</div>
              </div>
            </motion.div>

            <motion.div
              className={styles.heroMetricCard}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25, type: 'spring', stiffness: 200 }}
            >
              <div className={styles.heroMetricIconWrap} style={{ background: 'rgba(0,180,42,0.15)', color: '#00b42a' }}>
                <ApiOutlined />
              </div>
              <div>
                <div className={styles.heroMetricValue}>{API_ENDPOINTS.length}</div>
                <div className={styles.heroMetricLabel}>API 端点</div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* ====== 分类统计卡片行 ====== */}
      <div className={styles.statsRow}>
        {statCards.map((card, idx) => (
          <motion.div
            key={card.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08, duration: 0.4 }}
          >
            <div className={styles.statCard}>
              <div className={styles.statCardHeader}>
                <div className={styles.statIconWrap} style={{ background: card.bg, color: card.color }}>
                  {card.icon}
                </div>
                <span className={styles.statLabel}>{card.label}</span>
              </div>
              <div className={styles.statValue}>{card.value}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ====== 分类标签筛选器 ====== */}
      <div className={styles.filterSection}>
        <div className={styles.filterLabel}>
          <FilterOutlined /> 能力分类筛选
        </div>
        <div className={styles.filterGroup}>
          {CATEGORY_CONFIG.map(cat => (
            <button
              key={cat.key}
              className={`${styles.filterBtn} ${activeFilter === cat.key ? styles.active : ''}`}
              onClick={() => setActiveFilter(cat.key)}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
          <span className={styles.filterCount}>
            共 {filteredCapabilities.length} 项
          </span>
        </div>
      </div>

      {/* ====== 能力卡片网格 ====== */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeFilter}
          className={styles.capabilitiesGrid}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.3 }}
        >
          {filteredCapabilities.map((cap, idx) => (
            <motion.div
              key={cap.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.35 }}
              whileHover={{ y: -5, boxShadow: `0 12px 40px ${cap.colorHex || '#667eea'}20` }}
            >
              <div
                className={styles.capabilityCard}
                style={
                  {
                    '--card-accent': cap.colorHex || '#667eea',
                    '--card-accent-secondary': cap.capabilityType === 'detect' ? '#f5a623'
                      : cap.capabilityType === 'agent' ? '#764ba2'
                      : cap.capabilityType === 'compress' ? '#00b42a'
                      : '#a855f7',
                    '--card-glow': `${cap.colorHex || '#667eea'}15`,
                  } as React.CSSProperties
                }
              >
                {/* 卡片头部 */}
                <div className={styles.cardHeader}>
                  <div
                    className={styles.cardIconWrap}
                    style={{
                      background: `${cap.colorHex || '#667eea'}18`,
                      color: cap.colorHex || '#667eea',
                    }}
                  >
                    {getIconByCategory(cap.capabilityType)}
                  </div>
                  {cap.version && (
                    <span className={styles.cardVersionBadge}>{cap.version}</span>
                  )}
                </div>

                {/* 分类标签 */}
                <span className={`${styles.categoryTag} ${styles[cap.capabilityType || 'runtime']}`}>
                  {CATEGORY_CONFIG.find(c => c.key === cap.capabilityType)?.label || '运行时'}
                </span>

                {/* 名称 */}
                <div className={styles.cardName}>{cap.name}</div>
                {cap.nameEn && (
                  <div className={styles.cardNameEn}>{cap.nameEn}</div>
                )}

                {/* 描述 */}
                {cap.description && (
                  <div className={styles.cardDesc}>{cap.description}</div>
                )}

                {/* API 端点路径 */}
                {cap.apiEndpoint && (
                  <div className={styles.cardEndpoint}>
                    <span className={`${styles.cardEndpointMethod} ${styles[cap.method?.toLowerCase() || 'get']}`}>
                      {cap.method || 'GET'}
                    </span>
                    {cap.apiEndpoint.replace('/api/platform/v1/capabilities/', '/')}
                  </div>
                )}

                {/* 操作按钮 */}
                <div className={styles.cardActions}>
                  <Button
                    size="small"
                    icon={<EyeOutlined />}
                    className={`${styles.cardActionBtn} ${styles.cardActionBtnDefault}`}
                    onClick={() => handleViewDetail(cap)}
                  >
                    查看详情
                  </Button>
                  <Button
                    size="small"
                    icon={<ExperimentOutlined />}
                    className={`${styles.cardActionBtn} ${styles.cardActionBtnPrimary}`}
                    onClick={() => handleTryIt(cap)}
                  >
                    在线调试
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>

      {/* 空状态 */}
      {filteredCapabilities.length === 0 && (
        <div className={styles.emptyState}>
          <div className={styles.emptyStateIcon}><InfoCircleOutlined /></div>
          <div className={styles.emptyStateText}>该分类下暂无能力项</div>
        </div>
      )}

      {/* ====== API 端点速查表 ====== */}
      <div className={styles.apiEndpointSection}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.sectionTitleIcon}><ApiOutlined /></span>
          API 端点速查表
          <Tag color="blue" style={{ marginLeft: 8, fontSize: 11 }}>{API_ENDPOINTS.length} 个端点</Tag>
        </h2>
        <div className={styles.apiEndpointList}>
          {API_ENDPOINTS.map((ep, idx) => (
            <motion.div
              key={idx}
              className={styles.apiEndpointItem}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.06, duration: 0.3 }}
            >
              <span className={`apiMethodBadge ${styles[ep.methodColor]}`}>{ep.method}</span>
              <span className={styles.apiPath}>{ep.path}</span>
              <span className={styles.apiDesc}>{ep.desc}</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ====== Try-It 调试面板 Modal ====== */}
      <Modal
        open={tryItVisible}
        onCancel={() => setTryItVisible(false)}
        footer={null}
        title={
          selectedCapability ? (
            <span>
              <ExperimentOutlined /> 在线调试 — {selectedCapability.name}
              <Tag
                color={
                  selectedCapability.capabilityType === 'detect' ? 'orange'
                  : selectedCapability.capabilityType === 'agent' ? 'blue'
                  : selectedCapability.capabilityType === 'compress' ? 'green'
                  : 'purple'
                }
                style={{ marginLeft: 10, fontSize: 11 }}
              >
                {selectedCapability.capabilityType?.toUpperCase()}
              </Tag>
            </span>
          ) : undefined
        }
        width={680}
        className={styles.tryItModal}
        destroyOnClose
      >
        {renderTryItForm()}
      </Modal>

      {/* ====== 详情 Modal ====== */}
      <Modal
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        title={
          selectedCapability ? (
            <span><InfoCircleOutlined /> 能力详情 — {selectedCapability.name}</span>
          ) : undefined
        }
        width={600}
        className={styles.detailModal}
        destroyOnClose
      >
        {selectedCapability && (
          <div>
            <div className={styles.detailGrid}>
              <div className={styles.detailItem}>
                <div className={styles.detailItemLabel}>能力 ID</div>
                <div className={styles.detailItemValue}>#{selectedCapability.id}</div>
              </div>
              <div className={styles.detailItem}>
                <div className={styles.detailItemLabel}>分类类型</div>
                <div className={styles.detailItemValue}>
                  <Tag
                    color={
                      selectedCapability.capabilityType === 'detect' ? 'orange'
                      : selectedCapability.capabilityType === 'agent' ? 'blue'
                      : selectedCapability.capabilityType === 'compress' ? 'green'
                      : 'purple'
                    }
                  >
                    {CATEGORY_CONFIG.find(c => c.key === selectedCapability.capabilityType)?.label || '运行时'}
                  </Tag>
                </div>
              </div>
              <div className={styles.detailItem}>
                <div className={styles.detailItemLabel}>版本号</div>
                <div className={styles.detailItemValue}>{selectedCapability.version || '-'}</div>
              </div>
              <div className={styles.detailItem}>
                <div className={styles.detailItemLabel}>权重</div>
                <div className={styles.detailItemValue}>{selectedCapability.weight}/10</div>
              </div>
              <div className={styles.detailItem} style={{ gridColumn: '1 / -1' }}>
                <div className={styles.detailItemLabel}>API 端点</div>
                <div className={styles.detailItemValue} style={{ fontFamily: "'SF Mono', monospace", fontSize: 12, color: '#86caff' }}>
                  {selectedCapability.method} {selectedCapability.apiEndpoint || '-'}
                </div>
              </div>
              <div className={styles.detailItem} style={{ gridColumn: '1 / -1' }}>
                <div className={styles.detailItemLabel}>描述</div>
                <div className={styles.detailItemValue} style={{ lineHeight: 1.7 }}>
                  {selectedCapability.description || selectedCapability.name}
                </div>
              </div>
            </div>

            {selectedCapability.keywords && selectedCapability.keywords.length > 0 && (
              <div className={styles.detailKeywords}>
                {selectedCapability.keywords.map((kw, i) => (
                  <span key={i} className={styles.detailKeywordTag}>{kw}</span>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PlatformCapabilitiesCenter;

// 用于解决 TypeScript 类型引用问题
interface CallAgentRequest {
  agent_code: 'auditor' | 'verifier' | 'archiver' | 'judge';
  message: string;
  scenario?: string;
  extra_context?: string;
}
