import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Tabs,
  Card,
  Switch,
  Form,
  Input,
  InputNumber,
  Button,
  Select,
  Tag,
  Typography,
  Space,
  Modal,
  App,
  Divider,
  Tooltip,
  Badge,
  Collapse,
  Slider,
  Spin,
} from 'antd';
import {
  SettingOutlined,
  EditOutlined,
  EyeOutlined,
  RobotOutlined,
  SaveOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  BulbOutlined,
  LockOutlined,
  AuditOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { agentApi, type AgentConfigItem } from '@/api/agentApi';
import './AgentConfig.css';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface AgentConfig {
  id: number;
  code: string;
  name: string;
  enabled: boolean;
  sort_order: number;
  short_desc: string;
  full_desc: string;
  icon: string;
  color: string;
  system_prompt: string;
  welcome_msg: string;
  temperature: number;
  max_tokens: number;
  allow_summary: boolean;
  allow_analysis: boolean;
  allow_query: boolean;
  allow_export: boolean;
  timeout: number;
  retry_count: number;
  model: string;
}

const DEFAULT_AGENT_CONFIGS: AgentConfig[] = [
  {
    id: 1,
    code: 'auditor',
    name: '安全审计模块',
    enabled: true,
    sort_order: 1,
    short_desc: '内容风险扫描 / 敏感信息识别 / 合规检查',
    full_desc:
      '安全审计模块负责对目标内容进行全面的风险扫描和安全审计，识别敏感信息、违规内容、潜在安全隐患，最终输出专业的检测报告供后续环节参考。',
    icon: 'Eye',
    color: '#DC2626',
    system_prompt: `安全审计模块功能说明：

1. **内容风险扫描**：对用户提供的内容进行全面的安全风险评估
2. **敏感信息识别**：识别敏感信息、违规内容、潜在安全隐患
3. **合规检查**：输出结构化的检测报告，包含风险等级、具体发现和建议措施

输出要求：
- 专业、客观、基于事实
- 使用结构化格式（列表、分级）
- 明确标注风险等级（高/中/低）
- 提供可操作的改进建议`,
    welcome_msg:
      '安全审计模块已就绪，请提供待检测内容',
    temperature: 0.7,
    max_tokens: 2000,
    allow_summary: true,
    allow_analysis: true,
    allow_query: true,
    allow_export: true,
    timeout: 30,
    retry_count: 2,
    model: 'gpt-4o',
  },
  {
    id: 2,
    code: 'verifier',
    name: '真实性核验模块',
    enabled: true,
    sort_order: 2,
    short_desc: '来源追溯 / 交叉比对 / 置信度评估',
    full_desc:
      '真实性核验模块专注于信息的真实性和准确性验证，通过多维度交叉比对、来源追溯、事实核查等方式确保每条信息的准确可靠。',
    icon: 'CheckCircle',
    color: '#2563EB',
    system_prompt: `真实性核验模块功能说明：

1. **来源追溯**：追查信息源头，评估来源可信度
2. **交叉比对**：将信息与多个权威来源进行对比验证
3. **置信度评估**：给出综合的可信度评级（A/B/C/D级）

输出要求：
- 严谨、客观、有据可查
- 注明验证方法和数据来源
- 给出明确的置信度评分和评级依据`,
    welcome_msg:
      '真实性核验模块已就绪，请提供待检测内容',
    temperature: 0.5,
    max_tokens: 2000,
    allow_summary: true,
    allow_analysis: true,
    allow_query: true,
    allow_export: false,
    timeout: 30,
    retry_count: 2,
    model: 'gpt-4o',
  },
  {
    id: 3,
    code: 'archiver',
    name: '数据存证模块',
    enabled: true,
    sort_order: 3,
    short_desc: '数字指纹 / 时间戳锚定 / 完整性校验',
    full_desc:
      '数据存证模块提供不可篡改的数据存证服务，通过数字指纹生成和时间戳锚定，保障数据的完整性和可追溯性。',
    icon: 'Lock',
    color: '#16A34A',
    system_prompt: `数据存证模块功能说明：

1. **数字指纹**：为内容生成唯一的数字指纹（哈希值）
2. **时间戳锚定**：记录精确的操作时间和不可篡改性
3. **完整性校验**：验证数据是否被篡改或损坏

输出要求：
- 强调数据的完整性和不可篡改性
- 提供具体的存证编号和哈希值
- 解释存证的技术原理`,
    welcome_msg:
      '数据存证模块已就绪，请提供待检测内容',
    temperature: 0.3,
    max_tokens: 1500,
    allow_summary: false,
    allow_analysis: true,
    allow_query: true,
    allow_export: true,
    timeout: 60,
    retry_count: 3,
    model: 'gpt-4o',
  },
  {
    id: 4,
    code: 'judge',
    name: '智能裁决模块',
    enabled: true,
    sort_order: 4,
    short_desc: '规则匹配 / 风险评估 / 决策输出',
    full_desc:
      '智能裁决模块是最终的决策引擎，综合前三个模块的检测结果，基于规则库进行智能裁决判定，给出可追溯、可解释的裁决结论。',
    icon: 'Gavel',
    color: '#EA580C',
    system_prompt: `智能裁决模块功能说明：

1. **规则匹配**：将分析结果与预定义的规则库进行匹配
2. **风险评估**：综合审计、核验、存证模块的报告进行分析
3. **决策输出**：给出最终的安全等级评定及明确的通过/驳回/需补充意见

输出要求：
- 公正、全面、有理有据
- 引用前序模块的关键发现
- 给出清晰的裁决结论和改进建议
- 所有结论必须可追溯、可解释`,
    welcome_msg:
      '智能裁决模块已就绪，请提供待检测内容',
    temperature: 0.6,
    max_tokens: 2500,
    allow_summary: true,
    allow_analysis: true,
    allow_query: true,
    allow_export: true,
    timeout: 45,
    retry_count: 2,
    model: 'gpt-4o',
  },
];

const ICON_OPTIONS = [
  { label: 'Eye (眼睛)', value: 'Eye' },
  { label: 'CheckCircle (勾选)', value: 'CheckCircle' },
  { label: 'Lock (锁)', value: 'Lock' },
  { label: 'Gavel (法槌)', value: 'Gavel' },
];

const MODEL_OPTIONS = [
  { label: 'GPT-4o', value: 'gpt-4o' },
  { label: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
  { label: 'Claude 3.5 Sonnet', value: 'claude-3.5' },
  { label: '自定义模型', value: 'custom' },
];

const getIconComponent = (iconName: string) => {
  const map: Record<string, React.ReactNode> = {
    Eye: <EyeOutlined />,
    CheckCircle: <CheckCircleOutlined />,
    Lock: <LockOutlined />,
    Gavel: <AuditOutlined />,
  };
  return map[iconName] || <RobotOutlined />;
};

const deepClone = <T,>(obj: T): T => JSON.parse(JSON.stringify(obj));

const AgentConfigPage: React.FC = () => {
  const { message, modal } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('auditor');
  const [configs, setConfigs] = useState<AgentConfig[]>(() => deepClone(DEFAULT_AGENT_CONFIGS));
  const [dirtyFlags, setDirtyFlags] = useState<Record<string, boolean>>({});
  const formsRef = useRef<Record<string, any>>({});

  const currentConfig = configs.find((c) => c.code === activeTab);
  const isDirty = dirtyFlags[activeTab] || false;

  useEffect(() => {
    const fetchConfigs = async () => {
      setLoading(true);
      try {
        const res: any = await agentApi.getConfigs();
        const data = res?.data?.results || res?.data?.results || res?.results || res?.data || res;
        if (Array.isArray(data) && data.length > 0) {
          const mappedConfigs: AgentConfig[] = data.map((item: AgentConfigItem) => ({
            id: item.id,
            code: item.code,
            name: item.name,
            enabled: item.enabled,
            sort_order: item.sort_order,
            short_desc: item.short_desc,
            full_desc: item.full_desc,
            icon: item.icon,
            color: item.color,
            system_prompt: item.system_prompt,
            welcome_msg: item.welcome_msg,
            temperature: item.temperature,
            max_tokens: item.max_tokens,
            allow_summary: item.allow_summary,
            allow_analysis: item.allow_analysis,
            allow_query: item.allow_query,
            allow_export: item.allow_export,
            timeout: item.timeout,
            retry_count: item.retry_count,
            model: item.model,
          }));
          setConfigs(mappedConfigs);
          if (mappedConfigs.length > 0 && !activeTab) {
            setActiveTab(mappedConfigs[0].code);
          }
          message.success('配置加载成功');
        }
      } catch (err: any) {
        console.error('获取Agent配置失败:', err);
        message.error('加载配置失败，使用默认配置');
      } finally {
        setLoading(false);
      }
    };
    fetchConfigs();
  }, []);

  const updateField = useCallback(
    (code: string, field: keyof AgentConfig, value: any) => {
      setConfigs((prev) =>
        prev.map((c) => (c.code === code ? { ...c, [field]: value } : c))
      );
      setDirtyFlags((prev) => ({ ...prev, [code]: true }));
    },
    []
  );

  const handleSaveCurrent = useCallback(async () => {
    if (!currentConfig) return;
    try {
      await agentApi.updateConfig(currentConfig.id, currentConfig);
      message.success(`「${currentConfig.name}」配置已保存`);
      setDirtyFlags((prev) => ({ ...prev, [activeTab]: false }));
    } catch (err: any) {
      console.error('保存配置失败:', err);
      message.error('保存失败，请稍后重试');
    }
  }, [currentConfig, activeTab, message]);

  const handleSaveAll = useCallback(async () => {
    const dirtyKeys = Object.keys(dirtyFlags).filter((k) => dirtyFlags[k]);
    if (dirtyKeys.length > 0) {
      try {
        const dirtyConfigs = configs.filter((c) => dirtyFlags[c.code]);
        await agentApi.batchUpdateConfigs(dirtyConfigs);
        message.success(`已保存 ${dirtyKeys.length} 个角色的配置变更`);
        setDirtyFlags({});
      } catch (err: any) {
        console.error('批量保存失败:', err);
        message.error('批量保存失败，请稍后重试');
      }
    } else {
      message.info('没有未保存的变更');
    }
  }, [dirtyFlags, configs, message]);

  const handleResetDefault = useCallback(() => {
    if (!currentConfig) return;
    modal.confirm({
      title: `重置默认配置`,
      content: (
        <span>
          确定要将「<strong>{currentConfig.name}</strong>」恢复为默认Prompt配置吗？当前所有修改将被覆盖。
        </span>
      ),
      okText: '确认重置',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          setLoading(true);
          const res: any = await agentApi.getConfigs();
          const data = res?.data?.results || res?.results || res?.data || res;
          if (Array.isArray(data) && data.length > 0) {
            const mappedConfigs: AgentConfig[] = data.map((item: AgentConfigItem) => ({
              id: item.id,
              code: item.code,
              name: item.name,
              enabled: item.enabled,
              sort_order: item.sort_order,
              short_desc: item.short_desc,
              full_desc: item.full_desc,
              icon: item.icon,
              color: item.color,
              system_prompt: item.system_prompt,
              welcome_msg: item.welcome_msg,
              temperature: item.temperature,
              max_tokens: item.max_tokens,
              allow_summary: item.allow_summary,
              allow_analysis: item.allow_analysis,
              allow_query: item.allow_query,
              allow_export: item.allow_export,
              timeout: item.timeout,
              retry_count: item.retry_count,
              model: item.model,
            }));
            setConfigs(mappedConfigs);
            setDirtyFlags({});
            message.success('已从服务器重新加载最新配置');
          }
        } catch (err: any) {
          console.error('重置失败:', err);
          const defaultCfg = DEFAULT_AGENT_CONFIGS.find((d) => d.code === activeTab);
          if (defaultCfg) {
            setConfigs((prev) =>
              prev.map((c) => (c.code === activeTab ? deepClone(defaultCfg) : c))
            );
            setDirtyFlags((prev) => ({ ...prev, [activeTab]: false }));
            message.success(`「${currentConfig.name}」已恢复为本地默认配置`);
          }
        } finally {
          setLoading(false);
        }
      },
    });
  }, [currentConfig, activeTab, message, modal]);

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await agentApi.getConfigs();
      const data = res?.data?.results || res?.results || res?.data || res;
      if (Array.isArray(data) && data.length > 0) {
        const mappedConfigs: AgentConfig[] = data.map((item: AgentConfigItem) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          enabled: item.enabled,
          sort_order: item.sort_order,
          short_desc: item.short_desc,
          full_desc: item.full_desc,
          icon: item.icon,
          color: item.color,
          system_prompt: item.system_prompt,
          welcome_msg: item.welcome_msg,
          temperature: item.temperature,
          max_tokens: item.max_tokens,
          allow_summary: item.allow_summary,
          allow_analysis: item.allow_analysis,
          allow_query: item.allow_query,
          allow_export: item.allow_export,
          timeout: item.timeout,
          retry_count: item.retry_count,
          model: item.model,
        }));
        setConfigs(mappedConfigs);
        setDirtyFlags({});
        message.success('配置已刷新');
      }
    } catch (err: any) {
      console.error('刷新配置失败:', err);
      message.error('刷新失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [message]);

  const handleSwitchEnabled = useCallback(
    (checked: boolean) => {
      if (!currentConfig) return;
      const action = checked ? '启用' : '禁用';
      modal.confirm({
        title: `${action}角色`,
        content: (
          <span>
            确定要{action}「<strong>{currentConfig.name}</strong>」吗？
          </span>
        ),
        okText: `确认${action}`,
        cancelText: '取消',
        onOk: () => {
          updateField(activeTab, 'enabled', checked);
          message.success(`已${action}「${currentConfig.name}」`);
        },
      });
    },
    [currentConfig, activeTab, updateField, message, modal]
  );

  const handleTabChange = useCallback(
    (key: string) => {
      if (isDirty && key !== activeTab) {
        modal.confirm({
          title: '存在未保存的修改',
          content: '当前角色的配置有未保存的修改，切换标签页可能会丢失这些修改。是否继续切换？',
          okText: '继续切换',
          cancelText: '留在当前页',
          onOk: () => {
            setActiveTab(key);
          },
        });
      } else {
        setActiveTab(key);
      }
    },
    [isDirty, activeTab, modal]
  );

  const tabItems = DEFAULT_AGENT_CONFIGS.map((cfg) => ({
    key: cfg.code,
    label: (
      <span className="tab-indicator">
        <span className="tab-color-dot" style={{ backgroundColor: cfg.color }} />
        {cfg.name}
      </span>
    ),
    children: renderAgentPanel(cfg),
  }));

  function renderAgentPanel(cfg: AgentConfig) {
    return (
      <div className="agent-form">
        <Form layout="vertical" size="middle" initialValues={cfg}>
          {/* 区块1: 基本信息 */}
          <div className="config-section">
            <Card
              title={
                <Space>
                  <SettingOutlined style={{ color: '#1A6BA8' }} />
                  基本信息
                </Space>
              }
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <Form.Item label="角色名称">
                  <Input
                    value={currentConfig?.name}
                    onChange={(e) => updateField(cfg.code, 'name', e.target.value)}
                    placeholder="请输入角色名称"
                  />
                </Form.Item>
                <Form.Item label="角色编码">
                  <Input value={cfg.code} disabled style={{ background: '#F5F5F5' }} />
                </Form.Item>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <Form.Item label="启用状态">
                  <Switch
                    checked={currentConfig?.enabled ?? cfg.enabled}
                    onChange={handleSwitchEnabled}
                    checkedChildren="开启"
                    unCheckedChildren="关闭"
                  />
                  <Tag
                    color={currentConfig?.enabled ? '#389e0d' : '#999'}
                    style={{ marginLeft: 10 }}
                  >
                    {currentConfig?.enabled ? '运行中' : '已停用'}
                  </Tag>
                </Form.Item>
                <Form.Item label="排序序号">
                  <InputNumber
                    value={currentConfig?.sort_order ?? cfg.sort_order}
                    min={1}
                    max={99}
                    onChange={(v) => updateField(cfg.code, 'sort_order', v)}
                    style={{ width: '100%' }}
                  />
                </Form.Item>
              </div>
            </Card>
          </div>

          {/* 区块2: 角色简介 */}
          <div className="config-section">
            <Card
              title={
                <Space>
                  <FileTextOutlined style={{ color: '#2563EB' }} />
                  角色简介
                </Space>
              }
            >
              <Form.Item label="简短描述">
                <Input
                  value={currentConfig?.short_desc}
                  onChange={(e) => updateField(cfg.code, 'short_desc', e.target.value)}
                  placeholder="一句话描述该角色的核心能力"
                />
              </Form.Item>
              <Form.Item label="详细介绍">
                <TextArea
                  rows={4}
                  value={currentConfig?.full_desc}
                  onChange={(e) => updateField(cfg.code, 'full_desc', e.target.value)}
                  placeholder="请输入角色的详细介绍说明"
                />
              </Form.Item>
              <Form.Item label="展示图标">
                <Select
                  value={currentConfig?.icon ?? cfg.icon}
                  onChange={(v) => updateField(cfg.code, 'icon', v)}
                  options={ICON_OPTIONS}
                  style={{ width: 220 }}
                />
                <span style={{ marginLeft: 12, fontSize: 18, verticalAlign: 'middle' }}>
                  {getIconComponent(currentConfig?.icon ?? cfg.icon)}
                </span>
              </Form.Item>
            </Card>
          </div>

          {/* 区块3: Prompt 配置 */}
          <div className="config-section">
            <Card
              title={
                <Space>
                  <BulbOutlined style={{ color: '#D97706' }} />
                  Prompt 配置
                </Space>
              }
            >
              <Form.Item
                label={
                  <Space>
                    系统人设 Prompt
                    <Tooltip title="这是AI角色的核心人设指令，决定了AI的行为和输出风格">
                      <EditOutlined style={{ color: '#9CA3AF', fontSize: 13 }} />
                    </Tooltip>
                  </Space>
                }
              >
                <TextArea
                  className="prompt-editor"
                  rows={8}
                  value={currentConfig?.system_prompt}
                  onChange={(e) => updateField(cfg.code, 'system_prompt', e.target.value)}
                  placeholder="请输入系统人设Prompt..."
                />
              </Form.Item>

              <Divider className="divider-inline" />

              <Form.Item label="欢迎语">
                <Input
                  value={currentConfig?.welcome_msg}
                  onChange={(e) => updateField(cfg.code, 'welcome_msg', e.target.value)}
                  placeholder="打开对话时的首句问候语"
                />
              </Form.Item>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <Form.Item label={`温度参数 (${currentConfig?.temperature ?? cfg.temperature})`}>
                  <Slider
                    min={0}
                    max={2}
                    step={0.1}
                    value={currentConfig?.temperature ?? cfg.temperature}
                    onChange={(v) => updateField(cfg.code, 'temperature', v)}
                    marks={{
                      0: '精确',
                      0.7: '平衡',
                      1.5: '创意',
                      2: '随机',
                    }}
                  />
                </Form.Item>
                <Form.Item label="最大 Token 数">
                  <Space.Compact style={{ width: '100%' }}>
                    <InputNumber
                      value={currentConfig?.max_tokens ?? cfg.max_tokens}
                      min={100}
                      max={16000}
                      step={100}
                      onChange={(v) => updateField(cfg.code, 'max_tokens', v)}
                      style={{ flex: 1 }}
                    />
                    <Input defaultValue="tokens" disabled style={{ width: 60, textAlign: 'center', color: '#999', pointerEvents: 'none' }} />
                  </Space.Compact>
                </Form.Item>
              </div>

              <Divider className="divider-inline" />

              <Form.Item label="功能开关组">
                <div className="feature-switch-group">
                  <FeatureSwitchItem
                    label="允许总结"
                    checked={currentConfig?.allow_summary ?? cfg.allow_summary}
                    onChange={(v) => updateField(cfg.code, 'allow_summary', v)}
                    icon={<FileTextOutlined />}
                  />
                  <FeatureSwitchItem
                    label="允许分析"
                    checked={currentConfig?.allow_analysis ?? cfg.allow_analysis}
                    onChange={(v) => updateField(cfg.code, 'allow_analysis', v)}
                    icon={<ThunderboltOutlined />}
                  />
                  <FeatureSwitchItem
                    label="允许查询"
                    checked={currentConfig?.allow_query ?? cfg.allow_query}
                    onChange={(v) => updateField(cfg.code, 'allow_query', v)}
                    icon={<EyeOutlined />}
                  />
                  <FeatureSwitchItem
                    label="允许导出"
                    checked={currentConfig?.allow_export ?? cfg.allow_export}
                    onChange={(v) => updateField(cfg.code, 'allow_export', v)}
                    icon={<SafetyCertificateOutlined />}
                  />
                </div>
              </Form.Item>
            </Card>
          </div>

          {/* 区块4: 高级配置 */}
          <div className="config-section">
            <Collapse
              ghost
              items={[
                {
                  key: 'advanced',
                  label: (
                    <Space>
                      <ClockCircleOutlined style={{ color: '#6366F1' }} />
                      高级配置
                      <Tag color="#EDE9FE" style={{ fontSize: 11, marginInlineStart: 4 }}>
                        可选
                      </Tag>
                    </Space>
                  ),
                  children: (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '16px',
                      }}
                    >
                      <Form.Item label="超时时间 (秒)">
                        <Space.Compact style={{ width: '100%' }}>
                          <InputNumber
                            value={currentConfig?.timeout ?? cfg.timeout}
                            min={5}
                            max={300}
                            step={5}
                            onChange={(v) => updateField(cfg.code, 'timeout', v)}
                            style={{ flex: 1 }}
                          />
                          <Input defaultValue="s" disabled style={{ width: 40, textAlign: 'center', color: '#999', pointerEvents: 'none' }} />
                        </Space.Compact>
                      </Form.Item>
                      <Form.Item label="重试次数">
                        <InputNumber
                          value={currentConfig?.retry_count ?? cfg.retry_count}
                          min={0}
                          max={10}
                          onChange={(v) => updateField(cfg.code, 'retry_count', v)}
                          style={{ width: '100%' }}
                        />
                      </Form.Item>
                      <Form.Item label="调用模型">
                        <Select
                          value={currentConfig?.model ?? cfg.model}
                          onChange={(v) => updateField(cfg.code, 'model', v)}
                          options={MODEL_OPTIONS}
                        />
                      </Form.Item>
                      <Form.Item label="API 端点">
                        <Input
                          placeholder="https://api.openai.com/v1"
                          onChange={(e) => updateField(cfg.code, 'api_endpoint', e.target.value)}
                        />
                      </Form.Item>
                      <Form.Item label="API 密钥" style={{ gridColumn: '1 / -1' }}>
                        <Input.Password
                          placeholder="sk-... (留空使用默认密钥)"
                          onChange={(e) => updateField(cfg.code, 'api_key', e.target.value)}
                        />
                      </Form.Item>
                    </div>
                  ),
                },
              ]}
            />
          </div>

          {/* 底部操作栏 */}
          <div className="footer-actions">
            <div className="footer-actions-left">
              {isDirty && (
                <span className="unsaved-hint">
                  <CloseCircleOutlined /> 有未保存的修改
                </span>
              )}
              {!isDirty && (
                <span className="unsaved-hint" style={{ color: '#389e0d' }}>
                  <CheckCircleOutlined /> 已保存
                </span>
              )}
            </div>
            <div className="footer-actions-right">
              <Button onClick={handleResetDefault} danger ghost>
                重置默认
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSaveCurrent}
                disabled={!isDirty}
              >
                保存当前角色
              </Button>
            </div>
          </div>
        </Form>
      </div>
    );
  }

  return (
    <Spin spinning={loading}>
    <div className="agent-config-page">
      {/* 页面头部 */}
      <div className="page-header">
        <div className="page-header-left">
          <Title level={4}>
            <RobotOutlined style={{ marginRight: 10, color: '#1A6BA8' }} />
            Agent 智能体配置
          </Title>
          <p className="page-header-subtitle">管理四角色AI助手的参数、Prompt与人设</p>
        </div>
        <Space wrap>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSaveAll}
          >
            保存全部
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
          >
            刷新
          </Button>
        </Space>
      </div>

      {/* 全局状态栏 */}
      <div className="status-bar">
        <span className="status-bar-label">角色状态概览：</span>
        {configs.map((agent) => (
          <Badge
            key={agent.code}
            count={agent.enabled ? '运行中' : '已停用'}
            style={{
              backgroundColor: agent.enabled ? '#389e0d' : '#9CA3AF',
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            <span className="status-item">
              <span
                className={`status-dot ${agent.enabled ? 'active' : 'inactive'}`}
                style={{ backgroundColor: agent.color }}
              />
              {agent.name}
            </span>
          </Badge>
        ))}
      </div>

      {/* Tab 切换区域 */}
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={tabItems}
        className="agent-tabs"
        size="large"
        destroyOnHidden={false}
      />
    </div>
    </Spin>
  );
};

/* 功能开关子组件 */
const FeatureSwitchItem: React.FC<{
  label: string;
  checked: boolean;
  onChange: (val: boolean) => void;
  icon: React.ReactNode;
}> = ({ label, checked, onChange, icon }) => (
  <div className="feature-switch-item">
    <span>
      {icon}
      <span className="feature-name">{label}</span>
    </span>
    <Switch size="small" checked={checked} onChange={onChange} />
  </div>
);

export default AgentConfigPage;
